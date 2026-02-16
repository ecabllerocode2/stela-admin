/**
 * Utilidad para Actualizar Perfiles de Cliente
 * Se ejecuta directamente en el frontend cuando se marca una orden como entregada
 */

import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../credenciales';
import { userQuery } from './multitenancy';

// ============================================
// CONFIGURACIÓN
// ============================================

const CONFIG = {
  PERIODO_ANALISIS_DIAS: 365,
  DIAS_CLIENTE_ACTIVO: 90,
  DIAS_CLIENTE_RIESGO: 180,
  MIN_PEDIDOS_ACTIVO: 2,
  TOP_CATEGORIAS: 5,
  TOP_COLORES: 5,
  TOP_PRENDAS: 10,
  TOP_TALLAS: 3,
};

// ============================================
// UTILIDADES
// ============================================

function diasDesde(fechaStr: string | null | undefined): number {
  if (!fechaStr) return 999;
  const fecha = new Date(fechaStr);
  const hoy = new Date();
  return Math.floor((hoy.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
}

function percentil(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function obtenerTop(arr: string[], n: number = 5): string[] {
  if (!arr.length) return [];
  
  const freq: { [key: string]: number } = {};
  arr.forEach(item => {
    if (item) freq[item] = (freq[item] || 0) + 1;
  });
  
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([item]) => item);
}

function calcularSatisfaccion(
  diasDesdeUltimaCompra: number,
  frecuenciaMensual: number,
  tasaCompletitud: number
): number {
  let score = 3.0;
  
  if (diasDesdeUltimaCompra <= 30) score += 1.0;
  else if (diasDesdeUltimaCompra <= 60) score += 0.5;
  else if (diasDesdeUltimaCompra <= 90) score += 0.2;
  else if (diasDesdeUltimaCompra > 180) score -= 1.0;
  
  if (frecuenciaMensual >= 2) score += 0.8;
  else if (frecuenciaMensual >= 1) score += 0.4;
  else if (frecuenciaMensual < 0.3) score -= 0.5;
  
  if (tasaCompletitud >= 0.9) score += 0.5;
  else if (tasaCompletitud < 0.7) score -= 0.5;
  
  return Math.max(1, Math.min(5, score));
}

function obtenerDescripcionFrecuencia(pedidosPorMes: number): string {
  if (pedidosPorMes >= 3) return 'muy_frecuente';
  if (pedidosPorMes >= 1.5) return 'frecuente';
  if (pedidosPorMes >= 0.5) return 'ocasional';
  if (pedidosPorMes > 0) return 'esporadico';
  return 'sin_compras';
}

function determinarEstiloCompra(
  variedadColores: number,
  variedadCategorias: number,
  totalPedidos: number
): string {
  if (totalPedidos < 2) return 'nuevo';
  const diversidad = (variedadColores + variedadCategorias) / (totalPedidos * 2);
  if (diversidad > 0.6) return 'exploratorio';
  if (diversidad > 0.3) return 'moderado';
  return 'conservador';
}

function normalizarNombre(nombre: string | undefined): string {
  if (!nombre) return '';
  return nombre
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================

export async function actualizarPerfilCliente(clienteNombre: string, userId: string): Promise<{
  success: boolean;
  clienteId?: string;
  mensaje: string;
  perfil?: any;
}> {
  console.log(`\n📊 [FRONTEND] Actualizando perfil de: ${clienteNombre}`);
  
  try {
    // 1. Buscar cliente
    const clientesAll = await getDocs(userQuery('clientes', userId));
    const matchingClientes = clientesAll.docs.filter(d => d.data().cliente === clienteNombre);
    
    if (matchingClientes.length === 0) {
      console.warn(`⚠️  Cliente no encontrado: ${clienteNombre}`);
      return { success: false, mensaje: `Cliente ${clienteNombre} no encontrado` };
    }
    
    const clienteDoc = matchingClientes[0];
    const clienteId = clienteDoc.id;
    console.log(`   🔑 Cliente ID: ${clienteId}`);
    
    // 2. Obtener SOLO órdenes entregadas
    const ordenesSnap = await getDocs(userQuery('ordenes', userId));
    
    const pedidos: any[] = [];
    
    ordenesSnap.forEach(doc => {
      const data = doc.data() as any;
      if (data.estadoPedido !== 'entregado') return;
      let nombreOrden = '';
      
      if (typeof data.cliente === 'string') {
        nombreOrden = data.cliente;
      } else if (data.cliente?.nombre) {
        nombreOrden = data.cliente.nombre;
      }
      
      // Comparación normalizada
      if (normalizarNombre(nombreOrden) === normalizarNombre(clienteNombre)) {
        const items = data.items || [];
        items.forEach((item: any) => {
          if (item.comprado !== false) {
            pedidos.push({
              fecha: data.fechaCreacion || data.fechaEntrega,
              categoria: item.categoria || 'Sin categoría',
              color: item.color || 'Sin color',
              talla: item.talla || 'Sin talla',
              prenda: item.nombre || 'Sin nombre',
              precio: item.precio || 0,
              entregado: true,
            });
          }
        });
      }
    });
    
    console.log(`   📦 Total items encontrados: ${pedidos.length}`);
    
    if (pedidos.length === 0) {
      console.log(`   ⚠️  Sin pedidos entregados`);
      return { success: true, clienteId, mensaje: 'Cliente sin pedidos entregados' };
    }
    
    // 3. Filtrar por período
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - CONFIG.PERIODO_ANALISIS_DIAS);
    
    const pedidosPeriodo = pedidos.filter(p => {
      if (!p.fecha) return false;
      const fechaPedido = new Date(p.fecha);
      return fechaPedido >= fechaLimite;
    });
    
    console.log(`   📊 Items en últimos ${CONFIG.PERIODO_ANALISIS_DIAS}d: ${pedidosPeriodo.length}`);
    
    // 4. Métricas básicas
    const fechasOrdenadas = pedidosPeriodo
      .map((p: any) => p.fecha)
      .filter(Boolean)
      .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime());
    
    const ultimaCompra = fechasOrdenadas[0] || null;
    const diasDesdeUltimaCompra = ultimaCompra ? diasDesde(ultimaCompra) : 999;
    const totalPedidos = pedidosPeriodo.length;
    const frecuenciaMensual = totalPedidos / 12;
    
    // 5. Métricas financieras
    const precios = pedidosPeriodo.map((p: any) => p.precio).filter((p: number) => p > 0);
    const gastoTotal = precios.reduce((sum: number, p: number) => sum + p, 0);
    const gastoPromedio = precios.length > 0 ? gastoTotal / precios.length : 0;
    const presupuestoMax = percentil(precios, 90);
    const presupuestoMin = percentil(precios, 10);
    const ticketMax = Math.max(...precios, 0);
    const ticketMin = precios.length > 0 ? Math.min(...precios) : 0;
    
    // 6. Preferencias
    const categorias = pedidosPeriodo.map((p: any) => p.categoria).filter(Boolean);
    const colores = pedidosPeriodo.map((p: any) => p.color).filter(Boolean);
    const tallas = pedidosPeriodo.map((p: any) => p.talla).filter(Boolean);
    const prendas = pedidosPeriodo.map((p: any) => p.prenda).filter(Boolean);
    
    const categoriasFavoritas = obtenerTop(categorias, CONFIG.TOP_CATEGORIAS);
    const coloresFavoritos = obtenerTop(colores, CONFIG.TOP_COLORES);
    const tallasMasUsadas = obtenerTop(tallas, CONFIG.TOP_TALLAS);
    const prendasMasCompradas = obtenerTop(prendas, CONFIG.TOP_PRENDAS);
    
    const variedadColores = new Set(colores).size;
    const variedadCategorias = new Set(categorias).size;
    
    // 7. Estilo y satisfacción
    const estiloCompra = determinarEstiloCompra(variedadColores, variedadCategorias, totalPedidos);
    const tasaCompletitud = pedidosPeriodo.length > 0 ? pedidosPeriodo.length / pedidos.length : 0;
    const satisfaccionPromedio = calcularSatisfaccion(diasDesdeUltimaCompra, frecuenciaMensual, tasaCompletitud);
    const ultimas3 = pedidosPeriodo.slice(0, 3);
    const satisfaccionUltimas3 = ultimas3.length > 0 
      ? calcularSatisfaccion(diasDesdeUltimaCompra, frecuenciaMensual, tasaCompletitud)
      : satisfaccionPromedio;
    
    // 8. Clasificación
    let tipoCliente = 'nuevo';
    let sinActividad = false;
    let colorMarketing = 'rojo';
    
    if (diasDesdeUltimaCompra <= 30 && totalPedidos >= 4 && satisfaccionPromedio >= 4 && presupuestoMax > 300) {
      tipoCliente = 'activo';
      colorMarketing = 'verde';
    } else if (diasDesdeUltimaCompra <= 90 && totalPedidos >= 2 && satisfaccionPromedio >= 3) {
      tipoCliente = 'activo';
      colorMarketing = 'azul';
    } else if (diasDesdeUltimaCompra <= 180 || (totalPedidos >= 1 && satisfaccionPromedio < 3)) {
      tipoCliente = 'activo';
      colorMarketing = 'amarillo';
    } else if (diasDesdeUltimaCompra > 180) {
      tipoCliente = 'inactivo';
      sinActividad = true;
      colorMarketing = 'rojo';
    } else if (totalPedidos >= 1) {
      tipoCliente = 'activo';
      colorMarketing = 'azul';
    }
    
    // 9. Ensamblar perfil
    const perfilRecomendacion = {
      tipo_cliente: tipoCliente,
      color_marketing: colorMarketing,
      total_pedidos_12m: totalPedidos,
      sin_actividad: sinActividad,
      ultima_compra: ultimaCompra,
      dias_desde_ultima_compra: diasDesdeUltimaCompra,
      periodo_analisis: '12_meses',
      frecuencia_compra: obtenerDescripcionFrecuencia(frecuenciaMensual),
      frecuencia_compra_mensual: Math.round(frecuenciaMensual * 100) / 100,
      gasto_total_12m: Math.round(gastoTotal),
      gasto_promedio_por_compra: Math.round(gastoPromedio),
      ticket_maximo: Math.round(ticketMax),
      ticket_minimo: Math.round(ticketMin),
      presupuesto_estimado_max: Math.round(presupuestoMax),
      rango_precio_min: Math.round(presupuestoMin),
      rango_precio_max: Math.round(presupuestoMax),
      satisfaccion_promedio: Math.round(satisfaccionPromedio * 10) / 10,
      satisfaccion_ultimas_3_compras: Math.round(satisfaccionUltimas3 * 10) / 10,
      categorias_favoritas: categoriasFavoritas,
      colores_favoritos: coloresFavoritos,
      prendas_mas_compradas: prendasMasCompradas,
      tallas_mas_usadas: tallasMasUsadas,
      estilo_compra: estiloCompra,
      variedad_colores: variedadColores,
      variedad_categorias: variedadCategorias,
      actualizado_en: new Date().toISOString(),
      pedidos_analizados: totalPedidos,
    };
    
    // 10. Actualizar Firestore
    await updateDoc(doc(db, 'clientes', clienteId), {
      tipo_cliente: tipoCliente,
      total_pedidos_12m: totalPedidos,
      sin_actividad: sinActividad,
      ultima_compra: ultimaCompra,
      dias_desde_ultima_compra: diasDesdeUltimaCompra,
      tallas_mas_usadas: tallasMasUsadas,
      variedad_colores: variedadColores,
      actualizado_en: new Date().toISOString(),
      perfil_recomendacion: perfilRecomendacion
    });
    
    console.log(`   ✅ ACTUALIZACIÓN COMPLETADA`);
    console.log(`      Tipo: ${tipoCliente.toUpperCase()} | Color: ${colorMarketing}`);
    console.log(`      Pedidos: ${totalPedidos} | Días: ${diasDesdeUltimaCompra} | Satisfacción: ${satisfaccionPromedio.toFixed(1)}/5`);
    console.log(`      Gasto: $${gastoPromedio.toFixed(0)}/compra | Total: $${gastoTotal.toFixed(0)}`);
    console.log(`      Categorías: ${categoriasFavoritas.join(', ')}`);
    console.log(`      Colores: ${coloresFavoritos.join(', ')}\n`);
    
    return {
      success: true,
      clienteId,
      mensaje: `✅ Perfil actualizado: ${tipoCliente} (${colorMarketing}) | ${totalPedidos} pedidos`,
      perfil: perfilRecomendacion
    };
    
  } catch (error) {
    console.error('❌ Error actualizando perfil:', error);
    return {
      success: false,
      mensaje: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
    };
  }
}
