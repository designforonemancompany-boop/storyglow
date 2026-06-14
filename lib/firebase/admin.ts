import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { serverEnv } from "@/lib/env";

function firebaseAdminApp() {
  if (getApps().length) return getApps()[0];
  const env = serverEnv();
  const credential = env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY
    ? cert({
      projectId: env.FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    })
    : applicationDefault();
  return initializeApp({
    credential,
    projectId: env.FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.FIREBASE_STORAGE_BUCKET,
  });
}

export const firebaseAdminAuth = () => getAuth(firebaseAdminApp());
export const firestore = () => getFirestore(firebaseAdminApp());
export const storageBucket = () => getStorage(firebaseAdminApp()).bucket();
