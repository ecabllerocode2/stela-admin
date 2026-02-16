import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  ArrowsRightLeftIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CloudArrowDownIcon,
  CurrencyDollarIcon,
  DocumentArrowDownIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  SparklesIcon,
  Squares2X2Icon,
  UsersIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../credenciales';
import { useAuth } from '../contexts/AuthContext';
import { userQuery } from '../utils/multitenancy';

const currency = (value: number) =>
  value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

const timePresets = [
  { key: '7d', label: '7 días', days: 7 },
  { key: '30d', label: '30 días', days: 30 },
  { key: '90d', label: '90 días', days: 90 },
  { key: '12m', label: '12 meses', days: 365 },
  { key: 'custom', label: 'Personalizado', days: 0 }
];

const viewTabs = [
  { key: 'general', label: 'General' },
  { key: 'finanzas', label: 'Finanzas' },
  { key: 'operaciones', label: 'Operaciones' },
  { key: 'clientes', label: 'Clientes' }
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
  const [selectedRange, setSelectedRange] = useState<string>('30d');
  const [baseContable, setBaseContable] = useState<'caja' | 'devengado'>('caja');
  const [vistaActiva, setVistaActiva] = useState<string>('general');
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
      { titulo: 'Tasa de recompra', valor: `${tasaRecompra.toFixed(1)}%`, delta: `${clientesRecompra} clientes repiten` },
      { titulo: 'Clientes activos', valor: clientes.length.toString(), delta: `${clientesConCompras} con compras` },
      { titulo: 'Ticket promedio', valor: currency(ticketProm || 0), delta: 'Basado en órdenes' },
      { titulo: 'Churn 60 días', valor: 'N/D', delta: 'Requiere ventana de tiempo' },
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
    const fillRate = (() => {
      const entregadas = ordenes.filter(o => o.estadoPedido === 'entregado').length;
      const total = ordenes.length;
      return total === 0 ? 'N/D' : `${Math.min(100, Math.round((entregadas / total) * 100))}%`;
    })();

    const backorder = (() => {
      const pendientes = ordenes.filter(o => o.estadoPedido !== 'entregado').length;
      const total = ordenes.length;
      return total === 0 ? 'N/D' : `${Math.round((pendientes / total) * 100)}%`;
    })();

    return [
      { nombre: 'Fill rate', valor: fillRate, detalle: 'Órdenes completas' },
      { nombre: 'Backorder', valor: backorder, detalle: 'Órdenes con faltantes' },
      { nombre: 'Utilidad bruta', valor: currency(resumenFinanzas.utilidad), detalle: 'Periodo seleccionado' },
      { nombre: 'Rotación inventario', valor: `${rotacionInventario[0]?.rotacionMes?.toFixed?.(1) || '0'}x`, detalle: 'Mejor categoría' },
      { nombre: 'CAC', valor: '$N/D', detalle: 'Agregar fuente de marketing' },
    ];
  }, [ordenes, resumenFinanzas.utilidad, rotacionInventario]);

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

  const showFinanzas = vistaActiva === 'general' || vistaActiva === 'finanzas';
  const showOperaciones = vistaActiva === 'general' || vistaActiva === 'operaciones';
  const showClientes = vistaActiva === 'general' || vistaActiva === 'clientes';

  return (
    <div className="space-y-10">
      {loading && (
        <div className="p-3 text-sm text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg">
          Cargando datos en vivo...
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Reportes y Analítica</h1>
          <p className="text-sm text-gray-500">Panel integral para finanzas, operaciones y clientes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-sm rounded-lg shadow-sm hover:border-blue-400"
          >
            <DocumentArrowDownIcon className="w-5 h-5 text-blue-600" />
            CSV
          </button>
          <button
            onClick={() => handleExport('xml')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-sm rounded-lg shadow-sm hover:border-blue-400"
          >
            <CloudArrowDownIcon className="w-5 h-5 text-amber-600" />
            XML
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-white border border-gray-200 shadow-sm rounded-xl p-4">
        <div className="flex flex-wrap gap-2">
          {timePresets.map((preset) => (
            <button
              key={preset.key}
              onClick={() => setSelectedRange(preset.key)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                preset.key === selectedRange ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-700 hover:border-blue-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-gray-500 uppercase">Base contable</span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setBaseContable('caja')}
              className={`px-3 py-1.5 text-sm ${baseContable === 'caja' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              Percibida
            </button>
            <button
              onClick={() => setBaseContable('devengado')}
              className={`px-3 py-1.5 text-sm ${baseContable === 'devengado' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              Devengada
            </button>
          </div>
        </div>
      </div>

      {selectedRange === 'custom' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white border border-gray-200 shadow-sm rounded-xl p-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Desde</label>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Hasta</label>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div className="flex items-end">
            <button onClick={exportLegacyCsv} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-sm rounded-lg shadow-sm hover:border-blue-400">
              <DocumentArrowDownIcon className="w-5 h-5 text-blue-600" />
              Exportar CSV (formato anterior)
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {viewTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setVistaActiva(tab.key)}
            className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
              tab.key === vistaActiva ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {showFinanzas && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <ChartBarIcon className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Finanzas</h2>
              <p className="text-sm text-gray-500">Ingresos, gastos, utilidad y margen según base contable.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Ingresos</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{currency(resumenFinanzas.ingresos)}</p>
                  <p className="text-xs text-gray-500">{etiquetaSeleccionada}</p>
                </div>
                <CurrencyDollarIcon className="w-10 h-10 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Gastos</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{currency(resumenFinanzas.gastos)}</p>
                  <p className="text-xs text-gray-500">Operativos + insumos</p>
                </div>
                <ArrowsRightLeftIcon className="w-10 h-10 text-amber-600" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Utilidad</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{currency(resumenFinanzas.utilidad)}</p>
                  <p className="text-xs text-gray-500">Base {baseContable === 'caja' ? 'percibida' : 'devengada'}</p>
                </div>
                <SparklesIcon className="w-10 h-10 text-blue-600" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Margen</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{resumenFinanzas.margen.toFixed(1)}%</p>
                  <p className="text-xs text-gray-500">Periodo: {etiquetaSeleccionada}</p>
                </div>
                <ArrowTrendingUpIcon className="w-10 h-10 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Ventas del periodo</p>
                  <p className="text-sm text-gray-600">Ingreso, gasto y utilidad por rango</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <ShieldCheckIcon className="w-5 h-5 text-blue-600" />
                  Base {baseContable === 'caja' ? 'percibida (caja)' : 'devengada (entregas)'}
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-gray-100">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
                    <tr>
                      <th className="px-4 py-3">Periodo</th>
                      <th className="px-4 py-3">Ingresos</th>
                      <th className="px-4 py-3">Gastos</th>
                      <th className="px-4 py-3">Utilidad</th>
                      <th className="px-4 py-3">Margen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ventasTabla.map((periodo) => {
                      const ingresos = periodo.ingresos;
                      const gastos = periodo.gastos;
                      const utilidad = periodo.utilidad;
                      const margen = periodo.margen;
                      return (
                        <tr key={periodo.key} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{periodo.etiqueta}</td>
                          <td className="px-4 py-3 text-gray-800">{currency(ingresos)}</td>
                          <td className="px-4 py-3 text-gray-800">{currency(gastos)}</td>
                          <td className="px-4 py-3 text-gray-800">{currency(utilidad)}</td>
                          <td className="px-4 py-3 text-gray-600">{margen.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Utilidad semanal</p>
                  <p className="text-sm text-gray-600">Comparativo de las últimas 5 semanas</p>
                </div>
              </div>
              <div className="h-48 flex items-end gap-2">
                {utilidadSemanal.map((week) => {
                  const barHeight = (week.utilidad / utilidadMax) * 100;
                  return (
                    <div key={week.label} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className="w-full bg-blue-50 rounded-md border border-blue-100 flex items-end justify-center"
                        style={{ height: '100%' }}
                      >
                        <div
                          className="w-9/12 bg-blue-600 rounded-md"
                          style={{ height: `${barHeight}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-gray-500 text-center leading-tight">{week.label}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-xs text-gray-600 flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                Máximo reciente: {currency(utilidadMax)}
              </div>
            </div>
          </div>
        </section>
      )}

      {showOperaciones && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <Squares2X2Icon className="w-6 h-6 text-amber-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Operaciones y Supply Chain</h2>
              <p className="text-sm text-gray-500">Compras pendientes, rotación e incidencias de devolución.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Compras pendientes</p>
                  <p className="text-sm text-gray-600">Seguimiento por proveedor</p>
                </div>
                <ShoppingCartIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="space-y-3">
                {comprasPendientes.map((compra) => (
                  <div key={compra.folio} className="p-3 rounded-lg border border-gray-100 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">{compra.proveedor}</p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          compra.prioridad === 'Alta'
                            ? 'bg-red-50 text-red-700'
                            : compra.prioridad === 'Media'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-green-50 text-green-700'
                        }`}
                      >
                        {compra.prioridad}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 mt-1">
                      <span>Folio {compra.folio}</span>
                      <span>{currency(compra.monto)}</span>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">ETA {compra.eta}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Rotación de inventario</p>
                  <p className="text-sm text-gray-600">Días de inventario y rotación mensual</p>
                </div>
                <ShoppingBagIcon className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="space-y-3">
                {rotacionInventario.map((linea) => (
                  <div key={linea.categoria} className="flex items-start justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{linea.categoria}</p>
                      <p className="text-xs text-gray-600">{linea.diasInventario} días inventario</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{linea.rotacionMes.toFixed(1)}x</p>
                      <div className="flex items-center justify-end gap-1 text-xs text-gray-600">
                        {linea.tendencia === 'up' && <ArrowTrendingUpIcon className="w-4 h-4 text-emerald-600" />}
                        {linea.tendencia === 'down' && <ArrowTrendingDownIcon className="w-4 h-4 text-red-600" />}
                        {linea.tendencia === 'flat' && <ArrowRightIcon className="w-4 h-4 text-gray-500" />}
                        <span>{linea.tendencia === 'flat' ? 'estable' : 'tendencia'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Devoluciones</p>
                  <p className="text-sm text-gray-600">Tasa y causas principales</p>
                </div>
                <ArrowPathIcon className="w-6 h-6 text-amber-600" />
              </div>
              <div className="mb-4">
                <p className="text-3xl font-bold text-gray-900">{(devolucionesResumen.tasa * 100).toFixed(1)}%</p>
                <p className="text-sm text-gray-500">Sobre órdenes entregadas</p>
              </div>
              <div className="space-y-2">
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

      {showClientes && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <UsersIcon className="w-6 h-6 text-purple-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Clientes y Crecimiento</h2>
              <p className="text-sm text-gray-500">Tasa de recompra, ticket y churn.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {clientesKpis.map((kpi) => (
              <div key={kpi.titulo} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase">{kpi.titulo}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.valor}</p>
                <p className="text-xs text-green-600 mt-1">{kpi.delta}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Cohortes</p>
                <p className="text-sm text-gray-600">Recompra, frecuencia y valor de vida</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 uppercase font-semibold">Recompra</p>
                <p className="text-lg font-bold text-gray-900">38%</p>
                <p className="text-xs text-gray-600">Clientes que realizaron 2+ compras en 60 días</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 uppercase font-semibold">Frecuencia</p>
                <p className="text-lg font-bold text-gray-900">1.8 pedidos / mes</p>
                <p className="text-xs text-gray-600">Promedio clientes activos</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 uppercase font-semibold">LTV estimado</p>
                <p className="text-lg font-bold text-gray-900">$7,450</p>
                <p className="text-xs text-gray-600">Ticket x frecuencia x permanencia</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Tabla filtrable estilo legado */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <Squares2X2Icon className="w-6 h-6 text-gray-700" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Tabla de Órdenes </h2>
            <p className="text-sm text-gray-500">Filtra y exporta con las columnas del CSV</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={exportLegacyCsv} className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-sm rounded-lg shadow-sm hover:border-blue-400">
              <DocumentArrowDownIcon className="w-5 h-5 text-blue-600" />
              CSV legado
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-sm p-4">
          <p className="text-xs font-semibold text-blue-700 uppercase mb-3">Totales de Datos Filtrados</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <p className="text-xs text-gray-500 font-semibold uppercase">Precio Público Total</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{currency(tableTotales.totalPrecio)}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <p className="text-xs text-gray-500 font-semibold uppercase">Costo Total</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{currency(tableTotales.totalCosto)}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <p className="text-xs text-gray-500 font-semibold uppercase">Utilidad Bruta</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{currency(tableTotales.utilidadBruta)}</p>
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

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <SparklesIcon className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">KPIs críticos</h2>
            <p className="text-sm text-gray-500">Monitoreo rápido de desempeño integral.</p>
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
    </div>
  );
};

export default Reportes;
