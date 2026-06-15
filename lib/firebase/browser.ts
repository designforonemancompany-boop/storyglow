"use client";

import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";

let configPromise: Promise<FirebaseOptions> | null = null;

async function firebaseConfig() {
  if (!configPromise) {
    configPromise = fetch("/api/firebase-config", { credentials: "same-origin" })
      .then(async response => {
        if (!response.ok) throw new Error("StoryGlow sign-in configuration is unavailable.");
        return response.json() as Promise<FirebaseOptions>;
      });
  }
  return configPromise;
}

export async function firebaseBrowserApp() {
  if (getApps().length) return getApp();
  return initializeApp(await firebaseConfig());
}

export const firebaseBrowserAuth = async () => getAuth(await firebaseBrowserApp());
