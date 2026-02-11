#!/usr/bin/env node

/**
 * Script de Generación de Perfiles de Cliente
 * ============================================
 * 
 * Este script analiza el historial de pedidos de cada cliente y genera/actualiza
 * su perfil de recomendación con métricas de negocio y comportamiento de compra.
 * 
 * Características:
 * - Análisis de frecuencia y recencia de compras
 * - Cálculo de preferencias (categorías, colores, tallas, prendas)
 * - Métricas de satisfacción y presupuesto
 * - Clasificación de cliente (activo/inactivo/nuevo)
 * - Detección de patrones de consumo
 * 
 * Uso:
 *   node scripts/generar-perfiles-clientes.js
 * 
 * Requisitos:
 *   - Node.js v16+
 *   - Firebase Admin SDK configurado
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Intentar inicializar Firebase Admin de múltiples formas
let serviceAccount;

// Opción 1: Variable de entorno GOOGLE_APPLICATION_CREDENTIALS
const googleCredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (googleCredPath && fs.existsSync(googleCredPath)) {
  console.log('✅ Usando credenciales de GOOGLE_APPLICATION_CREDENTIALS');
  serviceAccount = require(googleCredPath);
}

// Opción 2: service-account-key.json en scripts/
const serviceAccountPath = path.join(__dirname, 'service-account-key.json');
if (!serviceAccount && fs.existsSync(serviceAccountPath)) {
  console.log('✅ Usando credenciales de service-account-key.json');
  serviceAccount = require(serviceAccountPath);
}

// Opción 3: Buscar en raíz del proyecto
const rootServiceAccountPath = path.join(__dirname, '..', 'service-account-key.json');
if (!serviceAccount && fs.existsSync(rootServiceAccountPath)) {
  console.log('✅ Usando credenciales de ../service-account-key.json');
  serviceAccount = require(rootServiceAccountPath);
}

if (!serviceAccount) {
  console.error('\n❌ Error: No se encontraron credenciales de Firebase Admin\n');
  console.log('📝 Para obtener las credenciales:');
  console.log('   1. Ve a: https://console.firebase.google.com/project/stela-a8c06/settings/serviceaccounts/adminsdk');
  console.log('   2. Click en "Generar nueva clave privada"');
  console.log('   3. Guarda el archivo JSON como: scripts/service-account-key.json\n');
  console.log('📖 Ver instrucciones completas: scripts/INSTRUCCIONES-EJECUTAR.md\n');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "stela-a8c06"
});

const db = admin.firestore();

// ============================================
// CONFIGURACIÓN
// ============================================

const CONFIG = {
  // Período de análisis en días
  PERIODO_ANALISIS_DIAS: 365,
  
  // Umbrales para clasificación de clientes
  DIAS_CLIENTE_ACTIVO: 90,
  DIAS_CLIENTE_RIESGO: 180,
  MIN_PEDIDOS_ACTIVO: 2,
  
  // Umbrales para satisfacción
  SATISFACCION_MINIMA: 3,
  
  // Percentiles para presupuesto
  PERCENTIL_PRESUPUESTO_MAX: 90,
  PERCENTIL_PRESUPUESTO_MIN: 10,
  
  // Límites para "top" preferencias
  TOP_CATEGORIAS: 5,
  TOP_COLORES: 5,
  TOP_PRENDAS: 10,
  TOP_TALLAS: 3,
};

// ============================================
// UTILIDADES
// ============================================

/**
 * Calcula días desde una fecha hasta hoy
 */
function diasDesde(fechaStr) {
  if (!fechaStr) return 999;
  const fecha = new Date(fechaStr);
  const hoy = new Date();
  return Math.floor((hoy - fecha) / (1000 * 60 * 60 * 24));
}

/**
 * Calcula percentil de un array
 */
function percentil(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Calcula la moda (valor más frecuente) de un array
 */
function moda(arr) {
  if (!arr.length) return null;
  const freq = {};
  arr.forEach(item => {
    freq[item] = (freq[item] || 0) + 1;
  });
  return Object.keys(freq).reduce((a, b) => freq[a] > freq[b] ? a : b);
}

/**
 * Normaliza nombres de clientes para comparación
 */
function normalizarNombre(nombre) {
  if (!nombre) return '';
  return nombre
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Obtiene el top N de elementos más frecuentes
 */
function topFrequentes(arr, n = 5) {
  if (!arr.length) return [];
  
  const freq = {};
  arr.forEach(item => {
    if (item) {
      freq[item] = (freq[item] || 0) + 1;
    }
  });
  
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([item]) => item);
}

/**
 * Calcula la descripción de frecuencia de compra
 */
function obtenerDescripcionFrecuencia(pedidosPorMes) {
  if (pedidosPorMes >= 3) return 'muy_frecuente';
  if (pedidosPorMes >= 1.5) return 'frecuente';
  if (pedidosPorMes >= 0.5) return 'ocasional';
  if (pedidosPorMes > 0) return 'esporadico';
  return 'sin_compras';
}

/**
 * Determina el estilo de compra del cliente
 */
function determinarEstiloCompra(variedadColores, variedadCategorias, totalPedidos) {
  if (totalPedidos < 2) return 'nuevo';
  
  const diversidad = (variedadColores + variedadCategorias) / (totalPedidos * 2);
  
  if (diversidad > 0.6) return 'exploratorio';
  if (diversidad > 0.3) return 'moderado';
  return 'conservador';
}

// ============================================
// LÓGICA PRINCIPAL
// ============================================

/**
 * Obtiene todos los pedidos de un cliente desde Firestore
 */
async function obtenerPedidosCliente(clienteNombre) {
  const nombreNormalizado = normalizarNombre(clienteNombre);
  
  // Buscar en la colección "ordenes" (nueva estructura)
  const ordenesSnapshot = await db.collection('ordenes').get();
  const pedidosOrdenes = [];
  
  ordenesSnapshot.forEach(doc => {
    const data = doc.data();
    let nombreOrden = '';
    
    if (typeof data.cliente === 'string') {
      nombreOrden = data.cliente;
    } else if (data.cliente && data.cliente.nombre) {
      nombreOrden = data.cliente.nombre;
    }
    
    if (normalizarNombre(nombreOrden) === nombreNormalizado) {
      // Expandir items de la orden
      const items = data.items || [];
      items.forEach(item => {
        pedidosOrdenes.push({
          fecha: data.fechaCreacion || data.fechaEntrega || null,
          categoria: item.categoria || 'Sin categoría',
          color: item.color || 'Sin color',
          talla: item.talla || 'Sin talla',
          prenda: item.nombre || 'Sin nombre',
          precio: item.precio || 0,
          costo: item.costo || 0,
          entregado: data.estadoPedido === 'entregado',
          comprado: item.comprado !== false,
          proveedor: item.proveedor || 'Sin proveedor',
          origen: 'ordenes'
        });
      });
    }
  });
  
  // TODO: Si existe la colección "pedidos" antigua, también buscar allí
  // Descomentar si necesitas migrar datos de la colección antigua
  /*
  const pedidosSnapshot = await db.collection('pedidos')
    .where('cliente', '==', clienteNombre)
    .get();
  
  const pedidosAntiguos = pedidosSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      fecha: data.fecha,
      categoria: data.categoria,
      color: data.color,
      talla: data.talla,
      prenda: data.prenda,
      precio: data.precio || data.pago || 0,
      costo: data.costo || 0,
      entregado: data.entregado === true,
      comprado: data.comprado !== false,
      proveedor: data.proveedor,
      origen: 'pedidos_antiguos'
    };
  });
  
  return [...pedidosOrdenes, ...pedidosAntiguos];
  */
  
  return pedidosOrdenes;
}

/**
 * Calcula métricas de satisfacción basadas en el comportamiento
 * Nota: Como no hay un campo explícito de satisfacción, lo inferimos
 */
function calcularSatisfaccion(pedidos, diasDesdeUltimaCompra, frecuenciaMensual) {
  // Factores que indican satisfacción:
  // 1. Recencia de compras
  // 2. Frecuencia de recompra
  // 3. Variedad (explora diferentes productos)
  // 4. Completitud (pedidos entregados)
  
  let score = 3.0; // Base neutral
  
  // Factor 1: Recencia (más reciente = más satisfecho)
  if (diasDesdeUltimaCompra <= 30) score += 1.0;
  else if (diasDesdeUltimaCompra <= 60) score += 0.5;
  else if (diasDesdeUltimaCompra <= 90) score += 0.2;
  else if (diasDesdeUltimaCompra > 180) score -= 1.0;
  
  // Factor 2: Frecuencia (compra regular = satisfecho)
  if (frecuenciaMensual >= 2) score += 0.8;
  else if (frecuenciaMensual >= 1) score += 0.4;
  else if (frecuenciaMensual < 0.3) score -= 0.5;
  
  // Factor 3: Completitud de pedidos
  const pedidosEntregados = pedidos.filter(p => p.entregado).length;
  const tasaCompletitud = pedidos.length > 0 ? pedidosEntregados / pedidos.length : 0;
  if (tasaCompletitud >= 0.9) score += 0.5;
  else if (tasaCompletitud < 0.7) score -= 0.5;
  
  // Limitar entre 1 y 5
  return Math.max(1, Math.min(5, score));
}

/**
 * Genera el perfil completo de un cliente
 */
async function generarPerfilCliente(cliente) {
  console.log(`\n📊 Analizando: ${cliente.nombre}...`);
  
  // 1. Obtener pedidos del cliente
  const pedidos = await obtenerPedidosCliente(cliente.nombre);
  
  if (pedidos.length === 0) {
    console.log(`   ⚠️  Sin historial de pedidos`);
    return {
      tipo_cliente: 'nuevo',
      total_pedidos_12m: 0,
      sin_actividad: true,
      ultima_compra: null,
      dias_desde_ultima_compra: 999,
      actualizado_en: new Date().toISOString(),
      perfil_recomendacion: null
    };
  }
  
  // 2. Filtrar pedidos del período de análisis
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - CONFIG.PERIODO_ANALISIS_DIAS);
  
  const pedidosPeriodo = pedidos.filter(p => {
    if (!p.fecha) return false;
    const fechaPedido = new Date(p.fecha);
    return fechaPedido >= fechaLimite;
  });
  
  console.log(`   📦 Pedidos encontrados: ${pedidos.length} (${pedidosPeriodo.length} en últimos 12m)`);
  
  // 3. Métricas básicas
  const fechasOrdenadas = pedidosPeriodo
    .map(p => p.fecha)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a));
  
  const ultimaCompra = fechasOrdenadas[0] || null;
  const diasDesdeUltimaCompra = ultimaCompra ? diasDesde(ultimaCompra) : 999;
  const totalPedidos = pedidosPeriodo.length;
  const mesesPeriodo = CONFIG.PERIODO_ANALISIS_DIAS / 30;
  const frecuenciaMensual = totalPedidos / mesesPeriodo;
  
  // 4. Métricas financieras
  const precios = pedidosPeriodo.map(p => p.precio).filter(p => p > 0);
  const gastoTotal = precios.reduce((sum, p) => sum + p, 0);
  const gastoPromedio = precios.length > 0 ? gastoTotal / precios.length : 0;
  const presupuestoMax = percentil(precios, CONFIG.PERCENTIL_PRESUPUESTO_MAX);
  const presupuestoMin = percentil(precios, CONFIG.PERCENTIL_PRESUPUESTO_MIN);
  
  // 5. Preferencias
  const categorias = pedidosPeriodo.map(p => p.categoria).filter(Boolean);
  const colores = pedidosPeriodo.map(p => p.color).filter(Boolean);
  const tallas = pedidosPeriodo.map(p => p.talla).filter(Boolean);
  const prendas = pedidosPeriodo.map(p => p.prenda).filter(Boolean);
  
  const categoriasFavoritas = topFrequentes(categorias, CONFIG.TOP_CATEGORIAS);
  const coloresFavoritos = topFrequentes(colores, CONFIG.TOP_COLORES);
  const tallasMasUsadas = topFrequentes(tallas, CONFIG.TOP_TALLAS);
  const prendasMasCompradas = topFrequentes(prendas, CONFIG.TOP_PRENDAS);
  
  const variedadColores = new Set(colores).size;
  const variedadCategorias = new Set(categorias).size;
  
  // 6. Estilo de compra
  const estiloCompra = determinarEstiloCompra(variedadColores, variedadCategorias, totalPedidos);
  
  // 7. Satisfacción (inferida)
  const satisfaccionPromedio = calcularSatisfaccion(pedidosPeriodo, diasDesdeUltimaCompra, frecuenciaMensual);
  
  // Para satisfacción de últimas 3 compras, dar más peso a la recencia
  const ultimas3 = pedidosPeriodo.slice(0, 3);
  const satisfaccionUltimas3 = ultimas3.length > 0 
    ? calcularSatisfaccion(ultimas3, diasDesdeUltimaCompra, frecuenciaMensual)
    : satisfaccionPromedio;
  
  // 8. Clasificación del cliente
  let tipoCliente = 'nuevo';
  let sinActividad = false;
  
  if (diasDesdeUltimaCompra <= CONFIG.DIAS_CLIENTE_ACTIVO && totalPedidos >= CONFIG.MIN_PEDIDOS_ACTIVO) {
    tipoCliente = 'activo';
  } else if (diasDesdeUltimaCompra > CONFIG.DIAS_CLIENTE_RIESGO) {
    tipoCliente = 'inactivo';
    sinActividad = true;
  } else if (totalPedidos >= 1) {
    tipoCliente = 'activo'; // Tiene actividad pero baja frecuencia
  }
  
  // 9. Ensamblar perfil
  const perfilRecomendacion = {
    // Métricas de actividad
    tipo_cliente: tipoCliente,
    total_pedidos_12m: totalPedidos,
    sin_actividad: sinActividad,
    ultima_compra: ultimaCompra,
    dias_desde_ultima_compra: diasDesdeUltimaCompra,
    periodo_analisis: '12_meses',
    
    // Métricas de frecuencia
    frecuencia_compra: obtenerDescripcionFrecuencia(frecuenciaMensual),
    frecuencia_compra_mensual: Math.round(frecuenciaMensual * 100) / 100,
    
    // Métricas financieras
    gasto_total_12m: Math.round(gastoTotal),
    gasto_promedio_por_compra: Math.round(gastoPromedio),
    presupuesto_estimado_max: Math.round(presupuestoMax),
    rango_precio_min: Math.round(presupuestoMin),
    rango_precio_max: Math.round(presupuestoMax),
    
    // Satisfacción (inferida)
    satisfaccion_promedio: Math.round(satisfaccionPromedio * 10) / 10,
    satisfaccion_ultimas_3_compras: Math.round(satisfaccionUltimas3 * 10) / 10,
    
    // Preferencias
    categorias_favoritas: categoriasFavoritas,
    colores_favoritos: coloresFavoritos,
    prendas_mas_compradas: prendasMasCompradas,
    
    // Diversidad
    estilo_compra: estiloCompra,
    variedad_colores: variedadColores,
    variedad_categorias: variedadCategorias,
    
    // Metadata
    actualizado_en: new Date().toISOString(),
    pedidos_analizados: totalPedidos,
  };
  
  console.log(`   ✅ Perfil generado:`);
  console.log(`      - Tipo: ${tipoCliente}`);
  console.log(`      - Pedidos: ${totalPedidos}`);
  console.log(`      - Última compra: ${diasDesdeUltimaCompra} días atrás`);
  console.log(`      - Gasto promedio: $${gastoPromedio.toFixed(0)}`);
  console.log(`      - Satisfacción: ${satisfaccionPromedio.toFixed(1)}/5`);
  
  return {
    tipo_cliente: tipoCliente,
    total_pedidos_12m: totalPedidos,
    sin_actividad: sinActividad,
    ultima_compra: ultimaCompra,
    dias_desde_ultima_compra: diasDesdeUltimaCompra,
    tallas_mas_usadas: tallasMasUsadas,
    variedad_colores: variedadColores,
    actualizado_en: new Date().toISOString(),
    perfil_recomendacion: perfilRecomendacion
  };
}

/**
 * Actualiza el perfil de un cliente en Firestore
 */
async function actualizarPerfilEnFirestore(clienteId, perfil) {
  try {
    await db.collection('clientes').doc(clienteId).update(perfil);
    return true;
  } catch (error) {
    console.error(`   ❌ Error actualizando cliente ${clienteId}:`, error.message);
    return false;
  }
}

/**
 * Proceso principal
 */
async function main() {
  console.log('\n🚀 Iniciando generación de perfiles de clientes...\n');
  console.log(`📅 Período de análisis: últimos ${CONFIG.PERIODO_ANALISIS_DIAS} días`);
  console.log(`⚙️  Umbrales: Activo ≤${CONFIG.DIAS_CLIENTE_ACTIVO}d | Riesgo >${CONFIG.DIAS_CLIENTE_RIESGO}d\n`);
  
  try {
    // 1. Obtener todos los clientes
    const clientesSnapshot = await db.collection('clientes').get();
    const totalClientes = clientesSnapshot.size;
    
    console.log(`👥 Total de clientes encontrados: ${totalClientes}\n`);
    console.log('─'.repeat(60));
    
    let procesados = 0;
    let actualizados = 0;
    let errores = 0;
    
    // 2. Procesar cada cliente
    for (const doc of clientesSnapshot.docs) {
      const clienteData = doc.data();
      const cliente = {
        id: doc.id,
        nombre: clienteData.cliente || clienteData.nombre || 'Sin nombre'
      };
      
      try {
        // Generar perfil
        const perfil = await generarPerfilCliente(cliente);
        
        // Actualizar en Firestore
        const success = await actualizarPerfilEnFirestore(cliente.id, perfil);
        
        if (success) {
          actualizados++;
        } else {
          errores++;
        }
      } catch (error) {
        console.error(`   ❌ Error procesando ${cliente.nombre}:`, error.message);
        errores++;
      }
      
      procesados++;
      
      // Pequeña pausa para no saturar Firestore
      if (procesados % 10 === 0) {
        console.log(`\n⏳ Progreso: ${procesados}/${totalClientes} clientes procesados...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // 3. Resumen final
    console.log('\n' + '═'.repeat(60));
    console.log('✨ RESUMEN DE EJECUCIÓN');
    console.log('═'.repeat(60));
    console.log(`✅ Clientes procesados: ${procesados}`);
    console.log(`💾 Perfiles actualizados: ${actualizados}`);
    console.log(`❌ Errores: ${errores}`);
    console.log('═'.repeat(60) + '\n');
    
    if (errores > 0) {
      console.log('⚠️  Revisa los logs anteriores para detalles de los errores.\n');
    } else {
      console.log('🎉 ¡Todos los perfiles se generaron correctamente!\n');
    }
    
  } catch (error) {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  }
}

// Ejecutar
main()
  .then(() => {
    console.log('✅ Script completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Error no manejado:', error);
    process.exit(1);
  });
