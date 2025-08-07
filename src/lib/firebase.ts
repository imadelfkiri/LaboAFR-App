
// src/lib/firebase.ts
import { initializeApp, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

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
try {
  app = getApp();
} catch (e) {
  app = initializeApp(firebaseConfig);
}

const db = getFirestore(app);

// Initialize App Check
let appCheckInitialized: Promise<void> | null = null;
if (typeof window !== 'undefined') {
    appCheckInitialized = new Promise<void>((resolve) => {
        try {
            initializeAppCheck(app, {
                provider: new ReCaptchaV3Provider('6Ld-sQ8qAAAAAGn4584i9GoV60ERb7aCU65_D2rO'),
                isTokenAutoRefreshEnabled: true,
            });
            console.log("App Check initialized");
        } catch (error) {
            console.error("Error initializing App Check", error);
        } finally {
            resolve();
        }
    });
}

export { db, appCheckInitialized };
