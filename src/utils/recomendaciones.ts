// Tipos definidos localmente para evitar dependencias circulares

export interface Cliente {
  id: string;
  cliente: string;
  perfil_recomendacion?: any;
  total_pedidos_12m: number;
  ultima_compra?: string;
}

export interface Producto {
  id: string;
  name: string;
  category: string;
  publicPrice: number;
  cost: number;
  variants: {
    colorName: string;
    hexColor: string;
    imageUrls: string[];
    sizes: {
      size: string;
      stock: number;
      isInStock: boolean;
    }[];
  }[];
  shortDetails?: string;
  offerPercentage?: number;
}

export interface RecomendacionProducto {
  productId: string;
  productName: string;
  category: string;
  price: number;
  score: number;
  razon: string[];
  coloresRecomendados: string[];
  tallasRecomendadas: string[];
  imageUrl?: string;
}

export interface RecomendacionCliente {
  clienteId: string;
  clienteName: string;
  score: number;
  razon: string[];
  probabilidadCompra: 'alta' | 'media' | 'baja';
  presupuestoEstimado: number;
  colorPreferido: string;
  tallaPreferida: string;
}

// ============================================
// CONFIGURACIÓN DE PESOS
// ============================================

const PESOS = {
  // Categoría: si coincide exactamente
  CATEGORIA_EXACTA: 0.30,
  CATEGORIA_SIMILAR: 0.15,
  
  // Color: si coincide con favoritos
  COLOR_FAVORITO: 0.25,
  COLOR_NO_FAVORITO: -0.10,
  
  // Talla: si está en el rango de tallas del cliente
  TALLA_FAVORITA: 0.15,
  TALLA_DISPONIBLE: 0.05,
  
  // Precio: si está dentro del presupuesto
  PRECIO_PERFECTO: 0.20,      // Precio dentro de rango estimado
  PRECIO_ACCESIBLE: 0.10,      // Por debajo del presupuesto
  PRECIO_FUERA_PRESUPUESTO: -0.25, // Por encima del presupuesto
  
  // Estado del cliente
  CLIENTE_ACTIVO_RECIENTE: 0.15,
  CLIENTE_ACTIVO_MEDIO: 0.08,
  CLIENTE_EN_RIESGO: -0.05,
  CLIENTE_INACTIVO: -0.20,
  
  // Satisfacción: clientes satisfechos compran más
  SATISFACCION_ALTA: 0.12,
  SATISFACCION_MEDIA: 0.05,
  SATISFACCION_BAJA: -0.10,
  
  // Estilo de compra: exploradores vs conservadores
  ESTILO_EXPLORATORIO: 0.10,
  ESTILO_MODERADO: 0.05,
  ESTILO_CONSERVADOR: 0.02,
};

const UMBRAL_MINIMO = 0.35; // Puntuación mínima para mostrar recomendación

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function normalizarNombre(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function obtenerColoresDelProducto(producto: Producto): string[] {
  return [...new Set(producto.variants.map(v => v.colorName))];
}

function obtenerTallasDelProducto(producto: Producto): string[] {
  const tallas = new Set<string>();
  producto.variants.forEach(variant => {
    variant.sizes.forEach(size => {
      if (size.isInStock) {
        tallas.add(size.size);
      }
    });
  });
  return Array.from(tallas);
}

function obtenerImagenPrincipal(producto: Producto): string | undefined {
  const primeraVariante = producto.variants[0];
  if (primeraVariante?.imageUrls?.[0]) {
    return primeraVariante.imageUrls[0];
  }
  return undefined;
}

function calcularDiasDesdeUltimaCompra(cliente: Cliente): number {
  const perfil = cliente.perfil_recomendacion;
  if (typeof perfil?.dias_desde_ultima_compra === 'number') {
    return perfil.dias_desde_ultima_compra;
  }
  if (cliente.ultima_compra) {
    const fecha = new Date(cliente.ultima_compra);
    return Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));
  }
  return 999;
}

// ============================================
// ALGORITMO PRINCIPAL: PRODUCTO → CLIENTES
// ============================================

export function calcularScoreProductoParaCliente(
  producto: Producto,
  cliente: Cliente
): number {
  const perfil = cliente.perfil_recomendacion;
  if (!perfil) return 0; // Sin perfil = sin recomendación

  let score = 0;
  const razonesDebug: string[] = [];

  // 1️⃣ CATEGORÍA (peso: 30%)
  const categoriaProducto = normalizarNombre(producto.category);
  const categoriasFavoritas = (perfil.categorias_favoritas || [])
    .map((c: string) => normalizarNombre(c));

  if (categoriasFavoritas.includes(categoriaProducto)) {
    score += PESOS.CATEGORIA_EXACTA;
    razonesDebug.push('✓ Categoría favorita');
  } else if (categoriasFavoritas.length > 0) {
    // Podría ser similar, pero no exacta
    score += PESOS.CATEGORIA_SIMILAR;
    razonesDebug.push('○ Categoría relacionada');
  }

  // 2️⃣ COLOR (peso: 25%)
  const coloresProducto = obtenerColoresDelProducto(producto);
  const coloresFavoritos = (perfil.colores_favoritos || [])
    .map((c: string) => normalizarNombre(c));

  const hayColorFavorito = coloresProducto.some(cp =>
    coloresFavoritos.includes(normalizarNombre(cp))
  );

  if (hayColorFavorito) {
    score += PESOS.COLOR_FAVORITO;
    razonesDebug.push('✓ Color favorito disponible');
  } else if (coloresProducto.length > 0) {
    score += PESOS.COLOR_NO_FAVORITO;
    razonesDebug.push('⚠ Color no es favorito');
  }

  // 3️⃣ TALLA (peso: 15%)
  const tallasProducto = obtenerTallasDelProducto(producto);
  const tallasFavoritas = (perfil.tallas_mas_usadas || [])
    .map((t: string) => normalizarNombre(t));

  const hayTallaFavorita = tallasProducto.some(tp =>
    tallasFavoritas.includes(normalizarNombre(tp))
  );

  if (hayTallaFavorita) {
    score += PESOS.TALLA_FAVORITA;
    razonesDebug.push('✓ Talla disponible');
  } else if (tallasProducto.length > 0) {
    score += PESOS.TALLA_DISPONIBLE;
    razonesDebug.push('○ Talla disponible');
  }

  // 4️⃣ PRECIO (peso: 20%)
  const presupuestoMin = perfil.rango_precio_min || 0;
  const presupuestoMax = perfil.rango_precio_max || 5000;
  const precioPerfecto = (perfil.presupuesto_estimado_max || presupuestoMax) * 0.8;

  if (producto.publicPrice >= presupuestoMin && producto.publicPrice <= presupuestoMax) {
    if (producto.publicPrice <= precioPerfecto) {
      score += PESOS.PRECIO_PERFECTO;
      razonesDebug.push('✓ Precio perfecto');
    } else {
      score += PESOS.PRECIO_ACCESIBLE;
      razonesDebug.push('✓ Precio accesible');
    }
  } else if (producto.publicPrice < presupuestoMin) {
    score += PESOS.PRECIO_ACCESIBLE;
    razonesDebug.push('✓ Debajo del presupuesto');
  } else {
    score += PESOS.PRECIO_FUERA_PRESUPUESTO;
    razonesDebug.push('✗ Fuera de presupuesto');
  }

  // 5️⃣ ESTADO DEL CLIENTE (peso: 15%)
  const diasSinCompra = calcularDiasDesdeUltimaCompra(cliente);

  if (diasSinCompra <= 30) {
    score += PESOS.CLIENTE_ACTIVO_RECIENTE;
    razonesDebug.push('✓ Cliente activo (últimos 30d)');
  } else if (diasSinCompra <= 90) {
    score += PESOS.CLIENTE_ACTIVO_MEDIO;
    razonesDebug.push('✓ Cliente activo (últimos 90d)');
  } else if (diasSinCompra <= 180) {
    score += PESOS.CLIENTE_EN_RIESGO;
    razonesDebug.push('⚠ Cliente en riesgo');
  } else {
    score += PESOS.CLIENTE_INACTIVO;
    razonesDebug.push('✗ Cliente inactivo');
  }

  // 6️⃣ SATISFACCIÓN (peso: 12%)
  const satisfaccion = perfil.satisfaccion_promedio || 3;

  if (satisfaccion >= 4.0) {
    score += PESOS.SATISFACCION_ALTA;
    razonesDebug.push('✓ Alta satisfacción');
  } else if (satisfaccion >= 3.0) {
    score += PESOS.SATISFACCION_MEDIA;
    razonesDebug.push('○ Satisfacción media');
  } else {
    score += PESOS.SATISFACCION_BAJA;
    razonesDebug.push('✗ Baja satisfacción');
  }

  // 7️⃣ ESTILO DE COMPRA (peso: 10%)
  const estilo = perfil.estilo_compra || 'moderado';

  if (estilo === 'exploratorio') {
    score += PESOS.ESTILO_EXPLORATORIO;
    razonesDebug.push('✓ Cliente explorador');
  } else if (estilo === 'moderado') {
    score += PESOS.ESTILO_MODERADO;
    razonesDebug.push('○ Cliente moderado');
  } else if (estilo === 'conservador') {
    score += PESOS.ESTILO_CONSERVADOR;
    razonesDebug.push('○ Cliente conservador');
  }

  return Math.max(0, Math.min(1, score));
}

// ============================================
// FUNCIÓN: OBTENER RECOMENDACIONES POR PRODUCTO
// ============================================

export function obtenerClientesParaProducto(
  producto: Producto,
  clientes: Cliente[]
): RecomendacionCliente[] {
  const recomendaciones: (RecomendacionCliente & { score: number })[] = [];

  for (const cliente of clientes) {
    const score = calcularScoreProductoParaCliente(producto, cliente);

    if (score >= UMBRAL_MINIMO) {
      const perfil = cliente.perfil_recomendacion;
      const coloresProducto = obtenerColoresDelProducto(producto);
      const tallasProducto = obtenerTallasDelProducto(producto);

      // Determinar colores recomendados
      const coloresRecomendados = coloresProducto.filter(cp =>
        (perfil?.colores_favoritos || []).some((cf: string) =>
          normalizarNombre(cf) === normalizarNombre(cp)
        )
      );

      // Determinar tallas recomendadas
      const tallasRecomendadas = tallasProducto.filter(tp =>
        (perfil?.tallas_favoritas || []).some((tf: string) =>
          normalizarNombre(tf) === normalizarNombre(tp)
        )
      );

      recomendaciones.push({
        clienteId: cliente.id,
        clienteName: cliente.cliente,
        score,
        razon: [
          'Coincide con perfil',
          `Color: ${coloresRecomendados[0] || 'varios'}`,
          `Precio: $${producto.publicPrice}`,
        ],
        probabilidadCompra:
          score >= 0.75 ? 'alta' : score >= 0.50 ? 'media' : 'baja',
        presupuestoEstimado: perfil?.presupuesto_estimado_max || 1000,
        colorPreferido: coloresRecomendados[0] || coloresProducto[0] || 'N/A',
        tallaPreferida: tallasRecomendadas[0] || tallasProducto[0] || 'N/A',
      });
    }
  }

  // Ordenar por score descendente
  return recomendaciones.sort((a, b) => b.score - a.score);
}

// ============================================
// FUNCIÓN: OBTENER RECOMENDACIONES POR CLIENTE
// ============================================

export function obtenerProductosParaCliente(
  cliente: Cliente,
  productos: Producto[]
): RecomendacionProducto[] {
  const recomendaciones: (RecomendacionProducto & { score: number })[] = [];

  for (const producto of productos) {
    const score = calcularScoreProductoParaCliente(producto, cliente);

    if (score >= UMBRAL_MINIMO) {
      const coloresProducto = obtenerColoresDelProducto(producto);
      const tallasProducto = obtenerTallasDelProducto(producto);
      const perfil = cliente.perfil_recomendacion;

      // Colores que coinciden con favoritos
      const coloresRecomendados = coloresProducto.filter(cp =>
        (perfil?.colores_favoritos || []).some((cf: string) =>
          normalizarNombre(cf) === normalizarNombre(cp)
        )
      );

      // Tallas que coinciden con favoritas
      const tallasRecomendadas = tallasProducto.filter(tp =>
        (perfil?.tallas_favoritas || []).some((tf: string) =>
          normalizarNombre(tf) === normalizarNombre(tp)
        )
      );

      recomendaciones.push({
        productId: producto.id,
        productName: producto.name,
        category: producto.category,
        price: producto.publicPrice,
        score,
        razon: [
          `Categoría: ${producto.category}`,
          `Color: ${coloresRecomendados[0] || coloresProducto[0] || 'varios'}`,
          `Precio: $${producto.publicPrice}`,
        ],
        coloresRecomendados:
          coloresRecomendados.length > 0 ? coloresRecomendados : coloresProducto.slice(0, 3),
        tallasRecomendadas:
          tallasRecomendadas.length > 0 ? tallasRecomendadas : tallasProducto.slice(0, 3),
        imageUrl: obtenerImagenPrincipal(producto),
      });
    }
  }

  // Ordenar por score descendente
  return recomendaciones.sort((a, b) => b.score - a.score);
}

// ============================================
// UTILIDADES PARA DEBUGGING/ANÁLISIS
// ============================================

export function getScoreDetalles(
  producto: Producto,
  cliente: Cliente
): {
  score: number;
  detalles: string[];
  recomendacion: 'alta' | 'media' | 'baja' | 'no';
} {
  const score = calcularScoreProductoParaCliente(producto, cliente);
  const recomendacion =
    score >= 0.75 ? 'alta' : score >= 0.50 ? 'media' : score >= UMBRAL_MINIMO ? 'baja' : 'no';

  return {
    score,
    detalles: [],
    recomendacion,
  };
}
