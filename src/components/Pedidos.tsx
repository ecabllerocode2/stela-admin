import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Select, { type StylesConfig } from 'react-select';
import ImageZoomModal from './ImageZoomModal';
import ResumenOrden from './ResumenOrden';
import showToast from '../utils/toast';
import { esEntregaPersonal } from '../utils/zonas';
import { doc, deleteDoc } from 'firebase/firestore';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../credenciales'; // Tu archivo de configuración
import { 
  PlusIcon, 
  CalendarIcon, 
  UserIcon, 
  TagIcon, 
  UserCircleIcon, 
  AdjustmentsHorizontalIcon, 
  MagnifyingGlassIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';

// Interfaz basada en tu captura de Firestore
interface Orden {
  id: string;
  cliente: { nombre: string; uid?: string } | string;
  totalVenta: number;
  estadoPedido: string;
  fechaEntrega?: string | null;
  fechaCreacion?: string;
  items: any[];
  descuentoPorcentaje?: number;
  descuentoMonto?: number;
  entrega?: string;
  lugar?: string;
  notas?: string;
}

const estados = [
  { value: 'ALL', label: 'Todos' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'entregado', label: 'Entregado' },
];

interface OptionType {
  value: string;
  label: string;
}

const customStyles: StylesConfig<OptionType, false> = {
  control: (provided, state) => ({
    ...provided,
    backgroundColor: '#fff',
    borderColor: state.isFocused ? '#3b82f6' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
    '&:hover': {
      borderColor: state.isFocused ? '#3b82f6' : '#9ca3af',
    },
    minHeight: '42px',
    borderRadius: '6px',
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isSelected ? '#bfdbfe' : state.isFocused ? '#f3f4f6' : '#fff',
    color: state.isSelected ? '#1e40af' : '#1f2937',
    cursor: 'pointer',
    fontSize: '0.9rem',
  }),
  placeholder: (provided) => ({
    ...provided,
    color: '#9ca3af',
  }),
};

const Pedidos: React.FC = () => {
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<OptionType>(estados[0]);
  const [filtroPrenda, setFiltroPrenda] = useState<OptionType | null>(null);
  const [filtroCliente, setFiltroCliente] = useState<OptionType | null>(null);
  const [resumenModalOpen, setResumenModalOpen] = useState(false);
  const [selectedOrdenForResumen, setSelectedOrdenForResumen] = useState<Orden | null>(null);

  // Opciones dinámicas para selects
  const prendaOptions = useMemo(() => {
    const set = new Set<string>();
    ordenes.forEach(o => {
      (o.items || []).forEach(item => item.nombre && set.add(item.nombre));
    });
    return Array.from(set).map(v => ({ value: v, label: v }));
  }, [ordenes]);

  const clienteOptions = useMemo(() => {
    const set = new Set<string>();
    ordenes.forEach(o => {
      const nombre = typeof o.cliente === 'string' ? o.cliente : o.cliente?.nombre;
      if (nombre) set.add(nombre);
    });
    return Array.from(set).map(v => ({ value: v, label: v }));
  }, [ordenes]);

  const [zoomedImage, setZoomedImage] = useState<string|null>(null);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);

  // Eliminar orden
  const handleEliminarOrden = async (id: string, nombreCliente: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la orden de ${nombreCliente}? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteDoc(doc(db, 'ordenes', id));
      setOrdenes(prev => prev.filter(o => o.id !== id));
      showToast('Orden eliminada correctamente', 'success');
    } catch (err) {
      showToast('Error al eliminar orden', 'error');
    }
  };

  const handleAbrirResumen = (orden: Orden) => {
    setSelectedOrdenForResumen(orden);
    setResumenModalOpen(true);
  };

  const navigate = useNavigate();
  // Función para manejar la creación: navegar a la ruta de nuevo pedido
  const handleNuevoPedido = () => {
    navigate('/nuevo-pedido');
  };

  useEffect(() => {
    const fetchOrdenes = async () => {
      try {
        // Consultamos la colección "ordenes"
        const ordenesRef = collection(db, 'ordenes');
        // Ordenamos por fecha de creación (si existe)
        const q = query(ordenesRef, orderBy('fechaCreacion', 'desc'));
        const querySnapshot = await getDocs(q);

        const ordenesData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Orden[];

        setOrdenes(ordenesData);
      } catch (error) {
        console.error("Error obteniendo ordenes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrdenes();
  }, []);

  // Sincronizar barra de scroll superior con la tabla (mostrar scrollbar en el header)
  useEffect(() => {
    const top = topScrollRef.current;
    const wrapper = tableWrapperRef.current;
    const table = tableRef.current;
    if (!top || !wrapper || !table) return;

    const setTopWidth = () => {
      const inner = top.firstElementChild as HTMLElement | null;
      if (inner) inner.style.width = `${table.scrollWidth}px`;
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

  // Helper para el estado visual (Badge)
  const getStatusBadge = (orden: Orden) => {
    const estado = orden.estadoPedido || '';
    if (estado === 'entregado') {
      return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Entregado</span>;
    } else if (estado === 'enviado') {
      return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Enviado</span>;
    } else {
      return <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">Pendiente</span>;
    }
  };

  // Filtro y búsqueda (ignora acentos y mayúsculas)
  const normalize = (str: string) => (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const ordenesFiltradas = ordenes.filter(o => {
    const clienteNombre = typeof o.cliente === 'string' ? o.cliente : o.cliente?.nombre || '';
    const itemsText = (o.items || []).map(i => i.nombre || '').join(' ');
    const matchSearch =
      normalize(clienteNombre).includes(normalize(search)) ||
      normalize(itemsText).includes(normalize(search)) ||
      normalize(o.id || '').includes(normalize(search));

    const matchEstado =
      filtroEstado.value === 'ALL' ||
      (filtroEstado.value === 'pendiente' && (o.estadoPedido === 'pendiente' || !o.estadoPedido)) ||
      (filtroEstado.value === 'enviado' && o.estadoPedido === 'enviado') ||
      (filtroEstado.value === 'entregado' && o.estadoPedido === 'entregado');

    const matchPrenda = !filtroPrenda || (o.items || []).some(it => it.nombre === filtroPrenda.value);
    const matchCliente = !filtroCliente || clienteNombre === filtroCliente.value;
    return matchSearch && matchEstado && matchPrenda && matchCliente;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 space-y-6">
      
      {/* --- ENCABEZADO Y ACCIONES (Estilo consistente con Productos) --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Órdenes ({ordenesFiltradas.length}/{ordenes.length})</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de encargos y ventas</p>
        </div>
        
        <button
          onClick={handleNuevoPedido}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          <span className="hidden sm:inline">Nuevo Pedido</span>
          <span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      {/* --- PANEL DE FILTROS ACTUALIZADO --- */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-4">
        {/* Buscador Principal */}
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente o prenda..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Grid de Selectores */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-gray-100 pt-3">
          
          {/* Estado */}
          <div>
            <label className='text-xs font-medium text-gray-500 flex items-center mb-1'>
              <AdjustmentsHorizontalIcon className='h-4 w-4 mr-1' /> Estado
            </label>
            <Select<OptionType, false>
              options={estados}
              value={filtroEstado}
              onChange={v => v && setFiltroEstado(v)}
              styles={customStyles}
              className="text-sm"
              classNamePrefix="pedido-select"
              placeholder="Estado"
            />
          </div>

          {/* Prenda */}
          <div>
            <label className='text-xs font-medium text-gray-500 flex items-center mb-1'>
              <TagIcon className='h-4 w-4 mr-1' /> Prenda
            </label>
            <Select<OptionType, false>
              options={prendaOptions}
              value={filtroPrenda}
              onChange={v => setFiltroPrenda(v)}
              isClearable
              isSearchable
              styles={customStyles}
              placeholder="Todas las prendas"
              className="text-sm"
              classNamePrefix="pedido-select"
            />
          </div>

          {/* Cliente */}
          <div>
            <label className='text-xs font-medium text-gray-500 flex items-center mb-1'>
              <UserCircleIcon className='h-4 w-4 mr-1' /> Cliente
            </label>
            <Select<OptionType, false>
              options={clienteOptions}
              value={filtroCliente}
              onChange={v => setFiltroCliente(v)}
              isClearable
              isSearchable
              styles={customStyles}
              placeholder="Todos los clientes"
              className="text-sm"
              classNamePrefix="pedido-select"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-10 text-gray-500">Cargando pedidos...</div>
        ) : (
          <>
            {/* --- VISTA MÓVIL (Cards Mejoradas) ---  */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {ordenesFiltradas.map((orden) => {
                const firstItem = (orden.items && orden.items[0]) || {};
                const foto = firstItem.foto || null;
                const productoNombre = firstItem.nombre || `Orden ${orden.id}`;
                const tallaColor = `${firstItem.talla || ''}${firstItem.talla && firstItem.color ? ' - ' : ''}${firstItem.color || ''}`;
                const clienteNombre = typeof orden.cliente === 'string' ? orden.cliente : orden.cliente?.nombre;
                const totalItems = (orden.items || []).length;
                const itemNames = (orden.items || []).map(item => item.nombre).filter(Boolean);
                return (
                <div key={orden.id} className="bg-white p-4 rounded-xl shadow border border-gray-100 flex flex-col gap-2">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="h-12 w-12 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer"
                        onClick={() => foto && setZoomedImage(foto)}
                      >
                        {foto ? (
                          <img crossOrigin="anonymous" referrerPolicy="no-referrer" src={foto} alt={productoNombre} className="h-full w-full object-cover" />
                        ) : (
                          <UserIcon className="h-7 w-7 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {totalItems === 1 ? (
                          <>
                            <div className="font-semibold text-gray-900 text-base leading-tight">{productoNombre}</div>
                            <div className="text-xs text-gray-500">{tallaColor}</div>
                          </>
                        ) : (
                          <div className="text-xs space-y-0.5 max-h-12 overflow-hidden">
                            {itemNames.map((name, idx) => (
                              <div key={idx} className="text-gray-700 line-clamp-1">{name}</div>
                            ))}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-0.5">Cliente: <span className="font-medium text-gray-700">{clienteNombre}</span></div>
                      </div>
                    </div>
                    <div className="ml-2 flex-shrink-0">{getStatusBadge(orden)}</div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="h-4 w-4" />
                      <span>{orden.fechaEntrega || orden.fechaCreacion || '-'}</span>
                    </div>
                    <div className="font-bold text-blue-700 text-base">${orden.totalVenta}</div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => navigate(`/ordenes/editar/${orden.id}`)} className="flex-1 py-2 rounded-md bg-blue-50 text-blue-700 font-medium text-sm hover:bg-blue-100 transition">Ver detalle</button>
                    <button onClick={() => handleAbrirResumen(orden)} className="flex-1 py-2 rounded-md bg-green-50 text-green-700 font-medium text-sm hover:bg-green-100 transition flex items-center justify-center gap-1">
                      <DocumentArrowDownIcon className="h-4 w-4" />
                      <span>Exportar</span>
                    </button>
                    <button onClick={() => {
                      const clienteNombre = typeof orden.cliente === 'string' ? orden.cliente : orden.cliente?.nombre;
                      handleEliminarOrden(orden.id, clienteNombre || 'desconocido');
                    }} className="flex-1 py-2 rounded-md bg-red-50 text-red-700 font-medium text-sm hover:bg-red-100 transition">Eliminar</button>
                  </div>
                </div>
                )
              })}
            </div>

            {/* --- VISTA ESCRITORIO/TABLET (Tabla con Scroll Mejorado) --- */}
            <div className="hidden md:block">
              <div
                ref={topScrollRef}
                className="w-full overflow-x-auto"
                style={{ overflowY: 'hidden' }}
              >
                <div style={{ height: 1 }} />
              </div>

              <div ref={tableWrapperRef} className="bg-white rounded-lg shadow-sm overflow-x-auto border border-gray-200">
                <table ref={tableRef} className="min-w-[800px] w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Producto(s)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Estado</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Total</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ordenesFiltradas.map((orden) => {
                    const firstItem = (orden.items && orden.items[0]) || {};
                    const foto = firstItem.foto || null;
                    const productoNombre = firstItem.nombre || `Orden ${orden.id}`;
                    const tallaColor = `${firstItem.talla || ''}${firstItem.talla && firstItem.color ? ' - ' : ''}${firstItem.color || ''}`;
                    const clienteNombre = typeof orden.cliente === 'string' ? orden.cliente : orden.cliente?.nombre;
                    const totalItems = (orden.items || []).length;
                    const itemNames = (orden.items || []).map(item => item.nombre).filter(Boolean);
                    return (
                    <tr key={orden.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-normal">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 flex-shrink-0 rounded bg-gray-100 overflow-hidden cursor-pointer"
                            onClick={() => foto && setZoomedImage(foto)}
                          >
                              {foto ? (
                                <img crossOrigin="anonymous" referrerPolicy="no-referrer" className="h-10 w-10 object-cover" src={foto} alt="" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs">Sin foto</div>
                             )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {totalItems === 1 ? (
                              <>
                                <div className="text-sm font-medium text-gray-900">{productoNombre}</div>
                                <div className="text-xs text-gray-500">{tallaColor}</div>
                              </>
                            ) : (
                              <div className="text-xs space-y-1 max-h-20 overflow-hidden">
                                {itemNames.map((name, idx) => (
                                  <div key={idx} className="text-gray-700 line-clamp-1">{name}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{clienteNombre}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{orden.fechaEntrega || orden.fechaCreacion || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(orden)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-blue-700">
                        ${orden.totalVenta}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex gap-2 justify-end">
                        <button onClick={() => navigate(`/ordenes/editar/${orden.id}`)} className="px-3 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition">Ver detalle</button>
                        <button onClick={() => handleAbrirResumen(orden)} className="px-3 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 transition flex items-center gap-1">
                          <DocumentArrowDownIcon className="h-4 w-4" />
                          Exportar
                        </button>
                        <button onClick={() => {
                          const clienteNombre = typeof orden.cliente === 'string' ? orden.cliente : orden.cliente?.nombre;
                          handleEliminarOrden(orden.id, clienteNombre || 'desconocido');
                        }} className="px-3 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 transition">Eliminar</button>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
              
              {ordenesFiltradas.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                    No se encontraron órdenes con el filtro aplicado.
                </div>
              )}
            </div>
          </div>
            {/* Modal de Zoom de Imagen */}
            <ImageZoomModal imageUrl={zoomedImage} onClose={() => setZoomedImage(null)} />
            
            {/* Modal de Resumen de Orden */}
            {selectedOrdenForResumen && (
              <ResumenOrden
                isOpen={resumenModalOpen}
                orden={selectedOrdenForResumen as any}
                onClose={() => {
                  setResumenModalOpen(false);
                  setSelectedOrdenForResumen(null);
                }}
                esEntregaPersonal={esEntregaPersonal}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Pedidos;