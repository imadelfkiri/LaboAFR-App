

// src/lib/firebase.ts
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
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

let app: FirebaseApp;
try {
  app = getApp();
} catch (e) {
  app = initializeApp(firebaseConfig);
}

const db = getFirestore(app);

// App Check initialization logic, wrapped in a promise
const initializeFirebaseAppCheck = (): Promise<FirebaseApp> => {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined') {
      try {
        // Pass your reCAPTCHA v3 site key (public key) to the provider.
        const appCheck = initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider('6Ld-sQ8qAAAAAGn4584i9GoV60ERb7aCU65_D2rO'),
          isTokenAutoRefreshEnabled: true
        });
        console.log("Firebase App Check initialized successfully.");
        resolve(app);
      } catch (e) {
        console.error("Error initializing Firebase App Check", e);
        reject(e);
      }
    } else {
      // Resolve without app check on the server
      resolve(app);
    }
  });
};


export const firebaseAppPromise = initializeFirebaseAppCheck();
export { db };
