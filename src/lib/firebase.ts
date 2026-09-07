import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Storage key for client-side custom Firebase configuration override
export const CUSTOM_FIREBASE_STORAGE_KEY = 'vnquant_custom_firebase_config';

function getStoredCustomConfig() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CUSTOM_FIREBASE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.projectId === 'string' && parsed.projectId.trim() && parsed.apiKey) {
        return parsed;
      }
    }
  } catch {}
  return null;
}

function cleanVal(val?: string): string {
  if (!val) return '';
  let str = String(val).trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  return str;
}

const localConfig = getStoredCustomConfig();

// Determine custom config via Vite environment variables statically replaced at build time
const customApiKey = cleanVal(import.meta.env.VITE_FIREBASE_API_KEY);
const customAuthDomain = cleanVal(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
const customProjectId = cleanVal(import.meta.env.VITE_FIREBASE_PROJECT_ID);
const customStorageBucket = cleanVal(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET);
const customMessagingSenderId = cleanVal(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID);
const customAppId = cleanVal(import.meta.env.VITE_FIREBASE_APP_ID);
const customDbId = cleanVal(import.meta.env.VITE_FIREBASE_DATABASE_ID);

const isCustomProject = Boolean(localConfig?.projectId || customProjectId);
const rawDbId = localConfig?.firestoreDatabaseId || customDbId;
const isDefaultDb = !rawDbId || rawDbId === 'default' || rawDbId === '(default)';

// Initialize Firebase App with fallback to environment variables and local config
export const activeFirebaseConfig = {
  apiKey: cleanVal(localConfig?.apiKey) || customApiKey || firebaseConfig.apiKey,
  authDomain: cleanVal(localConfig?.authDomain) || customAuthDomain || firebaseConfig.authDomain,
  projectId: cleanVal(localConfig?.projectId) || customProjectId || firebaseConfig.projectId,
  storageBucket: cleanVal(localConfig?.storageBucket) || customStorageBucket || firebaseConfig.storageBucket,
  messagingSenderId: cleanVal(localConfig?.messagingSenderId) || customMessagingSenderId || firebaseConfig.messagingSenderId,
  appId: cleanVal(localConfig?.appId) || customAppId || firebaseConfig.appId,
  firestoreDatabaseId: isDefaultDb ? (isCustomProject ? '(default)' : firebaseConfig.firestoreDatabaseId) : rawDbId,
};

export function saveCustomFirebaseConfig(config: {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  firestoreDatabaseId?: string;
}) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(CUSTOM_FIREBASE_STORAGE_KEY, JSON.stringify(config));
  }
}

export function resetToDefaultFirebaseConfig() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CUSTOM_FIREBASE_STORAGE_KEY);
  }
}

const app = initializeApp(activeFirebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with custom database ID from config if present (standard projects use '(default)' or 'default')
export const db =
  activeFirebaseConfig.firestoreDatabaseId &&
  activeFirebaseConfig.firestoreDatabaseId !== '(default)' &&
  activeFirebaseConfig.firestoreDatabaseId !== 'default'
    ? getFirestore(app, activeFirebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Diagnostic connection test
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Client is offline or database initializing.');
    }
    return false;
  }
}

// Standard Firestore Error Handling conforming to specification
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path,
  };
  console.error('[Firestore Error]', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Authentication Helpers
export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      // Upsert user profile record without altering original createdAt
      const userRef = doc(db, 'users', result.user.uid);
      try {
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          await setDoc(userRef, {
            userId: result.user.uid,
            email: result.user.email || 'investor@vnquant.local',
            displayName: result.user.displayName || 'Nhà đầu tư Quant',
            photoURL: result.user.photoURL || '',
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
          });
        } else {
          const existing = userDoc.data();
          await setDoc(
            userRef,
            {
              userId: result.user.uid,
              email: result.user.email || existing.email || 'investor@vnquant.local',
              displayName: result.user.displayName || existing.displayName || 'Nhà đầu tư Quant',
              photoURL: result.user.photoURL || existing.photoURL || '',
              createdAt: existing.createdAt || new Date().toISOString(),
              lastLogin: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      } catch (firestoreErr) {
        console.warn('[Firebase Auth] Profile sync notice:', firestoreErr);
      }
      return result.user;
    }
    return null;
  } catch (err: any) {
    const errorCode = err?.code || '';
    const errorMsg = err?.message || '';

    if (errorCode === 'auth/unauthorized-domain' || errorMsg.includes('unauthorized-domain')) {
      console.warn('[Auth] Domain unauthorized for Google Sign-in:', typeof window !== 'undefined' ? window.location.hostname : 'unknown');
      throw new Error(`auth/unauthorized-domain: Tên miền "${typeof window !== 'undefined' ? window.location.hostname : ''}" chưa được thêm vào Authorized Domains trong Firebase Console.`);
    } else if (errorCode === 'auth/popup-blocked') {
      console.warn('[Auth] Popup blocked by browser');
      throw new Error('Trình duyệt đã chặn cửa sổ Popup Google. Vui lòng cho phép popup hoặc mở trong tab mới.');
    } else if (errorCode === 'auth/popup-closed-by-user') {
      console.warn('[Auth] Sign-in popup closed by user');
      throw new Error('Cửa sổ đăng nhập Google đã bị đóng trước khi hoàn tất.');
    } else if (errorCode === 'auth/cancelled-popup-request') {
      console.warn('[Auth] Popup request superseded');
      throw new Error('Yêu cầu đăng nhập bị hủy do có tác vụ mới.');
    } else if (errorCode === 'auth/api-key-not-valid' || errorMsg.includes('api-key-not-valid')) {
      console.warn('[Auth] Invalid Firebase API Key provided');
      throw new Error('auth/api-key-not-valid: API Key Firebase không hợp lệ hoặc chưa kích hoạt Google provider.');
    }

    console.error('[Auth] Google sign-in failed:', err);
    throw new Error(err.message || 'Đăng nhập Google thất bại');
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}
