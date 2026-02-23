import React, { useState, useEffect, useMemo } from 'react';
import { getDocs } from 'firebase/firestore';
import showToast from '../utils/toast';
import { CreditCardIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { ClienteCredito } from '../types/orden';
import { useAuth } from '../contexts';
import { userQuery } from '../utils/multitenancy';

const SaldoAFavor: React.FC = () => {
  const { user } = useAuth();
  const uid = user?.uid;
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<(ClienteCredito & { id: string })[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState<(ClienteCredito & { id: string }) | null>(null);

  // Cargar clientes con saldo a favor
  useEffect(() => {
    if (!uid) return;
    const fetchClientes = async () => {
      try {
        const q = userQuery('clientes_credito', uid);
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        } as ClienteCredito & { id: string })).filter(c => (c.saldoTotal || 0) > 0);
        
        // Ordenar por saldo descendente
        data.sort((a, b) => b.saldoTotal - a.saldoTotal);
        setClientes(data);
      } catch (error) {
        console.error('Error cargando clientes con saldo:', error);
        showToast('Error al cargar clientes con saldo a favor', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchClientes();
  }, [uid]);

  const filteredClientes = useMemo(() => {
    return clientes.filter(c =>
      c.cliente.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [clientes, searchTerm]);

  const totalAcumulado = useMemo(() => {
    return clientes.reduce((acc, curr) => acc + (curr.saldoTotal || 0), 0);
  }, [clientes]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 pb-20">
      
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <CreditCardIcon className="h-7 w-7 text-green-600" />
              Saldo a Favor de Clientes
            </h1>
            <p className="text-gray-500 text-sm">Visualiza y gestiona créditos disponibles</p>
          </div>
          
          <div className="bg-white px-6 py-3 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total a favor</p>
              <p className="text-2xl font-bold text-green-600">${totalAcumulado.toLocaleString()}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
              <CreditCardIcon className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Buscador */}
        <div className="mt-6 relative">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input 
            type="text"
            placeholder="Buscar cliente..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border-gray-200 shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Lista de Clientes */}
      <div className="max-w-5xl mx-auto space-y-4">
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div></div>
        ) : filteredClientes.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm">
            <p className="text-gray-500">{clientes.length === 0 ? 'No hay clientes con saldo a favor' : 'No se encontraron resultados'}</p>
          </div>
        ) : (
          filteredClientes.map((cliente) => (
            <div key={cliente.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-5 transition-all hover:shadow-md">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg">{cliente.cliente}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Última actualización: {cliente.fechaActualizacion ? new Date(cliente.fechaActualizacion).toLocaleDateString('es-MX') : 'N/A'}
                  </p>
                  
                  {cliente.movimientos && cliente.movimientos.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => setClienteSeleccionado(
                          clienteSeleccionado?.id === cliente.id ? null : cliente
                        )}
                        className="text-xs text-green-600 hover:text-green-700 font-medium underline"
                      >
                        {clienteSeleccionado?.id === cliente.id ? 'Ocultar' : 'Ver'} movimientos ({cliente.movimientos.length})
                      </button>
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase">Saldo disponible</p>
                  <p className="text-2xl font-bold text-green-600">${cliente.saldoTotal.toLocaleString()}</p>
                </div>
              </div>

              {/* Movimientos expandidos */}
              {clienteSeleccionado?.id === cliente.id && cliente.movimientos && cliente.movimientos.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-xs font-bold text-gray-600 uppercase mb-3">Historial de movimientos</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {cliente.movimientos.map((mov, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium text-gray-900">
                            {mov.tipo === 'devolucion' ? '↑ Devolución' : '↓ Compra'}
                          </p>
                          <p className="text-gray-500">{new Date(mov.fecha).toLocaleDateString('es-MX')}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${mov.tipo === 'devolucion' ? 'text-green-600' : 'text-red-600'}`}>
                            {mov.tipo === 'devolucion' ? '+' : '-'}${mov.monto.toLocaleString()}
                          </p>
                          <p className="text-gray-500">Saldo: ${mov.balance_nuevo.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SaldoAFavor;
