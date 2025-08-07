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
  try {
    // IMPORTANT: This key is for demonstration purposes only and will be replaced.
    // Ensure you have a valid reCAPTCHA v3 site key for your domain.
    const reCaptchaKey = "6LeLqfApAAAAAJ_kALrCaB3fGTHxXbH3m2GXSx9q"; 
    
    if (reCaptchaKey && reCaptchaKey.startsWith("6L")) {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(reCaptchaKey),
        isTokenAutoRefreshEnabled: true
      });
      console.log("Firebase App Check initialized successfully.");
    } else {
       console.warn("reCAPTCHA v3 key not found or invalid. App Check will not be initialized.");
    }
  } catch (error) {
    console.error("Error initializing Firebase App Check:", error);
  }
}

const db = getFirestore(app);

export { db };

    