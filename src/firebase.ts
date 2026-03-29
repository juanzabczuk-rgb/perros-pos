import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Firebase configuration from user's environment
// These are public client-side keys
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAz5ufSz3SIR8ltWi0KTW-gAdmTQl4pAxg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "perros-pos.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "perros-pos",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "perros-pos.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "63377749239",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:63377749239:web:e3cb0284f04a3fe6608ff2",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-6608FF2"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
