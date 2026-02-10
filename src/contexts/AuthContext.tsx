import React, { createContext, useEffect, useState } from 'react';
import { 
  type User, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  getAuth 
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';

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

// Inicializar Firebase (si no está ya inicializado)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// UID autorizado para acceder a la intranet
const AUTHORIZED_UID = 'caU0aiwW3Td3waKBEAUj6Fz4ggy2';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAuthorized: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuchar cambios de autenticación
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Validar que el usuario esté autorizado
      if (userCredential.user.uid !== AUTHORIZED_UID) {
        await signOut(auth);
        throw new Error('No tienes permisos para acceder a esta aplicación');
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    isAuthorized: !!user && user.uid === AUTHORIZED_UID,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
