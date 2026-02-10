import React, { useState, useMemo, useEffect } from 'react';
// Iconos: usamos Heroicons para mantener consistencia
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  PhoneIcon,
  CalendarIcon,
  UserIcon,
  ShoppingBagIcon,
  ExclamationTriangleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../credenciales';
import showToast from '../utils/toast';

// --- Interfaces basadas en tus capturas de Firestore ---
interface PerfilRecomendacion {
  estilo_compra: string;
  frecuencia_compra: string;
  gasto_promedio_por_compra: number;
  dias_desde_ultima_compra: number;
  periodo_analisis: string;
  presupuesto_estimado_max: number;
  rango_precio_min: number;
  rango_precio_max: number;
  satisfaccion_promedio: number;
  satisfaccion_ultimas_3_compras: number;
  categorias_favoritas: string[];
  colores_favoritos: string[];
  prendas_mas_compradas: string[];
}

interface Cliente {
  id: string;
  cliente: string;
  telefono: string;
  cumpleaños: string;
  actualizado_en?: string;
  tipo_cliente: 'activo' | 'inactivo' | 'nuevo';
  ultima_compra?: string;
  total_pedidos_12m: number;
  sin_actividad: boolean;
  variedad_colores: number;
  tallas_mas_usadas: string[];
  perfil_recomendacion?: PerfilRecomendacion;
  color_marketing?: 'verde' | 'azul' | 'amarillo' | 'rojo';
}

// (Sin mock): ahora los clientes se cargan desde Firestore

// --- Funciones Helper (fuera del componente para reutilización) ---

// Helper para obtener días desde última compra (combina ambos campos)
const getDiasSinCompra = (c: Cliente): number => {
  const profile = c.perfil_recomendacion;
  // Primero intenta desde el campo del perfil (más confiable)
  if (typeof profile?.dias_desde_ultima_compra === 'number') {
    return profile.dias_desde_ultima_compra;
  }
  // Si no, calcula desde ultima_compra
  if (c.ultima_compra) {
    const lastDate = new Date(c.ultima_compra);
    return Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  // Sin datos: cliente sin compras
  return 999;
};

// Helper para obtener fecha de última compra formateada
const getUltimaCompraFormato = (c: Cliente): string => {
  const profile = c.perfil_recomendacion;
  // Si tenemos la fecha directa, usarla
  if (c.ultima_compra) {
    return new Date(c.ultima_compra).toLocaleDateString('es-ES');
  }
  // Si tenemos días desde última compra, calcular fecha hacia atrás
  if (typeof profile?.dias_desde_ultima_compra === 'number') {
    const date = new Date();
    date.setDate(date.getDate() - profile.dias_desde_ultima_compra);
    return date.toLocaleDateString('es-ES');
  }
  return 'Sin compras';
};

// Clasificación por colores (marketing) - Basada en datos reales
const getClienteColorBadge = (c: Cliente): { label: string; bg: string; text: string; descripcion: string } => {
  const profile = c.perfil_recomendacion;
  const freq = c.total_pedidos_12m || 0;
  const satisfaccion = profile?.satisfaccion_promedio || 3;
  const diasSinCompra = getDiasSinCompra(c);
  const presupuesto = profile?.presupuesto_estimado_max || 0;

  // Scoring mejorado:
  // Verde: Cliente VIP - reciente, activo, alta satisfacción, alto presupuesto
  // Azul: Cliente Regular - medio-alto, activo, buen potencial
  // Amarillo: Cliente en Riesgo - bajo movimiento o baja satisfacción
  // Rojo: Cliente Inactivo - requiere reactivación urgente

  let label = 'rojo';
  let bg = 'bg-red-100';
  let text = 'text-red-700';
  let descripcion = 'Inactivo: reactivación urgente';

  if (diasSinCompra <= 30 && freq >= 4 && satisfaccion >= 4 && presupuesto > 300) {
    label = 'verde';
    bg = 'bg-green-100';
    text = 'text-green-800';
    descripcion = 'VIP: Cliente leal y activo';
  } else if (diasSinCompra <= 90 && freq >= 2 && satisfaccion >= 3) {
    label = 'azul';
    bg = 'bg-blue-100';
    text = 'text-blue-800';
    descripcion = 'Regular: Buen cliente';
  } else if (diasSinCompra <= 180 || (freq >= 1 && satisfaccion < 3)) {
    label = 'amarillo';
    bg = 'bg-amber-100';
    text = 'text-amber-800';
    descripcion = 'En Riesgo: Necesita atención';
  }

  return { label, bg, text, descripcion };
};

// --- Componente Principal ---
const Clientes: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  // Filtros
  const [estadoFiltro, setEstadoFiltro] = useState<Cliente['tipo_cliente'] | 'ALL'>('ALL');
  const [ultimaCompraFiltro, setUltimaCompraFiltro] = useState<'ALL' | '30' | '90' | '180' | '365' | 'NONE'>('ALL');
  const [cumpleMesFiltro, setCumpleMesFiltro] = useState<'ALL' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12'>('ALL');
  // Modales
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);

  // Filtrado
  const filteredClients = useMemo(() => {
    const term = searchTerm.toLowerCase();

    return clientes.filter(c => {
      const matchSearch = c.cliente.toLowerCase().includes(term) || c.telefono.includes(term);
      const matchEstado = estadoFiltro === 'ALL' || c.tipo_cliente === estadoFiltro;

      let matchUltima = true;
      if (ultimaCompraFiltro !== 'ALL') {
        const diasSinCompra = getDiasSinCompra(c);
        if (ultimaCompraFiltro === 'NONE') {
          matchUltima = diasSinCompra >= 999;
        } else {
          matchUltima = diasSinCompra <= Number(ultimaCompraFiltro);
        }
      }

      let matchCumpleMes = true;
      if (cumpleMesFiltro !== 'ALL') {
        if (c.cumpleaños) {
          // Formato esperado: YYYY-MM-DD o similar
          const mes = (() => {
            const parts = c.cumpleaños.split('-');
            if (parts.length >= 2) return parts[1].replace(/^0/, '');
            return '';
          })();
          matchCumpleMes = mes === cumpleMesFiltro;
        } else {
          matchCumpleMes = false;
        }
      }

      return matchSearch && matchEstado && matchUltima && matchCumpleMes;
    });
  }, [clientes, searchTerm, estadoFiltro, ultimaCompraFiltro, cumpleMesFiltro]);

  // Carga inicial de clientes desde Firestore
  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const snap = await getDocs(collection(db, 'clientes'));
        const data: Cliente[] = snap.docs.map((d) => {
          const raw = d.data() as any;
          const perfil = raw.perfil_recomendacion;
          
          return {
            id: d.id,
            cliente: raw.cliente || '',
            telefono: raw.telefono || '',
            cumpleaños: raw.cumpleaños || raw.cumpleanos || '',
            actualizado_en: perfil?.actualizado_en || raw.actualizado_en || '',
            // Estos campos están DENTRO de perfil_recomendacion
            tipo_cliente: (perfil?.tipo_cliente as Cliente['tipo_cliente']) || 'nuevo',
            ultima_compra: perfil?.ultima_compra || '',
            total_pedidos_12m: Number(perfil?.total_pedidos_12m || 0),
            sin_actividad: perfil?.sin_actividad || false,
            variedad_colores: Number(perfil?.variedad_colores || 0),
            tallas_mas_usadas: Array.isArray(perfil?.tallas_mas_usadas) ? perfil.tallas_mas_usadas : [],
            perfil_recomendacion: perfil || undefined,
          };
        });
        setClientes(data);
      } catch (e) {
        console.error('Error cargando clientes:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchClientes();
  }, []);

  // Handler para guardar nuevo cliente
  const handleAddClient = async (newClient: Partial<Cliente>) => {
    try {
      const payload = {
        cliente: newClient.cliente || '',
        telefono: newClient.telefono || '',
        cumpleaños: newClient.cumpleaños || (newClient as any)?.cumpleanos || '',
        cumpleanos: newClient.cumpleaños || (newClient as any)?.cumpleanos || '',
        tipo_cliente: 'nuevo',
      } as any;

      const ref = await addDoc(collection(db, 'clientes'), payload);
      const client: Cliente = {
        id: ref.id,
        cliente: payload.cliente,
        telefono: payload.telefono,
        cumpleaños: payload.cumpleaños,
        tipo_cliente: 'nuevo',
        total_pedidos_12m: 0,
        tallas_mas_usadas: [],
        sin_actividad: false,
        variedad_colores: 0,
      };
      setClientes([client, ...clientes]);
      setIsAddOpen(false);
      showToast('Cliente registrado correctamente', 'success');
    } catch (e) {
      console.error('Error guardando cliente', e);
      showToast('Error al registrar cliente', 'error');
    }
  };

  // Handler para editar cliente
  const handleUpdateClient = async (id: string, updates: Partial<Cliente>) => {
    try {
      const payload: any = {};
      if (typeof updates.cliente !== 'undefined') payload.cliente = updates.cliente;
      if (typeof updates.telefono !== 'undefined') payload.telefono = updates.telefono;
      if (typeof updates.cumpleaños !== 'undefined') {
        payload.cumpleaños = updates.cumpleaños;
        payload.cumpleanos = updates.cumpleaños;
      }
      if (typeof updates.tipo_cliente !== 'undefined') payload.tipo_cliente = updates.tipo_cliente;

      if (Object.keys(payload).length > 0) {
        await updateDoc(doc(db, 'clientes', id), payload);
      }
      setClientes(clientes.map(c => c.id === id ? { ...c, ...updates } : c));
      setEditingClient(null);
      showToast('Cliente actualizado', 'success');
    } catch (e) {
      console.error('Error actualizando cliente', e);
      showToast('Error al actualizar cliente', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-800">
      
      {/* --- Header / Topbar Area --- */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500">Gestión de datos personales y perfiles de consumo.</p>
        </div>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm font-medium"
        >
            <PlusIcon className="w-5 h-5" />
          Nuevo Cliente
        </button>
      </div>

      {/* --- Panel de Resumen por Colores --- */}
      <div className="max-w-7xl mx-auto mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { color: 'verde', label: 'VIP Activos', count: clientes.filter(c => getClienteColorBadge(c).label === 'verde').length, bg: 'bg-green-50', border: 'border-green-200' },
          { color: 'azul', label: 'Regulares', count: clientes.filter(c => getClienteColorBadge(c).label === 'azul').length, bg: 'bg-blue-50', border: 'border-blue-200' },
          { color: 'amarillo', label: 'En Riesgo', count: clientes.filter(c => getClienteColorBadge(c).label === 'amarillo').length, bg: 'bg-amber-50', border: 'border-amber-200' },
          { color: 'rojo', label: 'Inactivos', count: clientes.filter(c => getClienteColorBadge(c).label === 'rojo').length, bg: 'bg-red-50', border: 'border-red-200' },
        ].map(({ color, label, count, bg, border }) => (
          <div key={color} className={`${bg} border ${border} rounded-lg p-4`}>
            <p className="text-xs font-semibold text-gray-600 uppercase">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{count}</p>
            <p className="text-xs text-gray-500 mt-1">{((count / (clientes.length || 1)) * 100).toFixed(0)}% de clientes</p>
          </div>
        ))}
      </div>

      {/* --- Search + Filtros --- */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
          <div className="relative md:col-span-2">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          <div>
            <select 
              className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm"
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value as Cliente['tipo_cliente'] | 'ALL')}
            >
              <option value="ALL">Todos los estados</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
              <option value="nuevo">Nuevo</option>
            </select>
          </div>
          <div>
            <select 
              className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm"
              value={ultimaCompraFiltro}
              onChange={(e) => setUltimaCompraFiltro(e.target.value as 'ALL' | '30' | '90' | '180' | '365' | 'NONE')}
            >
              <option value="ALL">Todas últimas compras</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
              <option value="180">Últimos 180 días</option>
              <option value="365">Últimos 365 días</option>
              <option value="NONE">Sin compras</option>
            </select>
          </div>
          <div>
            <select
              className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm"
              value={cumpleMesFiltro}
              onChange={e => setCumpleMesFiltro(e.target.value as typeof cumpleMesFiltro)}
            >
              <option value="ALL">Cumpleaños: Todos los meses</option>
              <option value="1">Enero</option>
              <option value="2">Febrero</option>
              <option value="3">Marzo</option>
              <option value="4">Abril</option>
              <option value="5">Mayo</option>
              <option value="6">Junio</option>
              <option value="7">Julio</option>
              <option value="8">Agosto</option>
              <option value="9">Septiembre</option>
              <option value="10">Octubre</option>
              <option value="11">Noviembre</option>
              <option value="12">Diciembre</option>
            </select>
          </div>
        </div>
      </div>

      {/* --- Tabla de Clientes --- */}
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          {loading && (
            <div className="p-6 text-sm text-gray-500">Cargando clientes...</div>
          )}
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contacto</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Estado</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Última Compra</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                        {client.cliente.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 flex items-center gap-2">
                          {client.cliente}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${getClienteColorBadge(client).bg} ${getClienteColorBadge(client).text}`}>
                            {getClienteColorBadge(client).label}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 md:hidden">{client.tipo_cliente}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-col text-sm text-gray-600">
                      <span className="flex items-center gap-1"><PhoneIcon className="w-3 h-3 text-gray-400"/> {client.telefono}</span>
                      {client.cumpleaños && (
                        <span className="flex items-center gap-1 text-xs text-gray-400"><CalendarIcon className="w-3 h-3"/> {client.cumpleaños}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 hidden md:table-cell">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                      ${client.tipo_cliente === 'activo' ? 'bg-green-100 text-green-800' : 
                        client.tipo_cliente === 'inactivo' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'}`}>
                      {client.tipo_cliente}
                    </span>
                  </td>
                  <td className="py-4 px-6 hidden md:table-cell">
                    <div className="text-sm text-gray-600">
                      <p>{getUltimaCompraFormato(client)}</p>
                      {client.total_pedidos_12m > 0 ? (
                        <p className="text-xs text-gray-400">{client.total_pedidos_12m} pedido{client.total_pedidos_12m !== 1 ? 's' : ''} (12m)</p>
                      ) : (
                        <p className="text-xs text-gray-400">0 pedidos</p>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right flex items-center justify-end gap-1">
                    <button 
                      onClick={() => setEditingClient(client)}
                      className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-colors"
                      title="Editar detalles"
                    >
                      <PencilSquareIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!window.confirm(`¿Eliminar a "${client.cliente}"? Esta acción no se puede deshacer.`)) return;
                        try {
                          await deleteDoc(doc(db, 'clientes', client.id));
                          setClientes(prev => prev.filter(c => c.id !== client.id));
                          showToast('Cliente eliminado', 'success');
                        } catch (e) {
                          console.error('Error eliminando cliente', e);
                          showToast('Error al eliminar cliente', 'error');
                        }
                      }}
                      className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
                      title="Eliminar cliente"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filteredClients.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No se encontraron clientes con ese criterio.
          </div>
        )}
      </div>

      {/* --- MODAL: Agregar Nuevo Cliente (Con lógica de duplicados) --- */}
      {isAddOpen && (
        <AddClientModal 
          existingClients={clientes} 
          onClose={() => setIsAddOpen(false)} 
          onSave={handleAddClient} 
        />
      )}

      {/* --- MODAL: Editar Cliente (Con vista de datos de IA) --- */}
      {editingClient && (
        <EditClientModal 
          client={editingClient} 
          onClose={() => setEditingClient(null)} 
          onSave={handleUpdateClient} 
        />
      )}

    </div>
  );
};

// --- Sub-componente: Modal Agregar Cliente ---
const AddClientModal: React.FC<{
  existingClients: Cliente[];
  onClose: () => void;
  onSave: (data: Partial<Cliente>) => void;
}> = ({ existingClients, onClose, onSave }) => {
  const [formData, setFormData] = useState({ cliente: '', telefono: '', cumpleaños: '' });
  const [warning, setWarning] = useState<string | null>(null);

  // Lógica de "Fuzzy Search" simple para advertencia
  const validateDuplicate = (name: string) => {
    if (!name) return;
    const normalizedNew = name.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const similar = existingClients.find(c => {
      const normalizedExisting = c.cliente.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      // Coincidencia exacta o muy parecida
      return normalizedExisting === normalizedNew || normalizedExisting.includes(normalizedNew) && normalizedNew.length > 3;
    });

    if (similar) {
      setWarning(`Posible duplicado: Ya existe un cliente llamado "${similar.cliente}".`);
    } else {
      setWarning(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'cliente') validateDuplicate(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">Registrar Nuevo Cliente</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5"/></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Advertencia Inteligente */}
          {warning && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3 text-sm text-amber-800 animate-pulse">
                <ExclamationTriangleIcon className="shrink-0 mt-0.5 w-4 h-4" />
              <div>
                <p className="font-semibold">¡Atención!</p>
                <p>{warning}</p>
                <p className="mt-1 text-xs text-amber-600">Puedes continuar si estás seguro de que es una persona diferente.</p>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Nombre Completo</label>
            <input 
              required
              name="cliente"
              value={formData.cliente}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ej. María Pérez"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Teléfono</label>
              <input 
                name="telefono"
                value={formData.telefono}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="10 dígitos"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Cumpleaños</label>
              <input 
                type="date"
                name="cumpleaños"
                value={formData.cumpleaños}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm text-sm font-medium"
            >
              Registrar Cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Sub-componente: Modal Editar (Con detalles de perfil) ---
const EditClientModal: React.FC<{
  client: Cliente;
  onClose: () => void;
  onSave: (id: string, data: Partial<Cliente>) => void;
}> = ({ client, onClose, onSave }) => {
  const [formData, setFormData] = useState({ 
    cliente: client.cliente, 
    telefono: client.telefono, 
    cumpleaños: client.cumpleaños 
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(client.id, formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 sticky top-0 z-10">
          <h3 className="text-lg font-bold text-gray-800">Detalle del Cliente</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5"/></button>
        </div>

        <div className="p-0 md:grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
          
          {/* Columna Izquierda: Edición de Datos Personales */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <UserIcon className="w-4 h-4"/> Datos Personales
            </h4>
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Nombre</label>
              <input 
                value={formData.cliente}
                onChange={e => setFormData({...formData, cliente: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Teléfono</label>
              <input 
                value={formData.telefono}
                onChange={e => setFormData({...formData, telefono: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Cumpleaños</label>
              <input 
                type="date"
                value={formData.cumpleaños}
                onChange={e => setFormData({...formData, cumpleaños: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div className="pt-6">
              <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                Guardar Cambios
              </button>
            </div>
          </form>

          {/* Columna Derecha: Inteligencia de Negocio + Insights Ventas (Read-only) */}
          <div className="p-6 bg-gray-50/50 space-y-6">
            {/* Clasificación y Estado */}
            <div>
              <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <ShoppingBagIcon className="w-4 h-4"/> Estado de Cliente
              </h4>
              {(() => {
                const badge = getClienteColorBadge(client);
                return (
                  <div className={`p-3 rounded-lg border ${badge.bg} ${badge.text}`}>
                    <p className="font-semibold text-sm mb-1">{badge.descripcion}</p>
                    <p className="text-xs">Acción recomendada: {
                      badge.label === 'verde' ? 'Mantener comunicación exclusiva, ofrecer VIP' :
                      badge.label === 'azul' ? 'Promociones de categorías favoritas' :
                      badge.label === 'amarillo' ? 'Campaña de reactivación urgente' :
                      'Contactar para reactivación con descuentos'
                    }</p>
                  </div>
                );
              })()}
            </div>

            {/* Perfil de Consumo */}
            {client.perfil_recomendacion ? (
              <>
                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase mb-3">Datos de Compra</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-lg border border-gray-200">
                      <p className="text-[10px] text-gray-400">Frecuencia</p>
                      <p className="font-semibold text-gray-800 text-sm capitalize">{client.perfil_recomendacion?.frecuencia_compra || 'N/A'}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-gray-200">
                      <p className="text-[10px] text-gray-400">Ticket Prom.</p>
                      <p className="font-semibold text-gray-800 text-sm">${client.perfil_recomendacion?.gasto_promedio_por_compra || 0}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-gray-200">
                      <p className="text-[10px] text-gray-400">Días sin compra</p>
                      <p className="font-semibold text-gray-800 text-sm">{client.perfil_recomendacion?.dias_desde_ultima_compra ?? 'N/A'}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-gray-200">
                      <p className="text-[10px] text-gray-400">Presupuesto Max</p>
                      <p className="font-semibold text-gray-800 text-sm">${client.perfil_recomendacion?.presupuesto_estimado_max || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Satisfacción */}
                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase mb-3">Satisfacción</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-lg border border-gray-200">
                      <p className="text-[10px] text-gray-400">Promedio</p>
                      <p className="font-semibold text-gray-800 text-sm">⭐ {client.perfil_recomendacion?.satisfaccion_promedio ?? 'N/A'}/5</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-gray-200">
                      <p className="text-[10px] text-gray-400">Últimas 3 compras</p>
                      <p className="font-semibold text-gray-800 text-sm">⭐ {client.perfil_recomendacion?.satisfaccion_ultimas_3_compras ?? 'N/A'}/5</p>
                    </div>
                  </div>
                </div>

                {/* Preferencias */}
                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase mb-2">Categorías Favoritas</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(client.perfil_recomendacion?.categorias_favoritas) && client.perfil_recomendacion.categorias_favoritas.length > 0 ? (
                      client.perfil_recomendacion.categorias_favoritas.map(cat => (
                        <span key={cat} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                          {cat}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">Sin datos</span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase mb-2">Colores Favoritos</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(client.perfil_recomendacion?.colores_favoritos) && client.perfil_recomendacion.colores_favoritos.length > 0 ? (
                      client.perfil_recomendacion.colores_favoritos.map(color => (
                        <span key={color} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium">
                          {color}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">Sin datos</span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase mb-2">Prendas Más Compradas</p>
                  <div className="space-y-1">
                    {Array.isArray(client.perfil_recomendacion?.prendas_mas_compradas) && client.perfil_recomendacion.prendas_mas_compradas.length > 0 ? (
                      client.perfil_recomendacion.prendas_mas_compradas.map((prenda, i) => (
                        <p key={i} className="text-xs text-gray-700 bg-white p-2 rounded border border-gray-200">• {prenda}</p>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">Sin datos</span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase mb-2">Tallas Frecuentes</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(client.tallas_mas_usadas) && client.tallas_mas_usadas.length > 0 ? (
                      client.tallas_mas_usadas.map(talla => (
                        <span key={talla} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium">
                          {talla}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">Sin datos</span>
                    )}
                  </div>
                </div>
                
                <div className="text-xs text-gray-400 italic border-t pt-3">
                  💡 Insights: Rango de precio recomendado ${client.perfil_recomendacion?.rango_precio_min || 0} - ${client.perfil_recomendacion?.rango_precio_max || 0}. Cliente con {client.variedad_colores || 0} colores diferentes en su historial.
                </div>
              </>
            ) : (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700 font-medium">ℹ️ Sin perfil generado</p>
                <p className="text-xs text-blue-600 mt-1">Este cliente aún no tiene suficiente historial para generar un perfil de consumo.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Clientes;