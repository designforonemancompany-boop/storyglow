"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBKBcWNoKWdMJjlLHx3b4yegXdsghAxeDw",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "studio-3854882702-93a42.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-3854882702-93a42",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "studio-3854882702-93a42.firebasestorage.app",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:74268643195:web:5f6c17b56ee44dc95ab7de",
};

export function firebaseBrowserApp() {
  if (getApps().length) return getApp();
  return initializeApp(firebaseConfig);
}

export const firebaseBrowserAuth = () => getAuth(firebaseBrowserApp());
