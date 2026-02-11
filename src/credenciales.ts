// credenciales.js
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, query, where, Timestamp, getDocs } from "firebase/firestore";
import { getMessaging, getToken } from "firebase/messaging";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDYJbwJgqTFBdToJIkhMRbwbI0x88QiCwI",
  authDomain: "stela-a8c06.firebaseapp.com",
  projectId: "stela-a8c06",
  storageBucket: "stela-a8c06.firebasestorage.app",
  messagingSenderId: "844317368141",
  appId: "1:844317368141:web:d4f862c7a7ee32859f6104",
  measurementId: "G-GEM1LZE0TF"
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
