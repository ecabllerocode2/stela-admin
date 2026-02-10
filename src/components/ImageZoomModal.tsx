import React from 'react';

interface ImageZoomModalProps {
  /** URL de la imagen a mostrar. Si es null, el modal se oculta. */
  imageUrl: string | null;
  /** Función para cerrar el modal. */
  onClose: () => void;
}

const ImageZoomModal: React.FC<ImageZoomModalProps> = ({ imageUrl, onClose }) => {
  // Si no hay URL, no renderizamos nada
  if (!imageUrl) return null;

  return (
    // Fondo semitransparente fijo que cubre toda la pantalla y maneja el cierre
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 z-[1000] flex justify-center items-center p-4 transition-opacity duration-300"
      onClick={onClose} 
    >
      {/* Contenedor de la imagen */}
      <div 
        className="max-w-4xl max-h-full rounded-lg overflow-hidden shadow-2xl relative"
        // Detiene la propagación del clic para que hacer clic en la imagen no cierre el modal
        onClick={(e) => e.stopPropagation()} 
      >
        <img 
          crossOrigin="anonymous" referrerPolicy="no-referrer"
          src={imageUrl} 
          alt="Producto en detalle" 
          className="max-w-full max-h-[90vh] object-contain"
        />
        
        {/* Botón de cerrar para mejor UX */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white bg-gray-900 bg-opacity-70 p-2 rounded-full hover:bg-red-600 transition-colors"
          aria-label="Cerrar vista detallada"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ImageZoomModal;