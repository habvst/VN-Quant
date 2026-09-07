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

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with custom database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

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
    console.error('[Auth] Google sign-in failed:', err);
    if (err?.code === 'auth/popup-blocked') {
      throw new Error('Trình duyệt đã chặn cửa sổ Popup Google. Vui lòng cho phép popup hoặc mở trong tab mới.');
    } else if (err?.code === 'auth/popup-closed-by-user') {
      throw new Error('Cửa sổ đăng nhập Google đã bị đóng trước khi hoàn tất.');
    } else if (err?.code === 'auth/cancelled-popup-request') {
      throw new Error('Yêu cầu đăng nhập bị hủy do có tác vụ mới.');
    }
    throw new Error(err.message || 'Đăng nhập Google thất bại');
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}
