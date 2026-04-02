import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAz5ufSz3SIR8ltWi0KTW-gAdmTQl4pAxg",
  authDomain: "perros-pos.firebaseapp.com",
  projectId: "perros-pos",
  storageBucket: "perros-pos.firebasestorage.app",
  messagingSenderId: "63377749239",
  appId: "1:63377749239:web:e3cb0284f04a3fe6608ff2",
  measurementId: "G-HGM3MHY5WH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
