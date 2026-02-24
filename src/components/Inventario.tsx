import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  runTransaction,
  doc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../credenciales';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  CubeIcon,
  CheckCircleIcon,
  TrashIcon,
  GiftIcon
} from '@heroicons/react/24/outline';
import showToast from '../utils/toast';
import ImageZoomModal from './ImageZoomModal';
import Select from 'react-select';
import { useAuth, useSubscription } from '../contexts';
import { userQuery, withUserId } from '../utils/multitenancy';
import UpgradeModal, { useUpgradeModal } from './UpgradeModal';

// --- Interfaces ---
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
  cost: number;
  supplier: string;
  productSku: string;
  variants: Variant[];
  dateAdded?: number;
}

interface InventoryItem {
  productId: string;
  productName: string;
  variantId: number;
  colorName: string;
  hexColor: string;
  size: string;
  variantSku: string;
  stock: number;
  category: string;
  supplier: string;
  cost: number;
  publicPrice: number;
  imageUrl: string;
}

interface InventoryAddItem {
  tempId: string;
  productId: string;
  productName: string;
  variantId: number;
  colorName: string;
  hexColor: string;
  size: string;
  variantSku: string;
  quantity: number;
  cost: number;
  publicPrice: number;
  supplier: string;
  category: string;
  imageUrl: string;
  comprado: boolean;
}

type OptionType = { value: string; label: string };

const Inventario: React.FC = () => {
  const { user } = useAuth();
  const { isBusiness } = useSubscription();
  const { upgradeProps, requireBusiness } = useUpgradeModal();
  const uid = user?.uid;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [headerTop, setHeaderTop] = useState<number>(0);
  const [appHeaderHeight, setAppHeaderHeight] = useState<number>(0);
  
  // Modales Merma/Regalo
  const [mermaOpen, setMermaOpen] = useState(false);
  const [regaloOpen, setRegaloOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [mermaQty, setMermaQty] = useState<number>(1);
  const [mermaReason, setMermaReason] = useState<string>('Daño');
  const [mermaNotes, setMermaNotes] = useState<string>('');
  const [mermaSubmitting, setMermaSubmitting] = useState(false);
  
  const [regaloQty, setRegaloQty] = useState<number>(1);
  const [regaloCliente, setRegaloCliente] = useState<string>('');
  const [regaloNotes, setRegaloNotes] = useState<string>('');
  const [regaloSubmitting, setRegaloSubmitting] = useState(false);

  // Clientes para select
  const [clientesOptions, setClientesOptions] = useState<OptionType[]>([]);
  const [loadingClientes, setLoadingClientes] = useState<boolean>(false);

  useEffect(() => {
    if (!uid) return;
    const fetchClientes = async () => {
      setLoadingClientes(true);
      try {
        const snap = await getDocs(userQuery('clientes', uid));
        const opts: OptionType[] = snap.docs.map(d => {
          const data: any = d.data();
          const nombreBase: string =
            data?.nombre ||
            data?.name ||
            data?.cliente ||
            data?.razonSocial ||
            data?.displayName ||
            data?.fullName ||
            data?.alias ||
            d.id;
          const telefono: string | undefined = data?.telefono || data?.phone || data?.celular;
          const label = telefono ? `${nombreBase} (${telefono})` : nombreBase;
          return { value: nombreBase, label };
        }).sort((a, b) => a.label.localeCompare(b.label));
        setClientesOptions(opts);
      } catch (err) {
        console.error('Error cargando clientes:', err);
      } finally {
        setLoadingClientes(false);
      }
    };
    fetchClientes();
  }, [uid]);

  // Cargar productos
  useEffect(() => {
    if (!uid) return;
    const fetchProducts = async () => {
      try {
        const prodQuery = userQuery('productos', uid);
        const prodSnap = await getDocs(prodQuery);
        const prods = (prodSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            cost: Number(data.cost) || 0,
            publicPrice: Number(data.publicPrice) || 0,
          };
        }) as Product[]).sort((a: any, b: any) => new Date(b.dateAdded || 0).getTime() - new Date(a.dateAdded || 0).getTime());
        setProducts(prods);
      } catch (error) {
        console.error("Error cargando productos:", error);
        showToast('Error al cargar productos', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [uid]);

  // Convertir productos a items de inventario con stock
  const inventoryItems = useMemo(() => {
    const items: InventoryItem[] = [];
    products.forEach(product => {
      product.variants.forEach(variant => {
        variant.sizes.forEach(size => {
          if (size.stock > 0) {
            items.push({
              productId: product.id,
              productName: product.name,
              variantId: variant.id,
              colorName: variant.colorName,
              hexColor: variant.hexColor,
              size: size.size,
              variantSku: size.variantSku,
              stock: size.stock,
              category: product.category,
              supplier: product.supplier,
              cost: Number(product.cost) || 0,
              publicPrice: Number(product.publicPrice) || 0,
              imageUrl: variant.imageUrls[0] || ''
            });
          }
        });
      });
    });
    return items;
  }, [products]);

  // Filtrar items
  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return inventoryItems.filter(item => {
      const normalizedFields = [item.productName, item.variantSku, item.colorName].map(value =>
        (value ?? '').toString().toLowerCase()
      );

      const matchSearch = term === '' || normalizedFields.some(field => field.includes(term));
      const matchCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
      const matchSupplier = supplierFilter === 'ALL' || item.supplier === supplierFilter;
      
      return matchSearch && matchCategory && matchSupplier;
    });
  }, [inventoryItems, searchTerm, categoryFilter, supplierFilter]);

  // Obtener categorías y proveedores únicos
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return Array.from(cats).sort();
  }, [products]);

  const suppliers = useMemo(() => {
    const supps = new Set(products.map(p => p.supplier));
    return Array.from(supps).sort();
  }, [products]);

  // Estadísticas
  const totalStock = useMemo(() => 
    inventoryItems.reduce((sum, item) => sum + item.stock, 0), 
    [inventoryItems]
  );

  const totalValue = useMemo(() => 
    inventoryItems.reduce((sum, item) => sum + (item.cost * item.stock), 0), 
    [inventoryItems]
  );

  const totalProducts = useMemo(() => 
    new Set(inventoryItems.map(item => item.productId)).size,
    [inventoryItems]
  );

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
      // headers sticky solo con altura del scrollbar
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
  }, [loading, filteredItems.length]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-sm text-gray-500">Gestión de stock y movimientos de inventario</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm font-medium"
        >
          <PlusIcon className="w-5 h-5" />
          Añadir a Inventario
        </button>
      </div>

      {/* Estadísticas */}
      <div className="max-w-7xl mx-auto mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Stock Total</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalStock}</p>
              <p className="text-xs text-gray-500 mt-1">unidades disponibles</p>
            </div>
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
              <CubeIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Valor Total</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">${totalValue.toLocaleString('es-MX')}</p>
              <p className="text-xs text-gray-500 mt-1">costo de inventario</p>
            </div>
            <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-xl font-bold text-green-600">$</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Productos</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalProducts}</p>
              <p className="text-xs text-gray-500 mt-1">con stock disponible</p>
            </div>
            <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-xl font-bold text-purple-600">#</span>
            </div>
          </div>
        </div>
      </div>

      {/* Búsqueda y Filtros */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, SKU o color..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          <div>
            <select
              className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">Todas las categorías</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
            >
              <option value="ALL">Todos los proveedores</option>
              {suppliers.map(sup => (
                <option key={sup} value={sup}>{sup}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Inventario */}
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible">
        <div
          ref={topScrollRef}
          className="w-full overflow-x-auto sticky z-20 bg-white"
          style={{ overflowY: 'hidden', top: appHeaderHeight, height: '16px' }}
        >
          <div style={{ height: '16px' }} />
        </div>

        <div ref={tableWrapperRef} className="overflow-x-auto">
          {loading ? (
            <div className="p-6 text-sm text-gray-500 text-center">Cargando inventario...</div>
          ) : (
            <table ref={tableRef} className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200 relative z-30">
                <tr>
                  <th style={{ top: headerTop }} className="sticky py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">Producto</th>
                  <th style={{ top: headerTop }} className="sticky py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">Color</th>
                  <th style={{ top: headerTop }} className="sticky py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">Talla</th>
                  <th style={{ top: headerTop }} className="sticky py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">SKU</th>
                  <th style={{ top: headerTop }} className="sticky py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center bg-gray-50">Stock</th>
                  <th style={{ top: headerTop }} className="sticky py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">Proveedor</th>
                  <th style={{ top: headerTop }} className="sticky py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right bg-gray-50">Costo</th>
                  <th style={{ top: headerTop }} className="sticky py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right bg-gray-50">P. Público</th>
                  <th style={{ top: headerTop }} className="sticky py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right bg-gray-50">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map((item, index) => (
                  <tr key={`${item.productId}-${item.variantId}-${item.size}-${index}`} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.imageUrl || 'https://via.placeholder.com/50'}
                          alt={item.productName}
                          onClick={() => item.imageUrl && setZoomedImage(item.imageUrl)}
                          className="w-12 h-12 rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                        />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{item.productName}</p>
                          <p className="text-xs text-gray-500">{item.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-4 h-4 rounded-full border border-gray-300"
                          style={{ backgroundColor: item.hexColor }}
                        />
                        <span className="text-sm text-gray-700">{item.colorName}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm font-medium text-gray-900">{item.size}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs font-mono text-gray-500">{item.variantSku}</span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.stock > 10 ? 'bg-green-100 text-green-800' :
                        item.stock > 5 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {item.stock}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-600">{item.supplier}</span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="text-sm font-medium text-gray-900">${item.cost}</span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="text-sm font-medium text-blue-600">${item.publicPrice}</span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          title="Merma"
                          onClick={() => {
                            if (!isBusiness) {
                              requireBusiness('Registro de Merma', 'El registro de mermas está disponible en el Plan Business. Mejora tu plan para controlar pérdidas y daños.');
                              return;
                            }
                            setSelectedItem(item);
                            setMermaQty(1);
                            setMermaReason('Daño');
                            setMermaNotes('');
                            setMermaOpen(true);
                          }}
                          className="px-2 py-1 text-xs rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
                        >
                          Merma
                        </button>
                        <button
                          title="Regalar"
                          onClick={() => {
                            if (!isBusiness) {
                              requireBusiness('Registro de Regalos', 'El registro de regalos está disponible en el Plan Business. Mejora tu plan para gestionar obsequios a clientes.');
                              return;
                            }
                            setSelectedItem(item);
                            setRegaloQty(1);
                            setRegaloCliente('');
                            setRegaloNotes('');
                            setRegaloOpen(true);
                          }}
                          className="px-2 py-1 text-xs rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 flex items-center gap-1"
                        >
                          <GiftIcon className="w-4 h-4" />
                          Regalo
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!loading && filteredItems.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No se encontraron productos con stock disponible.
          </div>
        )}
      </div>

      {/* Modal Añadir a Inventario */}
      {isAddModalOpen && (
        <AddInventoryModal
          products={products}
          uid={uid!}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => {
            setIsAddModalOpen(false);
            // Recargar productos
            window.location.reload();
          }}
           onImageClick={(url: string) => setZoomedImage(url)}
        />
      )}

       {/* Modal de zoom de imagen */}
       {zoomedImage && (
         <ImageZoomModal imageUrl={zoomedImage} onClose={() => setZoomedImage(null)} />
       )}

      {/* Modal de upgrade */}
      <UpgradeModal {...upgradeProps} />

      {/* Modal Merma */}
      {mermaOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="bg-red-600 p-4 flex justify-between items-center">
              <h3 className="text-white font-bold">Registrar Merma</h3>
              <button onClick={() => setMermaOpen(false)} className="text-red-100 hover:text-white">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-700">
                {selectedItem.productName} • {selectedItem.colorName} • {selectedItem.size}
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                <input
                  type="number"
                  min={1}
                  max={selectedItem.stock}
                  value={mermaQty}
                  onChange={(e) => setMermaQty(Math.max(1, Math.min(selectedItem.stock, parseInt(e.target.value) || 1)))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
                <p className="text-xs text-gray-500 mt-1">Stock disponible: {selectedItem.stock}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={mermaReason}
                  onChange={(e) => setMermaReason(e.target.value)}
                >
                  <option>Daño</option>
                  <option>Defecto</option>
                  <option>Desuso</option>
                  <option>Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={mermaNotes}
                  onChange={(e) => setMermaNotes(e.target.value)}
                />
              </div>
              <button
                onClick={async () => {
                  if (!selectedItem) return;
                  if (mermaQty < 1 || mermaQty > selectedItem.stock) {
                    return showToast('Cantidad inválida', 'error');
                  }
                  setMermaSubmitting(true);
                  try {
                    const fecha = new Date().toISOString().split('T')[0];
                    const safeSku = selectedItem.variantSku || `${selectedItem.productId}-${selectedItem.variantId}-${selectedItem.size}`;
                    let movement: any = null;
                    let mermaDoc: any = null;

                    await runTransaction(db, async (transaction) => {
                      const prodRef = doc(db, 'productos', selectedItem.productId);
                      const prodDoc = await transaction.get(prodRef);
                      if (!prodDoc.exists()) throw new Error('Producto no encontrado');
                      const prodData = prodDoc.data() as Product;
                      const vIdx = prodData.variants.findIndex(v => v.id === selectedItem.variantId);
                      const sIdx = prodData.variants[vIdx]?.sizes.findIndex(s => s.size === selectedItem.size);
                      if (vIdx === -1 || sIdx === -1) throw new Error('Variante/Talla no encontrada');
                      const sizeObj = prodData.variants[vIdx].sizes[sIdx];
                      if ((sizeObj.stock || 0) < mermaQty) throw new Error('Stock insuficiente');
                      sizeObj.stock = (sizeObj.stock || 0) - mermaQty;
                      sizeObj.isInStock = sizeObj.stock > 0;
                      transaction.update(prodRef, { variants: prodData.variants });
                      movement = {
                        tipo: 'salida',
                        motivo: 'merma',
                        productoId: selectedItem.productId,
                        productoNombre: selectedItem.productName,
                        variantId: selectedItem.variantId,
                        color: selectedItem.colorName,
                        talla: selectedItem.size,
                        sku: safeSku,
                        cantidad: mermaQty,
                        costo: selectedItem.cost,
                        precioPublico: selectedItem.publicPrice,
                        proveedor: selectedItem.supplier,
                        categoria: selectedItem.category,
                        imageUrl: selectedItem.imageUrl,
                        fechaRegistro: fecha,
                        notas: mermaNotes,
                        razon: mermaReason,
                        timestamp: Timestamp.now()
                      };
                      mermaDoc = {
                        productoId: selectedItem.productId,
                        productoNombre: selectedItem.productName,
                        variantId: selectedItem.variantId,
                        talla: selectedItem.size,
                        sku: safeSku,
                        cantidad: mermaQty,
                        costoUnitario: selectedItem.cost,
                        costoTotal: selectedItem.cost * mermaQty,
                        proveedor: selectedItem.supplier,
                        categoria: selectedItem.category,
                        fechaRegistro: fecha,
                        razon: mermaReason,
                        notas: mermaNotes,
                        timestamp: Timestamp.now()
                      };
                    });

                    if (movement && mermaDoc) {
                      await Promise.all([
                        addDoc(collection(db, 'inventory_movements'), withUserId(movement, uid!)),
                        addDoc(collection(db, 'mermas'), withUserId(mermaDoc, uid!))
                      ]);
                    }
                    showToast('Merma registrada y stock actualizado', 'success');
                    setMermaOpen(false);
                    setSelectedItem(null);
                    window.location.reload();
                  } catch (err) {
                    console.error(err);
                    const msg = err instanceof Error ? err.message : 'Error al registrar merma';
                    showToast(msg, 'error');
                  } finally {
                    setMermaSubmitting(false);
                  }
                }}
                disabled={mermaSubmitting}
                className="w-full py-3 bg-red-600 text-white rounded-xl font-bold shadow hover:bg-red-700 disabled:opacity-50"
              >
                {mermaSubmitting ? 'Guardando...' : 'Registrar Merma'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Regalo */}
      {regaloOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="bg-blue-600 p-4 flex justify-between items-center">
              <h3 className="text-white font-bold">Registrar Regalo</h3>
              <button onClick={() => setRegaloOpen(false)} className="text-blue-100 hover:text-white">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-700">
                {selectedItem.productName} • {selectedItem.colorName} • {selectedItem.size}
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <Select
                  options={clientesOptions}
                  isSearchable
                  isClearable
                  placeholder={loadingClientes ? 'Cargando clientes...' : 'Selecciona un cliente...'}
                  value={regaloCliente ? { value: regaloCliente, label: regaloCliente } : null}
                  onChange={(opt) => setRegaloCliente(opt ? (opt as OptionType).value : '')}
                  className="text-sm"
                  styles={{
                    control: (provided) => ({ ...provided, minHeight: '40px' }),
                    placeholder: (provided) => ({ ...provided, color: '#9ca3af' }),
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                <input
                  type="number"
                  min={1}
                  max={selectedItem.stock}
                  value={regaloQty}
                  onChange={(e) => setRegaloQty(Math.max(1, Math.min(selectedItem.stock, parseInt(e.target.value) || 1)))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Stock disponible: {selectedItem.stock}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={regaloNotes}
                  onChange={(e) => setRegaloNotes(e.target.value)}
                />
              </div>
              <button
                onClick={async () => {
                  if (!selectedItem) return;
                  if (!regaloCliente.trim()) {
                    return showToast('Ingresa el cliente', 'error');
                  }
                  if (regaloQty < 1 || regaloQty > selectedItem.stock) {
                    return showToast('Cantidad inválida', 'error');
                  }
                  setRegaloSubmitting(true);
                  try {
                    const fecha = new Date().toISOString().split('T')[0];
                    const safeSku = selectedItem.variantSku || `${selectedItem.productId}-${selectedItem.variantId}-${selectedItem.size}`;
                    let movement: any = null;
                    let regaloDoc: any = null;
                    let cantidadFinal = regaloQty;
                    let disponible = 0;

                    await runTransaction(db, async (transaction) => {
                      const prodRef = doc(db, 'productos', selectedItem.productId);
                      const prodDoc = await transaction.get(prodRef);
                      if (!prodDoc.exists()) throw new Error('Producto no encontrado');
                      const prodData = prodDoc.data() as Product;
                      const vIdx = prodData.variants.findIndex(v => v.id === selectedItem.variantId);
                      const sIdx = prodData.variants[vIdx]?.sizes.findIndex(s => s.size === selectedItem.size);
                      if (vIdx === -1 || sIdx === -1) throw new Error('Variante/Talla no encontrada');
                      const sizeObj = prodData.variants[vIdx].sizes[sIdx];
                      disponible = sizeObj.stock || 0;
                      if (disponible <= 0) throw new Error('Stock insuficiente');
                      cantidadFinal = Math.min(regaloQty, disponible);
                      sizeObj.stock = (sizeObj.stock || 0) - cantidadFinal;
                      sizeObj.isInStock = sizeObj.stock > 0;
                      transaction.update(prodRef, { variants: prodData.variants });
                      movement = {
                        tipo: 'salida',
                        motivo: 'regalo',
                        productoId: selectedItem.productId,
                        productoNombre: selectedItem.productName,
                        variantId: selectedItem.variantId,
                        color: selectedItem.colorName,
                        talla: selectedItem.size,
                        sku: safeSku,
                        cantidad: cantidadFinal,
                        costo: selectedItem.cost,
                        precioPublico: selectedItem.publicPrice,
                        proveedor: selectedItem.supplier,
                        categoria: selectedItem.category,
                        imageUrl: selectedItem.imageUrl,
                        fechaRegistro: fecha,
                        cliente: regaloCliente,
                        notas: regaloNotes,
                        timestamp: Timestamp.now()
                      };
                      regaloDoc = {
                        cliente: regaloCliente,
                        productoId: selectedItem.productId,
                        productoNombre: selectedItem.productName,
                        variantId: selectedItem.variantId,
                        talla: selectedItem.size,
                        sku: safeSku,
                        cantidad: cantidadFinal,
                        costoUnitario: selectedItem.cost,
                        costoTotalEstimado: selectedItem.cost * cantidadFinal,
                        precioPublicoUnitario: selectedItem.publicPrice,
                        precioPublicoTotal: selectedItem.publicPrice * cantidadFinal,
                        proveedor: selectedItem.supplier,
                        categoria: selectedItem.category,
                        fechaRegistro: fecha,
                        notas: regaloNotes,
                        timestamp: Timestamp.now()
                      };
                    });

                    if (movement && regaloDoc) {
                      await Promise.all([
                        addDoc(collection(db, 'inventory_movements'), withUserId(movement, uid!)),
                        addDoc(collection(db, 'regalos'), withUserId(regaloDoc, uid!))
                      ]);
                    }

                    if (cantidadFinal < regaloQty) {
                      showToast(`Regalo registrado con ajuste: disponible ${disponible}`, 'info');
                    } else {
                      showToast('Regalo registrado y stock actualizado', 'success');
                    }
                    setRegaloOpen(false);
                    setSelectedItem(null);
                    window.location.reload();
                  } catch (err) {
                    console.error(err);
                    const msg = err instanceof Error ? err.message : 'Error al registrar regalo';
                    showToast(msg, 'error');
                  } finally {
                    setRegaloSubmitting(false);
                  }
                }}
                disabled={regaloSubmitting}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow hover:bg-blue-700 disabled:opacity-50"
              >
                {regaloSubmitting ? 'Guardando...' : 'Registrar Regalo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Modal para Añadir a Inventario ---
interface AddInventoryModalProps {
  products: Product[];
  uid: string;
  onClose: () => void;
  onSuccess: () => void;
   onImageClick: (url: string) => void;
}

const AddInventoryModal: React.FC<AddInventoryModalProps> = ({ products, uid, onClose, onSuccess, onImageClick }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [selectedSize, setSelectedSize] = useState<Size | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<InventoryAddItem[]>([]);
  const [comprado, setComprado] = useState(false);
  const [fechaCompra, setFechaCompra] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filtrar productos
  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return products.filter(p => {
      const name = (p.name ?? '').toString().toLowerCase();
      const sku = (p.productSku ?? '').toString().toLowerCase();
      return term === '' || name.includes(term) || sku.includes(term);
    });
  }, [products, searchTerm]);

  // Agregar al carrito temporal
  const handleAddToCart = () => {
    if (!selectedProduct || !selectedVariant || !selectedSize || quantity < 1) {
      showToast('Selecciona producto, color, talla y cantidad', 'error');
      return;
    }

    const newItem: InventoryAddItem = {
      tempId: Date.now().toString(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      variantId: selectedVariant.id,
      colorName: selectedVariant.colorName,
      hexColor: selectedVariant.hexColor,
      size: selectedSize.size,
      variantSku: selectedSize.variantSku || `${selectedProduct.productSku}-${selectedVariant.id}-${selectedSize.size}`,
      quantity: quantity,
      cost: selectedProduct.cost,
      publicPrice: selectedProduct.publicPrice,
      supplier: selectedProduct.supplier,
      category: selectedProduct.category,
      imageUrl: selectedVariant.imageUrls[0] || '',
      comprado: comprado
    };

    setCart(prev => [...prev, newItem]);
    showToast(`${quantity} unidad(es) agregadas`, 'success');
    
    // Reset
    setSelectedSize(null);
    setQuantity(1);
  };

  const removeFromCart = (tempId: string) => {
    setCart(prev => prev.filter(item => item.tempId !== tempId));
  };

  // Guardar en inventario
  const handleSubmit = async () => {
    if (cart.length === 0) {
      showToast('Agrega al menos un producto', 'error');
      return;
    }

    if (comprado && !fechaCompra) {
      showToast('Ingresa la fecha de compra', 'error');
      return;
    }

    setSubmitting(true);

    try {
      await runTransaction(db, async (transaction) => {
        const fechaRegistro = new Date().toISOString().split('T')[0];
        const fechaCompraFinal = comprado ? fechaCompra : null;

        // 1. Actualizar stock en productos (solo si está marcado como comprado)
        if (comprado) {
          for (const item of cart) {
            const prodRef = doc(db, 'productos', item.productId);
            const prodDoc = await transaction.get(prodRef);

            if (!prodDoc.exists()) {
              throw new Error(`El producto ${item.productName} ya no existe`);
            }

            const prodData = prodDoc.data() as Product;
            const variantIdx = prodData.variants.findIndex(v => v.id === item.variantId);
            const sizeIdx = prodData.variants[variantIdx]?.sizes.findIndex(s => s.size === item.size);

            if (variantIdx === -1 || sizeIdx === -1) {
              throw new Error(`Variante no encontrada para ${item.productName}`);
            }

            // Aumentar stock
            prodData.variants[variantIdx].sizes[sizeIdx].stock += item.quantity;
            prodData.variants[variantIdx].sizes[sizeIdx].isInStock = true;

            transaction.update(prodRef, { variants: prodData.variants });
          }
        }

        // 2. Registrar movimientos en inventory_movements
        for (const item of cart) {
          const movementData = {
            tipo: 'entrada',
            productoId: item.productId || '',
            productoNombre: item.productName || '',
            variantId: item.variantId || 0,
            color: item.colorName || '',
            talla: item.size || '',
            sku: item.variantSku || '',
            cantidad: item.quantity || 0,
            costo: item.cost || 0,
            precioPublico: item.publicPrice || 0,
            proveedor: item.supplier || '',
            categoria: item.category || '',
            imageUrl: item.imageUrl || '', // Agregar URL de imagen
            comprado: comprado,
            fechaRegistro: fechaRegistro,
            fechaCompra: fechaCompraFinal || null,
            stockActualizado: comprado,
            timestamp: Timestamp.now()
          };

          await addDoc(collection(db, 'inventory_movements'), withUserId(movementData, uid));
        }
      });

      showToast(comprado ? 'Inventario actualizado correctamente' : 'Movimiento registrado (pendiente de compra)', 'success');
      onSuccess();

    } catch (error) {
      console.error('Error al guardar:', error);
      showToast(error instanceof Error ? error.message : 'Error al guardar el inventario', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const totalCost = useMemo(() => 
    cart.reduce((sum, item) => sum + (item.cost * item.quantity), 0),
    [cart]
  );

  const totalQuantity = useMemo(() => 
    cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">Añadir a Inventario</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col md:flex-row">
          
          {/* Lado Izquierdo: Selección de Productos */}
          <div className="w-full md:w-2/3 p-6 border-r border-gray-200">
            <div className="mb-4">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            {/* Grid de productos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {filteredProducts.slice(0, 12).map(product => (
                <div
                  key={product.id}
                  onClick={() => {
                    setSelectedProduct(product);
                    setSelectedVariant(null);
                    setSelectedSize(null);
                  }}
                  className={`cursor-pointer border-2 rounded-lg p-2 hover:shadow-md transition-all ${
                    selectedProduct?.id === product.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <img
                    src={product.variants[0]?.imageUrls[0] || 'https://via.placeholder.com/150'}
                    alt={product.name}
                    onClick={(e) => {
                      e.stopPropagation();
                      const imgUrl = product.variants[0]?.imageUrls[0];
                       if (imgUrl) onImageClick(imgUrl);
                    }}
                    className="w-full h-24 object-cover rounded mb-2 hover:opacity-80 transition-opacity"
                  />
                  <p className="text-xs font-medium text-gray-900 truncate">{product.name}</p>
                  <p className="text-xs text-gray-500">${product.cost}</p>
                </div>
              ))}
            </div>

            {/* Selección de Variante y Talla */}
            {selectedProduct && (
              <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Color</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.variants.map(variant => (
                      <button
                        key={variant.id}
                        onClick={() => {
                          setSelectedVariant(variant);
                          setSelectedSize(null);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm border flex items-center gap-2 ${
                          selectedVariant?.id === variant.id
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-gray-300"
                          style={{ backgroundColor: variant.hexColor }}
                        />
                        {variant.colorName}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedVariant && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Talla</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {selectedVariant.sizes.map((size, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedSize(size)}
                          className={`py-2 rounded-lg text-sm border ${
                            selectedSize?.size === size.size
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                          }`}
                        >
                          {size.size}
                          <div className="text-xs opacity-75">Stock: {size.stock}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedSize && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Cantidad</h4>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <button
                  onClick={handleAddToCart}
                  disabled={!selectedSize}
                  className="w-full bg-gray-900 text-white py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <PlusIcon className="w-5 h-5" />
                  Agregar al Lote
                </button>
              </div>
            )}
          </div>

          {/* Lado Derecho: Carrito y Confirmación */}
          <div className="w-full md:w-1/3 p-6 bg-gray-50 flex flex-col">
            <h4 className="text-sm font-bold text-gray-700 mb-3">Lote de Inventario</h4>
            
            {/* Items del carrito */}
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {cart.map(item => (
                <div key={item.tempId} className="bg-white p-3 rounded-lg border border-gray-200 flex justify-between items-start">
                  <div className="flex gap-2 flex-1">
                    <img
                      src={item.imageUrl || 'https://via.placeholder.com/50'}
                      alt={item.productName}
                       onClick={() => item.imageUrl && onImageClick(item.imageUrl)}
                      className="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{item.productName}</p>
                      <p className="text-xs text-gray-500">{item.colorName} • {item.size}</p>
                      <p className="text-xs text-blue-600 font-medium">x{item.quantity} = ${item.cost * item.quantity}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.tempId)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="text-center text-gray-400 py-8 text-sm">
                  Sin productos agregados
                </div>
              )}
            </div>

            {/* Estado de compra */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={comprado}
                  onChange={(e) => setComprado(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Marcar como comprado</p>
                  <p className="text-xs text-gray-500">El stock se actualizará automáticamente</p>
                </div>
              </label>

              {comprado && (
                <div className="mt-3">
                  <label className="text-xs font-medium text-gray-700">Fecha de Compra</label>
                  <input
                    type="date"
                    value={fechaCompra}
                    onChange={(e) => setFechaCompra(e.target.value)}
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              )}
            </div>

            {/* Resumen */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Total unidades:</span>
                <span className="font-bold text-gray-900">{totalQuantity}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Costo total:</span>
                <span className="font-bold text-blue-700">${totalCost.toLocaleString('es-MX')}</span>
              </div>
            </div>

            {/* Botón guardar */}
            <button
              onClick={handleSubmit}
              disabled={cart.length === 0 || submitting}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-5 h-5" />
                  {comprado ? 'Actualizar Inventario' : 'Registrar Movimiento'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inventario;
