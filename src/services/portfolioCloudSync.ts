import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { decryptData, encryptData, EncryptedPayloadBundle } from './cryptoEngine';
import { PortfolioPosition } from '../types';
import { getVietnamTimeString } from '../utils/timeUtils';

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
  watchlist?: string[];
  updatedAt: string;
  version: number;
}

type SyncStatusListener = (status: CloudSyncStatus, lastSyncedTime: string | null, errorMsg?: string) => void;

class PortfolioCloudSyncService {
  private status: CloudSyncStatus = 'LOCAL_ONLY';
  private lastSyncedTime: string | null = null;
  private currentPin: string = '0000'; // Default PIN fallback
  private listeners: Set<SyncStatusListener> = new Set();
  private unsubscribeFirestore: (() => void) | null = null;
  private latestRemotePayload: EncryptedPayloadBundle | null = null;

  constructor() {
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

  public setPin(pin: string) {
    this.currentPin = pin;
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
          // Cloud doc doesn't exist yet -> upload initial local data
          this.status = 'SYNCED';
          this.lastSyncedTime = getVietnamTimeString();
          this.notify();
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
   * Decrypt and notify client if remote updated
   */
  private async decryptAndApply(bundle: EncryptedPayloadBundle, pin: string, updatedAt?: string) {
    try {
      const data = await decryptData<PortfolioDataModel>(bundle, pin);
      this.status = 'SYNCED';
      this.lastSyncedTime = updatedAt ? getVietnamTimeString(updatedAt) : getVietnamTimeString();
      this.notify();

      // Trigger custom window event for App to rehydrate
      window.dispatchEvent(
        new CustomEvent('VNQUANT_CLOUD_PORTFOLIO_RECEIVED', {
          detail: data,
        })
      );
    } catch (err) {
      this.status = 'NEED_PIN';
      this.notify('Mã PIN giải mã không khớp.');
    }
  }

  /**
   * Encrypt and Push local portfolio updates to Cloud Firestore
   */
  public async pushToCloud(data: PortfolioDataModel, pin = this.currentPin): Promise<boolean> {
    const user = auth.currentUser;
    if (!user) {
      this.status = 'LOCAL_ONLY';
      this.notify();
      return false;
    }

    this.status = 'SYNCING';
    this.notify();

    const docPath = `users/${user.uid}/portfolio/primary`;
    try {
      const encrypted = await encryptData(data, pin);
      const docRef = doc(db, 'users', user.uid, 'portfolio', 'primary');

      const payload = {
        userId: user.uid,
        encryptedPayload: encrypted.encryptedPayload,
        iv: encrypted.iv,
        salt: encrypted.salt,
        version: encrypted.version,
        updatedAt: new Date().toISOString(),
        deviceInfo: navigator.userAgent.substring(0, 100),
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
}

export const portfolioCloudSync = new PortfolioCloudSyncService();
