import React, { useState } from 'react';
import { PhotoIcon, XMarkIcon, DocumentIcon } from '@heroicons/react/24/outline';

// --- Componente Base Modal ---
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
            <div className={`bg-white rounded-lg shadow-xl w-full ${maxWidth} mx-auto transform transition-all`}>
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};
// --- FIN Componente Base Modal ---


// --- COMPONENTE DE CARGA DE IMAGEN (MULTIPLE SELECCIÓN) ---
interface ImageUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    
    variantId: number;
    variantSku: string;
    
    // MODIFICADO: Aceptamos 'any[]' para poder pasar File[] o string[]
    // El tercer argumento imageIds es opcional en nuevas subidas
    onImagesAssigned: (variantId: number, filesOrUrls: any[], imageIds?: string[]) => void;
}

const ImageUploadModal: React.FC<ImageUploadModalProps> = ({ isOpen, onClose, variantId, onImagesAssigned, variantSku }) => {
    
    const [previewFiles, setPreviewFiles] = useState<File[]>([]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const filesArray = Array.from(e.target.files);
            // Acumulamos archivos si el usuario selecciona varios veces antes de asignar
            setPreviewFiles(prev => [...prev, ...filesArray]);
        }
    };

    const removePreviewFile = (indexToRemove: number) => {
        setPreviewFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    };
    
    const handleAssignImages = () => {
        if (previewFiles.length > 0) {
            // CORRECCIÓN CRÍTICA:
            // Pasamos 'previewFiles' (Array de objetos File) directamente.
            // El componente padre detectará 'instanceof File' y los pondrá en la cola de subida.
            // Pasamos un array vacío como tercer argumento (IDs) ya que aún no existen en R2.
            onImagesAssigned(variantId, previewFiles, []);
        }
        
        // Limpia el estado y cierra el modal
        setPreviewFiles([]);
        onClose();
    };
    
    // Si se cierra sin asignar, limpiamos el estado
    const handleClose = () => {
        setPreviewFiles([]);
        onClose();
    };

    const filesSelected = previewFiles.length > 0;

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={handleClose} 
            title={`Asignar Imágenes a Variante ID: ${variantId}${variantSku ? ` (${variantSku})` : ''}`}
            maxWidth="max-w-xl"
        >
            <div className="space-y-4">
                
                {/* Área de Drag & Drop y Selección */}
                <div className="relative p-8 border-2 border-dashed border-blue-400 rounded-xl text-center bg-blue-50 hover:bg-blue-100 transition duration-150 cursor-pointer">
                    <PhotoIcon className="mx-auto h-12 w-12 text-blue-600" />
                    <p className="mt-4 text-sm font-semibold text-gray-800">
                        Haz clic para seleccionar o arrastra las imágenes
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                        Máximo recomendado: 4MB por archivo.
                    </p>
                    
                    <label className="absolute inset-0 cursor-pointer opacity-0">
                        <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*" 
                            multiple 
                            onChange={handleFileChange}
                        />
                    </label>
                </div>

                {/* Vista previa de los archivos seleccionados */}
                {filesSelected && (
                    <div className='p-4 border border-gray-200 rounded-md bg-white'>
                        <div className="flex justify-between items-center mb-2">
                             <p className='text-sm font-semibold text-gray-700'>Archivos listos ({previewFiles.length}):</p>
                             <button onClick={() => setPreviewFiles([])} className="text-xs text-red-500 hover:text-red-700 underline">Limpiar todo</button>
                        </div>
                       
                        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                            {previewFiles.map((file, index) => (
                                <div key={index} className="flex items-center justify-between space-x-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs w-full">
                                    <div className="flex items-center space-x-2 truncate">
                                        <DocumentIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                        <span className="truncate">{file.name}</span>
                                        <span className="text-gray-400">({(file.size / 1024).toFixed(0)} KB)</span>
                                    </div>
                                    <button 
                                        onClick={() => removePreviewFile(index)}
                                        className="text-gray-400 hover:text-red-500"
                                    >
                                        <XMarkIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Botón de Asignación */}
                <div className="pt-4 border-t border-gray-100">
                    <button
                        onClick={handleAssignImages}
                        disabled={!filesSelected}
                        className="w-full px-4 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Asignar {previewFiles.length} Imagen(es) a la Variante
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ImageUploadModal;