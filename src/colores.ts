/**
 * Lista de colores comunes para la selección visual en productos
 * Incluye 40+ colores con sus códigos hexadecimales
 */

export interface ColorOption {
  nombre: string;
  hex: string;
}

export const COLORES_COMUNES: readonly ColorOption[] = [
  // Blancos y Grises
  { nombre: 'Blanco', hex: '#FFFFFF' },
  { nombre: 'Gris Claro', hex: '#E8E8E8' },
  { nombre: 'Gris', hex: '#A9A9A9' },
  { nombre: 'Gris Oscuro', hex: '#444444' },
  { nombre: 'Negro', hex: '#000000' },
  
  // Rojos
  { nombre: 'Rojo Brillante', hex: '#FF0000' },
  { nombre: 'Rojo Oscuro', hex: '#8B0000' },
  { nombre: 'Rojo Vino', hex: '#722F37' },
  { nombre: 'Guinda', hex: '#7B1E3C' },
  { nombre: 'Rojo Coral', hex: '#FF7F50' },
  { nombre: 'Rosa', hex: '#FFC0CB' },
  { nombre: 'Rosa Fucsia', hex: '#FF1493' },
  { nombre: 'Palo de Rosa', hex: '#EABFB9' },
  
  // Azules
  { nombre: 'Azul Cielo', hex: '#87CEEB' },
  { nombre: 'Azul', hex: '#0000FF' },
  { nombre: 'Azul Marino', hex: '#000080' },
  { nombre: 'Azul Oscuro', hex: '#00008B' },
  { nombre: 'Azul Rey', hex: '#0033A0' },
  { nombre: 'Azul Petróleo', hex: '#013A63' },
  { nombre: 'Azul Eléctrico', hex: '#7F00FF' },
  { nombre: 'Turquesa', hex: '#40E0D0' },
  
  // Verdes
  { nombre: 'Verde Claro', hex: '#90EE90' },
  { nombre: 'Verde', hex: '#008000' },
  { nombre: 'Verde Oscuro', hex: '#006400' },
  { nombre: 'Verde Oliva', hex: '#556B2F' },
  { nombre: 'Verde Menta', hex: '#98FF98' },
  { nombre: 'Verdeazulado', hex: '#008080' },
  { nombre: 'Verde Lima', hex: '#32CD32' },
  { nombre: 'Verde Militar', hex: '#4B5320' },
  
  // Amarillos y Dorados
  { nombre: 'Amarillo', hex: '#FFFF00' },
  { nombre: 'Amarillo Oscuro', hex: '#DAA520' },
  { nombre: 'Mostaza', hex: '#D4A017' },
  { nombre: 'Oro', hex: '#FFD700' },
  { nombre: 'Naranja', hex: '#FFA500' },
  { nombre: 'Naranja Oscuro', hex: '#FF8C00' },
  
  // Púrpuras
  { nombre: 'Púrpura', hex: '#800080' },
  { nombre: 'Púrpura Claro', hex: '#DDA0DD' },
  { nombre: 'Violeta', hex: '#EE82EE' },
  { nombre: 'Índigo', hex: '#4B0082' },
  { nombre: 'Lila', hex: '#C8A2C8' },
  { nombre: 'Lavanda', hex: '#E6E6FA' },
  
  // Marrones
  { nombre: 'Marrón', hex: '#8B4513' },
  { nombre: 'Marrón Claro', hex: '#CD853F' },
  { nombre: 'Marrón Oscuro', hex: '#654321' },
  { nombre: 'Café', hex: '#6F4E37' },
  { nombre: 'Camel', hex: '#C19A6B' },
  { nombre: 'Shedron', hex: '#A0522D' },
  { nombre: 'Terracota', hex: '#E2725B' },
  { nombre: 'Caqui', hex: '#C3B091' },
  { nombre: 'Chocolate', hex: '#3E2723' },
  { nombre: 'Beige', hex: '#F5F5DC' },
  { nombre: 'Crema', hex: '#FFFDD0' },
  { nombre: 'Arena', hex: '#D9C3A1' },
  { nombre: 'Hueso', hex: '#E6DDC5' },
  { nombre: 'Perla', hex: '#E8E4E1' },
  { nombre: 'Nude', hex: '#E3BC9A' },
  
  // Colores adicionales populares
  { nombre: 'Plateado', hex: '#C0C0C0' },
  { nombre: 'Cobre', hex: '#B87333' },
  { nombre: 'Salmón', hex: '#FA8072' },
  { nombre: 'Durazno', hex: '#FFCBA4' },
  { nombre: 'Aqua', hex: '#00FFFF' },
  { nombre: 'Hueso Rosado', hex: '#F3E2D2' },
];

/**
 * Obtiene un color de la lista por su nombre
 */
export const getColorHex = (colorName: string): string => {
  const color = COLORES_COMUNES.find(c => c.nombre.toLowerCase() === colorName.toLowerCase());
  return color?.hex || '#CCCCCC';
};

/**
 * Obtiene el nombre de color más cercano al hex proporcionado
 * Útil para mostrar un nombre legible si el color vino de un picker
 */
export const getNearestColorName = (hex: string): string => {
  // Si es un color exacto, devolverlo
  const exactMatch = COLORES_COMUNES.find(c => c.hex.toLowerCase() === hex.toLowerCase());
  if (exactMatch) return exactMatch.nombre;
  
  // Si no, devolver un nombre genérico
  return 'Personalizado';
};
