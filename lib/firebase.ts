import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBGxUY_Pnzv6XwcBTqWJ6KDplQ2DPgJpTk",
  authDomain: "nenas-admin.firebaseapp.com",
  projectId: "nenas-admin",
  storageBucket: "nenas-admin.firebasestorage.app",
  messagingSenderId: "416408781689",
  appId: "1:416408781689:web:72dd6ee7d85a4eda5ee5a8",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
