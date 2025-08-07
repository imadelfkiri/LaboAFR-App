

// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// App Check is removed as Firestore is no longer used directly by the client.

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
// We keep db export in case it's used by other parts of the app,
// but the main data logic is now local.
const db = getFirestore(app);


export { db };
