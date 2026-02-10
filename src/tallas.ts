// tallas.ts

export interface TallaOption {
    value: string;
    label: string;
    type?: string; // Para identificar si es Calzado, Ropa, etc.
    children?: TallaOption[]; // Opcional: para agrupar rangos o tipos específicos
}

export const TALLAS_PRODUCTOS: TallaOption[] = [
    {
        value: 'ESTANDAR',
        label: 'Tallas Estándar (Letras)',
        type: 'Ropa',
        children: [
            { value: 'XXS', label: 'XXS' },
            { value: 'XS', label: 'XS' },
            { value: 'S', label: 'S' },
            { value: 'M', label: 'M' },
            { value: 'L', label: 'L' },
            { value: 'XL', label: 'XL' },
            { value: 'XXL', label: 'XXL' },
            { value: 'XXXL', label: 'XXXL' },
        ],
    },
    {
        value: 'NUMERICAS_US',
        label: 'Tallas Numéricas (Pares/Impares)',
        type: 'Ropa',
        children: [
            { value: '4', label: '4' },
            { value: '6', label: '6' },
            { value: '8', label: '8' },
            { value: '10', label: '10' },
            { value: '12', label: '12' },
            { value: '14', label: '14' },
            { value: '16', label: '16' },
            { value: '18', label: '18' },
            { value: '20', label: '20' },

            // Tallas Impares Comunes para Jeans/Pantalones
            { value: '5', label: '5' },
            { value: '7', label: '7' },
            { value: '9', label: '9' },
            { value: '11', label: '11' },
            { value: '13', label: '13' },
            { value: '15', label: '15' },
            { value: '17', label: '17' },
        ],
    },
    {
        value: 'NUMERICAS_EURO',
        label: 'Tallas Numéricas (Talla Pantalón/Falda)',
        type: 'Ropa',
        children: [
            { value: '28', label: '28' },
            { value: '30', label: '30' },
            { value: '32', label: '32' },
            { value: '34', label: '34' },
            { value: '36', label: '36' },
            { value: '38', label: '38' },
            { value: '40', label: '40' },
            { value: '42', label: '42' },
        ],
    },
    {
        value: 'CALZADO',
        label: 'Tallas de Calzado (MX)',
        type: 'Calzado',
        children: [
            { value: '22', label: '22 (2 MX)' },
            { value: '23', label: '23 (3 MX)' },
            { value: '24', label: '24 (4 MX)' },
            { value: '25', label: '25 (5 MX)' },
            { value: '26', label: '26 (6 MX)' },
            { value: '27', label: '27 (7 MX)' },
            { value: '28', label: '28 (8 MX)' },
            // Medios puntos si son necesarios
            { value: '23.5', label: '23.5' },
            { value: '24.5', label: '24.5' },
            { value: '25.5', label: '25.5' },
            { value: '26.5', label: '26.5' },
        ],
    },
    {
        value: 'INFANTIL',
        label: 'Tallas Infantiles y Juveniles',
        type: 'Ropa Infantil',
        children: [
            { value: '2T', label: '2T' },
            { value: '3T', label: '3T' },
            { value: '4A', label: '4A' },
            { value: '6A', label: '6A' },
            { value: '8A', label: '8A' },
            { value: 'INF_2-4', label: 'Infantil (2-4 años)' },
            { value: 'INF_6-8', label: 'Infantil (6-8 años)' },
            { value: 'INF_10-12', label: 'Infantil (10-12 años)' },
            { value: 'JUV_14-16', label: 'Juvenil (14-16 años)' },
            { value: 'INF_XS_3-5', label: 'Infantil/XS (3-5)' },
        ],
    },
    {
        value: 'RANGOS_COMBINADOS',
        label: 'Tallas de Rango / Combinadas',
        type: 'Ropa',
        children: [
            { value: 'UNITALLA', label: 'Unitalla' },
            { value: '28-30', label: '28-30' },
            { value: '30-32', label: '30-32' },
            { value: '30-34', label: '30-34' },
            { value: '32-34', label: '32-34' },
            { value: '32-36', label: '32-36' }, // 👈 Tu talla de ejemplo
            { value: '34-36', label: '34-36' },
            { value: '36-38', label: '36-38' },
            { value: '38-40', label: '38-40' },
            { value: '40-42', label: '40-42' },
            { value: '30-36', label: '30-36' },

        ],
    },
    {
        value: 'OTROS',
        label: 'Otras Tallas',
        type: 'Otro',
        children: [
            { value: 'TALLA_PERSONALIZADA', label: 'Talla Personalizada' },
            { value: 'SIN_TALLA', label: 'Sin Talla (Ejem: Accesorio)' },
        ],
    }
];