import React, { useState, useEffect, useMemo } from 'react';
import { getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../credenciales';
import { XMarkIcon, MagnifyingGlassIcon, DocumentTextIcon, FunnelIcon } from '@heroicons/react/24/outline';
import ReciboPago from './ReciboPago';
import showToast from '../utils/toast';
import { useAuth } from '../contexts';
import { userQuery } from '../utils/multitenancy';

interface MovimientoFinanzas {
  id: string;
  tipo: string;
  categoria: string;
  monto: number;
  metodo: string;
  fecha: string;
  cliente: string;
  ordenId: string;
  folio: string | null;
  pagoId: string;
  comentario: string;
  createdAt: any;
}

interface HistorialPagosProps {
  isOpen: boolean;
  onClose: () => void;
}

const HistorialPagos: React.FC<HistorialPagosProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const uid = user?.uid;
  const [loading, setLoading] = useState(false);
  const [pagos, setPagos] = useState<MovimientoFinanzas[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('todos');
  const [reciboSeleccionado, setReciboSeleccionado] = useState<{ pago: any; ordenesDestino: any[] } | null>(null);

  // Cargar pagos desde finanzas
  const fetchPagos = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const q = userQuery('finanzas', uid);
      const snap = await getDocs(q);
      const data: MovimientoFinanzas[] = snap.docs
        .filter(d => d.data().categoria === 'pago_orden')
        .map(d => ({
          id: d.id,
          ...d.data()
        } as MovimientoFinanzas));
      
      // Ordenar en memoria por fecha (más recientes primero)
      data.sort((a, b) => {
        const fechaA = new Date(a.fecha).getTime();
        const fechaB = new Date(b.fecha).getTime();
        return fechaB - fechaA;
      });
      
      setPagos(data);
    } catch (error) {
      console.error('Error cargando historial:', error);
      showToast('Error al cargar historial de pagos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPagos();
    }
  }, [isOpen]);

  // Lista única de clientes para el filtro
  const clientes = useMemo(() => {
    const uniqueClientes = new Set(pagos.map(p => p.cliente));
    return Array.from(uniqueClientes).sort();
  }, [pagos]);

  // Filtrado de pagos
  const pagosFiltrados = useMemo(() => {
    return pagos.filter(p => {
      const matchSearch = p.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.folio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.ordenId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCliente = filtroCliente === 'todos' || p.cliente === filtroCliente;
      return matchSearch && matchCliente;
    });
  }, [pagos, searchTerm, filtroCliente]);

  const totalPagos = useMemo(() => pagosFiltrados.reduce((acc, p) => acc + p.monto, 0), [pagosFiltrados]);

  const handleVerRecibo = async (pago: MovimientoFinanzas) => {
    // Intentar obtener información de la orden para el recibo
    try {
      const ordenSnap = await getDoc(doc(db, 'ordenes', pago.ordenId));
      if (ordenSnap.exists()) {
        const ordenData = ordenSnap.data();
        const saldoRestante = ordenData.saldoPendiente || 0;
        setReciboSeleccionado({
          pago: {
            monto: pago.monto,
            fecha: pago.fecha,
            metodo: pago.metodo,
            registradoPor: pago.pagoId,
            folioTransaccion: pago.folio || pago.pagoId
          },
          ordenesDestino: [{
            id: pago.ordenId,
            folio: pago.folio,
            cliente: { nombre: pago.cliente },
            totalVenta: ordenData.totalVenta || 0,
            saldoRestante,
            liquidada: saldoRestante <= 0
          }]
        });
      } else {
        // Si no encontramos la orden, crear recibo con datos mínimos
        setReciboSeleccionado({
          pago: {
            monto: pago.monto,
            fecha: pago.fecha,
            metodo: pago.metodo,
            registradoPor: pago.pagoId,
            folioTransaccion: pago.folio || pago.pagoId
          },
          ordenesDestino: [{
            id: pago.ordenId,
            folio: pago.folio,
            cliente: { nombre: pago.cliente },
            totalVenta: pago.monto,
            saldoRestante: 0,
            liquidada: true
          }]
        });
      }
    } catch (error) {
      console.error('Error obteniendo detalles de orden:', error);
      showToast('Error al cargar detalles del recibo', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="h-6 w-6 text-white" />
            <h3 className="text-white font-bold text-lg">Historial de Pagos</h3>
          </div>
          <button onClick={onClose} className="text-blue-100 hover:text-white transition-colors">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Filtros y búsqueda */}
        <div className="p-4 border-b bg-gray-50 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Barra de búsqueda */}
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por cliente, folio u orden..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filtro por cliente */}
            <div className="md:w-64 relative">
              <FunnelIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                value={filtroCliente}
                onChange={(e) => setFiltroCliente(e.target.value)}
              >
                <option value="todos">Todos los clientes</option>
                {clientes.map(cliente => (
                  <option key={cliente} value={cliente}>{cliente}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Resumen */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">
              {pagosFiltrados.length} pago{pagosFiltrados.length !== 1 ? 's' : ''} encontrado{pagosFiltrados.length !== 1 ? 's' : ''}
            </span>
            <span className="font-bold text-green-600">
              Total: ${totalPagos.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Lista de pagos */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          ) : pagosFiltrados.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <DocumentTextIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p>No se encontraron pagos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pagosFiltrados.map((pago) => (
                <div
                  key={pago.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all bg-white"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-gray-900">{pago.cliente}</h4>
                        {pago.folio && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                            {pago.folio}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 space-y-0.5">
                        <p>Fecha: <span className="font-medium text-gray-900">{pago.fecha}</span></p>
                        <p>Método: <span className="font-medium text-gray-900">{pago.metodo}</span></p>
                        <p className="text-xs text-gray-400">Orden: {pago.ordenId.slice(0, 12)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase">Monto</p>
                        <p className="text-2xl font-bold text-green-600">
                          ${pago.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleVerRecibo(pago)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        Ver recibo
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full md:w-auto px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Modal de Recibo */}
      {reciboSeleccionado && (
        <ReciboPago
          isOpen={true}
          pago={reciboSeleccionado.pago}
          ordenesDestino={reciboSeleccionado.ordenesDestino}
          onClose={() => setReciboSeleccionado(null)}
        />
      )}
    </div>
  );
};

export default HistorialPagos;
