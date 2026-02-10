import React, { useEffect, useState, useMemo, useRef } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../credenciales';
import showToast from '../utils/toast';
import { actualizarPerfilCliente } from '../utils/actualizarPerfil';
import ResumenOrden from './ResumenOrden';
import {
  MagnifyingGlassIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { esEntregaPersonal } from '../utils/zonas';

interface Orden {
  id: string;
  cliente: { nombre: string; uid?: string } | string;
  totalVenta: number;
  estadoPedido: string;
  fechaCreacion?: string;
  fechaEntrega?: string | null;
  fechaEnvio?: string | null;
  entrega: string;
  lugar?: string;
  items: any[];
  timestamp?: any;
  descuentoPorcentaje?: number;
  descuentoMonto?: number;
}

interface EstadoEntrega {
  estado: 'pendiente' | 'enviado' | 'entregado';
  fechaEnvio?: string;
  fechaEntrega?: string;
}

const Entregas: React.FC = () => {
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'ALL' | 'pendiente' | 'enviado' | 'entregado'>('ALL');
  const [filtroTipo, setFiltroTipo] = useState<'ALL' | 'personal' | 'paqueteria'>('ALL');
  const [filtroZona, setFiltroZona] = useState<string>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalResumenOpen, setModalResumenOpen] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<Orden | null>(null);
  const [estadoEntrega, setEstadoEntrega] = useState<EstadoEntrega>({
    estado: 'pendiente',
  });
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [headerTop, setHeaderTop] = useState<number>(0);
  const [appHeaderHeight, setAppHeaderHeight] = useState<number>(0);

  // Cargar órdenes
  useEffect(() => {
    const fetchOrdenes = async () => {
      try {
        const ordenesRef = collection(db, 'ordenes');
        const q = query(ordenesRef, orderBy('fechaCreacion', 'desc'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Orden[];
        // Filtrar solo órdenes con entrega (no son "Punto de venta" o si tienen zona)
        const ordenesConEntrega = data.filter(o => o.entrega === 'Envio' || o.lugar);
        setOrdenes(ordenesConEntrega);
      } catch (error) {
        console.error('Error cargando órdenes:', error);
        showToast('Error cargando entregas', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchOrdenes();
  }, []);

  // La función esEntregaPersonal se importa de utils/zonas.ts

  // Obtener todas las zonas únicas para el filtro
  const zonasDisponibles = useMemo(() => {
    const zonas = new Set<string>();
    ordenes.forEach(o => {
      if (o.lugar) zonas.add(o.lugar);
    });
    return Array.from(zonas).sort();
  }, [ordenes]);

  // Filtrar órdenes
  const ordenesFiltradas = useMemo(() => {
    return ordenes.filter(o => {
      const clienteNombre = typeof o.cliente === 'string' ? o.cliente : o.cliente?.nombre || '';
      const matchSearch =
        clienteNombre.toLowerCase().includes(search.toLowerCase()) ||
        (o.id || '').toLowerCase().includes(search.toLowerCase());

      const esPersonal = esEntregaPersonal(o.lugar);
      const matchTipo =
        filtroTipo === 'ALL' ||
        (filtroTipo === 'personal' && esPersonal) ||
        (filtroTipo === 'paqueteria' && !esPersonal);

      const matchZona = filtroZona === 'ALL' || o.lugar === filtroZona;

      const matchEstado =
        filtroEstado === 'ALL' ||
        (filtroEstado === 'pendiente' && (!o.estadoPedido || o.estadoPedido === 'pendiente')) ||
        (filtroEstado === 'enviado' && o.estadoPedido === 'enviado') ||
        (filtroEstado === 'entregado' && o.estadoPedido === 'entregado');

      return matchSearch && matchTipo && matchZona && matchEstado;
    });
  }, [ordenes, search, filtroTipo, filtroZona, filtroEstado]);

  // Sincronizar barra de scroll superior con la tabla (mostrar scrollbar en el header)
  const SCROLLBAR_HEIGHT = 16; // altura fija del scrollbar superior
  useEffect(() => {
    const top = topScrollRef.current;
    const wrapper = tableWrapperRef.current;
    const table = tableRef.current;
    if (!top || !wrapper || !table) return;

    const setTopWidth = () => {
      const inner = top.firstElementChild as HTMLElement | null;
      if (inner) inner.style.width = `${table.scrollWidth}px`;
      const headerEl = document.querySelector('header') as HTMLElement | null;
      const appH = headerEl ? headerEl.clientHeight : 0;
      setAppHeaderHeight(appH);
      // headers sticky solo con altura del scrollbar (no incluir appHeaderHeight)
      setHeaderTop(SCROLLBAR_HEIGHT);
    };

    setTopWidth();

    const onTopScroll = () => { if (wrapper) wrapper.scrollLeft = top.scrollLeft; };
    const onWrapperScroll = () => { if (top) top.scrollLeft = wrapper.scrollLeft; };

    top.addEventListener('scroll', onTopScroll);
    wrapper.addEventListener('scroll', onWrapperScroll);
    window.addEventListener('resize', setTopWidth);

    let ro: ResizeObserver | null = null;
    if ((window as any).ResizeObserver) {
      ro = new ResizeObserver(() => setTopWidth());
      ro.observe(table);
    }

    return () => {
      top.removeEventListener('scroll', onTopScroll);
      wrapper.removeEventListener('scroll', onWrapperScroll);
      window.removeEventListener('resize', setTopWidth);
      if (ro) ro.disconnect();
    };
  }, [loading, ordenes.length]);

  // Abrir modal para cambiar estado o ver resumen
  const handleAbrirModal = (orden: Orden, verResumen: boolean = false) => {
    setOrdenSeleccionada(orden);
    if (verResumen) {
      setModalResumenOpen(true);
    } else {
      setEstadoEntrega({
        estado: (orden.estadoPedido as 'pendiente' | 'enviado' | 'entregado') || 'pendiente',
        fechaEnvio: orden.fechaEnvio || '',
        fechaEntrega: orden.fechaEntrega || '',
      });
      setModalOpen(true);
    }
  };

  // Guardar cambio de estado + Actualizar perfil si es entregado
  const handleGuardarEstado = async () => {
    if (!ordenSeleccionada) return;

    const esPersonal = esEntregaPersonal(ordenSeleccionada.lugar);

    // Validaciones
    if (estadoEntrega.estado === 'enviado' && !estadoEntrega.fechaEnvio) {
      return showToast('Ingresa la fecha de envío', 'error');
    }
    if (estadoEntrega.estado === 'entregado') {
      if (!estadoEntrega.fechaEntrega) {
        return showToast('Ingresa la fecha de entrega', 'error');
      }
      if (!esPersonal && !estadoEntrega.fechaEnvio) {
        return showToast('Ingresa la fecha de envío (paquetería)', 'error');
      }
    }

    try {
      const ordenRef = doc(db, 'ordenes', ordenSeleccionada.id);
      const updateData: any = {
        estadoPedido: estadoEntrega.estado,
      };

      // Si es personal, al marcar entregado, la fecha de envío es la de entrega
      if (esPersonal && estadoEntrega.estado === 'entregado') {
        updateData.fechaEnvio = estadoEntrega.fechaEntrega;
        updateData.fechaEntrega = estadoEntrega.fechaEntrega;
      } else {
        if (estadoEntrega.fechaEnvio) updateData.fechaEnvio = estadoEntrega.fechaEnvio;
        if (estadoEntrega.fechaEntrega) updateData.fechaEntrega = estadoEntrega.fechaEntrega;
      }

      await updateDoc(ordenRef, updateData);

      // Actualizar en estado local
      setOrdenes(prev =>
        prev.map(o =>
          o.id === ordenSeleccionada.id
            ? {
                ...o,
                estadoPedido: estadoEntrega.estado,
                fechaEnvio: updateData.fechaEnvio,
                fechaEntrega: updateData.fechaEntrega,
              }
            : o
        )
      );

      // ===== ACTUALIZAR PERFIL DEL CLIENTE SI ES ENTREGADO =====
      if (estadoEntrega.estado === 'entregado') {
        const clienteNombre = typeof ordenSeleccionada.cliente === 'string' 
          ? ordenSeleccionada.cliente 
          : ordenSeleccionada.cliente?.nombre;

        if (clienteNombre) {
          try {
            console.log(`\n📊 Marcando orden como entregada, actualizando perfil de ${clienteNombre}...`);
            const resultado = await actualizarPerfilCliente(clienteNombre);
            
            if (resultado.success) {
              showToast(resultado.mensaje, 'success');
            } else {
              showToast(`⚠️ ${resultado.mensaje}`, 'info');
            }
          } catch (error) {
            console.error('Error actualizando perfil:', error);
            showToast('⚠️ Error al actualizar perfil del cliente', 'info');
          }
        }
      }

      showToast('Estado actualizado correctamente', 'success');
      setModalOpen(false);
    } catch (error) {
      console.error('Error actualizando estado:', error);
      showToast('Error al actualizar', 'error');
    }
  };

  // Badge de estado
  const getEstadoBadge = (estado?: string) => {
    const est = estado || 'pendiente';
    if (est === 'entregado') {
      return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Entregado</span>;
    } else if (est === 'enviado') {
      return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Enviado</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">Pendiente</span>;
  };

  const getTipoBadge = (lugar?: string) => {
    const esPersonal = esEntregaPersonal(lugar);
    return esPersonal ? (
      <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
        Personal
      </span>
    ) : (
      <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
        Paquetería
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <TruckIcon className="h-6 w-6" />
            Entregas y Envíos ({ordenesFiltradas.length})
          </h1>
          <p className="text-sm text-gray-500 mt-1">Gestiona el estado de entregas y envíos</p>
        </div>
      </div>

      {/* Panel de Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-4">
        {/* Buscador */}
        <div className="relative">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por cliente o ID..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 border-t border-gray-100 pt-3">
          {/* Estado */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Estado</label>
            <select
              className="w-full text-sm border-gray-300 rounded-lg p-2 bg-white border"
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value as any)}
            >
              <option value="ALL">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="enviado">Enviado</option>
              <option value="entregado">Entregado</option>
            </select>
          </div>

          {/* Tipo de Entrega */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Tipo</label>
            <select
              className="w-full text-sm border-gray-300 rounded-lg p-2 bg-white border"
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value as any)}
            >
              <option value="ALL">Todos</option>
              <option value="personal">Personal</option>
              <option value="paqueteria">Paquetería</option>
            </select>
          </div>

          {/* Zona */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Zona</label>
            <select
              className="w-full text-sm border-gray-300 rounded-lg p-2 bg-white border"
              value={filtroZona}
              onChange={e => setFiltroZona(e.target.value)}
            >
              <option value="ALL">Todas</option>
              {zonasDisponibles.map(zona => (
                <option key={zona} value={zona}>
                  {zona}
                </option>
              ))}
            </select>
          </div>

          {/* Mostrar Histórico */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Información</label>
            <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
              Mostrando: {ordenesFiltradas.length} entregas
            </div>
          </div>
        </div>
      </div>

      {/* Tabla/Cards */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-10 text-gray-500">Cargando entregas...</div>
        ) : ordenesFiltradas.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">
            No hay entregas con los filtros aplicados.
          </div>
        ) : (
          <>
            {/* Vista Móvil */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {ordenesFiltradas.map(orden => {
                const clienteNombre = typeof orden.cliente === 'string' ? orden.cliente : orden.cliente?.nombre;
                const itemCount = (orden.items || []).length;
                const itemNames = (orden.items || []).map((it: any) => it?.nombre).filter(Boolean);
                const uniqueNames = Array.from(new Set(itemNames));
                const maxNames = 4;
                const namesShown = uniqueNames.slice(0, maxNames);
                const remaining = Math.max(0, uniqueNames.length - namesShown.length);
                return (
                  <div key={orden.id} className="bg-white p-4 rounded-lg shadow border border-gray-100">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-gray-900">{clienteNombre}</h3>
                          <p className="text-xs text-gray-500">ID: {orden.id.slice(0, 8)}</p>
                        </div>
                        <div className="text-right">{getEstadoBadge(orden.estadoPedido)}</div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {getTipoBadge(orden.lugar)}
                        {orden.lugar && (
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                            {orden.lugar}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-600 space-y-1">
                        <p>Ítems: {itemCount}</p>
                        <p className="truncate">Prendas: {namesShown.join(', ')}{remaining > 0 ? ` (+${remaining} más)` : ''}</p>
                        <p>Total: ${orden.totalVenta}</p>
                      </div>

                      {orden.estadoPedido === 'enviado' && orden.fechaEnvio && (
                        <p className="text-xs text-blue-600">Enviado: {orden.fechaEnvio}</p>
                      )}
                      {orden.estadoPedido === 'entregado' && orden.fechaEntrega && (
                        <p className="text-xs text-green-600">Entregado: {orden.fechaEntrega}</p>
                      )}

                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleAbrirModal(orden, true)}
                          className="flex-1 py-2 bg-gray-600 text-white text-sm rounded font-medium hover:bg-gray-700"
                        >
                          Ver contenido
                        </button>
                        <button
                          onClick={() => handleAbrirModal(orden, false)}
                          className="flex-1 py-2 bg-blue-600 text-white text-sm rounded font-medium hover:bg-blue-700"
                        >
                          {orden.estadoPedido === 'entregado' ? 'Ver detalles' : 'Actualizar estado'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vista Escritorio */}
            <div className="hidden md:block">
                <div
                  ref={topScrollRef}
                  className="w-full overflow-x-auto sticky z-20 bg-white"
                  style={{ overflowY: 'hidden', top: appHeaderHeight, height: '16px' }}
                >
                  <div style={{ height: '16px' }} />
                </div>

                <div ref={tableWrapperRef} className="bg-white rounded-lg shadow-sm overflow-x-auto border border-gray-200">
                  <table ref={tableRef} className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 relative z-30">
                  <tr>
                      <th style={{ top: headerTop }} className="sticky px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-gray-50">Cliente</th>
                      <th style={{ top: headerTop }} className="sticky px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-gray-50">Tipo</th>
                      <th style={{ top: headerTop }} className="sticky px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-gray-50">Zona</th>
                      <th style={{ top: headerTop }} className="sticky px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-gray-50">Ítems</th>
                      <th style={{ top: headerTop }} className="sticky px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-gray-50">Total</th>
                      <th style={{ top: headerTop }} className="sticky px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-gray-50">Estado</th>
                      <th style={{ top: headerTop }} className="sticky px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-gray-50">Fechas</th>
                      <th style={{ top: headerTop }} className="sticky px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-gray-50">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ordenesFiltradas.map(orden => {
                    const clienteNombre = typeof orden.cliente === 'string' ? orden.cliente : orden.cliente?.nombre;
                    const esPersonal = esEntregaPersonal(orden.lugar);
                    const itemCount = (orden.items || []).length;
                    const itemNames = (orden.items || []).map((it: any) => it?.nombre).filter(Boolean);
                    const uniqueNames = Array.from(new Set(itemNames));
                    const maxNames = 3;
                    const namesShown = uniqueNames.slice(0, maxNames);
                    const remaining = Math.max(0, uniqueNames.length - namesShown.length);
                    return (
                      <tr key={orden.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{clienteNombre}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{getTipoBadge(orden.lugar)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {orden.lugar || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <div>{itemCount}</div>
                          <div className="text-xs text-gray-500 max-w-[220px] truncate">{namesShown.join(', ')}{remaining > 0 ? ` (+${remaining})` : ''}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ${orden.totalVenta}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{getEstadoBadge(orden.estadoPedido)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {orden.estadoPedido === 'enviado' && orden.fechaEnvio && (
                            <p className="text-blue-600 text-xs">Env: {orden.fechaEnvio}</p>
                          )}
                          {orden.estadoPedido === 'entregado' && orden.fechaEntrega && (
                            <p className="text-green-600 text-xs">Ent: {orden.fechaEntrega}</p>
                          )}
                          {orden.estadoPedido === 'entregado' && orden.fechaEnvio && esPersonal && (
                            <p className="text-xs text-gray-500">(mismo día)</p>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => handleAbrirModal(orden, true)}
                              className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                            >
                              Contenido
                            </button>
                            <button
                              onClick={() => handleAbrirModal(orden, false)}
                              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                            >
                              {orden.estadoPedido === 'entregado' ? 'Ver' : 'Actualizar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}
      </div>

      {/* Componente de Resumen de Orden */}
      <ResumenOrden
        isOpen={modalResumenOpen}
        orden={ordenSeleccionada}
        onClose={() => setModalResumenOpen(false)}
        esEntregaPersonal={esEntregaPersonal}
      />

      {/* Modal de Cambio de Estado */}
      {modalOpen && ordenSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full space-y-4 p-6">
            <h2 className="text-lg font-bold text-gray-900">
              Actualizar Estado de Entrega
            </h2>

            <div className="space-y-3">
              {/* Cliente */}
              <div>
                <label className="text-xs font-medium text-gray-600">Cliente</label>
                <p className="text-sm text-gray-900 font-medium">
                  {typeof ordenSeleccionada.cliente === 'string'
                    ? ordenSeleccionada.cliente
                    : ordenSeleccionada.cliente?.nombre}
                </p>
              </div>

              {/* Tipo de Entrega */}
              <div>
                <label className="text-xs font-medium text-gray-600">Tipo de Entrega</label>
                <p className="text-sm text-gray-900">
                  {esEntregaPersonal(ordenSeleccionada.lugar) ? 'Personal' : 'Paquetería'}
                </p>
              </div>

              {/* Estado */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Estado</label>
                <div className="flex gap-2">
                  {['pendiente', 'enviado', 'entregado'].map(est => (
                    <button
                      key={est}
                      onClick={() => setEstadoEntrega(prev => ({ ...prev, estado: est as any }))}
                      className={`px-3 py-2 text-xs rounded font-medium transition ${
                        estadoEntrega.estado === est
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {est.charAt(0).toUpperCase() + est.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fecha de Envío */}
              {estadoEntrega.estado !== 'pendiente' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Fecha de Envío
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                    value={estadoEntrega.fechaEnvio || ''}
                    onChange={e => setEstadoEntrega(prev => ({ ...prev, fechaEnvio: e.target.value }))}
                  />
                </div>
              )}

              {/* Fecha de Entrega */}
              {estadoEntrega.estado === 'entregado' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Fecha de Entrega
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                    value={estadoEntrega.fechaEntrega || ''}
                    onChange={e => setEstadoEntrega(prev => ({ ...prev, fechaEntrega: e.target.value }))}
                  />
                  {esEntregaPersonal(ordenSeleccionada.lugar) && (
                    <p className="text-xs text-gray-500 mt-1">
                      (Se usará la misma fecha para envío y entrega)
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-2 pt-4 border-t border-gray-200">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded font-medium hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarEstado}
                disabled={estadoEntrega.estado === 'pendiente'}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Entregas;
