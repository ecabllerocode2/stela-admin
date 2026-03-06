import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, runTransaction, arrayUnion, Timestamp, increment } from 'firebase/firestore';
import { db } from '../credenciales';
import showToast from '../utils/toast';
import { ArrowUturnLeftIcon, MagnifyingGlassIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import type { ItemDevuelto, Orden } from '../types/orden';
import { useAuth } from '../contexts';
import { userQuery, withUserId } from '../utils/multitenancy';

interface OrdenEntregada extends Orden {
  estadoPedido: 'entregado';
  pagos?: Array<{ monto: number; fecha: string; metodo: string }>;
  totalPagado?: number;
  saldoPendiente?: number;
}

const Devoluciones: React.FC = () => {
  const { user } = useAuth();
  const uid = user?.uid;
  const [loading, setLoading] = useState(true);
  const [ordenes, setOrdenes] = useState<OrdenEntregada[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<OrdenEntregada | null>(null);
  const [itemsSeleccionados, setItemsSeleccionados] = useState<Set<string>>(new Set());
  const [motivos, setMotivos] = useState<{ [key: string]: string }>({});
  const [metodoReembolso, setMetodoReembolso] = useState<'dinero' | 'saldo_favor' | 'ambos'>('saldo_favor');
  const [notas, setNotas] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Cargar órdenes entregadas
  useEffect(() => {
    if (!uid) return;
    const fetchOrdenes = async () => {
      try {
        const q = userQuery('ordenes', uid);
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as OrdenEntregada))
          .filter(o => o.estadoPedido === 'entregado');
        setOrdenes(data);
      } catch (error) {
        console.error('Error cargando órdenes entregadas:', error);
        showToast('Error al cargar órdenes entregadas', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchOrdenes();
  }, [uid]);

  const filteredOrdenes = useMemo(() => {
    return ordenes.filter(o => {
      const nombreCliente = typeof o.cliente === 'string' ? o.cliente : o.cliente?.nombre || '';
      return nombreCliente.toLowerCase().includes(searchTerm.toLowerCase()) || 
             (o.id || '').toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [ordenes, searchTerm]);

  const handleAbrirModal = (orden: OrdenEntregada) => {
    setOrdenSeleccionada(orden);
    setItemsSeleccionados(new Set());
    setMotivos({});
    setMetodoReembolso('saldo_favor');
    setNotas('');
    setModalOpen(true);
  };

  const toggleItem = (itemIndex: string) => {
    const newSet = new Set(itemsSeleccionados);
    if (newSet.has(itemIndex)) {
      newSet.delete(itemIndex);
      const newMotivos = { ...motivos };
      delete newMotivos[itemIndex];
      setMotivos(newMotivos);
    } else {
      newSet.add(itemIndex);
    }
    setItemsSeleccionados(newSet);
  };

  const handleSubmitDevolucion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ordenSeleccionada || itemsSeleccionados.size === 0) {
      return showToast('Selecciona al menos un ítem para devolver', 'error');
    }

    // Validar que todos los items seleccionados tengan motivo
    const itemsArray = Array.from(itemsSeleccionados);
    for (const itemIdx of itemsArray) {
      if (!motivos[itemIdx]) {
        return showToast('Completa la razón de devolución para todos los ítems', 'error');
      }
    }

    setSubmitting(true);
    try {
      const itemsADevolver: ItemDevuelto[] = [];
      let totalDevuelto = 0;
      const clienteNombre = typeof ordenSeleccionada.cliente === 'string' 
        ? ordenSeleccionada.cliente 
        : ordenSeleccionada.cliente?.nombre || 'Cliente desconocido';

      // Construir lista de items a devolver
      itemsArray.forEach((itemIdx) => {
        const idx = parseInt(itemIdx);
        const item = ordenSeleccionada.items[idx];
        if (item) {
          const itemDevuelto: ItemDevuelto & { origen?: string } = {
            nombre: item.nombre,
            talla: item.talla,
            color: item.color,
            cantidad: item.cantidad || 1,
            precioUnitario: item.precio,
            razon: motivos[itemIdx],
            imagen: item.foto,
            productoId: item.productoId || item.productoID || item.producto || '',
            variantId: typeof item.variantId === 'number' ? item.variantId : undefined,
            sku: item.sku || '',
            origen: item.origen // Preservamos el origen para saber si devolver stock
          };
          itemsADevolver.push(itemDevuelto);
          totalDevuelto += itemDevuelto.cantidad * itemDevuelto.precioUnitario;
        }
      });

      const fechaHoy = new Date().toISOString().split('T')[0];
      const devolucionRef = doc(collection(db, 'devoluciones'));
      const reembolsoMonto = metodoReembolso === 'dinero' ? totalDevuelto : 
                             metodoReembolso === 'ambos' ? Math.floor(totalDevuelto / 2) : 0;
      const saldoFavor = metodoReembolso === 'saldo_favor' ? totalDevuelto :
                         metodoReembolso === 'ambos' ? totalDevuelto - reembolsoMonto : 0;

      // Obtener clientes crédito actuales FUERA de la transacción
      const creditosSnap = await getDocs(userQuery('clientes_credito', uid!));
      const creditosMap = new Map();
      creditosSnap.docs.forEach(doc => {
        const data = doc.data();
        creditosMap.set(data.cliente?.toLowerCase() || '', { docId: doc.id, docRef: doc.ref, data });
      });

      // Limpiar items para evitar valores undefined en Firestore
      const itemsADevolverSanitized = itemsADevolver.map((it) => {
        const copy: any = { ...it };
        if (copy.variantId === undefined) delete copy.variantId;
        if (!copy.productoId) delete copy.productoId;
        if (!copy.sku) delete copy.sku;
        return copy;
      });

      // Índice de productos para búsquedas de respaldo
      const productosSnap = await getDocs(userQuery('productos', uid!));
      const productosIndex = productosSnap.docs.map(d => ({ id: d.id, data: d.data() }));

      // Resolver productId antes de la transacción para no leer más dentro
      const itemsADevolverResolved = itemsADevolverSanitized.map((it) => {
        let productIdToUse = it.productoId as string | undefined;

        if (!productIdToUse && it.sku) {
          const foundBySku = productosIndex.find(p => (p.data.variants || []).some((v: any) =>
            (v.sizes || []).some((s: any) => (s.variantSku || '').toLowerCase() === it.sku!.toLowerCase())
          ));
          productIdToUse = foundBySku?.id;
        }

        if (!productIdToUse) {
          const foundByColor = productosIndex.find(p => (p.data.variants || []).some((v: any) =>
            v.colorName?.toLowerCase() === (it.color || '').toLowerCase()
          ));
          productIdToUse = foundByColor?.id;
        }

        return { ...it, productIdResolved: productIdToUse };
      }).filter(it => it.productIdResolved);

      await runTransaction(db, async (transaction) => {
        // Leer todos los productos necesarios ANTES de cualquier escritura
        const productCache = new Map<string, { ref: any; data: any; dirty: boolean }>();
        const uniqueProductIds = Array.from(new Set(itemsADevolverResolved.map(it => it.productIdResolved as string)));

        for (const pid of uniqueProductIds) {
          const prodRef = doc(db, 'productos', pid);
          const prodDoc = await transaction.get(prodRef);
          if (!prodDoc.exists()) {
            console.warn(`Producto inexistente en Firestore: ${pid}`);
            continue;
          }
          productCache.set(pid, { ref: prodRef, data: prodDoc.data(), dirty: false });
        }
        // 1. Crear documento de devolución
        const devolucionDataBase = {
          ordenId: ordenSeleccionada.id,
          cliente: ordenSeleccionada.cliente,
          items: itemsADevolverSanitized,
          totalDevuelto,
          metodoReembolso,
          fechaDevolucion: fechaHoy,
          estadoDevolucion: 'procesada' as const,
          registradoPor: 'Admin',
          fechaCreacion: fechaHoy,
          timestamp: Timestamp.now()
        };

        // Agregar campos opcionales solo si tienen valor
        const devolucionData = {
          ...devolucionDataBase,
          ...(saldoFavor > 0 && { saldoFavor }),
          ...(reembolsoMonto > 0 && { reembolsoMonto }),
          ...(notas && { notas })
        };
        
        transaction.set(devolucionRef, withUserId(devolucionData, uid!));

        // 2. Actualizar stock en productos (sumar cantidad devuelta SOLO SI origen es 'stock')
        for (const itemDevuelto of itemsADevolverResolved) {
          // Si el producto no salió del stock (fue bajo pedido), NO lo regresamos al inventario
          if ((itemDevuelto as any).origen !== 'stock') {
            continue;
          }

          const productIdToUse = itemDevuelto.productIdResolved as string;
          const cacheEntry = productCache.get(productIdToUse);
          if (!cacheEntry) {
            console.warn(`Producto no encontrado para devolución: ${itemDevuelto.nombre} ${itemDevuelto.color} ${itemDevuelto.talla}`);
            continue;
          }

          const prodData = cacheEntry.data as any;
          const variants = prodData.variants || [];

          let variantIdx = -1;
          if (typeof itemDevuelto.variantId === 'number') {
            variantIdx = variants.findIndex((v: any) => v.id === itemDevuelto.variantId);
          }
          if (variantIdx === -1) {
            variantIdx = variants.findIndex((v: any) => v.colorName?.toLowerCase() === (itemDevuelto.color || '').toLowerCase());
          }
          if (variantIdx === -1) {
            console.warn(`Variante no encontrada para devolución: ${itemDevuelto.nombre} ${itemDevuelto.color}`);
            continue;
          }

          const sizes = variants[variantIdx].sizes || [];
          const sizeIdx = sizes.findIndex((s: any) => s.size === itemDevuelto.talla);
          if (sizeIdx === -1) {
            console.warn(`Talla no encontrada para devolución: ${itemDevuelto.nombre} ${itemDevuelto.talla}`);
            continue;
          }

          sizes[sizeIdx].stock = (sizes[sizeIdx].stock || 0) + itemDevuelto.cantidad;
          sizes[sizeIdx].isInStock = sizes[sizeIdx].stock > 0;
          variants[variantIdx].sizes = sizes;

          cacheEntry.data = { ...prodData, variants };
          cacheEntry.dirty = true;
          productCache.set(productIdToUse, cacheEntry);
        }

        // Actualizar todos los productos modificados
        for (const entry of productCache.values()) {
          if (entry.dirty) {
            transaction.update(entry.ref, { variants: entry.data.variants });
          }
        }

        // 3. Crear movimiento en inventory_movements (entrada por devolución)
        const movementRef = doc(collection(db, 'inventory_movements'));
        const cantidadTotalMov = itemsADevolverSanitized.reduce((acc, it) => acc + (it.cantidad || 0), 0);
        transaction.set(movementRef, withUserId({
          tipo: 'entrada',
          motivo: 'devolucion',
          cantidad: cantidadTotalMov,
          items: itemsADevolverSanitized.map(i => `${i.nombre} (${i.talla})`).join(', '),
          cliente: clienteNombre,
          devolucionId: devolucionRef.id,
          ordenId: ordenSeleccionada.id,
          fechaRegistro: fechaHoy,
          timestamp: Timestamp.now()
        }, uid!));

        // 4. Si hay reembolso en dinero, crear movimiento en finanzas
        if (reembolsoMonto > 0) {
          const finanzasRef = doc(collection(db, 'finanzas'));
          transaction.set(finanzasRef, withUserId({
            tipo: 'egreso',
            categoria: 'reembolso_devolucion',
            monto: reembolsoMonto,
            cliente: clienteNombre,
            ordenId: ordenSeleccionada.id,
            devolucionId: devolucionRef.id,
            fecha: fechaHoy,
            comentario: `Reembolso por devolución de ${itemsADevolver.length} ítem(s)`,
            createdAt: Timestamp.now()
          }, uid!));

          // Actualizar saldo pendiente si hay reembolso
          if (reembolsoMonto > 0) {
            const ordenRef = doc(db, 'ordenes', ordenSeleccionada.id);
            transaction.update(ordenRef, {
              saldoPendiente: increment(-reembolsoMonto),
              totalPagado: increment(reembolsoMonto),
              estadoPago: (ordenSeleccionada.saldoPendiente || 0) - reembolsoMonto <= 0 ? 'pagado' : 'parcial',
              fechaUltimaActualizacion: fechaHoy
            });
          }
        }

        // 5. Si hay saldo a favor, crear/actualizar en clientes_credito
        if (saldoFavor > 0) {
          const clienteNombreLower = (clienteNombre).toLowerCase().trim();
          const creditInfo = creditosMap.get(clienteNombreLower);

          const balance_anterior = creditInfo?.data?.saldoTotal || 0;
          const balance_nuevo = balance_anterior + saldoFavor;

          if (creditInfo) {
            transaction.update(creditInfo.docRef, {
              saldoTotal: balance_nuevo,
              movimientos: arrayUnion({
                tipo: 'devolucion',
                monto: saldoFavor,
                referencia: devolucionRef.id,
                fecha: fechaHoy,
                balance_anterior,
                balance_nuevo
              }),
              fechaActualizacion: fechaHoy,
              timestamp: Timestamp.now()
            });
          } else {
            const creditRef = doc(collection(db, 'clientes_credito'));
            transaction.set(creditRef, withUserId({
              cliente: clienteNombre,
              saldoTotal: saldoFavor,
              movimientos: [{
                tipo: 'devolucion',
                monto: saldoFavor,
                referencia: devolucionRef.id,
                fecha: fechaHoy,
                balance_anterior: 0,
                balance_nuevo: saldoFavor
              }],
              fechaCreacion: Timestamp.now(),
              timestamp: Timestamp.now()
            }, uid!));
          }
        }

        // 6. Actualizar/eliminar orden: remover items devueltos
        const itemsIndicesDevueltos = new Set(itemsArray.map(idx => parseInt(idx)));
        const itemsRestantes = (ordenSeleccionada.items || []).filter((_, idx) => !itemsIndicesDevueltos.has(idx));

        if (itemsRestantes.length === 0) {
          // Si no quedan items, eliminar la orden (o marcar como cancelada)
          const ordenRef = doc(db, 'ordenes', ordenSeleccionada.id);
          transaction.delete(ordenRef);
        } else {
          // Si quedan items, actualizar la orden removiendo los devueltos
          const ordenRef = doc(db, 'ordenes', ordenSeleccionada.id);
          // CRÍTICO: Leer la orden actual para obtener totalPagado
          const ordenDocActual = await transaction.get(ordenRef);
          const ordenActualData = ordenDocActual.data();
          const totalPagadoActual = ordenActualData?.totalPagado || 0;
          
          const newTotal = itemsRestantes.reduce((acc, item) => acc + (item.precio || 0), 0);
          // ✅ Recalcular saldo preservando pagos previos
          const nuevoSaldoPendiente = Math.max(0, newTotal - totalPagadoActual);
          
          transaction.update(ordenRef, {
            items: itemsRestantes,
            totalVenta: newTotal,
            saldoPendiente: nuevoSaldoPendiente, // ✅ Preserva pagos previos
            descuentoPorcentaje: 0,
            descuentoMonto: 0,
            fechaUltimaActualizacion: fechaHoy
          });
        }
      });

      showToast(`Devolución procesada correctamente. Total: $${totalDevuelto}`, 'success');
      setModalOpen(false);
      setOrdenSeleccionada(null);
      // Recargar órdenes
      const q = userQuery('ordenes', uid!);
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as OrdenEntregada))
        .filter(o => o.estadoPedido === 'entregado');
      setOrdenes(data);
    } catch (error) {
      console.error('Error procesando devolución:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      showToast(`Error: ${errorMsg}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 pb-20">
      
      <div className="max-w-5xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <ArrowUturnLeftIcon className="h-7 w-7 text-amber-600" />
              Devoluciones y Cambios
            </h1>
            <p className="text-gray-500 text-sm">Gestiona devoluciones de órdenes entregadas</p>
          </div>
        </div>

        <div className="mt-6 relative">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input 
            type="text"
            placeholder="Buscar cliente u orden..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border-gray-200 shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-4">
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600"></div></div>
        ) : filteredOrdenes.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm">
            <p className="text-gray-500">No hay órdenes entregadas disponibles</p>
          </div>
        ) : (
          filteredOrdenes.map((orden) => {
            const nombreCliente = typeof orden.cliente === 'string' ? orden.cliente : orden.cliente?.nombre || 'Cliente sin nombre';
            const itemCount = (orden.items || []).length;

            return (
              <div key={orden.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all hover:shadow-md">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg">{nombreCliente}</h3>
                  <p className="text-xs text-gray-500 mt-1">ID: {orden.id.slice(0, 12)}...</p>
                  <p className="text-sm text-gray-600 mt-1">Ítems: {itemCount} | Total: ${orden.totalVenta.toLocaleString()}</p>
                </div>

                <button 
                  onClick={() => handleAbrirModal(orden)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
                >
                  <ArrowUturnLeftIcon className="h-4 w-4" />
                  Procesar Devolución
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL */}
      {modalOpen && ordenSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-y-auto max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-800">Procesar Devolución</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitDevolucion} className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Cliente</p>
                <p className="font-bold text-gray-800">{typeof ordenSeleccionada.cliente === 'string' ? ordenSeleccionada.cliente : ordenSeleccionada.cliente?.nombre}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Selecciona ítems a devolver</label>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                  {(ordenSeleccionada.items || []).map((item, idx) => (
                    <div key={idx} className="border border-gray-200 p-3 rounded-lg hover:bg-gray-50">
                      <div className="flex items-start gap-3">
                        <input 
                          type="checkbox" 
                          checked={itemsSeleccionados.has(idx.toString())}
                          onChange={() => toggleItem(idx.toString())}
                          className="mt-1 rounded"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.nombre}</p>
                          <p className="text-xs text-gray-600">{item.color} | {item.talla}</p>
                          <p className="text-sm text-gray-700 mt-1 font-semibold">${item.precio}</p>
                        </div>
                      </div>

                      {itemsSeleccionados.has(idx.toString()) && (
                        <div className="mt-3 ml-7 pt-3 border-t border-gray-200">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Razón de devolución</label>
                          <select 
                            value={motivos[idx] || ''}
                            onChange={(e) => setMotivos({ ...motivos, [idx]: e.target.value })}
                            className="w-full text-sm border border-gray-300 rounded p-2 bg-white"
                          >
                            <option value="">-- Selecciona razón --</option>
                            <option value="defecto">Defecto del producto</option>
                            <option value="no_ajusta">No ajusta/talla incorrecta</option>
                            <option value="cambio_opinion">Cambio de opinión</option>
                            <option value="dano_envio">Dañado en envío</option>
                            <option value="otro">Otro</option>
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Método de reembolso</label>
                <div className="space-y-2">
                  {(['saldo_favor', 'dinero', 'ambos'] as const).map((metodo) => (
                    <label key={metodo} className="flex items-center gap-3 p-2 border border-gray-200 rounded cursor-pointer hover:bg-gray-50">
                      <input 
                        type="radio" 
                        value={metodo}
                        checked={metodoReembolso === metodo}
                        onChange={(e) => setMetodoReembolso(e.target.value as any)}
                        className="rounded-full"
                      />
                      <div>
                        <p className="font-medium text-gray-800">
                          {metodo === 'saldo_favor' && 'Saldo a favor'}
                          {metodo === 'dinero' && 'Reembolso en dinero'}
                          {metodo === 'ambos' && 'Ambos (mitad y mitad)'}
                        </p>
                        <p className="text-xs text-gray-600">
                          {metodo === 'saldo_favor' && 'El cliente puede usar en próximas compras'}
                          {metodo === 'dinero' && 'Reembolso inmediato del monto'}
                          {metodo === 'ambos' && 'Dividir entre saldo a favor y dinero'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea 
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Observaciones adicionales..."
                  className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-amber-500"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button 
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckIcon className="h-4 w-4" />
                  {submitting ? 'Procesando...' : 'Confirmar Devolución'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Devoluciones;
