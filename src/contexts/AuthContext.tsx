import React, { createContext, useEffect, useState } from 'react';
import { 
  type User, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut, 
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../credenciales';
import { AUTHORIZED_UID } from './authConfig';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
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
      
      // En desarrollo, permitir acceso a todos los usuarios
      // En producción, validar AUTHORIZED_UID
      const isDevelopment = import.meta.env.DEV || import.meta.env.VITE_ENV === 'development';
      
      if (!isDevelopment && userCredential.user.uid !== AUTHORIZED_UID) {
        await signOut(auth);
        throw new Error('No tienes permisos para acceder a esta aplicación');
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // En desarrollo, todos los usuarios registrados tienen acceso completo
    } catch (error) {
      console.error('Error al registrar usuario:', error);
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      
      // En desarrollo, permitir acceso a todos los usuarios
      // En producción, validar AUTHORIZED_UID
      const isDevelopment = import.meta.env.DEV || import.meta.env.VITE_ENV === 'development';
      
      if (!isDevelopment && userCredential.user.uid !== AUTHORIZED_UID) {
        await signOut(auth);
        throw new Error('No tienes permisos para acceder a esta aplicación');
      }
    } catch (error) {
      console.error('Error al iniciar sesión con Google:', error);
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

  // En desarrollo, todos los usuarios autenticados están autorizados
  const isDevelopment = import.meta.env.DEV || import.meta.env.VITE_ENV === 'development';

  const value = {
    user,
    loading,
    login,
    register,
    loginWithGoogle,
    logout,
    isAuthenticated: !!user,
    isAuthorized: !!user && (isDevelopment || user.uid === AUTHORIZED_UID),
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
