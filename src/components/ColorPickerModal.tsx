// src/components/ColorPickerModal.tsx

import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { SketchPicker, type ColorResult } from 'react-color'; // Importamos SketchPicker

// --- COMPONENTE BASE MODAL (REUTILIZABLE) ---
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    maxWidth?: string;
}

// Nota: Debes asegurarte de que este componente Modal sea el mismo en ambos archivos o importarlo de una fuente única.
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-sm' }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
            <div className={`bg-white rounded-lg shadow-xl w-full ${maxWidth} mx-auto transform transition-all`}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition"
                    >
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>
                {/* Content */}
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};
// --- FIN COMPONENTE BASE MODAL ---


// --- COMPONENTE DE SELECTOR DE COLOR ---
interface ColorPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentColor: string; 
    onColorSelect: (newHex: string) => void; 
}

const ColorPickerModal: React.FC<ColorPickerModalProps> = ({ isOpen, onClose, currentColor, onColorSelect }) => {
    
    // Estado para manejar el color en la rueda (usa el color inicial)
    const [selectedColor, setSelectedColor] = useState(currentColor);

    // Si el modal se abre con un color diferente, actualizamos el estado local
    React.useEffect(() => {
        setSelectedColor(currentColor);
    }, [currentColor]);

    // Handler de cambio para SketchPicker
    const handleColorChange = (color: ColorResult) => {
        setSelectedColor(color.hex.toUpperCase());
    };
    
    // Handler de cambio para el input de texto
    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedColor(e.target.value.toUpperCase());
    }

    const handleSave = () => {
        onColorSelect(selectedColor);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Seleccionar Color Hexadecimal" maxWidth='max-w-xs'>
            <div className="flex flex-col items-center space-y-4">
                
                {/* SketchPicker (La Rueda de color moderna) */}
                <SketchPicker
                    color={selectedColor}
                    onChange={handleColorChange}
                    width="100%" // Para que ocupe todo el ancho del modal
                    className="!shadow-none" // Para evitar doble sombra si Tailwind la agrega
                />
                
                {/* Input de texto para el código HEX */}
                <div className='w-full pt-4 border-t border-gray-100'>
                    <label className="block text-sm font-medium text-gray-700">Código HEX</label>
                    <input
                        type="text"
                        value={selectedColor.toUpperCase()}
                        onChange={handleTextChange}
                        placeholder="#000000"
                        maxLength={7}
                        className="w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2.5 text-base font-mono text-center" 
                    />
                </div>

                <button
                    onClick={handleSave}
                    className="w-full px-4 py-2 text-base font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition mt-2"
                >
                    Confirmar Color ({selectedColor.toUpperCase()})
                </button>
            </div>
        </Modal>
    );
};

export default ColorPickerModal;