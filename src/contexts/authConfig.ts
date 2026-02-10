import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAcPmOLCEeL5sRenwhtTWCIBawWNcnD4Ls",
  authDomain: "malim-app.firebaseapp.com",
  projectId: "malim-app",
  storageBucket: "malim-app.firebasestorage.app",
  messagingSenderId: "953747301080",
  appId: "1:953747301080:web:d3cfd18e9be012bb822dad",
  measurementId: "G-9DD5YEX28R"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Obtén instancia de Auth
export const auth: Auth = getAuth(app);

// Tipo para el contexto de autenticación
export interface AuthContextType {
  user: any;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAuthorized: boolean;
}

// UID del usuario autorizado (reemplaza con el UID real)
export const AUTHORIZED_UID = process.env.REACT_APP_AUTHORIZED_UID || 'default-uid';
