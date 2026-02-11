// credenciales.js
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, query, where, Timestamp, getDocs } from "firebase/firestore";
import { getMessaging, getToken } from "firebase/messaging";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

// Configuración de Firebase (usa Vite env variables en producción)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyDYJbwJgqTFBdToJIkhMRbwbI0x88QiCwI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "stela-a8c06.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "stela-a8c06",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "stela-a8c06.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "844317368141",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:844317368141:web:d4f862c7a7ee32859f6104",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "G-GEM1LZE0TF"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Firestore
const db = getFirestore(app);

// Messaging
const messaging = getMessaging(app);

// Analytics (solo si window exista)
const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;

// Auth
const auth = getAuth(app);

// Exporta instancias
export { db, messaging, analytics, auth };

export const generateToken = async () => {
  const permission = await Notification.requestPermission();
  console.log(permission);
  if (permission === "granted") {
    const token = await getToken(messaging, {
      vapidKey: "BPM6VClBoZtrYgw2TlJ4o4CPgWOLCbpE9lYdHbV-8RX_x6MaYFUEWG0EjBf7iDEVTMaaObPfU5MB87SPrC2u4rg"
    });
    console.log(token);
    if (token) {
      const tokensRef = collection(db, "tokens");
      const q = query(tokensRef, where("token", "==", token));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        await addDoc(tokensRef, {
          token,
          timestamp: Timestamp.now()
        });
        console.log("Token guardado");
      } else {
        console.log("El token ya existe en la base de datos");
      }
    }
  }
};
