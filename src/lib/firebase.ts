
// src/lib/firebase.ts
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider, AppCheck } from "firebase/app-check";

const firebaseConfig = {
  apiKey: "AIzaSyC53dmBWCzf_YceZfhNs-Dv50Dw__wFO48",
  authDomain: "laboafr-app.firebaseapp.com",
  projectId: "laboafr-app",
  storageBucket: "laboafr-app.firebasestorage.app",
  messagingSenderId: "222450216856",
  appId: "1:222450216856:web:e94dd3f68370172b58c5ed"
};

// Initialize Firebase
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db: Firestore = getFirestore(app);
let appCheck: AppCheck | null = null;

if (typeof window !== 'undefined') {
    // Note: You need to go to the Firebase Console > App Check and register your site's reCAPTCHA v3 site key.
    // Without this, App Check will fail and queries to Firestore may be blocked.
    appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider('6LeIxAcpAAAAAPd_Xdp_18h5FAI_2M6vB_85hQfC'), // This is a public test key
        isTokenAutoRefreshEnabled: true,
    });
}

export { db };
