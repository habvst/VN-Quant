import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { decryptData, encryptData, EncryptedPayloadBundle } from './cryptoEngine';
import { PortfolioPosition, WatchlistItem } from '../types';
import { getVietnamTimeString } from '../utils/timeUtils';
import { getStoredWatchlist, saveWatchlist } from './watchlistService';

export type CloudSyncStatus =
  | 'LOCAL_ONLY' // Not logged in, saving locally
  | 'SYNCING' // In progress of uploading/downloading
  | 'SYNCED' // Successfully synced with Cloud Firestore
  | 'NEED_PIN' // Cloud data exists, requires PIN to decrypt
  | 'ERROR'; // Network or permission error

export interface PortfolioDataModel {
  positions: PortfolioPosition[];
  capital: number;
  cashBalance: number;
  pendingCash: number;
  transactions?: any[];
  watchlist?: WatchlistItem[];
  updatedAt: string;
  version: number;
}

type SyncStatusListener = (status: CloudSyncStatus, lastSyncedTime: string | null, errorMsg?: string) => void;

const PIN_STORAGE_KEY = 'vnquant_e2ee_pin';

class PortfolioCloudSyncService {
  private status: CloudSyncStatus = 'LOCAL_ONLY';
  private lastSyncedTime: string | null = null;
  private currentPin: string = '0000';
  private listeners: Set<SyncStatusListener> = new Set();
  private unsubscribeFirestore: (() => void) | null = null;
  private latestRemotePayload: EncryptedPayloadBundle | null = null;
  private isApplyingRemoteUpdate = false;

  constructor() {
    // Load saved PIN from localStorage if available
    try {
      if (typeof window !== 'undefined') {
        const savedPin = localStorage.getItem(PIN_STORAGE_KEY);
        if (savedPin && savedPin.length >= 4) {
          this.currentPin = savedPin;
        }
      }
    } catch {}

    // Listen to Firebase Auth state
    auth.onAuthStateChanged((user) => {
      if (user) {
        this.status = 'SYNCING';
        this.notify();
        this.initCloudSubscription(user.uid);
      } else {
        if (this.unsubscribeFirestore) {
          this.unsubscribeFirestore();
          this.unsubscribeFirestore = null;
        }
        this.status = 'LOCAL_ONLY';
        this.notify();
      }
    });
  }

  public getPin(): string {
    return this.currentPin;
  }

  public setPin(pin: string) {
    this.currentPin = pin;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(PIN_STORAGE_KEY, pin);
      }
    } catch {}

    if (this.status === 'NEED_PIN' && this.latestRemotePayload) {
      this.decryptAndApply(this.latestRemotePayload, pin);
    }
  }

  public getStatus(): { status: CloudSyncStatus; lastSyncedTime: string | null } {
    return { status: this.status, lastSyncedTime: this.lastSyncedTime };
  }

  public onStatusChange(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status, this.lastSyncedTime);
    return () => this.listeners.delete(listener);
  }

  private notify(errorMsg?: string) {
    this.listeners.forEach((fn) => fn(this.status, this.lastSyncedTime, errorMsg));
  }

  /**
   * Helper to gather comprehensive local client data
   */
  public gatherCurrentLocalData(): PortfolioDataModel {
    let positions: PortfolioPosition[] = [];
    try {
      const savedPos = localStorage.getItem('vnquant_portfolio_positions');
      if (savedPos) positions = JSON.parse(savedPos);
    } catch {}

    let capital = 1000000000;
    try {
      const savedCap = localStorage.getItem('vnquant_portfolio_capital');
      if (savedCap) capital = Number(savedCap);
    } catch {}

    let cashBalance = 450000000;
    try {
      const savedCash = localStorage.getItem('vnquant_portfolio_cash');
      if (savedCash) cashBalance = Number(savedCash);
    } catch {}

    let pendingCash = 0;
    try {
      const savedPending = localStorage.getItem('vnquant_portfolio_pending_cash');
      if (savedPending) pendingCash = Number(savedPending);
    } catch {}

    let transactions: any[] = [];
    try {
      const savedTrades = localStorage.getItem('vnquant_portfolio_trades');
      if (savedTrades) transactions = JSON.parse(savedTrades);
    } catch {}

    const watchlist = getStoredWatchlist();

    return {
      positions,
      capital,
      cashBalance,
      pendingCash,
      transactions,
      watchlist,
      updatedAt: new Date().toISOString(),
      version: 1,
    };
  }

  public getLocalDataSummary() {
    const data = this.gatherCurrentLocalData();
    return {
      positionsCount: data.positions.length,
      watchlistCount: data.watchlist ? data.watchlist.length : 0,
      capital: data.capital,
      cashBalance: data.cashBalance,
      tradesCount: data.transactions ? data.transactions.length : 0,
      currentPin: this.currentPin,
    };
  }

  /**
   * Initialize Firestore Real-time Listener on User Portfolio doc
   */
  private initCloudSubscription(userId: string) {
    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore();
    }

    const docPath = `users/${userId}/portfolio/primary`;
    const docRef = doc(db, 'users', userId, 'portfolio', 'primary');

    this.unsubscribeFirestore = onSnapshot(
      docRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const remoteData = snapshot.data();
          const bundle: EncryptedPayloadBundle = {
            encryptedPayload: remoteData.encryptedPayload,
            iv: remoteData.iv,
            salt: remoteData.salt,
            version: remoteData.version || 1,
          };
          this.latestRemotePayload = bundle;
          await this.decryptAndApply(bundle, this.currentPin, remoteData.updatedAt);
        } else {
          // Cloud doc doesn't exist yet -> upload initial local data to protect it
          this.status = 'SYNCED';
          this.lastSyncedTime = getVietnamTimeString();
          this.notify();
          await this.pushToCloud();
        }
      },
      (error) => {
        this.status = 'ERROR';
        this.notify(error.message);
        handleFirestoreError(error, OperationType.GET, docPath);
      }
    );
  }

  /**
   * Decrypt, rehydrate localStorage and notify all app views
   */
  private async decryptAndApply(bundle: EncryptedPayloadBundle, pin: string, updatedAt?: string) {
    try {
      const data = await decryptData<PortfolioDataModel>(bundle, pin);
      this.isApplyingRemoteUpdate = true;
      this.status = 'SYNCED';
      this.lastSyncedTime = updatedAt ? getVietnamTimeString(updatedAt) : getVietnamTimeString();
      this.notify();

      // Hydrate localStorage directly for instant cross-tab access
      if (typeof window !== 'undefined') {
        if (Array.isArray(data.positions)) {
          localStorage.setItem('vnquant_portfolio_positions', JSON.stringify(data.positions));
        }
        if (data.capital !== undefined) {
          localStorage.setItem('vnquant_portfolio_capital', String(data.capital));
        }
        if (data.cashBalance !== undefined) {
          localStorage.setItem('vnquant_portfolio_cash', String(data.cashBalance));
        }
        if (data.pendingCash !== undefined) {
          localStorage.setItem('vnquant_portfolio_pending_cash', String(data.pendingCash));
        }
        if (Array.isArray(data.transactions)) {
          localStorage.setItem('vnquant_portfolio_trades', JSON.stringify(data.transactions));
        }
        if (Array.isArray(data.watchlist)) {
          saveWatchlist(data.watchlist);
        }

        // Trigger custom window event for App to rehydrate in memory
        window.dispatchEvent(
          new CustomEvent('VNQUANT_CLOUD_PORTFOLIO_RECEIVED', {
            detail: data,
          })
        );
      }

      // Sync backend Sentinel for real position monitoring
      if (data.positions && data.positions.length > 0) {
        fetch('/api/portfolio/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positions: data.positions }),
        }).catch((err) => console.warn('[SENTINEL SYNC NOTICE]:', err));
      }

      setTimeout(() => {
        this.isApplyingRemoteUpdate = false;
      }, 1500);
    } catch (err) {
      this.status = 'NEED_PIN';
      this.notify('Mã PIN giải mã không khớp.');
    }
  }

  /**
   * Encrypt and Push local portfolio updates to Cloud Firestore
   */
  public async pushToCloud(data?: PortfolioDataModel, pin = this.currentPin): Promise<boolean> {
    if (this.isApplyingRemoteUpdate) {
      // Prevent echo feedback loop
      return true;
    }

    const user = auth.currentUser;
    if (!user) {
      this.status = 'LOCAL_ONLY';
      this.notify();
      return false;
    }

    this.status = 'SYNCING';
    this.notify();

    const payloadData = data || this.gatherCurrentLocalData();
    const docPath = `users/${user.uid}/portfolio/primary`;
    try {
      const encrypted = await encryptData(payloadData, pin);
      const docRef = doc(db, 'users', user.uid, 'portfolio', 'primary');

      const payload = {
        userId: user.uid,
        encryptedPayload: encrypted.encryptedPayload,
        iv: encrypted.iv,
        salt: encrypted.salt,
        version: encrypted.version,
        updatedAt: new Date().toISOString(),
        deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 100) : 'Web Client',
      };

      await setDoc(docRef, payload, { merge: true });

      this.status = 'SYNCED';
      this.lastSyncedTime = getVietnamTimeString();
      this.notify();
      return true;
    } catch (error) {
      this.status = 'ERROR';
      this.notify(error instanceof Error ? error.message : 'Lỗi đồng bộ');
      handleFirestoreError(error, OperationType.WRITE, docPath);
      return false;
    }
  }

  /**
   * Pull and decrypt cloud document directly (Restore / Force Pull)
   */
  public async pullFromCloud(pin = this.currentPin): Promise<boolean> {
    const user = auth.currentUser;
    if (!user) {
      this.status = 'LOCAL_ONLY';
      this.notify('Chưa đăng nhập Google');
      return false;
    }

    this.status = 'SYNCING';
    this.notify();
    const docRef = doc(db, 'users', user.uid, 'portfolio', 'primary');
    try {
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const remoteData = snapshot.data();
        const bundle: EncryptedPayloadBundle = {
          encryptedPayload: remoteData.encryptedPayload,
          iv: remoteData.iv,
          salt: remoteData.salt,
          version: remoteData.version || 1,
        };
        this.latestRemotePayload = bundle;
        await this.decryptAndApply(bundle, pin, remoteData.updatedAt);
        return true;
      } else {
        this.status = 'SYNCED';
        this.notify();
        return false;
      }
    } catch (err: any) {
      this.status = 'ERROR';
      this.notify(err.message || 'Lỗi khi tải dữ liệu từ Cloud');
      return false;
    }
  }

  /**
   * Synchronize right now (Checks Cloud vs Local and reconciles)
   */
  public async syncNow(): Promise<{ success: boolean; message: string }> {
    const user = auth.currentUser;
    if (!user) {
      return {
        success: false,
        message: 'Bạn đang ở chế độ Lưu Cục Bộ. Vui lòng Đăng nhập Google để đồng bộ Đám mây.',
      };
    }

    const docRef = doc(db, 'users', user.uid, 'portfolio', 'primary');
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const remoteData = snap.data();
        const bundle: EncryptedPayloadBundle = {
          encryptedPayload: remoteData.encryptedPayload,
          iv: remoteData.iv,
          salt: remoteData.salt,
          version: remoteData.version || 1,
        };
        this.latestRemotePayload = bundle;
        await this.decryptAndApply(bundle, this.currentPin, remoteData.updatedAt);
        return {
          success: true,
          message: `Đã đồng bộ thành công với Cloud Firestore! (Cập nhật lúc ${getVietnamTimeString()})`,
        };
      } else {
        await this.pushToCloud();
        return {
          success: true,
          message: 'Đã tải lên và bảo vệ danh mục đầu tiên lên Cloud Firestore!',
        };
      }
    } catch (e: any) {
      return {
        success: false,
        message: e.message || 'Lỗi đồng bộ Đám mây',
      };
    }
  }
}

export const portfolioCloudSync = new PortfolioCloudSyncService();
