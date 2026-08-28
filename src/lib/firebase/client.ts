"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Nur fuer den Admin-Login im Browser. Enthaelt ausschliesslich oeffentliche
// Firebase-Web-Konfiguration (kein Secret) - siehe README.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const clientAuth = getAuth(app);
