import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Select, { type OnChangeValue, type StylesConfig } from 'react-select';
import {
    CubeIcon, TagIcon, PhotoIcon, CreditCardIcon,
    ArrowLeftIcon, PlusIcon, CheckCircleIcon,
    ExclamationTriangleIcon, SwatchIcon, XMarkIcon,
    SparklesIcon, ArrowUpTrayIcon
} from '@heroicons/react/24/outline';
// 1. IMPORTAMOS useParams
import { Link, useNavigate, useParams } from 'react-router-dom';
import ColorPickerModal from './ColorPickerModal';
import ImageUploadModal from './ImageUploadModal';
import SafeImage from './SafeImage';

import { CATEGORIAS_PRODUCTOS, type CategoriaOption } from '../categorias';
import { TALLAS_PRODUCTOS, type TallaOption } from '../tallas';
import { COLORES_COMUNES, type ColorOption } from '../colores';

import { db } from "../credenciales";
// 2. IMPORTAMOS doc, getDoc, setDoc y Timestamp
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

// --- CONFIGURACIÓN Y DATOS ---
const OFFER_PERCENTAGES = Array.from({ length: 20 }, (_, i) => (i + 1) * 5);

const getFlatCategoryOptions = (): CategoriaOption[] => {
    let flatList: CategoriaOption[] = [];
    CATEGORIAS_PRODUCTOS.forEach(mainCat => {
        if (mainCat.children) {
            flatList = flatList.concat(mainCat.children);
        }
    });
    return flatList;
};

const CATEGORY_OPTIONS_FLAT: readonly OptionType[] = getFlatCategoryOptions();

const getFlatSizeOptions = (): TallaOption[] => {
    let flatList: TallaOption[] = [];
    TALLAS_PRODUCTOS.forEach(mainTalla => {
        if (mainTalla.children) {
            flatList = flatList.concat(mainTalla.children);
        }
    });
    return flatList;
};

const ALL_AVAILABLE_SIZES_FLAT: readonly OptionType[] = getFlatSizeOptions();

// --- TIPOS DE DATOS ---
interface SizeStock {
    size: string;
    stock: number;
    isInStock: boolean;
}

interface Variant {
    id: number;
    variantSku: string;
    colorName: string;
    hexColor: string;
    sizes: SizeStock[];
    imageIds: string[];
    imageUrls: string[];
    publishOnline: boolean;
}

interface ProductData {
    id?: string; // Opcional para identificar si ya existe
    name: string;
    productSku: string;
    creationDate: string;
    cost: number;
    publicPrice: number;
    offerPercentage: number;
    supplier: string;
    category: string;
    shortDetails: string;
    longDescription: string;
    dateAdded: number;
    publishOnline: boolean;
    variants: Variant[];
}

interface OptionType {
    value: string;
    label: string;
}

interface UploadProgress {
    current: number;
    total: number;
    message: string;
}

// --- CONSTANTES ---
// Usamos tu backend SOLO para subir imágenes, pero Firestore para guardar los datos
const BACKEND_URL = (import.meta.env.VITE_API_URL || "https://stela-backend.vercel.app").trim();
const UPLOAD_ENDPOINT = `${BACKEND_URL}/api/upload`;

const CATEGORY_SELECT_OPTIONS: readonly OptionType[] = CATEGORY_OPTIONS_FLAT;
const SIZE_SELECT_OPTIONS: readonly OptionType[] = ALL_AVAILABLE_SIZES_FLAT;

const customStyles: StylesConfig<OptionType, boolean> = {
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
    multiValue: (provided) => ({
        ...provided,
        backgroundColor: '#eff6ff',
        color: '#1e40af',
        borderRadius: '4px',
    }),
    multiValueLabel: (provided) => ({
        ...provided,
        color: '#1e40af',
        paddingRight: '6px',
        fontWeight: 500,
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

// Estilos para el Select de colores (tipado con ColorOption)
const colorSelectStyles: StylesConfig<ColorOption, boolean> = {
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
        padding: '8px 12px',
    }),
    placeholder: (provided) => ({
        ...provided,
        color: '#9ca3af',
    }),
};

const handleNumberFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.select();
};

const calculatePublicPrice = (costo: number): number => {
    const cost = Number(costo) || 0;
    const costFixed = parseFloat(cost.toFixed(2));
    if (costFixed <= 150) return Math.ceil(costFixed * 2);
    if (costFixed <= 250) return Math.ceil(costFixed * 1.9);
    return Math.ceil(costFixed * 1.8);
};

const calculateFinalPrice = (publicPrice: number, offerPercentage: number): number => {
    const price = Number(publicPrice) || 0;
    const offer = Number(offerPercentage) || 0;
    if (offer <= 0 || offer > 100) return price;
    const discount = price * (offer / 100);
    return parseFloat((price - discount).toFixed(2));
};

const generateProductSku = (name: string, category: string): string => {
    const nameCode = name.substring(0, 3).toUpperCase().padEnd(3, 'X');
    const categoryCode = category.substring(0, 3).toUpperCase().padEnd(3, 'X');
    const uniqueId = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `MAL-${categoryCode}-${nameCode}-${uniqueId}`;
};

const generateVariantSku = (productSku: string, colorName: string, size: string): string => {
    const colorCode = colorName.substring(0, 3).toUpperCase().padEnd(3, 'X');
    return `${productSku}-${colorCode}-${size}`;
};

// --- Componente: VariantCard ---
interface VariantCardProps {
    variant: Variant;
    productSku: string;
    localPreviews?: string[];
    onUpdate: (id: number, updatedData: Partial<Variant>) => void;
    openColorPicker: (variantId: number, currentColor: string) => void;
    openImageModal: (variantId: number) => void;
    removeImage: (variantId: number, imageIndex: number) => void;
    removeLocalPreview: (variantId: number, previewIndex: number) => void;
}

const VariantCard: React.FC<VariantCardProps> = ({
    variant, productSku, localPreviews, onUpdate,
    openColorPicker, openImageModal, removeImage, removeLocalPreview
}) => {
    const activeSizesOptions: readonly OptionType[] = useMemo(() =>
        variant.sizes.map(s => ({ value: s.size, label: s.size })),
        [variant.sizes]);

    const handleActiveSizesChange = (newValue: OnChangeValue<OptionType, true>) => {
        const newSelectedSizes = (newValue as OptionType[]).map(option => option.value);
        const currentSizesMap = new Map(variant.sizes.map(s => [s.size, s]));
        const newSizes: SizeStock[] = newSelectedSizes.map(size => {
            const existing = currentSizesMap.get(size);
            if (existing) {
                return existing;
            } else {
                return { size, stock: 0, isInStock: false };
            }
        });
        onUpdate(variant.id, { sizes: newSizes });
    };

    const handleStockChange = (size: string, newStock: number) => {
        const updatedSizes = variant.sizes.map(s => {
            if (s.size === size) {
                const stock = newStock;
                return { ...s, stock: stock, isInStock: stock > 0 };
            }
            return s;
        });
        onUpdate(variant.id, { sizes: updatedSizes });
    };

    const handleColorNameChange = (newColorName: string) => {
        const newVariantSku = generateVariantSku(productSku, newColorName, 'XXX');
        onUpdate(variant.id, { colorName: newColorName, variantSku: newVariantSku });
    };

    const hasImages = variant.imageUrls.length > 0 || (localPreviews && localPreviews.length > 0);
    const isReadyForSale = hasImages && variant.sizes.length > 0;
    const maxPreviewImages = 3;
    const totalImages = variant.imageUrls.length + (localPreviews?.length || 0);

    return (
        <div className={`bg-white shadow-sm rounded-lg p-5 border ${variant.publishOnline ? 'border-green-300 bg-green-50/30' : 'border-gray-200'} space-y-4`}>
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                <h3 className="text-lg font-semibold text-gray-800 flex flex-col items-start">
                    <span className='flex items-center'>
                        <TagIcon className="h-5 w-5 mr-2 text-blue-600" />
                        Variante: {variant.colorName || 'Nuevo Color'}
                    </span>
                    <span className="text-xs text-gray-500 mt-1">SKU Base: {variant.variantSku}</span>
                </h3>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <span className={`text-xs font-medium ${variant.publishOnline ? 'text-green-600' : 'text-gray-500'}`}>
                            {variant.publishOnline ? 'En tienda' : 'Oculta'}
                        </span>
                        <input
                            type="checkbox"
                            checked={variant.publishOnline}
                            onChange={(e) => onUpdate(variant.id, { publishOnline: e.target.checked })}
                            className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                            title="Publicar esta variante en la tienda online"
                        />
                    </label>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-100 pb-4">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Color (Seleccionar o Personalizado)</label>
                    <div className="space-y-2">
                        <Select
                            options={COLORES_COMUNES as any}
                            value={
                                COLORES_COMUNES.find((c: ColorOption) => c.hex === variant.hexColor) as any || null
                            }
                            onChange={(selected: any) => {
                                if (selected) {
                                    onUpdate(variant.id, { 
                                        colorName: selected.nombre, 
                                        hexColor: selected.hex,
                                        variantSku: generateVariantSku(productSku, selected.nombre, 'XXX')
                                    });
                                }
                            }}
                            isClearable
                            isSearchable
                            getOptionLabel={(opt: ColorOption) => opt.nombre}
                            getOptionValue={(opt: ColorOption) => opt.hex}
                            placeholder="Selecciona un color..."
                            formatOptionLabel={(option: any) => (
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-6 h-6 rounded-full border-2 border-gray-300"
                                        style={{ backgroundColor: option.hex }}
                                        title={option.nombre}
                                    />
                                    <span>{option.nombre}</span>
                                </div>
                            )}
                            styles={colorSelectStyles}
                            className="text-base"
                        />
                        <p className="text-xs text-gray-500">O escribe un color personalizado abajo →</p>
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Nombre del Color (Personalizado)</label>
                    <input
                        type="text"
                        placeholder="Ej: Azul Marino"
                        value={variant.colorName}
                        onChange={(e) => {
                            const newColorName = e.target.value;
                            handleColorNameChange(newColorName);
                        }}
                        className="w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2 text-sm"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Código HEX</label>
                    <div className="flex items-center space-x-2">
                        <input
                            type="text"
                            placeholder="#0000FF"
                            value={variant.hexColor}
                            onChange={(e) => onUpdate(variant.id, { hexColor: e.target.value.toUpperCase() })}
                            className="w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2 text-sm font-mono"
                        />
                        <button
                            onClick={() => openColorPicker(variant.id, variant.hexColor)}
                            className="h-9 w-9 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-100 transition"
                            style={{ backgroundColor: variant.hexColor || '#FFF' }}
                            title="Abrir selector de color"
                        >
                            <SwatchIcon className='h-5 w-5 text-gray-800' />
                        </button>
                    </div>
                </div>
                <div className="space-y-2 col-span-1 md:col-span-3">
                    <label className="text-sm font-medium text-gray-700 block">Imágenes Vinculadas ({totalImages}) *</label>
                    <div className='flex flex-wrap gap-2 mb-2'>
                        {/* Imágenes ya subidas */}
                        {variant.imageUrls.map((url, index) => (
                            <div key={`url-${index}`} className="relative group w-20 h-20">
                                <SafeImage
                                    crossOrigin="anonymous"
                                    referrerPolicy="no-referrer"
                                    src={url}
                                    alt={`Imagen ${index + 1}`}
                                    className="w-full h-full object-cover rounded-md border-2 border-gray-200"
                                />
                                <button
                                    onClick={() => removeImage(variant.id, index)}
                                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition duration-150"
                                    title={`Eliminar imagen ${index + 1}`}
                                >
                                    <XMarkIcon className='h-4 w-4' />
                                </button>
                                {index === 0 && (
                                    <span className='absolute bottom-0 left-0 px-1 py-0.5 text-xs bg-blue-600 text-white rounded-br-md rounded-tl-md font-medium'>Principal</span>
                                )}
                            </div>
                        ))}

                        {/* Previsualizaciones locales */}
                        {localPreviews?.map((previewUrl, index) => (
                            <div key={`preview-${index}`} className="relative group w-20 h-20 border-2 border-dashed border-blue-400 rounded-md overflow-hidden">
                                <SafeImage
                                    crossOrigin="anonymous"
                                    referrerPolicy="no-referrer"
                                    src={previewUrl}
                                    alt={`Preview ${index + 1}`}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute bottom-0 left-0 px-1 py-0.5 text-xs bg-blue-600 text-white rounded-br-md rounded-tl-md font-medium">
                                    Nuevo
                                </div>
                                <button
                                    onClick={() => removeLocalPreview(variant.id, index)}
                                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition duration-150"
                                    title={`Eliminar preview ${index + 1}`}
                                >
                                    <XMarkIcon className='h-4 w-4' />
                                </button>
                            </div>
                        ))}

                        {totalImages > maxPreviewImages && (
                            <div className='w-20 h-20 flex items-center justify-center text-center text-xs bg-gray-100 text-gray-600 rounded-md border border-gray-300'>
                                +{totalImages - maxPreviewImages} más
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => openImageModal(variant.id)}
                        className={`w-full flex items-center justify-center p-2 rounded-md transition text-sm ${hasImages ? 'bg-blue-50 border border-blue-300 text-blue-700 hover:bg-blue-100' : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        <PhotoIcon className="h-5 w-5 mr-2" />
                        {hasImages ? 'Añadir/Cambiar Imágenes' : 'Asignar Imágenes'}
                    </button>
                </div>
            </div>
            <div className="space-y-3 pt-3">
                <p className="text-sm font-medium text-gray-700">1. Tallas Activas:</p>
                <Select<OptionType, true>
                    isMulti
                    options={SIZE_SELECT_OPTIONS}
                    value={activeSizesOptions}
                    onChange={handleActiveSizesChange}
                    placeholder="Seleccionar tallas disponibles..."
                    styles={customStyles}
                    className="text-base"
                />
            </div>
            
            {variant.sizes.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-gray-100">
                    <p className="text-sm font-medium text-gray-700">2. Stock Físico por Talla:</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {variant.sizes.map((sizeData) => (
                            <div key={sizeData.size} className="bg-gray-50 p-3 rounded-md border border-gray-200">
                                <label className="text-sm font-medium text-gray-800 flex justify-between items-center mb-1">
                                    {sizeData.size}
                                    <span className={`text-xs font-semibold ${sizeData.isInStock ? 'text-green-600' : 'text-amber-600'}`}>
                                        {sizeData.isInStock ? 'STOCK' : 'BAJO PEDIDO'}
                                    </span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="Stock"
                                    value={sizeData.stock}
                                    onChange={(e) => handleStockChange(sizeData.size, parseInt(e.target.value) || 0)}
                                    onFocus={handleNumberFocus}
                                    className="w-full border border-gray-300 rounded-md p-1.5 text-sm text-center focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {!isReadyForSale && (
                <div className="flex items-start p-3 bg-amber-50 border border-amber-200 rounded-md mt-4">
                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 mr-3 mt-0.5" />
                    <p className="text-sm text-amber-800">
                        Advertencia: Esta variante no está lista. Asigna al menos una imagen y selecciona talla/stock.
                    </p>
                </div>
            )}
        </div>
    );
};

// --- Componente Principal ---
const CrearEditarProducto: React.FC = () => {
    const navigate = useNavigate();
    // 3. CAPTURAMOS EL ID
    const { id } = useParams();
    const isEditMode = Boolean(id);
    
    const [isUploading, setIsUploading] = useState(false);
    const [isFetchingData, setIsFetchingData] = useState(isEditMode); // Estado de carga inicial
    const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ current: 0, total: 0, message: '' });
    
    const [pendingFiles, setPendingFiles] = useState<Record<number, File[]>>({});
    const [localImagePreviews, setLocalImagePreviews] = useState<Record<number, string[]>>({});
    
    const [product, setProduct] = useState<ProductData>(() => ({
        name: '',
        productSku: generateProductSku('', 'XXX'),
        creationDate: new Date().toLocaleString(),
        cost: 0, publicPrice: 0, offerPercentage: 0, supplier: '', category: '',
        shortDetails: '',
        longDescription: '',
        dateAdded: Date.now(),
        publishOnline: false,
        variants: [],
    }));

    // --- 4. CARGAR DATOS SI ES EDICIÓN ---
    useEffect(() => {
        if (!isEditMode || !id) return;

        const loadProductData = async () => {
            setIsFetchingData(true);
            try {
                const docRef = doc(db, "productos", id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data() as ProductData;
                    // Asegurarnos que todos los campos existen (merge con defaults)
                    setProduct({
                        name: data.name || '',
                        productSku: data.productSku || '',
                        creationDate: data.creationDate || new Date().toLocaleString(),
                        cost: Number(data.cost) || 0,
                        publicPrice: Number(data.publicPrice) || 0,
                        offerPercentage: Number(data.offerPercentage) || 0,
                        supplier: data.supplier || '',
                        category: data.category || '',
                        shortDetails: data.shortDetails || '',
                        longDescription: data.longDescription || '',
                        dateAdded: data.dateAdded || Date.now(),
                        publishOnline: data.publishOnline || false,
                        variants: (data.variants || []).map(v => ({
                            ...v,
                            publishOnline: v.publishOnline !== undefined ? v.publishOnline : true
                        }))
                    });
                } else {
                    alert("Producto no encontrado");
                    navigate('/productos');
                }
            } catch (error) {
                console.error("Error al cargar producto:", error);
                alert("Error al cargar los datos del producto");
            } finally {
                setIsFetchingData(false);
            }
        };

        loadProductData();
    }, [id, isEditMode, navigate]);


    // --- MODALES ---
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const [currentVariantIdForColor, setCurrentVariantIdForColor] = useState<number | null>(null);
    const [currentColorForPicker, setCurrentColorForPicker] = useState<string>('#FFFFFF');
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [currentVariantIdForImage, setCurrentVariantIdForImage] = useState<number | null>(null);

    const [supplierOptions, setSupplierOptions] = useState<OptionType[]>([]);
    const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true);

    const fetchSuppliers = useCallback(async () => {
        setIsLoadingSuppliers(true);
        try {
            const suppliersCol = collection(db, 'proveedores');
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
    }, []);

    useEffect(() => {
        fetchSuppliers();
    }, [fetchSuppliers]);

    useEffect(() => {
        return () => {
            Object.values(localImagePreviews).forEach(urls =>
                urls.forEach(url => URL.revokeObjectURL(url))
            );
        };
    }, [localImagePreviews]);

    const openColorPicker = (variantId: number, currentColor: string) => {
        setCurrentVariantIdForColor(variantId);
        setCurrentColorForPicker(currentColor);
        setIsColorPickerOpen(true);
    };

    const handleColorSelect = (newHex: string) => {
        if (currentVariantIdForColor !== null) {
            updateVariant(currentVariantIdForColor, { hexColor: newHex });
        }
        setIsColorPickerOpen(false);
        setCurrentVariantIdForColor(null);
    };

    const openImageModal = (variantId: number) => {
        setCurrentVariantIdForImage(variantId);
        setIsImageModalOpen(true);
    };

    const removeImage = useCallback((variantId: number, imageIndex: number) => {
        setProduct(prev => ({
            ...prev,
            variants: prev.variants.map(v => {
                if (v.id === variantId) {
                    const newUrls = v.imageUrls.filter((_, i) => i !== imageIndex);
                    const newIds = v.imageIds ? v.imageIds.filter((_, i) => i !== imageIndex) : [];
                    return { ...v, imageUrls: newUrls, imageIds: newIds };
                }
                return v;
            })
        }));
    }, []);

    const removeLocalPreview = useCallback((variantId: number, previewIndex: number) => {
        setLocalImagePreviews(prev => {
            const newPreviews = { ...prev };
            if (newPreviews[variantId]) {
                const urlToRevoke = newPreviews[variantId][previewIndex];
                URL.revokeObjectURL(urlToRevoke);

                newPreviews[variantId] = newPreviews[variantId].filter((_, i) => i !== previewIndex);
                if (newPreviews[variantId].length === 0) {
                    delete newPreviews[variantId];
                }
            }
            return newPreviews;
        });

        setPendingFiles(prev => {
            const newFiles = { ...prev };
            if (newFiles[variantId]) {
                newFiles[variantId] = newFiles[variantId].filter((_, i) => i !== previewIndex);
                if (newFiles[variantId].length === 0) {
                    delete newFiles[variantId];
                }
            }
            return newFiles;
        });
    }, []);

    const handleImagesAssigned = useCallback((variantId: number, filesOrUrls: any[], imageIds?: string[]) => {
        const isFilesArray = filesOrUrls.length > 0 && filesOrUrls[0] instanceof File;
        if (variantId === null) return;

        if (isFilesArray) {
            const newFiles = filesOrUrls as File[];
            const newPreviewUrls = newFiles.map(file => URL.createObjectURL(file));

            setLocalImagePreviews(prev => ({
                ...prev,
                [variantId]: [
                    ...(prev[variantId] || []),
                    ...newPreviewUrls
                ]
            }));

            setPendingFiles(prev => ({
                ...prev,
                [variantId]: [
                    ...(prev[variantId] || []),
                    ...newFiles
                ]
            }));
        } else {
            setProduct(prev => ({
                ...prev,
                variants: prev.variants.map(v => {
                    if (v.id === variantId) {
                        return { ...v, imageUrls: filesOrUrls as string[], imageIds: imageIds || [] };
                    }
                    return v;
                })
            }));
        }

        setIsImageModalOpen(false);
        setCurrentVariantIdForImage(null);
    }, []);

    const finalPrice = useMemo(() =>
        calculateFinalPrice(product.publicPrice, product.offerPercentage),
        [product.publicPrice, product.offerPercentage]
    );

    const handleCostChange = (newCost: number) => {
        const calculatedPrice = calculatePublicPrice(newCost);
        setProduct(prev => ({ ...prev, cost: newCost, publicPrice: calculatedPrice }));
    };

    const handleChange = (field: keyof ProductData, value: any) => {
        setProduct(prev => {
            let newSku = prev.productSku;
            const isCheckbox = field === 'publishOnline';
            let finalValue = isCheckbox ? !!value : value;
            let newProduct = { ...prev, [field]: finalValue };

            // MODIFICACIÓN CLAVE:
            // Solo regeneramos el SKU si NO estamos en modo edición.
            // Si isEditMode es true, el SKU se respeta tal cual viene de la base de datos.
            if (!isEditMode && (field === 'name' || field === 'category')) {
                const name = field === 'name' ? value : prev.name;
                const category = field === 'category' ? value : prev.category;
                newSku = generateProductSku(name, category);
                newProduct.productSku = newSku;

                // También regeneramos los SKUs de variantes SOLO si es producto nuevo
                newProduct.variants = newProduct.variants.map(v => ({
                    ...v,
                    variantSku: generateVariantSku(newSku, v.colorName, 'XXX')
                }));
            }
            return newProduct;
        });
    };

    const addVariant = useCallback(() => {
        const color = `Color ${product.variants.length + 1}`;
        const newVariant: Variant = {
            id: Date.now(),
            variantSku: generateVariantSku(product.productSku, color, 'XXX'),
            colorName: color, hexColor: '#CCCCCC', sizes: [],
            imageIds: [], imageUrls: [],
            publishOnline: true
        };
        setProduct(prev => ({ ...prev, variants: [...prev.variants, newVariant] }));
    }, [product.variants.length, product.productSku]);

    const updateVariant = useCallback((id: number, updatedData: Partial<Variant>) => {
        setProduct(prev => ({
            ...prev,
            variants: prev.variants.map(v => {
                if (v.id === id) {
                    const updatedVariant = { ...v, ...updatedData };                  
                    return updatedVariant;
                }
                return v;
            })
        }));
    }, []); 

    const isFormValid = useMemo(() => {
        const requiredGeneralFields = product.name && product.category && product.publicPrice > 0;
        if (!requiredGeneralFields) return false;
        if (product.variants.length === 0) return false;
        const allVariantsReady = product.variants.every(v =>
            v.sizes.length === 0 || (v.sizes.length > 0 && (v.imageUrls.length > 0 || (pendingFiles[v.id]?.length || 0) > 0))
        );
        return allVariantsReady;
    }, [product, pendingFiles]);

    const handleGenerateDescription = async () => {
        if (!product.name || !product.category) {
            alert("Por favor, rellena el Nombre y la Categoría para generar la descripción.");
            return;
        }

        if (!product.productSku) {
            alert("SKU del producto no disponible.");
            return;
        }

        // Determinar el ID de documento a usar en el endpoint
        const skuForEndpoint = isEditMode && id ? id : product.productSku;

        // Construir payload mínimo para IA (en caso de necesitar crear doc)
        const buildMinimalProductForAI = (): Partial<ProductData> => ({
            name: product.name,
            productSku: product.productSku,
            creationDate: product.creationDate,
            cost: product.cost,
            publicPrice: product.publicPrice,
            offerPercentage: product.offerPercentage,
            supplier: product.supplier,
            category: product.category,
            shortDetails: product.shortDetails,
            longDescription: product.longDescription || '',
            dateAdded: product.dateAdded,
            publishOnline: product.publishOnline,
            variants: product.variants.map(v => ({
                id: v.id,
                variantSku: v.variantSku,
                colorName: v.colorName,
                hexColor: v.hexColor,
                sizes: v.sizes.map(s => ({ size: s.size, stock: s.stock, isInStock: s.isInStock })),
                imageIds: v.imageIds,
                imageUrls: v.imageUrls,
                publishOnline: v.publishOnline
            }))
        });

        // Llamada al endpoint documentado: POST /api/generate-description
        // En dev usamos ruta relativa para pasar por el proxy de Vite y evitar CORS
        setIsUploading(true);
        try {
            // Asegurarnos que existe el documento en Firestore antes de llamar al backend
            const preDocRef = doc(db, "productos", skuForEndpoint);
            const preDocSnap = await getDoc(preDocRef);
            if (!preDocSnap.exists()) {
                // Crear/sembrar el documento con datos actuales del estado
                await setDoc(preDocRef, buildMinimalProductForAI(), { merge: true });
            }

            const endpoint = import.meta.env.DEV
                ? '/api/generate-description'
                : `${BACKEND_URL}/api/generate-description`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    productSku: skuForEndpoint,
                    autoSave: false
                })
            });

            // Intentamos parsear JSON, si falla, obtenemos texto para mejor diagnóstico
            let data: any = null
            try {
                data = await response.json()
            } catch {
                const text = await response.text()
                throw new Error(`HTTP ${response.status} ${response.statusText} - ${text || 'Sin contenido'}`)
            }

            if (!response.ok) {
                throw new Error(data?.error || `HTTP ${response.status} ${response.statusText}`)
            }

            if (data?.success && data?.data?.description) {
                setProduct(prev => ({ ...prev, longDescription: data.data.description }));
            } else {
                throw new Error('Respuesta inválida del servidor');
            }
        } catch (error: any) {
            console.error('Error al generar descripción:', error);
            alert(`Error: ${error.message || 'No se pudo generar la descripción'}`);
        } finally {
            setIsUploading(false);
        }
    };

    // 📦 FUNCIONES DE SUBIDA POR LOTES (Sin cambios mayores, solo uso de la API)
    const uploadImageBatch = useCallback(async (
        filesBatch: File[],
        variantId: number,
        batchIndex: number
    ) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 28_000);
        try {
            const formData = new FormData();
            filesBatch.forEach((file, idx) => {
                const extension = file.name.split('.').pop() || 'jpg';
                const variantSku = product.variants.find(v => v.id === variantId)?.variantSku || 'UNKNOWN';
                const safeVariantSku = variantSku.replace(/[^a-zA-Z0-9]/g, '_');
                const timestamp = Date.now();
                const randomStr = Math.random().toString(36).substring(2, 8);
                const newFileName = `${safeVariantSku}-img-${timestamp}-${randomStr}-${idx}.${extension}`;
                formData.append('files', file, newFileName);
            });
            const response = await fetch(UPLOAD_ENDPOINT, {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errText}`);
            }
            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Error desconocido en subida');
            return {
                urls: result.urls || [],
                r2Keys: result.r2Keys || []
            };
        } catch (err: any) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                throw new Error(`Subida cancelada por timeout (lote ${batchIndex + 1})`);
            }
            throw err;
        }
    }, [product.variants]);

    const uploadAllNewImages = useCallback(async (): Promise<Record<number, { urls: string[]; r2Keys: string[] }>> => {
        const variantIds = Object.keys(pendingFiles).map(Number).filter(id => pendingFiles[id]?.length > 0);
        if (variantIds.length === 0) return {};
        const uploadedMap: Record<number, { urls: string[]; r2Keys: string[] }> = {};
        let totalFiles = 0;
        let currentFile = 0;
        variantIds.forEach(id => {
            totalFiles += pendingFiles[id].length;
        });
        setUploadProgress({ current: 0, total: totalFiles, message: 'Iniciando subida...' });
        const batchSize = 2;
        for (const variantId of variantIds) {
            const files = pendingFiles[variantId];
            if (!files || files.length === 0) continue;
            const batches = [];
            for (let i = 0; i < files.length; i += batchSize) {
                batches.push(files.slice(i, i + batchSize));
            }
            for (let idx = 0; idx < batches.length; idx++) {
                const batch = batches[idx];
                try {
                    setUploadProgress({
                        current: currentFile + idx * batchSize + 1,
                        total: totalFiles,
                        message: `Subiendo lote ${idx + 1}/${batches.length} (Variante ${variantId})`
                    });
                    const result = await uploadImageBatch(batch, variantId, idx);
                    if (!uploadedMap[variantId]) {
                        uploadedMap[variantId] = { urls: [], r2Keys: [] };
                    }
                    uploadedMap[variantId].urls.push(...result.urls);
                    uploadedMap[variantId].r2Keys.push(...result.r2Keys);
                    if (idx < batches.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 800));
                    }
                    currentFile += batch.length;
                } catch (err: any) {
                    console.error(`Error en subida de lote ${idx + 1} para variante ${variantId}:`, err);
                    throw new Error(`Error subiendo imágenes para variante ${variantId}: ${err.message}`);
                }
            }
        }
        setUploadProgress({ current: totalFiles, total: totalFiles, message: 'Subida completada.' });
        return uploadedMap;
    }, [pendingFiles, uploadImageBatch]);

    const buildPublicProduct = (p: ProductData) => ({
        name: p.name,
        productSku: p.productSku,
        category: p.category,
        publicPrice: p.publicPrice,
        offerPercentage: p.offerPercentage,
        shortDetails: p.shortDetails,
        longDescription: p.longDescription,
        publishOnline: p.publishOnline,
        dateAdded: p.dateAdded,
        variants: p.variants
            .filter(v => v.publishOnline) // Solo incluir variantes marcadas para publicar
            .map(v => ({
                id: v.id,
                variantSku: v.variantSku,
                colorName: v.colorName,
                hexColor: v.hexColor,
                imageUrls: v.imageUrls,
                sizes: v.sizes.map(s => ({ size: s.size, stock: s.stock, isInStock: s.isInStock })),
            })),
    });

    // --- 5. HANDLE SAVE ACTUALIZADO (FIRESTORE DIRECTO) ---
    const handleSave = useCallback(async () => {
        if (!isFormValid) {
            alert('Por favor, completa los campos requeridos.');
            return;
        }
        const hasPendingFiles = Object.values(pendingFiles).some(arr => arr.length > 0);
        setIsUploading(true);
        try {
            let uploadedMap: Record<number, { urls: string[]; r2Keys: string[] }> = {};
            
            // 1. Subir imágenes pendientes (API Backend)
            if (hasPendingFiles) {
                uploadedMap = await uploadAllNewImages();
            }

            // 2. Construir producto final
            const finalVariants = product.variants.map(variant => {
                const newUploads = uploadedMap[variant.id] || { urls: [], r2Keys: [] };
                return {
                    ...variant,
                    imageUrls: [...variant.imageUrls, ...newUploads.urls],
                    imageIds: [...variant.imageIds, ...newUploads.r2Keys]
                };
            });

            const finalProduct: ProductData = {
                ...product,
                variants: finalVariants
            };

            const productDocId = (isEditMode && id) ? id : product.productSku;
            const productDocRef = doc(db, "productos", productDocId);
            const publicDocRef = doc(db, "productos_public", productDocId);

            await setDoc(productDocRef, finalProduct, { merge: true });

            if (finalProduct.publishOnline) {
                const publicProduct = buildPublicProduct(finalProduct);
                await setDoc(publicDocRef, publicProduct, { merge: true });
            } else {
                await deleteDoc(publicDocRef).catch(() => {});
            }

            // 4. Éxito
            Object.values(localImagePreviews).forEach(urls =>
                urls.forEach(url => URL.revokeObjectURL(url))
            );
            setLocalImagePreviews({});
            setPendingFiles({});
            setProduct(finalProduct);
            
            alert(isEditMode ? 'Producto actualizado exitosamente.' : 'Producto creado exitosamente.');
            navigate('/productos');

        } catch (error: any) {
            console.error('Error en handleSave:', error);
            alert(`Error al guardar: ${error.message || 'Problema desconocido'}`);
        } finally {
            setIsUploading(false);
            setUploadProgress({ current: 0, total: 0, message: '' });
        }
    }, [isFormValid, pendingFiles, product, uploadAllNewImages, navigate, localImagePreviews, isEditMode, id]);

    const currentVariantSkuForImage = useMemo(() => {
        if (currentVariantIdForImage === null) return '';
        const variant = product.variants.find(v => v.id === currentVariantIdForImage);
        return variant ? variant.variantSku : '';
    }, [currentVariantIdForImage, product.variants]);

    useEffect(() => {
        const validVariantIds = new Set(product.variants.map(v => v.id));
        setPendingFiles(prev => {
            const cleaned = { ...prev };
            Object.keys(cleaned).forEach(id => {
                if (!validVariantIds.has(Number(id))) {
                    delete cleaned[Number(id)];
                }
            });
            return cleaned;
        });
        setLocalImagePreviews(prev => {
            const cleaned = { ...prev };
            Object.keys(cleaned).forEach(id => {
                if (!validVariantIds.has(Number(id))) {
                    cleaned[Number(id)].forEach(url => URL.revokeObjectURL(url));
                    delete cleaned[Number(id)];
                }
            });
            return cleaned;
        });
    }, [product.variants]);

    // --- RENDERIZADO ---
    
    // Spinner de carga inicial al buscar datos
    if (isFetchingData) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-gray-500">Cargando datos del producto...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {(isUploading && uploadProgress.total > 0) && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3">
                    <ArrowUpTrayIcon className="h-5 w-5 animate-bounce" />
                    <span className="font-medium">
                        {uploadProgress.message} ({uploadProgress.current}/{uploadProgress.total})
                    </span>
                    <div className="w-24 h-2 bg-blue-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-white transition-all duration-300"
                            style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                        />
                    </div>
                </div>
            )}
            {isUploading && uploadProgress.total === 0 && (
                <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center">
                    <div className="bg-white p-5 rounded-lg shadow-xl flex flex-col items-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
                        <p className="text-gray-800 font-semibold">Guardando cambios...</p>
                    </div>
                </div>
            )}
            <ColorPickerModal
                isOpen={isColorPickerOpen}
                onClose={() => setIsColorPickerOpen(false)}
                currentColor={currentColorForPicker}
                onColorSelect={handleColorSelect}
            />
            <ImageUploadModal
                isOpen={isImageModalOpen}
                onClose={() => setIsImageModalOpen(false)}
                variantId={currentVariantIdForImage || 0}
                onImagesAssigned={handleImagesAssigned}
                variantSku={currentVariantSkuForImage}
            />
            <div className="flex items-center justify-between">
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">
                    {isEditMode ? 'Editar Producto' : 'Crear Nuevo Producto'}
                </h1>
                <Link to="/productos" className="flex items-center text-sm font-medium text-gray-600 hover:text-blue-600 transition">
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Volver a la lista
                </Link>
            </div>
            <div className="flex justify-between items-center text-sm text-gray-500">
                <p>SKU Producto: <span className='font-mono text-gray-800 font-semibold'>{product.productSku}</span></p>
                <p>{isEditMode ? 'Editando desde:' : 'Creado:'} {product.creationDate}</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white shadow-sm rounded-lg p-6 space-y-4">
                        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                            <CubeIcon className="h-6 w-6 mr-2 text-gray-500" /> Datos Generales
                        </h2>
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-700">Nombre del Producto *</label>
                            <input type="text" value={product.name} onChange={(e) => handleChange('name', e.target.value)}
                                className="w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2.5 text-base"
                                placeholder="Ej: Vestido Estampado de Verano"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Categoría *</label>
                                <Select<OptionType, false>
                                    options={CATEGORY_SELECT_OPTIONS}
                                    value={product.category ? { value: product.category, label: product.category } : null}
                                    onChange={(newValue) => handleChange('category', newValue ? newValue.value : '')}
                                    placeholder="Seleccionar..."
                                    isClearable
                                    isSearchable
                                    styles={customStyles}
                                    className="text-base"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Proveedor</label>
                                <Select<OptionType, false>
                                    options={supplierOptions}
                                    value={product.supplier ? { value: product.supplier, label: product.supplier } : null}
                                    onChange={(newValue) => handleChange('supplier', newValue ? newValue.value : '')}
                                    placeholder={isLoadingSuppliers ? "Cargando proveedores..." : "Seleccionar..."}
                                ></Select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Detalles de la Prenda</label>
                            <textarea value={product.shortDetails} onChange={(e) => handleChange('shortDetails', e.target.value)}
                                rows={3}
                                className="w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2.5 text-base"
                                placeholder="Escribe aquí los detalles cortos (Materiales, Cuidados)."
                            />
                        </div>
                    </div>
                    <div className="bg-white shadow-sm rounded-lg p-6 space-y-4">
                        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                            <SparklesIcon className="h-6 w-6 mr-2 text-purple-500" /> Descripción para Cliente
                        </h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Descripción Larga *</label>
                            <textarea
                                value={product.longDescription}
                                onChange={(e) => handleChange('longDescription', e.target.value)}
                                rows={5}
                                placeholder="Descripción visible en la tienda online."
                                className="w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2.5 text-base"
                            />
                        </div>
                        <div className="border-t pt-4">
                            <button
                                onClick={handleGenerateDescription}
                                type="button"
                                className="flex items-center justify-center px-4 py-2 border border-purple-300 shadow-sm text-sm font-medium rounded-md text-purple-700 bg-purple-50 hover:bg-purple-100 transition"
                            >
                                <SparklesIcon className="h-5 w-5 mr-2" />
                                Generar Descripción con IA
                            </button>
                        </div>
                    </div>
                    <div className="bg-white shadow-sm rounded-lg p-6 space-y-4">
                        <h2 className="text-xl font-semibold text-gray-800 flex items-center justify-between">
                            <span className='flex items-center'><TagIcon className="h-6 w-6 mr-2 text-gray-500" /> Variantes y Stock</span>
                        </h2>
                        <div className="space-y-6">
                            {product.variants.map((variant) => (
                                <VariantCard
                                    key={variant.id}
                                    variant={variant}
                                    productSku={product.productSku}
                                    localPreviews={localImagePreviews[variant.id]}
                                    onUpdate={updateVariant}
                                    openColorPicker={openColorPicker}
                                    openImageModal={openImageModal}
                                    removeImage={removeImage}
                                    removeLocalPreview={removeLocalPreview}
                                />
                            ))}
                            {product.variants.length === 0 && (
                                <p className="text-center text-gray-500 text-sm py-4 border-2 border-dashed border-gray-200 rounded-lg">
                                    ¡Añade al menos una variante (Color/Tallas) para vender este producto!
                                </p>
                            )}
                            <button
                                onClick={addVariant}
                                className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition"
                            >
                                <PlusIcon className="h-5 w-5 mr-1" /> Agregar Nueva Variante
                            </button>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white shadow-sm rounded-lg p-5 space-y-4">
                        <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                            <CreditCardIcon className="h-5 w-5 mr-2 text-gray-500" /> Precios y Oferta
                        </h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Costo del Proveedor</label>
                            <input type="number" min="0" value={product.cost} onChange={(e) => handleCostChange(parseFloat(e.target.value) || 0)}
                                onFocus={handleNumberFocus}
                                className="w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2 text-base"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Precio Público (Base)</label>
                            <input type="number" min="0" value={product.publicPrice} onChange={(e) => handleChange('publicPrice', parseFloat(e.target.value) || 0)}
                                onFocus={handleNumberFocus}
                                className="w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2 text-base"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Oferta/Descuento</label>
                            <select value={product.offerPercentage} onChange={(e) => handleChange('offerPercentage', parseInt(e.target.value) || 0)}
                                className="w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2.5 text-base"
                            >
                                <option value={0}>0% (Sin Descuento)</option>
                                {OFFER_PERCENTAGES.map(p => (
                                    <option key={p} value={p}>{p}%</option>
                                ))}
                            </select>
                        </div>
                        <p className='text-sm text-gray-600 pt-2 border-t mt-3'>
                            Precio Final: <span className="font-semibold text-green-600">
                                ${finalPrice.toFixed(2)}
                            </span>
                        </p>
                    </div>
                    <div className="bg-white shadow-sm rounded-lg p-5">
                        <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                            <TagIcon className="h-5 w-5 mr-2 text-gray-500" /> Acciones
                        </h2>
                        <div className="flex items-center justify-between mb-4 pb-4 border-b">
                            <label htmlFor="toggle-publish" className="text-sm font-medium text-gray-700 flex-grow">
                                Publicar Producto en Tienda
                            </label>
                            <input
                                id="toggle-publish"
                                type="checkbox"
                                checked={product.publishOnline}
                                onChange={(e) => handleChange('publishOnline', e.target.checked)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                        </div>
                        <div className="text-xs text-gray-500 mb-3">
                            Variantes en tienda: <span className="font-semibold text-green-600">
                                {product.variants.filter(v => v.publishOnline).length}
                            </span> de {product.variants.length}
                        </div>
                        <div className="text-xs text-gray-500 mt-2 border-t border-gray-100 pt-3">
                            * Si hay stock disponible, la venta será por inventario físico. Si el stock es 0, la venta será bajo pedido.
                            <br />
                            * Puedes controlar qué variantes se muestran en la tienda desde cada tarjeta de variante.
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={!isFormValid || isUploading}
                            className={`w-full flex items-center justify-center px-6 py-3 text-base font-semibold rounded-md text-white transition mt-4 ${!isFormValid || isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                                }`}
                        >
                            <CheckCircleIcon className="h-6 w-6 mr-2" />
                            {isUploading ? (
                                uploadProgress.total > 0
                                    ? `Subiendo... (${uploadProgress.current}/{uploadProgress.total})`
                                    : 'Guardando...'
                            ) : (isEditMode ? 'Actualizar Producto' : 'Guardar Producto')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CrearEditarProducto;