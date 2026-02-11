import type { Auth } from 'firebase/auth';
import { auth as firebaseAuth } from '../credenciales';

// Exportar la instancia de Auth centralizada
export const auth: Auth = firebaseAuth;

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
