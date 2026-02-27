import React, { createContext, useEffect, useState } from 'react';
import { 
  type User, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut, 
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, query, collection, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../credenciales';
import type { UserProfile } from './authConfig';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, profile: UserProfile) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAuthorized: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Genera un slug único (URL-safe) a partir del nombre del negocio o nombre personal */
async function generateUniqueSlug(name: string): Promise<string> {
  let base = (name || 'tienda')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  if (!base) base = 'tienda';

  let slug = base;
  let attempt = 0;

  while (true) {
    const q = query(collection(db, 'users'), where('slug', '==', slug));
    const snap = await getDocs(q);
    if (snap.empty) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

/** Crea el perfil del usuario y la suscripción trial en Firestore */
async function createUserProfile(uid: string, email: string, profile: UserProfile) {
  const slug = await generateUniqueSlug(profile.nombreNegocio || profile.nombre);

  // Calcular fecha de expiración del trial (15 días)
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 15);

  // Guardar perfil en colección 'users'
  await setDoc(doc(db, 'users', uid), {
    uid,
    email,
    nombre: profile.nombre,
    nombreNegocio: profile.nombreNegocio || '',
    telefono: profile.telefono,
    slug,
    trialEndsAt: trialEnd, // Fecha de expiración del trial (para verificar en la tienda)
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(db, 'subscriptions', uid), {
    plan: 'business',
    status: 'trialing',
    trialEnd,
    currentPeriodStart: new Date(),
    currentPeriodEnd: trialEnd,
    hasHadTrial: true,
    cancelAtPeriodEnd: false,
    email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Verifica si un usuario Google es nuevo y le crea perfil/trial si lo es */
async function ensureGoogleUserProfile(user: User) {
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (!userDoc.exists()) {
    await createUserProfile(user.uid, user.email || '', {
      nombre: user.displayName || '',
      telefono: '',
    });
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string, profile: UserProfile) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // Actualizar displayName en Firebase Auth
      await updateProfile(cred.user, { displayName: profile.nombre });

      // Crear perfil + trial en Firestore
      await createUserProfile(cred.user.uid, email, profile);
    } catch (error) {
      console.error('Error al registrar usuario:', error);
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      // Si es usuario nuevo de Google, crear perfil y trial
      await ensureGoogleUserProfile(result.user);
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

  // SaaS: todo usuario autenticado está autorizado (cada uno ve solo sus datos)
  const value = {
    user,
    loading,
    login,
    register,
    loginWithGoogle,
    logout,
    isAuthenticated: !!user,
    isAuthorized: !!user,
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
