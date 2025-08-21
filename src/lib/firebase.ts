
// src/lib/firebase.ts
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider, AppCheck } from "firebase/app-check";

const firebaseConfig = {
  "projectId": "fueltrack-afr",
  "appId": "1:908411260486:web:fd57de11a69873142dc447",
  "storageBucket": "fueltrack-afr.firebasestorage.app",
  "apiKey": "AIzaSyDjyU_KQ2_BJpcbDJ4lwk6hGbSwxFccPIs",
  "authDomain": "fueltrack-afr.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "908411260486"
};

// Initialize Firebase
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db: Firestore = getFirestore(app);
let appCheck: AppCheck | null = null;

if (typeof window !== 'undefined') {
    appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider('6Ld-sQ8qAAAAAGn4584i9GoV60ERb7aCU65_D2rO'),
        isTokenAutoRefreshEnabled: true,
    });
}

// firebaseAppPromise is kept for compatibility if needed, but direct export is cleaner.
const firebaseAppPromise = Promise.resolve(app);


export { db, appCheck, firebaseAppPromise };
