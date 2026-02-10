export interface SelectOption {
  value: string;
  label: string;
}

export const ZONAS_ENTREGA_MEXICO: SelectOption[] = [
  { value: 'aguascalientes', label: 'Aguascalientes' },
  { value: 'baja_california', label: 'Baja California' },
  { value: 'baja_california_sur', label: 'Baja California Sur' },
  { value: 'campeche', label: 'Campeche' },
  { value: 'chiapas', label: 'Chiapas' },
  { value: 'chihuahua', label: 'Chihuahua' },
  { value: 'coahuila', label: 'Coahuila' },
  { value: 'colima', label: 'Colima' },
  { value: 'cdmx', label: 'Ciudad de México (CDMX)' },
  { value: 'durango', label: 'Durango' },
  { value: 'guanajuato', label: 'Guanajuato' },
  { value: 'guerrero', label: 'Guerrero' },
  { value: 'hidalgo', label: 'Hidalgo' },
  { value: 'jalisco', label: 'Jalisco' },
  
  // --- Estado de México y Zonas Específicas ---
  { value: 'mexico', label: 'Estado de México' },
  { value: 'tlalmanalco', label: 'Tlalmanalco' },
  { value: 'san_rafael', label: 'San Rafael' },
  { value: 'miraflores', label: 'Miraflores' },
  { value: 'chalco', label: 'Chalco' },
  { value: 'ixtapaluca', label: 'Ixtapaluca' },
  { value: 'ameca', label: 'Ameca' },
  // ---------------------------------------------
  
  { value: 'michoacan', label: 'Michoacán' },
  { value: 'morelos', label: 'Morelos' },
  { value: 'nayarit', label: 'Nayarit' },
  { value: 'nuevo_leon', label: 'Nuevo León' },
  { value: 'oaxaca', label: 'Oaxaca' },
  { value: 'puebla', label: 'Puebla' },
  { value: 'queretaro', label: 'Querétaro' },
  { value: 'quintana_roo', label: 'Quintana Roo' },
  { value: 'san_luis_potosi', label: 'San Luis Potosí' },
  { value: 'sinaloa', label: 'Sinaloa' },
  { value: 'sonora', label: 'Sonora' },
  { value: 'tabasco', label: 'Tabasco' },
  { value: 'tamaulipas', label: 'Tamaulipas' },
  { value: 'tlaxcala', label: 'Tlaxcala' },
  { value: 'veracruz', label: 'Veracruz' },
  { value: 'yucatan', label: 'Yucatán' },
  { value: 'zacatecas', label: 'Zacatecas' },
];