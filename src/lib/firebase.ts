
// src/lib/firebase.ts
import { initializeApp, getApp, type FirebaseApp } from "firebase/app";
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

let app: FirebaseApp;
let appCheck: AppCheck | null = null;
let db: Firestore;

const firebaseAppPromise = new Promise<FirebaseApp>((resolve) => {
    if (typeof window !== 'undefined') {
        try {
            app = getApp();
        } catch (e) {
            app = initializeApp(firebaseConfig);
        }

        appCheck = initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider('6Ld-sQ8qAAAAAGn4584i9GoV60ERb7aCU65_D2rO'),
            isTokenAutoRefreshEnabled: true,
        });
        
        db = getFirestore(app);
        resolve(app);
    }
});


export { db, appCheck, firebaseAppPromise };
