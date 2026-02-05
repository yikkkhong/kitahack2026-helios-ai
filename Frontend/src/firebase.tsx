import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"; // Introducing connectors
import { getFunctions, connectFunctionsEmulator } from "firebase/functions"; // Introducing connectors

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
console.log("🔥 Firebase Key Loaded:", apiKey ? "YES" : "NO");

// The web app's Firebase configuration
// To find it: Firebase Console -> Project Settings -> General -> Your apps
const firebaseConfig = {
  apiKey: apiKey,
  authDomain: "kitahack2026-helios-ai.firebaseapp.com",
  projectId: "kitahack2026-helios-ai",
  storageBucket: "kitahack2026-helios-ai.firebasestorage.app",
  messagingSenderId: "905546202263",
  appId: "1:905546202263:web:ad4b959664923bc030fdd2",
};

const app = initializeApp(firebaseConfig);

// export module
export const db = getFirestore(app);
export const functions = getFunctions(app);

// --- Critical Fix: Automatically Detect Local Environment ---
// If you are running locally (localhost), force a connection to the local emulator
if (window.location.hostname === "localhost") {
  console.log("Connecting to the local Firebase emulator...");

  // Connect to the database simulator (default port 8080)
  connectFirestoreEmulator(db, "localhost", 8080);

  // Connect to the backend function simulator (default port 5001)
  connectFunctionsEmulator(functions, "localhost", 5001);

  connectFunctionsEmulator(functions, "127.0.0.1", 5001);

}
