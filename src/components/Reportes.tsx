import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CloudArrowDownIcon,
  CurrencyDollarIcon,
  DocumentArrowDownIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  SparklesIcon,
  Squares2X2Icon,
  UsersIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { userQuery } from '../utils/multitenancy';
import { useSubscription } from '../contexts';
import UpgradeModal, { useUpgradeModal } from './UpgradeModal';

const currency = (value: number) =>
  value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

const timePresets = [
  { key: '7d', label: 'Última semana', days: 7 },
  { key: '30d', label: 'Último mes', days: 30 },
  { key: '90d', label: '3 meses', days: 90 },
  { key: '12m', label: 'Último año', days: 365 },
  { key: 'custom', label: 'Elegir fechas', days: 0 }
];

type Orden = {
  id: string;
  totalVenta?: number;
  estadoPedido?: string;
  fechaCreacion?: string;
  fechaEntrega?: string | null;
  items?: any[];
  cliente?: { nombre?: string } | string;
  lugar?: string;
};

type MovimientoFinanza = {
  id: string;
  tipo?: 'ingreso' | 'gasto';
  monto?: number;
  fecha?: string;
  categoria?: string;
  createdAt?: any;
};

type Producto = {
  id: string;
  category?: string;
  variants?: Array<{ id: number; colorName: string; hexColor: string; sizes: Array<{ size: string; stock: number; variantSku: string }> }>;
};

type DevolucionDoc = {
  id: string;
  fechaDevolucion?: string;
  totalDevuelto?: number;
  estadoDevolucion?: string;
  metodoReembolso?: string;
};

type ClienteDoc = {
  id: string;
  cliente?: string;
  perfil_recomendacion?: { total_pedidos_12m?: number };
};

type InventoryMovementDoc = {
  id: string;
  tipo?: string;
  comprado?: boolean;
  cancelado?: boolean;
  proveedor?: string;
  costo?: number;
  cantidad?: number;
  productoNombre?: string;
  sku?: string;
  talla?: string;
  color?: string;
  fechaRegistro?: string;
};

const getDateFromDoc = (input: any): Date | null => {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input === 'string') {
    const parsed = new Date(input);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  if (input?.toDate) {
    try {
      return input.toDate();
    } catch (e) {
      return null;
    }
  }
  return null;
};

const calcStartDate = (key: string) => {
  const preset = timePresets.find(p => p.key === key) || timePresets[1];
  const date = new Date();
  date.setDate(date.getDate() - preset.days);
  return date;
};

const weekKey = (date: Date) => {
  const firstJan = new Date(date.getFullYear(), 0, 1);
  const pastDays = Math.floor((date.getTime() - firstJan.getTime()) / 86400000);
  const week = Math.ceil((pastDays + firstJan.getDay() + 1) / 7);
  return `Semana ${week}`;
};

const Reportes: React.FC = () => {
  const { user } = useAuth();
  const uid = user?.uid;
  const { isBusiness } = useSubscription();
  const { upgradeProps, requireBusiness } = useUpgradeModal();
  const [selectedRange, setSelectedRange] = useState<string>('30d');
  const [baseContable, setBaseContable] = useState<'caja' | 'devengado'>('caja');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [finanzas, setFinanzas] = useState<MovimientoFinanza[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [devoluciones, setDevoluciones] = useState<DevolucionDoc[]>([]);
  const [clientes, setClientes] = useState<ClienteDoc[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovementDoc[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        if (!uid) return;
        const [ordenesSnap, finanzasSnap, productosSnap, devolucionesSnap, clientesSnap, invSnap] = await Promise.all([
          getDocs(userQuery('ordenes', uid)),
          getDocs(userQuery('finanzas', uid)),
          getDocs(userQuery('productos', uid)),
          getDocs(userQuery('devoluciones', uid)),
          getDocs(userQuery('clientes', uid)),
          getDocs(userQuery('inventory_movements', uid))
        ]);

        setOrdenes(ordenesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Orden[]);
        setFinanzas(finanzasSnap.docs.map(d => ({ id: d.id, ...d.data() })) as MovimientoFinanza[]);
        setProductos(productosSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Producto[]);
        setDevoluciones(devolucionesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as DevolucionDoc[]);
        setClientes(clientesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as ClienteDoc[]);
        setInventoryMovements((invSnap.docs.map(d => ({ id: d.id, ...d.data() })) as InventoryMovementDoc[]).filter(m => m.tipo === 'entrada'));
      } catch (e) {
        console.error('Error cargando datos para reportes', e);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [uid]);

  const startDate = useMemo(() => calcStartDate(selectedRange), [selectedRange]);
  const endDate = useMemo(() => {
    if (selectedRange !== 'custom') return null;
    const to = customTo ? new Date(customTo) : null;
    return to && !isNaN(to.getTime()) ? to : null;
  }, [selectedRange, customTo]);

  const fechaReferencia = (o: Orden): Date | null => {
    const raw = baseContable === 'caja' ? (o.fechaCreacion || o.fechaEntrega) : (o.fechaEntrega || o.fechaCreacion);
    return getDateFromDoc(raw);
  };

  const ordenesConFecha = useMemo(() => ordenes, [ordenes]);

  const ordenesEnRango = useMemo(() => {
    return ordenesConFecha.filter(o => {
      const fechaRef = fechaReferencia(o);
      const fechaEnt = getDateFromDoc(o.fechaEntrega);
      if (selectedRange === 'custom') {
        const from = customFrom ? new Date(customFrom) : null;
        const to = endDate;
        const inRange = (date: Date | null) => {
          if (!date) return false;
          const okFrom = from ? date >= from : true;
          const okTo = to ? date <= to : true;
          return okFrom && okTo;
        };
        // Incluir órdenes entregadas si su fecha de entrega está en el rango personalizado
        if (o.estadoPedido === 'entregado' && inRange(fechaEnt)) return true;
        return fechaRef ? inRange(fechaRef) : false;
      }
      // Para presets, considerar también la fecha de entrega si la orden está entregada
      if (o.estadoPedido === 'entregado' && fechaEnt) {
        if (fechaEnt >= startDate) return true;
      }
      return fechaRef ? fechaRef >= startDate : false;
    });
  }, [ordenesConFecha, startDate, selectedRange, customFrom, endDate, baseContable]);

  // Etiqueta legible para el rango seleccionado
  const etiquetaSeleccionada = useMemo(() => (
    timePresets.find(p => p.key === selectedRange)?.label || selectedRange
  ), [selectedRange]);

  const calcFinanzasPorRango = (presetKey: string) => {
    const start = calcStartDate(presetKey);
    const finanzasRango = finanzas.filter(f => {
      const fecha = getDateFromDoc(f.fecha || f.createdAt);
      if (!fecha) return false;
      if (presetKey === 'custom') {
        const from = customFrom ? new Date(customFrom) : null;
        const to = customTo ? new Date(customTo) : null;
        const okFrom = from ? fecha >= from : true;
        const okTo = to ? fecha <= to : true;
        return okFrom && okTo;
      }
      return fecha >= start;
    });
    const ordenesRango = ordenesConFecha.filter(o => {
      const fecha = fechaReferencia(o);
      if (!fecha) return false;
      if (presetKey === 'custom') {
        const from = customFrom ? new Date(customFrom) : null;
        const to = customTo ? new Date(customTo) : null;
        const okFrom = from ? fecha >= from : true;
        const okTo = to ? fecha <= to : true;
        return okFrom && okTo;
      }
      return fecha >= start;
    });

    const ingresosCaja = finanzasRango.filter(f => f.tipo === 'ingreso').reduce((acc, f) => acc + (Number(f.monto) || 0), 0);
    const gastosCaja = finanzasRango.filter(f => f.tipo === 'gasto').reduce((acc, f) => acc + (Number(f.monto) || 0), 0);

    const entregadas = ordenesRango.filter(o => o.estadoPedido === 'entregado');
    const ingresosDev = entregadas.reduce((acc, o) => acc + (Number(o.totalVenta) || 0), 0);
    const gastosDev = entregadas.reduce((acc, o) => {
      const items = o.items || [];
      const costoItems = items.reduce((s: number, it: any) => s + (Number(it.costo) || 0) * (Number(it.cantidad || 1)), 0);
      return acc + costoItems;
    }, 0);

    return {
      ingresosCaja,
      gastosCaja,
      utilidadCaja: ingresosCaja - gastosCaja,
      ingresosDev,
      gastosDev,
      utilidadDev: ingresosDev - gastosDev,
      etiqueta: timePresets.find(p => p.key === presetKey)?.label || presetKey,
    };
  };

  const resumenFinanzas = useMemo(() => {
    const f = calcFinanzasPorRango(selectedRange);
    const ingresos = baseContable === 'caja' ? f.ingresosCaja : f.ingresosDev;
    const gastos = baseContable === 'caja' ? f.gastosCaja : f.gastosDev;
    const utilidad = baseContable === 'caja' ? f.utilidadCaja : f.utilidadDev;
    const margen = ingresos === 0 ? 0 : (utilidad / ingresos) * 100;
    return { ingresos, gastos, utilidad, margen };
  }, [baseContable, selectedRange, finanzas, ordenesConFecha, customFrom, customTo]);

  const ventasTabla = useMemo(() => {
    return timePresets.map(p => {
      const f = calcFinanzasPorRango(p.key);
      const ingresos = baseContable === 'caja' ? f.ingresosCaja : f.ingresosDev;
      const gastos = baseContable === 'caja' ? f.gastosCaja : f.gastosDev;
      const utilidad = ingresos - gastos;
      const margen = ingresos === 0 ? 0 : (utilidad / ingresos) * 100;
      return { key: p.key, etiqueta: f.etiqueta, ingresos, gastos, utilidad, margen };
    });
  }, [baseContable, finanzas, ordenesConFecha, customFrom, customTo]);

  type LegacyRow = {
    fecha: string;
    fechaEntrega: string;
    cliente: string;
    prenda: string;
    categoria: string;
    talla: string;
    costo: number;
    precio: number;
    color: string;
    lugar: string;
    tipoCompra: 'stock' | 'pedido';
    estado?: string;
  };

  const legacyRows = useMemo(() => {
    const rows: LegacyRow[] = [];
    ordenesEnRango.forEach(o => {
      const fecha = getDateFromDoc(o.fechaCreacion);
      const entrega = getDateFromDoc(o.fechaEntrega);
      const clienteNombre = typeof o.cliente === 'string' ? (o.cliente || 'INVENTARIO') : (o.cliente?.nombre || 'INVENTARIO');
      const estadoOrden = o.estadoPedido || (entrega ? 'entregado' : 'pendiente');
      (o.items || []).forEach((it: any) => {
        const tipoCompra = (it.origen === 'stock') ? 'stock' : 'pedido';
        rows.push({
          fecha: fecha ? fecha.toISOString().split('T')[0] : '',
          fechaEntrega: entrega ? entrega.toISOString().split('T')[0] : '',
          cliente: clienteNombre,
          prenda: it.nombre || '',
          categoria: it.categoria || 'General',
          talla: it.talla || '',
          costo: Number(it.costo) || 0,
          precio: Number(it.precio) || 0,
          color: (it.color || '').trim(),
          lugar: o.lugar || '',
          tipoCompra,
          estado: estadoOrden
        });
      });
    });
    return rows;
  }, [ordenesEnRango]);

  // Filtros para la tabla legado
  const [searchTable, setSearchTable] = useState<string>('');
  const [filterTipoCompra, setFilterTipoCompra] = useState<'ALL' | 'stock' | 'pedido'>('ALL');
  const [filterEstado, setFilterEstado] = useState<'ALL' | 'pendiente' | 'enviado' | 'entregado'>('ALL');
  const [tableFechaDesde, setTablaFechaDesde] = useState<string>('');
  const [tableFechaHasta, setTablaFechaHasta] = useState<string>('');

  const legacyRowsFiltered = useMemo(() => {
    return legacyRows.filter((r) => {
      const matchSearch = (r.cliente + ' ' + r.prenda + ' ' + r.lugar).toLowerCase().includes(searchTable.toLowerCase());
      const matchTipo = filterTipoCompra === 'ALL' || r.tipoCompra === filterTipoCompra;
      const estadoFila = (r.estado || (r.fechaEntrega ? 'entregado' : 'pendiente')) as 'pendiente' | 'enviado' | 'entregado';
      const matchEstado = filterEstado === 'ALL' || estadoFila === filterEstado;
      
      // Filtro por rango de fechas usando fechaEntrega si se está filtrando por entregado
      let matchFecha = true;
      if (tableFechaDesde || tableFechaHasta) {
        const fechaRow = filterEstado === 'entregado' ? (r.fechaEntrega || '') : (r.fecha || '');
        if (tableFechaDesde && fechaRow < tableFechaDesde) matchFecha = false;
        if (tableFechaHasta && fechaRow > tableFechaHasta) matchFecha = false;
      }
      
      return matchSearch && matchTipo && matchEstado && matchFecha;
    });
  }, [legacyRows, searchTable, filterTipoCompra, filterEstado, tableFechaDesde, tableFechaHasta]);

  const tableTotales = useMemo(() => {
    const totalPrecio = legacyRowsFiltered.reduce((acc, r) => acc + r.precio, 0);
    const totalCosto = legacyRowsFiltered.reduce((acc, r) => acc + r.costo, 0);
    const utilidadBruta = totalPrecio - totalCosto;
    return { totalPrecio, totalCosto, utilidadBruta };
  }, [legacyRowsFiltered]);

  const quoteIfNeeded = (s: string) => {
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const exportLegacyCsv = () => {
    const header = 'Fecha,Fecha de Entrega,Cliente,Prenda,Categoria,Talla,Costo,Precio,Color,Lugar,Tipo de Compra';
    const body = legacyRows.map(r => [
      r.fecha,
      r.fechaEntrega,
      quoteIfNeeded(r.cliente),
      quoteIfNeeded(r.prenda),
      quoteIfNeeded(r.categoria),
      quoteIfNeeded(r.talla),
      String(r.costo),
      String(r.precio),
      quoteIfNeeded(r.color),
      quoteIfNeeded(r.lugar),
      r.tipoCompra
    ].join(',')).join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'pedidos_filtrados.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const utilidadSemanal = useMemo(() => {
    const map = new Map<string, number>();
    finanzas.forEach(f => {
      const fecha = getDateFromDoc(f.fecha || f.createdAt);
      if (!fecha) return;
      const wk = `${fecha.getFullYear()}-${weekKey(fecha)}`;
      const current = map.get(wk) || 0;
      const monto = (Number(f.monto) || 0) * (f.tipo === 'gasto' ? -1 : 1);
      map.set(wk, current + monto);
    });
    const arr = Array.from(map.entries())
      .map(([label, utilidad]) => ({ label, utilidad }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return arr.slice(-6);
  }, [finanzas]);

  const utilidadMax = Math.max(1, ...utilidadSemanal.map(w => w.utilidad));

  const comprasPendientes = useMemo(() => {
    const ordenesPendientes = ordenes.filter(o => o.estadoPedido !== 'entregado');
    const itemsOrdenes = ordenesPendientes.map(o => (
      (o.items || []).map((it: any, idx: number) => ({
        proveedor: it.proveedor || 'Sin proveedor',
        folio: o.id,
        monto: Number(it.costo) || 0,
        eta: it.fechaEntregaPrevista || '-',
        prioridad: it.pagadoProveedor ? 'Media' : 'Alta',
        comprado: it.comprado,
        cancelado: it.cancelado,
        idx
      }))
    ));
    const pendientesOrden = ([] as Array<{ proveedor: string; folio: string; monto: number; eta: string; prioridad: string; comprado: any; cancelado: any; idx: number }>).
      concat(...itemsOrdenes)
      .filter(it => it.comprado === false && it.cancelado !== true);

    const pendientesInv = inventoryMovements
      .filter(m => m.tipo === 'entrada' && m.comprado === false && m.cancelado !== true)
      .map(m => ({
        proveedor: m.proveedor || 'Sin proveedor',
        folio: m.id,
        monto: (Number(m.costo) || 0) * (Number(m.cantidad) || 1),
        eta: m.fechaRegistro || '-',
        prioridad: 'Media'
      }));

    return [...pendientesOrden, ...pendientesInv].slice(0, 10);
  }, [ordenes, inventoryMovements]);

  const rotacionInventario = useMemo(() => {
    const ventas30d = ordenesConFecha
      .filter(o => {
        if (o.estadoPedido !== 'entregado') return false;
        const entrega = getDateFromDoc(o.fechaEntrega);
        return entrega ? entrega >= calcStartDate('30d') : false;
      })
      .flatMap(o => (o.items || []).map((it: any) => ({ categoria: it.categoria || 'General', cantidad: Number(it.cantidad || 1) })));

    const ventasPorCategoria = ventas30d.reduce((acc, v) => {
      acc[v.categoria] = (acc[v.categoria] || 0) + v.cantidad;
      return acc;
    }, {} as Record<string, number>);

    const stockPorCategoria: Record<string, number> = {};
    productos.forEach(p => {
      const cat = p.category || 'General';
      const stock = (p.variants || []).reduce((s, v) => s + (v.sizes || []).reduce((s2, sz) => s2 + (Number(sz.stock) || 0), 0), 0);
      stockPorCategoria[cat] = (stockPorCategoria[cat] || 0) + stock;
    });

    return Object.keys(stockPorCategoria).map(cat => {
      const stock = stockPorCategoria[cat];
      const ventas = ventasPorCategoria[cat] || 0;
      const rotacionMes = stock === 0 ? 0 : ventas / Math.max(stock, 1);
      const diasInventario = ventas === 0 ? 999 : Math.round((stock / ventas) * 30);
      const tendencia = rotacionMes > 2 ? 'up' : rotacionMes > 1 ? 'flat' : 'down';
      return { categoria: cat, diasInventario, rotacionMes, tendencia };
    }).sort((a, b) => a.diasInventario - b.diasInventario).slice(0, 6);
  }, [productos, ordenesConFecha]);

  const clientesKpis = useMemo(() => {
    const clientesConCompras = clientes.filter(c => (c.perfil_recomendacion?.total_pedidos_12m || 0) > 0).length;
    const clientesRecompra = clientes.filter(c => (c.perfil_recomendacion?.total_pedidos_12m || 0) >= 2).length;
    const tasaRecompra = clientesConCompras === 0 ? 0 : (clientesRecompra / clientesConCompras) * 100;
    const ticketProm = ordenes.length === 0 ? 0 : ordenes.reduce((acc, o) => acc + (Number(o.totalVenta) || 0), 0) / Math.max(ordenes.length, 1);
    return [
      { titulo: 'Clientes que repiten', valor: `${tasaRecompra.toFixed(1)}%`, delta: `${clientesRecompra} compraron más de una vez` },
      { titulo: 'Total de clientes', valor: clientes.length.toString(), delta: `${clientesConCompras} han comprado` },
      { titulo: 'Promedio por venta', valor: currency(ticketProm || 0), delta: 'Precio promedio por pedido' },
    ];
  }, [clientes, ordenes]);

  const devolucionesResumen = useMemo(() => {
    const devEnRango = devoluciones.filter(d => {
      const fecha = getDateFromDoc(d.fechaDevolucion);
      return fecha ? fecha >= startDate : false;
    });
    const entregadasRango = ordenesEnRango.filter(o => o.estadoPedido === 'entregado');
    const tasa = entregadasRango.length === 0 ? 0 : (devEnRango.length / entregadasRango.length);
    return {
      tasa,
      totalDevuelto: devEnRango.reduce((acc, d) => acc + (Number(d.totalDevuelto) || 0), 0),
      totalDevoluciones: devEnRango.length
    };
  }, [devoluciones, ordenesEnRango, startDate]);

  const kpisCriticos = useMemo(() => {
    const pedidosCompletados = (() => {
      const entregadas = ordenes.filter(o => o.estadoPedido === 'entregado').length;
      const total = ordenes.length;
      return total === 0 ? 'Sin datos' : `${Math.min(100, Math.round((entregadas / total) * 100))}%`;
    })();

    const pedidosPorEntregar = (() => {
      const pendientes = ordenes.filter(o => o.estadoPedido !== 'entregado').length;
      const total = ordenes.length;
      return total === 0 ? 'Sin datos' : `${Math.round((pendientes / total) * 100)}%`;
    })();

    return [
      { nombre: 'Pedidos completados', valor: pedidosCompletados, detalle: 'Del total de pedidos' },
      { nombre: 'Por entregar', valor: pedidosPorEntregar, detalle: 'Pendientes de entrega' },
      { nombre: 'Ganancia del periodo', valor: currency(resumenFinanzas.utilidad), detalle: etiquetaSeleccionada },
      { nombre: 'Velocidad de venta', valor: `${rotacionInventario[0]?.rotacionMes?.toFixed?.(1) || '0'}x`, detalle: 'Mejor categoría' },
    ];
  }, [ordenes, resumenFinanzas.utilidad, rotacionInventario, etiquetaSeleccionada]);

  const handleExport = (format: 'csv' | 'xml') => {
    const rows = ventasTabla.map(r => ({
      rango: r.etiqueta,
      ingresos: r.ingresos,
      gastos: r.gastos,
      utilidad: r.utilidad,
    }));

    if (format === 'csv') {
      const header = 'Periodo,Ingresos,Gastos,Utilidad';
      const body = rows.map(r => `${r.rango},${r.ingresos},${r.gastos},${r.utilidad}`).join('\n');
      const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'reportes-finanzas.csv';
      link.click();
      URL.revokeObjectURL(link.href);
      return;
    }

    const xmlBody = rows
      .map(r => `  <periodo>\n    <nombre>${r.rango}</nombre>\n    <ingresos>${r.ingresos}</ingresos>\n    <gastos>${r.gastos}</gastos>\n    <utilidad>${r.utilidad}</utilidad>\n  </periodo>`)
      .join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<reportes>\n${xmlBody}\n</reportes>`;
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'reportes-finanzas.xml';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // ─── Indicador de rentabilidad ───
  const profitLevel = useMemo(() => {
    const m = resumenFinanzas.margen;
    if (m >= 30) return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', bar: 'bg-emerald-500', label: '¡Excelente!', message: 'Tu negocio tiene muy buena rentabilidad.', advice: 'Sigue así, tu margen de ganancia es saludable.' };
    if (m >= 15) return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', bar: 'bg-blue-500', label: 'Bien', message: 'Tu negocio es rentable.', advice: 'Podrías mejorar negociando mejores precios con proveedores.' };
    if (m > 0) return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', bar: 'bg-amber-500', label: 'Ajustado', message: 'Ganas poco por cada venta.', advice: 'Revisa tus costos y considera ajustar precios.' };
    return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', bar: 'bg-red-500', label: 'Atención', message: 'Estás gastando más de lo que ganas.', advice: 'Necesitas revisar urgentemente tus costos y precios.' };
  }, [resumenFinanzas.margen]);

  // ─── Desglose de pedidos ───
  const orderStats = useMemo(() => {
    const total = ordenesEnRango.length;
    const entregados = ordenesEnRango.filter(o => o.estadoPedido === 'entregado').length;
    const enviados = ordenesEnRango.filter(o => o.estadoPedido === 'enviado').length;
    const pendientes = total - entregados - enviados;
    return {
      total, entregados, enviados, pendientes,
      pctEntregados: total === 0 ? 0 : Math.round((entregados / total) * 100),
      pctEnviados: total === 0 ? 0 : Math.round((enviados / total) * 100),
      pctPendientes: total === 0 ? 0 : Math.round((pendientes / total) * 100),
    };
  }, [ordenesEnRango]);

  return (
    <div className="space-y-8">
      {loading && (
        <div className="p-3 text-sm text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg">
          Cargando datos en vivo...
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">¿Cómo va tu negocio?</h1>
          <p className="text-sm text-gray-500">Mira de un vistazo tus ventas, gastos y ganancias.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportLegacyCsv}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-sm rounded-lg shadow-sm hover:border-blue-400"
          >
            <DocumentArrowDownIcon className="w-5 h-5 text-blue-600" />
            Descargar pedidos
          </button>
          {isBusiness && (
            <>
              <button
                onClick={() => handleExport('csv')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-sm rounded-lg shadow-sm hover:border-blue-400"
              >
                <DocumentArrowDownIcon className="w-5 h-5 text-emerald-600" />
                Reporte CSV
              </button>
              <button
                onClick={() => handleExport('xml')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-sm rounded-lg shadow-sm hover:border-blue-400"
              >
                <CloudArrowDownIcon className="w-5 h-5 text-amber-600" />
                Reporte XML
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Periodo de tiempo</p>
        <div className="flex flex-wrap gap-2">
          {timePresets.map((preset) => (
            <button
              key={preset.key}
              onClick={() => setSelectedRange(preset.key)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                preset.key === selectedRange ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium' : 'border-gray-200 text-gray-700 hover:border-blue-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {selectedRange === 'custom' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white border border-gray-200 shadow-sm rounded-xl p-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Desde</label>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Hasta</label>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
        </div>
      )}

      {/* ═══ Tu Resumen ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <CurrencyDollarIcon className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-gray-500">Ventas</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{currency(resumenFinanzas.ingresos)}</p>
          <p className="text-xs text-gray-400 mt-1">Total de dinero que recibiste</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <ShoppingCartIcon className="w-6 h-6 text-amber-600" />
            </div>
            <p className="text-sm font-medium text-gray-500">Gastos</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{currency(resumenFinanzas.gastos)}</p>
          <p className="text-xs text-gray-400 mt-1">Lo que pagaste en costos</p>
        </div>
        <div className={`rounded-xl border shadow-sm p-5 ${resumenFinanzas.utilidad >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${resumenFinanzas.utilidad >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
              {resumenFinanzas.utilidad >= 0
                ? <ArrowTrendingUpIcon className="w-6 h-6 text-emerald-600" />
                : <ArrowTrendingDownIcon className="w-6 h-6 text-red-600" />}
            </div>
            <p className={`text-sm font-medium ${resumenFinanzas.utilidad >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Ganancia</p>
          </div>
          <p className={`text-2xl font-bold ${resumenFinanzas.utilidad >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>{currency(resumenFinanzas.utilidad)}</p>
          <p className={`text-xs mt-1 ${resumenFinanzas.utilidad >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Lo que te queda después de gastos</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <ShoppingBagIcon className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-sm font-medium text-gray-500">Pedidos</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{orderStats.total}</p>
          <p className="text-xs text-gray-400 mt-1">{orderStats.entregados} entregados</p>
        </div>
      </div>

      {/* ═══ ¿Tu negocio es rentable? ═══ */}
      <div className={`rounded-xl border shadow-sm p-6 ${profitLevel.bg} ${profitLevel.border}`}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center flex-shrink-0">
            <ChartBarIcon className={`w-7 h-7 ${profitLevel.text}`} />
          </div>
          <div className="flex-1">
            <h2 className={`text-lg font-bold ${profitLevel.text} mb-1`}>¿Tu negocio es rentable? {profitLevel.label}</h2>
            <p className={`text-sm ${profitLevel.text} mb-3`}>{profitLevel.message}</p>
            <div className="mb-2">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className={profitLevel.text}>
                  Por cada <strong>$100</strong> que vendes, ganas <strong>${Math.max(0, resumenFinanzas.margen).toFixed(0)}</strong>
                </span>
                <span className={`font-bold ${profitLevel.text}`}>{resumenFinanzas.margen.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-white/60 rounded-full h-3">
                <div className={`h-3 rounded-full transition-all ${profitLevel.bar}`} style={{ width: `${Math.min(100, Math.max(0, resumenFinanzas.margen))}%` }} />
              </div>
            </div>
            <p className={`text-xs ${profitLevel.text} opacity-80`}>{profitLevel.advice}</p>
          </div>
        </div>
      </div>

      {/* ═══ Estado de tus pedidos ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Estado de tus pedidos</h2>
        {orderStats.total === 0 ? (
          <p className="text-sm text-gray-400">No hay pedidos en este periodo.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700 w-28">Entregados</span>
              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                <div className="bg-emerald-500 h-4 rounded-full transition-all" style={{ width: `${orderStats.pctEntregados}%` }} />
              </div>
              <span className="text-sm font-medium text-gray-900 w-24 text-right">{orderStats.entregados} ({orderStats.pctEntregados}%)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700 w-28">Enviados</span>
              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                <div className="bg-blue-500 h-4 rounded-full transition-all" style={{ width: `${orderStats.pctEnviados}%` }} />
              </div>
              <span className="text-sm font-medium text-gray-900 w-24 text-right">{orderStats.enviados} ({orderStats.pctEnviados}%)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700 w-28">Pendientes</span>
              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                <div className="bg-amber-500 h-4 rounded-full transition-all" style={{ width: `${orderStats.pctPendientes}%` }} />
              </div>
              <span className="text-sm font-medium text-gray-900 w-24 text-right">{orderStats.pendientes} ({orderStats.pctPendientes}%)</span>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Upgrade prompt para emprendedor ═══ */}
      {!isBusiness && (
        <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 rounded-xl border border-purple-200 shadow-sm p-6">
          <div className="flex items-start gap-4">
            <SparklesIcon className="w-8 h-8 text-purple-500 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Conoce más sobre tu negocio</h3>
              <p className="text-sm text-gray-600 mb-4">Con el plan Business puedes ver:</p>
              <ul className="text-sm text-gray-700 space-y-1.5 mb-4">
                <li className="flex items-center gap-2"><CheckCircleIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />Comparación de ganancias por periodo</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />Tendencia semanal de ganancias</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />Control de inventario y proveedores</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />Análisis de clientes y recompras</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />Indicadores de salud de tu negocio</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />Exportar reportes completos</li>
              </ul>
              <button
                onClick={() => requireBusiness('Reportes avanzados', 'Desbloquea todos los análisis y reportes con el plan Business.')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                <SparklesIcon className="w-4 h-4" />
                Conocer plan Business
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SECCIONES BUSINESS ═══ */}

      {isBusiness && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <ChartBarIcon className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Análisis detallado</h2>
              <p className="text-sm text-gray-500">Compara tus números en distintos periodos.</p>
            </div>
          </div>

          {/* Toggle base contable */}
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-sm text-gray-600">Calcular con:</span>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setBaseContable('caja')}
                className={`px-4 py-2 text-sm ${baseContable === 'caja' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                Dinero recibido
              </button>
              <button
                onClick={() => setBaseContable('devengado')}
                className={`px-4 py-2 text-sm ${baseContable === 'devengado' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                Pedidos entregados
              </button>
            </div>
            <span className="text-xs text-gray-400">
              {baseContable === 'caja' ? 'Se cuenta el dinero que recibiste' : 'Se cuenta solo lo de pedidos ya entregados'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase">Ventas</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{currency(resumenFinanzas.ingresos)}</p>
              <p className="text-xs text-gray-500">{etiquetaSeleccionada}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase">Gastos</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{currency(resumenFinanzas.gastos)}</p>
              <p className="text-xs text-gray-500">Costos del periodo</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase">Ganancia</p>
              <p className={`text-2xl font-bold mt-1 ${resumenFinanzas.utilidad >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{currency(resumenFinanzas.utilidad)}</p>
              <p className="text-xs text-gray-500">{baseContable === 'caja' ? 'Dinero recibido' : 'Pedidos entregados'}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase">Margen</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{resumenFinanzas.margen.toFixed(1)}%</p>
              <p className="text-xs text-gray-500">{etiquetaSeleccionada}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:col-span-2">
              <p className="text-sm font-semibold text-gray-700 mb-3">Comparación por periodo</p>
              <div className="overflow-hidden rounded-lg border border-gray-100">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
                    <tr>
                      <th className="px-4 py-3">Periodo</th>
                      <th className="px-4 py-3">Ventas</th>
                      <th className="px-4 py-3">Gastos</th>
                      <th className="px-4 py-3">Ganancia</th>
                      <th className="px-4 py-3">Margen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ventasTabla.map((periodo) => (
                      <tr key={periodo.key} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{periodo.etiqueta}</td>
                        <td className="px-4 py-3 text-gray-800">{currency(periodo.ingresos)}</td>
                        <td className="px-4 py-3 text-gray-800">{currency(periodo.gastos)}</td>
                        <td className={`px-4 py-3 font-medium ${periodo.utilidad >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{currency(periodo.utilidad)}</td>
                        <td className="px-4 py-3 text-gray-600">{periodo.margen.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Ganancia por semana</p>
              <div className="h-48 flex items-end gap-2">
                {utilidadSemanal.map((week) => {
                  const barHeight = (week.utilidad / utilidadMax) * 100;
                  return (
                    <div key={week.label} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full bg-blue-50 rounded-md border border-blue-100 flex items-end justify-center" style={{ height: '100%' }}>
                        <div className={`w-9/12 rounded-md ${week.utilidad >= 0 ? 'bg-blue-600' : 'bg-red-400'}`} style={{ height: `${Math.abs(barHeight)}%` }} />
                      </div>
                      <p className="text-[11px] text-gray-500 text-center leading-tight">{week.label}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-xs text-gray-500">Mejor semana: {currency(utilidadMax)}</div>
            </div>
          </div>
        </section>
      )}

      {isBusiness && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <Squares2X2Icon className="w-6 h-6 text-amber-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Tu inventario y proveedores</h2>
              <p className="text-sm text-gray-500">Compras pendientes, velocidad de venta y devoluciones.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700">Compras por pagar</p>
                <ShoppingCartIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div className="space-y-3">
                {comprasPendientes.length === 0 ? (
                  <p className="text-sm text-gray-400">No hay compras pendientes</p>
                ) : comprasPendientes.map((compra) => (
                  <div key={compra.folio} className="p-3 rounded-lg border border-gray-100 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">{compra.proveedor}</p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          compra.prioridad === 'Alta' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {compra.prioridad === 'Alta' ? 'Urgente' : 'Normal'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{currency(compra.monto)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700">¿Qué tan rápido vendes?</p>
                <ShoppingBagIcon className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-xs text-gray-400 mb-3">Días que tarda en venderse tu mercancía</p>
              <div className="space-y-3">
                {rotacionInventario.map((linea) => (
                  <div key={linea.categoria} className="flex items-start justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{linea.categoria}</p>
                      <p className="text-xs text-gray-500">
                        {linea.diasInventario >= 999 ? 'Sin ventas recientes' : `Se vende en ~${linea.diasInventario} días`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {linea.tendencia === 'up' && <ArrowTrendingUpIcon className="w-4 h-4 text-emerald-600" />}
                      {linea.tendencia === 'down' && <ArrowTrendingDownIcon className="w-4 h-4 text-red-600" />}
                      {linea.tendencia === 'flat' && <ArrowRightIcon className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700">Devoluciones</p>
                <ArrowPathIcon className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-center py-4">
                <p className="text-3xl font-bold text-gray-900">{(devolucionesResumen.tasa * 100).toFixed(1)}%</p>
                <p className="text-sm text-gray-500 mt-1">de tus pedidos fueron devueltos</p>
              </div>
              <div className="space-y-2 border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">Devoluciones</span>
                  <span className="text-gray-900 font-semibold">{devolucionesResumen.totalDevoluciones}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">Monto devuelto</span>
                  <span className="text-gray-900 font-semibold">{currency(devolucionesResumen.totalDevuelto)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {isBusiness && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <UsersIcon className="w-6 h-6 text-purple-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Tus clientes</h2>
              <p className="text-sm text-gray-500">Conoce quiénes te compran y cómo retenerlos.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {clientesKpis.map((kpi) => (
              <div key={kpi.titulo} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p className="text-sm text-gray-500 mb-1">{kpi.titulo}</p>
                <p className="text-2xl font-bold text-gray-900">{kpi.valor}</p>
                <p className="text-xs text-gray-400 mt-1">{kpi.delta}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Detalle de pedidos */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <Squares2X2Icon className="w-6 h-6 text-gray-700" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Detalle de pedidos</h2>
            <p className="text-sm text-gray-500">Busca, filtra y exporta tus pedidos.</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={exportLegacyCsv} className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-sm rounded-lg shadow-sm hover:border-blue-400">
              <DocumentArrowDownIcon className="w-5 h-5 text-blue-600" />
              Descargar CSV
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-sm p-4">
          <p className="text-xs font-semibold text-blue-700 uppercase mb-3">Resumen de lo filtrado</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <p className="text-xs text-gray-500 font-semibold uppercase">Total vendido</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{currency(tableTotales.totalPrecio)}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <p className="text-xs text-gray-500 font-semibold uppercase">Total en costos</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{currency(tableTotales.totalCosto)}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <p className="text-xs text-gray-500 font-semibold uppercase">Ganancia</p>
              <p className={`text-2xl font-bold mt-1 ${tableTotales.utilidadBruta >= 0 ? 'text-green-600' : 'text-red-600'}`}>{currency(tableTotales.utilidadBruta)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar cliente, prenda o lugar..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                onChange={(e) => setSearchTable(e.target.value)}
              />
            </div>
            <div>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={filterTipoCompra} onChange={(e) => setFilterTipoCompra(e.target.value as 'ALL' | 'stock' | 'pedido')}>
                <option value="ALL">Todos los tipos</option>
                <option value="stock">Stock</option>
                <option value="pedido">Pedido</option>
              </select>
            </div>
            <div>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value as 'ALL' | 'pendiente' | 'enviado' | 'entregado')}>
                <option value="ALL">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="enviado">Enviado</option>
                <option value="entregado">Entregado</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Fecha desde</label>
              <input
                type="date"
                value={tableFechaDesde}
                onChange={(e) => setTablaFechaDesde(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Fecha hasta</label>
              <input
                type="date"
                value={tableFechaHasta}
                onChange={(e) => setTablaFechaHasta(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setTablaFechaDesde('');
                  setTablaFechaHasta('');
                }}
                className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg border border-gray-300 transition-colors"
              >
                Limpiar fechas
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Fecha de Entrega</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Prenda</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Talla</th>
                  <th className="px-4 py-3">Costo</th>
                  <th className="px-4 py-3">Precio</th>
                  <th className="px-4 py-3">Color</th>
                  <th className="px-4 py-3">Lugar</th>
                  <th className="px-4 py-3">Tipo de Compra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {legacyRowsFiltered.map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{r.fecha}</td>
                    <td className="px-4 py-2">{r.fechaEntrega}</td>
                    <td className="px-4 py-2">{r.cliente}</td>
                    <td className="px-4 py-2">{r.prenda}</td>
                    <td className="px-4 py-2">{r.categoria}</td>
                    <td className="px-4 py-2">{r.talla}</td>
                    <td className="px-4 py-2">{currency(r.costo)}</td>
                    <td className="px-4 py-2">{currency(r.precio)}</td>
                    <td className="px-4 py-2">{r.color}</td>
                    <td className="px-4 py-2">{r.lugar}</td>
                    <td className="px-4 py-2">{r.tipoCompra}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {isBusiness && (
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <SparklesIcon className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Salud de tu negocio</h2>
            <p className="text-sm text-gray-500">Indicadores rápidos del desempeño general.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {kpisCriticos.map((kpi) => (
            <div key={kpi.nombre} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{kpi.nombre}</p>
                <p className="text-xs text-gray-500">{kpi.detalle}</p>
              </div>
              <span className="text-lg font-bold text-gray-900">{kpi.valor}</span>
            </div>
          ))}
        </div>
      </section>
      )}

      <UpgradeModal {...upgradeProps} />
    </div>
  );
};

export default Reportes;
