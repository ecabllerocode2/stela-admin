import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../credenciales';
import Select, { type StylesConfig } from 'react-select';
import { useAuth, useSubscription } from '../contexts';
import { userQuery } from '../utils/multitenancy';
import UpgradeModal, { useUpgradeModal } from './UpgradeModal';
import { 
  PlusIcon, 
  PencilSquareIcon, 
  MagnifyingGlassIcon, 
  // FunnelIcon ya estaba, pero agregamos estos para los selects:
  TagIcon, 
  TruckIcon, 
  CubeIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import ImageZoomModal from './ImageZoomModal';
import SafeImage from './SafeImage';
import { CATEGORIAS_PRODUCTOS } from '../categorias';

// --- URL del Backend ---
const BACKEND_URL = (import.meta.env.VITE_API_URL || "https://stela-backend.vercel.app").trim();

// --- Tipos de Datos ---
interface OptionType {
  value: string;
  label: string;
}

// --- Interfaces basadas en tus capturas de Firestore (Tipado Estricto) ---
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
  imageIds: string[];
  imageUrls: string[];
  sizes: Size[];
}

interface Product {
  id: string; // ID del documento de Firestore
  name: string;
  category: string;
  cost: number;
  publicPrice: number;
  productSku: string;
  supplier: string;
  publishOnline: boolean;
  shortDetails: string;
  longDescription?: string;
  offerPercentage: number;
  creationDate?: string;
  variants: Variant[];
  dateAdded: number;
  // Campos internos de migración (opcional)
  _migratedFrom?: string;
  _migrationDate?: string;
  _originalDocId?: string;
  _originalFecha?: string | null;
}

// --- Interface para resultado de verificación de eliminación ---
interface DeleteVerificationResult {
  canDelete: boolean;
  reasons: string[];
  pendingOrders: number;
  ordersWithPendingPayments: number;
  totalStock: number;
}

// --- ESTILOS PERSONALIZADOS PARA REACT-SELECT ---
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

// --- OBTENER CATEGORÍAS PLANAS ---
const getFlatCategoryOptions = (): OptionType[] => {
  let flatList: OptionType[] = [];
  CATEGORIAS_PRODUCTOS.forEach(mainCat => {
    if (mainCat.children) {
      flatList = flatList.concat(
        mainCat.children.map(child => ({
          value: child.value,
          label: child.label
        }))
      );
    }
  });
  return flatList;
};

// --- Componente Principal ---

const Productos = () => {
  const { user } = useAuth();
  const { planLimits, isBusiness } = useSubscription();
  const { upgradeProps, requireBusiness } = useUpgradeModal();
  const uid = user?.uid;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  // ESTADOS DE FILTRO
  const [selectedCategory, setSelectedCategory] = useState<OptionType | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<OptionType | null>(null);
  const [stockStatusFilter, setStockStatusFilter] = useState<string>('ALL');

  // ESTADO DE PROVEEDORES
  const [supplierOptions, setSupplierOptions] = useState<OptionType[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true);

  // Estado para el modal de zoom
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

  // Estados para eliminación de productos
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleteVerification, setDeleteVerification] = useState<DeleteVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Debouncing de búsqueda para optimizar rendimiento (evita filtrar en cada keystroke)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 1. Lógica del Modal (Mantenida)
  const handleImageClick = (url: string) => {
    if (!url.includes('Sin+Imagen')) {
        setZoomedImageUrl(url);
    }
  };

  const handleCloseModal = () => {
    setZoomedImageUrl(null);
  };

  // 2. Cargar Proveedores de Firestore
  const fetchSuppliers = useCallback(async () => {
    if (!uid) return;
    setIsLoadingSuppliers(true);
    try {
      const suppliersCol = userQuery('proveedores', uid);
      const supplierSnapshot = await getDocs(suppliersCol);
      const suppliersList: OptionType[] = [];
      supplierSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.proveedor) {
          suppliersList.push({
            value: data.proveedor,
            label: data.proveedor
          });
        }
      });
      setSupplierOptions(suppliersList);
    } catch (error) {
      console.error("Error al cargar proveedores:", error);
    } finally {
      setIsLoadingSuppliers(false);
    }
  }, [uid]);

  // 3. Cargar datos de Firestore (Mantenida)
  useEffect(() => {
    if (!uid) return;
    const fetchProducts = async () => {
      try {
        const querySnapshot = await getDocs(userQuery('productos', uid));
        
        const productsList = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || '',
            category: data.category || '',
            supplier: data.supplier || '',
            cost: Number(data.cost) || 0,
            publicPrice: Number(data.publicPrice) || 0,
            productSku: data.productSku || doc.id,
            publishOnline: data.publishOnline ?? false,
            shortDetails: data.shortDetails || '',
            longDescription: data.longDescription || '',
            offerPercentage: Number(data.offerPercentage) || 0,
            creationDate: data.creationDate || '',
            dateAdded: data.dateAdded ?? Date.now(),
            variants: data.variants || [],
          } as Product;
        });
        
        setProducts(productsList);
      } catch (error) {
        console.error("Error al cargar productos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [uid]);

  // 4. Cargar Proveedores al montar el componente
  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  // 5. Lógica auxiliar
  
  // Envolvemos calculateTotalStock en useCallback para usarlo como dependencia en useMemo
  const calculateTotalStock = useCallback((variants: Variant[] = []) => {
    return variants.reduce((total, variant) => {
      const variantStock = variant.sizes?.reduce((sum, size) => sum + (size.stock || 0), 0) || 0;
      return total + variantStock;
    }, 0);
  }, []);

  // Obtener la imagen principal (Mantenida)
  const getMainImage = (variants: Variant[] = []) => {
    if (variants.length > 0 && variants[0].imageUrls?.length > 0) {
      return variants[0].imageUrls[0];
    }
    return "https://via.placeholder.com/400?text=Sin+Imagen";
  };

  // Calcular precio con oferta
  const calculateDiscountedPrice = useCallback((publicPrice: number = 0, offerPercentage: number = 0) => {
    // Validación defensiva
    const price = Number(publicPrice) || 0;
    const discount = Number(offerPercentage) || 0;
    
    if (discount <= 0 || discount > 100) return price;
    return price * (1 - discount / 100);
  }, []);

  // --- FUNCIÓN: Verificar si un producto puede ser eliminado ---
  const verifyProductDeletion = useCallback(async (product: Product): Promise<DeleteVerificationResult> => {
    const reasons: string[] = [];
    let pendingOrders = 0;
    let ordersWithPendingPayments = 0;

    try {
      // 1. Verificar stock total del producto
      const totalStock = calculateTotalStock(product.variants);
      if (totalStock > 0) {
        reasons.push(`Tiene ${totalStock} unidades en inventario`);
      }

      // 2. Buscar órdenes que contengan este producto
      const ordenesSnapshot = await getDocs(userQuery('ordenes', uid!));
      
      ordenesSnapshot.forEach((docSnap) => {
        const orden = docSnap.data();
        const items = orden.items || [];
        
        // Verificar si algún item de la orden corresponde a este producto
        const hasThisProduct = items.some((item: { productoId?: string; cancelado?: boolean }) => 
          item.productoId === product.id && !item.cancelado
        );
        
        if (hasThisProduct) {
          // Verificar si la orden no está entregada
          if (orden.estadoPedido !== 'entregado') {
            pendingOrders++;
          }
          
          // Verificar si tiene saldo pendiente
          if ((orden.saldoPendiente || 0) > 0) {
            ordersWithPendingPayments++;
          }
        }
      });

      if (pendingOrders > 0) {
        reasons.push(`Tiene ${pendingOrders} orden(es) pendiente(s) de entrega`);
      }

      if (ordersWithPendingPayments > 0) {
        reasons.push(`Tiene ${ordersWithPendingPayments} orden(es) con pagos pendientes`);
      }

      return {
        canDelete: reasons.length === 0,
        reasons,
        pendingOrders,
        ordersWithPendingPayments,
        totalStock
      };
    } catch (error) {
      console.error('Error verificando producto:', error);
      return {
        canDelete: false,
        reasons: ['Error al verificar el producto. Intenta de nuevo.'],
        pendingOrders: 0,
        ordersWithPendingPayments: 0,
        totalStock: 0
      };
    }
  }, [calculateTotalStock]);

  // --- FUNCIÓN: Eliminar imágenes del producto desde R2 ---
  const deleteProductImages = async (product: Product): Promise<{ success: boolean; deletedCount: number; errors: string[] }> => {
    const errors: string[] = [];
    let deletedCount = 0;

    // Recopilar todas las URLs de imágenes de todas las variantes
    const allImageUrls: string[] = [];
    product.variants?.forEach(variant => {
      variant.imageUrls?.forEach(url => {
        if (url && !url.includes('placeholder') && !url.includes('Sin+Imagen')) {
          allImageUrls.push(url);
        }
      });
    });

    console.log(`Eliminando ${allImageUrls.length} imágenes del producto ${product.name}...`);

    // Eliminar cada imagen llamando al endpoint
    for (const imageUrl of allImageUrls) {
      try {
        const response = await fetch(
          `${BACKEND_URL}/api/deleteImage?url=${encodeURIComponent(imageUrl)}`,
          { method: 'DELETE' }
        );

        if (response.ok) {
          deletedCount++;
          console.log(`✓ Imagen eliminada: ${imageUrl}`);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.warn(`⚠ Error eliminando imagen: ${imageUrl}`, errorData);
          // No agregamos a errors porque puede que la imagen ya no exista
        }
      } catch (error) {
        console.error(`Error eliminando imagen ${imageUrl}:`, error);
        errors.push(`Error al eliminar: ${imageUrl}`);
      }
    }

    return {
      success: errors.length === 0,
      deletedCount,
      errors
    };
  };

  // --- FUNCIÓN: Eliminar producto completo ---
  const handleDeleteProduct = async () => {
    if (!productToDelete || !deleteVerification?.canDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      // 1. Eliminar imágenes de R2
      const imageResult = await deleteProductImages(productToDelete);
      console.log(`Imágenes eliminadas: ${imageResult.deletedCount}`);

      // 2. Eliminar documento de Firestore (privado)
      await deleteDoc(doc(db, 'productos', productToDelete.id));
      console.log(`Producto eliminado de Firestore: ${productToDelete.id}`);

      // 3. Intentar eliminar documento público (productos_public) si existe
      try {
        await deleteDoc(doc(db, 'productos_public', productToDelete.id));
        console.log(`Producto eliminado de productos_public: ${productToDelete.id}`);
      } catch (err) {
        // No romper el flujo por error al eliminar público (puede que ya no exista)
        console.warn(`No se pudo eliminar en productos_public o ya no existe: ${productToDelete.id}`, err);
      }

      // 4. Actualizar estado local (remover de la lista)
      setProducts(prev => prev.filter(p => p.id !== productToDelete.id));

      // 5. Cerrar modal
      setDeleteModalOpen(false);
      setProductToDelete(null);
      setDeleteVerification(null);

    } catch (error) {
      console.error('Error eliminando producto:', error);
      setDeleteError(error instanceof Error ? error.message : 'Error desconocido al eliminar');
    } finally {
      setIsDeleting(false);
    }
  };

  // --- FUNCIÓN: Abrir modal de eliminación ---
  const openDeleteModal = async (product: Product) => {
    setProductToDelete(product);
    setDeleteModalOpen(true);
    setDeleteVerification(null);
    setDeleteError(null);
    setIsVerifying(true);

    const result = await verifyProductDeletion(product);
    setDeleteVerification(result);
    setIsVerifying(false);
  };

  // --- FUNCIÓN: Cerrar modal de eliminación ---
  const closeDeleteModal = () => {
    if (!isDeleting) {
      setDeleteModalOpen(false);
      setProductToDelete(null);
      setDeleteVerification(null);
      setDeleteError(null);
    }
  };

  // --- 6. Opciones de Categorías (Planas) ---
  const categoryOptions = useMemo(() => {
    return getFlatCategoryOptions();
  }, []);


  // --- 7. Lógica de Filtrado COMPLETA y Optimizada ---
  const filteredProducts = useMemo(() => {
    try {
      // Helper para normalizar texto (sin acentos, minúsculas)
      const normalize = (str: string) =>
        (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      const normalizedSearch = normalize(debouncedSearchTerm.trim());

      return products
        .filter(product => {
          // Validación defensiva
          if (!product || !product.variants) return false;
          const totalStock = calculateTotalStock(product.variants);

          // 1. Filtro de Búsqueda por Texto (ignora acentos y mayúsculas)
          if (normalizedSearch !== '') {
            const matchesSearch = (product.name && normalize(product.name).includes(normalizedSearch)) ||
                                  (product.productSku && normalize(product.productSku).includes(normalizedSearch));
            if (!matchesSearch) return false;
          }

          // 2. Filtro por Categoría
          if (selectedCategory && product.category !== selectedCategory.value) return false;

          // 3. Filtro por Proveedor
          if (selectedSupplier && product.supplier !== selectedSupplier.value) return false;

          // 4. Filtro por Estado de Stock
          if (stockStatusFilter === 'ONLINE' && !product.publishOnline) return false;

          // Sin Stock
          if (stockStatusFilter === 'OUT_OF_STOCK' && totalStock > 0) return false;

          return true;
        })
        .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0)); // Ordenar por fecha descendente (más recientes arriba)
    } catch (error) {
      console.error('Error en filtrado:', error);
      return [];
    }
  }, [products, debouncedSearchTerm, selectedCategory, selectedSupplier, stockStatusFilter, calculateTotalStock]);

  // --- Renderizado de Estados ---
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // --- Renderizado Principal ---
  return (
    <div className="space-y-6">
      
      {/* --- Encabezado y Acciones --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Productos ({filteredProducts.length}/{products.length})</h1>
          <p className="text-gray-500 text-sm mt-1">Gestiona tu inventario y catálogo.</p>
        </div>
        {products.length >= planLimits.maxProducts ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded">
              Límite: {products.length}/{planLimits.maxProducts} productos
            </span>
            <button
              onClick={() => requireBusiness(
                'Más productos',
                `Has alcanzado el límite de ${planLimits.maxProducts} productos de tu plan. Elimina productos existentes o mejora tu plan para agregar más.`
              )}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-sm"
            >
              <PlusIcon className="h-5 w-5" />
              <span>Nuevo Producto</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {products.length}/{planLimits.maxProducts} productos
            </span>
            <Link 
              to="/productos/crear" 
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <PlusIcon className="h-5 w-5" />
              <span>Nuevo Producto</span>
            </Link>
          </div>
        )}
      </div>

      {/* --- PANEL DE FILTROS ACTUALIZADO --- */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o SKU..." 
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filtros de Selección y Estado */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-gray-100 pt-3">
          
          {/* Filtro por Categoría con React-Select */}
          <div>
            <label className='text-xs font-medium text-gray-500 flex items-center mb-1'>
              <TagIcon className='h-4 w-4 mr-1' /> Categoría
            </label>
            <Select<OptionType, false>
              options={categoryOptions}
              value={selectedCategory}
              onChange={(newValue) => setSelectedCategory(newValue)}
              placeholder="Todas las categorías"
              isClearable
              isSearchable
              styles={customStyles}
              className="text-sm"
            />
          </div>

          {/* Filtro por Proveedor con React-Select */}
          <div>
            <label className='text-xs font-medium text-gray-500 flex items-center mb-1'>
              <TruckIcon className='h-4 w-4 mr-1' /> Proveedor
            </label>
            <Select<OptionType, false>
              options={supplierOptions}
              value={selectedSupplier}
              onChange={(newValue) => setSelectedSupplier(newValue)}
              placeholder={isLoadingSuppliers ? "Cargando..." : "Todos los proveedores"}
              isClearable
              isSearchable
              isLoading={isLoadingSuppliers}
              styles={customStyles}
              className="text-sm"
            />
          </div>

          {/* Filtro por Estado de Stock */}
          <div className='col-span-2'>
            <label className='text-xs font-medium text-gray-500 flex items-center mb-1'>
              <CubeIcon className='h-4 w-4 mr-1' /> Estado de Inventario
            </label>
            <div className='flex space-x-2'>
              {['ALL', 'ONLINE', 'OUT_OF_STOCK'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStockStatusFilter(status)}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-colors border ${
                    stockStatusFilter === status
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {status === 'ALL' && 'Todos'}
                  {status === 'ONLINE' && 'En Línea'}
                  {status === 'OUT_OF_STOCK' && 'Sin Stock'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- Vista Desktop: Tabla con Scroll Mejorado --- */}
      <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">Producto</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU / Categoría</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variantes</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Total</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => {
                const totalStock = calculateTotalStock(product.variants);
                const mainImage = getMainImage(product.variants);
                
                return (
                  <tr key={product.id} className="hover:bg-blue-50 transition-colors">
                    {/* Columna de Producto (sticky) */}
                    <td className="px-4 py-4 sticky left-0 bg-white hover:bg-blue-50">
                      <div className="flex items-center min-w-[200px]">
                        <div 
                          className="h-16 w-16 flex-shrink-0 relative cursor-pointer group"
                          onClick={() => handleImageClick(mainImage)}
                        >
                          <SafeImage 
                            crossOrigin="anonymous" referrerPolicy="no-referrer"
                            loading="lazy"
                            className="h-16 w-16 rounded-md object-cover border-2 border-gray-200 transition-transform duration-200 group-hover:scale-105 group-hover:border-blue-500" 
                            src={mainImage} 
                            alt={product.name} 
                          />
                          {!mainImage.includes('Sin+Imagen') && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md text-white text-[10px] font-bold">🔍 ZOOM</span>
                          )}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-semibold text-gray-900">{product.name}</div>
                        </div>
                      </div>
                    </td>
                    
                    {/* SKU / Categoría */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">{product.productSku}</div>
                      <div className="text-xs text-gray-600 mt-1">{product.category}</div>
                    </td>
                    
                    {/* Proveedor */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{product.supplier || '-'}</div>
                    </td>
                    
                    {/* Precio */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-base font-bold text-gray-900">
                        ${calculateDiscountedPrice(product.publicPrice, product.offerPercentage).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">💰 Costo: ${(Number(product.cost) || 0).toFixed(2)}</div>
                      {product.offerPercentage > 0 && (
                        <div className="text-xs font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                          🏷️ -{product.offerPercentage}%
                        </div>
                      )}
                    </td>
                    
                    {/* Variantes con scroll */}
                    <td className="px-4 py-4">
                      <div className="max-h-20 overflow-y-auto max-w-[150px]">
                        <div className="text-xs space-y-1">
                          {product.variants && product.variants.length > 0 ? (
                            product.variants.map((variant, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded">
                                <div 
                                  className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" 
                                  style={{ backgroundColor: variant.hexColor }}
                                  title={variant.colorName}
                                />
                                <span className="text-gray-700 font-medium truncate">{variant.colorName}</span>
                                <span className="text-gray-500">({variant.sizes?.length || 0} tallas)</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-gray-400 italic">Sin variantes</span>
                          )}
                        </div>
                      </div>
                    </td>
                    
                    {/* Stock Total */}
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <div className={`text-lg font-bold inline-flex items-center justify-center w-16 h-16 rounded-full 
                        ${totalStock === 0 ? 'bg-red-100 text-red-700' : totalStock < 5 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {totalStock}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">unidades</div>
                    </td>
                    
                    {/* Estado */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1.5 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${product.publishOnline 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'}`}>
                        {product.publishOnline ? '✅ En línea' : '📝 Borrador'}
                      </span>
                    </td>
                    
                    {/* Acciones (sticky) */}
                    <td className="px-4 py-4 whitespace-nowrap text-center sticky right-0 bg-white hover:bg-blue-50">
                      <div className="flex items-center justify-center gap-2">
                        <Link 
                          to={`/productos/editar/${product.id}`} 
                          className="inline-flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"
                          title="Editar producto"
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                        </Link>
                        <button
                          onClick={() => openDeleteModal(product)}
                          className="inline-flex items-center justify-center w-10 h-10 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm hover:shadow-md"
                          title="Eliminar producto"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredProducts.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <div className="text-4xl mb-2">📦</div>
            <div className="text-lg font-semibold">No se encontraron productos</div>
            <div className="text-sm">Intenta ajustar los filtros de búsqueda.</div>
          </div>
        )}
      </div>

      {/* --- Vista Móvil: Cards Mejoradas con Scroll --- */}
      <div className="md:hidden space-y-4">
        {filteredProducts.map((product) => {
            const totalStock = calculateTotalStock(product.variants);
            const mainImage = getMainImage(product.variants);

            return (
              <div key={product.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {/* Cabecera con imagen y datos principales */}
                <div className="flex gap-3 p-4 bg-gradient-to-r from-gray-50 to-white">
                  <div 
                    className="h-24 w-24 flex-shrink-0 cursor-pointer"
                    onClick={() => handleImageClick(mainImage)}
                  >
                    <SafeImage 
                      crossOrigin="anonymous" referrerPolicy="no-referrer"
                      loading="lazy"
                      src={mainImage} 
                      alt={product.name} 
                      className="h-full w-full object-cover rounded-lg border-2 border-gray-200 transition-transform duration-200 active:scale-95"
                    />
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 text-base leading-tight">{product.name}</h3>
                        <div className="flex gap-1 flex-shrink-0">
                          <Link 
                            to={`/productos/editar/${product.id}`} 
                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            title="Editar"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => openDeleteModal(product)}
                            className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            title="Eliminar"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 font-mono bg-gray-100 inline-block px-2 py-0.5 rounded">{product.productSku}</p>
                      <p className="text-xs text-gray-600 mt-1">{product.category}</p>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${product.publishOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {product.publishOnline ? '✅ En línea' : '📝 Borrador'}
                      </span>
                      <span className={`px-2 py-1 text-xs font-bold rounded-full ${totalStock === 0 ? 'bg-red-100 text-red-700' : totalStock < 5 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        📦 {totalStock} un.
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Detalles con scroll */}
                <div className="px-4 py-3 border-t border-gray-100">
                  {/* Detalles del producto */}
                  {product.shortDetails && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">Detalles:</p>
                      <div className="text-sm text-gray-700 max-h-16 overflow-y-auto bg-gray-50 p-2 rounded">
                        {product.shortDetails}
                      </div>
                    </div>
                  )}
                  
                  {/* Proveedor */}
                  {product.supplier && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-500">Proveedor: <span className="text-gray-700 font-normal">{product.supplier}</span></p>
                    </div>
                  )}
                  
                  {/* Variantes con scroll horizontal */}
                  {product.variants && product.variants.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-500 mb-2">Variantes ({product.variants.length}):</p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {product.variants.map((variant, idx) => (
                          <div key={idx} className="flex-shrink-0 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 min-w-[120px]">
                            <div className="flex items-center gap-2 mb-1">
                              <div 
                                className="w-5 h-5 rounded-full border-2 border-gray-300" 
                                style={{ backgroundColor: variant.hexColor }}
                              />
                              <span className="text-xs font-medium text-gray-700">{variant.colorName}</span>
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {variant.sizes?.length || 0} tallas
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Precio */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div>
                      <span className="block text-xl font-bold text-gray-900">
                        ${calculateDiscountedPrice(product.publicPrice, product.offerPercentage).toFixed(2)}
                      </span>
                      <span className="text-xs text-gray-500">
                        💰 Costo: ${(Number(product.cost) || 0).toFixed(2)}
                      </span>
                    </div>
                    {product.offerPercentage > 0 && (
                      <div className="text-right">
                        <div className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded">
                          🏷️ -{product.offerPercentage}%
                        </div>
                        <div className="text-xs text-gray-400 line-through mt-0.5">
                          ${(Number(product.publicPrice) || 0).toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
        })}
      </div>

      {/* --- Modal de Zoom --- */}
      <ImageZoomModal 
        imageUrl={zoomedImageUrl} 
        onClose={handleCloseModal} 
      />

      {/* --- Modal de Confirmación de Eliminación --- */}
      {deleteModalOpen && productToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header del Modal */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 rounded-full">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Eliminar Producto</h3>
              </div>
              <button
                onClick={closeDeleteModal}
                disabled={isDeleting}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
              >
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="p-4 space-y-4">
              {/* Info del Producto */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <SafeImage
                  src={getMainImage(productToDelete.variants)}
                  alt={productToDelete.name}
                  className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                />
                <div>
                  <p className="font-semibold text-gray-900">{productToDelete.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{productToDelete.productSku}</p>
                  <p className="text-xs text-gray-500">{productToDelete.category}</p>
                </div>
              </div>

              {/* Estado de Verificación */}
              {isVerifying ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Verificando dependencias...</span>
                </div>
              ) : deleteVerification ? (
                <div className="space-y-3">
                  {deleteVerification.canDelete ? (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-800 font-medium flex items-center gap-2">
                        <span>✅</span> Este producto puede ser eliminado
                      </p>
                      <p className="text-green-700 text-sm mt-1">
                        No tiene órdenes pendientes, pagos pendientes ni stock en inventario.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-800 font-medium flex items-center gap-2">
                        <span>❌</span> No se puede eliminar este producto
                      </p>
                      <ul className="mt-2 space-y-1">
                        {deleteVerification.reasons.map((reason, idx) => (
                          <li key={idx} className="text-red-700 text-sm flex items-start gap-2">
                            <span className="mt-0.5">•</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Resumen de Verificación */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className={`p-2 rounded-lg ${deleteVerification.totalStock === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <p className={`text-lg font-bold ${deleteVerification.totalStock === 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {deleteVerification.totalStock}
                      </p>
                      <p className="text-xs text-gray-600">Stock</p>
                    </div>
                    <div className={`p-2 rounded-lg ${deleteVerification.pendingOrders === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <p className={`text-lg font-bold ${deleteVerification.pendingOrders === 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {deleteVerification.pendingOrders}
                      </p>
                      <p className="text-xs text-gray-600">Órdenes Pend.</p>
                    </div>
                    <div className={`p-2 rounded-lg ${deleteVerification.ordersWithPendingPayments === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <p className={`text-lg font-bold ${deleteVerification.ordersWithPendingPayments === 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {deleteVerification.ordersWithPendingPayments}
                      </p>
                      <p className="text-xs text-gray-600">Pagos Pend.</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Error de Eliminación */}
              {deleteError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">
                    <strong>Error:</strong> {deleteError}
                  </p>
                </div>
              )}

              {/* Advertencia */}
              {deleteVerification?.canDelete && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-amber-800 text-sm">
                    <strong>⚠️ Advertencia:</strong> Esta acción eliminará permanentemente el producto y todas sus imágenes. Esta acción no se puede deshacer.
                  </p>
                </div>
              )}
            </div>

            {/* Footer del Modal */}
            <div className="flex gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={closeDeleteModal}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteProduct}
                disabled={!deleteVerification?.canDelete || isDeleting || isVerifying}
                className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  deleteVerification?.canDelete && !isDeleting
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <TrashIcon className="h-4 w-4" />
                    <span>Eliminar Producto</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de upgrade */}
      <UpgradeModal {...upgradeProps} />
    </div>
  );
};

export default Productos;