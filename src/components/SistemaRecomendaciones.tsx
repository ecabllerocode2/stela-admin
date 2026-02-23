/**
 * 🎯 SISTEMA DE RECOMENDACIONES - Joya de la Aplicación
 * 
 * Componente principal para recomendaciones de ventas
 * Dos modos: Por Producto | Por Cliente
 */

import React, { useEffect, useState, useMemo } from 'react';
import { getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { userQuery } from '../utils/multitenancy';
import showToast from '../utils/toast';
import {
  obtenerProductosParaCliente,
  obtenerClientesParaProducto,
  type Producto,
  type RecomendacionProducto,
  type RecomendacionCliente,
} from '../utils/recomendaciones';
import {
  SparklesIcon,
  MagnifyingGlassIcon,
  SwatchIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import SafeImage from './SafeImage';

interface Cliente {
  id: string;
  cliente: string;
  perfil_recomendacion?: any;
  total_pedidos_12m: number;
  dias_desde_ultima_compra?: number;
  color_marketing?: string;
}

type Modo = 'por-cliente' | 'por-producto';

const SistemaRecomendaciones: React.FC = () => {
  // Estados principales
  const { user } = useAuth();
  const uid = user?.uid;
  const [modo, setModo] = useState<Modo>('por-cliente');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  // Modo por cliente
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [recomendacionesProductos, setRecomendacionesProductos] = useState<
    RecomendacionProducto[]
  >([]);

  // Modo por producto
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [recomendacionesClientes, setRecomendacionesClientes] = useState<
    RecomendacionCliente[]
  >([]);

  // Búsqueda y filtros
  const [searchClientes, setSearchClientes] = useState('');
  const [searchProductos, setSearchProductos] = useState('');

  // Cargar datos iniciales
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setLoading(true);
        if (!uid) return;

        // Cargar clientes
        const clientesSnap = await getDocs(userQuery('clientes', uid));
        const clientesData: Cliente[] = clientesSnap.docs.map((doc) => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            cliente: data.cliente || '',
            perfil_recomendacion: data.perfil_recomendacion,
            total_pedidos_12m: data.total_pedidos_12m || 0,
            dias_desde_ultima_compra: data.dias_desde_ultima_compra,
            color_marketing: data.perfil_recomendacion?.color_marketing,
          };
        });
        setClientes(clientesData);

        // Cargar productos
        const productosSnap = await getDocs(userQuery('productos', uid));
        const productosData: Producto[] = productosSnap.docs.map((doc) => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            name: data.name || '',
            category: data.category || '',
            publicPrice: data.publicPrice || 0,
            cost: data.cost || 0,
            variants: data.variants || [],
            shortDetails: data.shortDetails,
            offerPercentage: data.offerPercentage || 0,
          };
        });
        setProductos(productosData);

        showToast(`✅ Datos cargados: ${clientesData.length} clientes, ${productosData.length} productos`, 'success');
      } catch (error) {
        console.error('Error cargando datos:', error);
        showToast('Error cargando datos', 'error');
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
  }, [uid]);

  // Manejo de selección de cliente
  const handleSeleccionarCliente = (cliente: Cliente) => {
    setClienteSeleccionado(cliente);
    const recomendaciones = obtenerProductosParaCliente(cliente, productos);
    setRecomendacionesProductos(recomendaciones);
  };

  // Manejo de selección de producto
  const handleSeleccionarProducto = (producto: Producto) => {
    setProductoSeleccionado(producto);
    const recomendaciones = obtenerClientesParaProducto(producto, clientes);
    setRecomendacionesClientes(recomendaciones);
  };

  // Filtrar clientes
  const clientesFiltrados = useMemo(() => {
    return clientes.filter((c) =>
      c.cliente.toLowerCase().includes(searchClientes.toLowerCase())
    );
  }, [clientes, searchClientes]);

  // Filtrar productos
  const productosFiltrados = useMemo(() => {
    return productos.filter(
      (p) =>
        p.name.toLowerCase().includes(searchProductos.toLowerCase()) ||
        p.category.toLowerCase().includes(searchProductos.toLowerCase())
    );
  }, [productos, searchProductos]);

  // Badge de probabilidad
  const getProbabilidadBadge = (probabilidad: string) => {
    switch (probabilidad) {
      case 'alta':
        return { bg: 'bg-green-100', text: 'text-green-800', label: '🟢 Alta' };
      case 'media':
        return { bg: 'bg-blue-100', text: 'text-blue-800', label: '🔵 Media' };
      case 'baja':
        return { bg: 'bg-amber-100', text: 'text-amber-800', label: '🟡 Baja' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', label: '⚪ N/A' };
    }
  };

  // Color badge
  const getColorBadge = (color?: string) => {
    const colors: { [key: string]: string } = {
      verde: 'bg-green-100 text-green-800',
      azul: 'bg-blue-100 text-blue-800',
      amarillo: 'bg-amber-100 text-amber-800',
      rojo: 'bg-red-100 text-red-800',
    };
    return colors[color || 'gray'] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <SparklesIcon className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Cargando sistema de recomendaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <SparklesIcon className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Sistema de Recomendaciones</h1>
        </div>
        <p className="text-gray-600">
          Algoritmo inteligente para maximizar ventas. Busca oportunidades de compra perfectas.
        </p>
      </div>

      {/* Selector de Modo */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setModo('por-cliente');
                setClienteSeleccionado(null);
                setRecomendacionesProductos([]);
              }}
              className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                modo === 'por-cliente'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <UserGroupIcon className="w-5 h-5" />
              Selecciona Cliente
            </button>
            <button
              onClick={() => {
                setModo('por-producto');
                setProductoSeleccionado(null);
                setRecomendacionesClientes([]);
              }}
              className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                modo === 'por-producto'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <SwatchIcon className="w-5 h-5" />
              Selecciona Producto
            </button>
          </div>
        </div>
      </div>

      {/* MODO 1: POR CLIENTE */}
      {modo === 'por-cliente' && (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel de Clientes */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Selecciona un Cliente</h2>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={searchClientes}
                  onChange={(e) => setSearchClientes(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 max-h-96">
              {clientesFiltrados.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  No se encontraron clientes
                </div>
              ) : (
                clientesFiltrados.map((cliente) => (
                  <button
                    key={cliente.id}
                    onClick={() => handleSeleccionarCliente(cliente)}
                    className={`w-full p-4 border-b border-gray-100 hover:bg-blue-50 transition-colors text-left ${
                      clienteSeleccionado?.id === cliente.id ? 'bg-blue-100 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-gray-900">{cliente.cliente}</p>
                      {cliente.color_marketing && (
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${getColorBadge(
                            cliente.color_marketing
                          )}`}
                        >
                          {cliente.color_marketing.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <p>📦 {cliente.total_pedidos_12m || 0} compras</p>
                      <p>
                        📅{' '}
                        {cliente.dias_desde_ultima_compra
                          ? `${cliente.dias_desde_ultima_compra}d`
                          : 'Sin compras'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Panel de Recomendaciones de Productos */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">
                {clienteSeleccionado ? `Recomendaciones para ${clienteSeleccionado.cliente}` : 'Recomendaciones'}
              </h2>
              {clienteSeleccionado && (
                <p className="text-sm text-gray-600 mt-1">
                  {recomendacionesProductos.length} productos coinciden con su perfil
                </p>
              )}
            </div>

            <div className="overflow-y-auto flex-1 max-h-96">
              {!clienteSeleccionado ? (
                <div className="p-6 text-center text-gray-500">
                  👈 Selecciona un cliente para ver recomendaciones
                </div>
              ) : recomendacionesProductos.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  Sin productos recomendados para este cliente
                </div>
              ) : (
                recomendacionesProductos.map((rec) => (
                  <div
                    key={rec.productId}
                    className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex gap-3 mb-2">
                      {rec.imageUrl && (
                        <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                          <SafeImage src={rec.imageUrl} alt={rec.productName} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{rec.productName}</p>
                        <p className="text-sm text-gray-600">{rec.category}</p>
                        <p className="text-lg font-bold text-blue-600">${rec.price}</p>
                      </div>
                    </div>

                    {/* Score visual */}
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full"
                          style={{ width: `${Math.round(rec.score * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-700">
                        {Math.round(rec.score * 100)}%
                      </span>
                    </div>

                    {/* Detalles */}
                    <div className="text-xs text-gray-600 space-y-1 mb-2">
                      {rec.razon.map((r, i) => (
                        <p key={i}>✓ {r}</p>
                      ))}
                    </div>

                    {/* Colores y tallas sugeridas */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="font-semibold text-gray-700 mb-1">Colores:</p>
                        <div className="flex flex-wrap gap-1">
                          {rec.coloresRecomendados.slice(0, 2).map((c) => (
                            <span key={c} className="px-2 py-1 bg-gray-100 rounded">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-700 mb-1">Tallas:</p>
                        <div className="flex flex-wrap gap-1">
                          {rec.tallasRecomendadas.slice(0, 2).map((t) => (
                            <span key={t} className="px-2 py-1 bg-gray-100 rounded">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODO 2: POR PRODUCTO */}
      {modo === 'por-producto' && (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel de Productos */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Selecciona un Producto</h2>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={searchProductos}
                  onChange={(e) => setSearchProductos(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 max-h-96">
              {productosFiltrados.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  No se encontraron productos
                </div>
              ) : (
                productosFiltrados.map((producto) => (
                  <button
                    key={producto.id}
                    onClick={() => handleSeleccionarProducto(producto)}
                    className={`w-full p-4 border-b border-gray-100 hover:bg-green-50 transition-colors text-left ${
                      productoSeleccionado?.id === producto.id
                        ? 'bg-green-100 border-l-4 border-green-600'
                        : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      {producto.variants?.[0]?.imageUrls?.[0] && (
                        <div className="w-12 h-12 bg-gray-200 rounded flex-shrink-0 overflow-hidden">
                          <SafeImage
                            src={producto.variants[0].imageUrls[0]}
                            alt={producto.name}
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{producto.name}</p>
                        <p className="text-sm text-gray-600">{producto.category}</p>
                        <p className="text-lg font-bold text-green-600">${producto.publicPrice}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Panel de Recomendaciones de Clientes */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">
                {productoSeleccionado ? `Clientes para ${productoSeleccionado.name}` : 'Clientes Objetivo'}
              </h2>
              {productoSeleccionado && (
                <p className="text-sm text-gray-600 mt-1">
                  {recomendacionesClientes.length} clientes con alta probabilidad de compra
                </p>
              )}
            </div>

            <div className="overflow-y-auto flex-1 max-h-96">
              {!productoSeleccionado ? (
                <div className="p-6 text-center text-gray-500">
                  👈 Selecciona un producto para ver clientes
                </div>
              ) : recomendacionesClientes.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  Sin clientes recomendados para este producto
                </div>
              ) : (
                recomendacionesClientes.map((rec) => {
                  const badge = getProbabilidadBadge(rec.probabilidadCompra);
                  return (
                    <div
                      key={rec.clienteId}
                      className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">{rec.clienteName}</p>
                          <p className="text-sm text-gray-600">Presupuesto: ${rec.presupuestoEstimado}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </div>

                      {/* Score visual */}
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-green-500"
                            style={{ width: `${Math.round(rec.score * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-700">
                          {Math.round(rec.score * 100)}%
                        </span>
                      </div>

                      {/* Razones */}
                      <div className="text-xs text-gray-600 space-y-1 mb-2">
                        {rec.razon.map((r, i) => (
                          <p key={i}>✓ {r}</p>
                        ))}
                      </div>

                      {/* Preferencias */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-gray-50 p-2 rounded">
                          <p className="font-semibold text-gray-700 mb-1">Color Pref:</p>
                          <p className="text-gray-600">{rec.colorPreferido}</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded">
                          <p className="font-semibold text-gray-700 mb-1">Talla Pref:</p>
                          <p className="text-gray-600">{rec.tallaPreferida}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SistemaRecomendaciones;
