/**
 * Utilidades para manejar zonas de entrega
 * Este archivo centraliza la lógica de zonas personales vs paquetería
 */

// Zonas con entrega personal
export const ZONAS_PERSONALES = [
  'tlalmanalco', 
  'san_rafael', 
  'ameca', 
  'chalco', 
  'ixtapaluca', 
  'cdmx'
];

/**
 * Determina si una zona tiene entrega personal
 * @param lugar - Nombre de la zona/lugar
 * @returns true si es entrega personal, false si es paquetería
 */
export const esEntregaPersonal = (lugar?: string): boolean => {
  if (!lugar) return false;
  return ZONAS_PERSONALES.includes(lugar.toLowerCase());
};
