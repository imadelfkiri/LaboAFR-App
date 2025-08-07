

// src/lib/firebase.ts
import { initializeApp, getApp, getApps } from "firebase/app";
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

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// App Check initialization logic
let appCheckInitialized = false;

const initializeFirebase = () => {
  if (typeof window !== 'undefined' && !appCheckInitialized) {
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider('6Ld-sQ8qAAAAAGn4584i9GoV60ERb7aCU65_D2rO'),
        isTokenAutoRefreshEnabled: true
      });
      appCheckInitialized = true;
      console.log("Firebase App Check initialized successfully.");
    } catch(e) {
      console.error("Error initializing Firebase App Check", e);
    }
  }
  return app;
};

// This promise will resolve when firebase is initialized
export const firebaseAppPromise = new Promise<any>((resolve) => {
    if (appCheckInitialized) {
        resolve(app);
    } else {
        // Retry until initialized
        const interval = setInterval(() => {
            initializeFirebase();
            if (appCheckInitialized) {
                clearInterval(interval);
                resolve(app);
            }
        }, 100);
    }
});


export { db, initializeFirebase };
