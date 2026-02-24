// Hook para detectar y aplicar nuevas versiones de stela-admin
import { useEffect, useRef } from 'react';

const CHECK_INTERVAL = 5 * 60 * 1000; // Verificar cada 5 minutos
const VERSION_KEY = 'admin_app_version';

export const useAutoUpdate = () => {
  const checkingRef = useRef(false);

  useEffect(() => {
    const clearAllCaches = async () => {
      try {
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((name) => caches.delete(name)));
          console.log('✅ Cachés del Service Worker limpiados');
        }
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((r) => r.unregister()));
          console.log('✅ Service Workers desregistrados');
        }
      } catch (err) {
        console.warn('Error limpiando cachés:', err);
      }
    };

    const checkVersion = async () => {
      if (checkingRef.current) return;
      checkingRef.current = true;

      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        });

        if (!response.ok) return;

        const serverVersion = await response.json();
        const localRaw = localStorage.getItem(VERSION_KEY);

        if (!localRaw) {
          localStorage.setItem(VERSION_KEY, JSON.stringify(serverVersion));
          return;
        }

        const local = JSON.parse(localRaw);

        if (serverVersion.timestamp > local.timestamp) {
          console.log('🔄 Nueva versión detectada en stela-admin. Actualizando...');
          await clearAllCaches();
          localStorage.setItem(VERSION_KEY, JSON.stringify(serverVersion));
          window.location.reload();
        }
      } catch (err) {
        console.warn('Error verificando versión:', err);
      } finally {
        checkingRef.current = false;
      }
    };

    // Verificar inmediatamente al cargar
    checkVersion();

    // Verificar periódicamente
    const interval = setInterval(checkVersion, CHECK_INTERVAL);

    // Verificar cuando la ventana recupera el foco
    const handleFocus = () => setTimeout(checkVersion, 1000);
    window.addEventListener('focus', handleFocus);

    // Verificar cuando vuelve la conexión
    const handleOnline = () => setTimeout(checkVersion, 2000);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, []);
};
