// categorias.ts o categorias.js

export interface CategoriaOption {
    value: string;
    label: string;
    // Opcional: para jerarquía o agrupación avanzada (útil para la tienda en línea)
    children?: CategoriaOption[];
}

export const CATEGORIAS_PRODUCTOS: CategoriaOption[] = [
    {
        value: 'ROPASUPERIOR',
        label: 'Ropa Superior',
        children: [
            { value: 'BLUSAS', label: 'Blusas' },
            { value: 'PLAYERAS', label: 'Playeras / T-Shirts' },
            { value: 'POLOS', label: 'Camisas Polo' },
            { value: 'CAMISAS', label: 'Camisas (Formal/Casual)' },
            { value: 'TOPS_CORTOS', label: 'Tops / Cropped Tops' },
            { value: 'BRAS_BRALETTES', label: 'Bras / Bralettes' },
            { value: 'BLUSONES', label: 'Blusones' },
            { value: 'CHALECOS', label: 'Chalecos' },
        ],
    },
    {
        value: 'ROPAINFERIOR',
        label: 'Ropa Inferior',
        children: [
            { value: 'PANTALONES', label: 'Pantalones (Casual/Formal)' },
            { value: 'PANTS_JOGGERS', label: 'Pants / Joggers' },
            { value: 'SHORTS', label: 'Shorts' },
            { value: 'FALDAS', label: 'Faldas' },
            { value: 'LEGGINGS_MALLONES', label: 'Leggins / Mallones' },
        ],
    },
    {
        value: 'ROPAEXTERIOR',
        label: 'Ropa Exterior',
        children: [
            { value: 'ABRIGOS', label: 'Abrigos (Coats)' },
            { value: 'CHAMARRAS', label: 'Chamarras / Chaquetas (Jackets)' },
            { value: 'SUDADERAS', label: 'Sudaderas (Hoodies / Sweatshirts)' },
            { value: 'MAXI_SUDADERAS', label: 'Maxi Sudaderas' },
            { value: 'SACOS_BLAZERS', label: 'Sacos / Blazers' },
            { value: 'CAPAS_GABARDINAS', label: 'Capas / Gabardinas' },
            { value: 'ENSAMBLES', label: 'Ensambles / Cardigans' },
            { value: 'SUETERES', label: 'Suéteres (Sweaters)' },
        ],
    },
    {
        value: 'PRENDASCOMPLETAS',
        label: 'Prendas de una pieza',
        children: [
            { value: 'VESTIDOS', label: 'Vestidos' },
            { value: 'MAXI_VESTIDOS', label: 'Maxi Vestidos' },
            { value: 'OVEROLES', label: 'Overoles (Dungarees)' },
            { value: 'JUMPSUITS', label: 'Jumpsuits' }, // 👈 Tu categoría faltante
            { value: 'BODIES', label: 'Bodys / Bodysuits' }, // 👈 Tu categoría faltante
                        { value: 'PALAZZOS', label: 'Palazzos' },

        ],
    },
    {
        value: 'ROPAINTERIOR',
        label: '👙 Lencería y Ropa Interior',
        children: [
            { value: 'ROPA_INTERIOR', label: 'Ropa Interior' },
            { value: 'MEDIAS', label: 'Medias / Pantimedias' },
            { value: 'PIJAMAS', label: 'Pijamas' },
        ],
    },
    {
        value: 'DEPORTIVA',
        label: '🏃 Ropa Deportiva',
        children: [
            { value: 'PLAYERAS_DEPORTIVAS', label: 'Playeras Deportivas' },
            { value: 'CONJUNTOS_DEPORTIVOS', label: 'Conjuntos Deportivos' },
        ],
    },
    {
        value: 'CALZADO',
        label: '👟 Calzado', // 👈 Categoría Completa
        children: [
            { value: 'TENNIS', label: 'Tenis / Sneakers' },
            { value: 'BOTAS_BOTINES', label: 'Botas / Botines' },
            { value: 'SANDALIAS', label: 'Sandalias / Chanclas' },
            { value: 'TACONES', label: 'Zapatos de Tacón' },
            { value: 'PLATAFORMAS', label: 'Plataformas' },
            { value: 'CALZADO_OTRO', label: 'Otros Tipos de Calzado' },
        ],
    },
    {
        value: 'ACCESORIOS',
        label: '💍 Accesorios', // 👈 Categoría Completa
        children: [
            { value: 'BOLSOS_CARTERAS', label: 'Bolsos y Carteras' },
            { value: 'JOYERIA', label: 'Joyería (Collares, Aretes, Pulseras)' },
            { value: 'CINTURONES', label: 'Cinturones' },
            { value: 'SOMBREROS_GORROS', label: 'Sombreros y Gorros' },
            { value: 'GUANTES', label: 'Guantes' },
            { value: 'BUFANDAS', label: 'Bufandas y Pañuelos' },
            { value: 'ACCESORIOS_CABELLO', label: 'Accesorios para Cabello' },
            { value: 'MAXI_COBIJAS', label: 'Maxi Cobijas / Ponchos' }, // Agrupado aquí como accesorio de vestimenta
        ],
    },
    {
        value: 'INFANTIL',
        label: '👶 Ropa Infantil',
        children: [
            { value: 'NINIA', label: 'Infantil Niña' },
            { value: 'NINIO', label: 'Infantil Niño' },
            { value: 'UNISEX_INFANTIL', label: 'Niños Unisex' },
        ],
    },
    {
        value: 'ESPECIAL',
        label: '✨ Categorías Especiales',
        children: [
            { value: 'PATRIA', label: 'Patria' },
            { value: 'CONJUNTOS_COMPLETOS', label: 'Conjuntos (No deportivos)' },
            { value: 'OTROS', label: 'Otros' },
            { value: 'SIN_CATEGORIA', label: 'Sin Categoría' },
        ],
    },
];