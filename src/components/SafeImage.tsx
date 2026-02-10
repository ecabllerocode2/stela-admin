import React, { useEffect, useMemo, useRef, useState } from 'react';

type SafeImageProps = {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  loading?: 'lazy' | 'eager';
  onClick?: () => void;
  fallbackSrc?: string;
  crossOrigin?: '' | 'anonymous' | 'use-credentials';
  referrerPolicy?: string;
};

const DEFAULT_FALLBACK = 'https://via.placeholder.com/400?text=Imagen+no+disponible';

/**
 * Imagen segura con:
 * - Preload + decode para evitar parpadeos
 * - Reintentos con cache-busting en errores de carga
 * - Fallback configurable
 */
const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className,
  style,
  title,
  loading = 'lazy',
  onClick,
  fallbackSrc = DEFAULT_FALLBACK,
  crossOrigin = 'anonymous',
  referrerPolicy = 'no-referrer',
}) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [attempt, setAttempt] = useState(0);
  const maxAttempts = 2; // intento original + 2 reintentos
  const isBlobUrl = useMemo(() => src.startsWith('blob:'), [src]);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Reiniciar estado cuando cambia src
  useEffect(() => {
    setCurrentSrc(src);
    setAttempt(0);
  }, [src]);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();

    // Mantener mismas políticas que el <img>
    if (crossOrigin) img.crossOrigin = crossOrigin;
    if (referrerPolicy) img.referrerPolicy = referrerPolicy as any;

    img.src = currentSrc;

    const handleLoad = async () => {
      try {
        // decode asegura que la imagen está decodificada antes de mostrarla
        if (img.decode) {
          await img.decode();
        }
      } catch (_) {
        // Algunos navegadores no soportan decode en todas las condiciones; ignoramos
      }
    };

    const handleError = () => {
      if (!isMounted.current || cancelled) return;

      // Para blob: no tiene sentido reintentar con cache-busting
      if (isBlobUrl) {
        setCurrentSrc(fallbackSrc);
        return;
      }

      if (attempt < maxAttempts) {
        // Añadir parámetro cache-busting para evitar respuestas obsoletas del SW/proxy
        const url = new URL(currentSrc, window.location.origin);
        const param = `__cb_${attempt + 1}`;
        url.searchParams.set(param, String(Date.now()));
        setAttempt((a) => a + 1);
        setCurrentSrc(url.toString());
      } else {
        setCurrentSrc(fallbackSrc);
      }
    };

    img.onload = handleLoad;
    img.onerror = handleError;

    return () => {
      cancelled = true;
    };
  }, [currentSrc, attempt, maxAttempts, isBlobUrl, crossOrigin, referrerPolicy, fallbackSrc]);

  return (
    <img
      crossOrigin={crossOrigin}
      referrerPolicy={referrerPolicy as any}
      src={currentSrc}
      alt={alt}
      className={className}
      style={style}
      title={title}
      loading={loading}
      onClick={onClick}
      onError={() => {
        // Seguridad adicional si el navegador ignora el preloader
        // Dispara el flujo de reintento
        if (isBlobUrl) {
          setCurrentSrc(fallbackSrc);
        } else if (attempt < maxAttempts) {
          const url = new URL(currentSrc, window.location.origin);
          const param = `__cb_evt_${attempt + 1}`;
          url.searchParams.set(param, String(Date.now()));
          setAttempt((a) => a + 1);
          setCurrentSrc(url.toString());
        } else {
          setCurrentSrc(fallbackSrc);
        }
      }}
    />
  );
};

export default SafeImage;
