import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyABwzBg8f1I-n1FsbPunTuF6PKvtafzDa0",
  authDomain: "daily-dose-of-me-267c7.firebaseapp.com",
  projectId: "daily-dose-of-me-267c7",
  storageBucket: "daily-dose-of-me-267c7.firebasestorage.app",
  messagingSenderId: "1061980902663",
  appId: "1:1061980902663:web:bf14768b37c336d3b8a1a2",
  measurementId: "G-VQSZ6BW80Z"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Analytics is only supported in web browser environments
let analytics = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});

export { app, analytics };
