
// src/lib/firebase.ts
import { initializeApp, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
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
let app: FirebaseApp;
let appCheck: AppCheck | null = null;

try {
  app = getApp();
} catch (e) {
  app = initializeApp(firebaseConfig);
}

if (typeof window !== 'undefined') {
    appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider('6Ld-sQ8qAAAAAGn4584i9GoV60ERb7aCU65_D2rO'),
        isTokenAutoRefreshEnabled: true,
    });
}

const db = getFirestore(app);

export { db, appCheck };
