// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
