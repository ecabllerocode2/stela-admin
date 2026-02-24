import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  arrayUnion, 
  increment,
  addDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../credenciales';
import showToast from '../utils/toast';
import { useAuth } from '../contexts';
import { userQuery, withUserId } from '../utils/multitenancy';
import { useSubscription } from '../contexts';
import UpgradeModal, { useUpgradeModal } from './UpgradeModal';
import { 
  BanknotesIcon, 
  ClockIcon, 
  EyeIcon, 
  MagnifyingGlassIcon,
  XMarkIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';

// IMPORTANTE: Asumimos que ResumenOrden está en la misma carpeta o ajustar ruta
import ResumenOrden from './ResumenOrden'; 
import ReciboPago from './ReciboPago';
import HistorialPagos from './HistorialPagos';
import { esEntregaPersonal } from '../utils/zonas';

// --- Interfaces ---
interface Pago {
  monto: number;
  fecha: string;
  metodo: string;
  registradoPor?: string;
}

interface OrdenCobranza {
  id: string;
  cliente: { nombre: string; uid?: string } | string;
  folio?: string;
  totalVenta: number;
  saldoPendiente: number;
  fechaEntrega?: string;     // Fecha ideal para calcular morosidad
  fechaCreacion: string;     // Fallback si no hay fecha entrega
  items: any[];
}

const Pagos: React.FC = () => {
  const { user } = useAuth();
  const uid = user?.uid;
  const { isBusiness } = useSubscription();
  const { upgradeProps, requireBusiness } = useUpgradeModal();
  const [loading, setLoading] = useState(true);
  const [ordenes, setOrdenes] = useState<OrdenCobranza[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para Modales
  const [ordenParaPago, setOrdenParaPago] = useState<OrdenCobranza | null>(null);
  const [ordenParaResumen, setOrdenParaResumen] = useState<string | null>(null);
  const [ordenesClientePendientes, setOrdenesClientePendientes] = useState<OrdenCobranza[]>([]);
  const [ordenSeleccionadaId, setOrdenSeleccionadaId] = useState<string | null>(null);
  const [reciboData, setReciboData] = useState<{ pago: { monto: number; fecha: string; metodo: string; registradoPor?: string; folioTransaccion: string }, ordenesDestino: Array<{ id: string; folio?: string | null; cliente: { nombre: string } | string; totalVenta: number; saldoRestante?: number; liquidada?: boolean }> } | null>(null);
  const [historialOpen, setHistorialOpen] = useState(false);

  // Formulario de Pago
  const [montoPagar, setMontoPagar] = useState<string>('');
  const [fechaPago, setFechaPago] = useState<string>(new Date().toISOString().split('T')[0]);
  const [metodoPago, setMetodoPago] = useState('Transferencia');
  const [submittingPago, setSubmittingPago] = useState(false);

  // Orden seleccionada dentro del modal de pago
  const ordenSeleccionadaPago = useMemo(() => {
    if (!ordenParaPago) return null;
    const lista = (ordenesClientePendientes && ordenesClientePendientes.length) ? ordenesClientePendientes : [ordenParaPago];
    return lista.find(o => o.id === (ordenSeleccionadaId || ordenParaPago.id)) || ordenParaPago;
  }, [ordenParaPago, ordenesClientePendientes, ordenSeleccionadaId]);

  // --- 1. Carga de Datos (Cuentas por Cobrar) ---
  const fetchDeudas = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      // Buscamos ordenes donde saldoPendiente > 0
      const q = userQuery('ordenes', uid);

      const snap = await getDocs(q);
      const data: OrdenCobranza[] = snap.docs
        .filter(d => (d.data().saldoPendiente || 0) > 0)
        .map(d => ({
          id: d.id,
          ...d.data()
        } as OrdenCobranza));

      // Ordenar por antigüedad (Prioridad a lo más viejo)
      // Preferimos fechaEntrega, si no existe, usamos fechaCreacion
      data.sort((a, b) => {
        const fechaA = a.fechaEntrega || a.fechaCreacion;
        const fechaB = b.fechaEntrega || b.fechaCreacion;
        return fechaA > fechaB ? 1 : -1; // Ascendente: fechas viejas primero
      });

      setOrdenes(data);
    } catch (error) {
      console.error("Error cargando deudas:", error);
      showToast("Error al cargar cuentas por cobrar", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeudas();
  }, [uid]);

  // --- 2. Lógica de Cobranza (Días transcurridos) ---
  const getCobranzaStatus = (orden: OrdenCobranza) => {
    const fechaReferencia = orden.fechaEntrega || orden.fechaCreacion;
    if (!fechaReferencia) return { dias: 0, color: 'bg-gray-100 text-gray-600', label: 'Sin fecha' };

    const fechaObj = new Date(fechaReferencia);
    const hoy = new Date();
    const diferenciaTime = hoy.getTime() - fechaObj.getTime();
    const dias = Math.floor(diferenciaTime / (1000 * 3600 * 24));

    if (dias > 30) return { dias, color: 'bg-red-100 text-red-700 border-red-200', label: 'Crítico' };
    if (dias > 7) return { dias, color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Atención' };
    return { dias, color: 'bg-green-100 text-green-700 border-green-200', label: 'Reciente' };
  };

  // --- 3. Manejo de Pagos ---
  const handleOpenPago = (orden: OrdenCobranza) => {
    setOrdenParaPago(orden);
    setMontoPagar(orden.saldoPendiente.toString()); // Sugerir liquidar todo
    setFechaPago(new Date().toISOString().split('T')[0]);

    // Cargar otras órdenes pendientes del mismo cliente para elegir a cuál aplicar el pago
    const nombreCliente = typeof orden.cliente === 'string' ? orden.cliente : orden.cliente?.nombre;
    if (!nombreCliente) {
      setOrdenesClientePendientes([orden]);
      setOrdenSeleccionadaId(orden.id);
      return;
    }

    (async () => {
      // Cargar todas las ordenes del usuario con saldo pendiente
      let allOrdenes: OrdenCobranza[] = [];
      try {
        const allSnap = await getDocs(userQuery('ordenes', uid!));
        allOrdenes = allSnap.docs
          .filter(d => (d.data().saldoPendiente || 0) > 0)
          .map(d => ({ id: d.id, ...d.data() } as OrdenCobranza));
      } catch (err) {
        console.error('Error cargando órdenes del cliente:', err);
      }

      // Filtrar por nombre de cliente
      let lista = allOrdenes.filter(o => {
        const n = typeof o.cliente === 'string' ? o.cliente : o.cliente?.nombre;
        return n === nombreCliente;
      });

      const listaFinal = lista.length ? lista : [orden];
      setOrdenesClientePendientes(listaFinal);
      setOrdenSeleccionadaId(orden.id);

    })();
  };

  const handleSubmitPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ordenParaPago) return;

    // Validar selección de orden destino
    const ordenDestino = (ordenesClientePendientes || []).find(o => o.id === (ordenSeleccionadaId || ordenParaPago.id)) || ordenParaPago;
    if (!ordenDestino || ordenDestino.saldoPendiente <= 0) {
      return showToast('La orden seleccionada no tiene saldo pendiente', 'error');
    }

    const montoNum = parseFloat(montoPagar || '0') || 0;
    const totalAbono = montoNum;

    if (totalAbono <= 0) {
      return showToast('Ingresa un monto válido', 'error');
    }
    if (totalAbono > ordenDestino.saldoPendiente) {
      return showToast('El abono supera el saldo pendiente', 'error');
    }

    if (montoNum < 0) {
      return showToast('Monto inválido', 'error');
    }

    setSubmittingPago(true);
    try {
      const pagosARegistrar: Pago[] = [];
      if (montoNum > 0) {
        pagosARegistrar.push({
          monto: montoNum,
          fecha: fechaPago,
          metodo: metodoPago,
          registradoPor: 'Admin'
        });
      }

      const ordenRef = doc(db, 'ordenes', ordenDestino.id);

      await updateDoc(ordenRef, {
        pagos: arrayUnion(...pagosARegistrar),
        saldoPendiente: increment(-totalAbono),
        totalPagado: increment(totalAbono),
        estadoPago: (ordenDestino.saldoPendiente - totalAbono) <= 0 ? 'pagado' : 'parcial',
        fechaUltimaActualizacion: new Date().toISOString().split('T')[0]
      });

      // Registrar movimiento en finanzas (ingreso por pago de orden)
      const clienteNombre = typeof ordenDestino.cliente === 'string' ? ordenDestino.cliente : ordenDestino.cliente?.nombre;
      const finanzaRef = collection(db, 'finanzas');
      // Generar folio de transacción simple (puede migrarse a secuencial)
      const folioTransaccion = `TX-${ordenDestino.id.slice(0,6)}-${Date.now().toString().slice(-6)}`;

      if (montoNum > 0) {
        await addDoc(finanzaRef, withUserId({
          tipo: 'ingreso',
          categoria: 'pago_orden',
          monto: montoNum,
          metodo: metodoPago,
          fecha: fechaPago,
          cliente: clienteNombre || 'Desconocido',
          ordenId: ordenDestino.id,
          folio: ordenDestino.folio || folioTransaccion,
          pagoId: `p-${Date.now()}`,
          comentario: `Pago aplicado a orden ${ordenDestino.id}`,
          createdAt: Timestamp.now()
        }, uid!));
      }

      showToast(`Pago de $${totalAbono} registrado en la orden seleccionada`, 'success');
      // Preparar datos para abrir ReciboPago
      const saldoRestante = Math.max((ordenDestino.saldoPendiente || 0) - totalAbono, 0);
      const metodoRecibo = metodoPago;

      setReciboData({
        pago: { monto: totalAbono, fecha: fechaPago, metodo: metodoRecibo, registradoPor: 'Admin', folioTransaccion },
        ordenesDestino: [
          { id: ordenDestino.id, folio: ordenDestino.folio || null, cliente: ordenDestino.cliente, totalVenta: ordenDestino.totalVenta, saldoRestante, liquidada: saldoRestante <= 0 }
        ]
      });
      setOrdenParaPago(null);
      setOrdenesClientePendientes([]);
      setOrdenSeleccionadaId(null);
      fetchDeudas(); // Recargar lista
    } catch (error) {
      console.error(error);
      showToast("Error al registrar pago", "error");
    } finally {
      setSubmittingPago(false);
    }
  };

  // --- 4. Filtrado ---
  const filteredOrdenes = useMemo(() => {
    return ordenes.filter(o => {
      const nombreCliente = typeof o.cliente === 'string' ? o.cliente : o.cliente?.nombre || '';
      return nombreCliente.toLowerCase().includes(searchTerm.toLowerCase()) || 
             (o.folio && o.folio.includes(searchTerm));
    });
  }, [ordenes, searchTerm]);

  const totalPorCobrar = useMemo(() => ordenes.reduce((acc, curr) => acc + curr.saldoPendiente, 0), [ordenes]);

  // Agrupar por cliente para mostrar total por cliente y lista de órdenes
  const gruposPorCliente = useMemo(() => {
    const grupos = new Map<string, { cliente: string, totalDeuda: number, ordenes: OrdenCobranza[] }>();
    filteredOrdenes.forEach((o) => {
      const nombreCliente = typeof o.cliente === 'string' ? (o.cliente || 'Cliente sin nombre') : (o.cliente?.nombre || 'Cliente sin nombre');
      const key = nombreCliente.trim().toLowerCase();
      const existing = grupos.get(key);
      const itemNames = (o.items || []).map((it: any) => it?.nombre).filter(Boolean);
      const uniqueNames = Array.from(new Set(itemNames));
      // Adjuntar un campo auxiliar para mostrar en UI sin cambiar Firestore
      const withSummary = { ...o, _itemsSummary: uniqueNames } as OrdenCobranza & { _itemsSummary?: string[] };
      if (existing) {
        existing.totalDeuda += o.saldoPendiente || 0;
        existing.ordenes.push(withSummary);
      } else {
        grupos.set(key, { cliente: nombreCliente, totalDeuda: o.saldoPendiente || 0, ordenes: [withSummary] });
      }
    });
    return Array.from(grupos.values()).sort((a, b) => b.totalDeuda - a.totalDeuda);
  }, [filteredOrdenes]);

  const saldoPendienteSeleccionado = ordenSeleccionadaPago?.saldoPendiente || 0;
  const totalAbonoPreview = parseFloat(montoPagar || '0') || 0;

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 pb-20">
      
      {/* Header Financiero */}
      <div className="max-w-5xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <BanknotesIcon className="h-7 w-7 text-blue-600" />
              Cobranza y Pagos
            </h1>
            <p className="text-gray-500 text-sm">Gestiona los adeudos de clientes</p>
          </div>
          
          <div className="flex gap-3">
            <div className="bg-white px-6 py-3 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Cuentas por Cobrar</p>
                <p className="text-2xl font-bold text-red-600">${totalPorCobrar.toLocaleString()}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
                <ClockIcon className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <button
              onClick={() => {
                if (!isBusiness) {
                  requireBusiness('Historial de Pagos', 'Consulta el historial completo de pagos con el plan Business.');
                  return;
                }
                setHistorialOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl shadow-sm font-medium transition-colors flex items-center gap-2"
            >
              <DocumentArrowDownIcon className="h-5 w-5" />
              Historial
              {!isBusiness && (
                <span className="text-[10px] font-bold bg-white/20 text-white px-1.5 py-0.5 rounded-full">PRO</span>
              )}
            </button>
          </div>
        </div>

        {/* Buscador */}
        <div className="mt-6 relative">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input 
            type="text"
            placeholder="Buscar cliente o folio..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Lista agrupada por Cliente */}
      <div className="max-w-5xl mx-auto space-y-4">
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>
        ) : gruposPorCliente.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm">
            <p className="text-gray-500">No hay clientes con deuda pendiente</p>
          </div>
        ) : (
          gruposPorCliente.map((grupo) => (
            <div key={grupo.cliente} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-lg">{grupo.cliente}</h3>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase">Total deuda</p>
                  <p className="text-xl font-bold text-gray-800">${grupo.totalDeuda.toLocaleString()}</p>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {grupo.ordenes.map((orden) => {
                  const status = getCobranzaStatus(orden);
                  const resumenNombres = (orden as any)._itemsSummary as string[] | undefined;
                  const maxNames = 4;
                  const shown = (resumenNombres || []).slice(0, maxNames);
                  const remaining = Math.max(0, (resumenNombres || []).length - shown.length);
                  return (
                    <div key={orden.id} className="py-3 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {orden.folio && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">#{orden.folio}</span>}
                          <div className={`px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1 ${status.color}`}>
                            <ClockIcon className="h-3 w-3" />
                            {status.dias === 0 ? 'Hoy' : `Hace ${status.dias} días`}
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          <span className="font-medium">Prendas:</span> {shown.join(', ')}{remaining > 0 ? ` (+${remaining} más)` : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase">Deuda</p>
                        <p className="text-base font-bold text-gray-800">${orden.saldoPendiente.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">Total: ${orden.totalVenta.toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            if (!isBusiness) {
                              requireBusiness('Resumen de Orden', 'Visualiza el resumen detallado de cada orden con el plan Business.');
                              return;
                            }
                            setOrdenParaResumen(orden.id);
                          }}
                          className="py-2 px-3 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-medium transition-colors border border-gray-200"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleOpenPago(orden)}
                          className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-transform active:scale-95"
                        >
                          <BanknotesIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* --- MODAL DE REGISTRO DE PAGO --- */}
      {ordenParaPago && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fadeIn">
            <div className="bg-blue-600 p-4 flex justify-between items-center">
              <h3 className="text-white font-bold flex items-center gap-2">
                <BanknotesIcon className="h-5 w-5"/>
                Registrar Pago
              </h3>
              <button onClick={() => setOrdenParaPago(null)} className="text-blue-100 hover:text-white">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmitPago} className="p-5 space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Cliente</p>
                <p className="font-bold text-gray-800 text-lg">
                  {typeof ordenParaPago.cliente === 'string' ? ordenParaPago.cliente : ordenParaPago.cliente?.nombre}
                </p>
                <p className="text-xs text-red-500 mt-1">Saldo actual: ${ordenParaPago.saldoPendiente}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto a pagar</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    max={saldoPendienteSeleccionado}
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-lg text-gray-800"
                    value={montoPagar}
                    onChange={(e) => setMontoPagar(e.target.value)}
                  />
                </div>
              </div>


              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Total a abonar</p>
                  <p className="text-sm text-gray-600">Saldo pendiente: ${saldoPendienteSeleccionado.toFixed(2)}</p>
                </div>
                <p className="text-xl font-bold text-gray-900">${totalAbonoPreview.toFixed(2)}</p>
              </div>

              {/* Selección de orden con saldo del cliente */}
              {ordenesClientePendientes.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Aplicar a orden</label>
                  <select
                    className="w-full py-2 pl-2 pr-2 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 bg-white"
                    value={ordenSeleccionadaId || ordenParaPago.id}
                    onChange={(e) => setOrdenSeleccionadaId(e.target.value)}
                  >
                    {ordenesClientePendientes.map((o) => (
                      <option key={o.id} value={o.id}>
                        {(o.folio ? `#${o.folio} ` : '')}Saldo: ${o.saldoPendiente.toFixed(2)} | Total: ${o.totalVenta.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                   <div className="relative">
                     <input 
                        type="date" 
                        required
                        className="w-full py-2 pl-2 pr-2 text-sm border border-gray-300 rounded-lg focus:ring-blue-500"
                        value={fechaPago}
                        onChange={(e) => setFechaPago(e.target.value)}
                      />
                   </div>
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Método</label>
                   <select 
                      className="w-full py-2 pl-2 pr-2 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 bg-white"
                      value={metodoPago}
                      onChange={(e) => setMetodoPago(e.target.value)}
                   >
                     <option value="Efectivo">Efectivo</option>
                     <option value="Transferencia">Transferencia</option>
                     <option value="Tarjeta">Tarjeta</option>
                   </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submittingPago}
                  className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold shadow-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center"
                >
                  {submittingPago ? 'Registrando...' : 'Confirmar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL DE RESUMEN / NOTA (Componente Externo) --- */}
      {ordenParaResumen && (
        <ResumenOrden 
          isOpen={true}
          orden={ordenes.find(o => o.id === ordenParaResumen) as any}
          onClose={() => setOrdenParaResumen(null)} 
          esEntregaPersonal={esEntregaPersonal}
        />
      )}

      {/* Recibo de Pago */}
      {reciboData && (
        <ReciboPago
          isOpen={true}
          pago={reciboData.pago}
          ordenesDestino={reciboData.ordenesDestino}
          onClose={() => setReciboData(null)}
        />
      )}

      {/* Historial de Pagos */}
      <HistorialPagos
        isOpen={historialOpen}
        onClose={() => setHistorialOpen(false)}
      />

      <UpgradeModal {...upgradeProps} />

    </div>
  );
};

export default Pagos;