import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  addDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../credenciales';
import showToast from '../utils/toast';
import { useAuth } from '../contexts';
import { userQuery, withUserId } from '../utils/multitenancy';
import {
  CurrencyDollarIcon,
  CheckCircleIcon,
  TrashIcon,
  ShoppingBagIcon,
  TruckIcon,
  CreditCardIcon,
  CubeIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';
import SafeImage from './SafeImage';
import html2canvas from 'html2canvas';

// Logo de la empresa
const logoNegro = '/icons/stela-logo.png';

// --- Interfaces ---
interface CompraItem {
  nombre: string;
  sku: string;
  talla: string;
  color: string;
  foto: string;
  costo: number;
  precio: number;
  proveedor: string;
  origen: string;
  comprado: boolean;
  cancelado?: boolean;
  pagadoProveedor?: boolean;

  orderId: string;
  itemIndex: number;
  clienteNombre: string;
  fechaOrden: string;
  tipo: 'orden'; // Para distinguir de movimientos de inventario
}

interface InventoryMovementItem {
  id: string;
  nombre: string;
  sku: string;
  talla: string;
  color: string;
  foto: string;
  costo: number;
  precio: number;
  proveedor: string;
  cantidad: number;
  comprado: boolean;
  pagadoProveedor?: boolean;
  fechaRegistro: string;
  
  productoId: string;
  variantId: number;
  tipo: 'inventario'; // Para distinguir de órdenes
}

interface GroupedProvider {
  proveedor: string;
  items: (CompraItem | InventoryMovementItem)[];
  totalPagar: number;
}

const Compras: React.FC = () => {
  const { user } = useAuth();
  const uid = user?.uid;
  const [loading, setLoading] = useState(true);
  const [itemsByProvider, setItemsByProvider] = useState<GroupedProvider[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [exportingProv, setExportingProv] = useState<string | null>(null);

  const fetchCompras = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      // 1. Cargar items de órdenes (flujo existente)
      const q = userQuery('ordenes', uid);

      const snapshot = await getDocs(q);
      const tempItems: (CompraItem | InventoryMovementItem)[] = [];

      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (data.estadoPedido === 'entregado') return;
        const items = data.items || [];

        items.forEach((item: any, index: number) => {
          // Incluir solo items NO comprados y NO cancelados
          if (item.comprado === false && !item.cancelado) {
            tempItems.push({
              ...item,
              orderId: d.id,
              itemIndex: index,
              clienteNombre: data.cliente?.nombre || 'Cliente desconocido',
              fechaOrden: data.fechaCreacion || '',
              pagadoProveedor: item.pagadoProveedor || false,
              tipo: 'orden'
            } as CompraItem);
          }
        });
      });

      // 2. Cargar movimientos de inventario NO comprados
      const qInventory = userQuery('inventory_movements', uid);

      const inventorySnapshot = await getDocs(qInventory);
      
      inventorySnapshot.docs.forEach((d) => {
        const data = d.data();
        // Filtrar: solo entradas, no comprados, no cancelados
        if (data.tipo !== 'entrada' || data.comprado !== false || data.cancelado === true) return;
        
        tempItems.push({
          id: d.id,
          nombre: data.productoNombre || '',
          sku: data.sku || '',
          talla: data.talla || '',
          color: data.color || '',
          foto: data.imageUrl || '', // Usar la URL guardada en el movimiento
          costo: data.costo || 0,
          precio: data.precioPublico || 0,
          proveedor: data.proveedor || 'Sin Proveedor',
          cantidad: data.cantidad || 1,
          comprado: false,
          pagadoProveedor: data.pagadoProveedor || false,
          fechaRegistro: data.fechaRegistro || '',
          productoId: data.productoId || '',
          variantId: data.variantId || 0,
          tipo: 'inventario'
        } as InventoryMovementItem);
      });

      const grouped = tempItems.reduce((acc, item) => {
        const provName = item.proveedor || 'Sin Proveedor';
        if (!acc[provName]) {
          acc[provName] = { proveedor: provName, items: [], totalPagar: 0 };
        }
        acc[provName].items.push(item);

        // Calcular total según tipo
        if (item.tipo === 'orden') {
          const ordenItem = item as CompraItem;
          if (!ordenItem.pagadoProveedor) {
            acc[provName].totalPagar += Number(item.costo || 0);
          }
        } else {
          // Items de inventario
          const invItem = item as InventoryMovementItem;
          if (!invItem.pagadoProveedor) {
            acc[provName].totalPagar += Number(item.costo || 0) * invItem.cantidad;
          }
        }

        return acc;
      }, {} as Record<string, GroupedProvider>);

      setItemsByProvider(Object.values(grouped));
    } catch (error) {
      console.error('Error cargando compras:', error);
      showToast('Error al cargar la lista de compras', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompras();
  }, [uid]);

  const grandTotal = useMemo(() => {
    return itemsByProvider.reduce((acc, prov) => acc + prov.totalPagar, 0);
  }, [itemsByProvider]);

  const totalPrendas = useMemo(() => {
    return itemsByProvider.reduce((acc, prov) => acc + prov.items.length, 0);
  }, [itemsByProvider]);

  const updateItemStatus = async (
    item: CompraItem,
    updates: Partial<CompraItem>,
    successMessage: string
  ) => {
    setProcessingId(`${item.orderId}-${item.itemIndex}`);

    try {
      const orderRef = doc(db, 'ordenes', item.orderId);
      const orderSnap = await getDoc(orderRef);

      if (!orderSnap.exists()) throw new Error('La orden ya no existe');

      const orderData = orderSnap.data();
      const currentItems = [...orderData.items];

      currentItems[item.itemIndex] = {
        ...currentItems[item.itemIndex],
        ...updates
      };

      await updateDoc(orderRef, { items: currentItems });

      showToast(successMessage, 'success');
      await fetchCompras();
    } catch (error) {
      console.error('Error actualizando item:', error);
      showToast('Error al actualizar el estado', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarcarComprado = async (item: CompraItem) => {
    if (!window.confirm(`¿Marcar como comprado "${item.nombre} (${item.color} - ${item.talla})"? Se registrará un gasto de $${item.costo.toLocaleString()}.`)) {
      return;
    }
    setProcessingId(`${item.orderId}-${item.itemIndex}`);

    try {
      const orderRef = doc(db, 'ordenes', item.orderId);
      const orderSnap = await getDoc(orderRef);

      if (!orderSnap.exists()) throw new Error('La orden ya no existe');

      const orderData = orderSnap.data();
      const currentItems = [...orderData.items];
      const wasAlreadyPaid = currentItems[item.itemIndex].pagadoProveedor === true;

      // Siempre marcar como comprado Y pagado
      currentItems[item.itemIndex] = {
        ...currentItems[item.itemIndex],
        comprado: true,
        pagadoProveedor: true
      };

      await updateDoc(orderRef, { items: currentItems });

      // Solo registrar en finanzas si NO estaba pagado previamente
      if (!wasAlreadyPaid) {
        const fechaHoy = new Date().toISOString().split('T')[0];
        const folioTransaccion = `GC-${item.orderId.slice(0,6)}-${Date.now().toString().slice(-6)}`;
        
        await addDoc(collection(db, 'finanzas'), withUserId({
          tipo: 'gasto',
          categoria: 'compra_proveedor',
          subcategoria: item.origen === 'stock' ? 'reposicion_inventario' : 'pedido_cliente',
          monto: item.costo,
          proveedor: item.proveedor,
          fecha: fechaHoy,
          producto: item.nombre,
          sku: item.sku,
          talla: item.talla,
          color: item.color,
          ordenId: item.orderId,
          cliente: item.clienteNombre,
          folio: folioTransaccion,
          comentario: `Compra de ${item.nombre} (${item.color} - ${item.talla}) al proveedor ${item.proveedor}`,
          createdAt: Timestamp.now()
        }, uid!));
      }

      showToast(
        wasAlreadyPaid 
          ? 'Prenda recibida correctamente' 
          : 'Prenda comprada, gasto registrado',
        'success'
      );
      await fetchCompras();
    } catch (error) {
      console.error('Error actualizando item:', error);
      showToast('Error al actualizar el estado', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarcarPagado = async (item: CompraItem) => {
    if (!window.confirm(`¿Marcar como pagado "${item.nombre}"? Se registrará un gasto anticipado de $${item.costo.toLocaleString()}.`)) {
      return;
    }
    setProcessingId(`${item.orderId}-${item.itemIndex}`);

    try {
      const orderRef = doc(db, 'ordenes', item.orderId);
      const orderSnap = await getDoc(orderRef);

      if (!orderSnap.exists()) throw new Error('La orden ya no existe');

      const orderData = orderSnap.data();
      const currentItems = [...orderData.items];

      currentItems[item.itemIndex] = {
        ...currentItems[item.itemIndex],
        pagadoProveedor: true
      };

      await updateDoc(orderRef, { items: currentItems });

      // Registrar gasto en finanzas (pago sin recibir)
      const fechaHoy = new Date().toISOString().split('T')[0];
      const folioTransaccion = `GP-${item.orderId.slice(0,6)}-${Date.now().toString().slice(-6)}`;
      
      await addDoc(collection(db, 'finanzas'), withUserId({
        tipo: 'gasto',
        categoria: 'pago_proveedor',
        subcategoria: item.origen === 'stock' ? 'reposicion_inventario' : 'pedido_cliente',
        monto: item.costo,
        proveedor: item.proveedor,
        fecha: fechaHoy,
        producto: item.nombre,
        sku: item.sku,
        talla: item.talla,
        color: item.color,
        ordenId: item.orderId,
        cliente: item.clienteNombre,
        folio: folioTransaccion,
        comentario: `Pago anticipado de ${item.nombre} (${item.color} - ${item.talla}) al proveedor ${item.proveedor}`,
        createdAt: Timestamp.now()
      }, uid!));

      showToast('Pago registrado. Costo restado del total.', 'success');
      await fetchCompras();
    } catch (error) {
      console.error('Error actualizando item:', error);
      showToast('Error al actualizar el estado', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancelar = (item: CompraItem) => {
    if (window.confirm(`¿Estás seguro de cancelar la compra de ${item.nombre}? Desaparecerá de esta lista.`)) {
      // Según solicitud: comprado = false, cancelado = true
      updateItemStatus(item, { comprado: false, cancelado: true }, 'Ítem marcado como cancelado');
    }
  };

  // Nueva función para marcar como comprado un movimiento de inventario
  const handleMarcarCompradoInventario = async (item: InventoryMovementItem) => {
    if (!window.confirm(`¿Marcar como comprado ${item.cantidad} unidad(es) de "${item.nombre}"? Se registrará un gasto de $${(item.costo * item.cantidad).toLocaleString()}.`)) {
      return;
    }
    setProcessingId(item.id);

    try {
      const wasAlreadyPaid = item.pagadoProveedor === true;

      await runTransaction(db, async (transaction) => {
        // IMPORTANTE: Todas las lecturas deben ir ANTES de las escrituras
        
        // 1. Leer el movimiento
        const movementRef = doc(db, 'inventory_movements', item.id);
        const movementDoc = await transaction.get(movementRef);

        if (!movementDoc.exists()) {
          throw new Error('El movimiento de inventario ya no existe');
        }

        // 2. Leer el producto
        const productRef = doc(db, 'productos', item.productoId);
        const productDoc = await transaction.get(productRef);

        if (!productDoc.exists()) {
          throw new Error('El producto ya no existe');
        }

        const productData = productDoc.data() as any;
        const variantIdx = productData.variants.findIndex((v: any) => v.id === item.variantId);
        const sizeIdx = productData.variants[variantIdx]?.sizes.findIndex((s: any) => s.size === item.talla);

        if (variantIdx === -1 || sizeIdx === -1) {
          throw new Error('Variante no encontrada');
        }

        // 3. AHORA SÍ: Realizar todas las escrituras
        
        // Actualizar el movimiento como comprado Y pagado
        const fechaCompra = new Date().toISOString().split('T')[0];
        transaction.update(movementRef, {
          comprado: true,
          pagadoProveedor: true,
          fechaCompra: fechaCompra,
          stockActualizado: true
        });

        // Aumentar el stock
        productData.variants[variantIdx].sizes[sizeIdx].stock += item.cantidad;
        productData.variants[variantIdx].sizes[sizeIdx].isInStock = true;

        transaction.update(productRef, { variants: productData.variants });
      });

      // Solo registrar en finanzas si NO estaba pagado previamente
      if (!wasAlreadyPaid) {
        const fechaHoy = new Date().toISOString().split('T')[0];
        const folioTransaccion = `GI-${item.id.slice(0,6)}-${Date.now().toString().slice(-6)}`;
        
        await addDoc(collection(db, 'finanzas'), withUserId({
          tipo: 'gasto',
          categoria: 'compra_inventario',
          subcategoria: 'compra_directa',
          monto: item.costo * item.cantidad,
          proveedor: item.proveedor,
          fecha: fechaHoy,
          producto: item.nombre,
          sku: item.sku,
          talla: item.talla,
          color: item.color,
          cantidad: item.cantidad,
          movimientoId: item.id,
          folio: folioTransaccion,
          comentario: `Compra de ${item.cantidad} unidad(es) de ${item.nombre} (${item.color} - ${item.talla}) al proveedor ${item.proveedor}`,
          createdAt: Timestamp.now()
        }, uid!));
      }

      showToast(
        wasAlreadyPaid
          ? `${item.cantidad} unidad(es) recibidas correctamente`
          : `${item.cantidad} unidad(es) agregadas al inventario y gasto registrado`,
        'success'
      );
      await fetchCompras();
    } catch (error) {
      console.error('Error marcando como comprado:', error);
      showToast(error instanceof Error ? error.message : 'Error al marcar como comprado', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarcarPagadoInventario = async (item: InventoryMovementItem) => {
    if (!window.confirm(`¿Marcar como pagado ${item.cantidad} unidad(es) de "${item.nombre}"? Se registrará un gasto anticipado de $${(item.costo * item.cantidad).toLocaleString()}.`)) {
      return;
    }
    setProcessingId(item.id);

    try {
      await updateDoc(doc(db, 'inventory_movements', item.id), {
        pagadoProveedor: true
      });

      // Registrar gasto en finanzas (pago anticipado)
      const fechaHoy = new Date().toISOString().split('T')[0];
      const folioTransaccion = `PI-${item.id.slice(0,6)}-${Date.now().toString().slice(-6)}`;
      
      await addDoc(collection(db, 'finanzas'), withUserId({
        tipo: 'gasto',
        categoria: 'pago_inventario',
        subcategoria: 'pago_anticipado',
        monto: item.costo * item.cantidad,
        proveedor: item.proveedor,
        fecha: fechaHoy,
        producto: item.nombre,
        sku: item.sku,
        talla: item.talla,
        color: item.color,
        cantidad: item.cantidad,
        movimientoId: item.id,
        folio: folioTransaccion,
        comentario: `Pago anticipado de ${item.cantidad} unidad(es) de ${item.nombre} (${item.color} - ${item.talla}) al proveedor ${item.proveedor}`,
        createdAt: Timestamp.now()
      }, uid!));

      showToast('Pago registrado y gasto contabilizado', 'success');
      await fetchCompras();
    } catch (error) {
      console.error('Error registrando pago:', error);
      showToast('Error al registrar el pago', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleEliminarMovimiento = async (item: InventoryMovementItem) => {
    if (!window.confirm(`¿Estás seguro de eliminar este movimiento de inventario? ${item.cantidad} unidad(es) de "${item.nombre}" desaparecerán de la lista. Esta acción no se puede deshacer.`)) {
      return;
    }
    setProcessingId(item.id);

    try {
      await updateDoc(doc(db, 'inventory_movements', item.id), {
        cancelado: true
      });

      showToast('Movimiento eliminado', 'success');
      await fetchCompras();
    } catch (error) {
      console.error('Error eliminando movimiento:', error);
      showToast('Error al eliminar el movimiento', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Exportar resumen de compras pendientes por proveedor a PNG
  const handleExportProveedorPNG = async (grupo: GroupedProvider) => {
    if (!grupo || !grupo.items || grupo.items.length === 0) return;
    if (exportingProv) return;

    const toDataURL = async (url: string) => {
      try {
        const res = await fetch(url, { mode: 'cors' });
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (_) {
        return null as any;
      }
    };

    const exportUsingIframe = async () => {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.top = '0';
      iframe.style.width = '900px';
      iframe.style.height = '1200px';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) throw new Error('No se pudo crear documento en iframe');

      let logoSrc: string | any = logoNegro as any;
      try {
        const logoData = await toDataURL(logoNegro as any);
        if (logoData) logoSrc = logoData;
      } catch (_) {}

      // Agrupar por modelo (nombre), mostrar variantes (talla/color) en una lista y subtotal por modelo
      const PLACEHOLDER_IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAn8B9p3C9QAAAABJRU5ErkJggg==';
      const modeloMap = new Map<string, {
        nombre: string;
        sku: string;
        foto: string;
        variantes: { talla: string; color: string; cantidad: number; costo: number }[];
        cantidadTotal: number;
        subtotalTotal: number;
      }>();

      for (const item of grupo.items) {
        const isInventoryItem = (item as any).tipo === 'inventario';
        const invItem = isInventoryItem ? (item as InventoryMovementItem) : null;
        const ordItem = !isInventoryItem ? (item as CompraItem) : null;

        const nombre = (item as any).nombre || '';
        const sku = (item as any).sku || '';
        const talla = (item as any).talla || '';
        const color = (item as any).color || '';
        let cantidad = 0;
        let costo = 0;
        if (isInventoryItem) {
          cantidad = invItem!.cantidad || 0;
          costo = (invItem!.costo || 0) * cantidad;
        } else {
          cantidad = 1;
          costo = (ordItem!.costo || 0);
        }
        const foto = (item as any).foto || '';
        if (!modeloMap.has(nombre)) {
          modeloMap.set(nombre, {
            nombre,
            sku,
            foto,
            variantes: [{ talla, color, cantidad, costo }],
            cantidadTotal: cantidad,
            subtotalTotal: costo
          });
        } else {
          const m = modeloMap.get(nombre)!;
          m.variantes.push({ talla, color, cantidad, costo });
          m.cantidadTotal += cantidad;
          m.subtotalTotal += costo;
        }
      }

      const itemsHtmlParts: string[] = [];
      for (const m of Array.from(modeloMap.values())) {
        let src = m.foto || '';
        if (src && !src.startsWith('data:')) {
          try {
            const data = await toDataURL(src);
            src = data || PLACEHOLDER_IMG;
          } catch (_) {
            src = PLACEHOLDER_IMG;
          }
        }

        const variantesHtml = m.variantes.map(v =>
          `<li style=\"margin-bottom:2px;font-size:12px;\">Talla: <b>${v.talla}</b>, Color: <b>${v.color}</b> — x${v.cantidad} $${v.costo.toLocaleString()}</li>`
        ).join('');

        itemsHtmlParts.push(`
          <div style=\"border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin-bottom:12px;display:flex;gap:12px;background:#ffffff;\">
            <div style=\"flex:0 0 86px;height:86px;overflow:hidden;border-radius:8px;background:#f3f4f6;\">
              <img crossorigin=\"anonymous\" src=\"${src || PLACEHOLDER_IMG}\" alt=\"${m.nombre}\" style=\"width:100%;height:100%;object-fit:cover;display:block;\"/>
            </div>
            <div style=\"flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between;\">
              <div>
                <div style=\"display:flex;justify-content:space-between;align-items:flex-start;gap:8px;\">
                  <div style=\"font-weight:600;color:#111827;\">${m.nombre}</div>
                  <div style=\"font-weight:700;color:#1d4ed8;\">$${m.subtotalTotal.toLocaleString()}</div>
                </div>
                <div style=\"font-size:11px;color:#6b7280;margin-top:4px;\">SKU: ${m.sku || '-'} | Total: ${m.cantidadTotal}</div>
                <ul style=\"margin:6px 0 0 12px;padding:0;list-style:disc;\">${variantesHtml}</ul>
              </div>
            </div>
          </div>
        `);
      }

      const fechaExport = new Date().toISOString().split('T')[0];
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Compras Pendientes</title>
        <style>
          body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;padding:20px;color:#111827;background:#ffffff}
          .container{max-width:820px;margin:0 auto}
        </style>
      </head><body>
        <div class="container">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <img src="${logoSrc}" alt="logo" style="height:42px;object-fit:contain;"/>
            <div>
              <h1 style="font-size:20px;margin:0;color:#111827;">Compras Pendientes</h1>
              <p style="color:#6b7280;margin:2px 0 0 0;">Proveedor: ${grupo.proveedor}</p>
              <p style="color:#374151;margin:2px 0 0 0;font-size:12px;">Fecha: ${fechaExport}</p>
            </div>
          </div>

          <div style="margin-bottom:12px;padding:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;display:flex;justify-content:space-between;">
            <div style="font-size:13px;color:#374151;">Prendas pendientes: <span style="font-weight:700;color:#111827;">${grupo.items.length}</span></div>
            <div style="font-size:13px;color:#374151;">Total a Pagar: <span style="font-weight:800;color:#111827;">$${grupo.totalPagar.toLocaleString()}</span></div>
          </div>

          ${itemsHtmlParts.join('\n')}
        </div>
      </body></html>`;

      doc.open();
      doc.write(html);
      doc.close();

      await new Promise<void>((resolve) => {
        const imgs = Array.from(doc.getElementsByTagName('img')) as HTMLImageElement[];
        if (imgs.length === 0) return resolve();
        let loaded = 0;
        const finish = () => {
          loaded++;
          if (loaded >= imgs.length) resolve();
        };
        imgs.forEach((img) => {
          if ((img as any).complete) finish();
          img.addEventListener('load', finish);
          img.addEventListener('error', finish);
        });
      });

      const canvas = await html2canvas(doc.body as HTMLElement, {
        scale: 3,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        imageTimeout: 15000
      });

      setTimeout(() => { try { document.body.removeChild(iframe); } catch (_) {} }, 500);
      return canvas;
    };

    try {
      setExportingProv(grupo.proveedor);
      // Usar siempre el modo iframe para evitar problemas de Tailwind/oklch
      const canvas = await exportUsingIframe();
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fecha = new Date().toISOString().split('T')[0];
        const filename = `Nota_${grupo.proveedor.replace(/\s+/g,'_')}_${fecha}.png`;
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
      }, 'image/png', 1.0);
    } catch (error: any) {
      console.error('Error exportando imagen de proveedor:', error);
      showToast(error?.message || 'Error al generar la imagen', 'error');
    } finally {
      setExportingProv(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 pb-24">
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <ShoppingBagIcon className="h-7 w-7 text-blue-600" />
              Compras a Proveedores
            </h1>
            <p className="text-gray-500 text-sm mt-1">Gestión de prendas pendientes ("Bajo Pedido") y movimientos de inventario por comprar</p>
          </div>

          <div className="flex gap-4 flex-col md:flex-row">
            <div className="bg-white px-6 py-3 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total de Prendas</p>
                <p className="text-2xl font-bold text-gray-900">{totalPrendas}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <ShoppingBagIcon className="h-6 w-6 text-blue-700" />
              </div>
            </div>

            <div className="bg-white px-6 py-3 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total a Invertir</p>
                <p className="text-2xl font-bold text-gray-900">${grandTotal.toLocaleString()}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CurrencyDollarIcon className="h-6 w-6 text-green-700" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : itemsByProvider.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-dashed border-gray-300">
            <CheckCircleIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">¡Todo al día!</h3>
            <p className="text-gray-500">No hay prendas pendientes de compra por el momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8">
            {itemsByProvider.map((grupo) => (
              <div key={grupo.proveedor} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                      {grupo.proveedor.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">{grupo.proveedor}</h3>
                      <span className="text-xs text-gray-500">{grupo.items.length} prendas pendientes</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs text-gray-500 mr-2">Pagar a proveedor:</span>
                      <span className="font-bold text-gray-900 text-lg">${grupo.totalPagar.toLocaleString()}</span>
                    </div>
                    <button
                      onClick={() => handleExportProveedorPNG(grupo)}
                      disabled={exportingProv === grupo.proveedor}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-all active:scale-95"
                      title="Exportar resumen en PNG"
                    >
                      <PhotoIcon className="h-4 w-4" />
                      {exportingProv === grupo.proveedor ? 'Exportando...' : 'Nota'}
                    </button>
                  </div>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {grupo.items.map((item) => {
                    // Determinar tipo y crear ID único
                    const isInventoryItem = item.tipo === 'inventario';
                    const invItem = isInventoryItem ? (item as InventoryMovementItem) : null;
                    const ordenItem = !isInventoryItem ? (item as CompraItem) : null;
                    
                    const uniqueKey = isInventoryItem ? invItem!.id : `${ordenItem!.orderId}-${ordenItem!.itemIndex}`;
                    const isProcessing = processingId === uniqueKey;

                    return (
                      <div
                        key={uniqueKey}
                        className={`relative border rounded-lg p-3 transition-all hover:shadow-md flex gap-3 
                          ${(isInventoryItem ? invItem?.pagadoProveedor : ordenItem?.pagadoProveedor) ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}
                      >
                        <div className="w-20 h-24 shrink-0 bg-gray-200 rounded-md overflow-hidden relative">
                          {item.foto ? (
                            <SafeImage src={item.foto} alt={item.nombre} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex items-center justify-center h-full text-xs text-gray-400">
                              {isInventoryItem ? <CubeIcon className="h-6 w-6" /> : 'Sin foto'}
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] text-center py-0.5">
                            {isInventoryItem ? (invItem!.cantidad > 1 ? `Stock x${invItem!.cantidad}` : 'Inventario') : 
                              ordenItem?.origen === 'stock' ? 'Reposición' : 'Pedido'}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start">
                              <h4 className="text-sm font-semibold text-gray-800 truncate pr-4">{item.nombre}</h4>
                              <p className="font-bold text-blue-600 text-sm">
                                ${isInventoryItem ? (invItem!.costo * invItem!.cantidad).toLocaleString() : item.costo}
                              </p>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">SKU: {item.sku}</p>
                            <div className="flex flex-wrap gap-2 mt-1.5">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-800">{item.color}</span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-800">{item.talla}</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2 truncate">
                              {isInventoryItem ? 'Inventario' : `Cliente: ${ordenItem!.clienteNombre}`}
                            </p>
                          </div>

                          <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-gray-100 border-dashed">
                            <button
                              onClick={() => isInventoryItem ? handleEliminarMovimiento(invItem!) : handleCancelar(ordenItem!)}
                              disabled={isProcessing}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title={isInventoryItem ? "Eliminar movimiento" : "Cancelar ítem (quitar de lista)"}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>

                            {!(isInventoryItem ? invItem?.pagadoProveedor : ordenItem?.pagadoProveedor) && (
                              <button
                                onClick={() => isInventoryItem ? handleMarcarPagadoInventario(invItem!) : handleMarcarPagado(ordenItem!)}
                                disabled={isProcessing}
                                className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors flex items-center gap-1"
                                title="Marcar como pagado (sin recibir)"
                              >
                                <CreditCardIcon className="h-4 w-4" />
                                <span className="text-[10px] font-bold">Pagar</span>
                              </button>
                            )}

                            <button
                              onClick={() => isInventoryItem ? handleMarcarCompradoInventario(invItem!) : handleMarcarComprado(ordenItem!)}
                              disabled={isProcessing}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all active:scale-95
                                ${isProcessing ? 'bg-gray-100 text-gray-400 cursor-wait' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                            >
                              {isProcessing ? '...' : (
                                <>
                                  <TruckIcon className="h-3.5 w-3.5" />
                                  {(isInventoryItem ? invItem?.pagadoProveedor : ordenItem?.pagadoProveedor) ? 'Recibir' : 'Comprar'}
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {(isInventoryItem ? invItem?.pagadoProveedor : ordenItem?.pagadoProveedor) && (
                          <div className="absolute top-2 right-2 bg-green-100 text-green-700 text-[9px] font-bold px-2 py-0.5 rounded-full border border-green-200 flex items-center gap-1">
                            <CheckCircleIcon className="h-3 w-3" />
                            PAGADO
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Compras;
