import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Select, { type StylesConfig } from 'react-select';
import {
  collection,
  getDocs,
  doc,
  runTransaction,
  Timestamp,
  arrayUnion,
  increment,
  getDoc,
  addDoc
} from 'firebase/firestore';
import { db } from '../credenciales';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  ShoppingBagIcon,
  TrashIcon,
  PlusIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import showToast from '../utils/toast';
import { ZONAS_ENTREGA_MEXICO } from '../lugares';
import { useAuth } from '../contexts';
import { userQuery, withUserId } from '../utils/multitenancy';

// --- Interfaces de Tipos ---

interface OptionType {
  value: string;
  label: string;
}

// Estilos para React Select
const customSelectStyles: StylesConfig<OptionType, false> = {
  control: (provided, state) => ({
    ...provided,
    backgroundColor: '#fff',
    borderColor: state.isFocused ? '#3b82f6' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
    minHeight: '42px',
    borderRadius: '8px',
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isSelected ? '#bfdbfe' : state.isFocused ? '#f3f4f6' : '#fff',
    color: state.isSelected ? '#1e40af' : '#1f2937',
    cursor: 'pointer',
    fontSize: '0.9rem',
  }),
  placeholder: (provided) => ({ ...provided, color: '#9ca3af' }),
  menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
  menu: (provided) => ({ ...provided, zIndex: 9999 }),
};

// --- Interfaces de Producto (Inventario) ---
interface Size {
  isInStock: boolean;
  size: string;
  stock: number;
  variantSku: string;
}

interface Variant {
  id: number;
  colorName: string;
  hexColor: string;
  imageUrls: string[];
  sizes: Size[];
}

interface Product {
  id: string;
  name: string;
  category: string;
  publicPrice: number;
  offerPercentage?: number; // Porcentaje de descuento
  cost: number;
  supplier: string;
  productSku: string;
  variants: Variant[];
  dateAdded?: number;
}

// --- Interface del Ítem en el Carrito ---
interface CartItem {
  tempId: string; // ID temporal para la UI
  productId: string;
  nombre: string;
  sku: string;
  categoria: string;
  proveedor: string;
  talla: string;
  color: string;
  foto: string;
  precio: number;
  costo: number; // Importante para calcular utilidad luego
  origen: 'stock' | 'bajo_pedido'; // CLAVE para estadísticas
  comprado?: boolean; // Preservar si ya fue comprado al proveedor

  // Datos técnicos para descontar stock
  variantId: number;
  sizeName: string;
}

// --- Interface de Orden Existente (para fusión) ---
interface ActiveOrder {
  id: string;
  folio?: string; // Si usas folios legibles
  totalVenta: number;
  itemCount: number;
}

const NuevoPedido: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.uid;
  const { id: ordenIdParam } = useParams<{ id?: string }>();

  // --- Estados de Datos Globales ---
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [clienteOptions, setClienteOptions] = useState<OptionType[]>([]);
  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
  const [newClienteData, setNewClienteData] = useState({
    cliente: '',
    telefono: '',
    cumpleaños: ''
  });
  const [isSavingCliente, setIsSavingCliente] = useState(false);

  // --- Estado de Edición ---
  const [editingOrdenId, setEditingOrdenId] = useState<string | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false); // Solo lectura si está entregada
  const [totalPagadoOriginal, setTotalPagadoOriginal] = useState(0); // Preservar pagos al editar

  // --- Estados de Selección (Lado Izquierdo) ---
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'STOCK' | 'PEDIDO'>('ALL');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [selectedSize, setSelectedSize] = useState<Size | null>(null);

  // --- Estados del Carrito y Formulario (Lado Derecho) ---
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null); // Si el cliente tiene pedido abierto
  const [submitting, setSubmitting] = useState(false);

  // Estado de UI añadido para gestionar la visibilidad del carrito en móvil
  const [isCartOpenMobile, setIsCartOpenMobile] = useState(false);

  // Formulario general de la orden
  const [orderData, setOrderData] = useState({
    cliente: null as OptionType | null,
    entrega: 'Punto de venta',
    fechaEntrega: '',
    lugar: null as OptionType | null,
    notas: '',
    descuento: 0 // porcentaje, múltiplos de 5
  });

  // Estados para saldo a favor del cliente
  const [saldoDisponible, setSaldoDisponible] = useState(0);
  const [saldoAplicado, setSaldoAplicado] = useState(0);
  const [showSaldoModal, setShowSaldoModal] = useState(false);
  const [saldoModalValor, setSaldoModalValor] = useState(0);

  // --- Funciones para manejo de clientes ---
  const fetchClientes = async () => {
    if (!uid) return;
    try {
      const cliSnap = await getDocs(userQuery('clientes', uid));
      const clientes = cliSnap.docs
        .map(doc => doc.data().cliente)
        .filter(Boolean)
        .map(c => ({ value: c, label: c }));
      setClienteOptions(clientes);
    } catch (error) {
      console.error("Error cargando clientes:", error);
    }
  };

  const handleClienteChange = (newValue: OptionType | null) => {
    if (newValue && newValue.value === '__ADD_NEW__') {
      setIsClienteModalOpen(true);
    } else {
      setOrderData(prev => ({ ...prev, cliente: newValue }));
    }
  };

  const handleSaveNewCliente = async () => {
    if (!newClienteData.cliente.trim()) {
      alert('El nombre del cliente es requerido');
      return;
    }

    setIsSavingCliente(true);
    try {
      const payload = {
        cliente: newClienteData.cliente.trim(),
        telefono: newClienteData.telefono.trim(),
        cumpleaños: newClienteData.cumpleaños,
        cumpleanos: newClienteData.cumpleaños, // Para compatibilidad
        tipo_cliente: 'nuevo',
        fechaRegistro: new Date().toISOString()
      };

      await addDoc(collection(db, 'clientes'), withUserId(payload, uid!));

      // Actualizar la lista de clientes
      await fetchClientes();

      // Asignar el nuevo cliente al pedido
      setOrderData(prev => ({
        ...prev,
        cliente: { value: newClienteData.cliente.trim(), label: newClienteData.cliente.trim() }
      }));

      // Limpiar el formulario y cerrar el modal
      setNewClienteData({
        cliente: '',
        telefono: '',
        cumpleaños: ''
      });
      setIsClienteModalOpen(false);

      showToast('Cliente agregado exitosamente', 'success');
    } catch (error) {
      console.error('Error al guardar cliente:', error);
      showToast('Error al guardar el cliente', 'error');
    } finally {
      setIsSavingCliente(false);
    }
  };

  const handleCloseClienteModal = () => {
    setIsClienteModalOpen(false);
    setNewClienteData({
      cliente: '',
      telefono: '',
      cumpleaños: ''
    });
  };


  // --- 1. Carga Inicial de Datos ---
  useEffect(() => {
    if (!uid) return;
    const fetchData = async () => {
      try {
        // Cargar Productos
        const prodQuery = userQuery('productos', uid);
        const prodSnap = await getDocs(prodQuery);
        const prods = (prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[])
          .sort((a: any, b: any) => new Date(b.dateAdded || 0).getTime() - new Date(a.dateAdded || 0).getTime());
        setProducts(prods);
        setLoadingProducts(false);

        // Cargar Clientes
        await fetchClientes();

      } catch (error) {
        console.error("Error cargando datos:", error);
        setLoadingProducts(false);
      }
    };
    fetchData();
  }, [uid]);

  // --- 1.5 Carga de Orden Existente (si estamos editando) ---
  useEffect(() => {
    const loadOrden = async () => {
      if (!ordenIdParam) return;

      try {
        const ordenDoc = await getDoc(doc(db, 'ordenes', ordenIdParam));
        if (!ordenDoc.exists()) {
          showToast('Orden no encontrada', 'error');
          navigate('/pedidos');
          return;
        }

        const ordenData = ordenDoc.data() as any;
        setEditingOrdenId(ordenIdParam);
        setIsReadOnly(ordenData.estadoPedido === 'entregado');
        setTotalPagadoOriginal(ordenData.totalPagado || 0); // CRÍTICO: Guardar pagos previos

        // Cargar datos en el formulario
        const clienteName = typeof ordenData.cliente === 'string' ? ordenData.cliente : ordenData.cliente?.nombre;
        setOrderData({
          cliente: clienteName ? { value: clienteName, label: clienteName } : null,
          entrega: ordenData.entrega || 'Punto de venta',
          fechaEntrega: ordenData.fechaEntrega || '',
          lugar: ordenData.lugar ? { value: ordenData.lugar, label: ordenData.lugar } : null,
          notas: ordenData.notas || '',
          descuento: ordenData.descuentoPorcentaje || 0
        });

        // Cargar items en el carrito
        const cartItems: CartItem[] = (ordenData.items || []).map((item: any, idx: number) => ({
          tempId: `${ordenIdParam}-${idx}`,
          productId: item.productoId || '',
          nombre: item.nombre || '',
          sku: item.sku || '',
          categoria: item.categoria || '',
          proveedor: item.proveedor || '',
          talla: item.talla || '',
          color: item.color || '',
          foto: item.foto || '',
          precio: item.precio || 0,
          costo: item.costo || 0,
          origen: item.origen || 'stock',
          comprado: item.comprado || false, // PRESERVAR estado de compra
          variantId: 0,
          sizeName: item.talla || ''
        }));
        setCart(cartItems);
      } catch (error) {
        console.error('Error cargando orden:', error);
        showToast('Error cargando la orden', 'error');
      }
    };

    loadOrden();
  }, [ordenIdParam, navigate]);

  // --- 2. Detección de Orden Activa del Cliente y Saldo a Favor ---
  useEffect(() => {
    const checkActiveOrderAndSaldo = async () => {
      setActiveOrder(null);
      setSaldoDisponible(0);
      setSaldoAplicado(0);
      if (!orderData.cliente) return;

      try {
        // Buscar ordenes de este cliente que NO estén entregadas
        const allOrdenesSnap = await getDocs(userQuery('ordenes', uid!));
        const matchingOrders = allOrdenesSnap.docs.filter(d => {
          const data = d.data();
          const nombre = typeof data.cliente === 'string' ? data.cliente : data.cliente?.nombre;
          return nombre === orderData.cliente?.value && data.estadoPedido !== 'entregado';
        });

        if (matchingOrders.length > 0) {
          // Tomamos la primera activa encontrada
          const docData = matchingOrders[0].data();
          setActiveOrder({
            id: matchingOrders[0].id,
            totalVenta: docData.totalVenta || 0,
            itemCount: docData.items?.length || 0
          });
        }

        // Cargar saldo a favor del cliente
        const clienteNormalized = orderData.cliente.value.toLowerCase().trim();
        const creditosSnap = await getDocs(userQuery('clientes_credito', uid!));
        
        // Buscar el cliente en la lista (con búsqueda flexible)
        const clienteCredito = creditosSnap.docs.find(doc => {
          const data = doc.data();
          return (data.cliente || '').toLowerCase().trim() === clienteNormalized;
        });
        
        if (clienteCredito) {
          const saldo = clienteCredito.data().saldoTotal || 0;
          setSaldoDisponible(Math.max(0, saldo));
        } else {
          setSaldoDisponible(0);
        }
      } catch (error) {
        console.error("Error buscando orden activa o saldo:", error);
      }
    };
    checkActiveOrderAndSaldo();
  }, [orderData.cliente]);


  // --- 3. Lógica del Carrito ---

  // Agregar al carrito (Local)
  const handleAddToCart = () => {
    if (!selectedProduct || !selectedVariant || !selectedSize) return;

    // Determinar origen teniendo en cuenta las unidades ya reservadas en el carrito
    // Contar cuántas unidades de este producto/variant/talla ya están marcadas como 'stock'
    const alreadyAllocatedStock = cart.filter(i => (
      i.productId === selectedProduct.id &&
      i.variantId === selectedVariant.id &&
      i.sizeName === selectedSize.size &&
      i.origen === 'stock'
    )).length;

    const availableStockNow = Math.max(0, selectedSize.stock - alreadyAllocatedStock);
    const origen: 'stock' | 'bajo_pedido' = availableStockNow > 0 ? 'stock' : 'bajo_pedido';

    const newItem: CartItem = {
      tempId: Date.now().toString(),
      productId: selectedProduct.id,
      nombre: selectedProduct.name,
      sku: selectedSize.variantSku || selectedProduct.productSku,
      categoria: selectedProduct.category,
      proveedor: selectedProduct.supplier,
      talla: selectedSize.size,
      color: selectedVariant.colorName,
      foto: selectedVariant.imageUrls[0] || '',
      precio: getPrecioFinal(selectedProduct),
      costo: Number(selectedProduct.cost) || 0,
      origen: origen,
      comprado: false, // Nuevo item siempre empieza como no comprado
      // Datos para backend
      variantId: selectedVariant.id,
      sizeName: selectedSize.size
    };

    setCart(prev => [...prev, newItem]);

    // Feedback visual y reset parcial
    showToast(`${selectedProduct.name} agregado al pedido`, 'success');
    setSelectedSize(null); // Resetear talla para obligar a elegir de nuevo si quiere otra
  };

  const removeFromCart = (tempId: string) => {
    setCart(prev => prev.filter(item => item.tempId !== tempId));
  };

  // Función para obtener el precio final (con descuento si existe oferta)
  const getPrecioFinal = (product: Product): number => {
    if (product.offerPercentage && product.offerPercentage > 0) {
      const descuento = product.publicPrice * (product.offerPercentage / 100);
      return Math.round(product.publicPrice - descuento);
    }
    return Number(product.publicPrice);
  };

  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + item.precio, 0), [cart]);

  const discountedTotal = useMemo(() => {
    const d = orderData.descuento || 0;
    const conDescuento = Math.max(0, Math.round(cartTotal * (1 - d / 100)));
    // Restar saldo aplicado
    return Math.max(0, conDescuento - saldoAplicado);
  }, [cartTotal, orderData.descuento, saldoAplicado]);

  // Mostrar modal para aplicar saldo disponible cuando se detecta
  useEffect(() => {
    if (isReadOnly || editingOrdenId) {
      setShowSaldoModal(false);
      return;
    }

    if (!orderData.cliente || saldoDisponible <= 0) {
      setShowSaldoModal(false);
      return;
    }

    const conDescuento = Math.max(0, Math.round(cartTotal * (1 - (orderData.descuento || 0) / 100)));
    const maxAplicable = Math.min(saldoDisponible, conDescuento);
    setSaldoModalValor(maxAplicable);

    // Solo mostrar si aún no se aplicó saldo en esta sesión
    if (saldoAplicado === 0 && maxAplicable > 0) {
      setShowSaldoModal(true);
    }
  }, [cartTotal, orderData.descuento, orderData.cliente, saldoDisponible, saldoAplicado, isReadOnly, editingOrdenId]);


  // --- 4. Guardar Orden (Transacción Compleja) ---
  const handleSubmitOrden = async () => {
    if (cart.length === 0) return showToast("El carrito está vacío", 'error');
    if (!orderData.cliente) return showToast("Selecciona un cliente", 'error');

    setSubmitting(true);

    try {
      await runTransaction(db, async (transaction) => {
        const fechaHoy = new Date().toISOString().split('T')[0];

        // A. VERIFICAR Y DESCONTAR STOCK (Solo para items de origen 'stock')
        const itemsDeStock = cart.filter(i => i.origen === 'stock');

        // Agrupar por producto-variant-talla para evitar lecturas repetidas y asegurar decrementos correctos
        const stockGroups = new Map<string, typeof itemsDeStock>();
        for (const item of itemsDeStock) {
          const key = `${item.productId}::${item.variantId}::${item.sizeName}`;
          const group = stockGroups.get(key) || [];
          group.push(item);
          stockGroups.set(key, group);
        }

        // Siempre descontar stock para ítems con origen 'stock', incluso al editar
        // (La UI ya maneja que si es 'bajo_pedido' no se descuenta)
        for (const groupItems of stockGroups.values()) {
          const sample = groupItems[0];
          const prodRef = doc(db, 'productos', sample.productId);
          const prodDoc = await transaction.get(prodRef);

          if (!prodDoc.exists()) throw `El producto ${sample.nombre} ya no existe`;

          const prodData = prodDoc.data() as Product;
          const variantIdx = prodData.variants.findIndex(v => v.id === sample.variantId);
          if (variantIdx === -1) throw `Datos de ${sample.nombre} cambiaron (color)`;
          const sizeIdx = prodData.variants[variantIdx].sizes.findIndex(s => s.size === sample.sizeName);
          if (sizeIdx === -1) throw `Datos de ${sample.nombre} cambiaron (talla)`;

          const currentStock = prodData.variants[variantIdx].sizes[sizeIdx].stock;
          
          // Si estamos editando, solo descontamos los NUEVOS ítems agregados al stock
          // Pero para simplificar y asegurar consistencia, el componente está diseñado
          // para que 'origen' sea 'stock' solo si hay disponibilidad real en ese momento.
          // Si es una EDICIÓN, los ítems previos ya deberían haber descontado stock o ser bajo_pedido.
          
          let needed = groupItems.length;
          
          // Si estamos editando, necesitamos saber cuántos de estos ítems ya estaban en la orden
          // para no descontar doble.
          if (editingOrdenId) {
            const oldOrdenDoc = await transaction.get(doc(db, 'ordenes', editingOrdenId));
            if (oldOrdenDoc.exists()) {
              const oldItems = oldOrdenDoc.data().items || [];
              const alreadyPresent = oldItems.filter((oi: any) => 
                oi.productoId === sample.productId && 
                oi.variantId === sample.variantId && 
                oi.talla === sample.sizeName &&
                oi.origen === 'stock'
              ).length;
              needed = Math.max(0, groupItems.length - alreadyPresent);
            }
          }

          if (needed > 0) {
            if (currentStock < needed) {
              throw `Stock insuficiente para ${sample.nombre} (${sample.color} ${sample.talla}). Disponible: ${currentStock}, requerido: ${needed}`;
            }

            prodData.variants[variantIdx].sizes[sizeIdx].stock = currentStock - needed;
            prodData.variants[variantIdx].sizes[sizeIdx].isInStock = prodData.variants[variantIdx].sizes[sizeIdx].stock > 0;

            transaction.update(prodRef, { variants: prodData.variants });

            // Registrar un movimiento por cada nuevo ítem que descuenta stock
            for (let i = 0; i < needed; i++) {
              const item = groupItems[i];
              const movementData = {
                tipo: 'salida',
                motivo: 'venta',
                productoId: item.productId,
                productoNombre: item.nombre,
                variantId: item.variantId,
                color: item.color,
                talla: item.talla,
                sku: item.sku,
                cantidad: 1,
                costo: item.costo,
                precioVenta: item.precio,
                proveedor: item.proveedor,
                categoria: item.categoria,
                cliente: orderData.cliente?.value || '',
                fechaRegistro: fechaHoy,
                timestamp: Timestamp.now(),
                userId: uid,
              };
              const movementRef = doc(collection(db, 'inventory_movements'));
              transaction.set(movementRef, movementData);
            }
          }
        }

        // B. CREAR O ACTUALIZAR ORDEN
        const itemsParaGuardar = cart.map(item => ({
          productoId: item.productId,
          nombre: item.nombre,
          sku: item.sku,
          categoria: item.categoria,
          proveedor: item.proveedor,
          talla: item.talla,
          color: item.color,
          foto: item.foto,
          precio: item.precio,
          costo: item.costo,
          cantidad: 1,
          origen: item.origen,
          // CRÍTICO: Preservar estado de compra existente o usar lógica por defecto
          comprado: item.comprado !== undefined ? item.comprado : (item.origen === 'stock' ? true : false),
          entregado: false
        }));

        // Calcular descuentos: descuento porcentual + saldo aplicado
        const conDescuento = Math.round(cartTotal * (1 - (orderData.descuento || 0) / 100));
        const descuentoMonto = cartTotal - conDescuento;

        // C. REGISTRAR MOVIMIENTO DE SALDO SI SE APLICÓ
        if (saldoAplicado > 0 && orderData.cliente) {
          const allCreditSnap = await getDocs(userQuery('clientes_credito', uid!));
          const clienteCredDocs = allCreditSnap.docs.filter(d => d.data().cliente === orderData.cliente?.value);
          
          if (clienteCredDocs.length > 0) {
            const creditDocRef = clienteCredDocs[0].ref;
            const creditData = clienteCredDocs[0].data();
            
            // Actualizar saldo y registrar movimiento
            const movimiento: typeof creditData.movimientos[0] = {
              tipo: 'débito',
              motivo: 'aplicado_a_compra',
              monto: saldoAplicado,
              fechaRegistro: fechaHoy,
              timestamp: Timestamp.now()
            };

            transaction.update(creditDocRef, {
              saldoTotal: Math.max(0, (creditData.saldoTotal || 0) - saldoAplicado),
              movimientos: arrayUnion(movimiento),
              fechaUltimaActualizacion: Timestamp.now()
            });
          }
        }

        if (editingOrdenId) {
          // --- EDITAR ORDEN EXISTENTE ---
          const ordenRef = doc(db, 'ordenes', editingOrdenId);
          // CRÍTICO: Recalcular saldo pendiente preservando pagos previos
          const nuevoSaldoPendiente = Math.max(0, discountedTotal - totalPagadoOriginal);
          transaction.update(ordenRef, {
            items: itemsParaGuardar,
            cliente: {
              nombre: orderData.cliente?.value,
              uid: ''
            },
            totalVenta: discountedTotal,
            saldoPendiente: nuevoSaldoPendiente, // ✅ Preserva pagos previos
            descuentoPorcentaje: orderData.descuento || 0,
            descuentoMonto: descuentoMonto,
            entrega: orderData.entrega,
            lugar: orderData.lugar?.value || '',
            notas: orderData.notas,
            fechaEntrega: orderData.fechaEntrega || null,
            fechaUltimaActualizacion: fechaHoy
          });
        } else if (activeOrder) {
          // --- FUSIÓN: Agregar a orden existente ---
          const ordenExistenteRef = doc(db, 'ordenes', activeOrder.id);
          transaction.update(ordenExistenteRef, {
            items: arrayUnion(...itemsParaGuardar),
            totalVenta: increment(discountedTotal),
            saldoPendiente: increment(discountedTotal),
            descuentoAcumulado: increment(descuentoMonto),
            fechaUltimaActualizacion: fechaHoy
          });
        } else {
          // --- NUEVA ORDEN ---
          const nuevaOrdenRef = doc(collection(db, 'ordenes'));
          const nuevaOrdenData = {
            id: nuevaOrdenRef.id,
            userId: uid,
            cliente: {
              nombre: orderData.cliente?.value,
              uid: ''
            },
            fechaCreacion: fechaHoy,
            fechaEntrega: orderData.fechaEntrega || null,
            entrega: orderData.entrega,
            lugar: orderData.lugar?.value || '',
            notas: orderData.notas,

            estadoPedido: 'pendiente',
            estadoPago: 'pendiente',

            totalVenta: discountedTotal,
            totalPagado: 0,
            saldoPendiente: discountedTotal,
            descuentoPorcentaje: orderData.descuento || 0,
            descuentoMonto: descuentoMonto,

            items: itemsParaGuardar,
            pagos: [],

            timestamp: Timestamp.now()
          };
          transaction.set(nuevaOrdenRef, nuevaOrdenData);
        }
      });

      showToast(editingOrdenId ? "Orden actualizada con éxito" : (activeOrder ? "Prendas agregadas a la orden existente" : "Orden creada con éxito"), 'success');
      navigate('/pedidos');

    } catch (error) {
      console.error("Falló la transacción:", error);
      showToast(typeof error === 'string' ? error : "Error al guardar la orden", 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Renderizado Auxiliar: Imagen Principal ---
  const getMainImage = (prod: Product) => {
    return prod.variants?.[0]?.imageUrls?.[0] || "https://via.placeholder.com/150";
  };

  // --- Filtrado Visual ---
  const filteredProducts = useMemo(() => {
    // Helper para normalizar texto (sin acentos, minúsculas)
    const normalize = (str: string) =>
      (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normalizedSearch = normalize(searchTerm);
    return products.filter(p => {
      const matchSearch = normalize(p.name).includes(normalizedSearch) ||
        normalize(p.productSku).includes(normalizedSearch);
      if (!matchSearch) return false;
      const hasStock = p.variants.some(v => v.sizes.some(s => s.stock > 0));
      if (stockFilter === 'STOCK') return hasStock;
      if (stockFilter === 'PEDIDO') return !hasStock;
      return true;
    });
  }, [products, searchTerm, stockFilter]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">

      {/* ================= COLUMNA IZQUIERDA: CATÁLOGO (Scrollable) ================= */}
      {/* Ocultar la Columna Izquierda en móvil si el carrito está abierto */}
      <div className={`w-full md:w-7/12 lg:w-2/3 p-4 overflow-y-auto ${isCartOpenMobile ? 'hidden md:block' : ''}`}>

        {/* Header Catálogo */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Catálogo de Productos</h1>
          <p className="text-sm text-gray-500">Selecciona prendas para agregar al carrito</p>
        </div>

        {/* Buscador y Filtros */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-3 mb-6 sticky top-0 z-10">
          <div className="relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o SKU..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {[
              { id: 'ALL', label: 'Todos', color: 'bg-gray-600' },
              { id: 'STOCK', label: 'En Stock', color: 'bg-green-600' },
              { id: 'PEDIDO', label: 'Bajo Pedido', color: 'bg-amber-600' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setStockFilter(f.id as any)}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${stockFilter === f.id
                    ? `${f.color} text-white` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Panel de producto (Móvil): Mantiene tu código original para el flujo de selección móvil */}
        {selectedProduct && (
          <div className="md:hidden bg-white p-4 rounded-xl border-2 transition-all mb-4 shadow-sm">
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-900">{selectedProduct.name}</h3>
                  <p className="text-xs text-blue-600 font-medium">${selectedProduct.publicPrice}</p>
                </div>
                <button onClick={() => setSelectedProduct(null)}><XMarkIcon className="h-4 w-4 text-gray-400" /></button>
              </div>

              {/* Colores (Móvil) */}
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase">1. Color</span>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {selectedProduct.variants.map(v => (
                    <button
                      key={v.id}
                      onClick={() => { setSelectedVariant(v); setSelectedSize(null); }}
                      className={`px-2 py-1 rounded text-xs border flex items-center gap-1.5 ${selectedVariant?.id === v.id ? 'border-blue-600 bg-white shadow-sm ring-1 ring-blue-600' : 'border-gray-300 bg-white hover:bg-gray-50'
                        }`}
                    >
                      <span className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: v.hexColor }}></span>
                      {v.colorName}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tallas (Móvil) */}
              {selectedVariant && (
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase">2. Talla</span>
                  <div className="grid grid-cols-4 gap-2 mt-1.5">
                    {selectedVariant.sizes.map((s, idx) => {
                      // Calcular stock real considerando lo ya agregado al carrito
                      const alreadyInCart = cart.filter(i => (
                        i.productId === selectedProduct.id &&
                        i.variantId === selectedVariant.id &&
                        i.sizeName === s.size &&
                        i.origen === 'stock'
                      )).length;
                      
                      const availableStock = Math.max(0, s.stock - alreadyInCart);
                      const hasStockView = availableStock > 0;

                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedSize(s)}
                          className={`py-1.5 rounded text-xs text-center border transition-all ${selectedSize?.size === s.size
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105'
                              : hasStockView
                                ? 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                            }`}
                        >
                          <div className="font-bold">{s.size}</div>
                          <div className="text-[9px] opacity-90">{hasStockView ? `Stock: ${availableStock}` : 'Pedido'}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <button
                onClick={handleAddToCart}
                disabled={!selectedSize || isReadOnly}
                className="w-full mt-2 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                Agregar al Carrito
              </button>
            </div>
          </div>
        )}

        {/* Grid de Productos */}
        {loadingProducts ?
          (
            <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 pb-20 md:pb-0">
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  onClick={() => {
                    setSelectedProduct(product);
                    setSelectedVariant(null);
                    setSelectedSize(null);
                  }}
                  className={`cursor-pointer border rounded-lg overflow-hidden transition-all hover:shadow-lg bg-white
                                ${selectedProduct?.id === product.id ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'}`}
                >
                  <div className="h-32 w-full bg-gray-100 relative">
                    <img crossOrigin="anonymous" referrerPolicy="no-referrer" src={getMainImage(product)} alt={product.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-2">
                    <h3 className="font-medium text-xs text-gray-900 truncate">{product.name}</h3>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-gray-500">{product.productSku}</span>
                      <div className="flex flex-col items-end gap-0.5">
                        {product.offerPercentage && product.offerPercentage > 0 ? (
                          <>
                            <span className="text-xs text-gray-400 line-through">${product.publicPrice}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-bold text-red-600">${Math.round(product.publicPrice * (1 - product.offerPercentage / 100))}</span>
                              <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.5 rounded font-semibold">
                                -{product.offerPercentage}%
                              </span>
                            </div>
                          </>
                        ) : (
                          <span className="text-sm font-bold text-blue-600">${product.publicPrice}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>


      {/* ================= COLUMNA DERECHA: CONFIGURACIÓN Y CARRITO ================= */}
      {/* Visible siempre en MD, visible solo si isCartOpenMobile es true en móvil */}
      <div className={`w-full md:w-5/12 lg:w-1/3 bg-white border-l border-gray-200 h-full flex flex-col shadow-xl z-20 transition-all duration-300 ease-in-out
               ${isCartOpenMobile ? 'fixed inset-0 md:relative flex' : 'hidden md:flex'}`}>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <ShoppingBagIcon className="h-5 w-5 text-blue-600" />
              <h2 className="font-bold text-gray-800">Armar Pedido</h2>
            </div>
            {/* Botón de cierre para móvil */}
            <button onClick={() => setIsCartOpenMobile(false)} className="md:hidden p-1 text-gray-500 hover:text-gray-700">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* SECCIÓN 1: SELECTOR DE DETALLES (Oculta en Móvil, se usa el panel de la izquierda) */}
          <div className="hidden md:block">
            <div className={`p-4 rounded-xl border-2 transition-all ${selectedProduct ? 'border-blue-100 bg-blue-50' : 'border-dashed border-gray-200 bg-gray-50'}`}>
              {!selectedProduct ?
                (
                  <div className="text-center text-gray-400 text-sm py-4">
                    Selecciona una prenda a la izquierda para ver tallas y colores
                  </div>
                ) : (
                  <div className="space-y-4 animate-fadeIn">
                    {/* Contenido del selector de producto para PC/Tablet (tu código original) */}
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-gray-900">{selectedProduct.name}</h3>
                        <p className="text-xs text-blue-600 font-medium">${selectedProduct.publicPrice}</p>
                      </div>
                      <button onClick={() => setSelectedProduct(null)}><XMarkIcon className="h-4 w-4 text-gray-400" /></button>
                    </div>
                    {/* Colores */}
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">1. Color</span>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {selectedProduct.variants.map(v => (
                          <button
                            key={v.id}
                            onClick={() => { setSelectedVariant(v); setSelectedSize(null); }}
                            className={`px-2 py-1 rounded text-xs border flex items-center gap-1.5 ${selectedVariant?.id === v.id ? 'border-blue-600 bg-white shadow-sm ring-1 ring-blue-600' : 'border-gray-300 bg-white hover:bg-gray-50'
                              }`}
                          >
                            <span className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: v.hexColor }}></span>
                            {v.colorName}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Tallas */}
                    {selectedVariant && (
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase">2. Talla</span>
                        <div className="grid grid-cols-4 gap-2 mt-1.5">
                          {selectedVariant.sizes.map((s, idx) => {
                            // Calcular stock real considerando lo ya agregado al carrito
                            const alreadyInCart = cart.filter(i => (
                              i.productId === selectedProduct.id &&
                              i.variantId === selectedVariant.id &&
                              i.sizeName === s.size &&
                              i.origen === 'stock'
                            )).length;
                            
                            const availableStock = Math.max(0, s.stock - alreadyInCart);
                            const hasStockView = availableStock > 0;

                            return (
                              <button
                                key={idx}
                                onClick={() => setSelectedSize(s)}
                                className={`py-1.5 rounded text-xs text-center border transition-all ${selectedSize?.size === s.size
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105'
                                    : hasStockView
                                      ? 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                  }`}
                              >
                                <div className="font-bold">{s.size}</div>
                                <div className="text-[9px] opacity-90">{hasStockView ? `Stock: ${availableStock}` : 'Pedido'}</div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {/* Botón Agregar */}
                    <button
                      onClick={handleAddToCart}
                      disabled={!selectedSize || isReadOnly}
                      className="w-full mt-2 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                      <PlusIcon className="h-4 w-4" />
                      Agregar al Carrito
                    </button>
                  </div>
                )}
            </div>
          </div>

          {/* SECCIÓN 2: LISTA DEL CARRITO */}
          <div className="flex-1">
            <div className="flex justify-between items-end mb-2 border-b border-gray-100 pb-2">
              <h3 className="text-sm font-bold text-gray-700">Ítems ({cart.length})</h3>
              <div className="text-right">
                <div className="text-xs text-gray-500">Subtotal ${cartTotal}</div>
                <div className="text-lg font-bold text-blue-700">${discountedTotal}</div>
              </div>
            </div>

            {cart.length === 0 ?
              (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  <ShoppingBagIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No has agregado prendas</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div key={item.tempId} className="flex gap-2 p-2 bg-white border border-gray-100 rounded-lg shadow-sm relative group">
                      <img crossOrigin="anonymous" referrerPolicy="no-referrer" src={item.foto || 'https://via.placeholder.com/50'} className="w-10 h-10 rounded object-cover bg-gray-100" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{item.nombre}</p>
                        <p className="text-[10px] text-gray-500">{item.color} | {item.talla}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${item.origen === 'stock' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {item.origen === 'stock' ? 'Stock' : 'Bajo Pedido'}
                          </span>
                          <span className="text-xs font-medium text-blue-600">${item.precio}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.tempId)}
                        disabled={isReadOnly}
                        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* SECCIÓN 3: DATOS DE ORDEN (Cliente) */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div>
              <label className="text-xs font-medium text-gray-500">Cliente</label>
              <Select
                options={[
                  { value: '__ADD_NEW__', label: '+ A\u00f1adir nuevo cliente' },
                  ...clienteOptions
                ]}
                value={orderData.cliente}
                onChange={handleClienteChange}
                placeholder="Buscar cliente..."
                styles={customSelectStyles}
                className="text-sm"
                isClearable
                isSearchable
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
            </div>

            {/* ALERTA DE ORDEN EXISTENTE */}
            {activeOrder && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-amber-800 font-medium">
                    Este cliente tiene una orden abierta.
                  </p>
                  <p className="text-[10px] text-amber-700 mt-1">
                    Al guardar, estas prendas se <strong>fusionarán</strong> con la orden existente (Total actual: ${activeOrder.totalVenta}).
                  </p>
                </div>
              </div>
            )}

            {isReadOnly && (
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-start gap-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-blue-800 font-medium">
                    Esta orden está entregada.
                  </p>
                  <p className="text-[10px] text-blue-700 mt-1">
                    Solo puedes visualizar los datos. No puedes realizar cambios.
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-500">Tipo de Entrega *</label>
              <select
                disabled={isReadOnly}
                className="w-full text-sm border-gray-300 rounded-lg p-2 bg-white border disabled:opacity-50 disabled:cursor-not-allowed"
                value={orderData.entrega}
                onChange={(e) => setOrderData(prev => ({ ...prev, entrega: e.target.value }))}
              >
                <option value="Punto de venta">Entrega Personal (Punto de Venta)</option>
                <option value="Envio">Envío a Domicilio (Paquetería)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500">Fecha de Entrega (Opcional)</label>
              <input
                type="date"
                disabled={isReadOnly}
                className="w-full text-sm border-gray-300 rounded-lg p-2 border disabled:opacity-50 disabled:cursor-not-allowed"
                value={orderData.fechaEntrega}
                onChange={(e) => setOrderData(prev => ({ ...prev, fechaEntrega: e.target.value }))}
              />
            </div>
            <div className="mt-2">
              <label className="text-xs font-medium text-gray-500">Descuento (%)</label>
              <select
                disabled={isReadOnly}
                className="w-full text-sm border-gray-300 rounded-lg p-2 bg-white border disabled:opacity-50 disabled:cursor-not-allowed"
                value={orderData.descuento}
                onChange={(e) => setOrderData(prev => ({ ...prev, descuento: Number(e.target.value) }))}
              >
                {Array.from({ length: 11 }).map((_, i) => {
                  const val = i * 5; // 0,5,10,...,50
                  return (<option key={val} value={val}>{val}%</option>);
                })}
              </select>
            </div>

            {/* Saldo a Favor */}
            {saldoDisponible > 0 && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <label className="text-xs font-medium text-green-800">Saldo a Favor Disponible: ${saldoDisponible}</label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    min={0}
                    max={saldoDisponible}
                    step={1}
                    disabled={isReadOnly}
                    placeholder="Monto a aplicar..."
                    className="flex-1 text-sm border border-green-300 rounded-lg p-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    value={saldoAplicado || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setSaldoAplicado(Math.min(val, saldoDisponible));
                    }}
                  />
                  <button
                    onClick={() => setSaldoAplicado(saldoDisponible)}
                    disabled={isReadOnly}
                    className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Máximo
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-500">Zona de Entrega</label>
              <Select
                isDisabled={isReadOnly}
                options={ZONAS_ENTREGA_MEXICO}
                value={orderData.lugar}
                onChange={(val) => setOrderData(prev => ({ ...prev, lugar: val }))}
                placeholder="Selecciona zona..."
                styles={customSelectStyles}
                className="text-sm"
                isClearable
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
            </div>
          </div>
        </div>

        {/* Modal para aplicar saldo a favor */}
        {showSaldoModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Saldo a favor disponible</p>
                  <p className="text-2xl font-bold text-green-700">${saldoDisponible.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">Puedes aplicarlo como pago parcial a esta orden.</p>
                </div>
                <button onClick={() => setShowSaldoModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">Monto a aplicar</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    max={saldoDisponible}
                    step={1}
                    className="flex-1 border border-gray-300 rounded-lg p-2 text-sm"
                    value={saldoModalValor || ''}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      const conDescuento = Math.max(0, Math.round(cartTotal * (1 - (orderData.descuento || 0) / 100)));
                      const maxAplicable = Math.min(saldoDisponible, conDescuento);
                      setSaldoModalValor(Math.min(val, maxAplicable));
                    }}
                  />
                  <button
                    onClick={() => {
                      const conDescuento = Math.max(0, Math.round(cartTotal * (1 - (orderData.descuento || 0) / 100)));
                      setSaldoModalValor(Math.min(saldoDisponible, conDescuento));
                    }}
                    className="px-3 py-2 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Máximo
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => {
                    const conDescuento = Math.max(0, Math.round(cartTotal * (1 - (orderData.descuento || 0) / 100)));
                    const maxAplicable = Math.min(saldoDisponible, conDescuento);
                    const toApply = Math.min(saldoModalValor, maxAplicable);
                    setSaldoAplicado(toApply);
                    setShowSaldoModal(false);
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg shadow-sm"
                >
                  Aplicar saldo
                </button>
                <button
                  onClick={() => {
                    setSaldoAplicado(0);
                    setShowSaldoModal(false);
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 rounded-lg"
                >
                  No usar ahora
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Nuevo Cliente */}
        {isClienteModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="text-lg font-semibold text-gray-800">Añadir Nuevo Cliente</h3>
                <button
                  onClick={handleCloseClienteModal}
                  className="text-gray-400 hover:text-gray-600 transition"
                  disabled={isSavingCliente}
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    value={newClienteData.cliente}
                    onChange={(e) => setNewClienteData(prev => ({ ...prev, cliente: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2 text-sm"
                    placeholder="Ej: María Pérez"
                    disabled={isSavingCliente}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      value={newClienteData.telefono}
                      onChange={(e) => setNewClienteData(prev => ({ ...prev, telefono: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2 text-sm"
                      placeholder="10 dígitos"
                      disabled={isSavingCliente}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cumpleaños
                    </label>
                    <input
                      type="date"
                      value={newClienteData.cumpleaños}
                      onChange={(e) => setNewClienteData(prev => ({ ...prev, cumpleaños: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2 text-sm"
                      disabled={isSavingCliente}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t pt-4">
                <button
                  onClick={handleCloseClienteModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition"
                  disabled={isSavingCliente}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveNewCliente}
                  disabled={isSavingCliente || !newClienteData.cliente.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                  {isSavingCliente ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <PlusIcon className="h-4 w-4" />
                      Guardar Cliente
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER: BOTÓN FINAL */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0">
          <button
            onClick={handleSubmitOrden}
            disabled={submitting || cart.length === 0 || isReadOnly}
            className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95
                            ${submitting || cart.length === 0 || isReadOnly
                ? 'bg-gray-400 cursor-not-allowed shadow-none'
                : activeOrder
                  ? 'bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-200' // Color diferente para fusión
                  : 'bg-blue-600 hover:bg-blue-700 ring-2 ring-blue-200'
              }`}
          >
            {submitting
              ? 'Procesando...'
              : isReadOnly
                ? 'Orden - Solo Lectura'
                : activeOrder
                  ? `Agregar a Orden Existente ($${discountedTotal})`
                  : editingOrdenId
                    ? `Actualizar Orden ($${discountedTotal})`
                    : `Crear Orden ($${discountedTotal})`
            }
          </button>
        </div>
      </div>

      {/* BOTÓN FLOTANTE PARA ABRIR CARRITO (Solo Móvil) */}
      {!isCartOpenMobile && (
        <button
          onClick={() => setIsCartOpenMobile(true)}
          className="md:hidden fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-full shadow-xl z-30 flex items-center gap-2 transform transition-transform active:scale-95 hover:bg-blue-700"
        >
          <ShoppingBagIcon className="h-6 w-6" />
          <span className="font-bold">Ver Pedido ({cart.length})</span>
          {cart.length > 0 && (
            <span className="bg-white text-blue-600 text-xs font-extrabold px-2 py-0.5 rounded-full ml-1">
              ${discountedTotal}
            </span>
          )}
        </button>
      )}

    </div>
  );
};

export default NuevoPedido;