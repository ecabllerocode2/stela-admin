/**
 * Hook para obtener el perfil del usuario desde Firestore (colección 'users').
 * Incluye slug, nombreNegocio, telefono, y datos de configuración de la tienda.
 * Escucha cambios en tiempo real vía onSnapshot.
 */
import { useEffect, useState } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../credenciales';
import { useAuth } from '../contexts/AuthContext';

export interface StoreConfig {
  descripcionTienda?: string;
  logo?: string;
  bannerUrl?: string;
  instagram?: string;
  facebook?: string;
  direccion?: string;
  colorPrimario?: string;
  colorSecundario?: string;
}

export interface UserProfileData {
  uid: string;
  email: string;
  nombre: string;
  nombreNegocio: string;
  telefono: string;
  slug: string;
  // Store config
  descripcionTienda?: string;
  logo?: string;
  bannerUrl?: string;
  instagram?: string;
  facebook?: string;
  direccion?: string;
  colorPrimario?: string;
  colorSecundario?: string;
  createdAt?: any;
  updatedAt?: any;
}

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setProfile({
            uid: snap.id,
            email: data.email || user.email || '',
            nombre: data.nombre || '',
            nombreNegocio: data.nombreNegocio || '',
            telefono: data.telefono || '',
            slug: data.slug || '',
            descripcionTienda: data.descripcionTienda || '',
            logo: data.logo || '',
            bannerUrl: data.bannerUrl || '',
            instagram: data.instagram || '',
            facebook: data.facebook || '',
            direccion: data.direccion || '',
            colorPrimario: data.colorPrimario || '#d88c6d',
            colorSecundario: data.colorSecundario || '#f6d28c',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        } else {
          setProfile(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error escuchando perfil de usuario:', err);
        setError('Error al cargar el perfil');
        setLoading(false);
      }
    );

    return unsub;
  }, [user?.uid, user?.email]);

  /**
   * Actualiza campos del perfil del usuario en Firestore
   */
  const updateProfile = async (updates: Partial<StoreConfig & { nombreNegocio?: string; telefono?: string }>) => {
    if (!user?.uid) throw new Error('Usuario no autenticado');

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error actualizando perfil:', err);
      throw err;
    }
  };

  const storeName = profile?.nombreNegocio || profile?.nombre || 'Mi Tienda';

  const shopBaseUrl = import.meta.env.VITE_SHOP_URL || 'https://stela-shop.vercel.app';
  const storeUrl = profile?.slug ? `${shopBaseUrl}/${profile.slug}` : '';

  return {
    profile,
    loading,
    error,
    updateProfile,
    storeName,
    storeUrl,
  };
}
