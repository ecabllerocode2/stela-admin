/**
 * ============================================================
 * MOTOR DE RECOMENDACIONES v2 – STELA FASHION INTELLIGENCE
 * ============================================================
 *
 * Señales usadas (6 componentes, cada uno 0-1):
 *
 *  1. CATEGORÍA   (28%) – coincidencia posicional en lista de favoritas
 *                         + complementos de moda mexicana (blusa↔pantalón, etc.)
 *  2. PRECIO      (22%) – ajustado por descuento; curva triangular respecto
 *                         al gasto_promedio y presupuesto_max real
 *  3. COLOR       (15%) – posición en lista de colores favoritos
 *  4. TALLA       (13%) – disponibilidad de stock EN la talla preferida
 *  5. OPORTUNIDAD (15%) – señal temporal: días sin comprar + ciclo esperado
 *                         + categoría no explorada recientemente
 *  6. LEALTAD     (7%)  – engagement del cliente (color de marketing)
 *
 * Filtro duro: si el cliente tiene tallas registradas y ninguna está
 * disponible en este producto → el score se multiplica por 0.2
 * (producto prácticamente excluido, no comprable en su talla).
 *
 * Umbral de inclusión: ≥ 0.38
 *
 * Categorías complementarias del mercado de moda femenina en México:
 * Si la cliente compra mucho de A y el producto es B (complemento de A)
 * se asigna un bonus intermedio en lugar de cero.
 */

// ============================================
// TIPOS
// ============================================

export interface Cliente {
  id: string;
  cliente: string;
  perfil_recomendacion?: any;
  total_pedidos_12m: number;
  dias_desde_ultima_compra?: number;
  color_marketing?: string;
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
// CONFIGURACIÓN
// ============================================

/** Umbral mínimo para que una recomendación aparezca */
const UMBRAL_MINIMO = 0.38;

/** Máximo de recomendaciones a devolver por consulta */
const MAX_RESULTADOS = 30;

/** Pesos de cada señal (deben sumar 1.0) */
const W = {
  CATEGORIA:    0.28,
  PRECIO:       0.22,
  COLOR:        0.15,
  TALLA:        0.13,
  OPORTUNIDAD:  0.15,
  LEALTAD:      0.07,
};

/**
 * Categorías complementarias en moda femenina mexicana.
 * Si la clienta compra mucho de la clave, el valor (array) son
 * categorías complementarias que le interesarían.
 * Relación bidireccional – se aplica en ambas direcciones.
 */
const COMPLEMENTOS_MODA: Record<string, string[]> = {
  blusa:       ['pantalon', 'falda', 'shorts', 'jeans'],
  blusas:      ['pantalon', 'falda', 'shorts', 'jeans'],
  pantalon:    ['blusa', 'blusas', 'top', 'tops', 'camisa'],
  pantalones:  ['blusa', 'blusas', 'top', 'tops', 'camisa'],
  jeans:       ['blusa', 'blusas', 'top', 'tops'],
  falda:       ['blusa', 'blusas', 'top', 'tops'],
  faldas:      ['blusa', 'blusas', 'top', 'tops'],
  vestido:     ['bolsa', 'accesorios', 'calzado', 'sandalias'],
  vestidos:    ['bolsa', 'accesorios', 'calzado', 'sandalias'],
  top:         ['pantalon', 'pantalones', 'jeans', 'shorts', 'falda'],
  tops:        ['pantalon', 'pantalones', 'jeans', 'shorts', 'falda'],
  conjunto:    ['accesorios', 'bolsa', 'calzado'],
  conjuntos:   ['accesorios', 'bolsa', 'calzado'],
  shorts:      ['blusa', 'blusas', 'top', 'tops'],
  chamarra:    ['pantalon', 'jeans', 'blusa'],
  chamarras:   ['pantalon', 'jeans', 'blusa'],
  sudadera:    ['pantalon', 'jeans', 'shorts'],
  sudaderas:   ['pantalon', 'jeans', 'shorts'],
  calzado:     ['vestido', 'conjunto', 'pantalon'],
  sandalias:   ['vestido', 'falda', 'shorts'],
  bolsa:       ['vestido', 'conjunto', 'blusa'],
  bolsas:      ['vestido', 'conjunto', 'blusa'],
  accesorios:  ['vestido', 'conjunto', 'blusa'],
  camisa:      ['pantalon', 'jeans', 'falda'],
};

// ============================================
// UTILIDADES INTERNAS
// ============================================

function norm(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

/** Precio efectivo después de aplicar un descuento */
function precioEfectivo(publicPrice: number, offerPct: number = 0): number {
  return publicPrice * (1 - clamp(offerPct, 0, 100) / 100);
}

function coloresDelProducto(producto: Producto): string[] {
  return [...new Set(producto.variants.map(v => v.colorName))];
}

/** Tallas con stock disponible en el producto */
function tallasEnStock(producto: Producto): Set<string> {
  const s = new Set<string>();
  producto.variants.forEach(v => {
    v.sizes.forEach(sz => {
      if (sz.isInStock && sz.stock > 0) s.add(norm(sz.size));
    });
  });
  return s;
}

function imagenPrincipal(producto: Producto): string | undefined {
  return producto.variants[0]?.imageUrls?.[0];
}

/**
 * Ciclo esperado de recompra en días según frecuencia declarada en el perfil.
 * Refleja el ritmo típico de compra de moda femenina en México.
 */
function cicloEsperado(frecuencia: string): number {
  switch (frecuencia) {
    case 'muy_frecuente': return 15;
    case 'frecuente':     return 30;
    case 'ocasional':     return 60;
    case 'esporadico':    return 120;
    default:              return 90; // sin datos → valor medio
  }
}

// ============================================
// SEÑAL 1: CATEGORÍA  (0 – 1)
// ============================================

/**
 * Puntuación posicional: la #1 favorita vale 1.0, las siguientes
 * decaen suavemente.  Si el producto es "complemento" de una favorita
 * se le asigna 0.45 (oportunidad de venta cruzada).
 * Si el cliente no tiene historial aún → 0.35 (no penalizar a nuevos).
 */
function scoreCategoria(producto: Producto, perfil: any): number {
  const catProducto = norm(producto.category);
  const favs: string[] = (perfil?.categorias_favoritas || []).map(norm);

  if (favs.length === 0) return 0.35; // cliente nuevo sin historial

  const idx = favs.indexOf(catProducto);
  if (idx === 0) return 1.00;
  if (idx === 1) return 0.82;
  if (idx === 2) return 0.67;
  if (idx >= 3) return 0.50;

  // Verificar si es categoría complementaria de alguna favorita
  for (const fav of favs) {
    const complementos = COMPLEMENTOS_MODA[fav] || [];
    if (complementos.includes(catProducto)) return 0.45;
  }

  // Revisar a la inversa (el producto puede complementar una favorita)
  const compProducto = COMPLEMENTOS_MODA[catProducto] || [];
  for (const fav of favs) {
    if (compProducto.includes(fav)) return 0.42;
  }

  // Categoría totalmente fuera de preferencias → score bajo pero no cero
  // (cliente conservador que ocasionalmente explora)
  return 0.05;
}

// ============================================
// SEÑAL 2: PRECIO  (0 – 1)
// ============================================

/**
 * Curva triangular centrada en gasto_promedio_por_compra.
 * Se aplica al precio efectivo (con descuento si hay oferta).
 * Clientes sensibles al precio: artículos en oferta reciben boost adicional.
 */
function scorePrecio(producto: Producto, perfil: any): number {
  const precio = precioEfectivo(producto.publicPrice, producto.offerPercentage ?? 0);
  const ticketPromedio  = perfil?.gasto_promedio_por_compra || 0;
  const presupuestoMax  = perfil?.presupuesto_estimado_max || perfil?.rango_precio_max || 0;
  const presupuestoMin  = perfil?.rango_precio_min || 0;

  // Sin datos de precio del cliente → score neutro
  if (ticketPromedio === 0 && presupuestoMax === 0) return 0.50;

  const refMax = presupuestoMax > 0 ? presupuestoMax : ticketPromedio * 1.6;
  const refAvg = ticketPromedio > 0 ? ticketPromedio : refMax * 0.7;

  // Precio por encima del techo → penalización rápida
  if (precio > refMax * 1.6) return 0.00;
  if (precio > refMax * 1.3) return 0.15;
  if (precio > refMax * 1.1) return 0.40;

  // Zona óptima: alrededor del ticket promedio (±30%)
  const lowerOpt = refAvg * 0.70;
  const upperOpt = refAvg * 1.30;
  if (precio >= lowerOpt && precio <= upperOpt) return 1.00;

  // Entre óptimo y techo
  if (precio > upperOpt && precio <= refMax) {
    // Interpolación lineal: 1.0 en upperOpt → 0.55 en refMax
    const t = (precio - upperOpt) / (refMax - upperOpt);
    return clamp(1.0 - t * 0.45);
  }

  // Por debajo del mínimo histórico (puede parecer demasiado barato)
  if (precio < presupuestoMin && presupuestoMin > 0) return 0.55;

  // Precio bajo pero dentro del rango: buena señal
  if (precio < lowerOpt) return 0.75;

  return 0.50;
}

// ============================================
// SEÑAL 3: COLOR  (0 – 1)
// ============================================

/**
 * Puntuación posicional sobre lista de colores favoritos.
 * Igualmente suave para clientes sin historial.
 */
function scoreColor(producto: Producto, perfil: any): number {
  const coloresProd = coloresDelProducto(producto).map(norm);
  const favs: string[] = (perfil?.colores_favoritos || []).map(norm);

  if (favs.length === 0 || coloresProd.length === 0) return 0.40; // sin datos → neutro

  // Verificar posición del color favorito del cliente en los colores del producto
  for (let i = 0; i < favs.length; i++) {
    if (coloresProd.includes(favs[i])) {
      if (i === 0) return 1.00;
      if (i === 1) return 0.82;
      if (i === 2) return 0.68;
      return 0.55;
    }
  }

  // Ningún color favorito disponible → penalización moderada
  return 0.10;
}

// ============================================
// SEÑAL 4: TALLA  (0 – 1)
// ============================================

/**
 * Señal crítica en moda: si el producto no tiene la talla de la clienta
 * en stock no tiene sentido recomendarlo.  Adicionalmente se aplica un
 * filtro duro (multiplicador 0.2) fuera de este score.
 */
function scoreTalla(producto: Producto, perfil: any): { score: number; hayTalla: boolean } {
  const tallasStock = tallasEnStock(producto);
  const preferidas: string[] = (perfil?.tallas_mas_usadas || []).map(norm);

  if (preferidas.length === 0) {
    // Sin historial de talla → si hay stock en cualquier talla, score neutral
    return { score: tallasStock.size > 0 ? 0.50 : 0.20, hayTalla: tallasStock.size > 0 };
  }

  // Sin stock de ninguna talla en el producto
  if (tallasStock.size === 0) return { score: 0.00, hayTalla: false };

  // ¿La #1 talla está disponible con stock?
  if (tallasStock.has(preferidas[0])) return { score: 1.00, hayTalla: true };

  // ¿Alguna otra talla preferida disponible?
  for (let i = 1; i < preferidas.length; i++) {
    if (tallasStock.has(preferidas[i])) return { score: 0.65, hayTalla: true };
  }

  // El producto tiene stock pero no en las tallas de la clienta
  return { score: 0.00, hayTalla: false };
}

// ============================================
// SEÑAL 5: OPORTUNIDAD TEMPORAL  (0 – 1)
// ============================================

/**
 * Combina tres sub-señales:
 *  a) Recencia global: ¿cuánto tiempo lleva sin comprar vs. su ciclo normal?
 *  b) Madurez de reactivación: clientes inactivos que pasan del triple de su ciclo
 *     tienen oportunidad de reactivación (score alto para no perderlos).
 *  c) Category opportunity: si la categoría del producto es una de sus favoritas
 *     y lleva mucho tiempo sin comprar = urgencia alta.
 */
function scoreOportunidad(producto: Producto, perfil: any): number {
  const dias       = typeof perfil?.dias_desde_ultima_compra === 'number'
                    ? perfil.dias_desde_ultima_compra : 999;
  const frecuencia = perfil?.frecuencia_compra || 'ocasional';
  const ciclo      = cicloEsperado(frecuencia);
  const ratio      = dias / ciclo; // >1 = ya pasó su ciclo esperado

  // Sub-señal de recencia (0-1)
  let recencia: number;
  if (ratio < 0.5)  recencia = 0.20;  // Compró muy recientemente → baja urgencia
  else if (ratio < 0.8)  recencia = 0.40;
  else if (ratio < 1.0)  recencia = 0.65;
  else if (ratio < 1.5)  recencia = 0.85;  // Ya pasó su ciclo → momento ideal
  else if (ratio < 3.0)  recencia = 0.90;  // Claramente overdue
  else                   recencia = 0.70;  // Inactivo muy largo → reactivación

  // Sub-señal de categoría: si es una de sus top-2 favoritas, boost
  const catProducto = norm(producto.category);
  const favs: string[] = (perfil?.categorias_favoritas || []).map(norm);
  const categoryBonus = favs.indexOf(catProducto) <= 1 && favs.length > 0 ? 0.10 : 0.0;

  // Sub-señal de exploración: clientes exploratorios tienen más oportunidad
  // de descubrir algo nuevo, suaviza la penalización de categorías no favoritas
  const estilo = perfil?.estilo_compra || 'moderado';
  const exploradorBonus = estilo === 'exploratorio' ? 0.05 : 0.0;

  return clamp(recencia + categoryBonus + exploradorBonus);
}

// ============================================
// SEÑAL 6: LEALTAD / ENGAGEMENT  (0 – 1)
// ============================================

/**
 * El color de marketing refleja el valor y compromiso actual de la cliente.
 * Verde = top customer, Rojo = inactiva/nueva.
 */
function scoreLealtad(cliente: Cliente): number {
  const color =
    cliente.perfil_recomendacion?.color_marketing ||
    (cliente as any).color_marketing ||
    'rojo';

  switch (color) {
    case 'verde':    return 1.00; // Cliente VIP, activa y de alto valor
    case 'azul':     return 0.75; // Cliente buena, activa
    case 'amarillo': return 0.45; // Cliente en riesgo
    case 'rojo':     return 0.20; // Inactiva o nueva
    default:         return 0.40;
  }
}

// ============================================
// SCORE COMPUESTO
// ============================================

interface ScoreDetalle {
  score: number;
  sCategoria: number;
  sPrecio: number;
  sColor: number;
  sTalla: number;
  sOportunidad: number;
  sLealtad: number;
  tieneTallaDisponible: boolean;
  razonesFull: string[];
}

export function calcularScoreDetallado(
  producto: Producto,
  cliente: Cliente
): ScoreDetalle {
  const perfil = cliente.perfil_recomendacion;

  // Sin perfil: score mínimo no cero para clientes nuevos (sin datos previos)
  if (!perfil) {
    return {
      score: 0,
      sCategoria: 0, sPrecio: 0, sColor: 0,
      sTalla: 0, sOportunidad: 0, sLealtad: 0,
      tieneTallaDisponible: false,
      razonesFull: ['Sin perfil de cliente'],
    };
  }

  const sCategoria   = scoreCategoria(producto, perfil);
  const sPrecio      = scorePrecio(producto, perfil);
  const sColor       = scoreColor(producto, perfil);
  const { score: sTalla, hayTalla } = scoreTalla(producto, perfil);
  const sOportunidad = scoreOportunidad(producto, perfil);
  const sLealtad     = scoreLealtad(cliente);

  // Score base ponderado
  let score =
    sCategoria   * W.CATEGORIA +
    sPrecio      * W.PRECIO +
    sColor       * W.COLOR +
    sTalla       * W.TALLA +
    sOportunidad * W.OPORTUNIDAD +
    sLealtad     * W.LEALTAD;

  // Filtro duro: si tiene tallas registradas y ninguna disponible → penalizar fuerte
  const tienePreferenciasTalla = (perfil.tallas_mas_usadas || []).length > 0;
  if (tienePreferenciasTalla && !hayTalla) {
    score *= 0.20; // Producto prácticamente no recomendable
  }

  // Boost de oferta: si hay descuento y el cliente es sensible al precio
  if ((producto.offerPercentage ?? 0) > 0) {
    const esClienteEconomico =
      (perfil.gasto_promedio_por_compra || 0) < (perfil.presupuesto_estimado_max || 9999) * 0.7;
    if (esClienteEconomico) score = clamp(score + 0.04);
  }

  // Generar razones legibles para el equipo de ventas
  const razonesFull = generarRazones(
    producto, cliente, perfil,
    sCategoria, sPrecio, sColor, sTalla, sOportunidad, hayTalla
  );

  return {
    score: clamp(score),
    sCategoria, sPrecio, sColor, sTalla, sOportunidad, sLealtad,
    tieneTallaDisponible: hayTalla,
    razonesFull,
  };
}

/** Alias público para compatibilidad con código existente */
export function calcularScoreProductoParaCliente(
  producto: Producto,
  cliente: Cliente
): number {
  return calcularScoreDetallado(producto, cliente).score;
}

// ============================================
// GENERACIÓN DE RAZONES (legibles para ventas)
// ============================================

function generarRazones(
  producto: Producto,
  _cliente: Cliente,
  perfil: any,
  sCat: number,
  sPrec: number,
  sCol: number,
  _sTal: number,
  sOp: number,
  hayTalla: boolean
): string[] {
  const razones: string[] = [];
  const favCats: string[]   = perfil?.categorias_favoritas || [];
  const favColors: string[] = perfil?.colores_favoritos || [];
  const tallasPref: string[] = perfil?.tallas_mas_usadas || [];
  const dias = perfil?.dias_desde_ultima_compra ?? 999;
  const promedio = perfil?.gasto_promedio_por_compra ?? 0;
  const ciclo = cicloEsperado(perfil?.frecuencia_compra || 'ocasional');

  // Razón de categoría
  if (sCat >= 0.90) {
    razones.push(`Su categoría más comprada es "${favCats[0] || producto.category}"`);
  } else if (sCat >= 0.60) {
    razones.push(`"${producto.category}" está entre sus categorías favoritas`);
  } else if (sCat >= 0.38) {
    razones.push(`"${producto.category}" complementa lo que suele comprar`);
  }

  // Razón de precio
  const precio = precioEfectivo(producto.publicPrice, producto.offerPercentage ?? 0);
  if (sPrec >= 0.90) {
    razones.push(`Precio $${precio.toFixed(0)} ideal para su ticket promedio ($${promedio})`);
  } else if (sPrec >= 0.55) {
    razones.push(`Precio $${precio.toFixed(0)} dentro de su rango habitual`);
  } else if ((producto.offerPercentage ?? 0) > 0) {
    razones.push(`Con ${producto.offerPercentage}% dto. queda en $${precio.toFixed(0)}`);
  }

  // Razón de color
  const colProd = coloresDelProducto(producto);
  if (sCol >= 0.90 && favColors[0]) {
    razones.push(`Tiene "${favColors[0]}", su color #1 preferido`);
  } else if (sCol >= 0.55) {
    const coinc = colProd.find(c => favColors.map(norm).includes(norm(c)));
    if (coinc) razones.push(`Trae "${coinc}", color que ha comprado antes`);
  }

  // Razón de talla
  if (hayTalla && tallasPref[0]) {
    razones.push(`Disponible en talla ${tallasPref[0]} (su talla habitual)`);
  } else if (!hayTalla && tallasPref.length > 0) {
    razones.push(`⚠ Sin stock en talla ${tallasPref[0]}`);
  }

  // Razón de oportunidad temporal
  if (sOp >= 0.80) {
    if (dias >= ciclo * 3) {
      razones.push(`Lleva ${dias} días sin comprar – momento ideal para reactivar`);
    } else {
      razones.push(`Han pasado ${dias} días, ya superó su ciclo habitual de compra`);
    }
  } else if (sOp >= 0.60) {
    razones.push(`Próxima a su ciclo habitual de compra (~${ciclo} días)`);
  }

  // Si no hay razones, mensaje genérico pero útil
  if (razones.length === 0) {
    razones.push(`Coincide moderadamente con su perfil de compra`);
  }

  return razones;
}

// ============================================
// FUNCIÓN: OBTENER RECOMENDACIONES POR PRODUCTO
// ============================================

export function obtenerClientesParaProducto(
  producto: Producto,
  clientes: Cliente[]
): RecomendacionCliente[] {
  const resultados: Array<RecomendacionCliente & { _score: number }> = [];

  for (const cliente of clientes) {
    const det = calcularScoreDetallado(producto, cliente);
    if (det.score < UMBRAL_MINIMO) continue;

    const perfil = cliente.perfil_recomendacion;
    const coloresProd = coloresDelProducto(producto);
    const tallasPref: string[] = perfil?.tallas_mas_usadas || [];
    const tallaStock  = tallasEnStock(producto);

    // Color a recomendar: primer favorito disponible, o cualquier color del producto
    const colorRec =
      (perfil?.colores_favoritos || []).find((c: string) => coloresProd.map(norm).includes(norm(c))) ||
      coloresProd[0] || 'N/A';

    // Talla a recomendar: primera preferida con stock
    const tallaRec =
      tallasPref.find((t: string) => tallaStock.has(norm(t))) ||
      (tallaStock.size > 0 ? [...tallaStock][0] : 'N/A');

    const prob: 'alta' | 'media' | 'baja' =
      det.score >= 0.72 ? 'alta' : det.score >= 0.52 ? 'media' : 'baja';

    resultados.push({
      _score: det.score,
      clienteId:          cliente.id,
      clienteName:        cliente.cliente,
      score:              det.score,
      razon:              det.razonesFull,
      probabilidadCompra: prob,
      presupuestoEstimado: perfil?.presupuesto_estimado_max || perfil?.rango_precio_max || 1000,
      colorPreferido:     colorRec,
      tallaPreferida:     tallaRec,
    });
  }

  return resultados
    .sort((a, b) => b._score - a._score)
    .slice(0, MAX_RESULTADOS)
    .map(({ _score: _s, ...rest }) => rest) as RecomendacionCliente[];
}

// ============================================
// FUNCIÓN: OBTENER RECOMENDACIONES POR CLIENTE
// ============================================

export function obtenerProductosParaCliente(
  cliente: Cliente,
  productos: Producto[]
): RecomendacionProducto[] {
  const resultados: Array<RecomendacionProducto & { _score: number }> = [];

  for (const producto of productos) {
    const det = calcularScoreDetallado(producto, cliente);
    if (det.score < UMBRAL_MINIMO) continue;

    const perfil = cliente.perfil_recomendacion;
    const coloresProd = coloresDelProducto(producto);
    const tallaStock  = tallasEnStock(producto);
    const tallasPref: string[] = perfil?.tallas_mas_usadas || [];

    // Colores a recomendar (favoritos disponibles primero)
    const coloresRec = [
      ...(perfil?.colores_favoritos || []).filter((c: string) =>
        coloresProd.map(norm).includes(norm(c))
      ),
      ...coloresProd.filter(c =>
        !(perfil?.colores_favoritos || []).map(norm).includes(norm(c))
      ),
    ].slice(0, 3);

    // Tallas a recomendar (preferidas con stock primero)
    const tallasRec = [
      ...tallasPref.filter((t: string) => tallaStock.has(norm(t))),
      ...[...tallaStock].filter(t => !tallasPref.map(norm).includes(t)),
    ].slice(0, 3);

    const precio = precioEfectivo(producto.publicPrice, producto.offerPercentage ?? 0);

    resultados.push({
      _score:              det.score,
      productId:           producto.id,
      productName:         producto.name,
      category:            producto.category,
      price:               Math.round(precio),
      score:               det.score,
      razon:               det.razonesFull,
      coloresRecomendados: coloresRec.length > 0 ? coloresRec : coloresProd.slice(0, 3),
      tallasRecomendadas:  tallasRec.length > 0 ? tallasRec : [...tallaStock].slice(0, 3),
      imageUrl:            imagenPrincipal(producto),
    });
  }

  return resultados
    .sort((a, b) => b._score - a._score)
    .slice(0, MAX_RESULTADOS)
    .map(({ _score: _s, ...rest }) => rest) as RecomendacionProducto[];
}

// ============================================
// UTILIDAD PÚBLICA DE DEBUG / ANÁLISIS
// ============================================

export function getScoreDetalles(
  producto: Producto,
  cliente: Cliente
): {
  score: number;
  detalles: string[];
  recomendacion: 'alta' | 'media' | 'baja' | 'no';
} {
  const det = calcularScoreDetallado(producto, cliente);
  const recomendacion =
    det.score >= 0.72 ? 'alta' :
    det.score >= 0.52 ? 'media' :
    det.score >= UMBRAL_MINIMO ? 'baja' : 'no';

  const detalles = [
    `Categoría: ${(det.sCategoria * 100).toFixed(0)}%  (×${W.CATEGORIA})`,
    `Precio:    ${(det.sPrecio    * 100).toFixed(0)}%  (×${W.PRECIO})`,
    `Color:     ${(det.sColor     * 100).toFixed(0)}%  (×${W.COLOR})`,
    `Talla:     ${(det.sTalla     * 100).toFixed(0)}%  (×${W.TALLA})`,
    `Oportun.:  ${(det.sOportunidad * 100).toFixed(0)}%  (×${W.OPORTUNIDAD})`,
    `Lealtad:   ${(det.sLealtad   * 100).toFixed(0)}%  (×${W.LEALTAD})`,
    `Talla disp.: ${det.tieneTallaDisponible ? 'Sí' : 'No'}`,
    ...det.razonesFull,
  ];

  return { score: det.score, detalles, recomendacion };
}
