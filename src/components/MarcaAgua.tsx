import React, { useState, useRef, useEffect, useCallback } from "react";
import JSZip from "jszip";
import imageCompression from "browser-image-compression";
import { PhotoIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';

type QualityPreset = 'ultra' | 'high' | 'medium' | 'low';

interface PresetConfig {
  label: string;
  maxSizeKB: number;
  quality: number;
  maxDimension: number;
  description: string;
}

const QUALITY_PRESETS: Record<QualityPreset, PresetConfig> = {
  ultra: {
    label: 'Ultra Alta (Recomendado para E-commerce)',
    maxSizeKB: 250,
    quality: 0.92,
    maxDimension: 2000,
    description: 'Máxima calidad, ideal para ver detalles de tela y acabados'
  },
  high: {
    label: 'Alta Calidad',
    maxSizeKB: 150,
    quality: 0.88,
    maxDimension: 1600,
    description: 'Excelente balance calidad-peso para productos'
  },
  medium: {
    label: 'Calidad Media',
    maxSizeKB: 100,
    quality: 0.82,
    maxDimension: 1200,
    description: 'Buena calidad, carga rápida'
  },
  low: {
    label: 'Optimizada Web',
    maxSizeKB: 50,
    quality: 0.75,
    maxDimension: 800,
    description: 'Peso mínimo, solo para miniaturas'
  }
};

function MarcaAgua() {
  const [images, setImages] = useState<string[]>([]);
  const [watermark, setWatermark] = useState<string | null>(null);
  const [watermarkPosition] = useState({ x: 50, y: 50 });
  const [watermarkSize, setWatermarkSize] = useState(0.2);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>('ultra');
  const [format, setFormat] = useState<'webp' | 'jpeg'>('webp');
  const [processedSizes, setProcessedSizes] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (error) => {
        console.error(`Error cargando imagen: ${src}`, error);
        reject(new Error(`No se pudo cargar la imagen`));
      };
      img.src = src;
    });
  }, []);

  const handleImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageUrls = files.map((file) => URL.createObjectURL(file));
    setImages(imageUrls);
  };

  const handleWatermarkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setWatermark(URL.createObjectURL(file));
    }
  };

  // Función optimizada para comprimir manteniendo alta calidad
  const compressImage = async (blob: Blob, preset: PresetConfig, imageFormat: 'webp' | 'jpeg'): Promise<Blob> => {
    const targetSizeBytes = preset.maxSizeKB * 1024;
    
    if (blob.size <= targetSizeBytes) {
      return blob;
    }

    try {
      const options = {
        maxSizeMB: preset.maxSizeKB / 1024,
        maxWidthOrHeight: preset.maxDimension,
        useWebWorker: true,
        fileType: `image/${imageFormat}` as const,
        initialQuality: preset.quality,
        alwaysKeepResolution: false,
      };

      const file = new File([blob], `temp.${imageFormat}`, { type: `image/${imageFormat}` });
      const compressedBlob = await imageCompression(file, options);
      
      return compressedBlob;
    } catch (error) {
      console.error("Error en compresión:", error);
      return blob;
    }
  };

  const renderPreview = useCallback(async () => {
    if (!images.length || !watermark || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      const image = await loadImage(images[0]);
      const watermarkImage = await loadImage(watermark);

      canvas.width = image.width;
      canvas.height = image.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      const watermarkWidth = watermarkImage.width * watermarkSize;
      const watermarkHeight = watermarkImage.height * watermarkSize;

      ctx.drawImage(
        watermarkImage,
        watermarkPosition.x,
        watermarkPosition.y,
        watermarkWidth,
        watermarkHeight
      );
    } catch (error) {
      console.error("Error renderizando preview:", error);
    }
  }, [images, watermark, watermarkSize, watermarkPosition, loadImage]);

  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  const applyWatermark = async () => {
    if (!canvasRef.current || !images.length || !watermark) return;

    setIsProcessing(true);
    setProgress(0);
    setProcessedSizes([]);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const zip = new JSZip();
    const preset = QUALITY_PRESETS[qualityPreset];
    const sizes: number[] = [];

    try {
      const watermarkImage = await loadImage(watermark);
      
      for (let i = 0; i < images.length; i++) {
        const imageSrc = images[i];
        
        try {
          const image = await loadImage(imageSrc);

          canvas.width = image.width;
          canvas.height = image.height;

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

          const watermarkWidth = watermarkImage.width * watermarkSize;
          const watermarkHeight = watermarkImage.height * watermarkSize;

          ctx.drawImage(
            watermarkImage,
            watermarkPosition.x,
            watermarkPosition.y,
            watermarkWidth,
            watermarkHeight
          );

          const mimeType = `image/${format}`;
          const blob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob((b) => {
              if (b) resolve(b);
              else reject(new Error("No se pudo crear blob"));
            }, mimeType, preset.quality)
          );

          const compressedBlob = await compressImage(blob, preset, format);
          sizes.push(compressedBlob.size);

          const extension = format === 'webp' ? 'webp' : 'jpg';
          zip.file(`image_${i + 1}_watermarked.${extension}`, compressedBlob);

          setProgress(Math.round(((i + 1) / images.length) * 100));
        } catch (imgError) {
          console.error(`Error procesando imagen ${i + 1}:`, imgError);
          alert(`Error procesando imagen ${i + 1}. Continuando con las demás...`);
        }
      }

      setProcessedSizes(sizes);

      const content = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: {
          level: 9
        }
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `imagenes_${preset.label.toLowerCase().replace(/\s+/g, '_')}.zip`;
      link.click();

      URL.revokeObjectURL(link.href);

    } catch (error) {
      console.error("Error aplicando marca de agua:", error);
      alert("Error al procesar las imágenes: " + (error instanceof Error ? error.message : error));
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  useEffect(() => {
    return () => {
      images.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          console.error("Error liberando URL:", e);
        }
      });
      if (watermark) {
        try {
          URL.revokeObjectURL(watermark);
        } catch (e) {
          console.error("Error liberando watermark URL:", e);
        }
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-lg shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Marca de Agua</h1>
        <p className="text-sm text-gray-600 mt-1">
          Añade marca de agua a tus imágenes de productos con calidad profesional
        </p>
      </div>

      {/* Contenido Principal */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        
        {/* Configuración de Calidad */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">⚙️ Configuración de Calidad</h3>
          
          {/* Selector de Preset */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nivel de Calidad
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(Object.keys(QUALITY_PRESETS) as QualityPreset[]).map((key) => {
                const preset = QUALITY_PRESETS[key];
                return (
                  <label
                    key={key}
                    className={`flex items-start p-3 border-2 rounded-lg cursor-pointer transition-all ${
                      qualityPreset === key
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="quality"
                      value={key}
                      checked={qualityPreset === key}
                      onChange={(e) => setQualityPreset(e.target.value as QualityPreset)}
                      className="mt-1 mr-3 text-blue-600"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900">{preset.label}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        Máx. {preset.maxSizeKB}KB • {preset.maxDimension}px
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{preset.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Selector de Formato */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Formato de Salida
            </label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="webp"
                  checked={format === 'webp'}
                  onChange={(e) => setFormat(e.target.value as 'webp' | 'jpeg')}
                  className="mr-2 text-blue-600"
                />
                <span className="text-sm">
                  <strong>WebP</strong> <span className="text-gray-600">(Recomendado - Mejor compresión)</span>
                </span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="jpeg"
                  checked={format === 'jpeg'}
                  onChange={(e) => setFormat(e.target.value as 'webp' | 'jpeg')}
                  className="mr-2 text-blue-600"
                />
                <span className="text-sm">
                  <strong>JPEG</strong> <span className="text-gray-600">(Mayor compatibilidad)</span>
                </span>
              </label>
            </div>
          </div>
        </div>
        
        {/* Sección de carga de archivos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Imágenes a procesar */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Imágenes a procesar
            </label>
            <input
              type="file"
              multiple
              id="file"
              accept="image/*"
              onChange={handleImagesUpload}
              className="hidden"
            />
            <label
              htmlFor="file"
              className="flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <PhotoIcon className="h-6 w-6 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-700">
                Seleccionar imágenes
              </span>
            </label>
            {images.length > 0 && (
              <p className="text-sm text-gray-600">
                {images.length} imagen(es) seleccionada(s)
              </p>
            )}
          </div>

          {/* Marca de agua */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Marca de agua (logo)
            </label>
            <input
              type="file"
              id="marca"
              accept="image/*"
              onChange={handleWatermarkUpload}
              className="hidden"
            />
            <label
              htmlFor="marca"
              className="flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <CloudArrowUpIcon className="h-6 w-6 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-700">
                Seleccionar logo
              </span>
            </label>
            {watermark && (
              <p className="text-sm text-gray-600">Marca de agua cargada</p>
            )}
          </div>
        </div>

        {/* Control de tamaño */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Tamaño de la marca de agua: {Math.round(watermarkSize * 100)}%
          </label>
          <input
            type="range"
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            min="0.05"
            max="0.5"
            step="0.05"
            value={watermarkSize}
            onChange={(e) => setWatermarkSize(parseFloat(e.target.value))}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Pequeña (5%)</span>
            <span>Mediana (27%)</span>
            <span>Grande (50%)</span>
          </div>
        </div>

        {/* Vista previa */}
        {images.length > 0 && watermark && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Vista previa</h3>
            <div className="flex justify-center">
              <canvas
                ref={canvasRef}
                className="border border-gray-300 rounded-lg shadow-sm max-w-full"
                style={{ width: "100%", maxWidth: "400px", height: "auto" }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Vista previa de la primera imagen con marca de agua
            </p>
          </div>
        )}

        {/* Barra de progreso */}
        {isProcessing && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-medium text-blue-700 mb-2">
              Procesando imágenes... {progress}%
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Mostrar tamaños procesados */}
        {processedSizes.length > 0 && (
          <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm font-medium text-green-700 mb-2">
              ✅ Procesamiento completado
            </p>
            <div className="text-xs text-green-600">
              Promedio: {Math.round(processedSizes.reduce((a, b) => a + b, 0) / processedSizes.length / 1024)} KB por imagen
              {' • '}
              Total: {Math.round(processedSizes.reduce((a, b) => a + b, 0) / 1024)} KB
            </div>
          </div>
        )}

        {/* Botón de procesar */}
        <div className="flex flex-col items-center space-y-3">
          <button
            onClick={applyWatermark}
            disabled={!images.length || !watermark || isProcessing}
            className="px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center shadow-sm"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Procesando...
              </>
            ) : (
              <>
                <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                Procesar y Descargar
              </>
            )}
          </button>

          {/* Información técnica */}
          <div className="text-xs text-gray-500 text-center max-w-3xl">
            <p className="font-medium text-gray-700 mb-2">💡 Recomendaciones para E-commerce:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
              <div className="bg-gray-50 p-3 rounded border border-gray-200">
                <p className="font-medium text-gray-700 mb-1">🎯 Ultra Alta (Recomendado)</p>
                <ul className="space-y-1 text-gray-600">
                  <li>• Ideal para imágenes principales de productos</li>
                  <li>• Los clientes pueden ver detalles de tela</li>
                  <li>• Excelente para zoom y vista detallada</li>
                  <li>• Formato {format.toUpperCase()} optimizado</li>
                </ul>
              </div>
              <div className="bg-gray-50 p-3 rounded border border-gray-200">
                <p className="font-medium text-gray-700 mb-1">⚡ Tips de Rendimiento</p>
                <ul className="space-y-1 text-gray-600">
                  <li>• WebP: 30% más ligero que JPEG</li>
                  <li>• Perfecto para tiendas modernas</li>
                  <li>• Compatible con todos los navegadores actuales</li>
                  <li>• Carga rápida sin sacrificar calidad</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MarcaAgua;
