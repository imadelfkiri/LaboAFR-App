// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
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

const app = initializeApp(firebaseConfig);

// Initialize App Check
if (typeof window !== 'undefined') {
  // WARNING: Replace the following with your reCAPTCHA public key
  // This is a placeholder and WILL NOT WORK.
  const reCaptchaKey = "6Lf-p_cpAAAAAIm_pZq3H9g-gHYf2W9b3F1aE6E9"; 
  
  if (reCaptchaKey && reCaptchaKey !== "REPLACE_WITH_YOUR_RECAPTCHA_PUBLIC_KEY") {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(reCaptchaKey),
      isTokenAutoRefreshEnabled: true
    });
  }
}

const db = getFirestore(app);

export { db };
