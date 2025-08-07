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
  // IMPORTANT: This key is for demonstration purposes only.
  // Replace it with your own reCAPTCHA v3 site key.
  const reCaptchaKey = "6LeLqfApAAAAAJ_kALrCaB3fGTHxXbH3m2GXSx9q"; 
  
  if (reCaptchaKey && reCaptchaKey !== "REPLACE_WITH_YOUR_RECAPTCHA_PUBLIC_KEY") {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(reCaptchaKey),
      isTokenAutoRefreshEnabled: true
    });
  }
}

const db = getFirestore(app);

export { db };
