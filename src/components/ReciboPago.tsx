import React, { useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

import { DocumentArrowDownIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { doc as firestoreDoc, getDoc } from 'firebase/firestore';
import { db } from '../credenciales';

interface PagoItem {
  monto: number;
  fecha: string; // Se asume formato "DD/MM/YYYY" o similar string
  metodo: string;
  registradoPor?: string;
  idPago?: string;
}

interface OrdenResumen {
  id: string;
  folio?: string | null;
  cliente: { nombre: string } | string;
  totalVenta: number;
  saldoRestante?: number;
  liquidada?: boolean;
}

interface ReciboPagoProps {
  isOpen: boolean;
  onClose: () => void;
  pago: PagoItem & { folioTransaccion: string };
  ordenesDestino: OrdenResumen[];
}

const ReciboPago: React.FC<ReciboPagoProps> = ({ isOpen, onClose, pago, ordenesDestino }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const getImageDataUrl = async (url: string) => {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  const handleExportPDF = async () => {
    // Preparar datos de cliente y prendas
    const clienteNombre = ordenesDestino.length
      ? (typeof ordenesDestino[0].cliente === 'string' ? ordenesDestino[0].cliente : ordenesDestino[0].cliente?.nombre)
      : '-';

    const itemNames: string[] = [];
    try {
      for (const ord of ordenesDestino) {
          const snap = await getDoc(firestoreDoc(db, 'ordenes', ord.id));
        const data: any = snap.exists() ? snap.data() : null;
        const items: any[] = Array.isArray(data?.items) ? data.items : [];
        items.forEach((it) => {
          if (it?.nombre) itemNames.push(String(it.nombre));
        });
      }
    } catch (_) {}
    const uniqueNames = Array.from(new Set(itemNames));
    const maxToShow = 6;
    const shown = uniqueNames.slice(0, maxToShow);
    const remaining = Math.max(0, uniqueNames.length - shown.length);
    const itemsSummary = shown.length
      ? (remaining > 0 ? `${shown.join(', ')} (+${remaining} más)` : shown.join(', '))
      : 'N/A';

    // 1. Configuración de tamaño "Ticket" o "Tarjeta móvil"
    // Ancho 280pt (~9.8cm) y Alto 400pt (~14cm) para que ajuste al contenido sin sobrar hoja
    const pdfWidth = 280;
    const pdfHeight = 420;
    const pdf = new jsPDF({ unit: 'pt', format: [pdfWidth, pdfHeight] });

    // Colores Nude / Elegantes
    const colorNudeHeader = { r: 244, g: 232, b: 228 }; // Nude rosado suave
    const colorTextoPrincipal = { r: 60, g: 60, b: 60 }; // Gris oscuro elegante (no negro puro)
    const colorTextoSecundario = { r: 120, g: 110, b: 110 }; // Gris cálido

    const centerX = pdfWidth / 2;
    let y = 0;

    // --- ENCABEZADO (Fondo Nude) ---
    // Cubre el 35% superior del recibo
    const headerHeight = 140;
    pdf.setFillColor(colorNudeHeader.r, colorNudeHeader.g, colorNudeHeader.b);
    pdf.rect(0, 0, pdfWidth, headerHeight, 'F');

    // Logo (texto)
    try {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.setTextColor(colorTextoPrincipal.r, colorTextoPrincipal.g, colorTextoPrincipal.b);
      pdf.text('Stela', centerX, 60, { align: 'center' });
    } catch (e) {
      console.error("No se pudo renderizar el texto del logo", e);
    }
    // Texto: ¡Gracias por tu pago!
    // Usamos 'times' e 'italic' para dar ese toque elegante de boutique
    y = 110;
    pdf.setFont('times', 'italic'); 
    pdf.setFontSize(16);
      pdf.setTextColor(colorTextoPrincipal.r, colorTextoPrincipal.g, colorTextoPrincipal.b);
    pdf.text('¡Gracias por tu pago!', centerX, y, { align: 'center' });


    // --- CUERPO DEL RECIBO (Fondo Blanco/Por defecto) ---
    y = headerHeight + 40;

    // Cantidad Pagada (Grande y clara)
    pdf.setFont('helvetica', 'normal'); // Helvetica para los números se ve más limpio
    pdf.setFontSize(10);
    pdf.setTextColor(colorTextoSecundario.r, colorTextoSecundario.g, colorTextoSecundario.b);
    pdf.text('CANTIDAD PAGADA', centerX, y, { align: 'center' });

    y += 25;
    pdf.setFont('times', 'bold'); // Times Bold para el precio le da sofisticación
    pdf.setFontSize(32);
    pdf.setTextColor(colorTextoPrincipal.r, colorTextoPrincipal.g, colorTextoPrincipal.b);
    pdf.text(`$${pago.monto.toFixed(2)}`, centerX, y, { align: 'center' });

    // Línea separadora sutil
    y += 20;
    pdf.setDrawColor(230, 225, 225);
    pdf.setLineWidth(0.5);
    pdf.line(40, y, pdfWidth - 40, y);

    // --- DETALLES ---
    y += 25;
    const lineHeight = 20;

    // Función auxiliar para filas de datos centradas
    const addDetailRow = (label: string, value: string) => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(colorTextoSecundario.r, colorTextoSecundario.g, colorTextoSecundario.b);
        pdf.text(label, centerX, y, { align: 'center' });
        
        y += 12;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(colorTextoPrincipal.r, colorTextoPrincipal.g, colorTextoPrincipal.b);
        pdf.text(value, centerX, y, { align: 'center' });
        
        y += lineHeight; 
    };

    // Folio
    addDetailRow('FOLIO DE AUTORIZACIÓN', pago.folioTransaccion || 'N/A');

    // Tarjeta / Método
    // Intentamos extraer últimos 4 dígitos si vienen en el método, si no, mostramos el método tal cual
    addDetailRow('MÉTODO DE PAGO', pago.metodo);

    // Fecha
    addDetailRow('FECHA', pago.fecha);

    // Cliente
    addDetailRow('CLIENTE', clienteNombre || '-');

    // Prendas
    addDetailRow('PRENDAS', itemsSummary);

    // --- PIE DE PÁGINA ---
    y = pdfHeight - 20;
    pdf.setFont('times', 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text('Comprobante electrónico de pago', centerX, y, { align: 'center' });

    pdf.save(`Recibo_${pago.folioTransaccion}.pdf`);
  };

  const handleExportImage = async () => {
    if (!contentRef.current || isExporting) return;

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
      } catch (e) {
        return null;
      }
    };

    // Fallback usando iframe con CSS inline
    const exportImageUsingIframe = async () => {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.top = '0';
      iframe.style.width = '280px'; // Mismo ancho que el PDF
      iframe.style.height = '420px'; // Misma altura que el PDF
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error('No se pudo crear documento en iframe');

      // Usar texto en lugar de imagen para el logo en la versión HTML del recibo
      const logoSrc = null;

      // Colores Nude / Elegantes (iguales al PDF)
      const colorNudeHeader = 'rgb(244, 232, 228)'; // Nude rosado suave
      const colorTextoPrincipal = 'rgb(60, 60, 60)'; // Gris oscuro elegante
      const colorTextoSecundario = 'rgb(120, 110, 110)'; // Gris cálido
      const colorLinea = 'rgb(230, 225, 225)';

      // Preparar datos de cliente y prendas (mismos que en PDF)
      const clienteNombre = ordenesDestino.length
        ? (typeof ordenesDestino[0].cliente === 'string' ? ordenesDestino[0].cliente : ordenesDestino[0].cliente?.nombre)
        : '-';

      const itemNames: string[] = [];
      try {
        for (const ord of ordenesDestino) {
          const snap = await getDoc(firestoreDoc(db, 'ordenes', ord.id));
          const data: any = snap.exists() ? snap.data() : null;
          const items: any[] = Array.isArray(data?.items) ? data.items : [];
          items.forEach((it) => {
            if (it?.nombre) itemNames.push(String(it.nombre));
          });
        }
      } catch (_) {}
      const uniqueNames = Array.from(new Set(itemNames));
      const maxToShow = 6;
      const shown = uniqueNames.slice(0, maxToShow);
      const remaining = Math.max(0, uniqueNames.length - shown.length);
      const itemsSummary = shown.length
        ? (remaining > 0 ? `${shown.join(', ')} (+${remaining} más)` : shown.join(', '))
        : 'N/A';

      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Recibo</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Times New Roman', Times, serif;
            margin: 0; 
            padding: 0; 
            background: #ffffff;
            width: 280px;
            height: 420px;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
            -webkit-text-size-adjust: 100%;
          }
          .container {
            width: 280px;
            height: 420px;
            background: #ffffff;
            position: relative;
          }
          .header {
            width: 100%;
            height: 140px;
            background: ${colorNudeHeader};
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
          }
          .logo {
            width: 45px;
            height: 45px;
            object-fit: contain;
            margin-bottom: 15px;
          }
          .gracias {
            font-family: 'Times New Roman', Times, serif;
            font-style: italic;
            font-size: 16px;
            color: ${colorTextoPrincipal};
            text-align: center;
            line-height: 1.3;
            letter-spacing: 0.2px;
            word-spacing: 0.2px;
            font-kerning: normal;
            font-variant-ligatures: none;
          }
          .body {
            padding: 30px 20px 48px 20px; /* Más espacio inferior para no chocar con el pie */
            text-align: center;
          }
          .label {
            font-family: Helvetica, Arial, sans-serif;
            font-size: 10px;
            color: ${colorTextoSecundario};
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 10px;
          }
          .monto {
            font-family: 'Times New Roman', Times, serif;
            font-weight: bold;
            font-size: 32px;
            color: ${colorTextoPrincipal};
            margin-bottom: 20px;
          }
          .divider {
            width: calc(100% - 40px);
            height: 1px;
            background: ${colorLinea};
            margin: 0 auto 25px auto;
          }
          .detalle-row {
            margin-bottom: 20px;
          }
          .detalle-label {
            font-family: Helvetica, Arial, sans-serif;
            font-size: 9px;
            color: ${colorTextoSecundario};
            text-transform: uppercase;
            margin-bottom: 5px;
          }
          .detalle-value {
            font-family: Helvetica, Arial, sans-serif;
            font-weight: bold;
            font-size: 10px;
            color: ${colorTextoPrincipal};
            word-break: break-word;
            white-space: normal;
          }
          .footer {
            position: absolute;
            bottom: 10px; /* Bajar un poco más el pie */
            width: 100%;
            text-align: center;
          }
          .footer-text {
            font-family: 'Times New Roman', Times, serif;
            font-style: italic;
            font-size: 8px;
            color: rgb(150, 150, 150);
            line-height: 1.3;
            letter-spacing: 0.2px;
            word-spacing: 0.2px;
            font-kerning: normal;
            font-variant-ligatures: none;
            white-space: nowrap;
          }
        </style>
      </head><body>
        <div class="container">
          <!-- Encabezado con fondo nude -->
          <div class="header">
            <div class="logo" style="display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:rgb(60,60,60);font-family:Quicksand, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">Stela</div>
            <div class="gracias">¡Gracias por tu pago!</div>
          </div>
          
          <!-- Cuerpo del recibo -->
          <div class="body">
            <!-- Cantidad pagada -->
            <div class="label">CANTIDAD PAGADA</div>
            <div class="monto">$${pago.monto.toFixed(2)}</div>
            
            <!-- Línea separadora -->
            <div class="divider"></div>
            
            <!-- Folio -->
            <div class="detalle-row">
              <div class="detalle-label">FOLIO DE AUTORIZACIÓN</div>
              <div class="detalle-value">${pago.folioTransaccion || 'N/A'}</div>
            </div>
            
            <!-- Método -->
            <div class="detalle-row">
              <div class="detalle-label">MÉTODO DE PAGO</div>
              <div class="detalle-value">${pago.metodo}</div>
            </div>
            
            <!-- Fecha -->
            <div class="detalle-row">
              <div class="detalle-label">FECHA</div>
              <div class="detalle-value">${pago.fecha}</div>
            </div>

            <!-- Cliente -->
            <div class="detalle-row">
              <div class="detalle-label">CLIENTE</div>
              <div class="detalle-value">${clienteNombre || '-'}</div>
            </div>

            <!-- Prendas -->
            <div class="detalle-row">
              <div class="detalle-label">PRENDAS</div>
              <div class="detalle-value">${itemsSummary}</div>
            </div>
          </div>
          
          <!-- Pie de página -->
          <div class="footer">
            <div class="footer-text">Comprobante electrónico de pago</div>
          </div>
        </div>
      </body></html>`;

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      await new Promise<void>((resolve) => {
        const imgs = Array.from(iframeDoc.getElementsByTagName('img')) as HTMLImageElement[];
        if (imgs.length === 0) return resolve();
        let loaded = 0;
        const finish = () => {
          loaded++;
          if (loaded >= imgs.length) resolve();
        };
        imgs.forEach(img => {
          if (img.complete) return finish();
          img.addEventListener('load', finish);
          img.addEventListener('error', finish);
        });
      });

      // Esperar a que las fuentes terminen de cargar para evitar reflow/encimado
      try {
        if ((iframeDoc as any).fonts && (iframeDoc as any).fonts.ready) {
          await (iframeDoc as any).fonts.ready;
        }
      } catch {}
      // Pequeño delay para asegurar layout final estable
      await new Promise(r => setTimeout(r, 100));

      const canvas = await html2canvas(iframeDoc.body as HTMLElement, { 
        scale: 3, 
        useCORS: true, 
        allowTaint: false, 
        backgroundColor: '#ffffff', 
        imageTimeout: 15000 
      });

      setTimeout(() => { try { document.body.removeChild(iframe); } catch (e) {} }, 500);

      return canvas;
    };

    try {
      setIsExporting(true);

      let canvas: HTMLCanvasElement;

      try {
        await new Promise(resolve => setTimeout(resolve, 300));

        const input = contentRef.current.closest('.bg-white.rounded-xl') as HTMLElement || contentRef.current;

        // Normalizar colores CSS
        const elems = Array.from(input.querySelectorAll<HTMLElement>('*'));
        const resolvedStyleMap = new Map<string, string>();
        const colorCanvas = document.createElement('canvas');
        const colorCtx = colorCanvas.getContext('2d');

        const normalizeColor = (c: string) => {
          if (!colorCtx) return c;
          try {
            colorCtx.fillStyle = c;
            return colorCtx.fillStyle as string;
          } catch (e) {
            return c;
          }
        };

        const normalizeComplexString = (str: string) => {
          if (!str) return str;
          const funcRegex = /(oklch\([^)]*\))/gi;
          return str.replace(funcRegex, (m) => {
            try {
              return normalizeColor(m) || m;
            } catch (e) {
              return m;
            }
          });
        };

        elems.forEach((el, idx) => {
          const id = `export-recibo-${idx}`;
          el.setAttribute('data-export-recibo-id', id);
          const cs = window.getComputedStyle(el);
          let cssText = '';
          for (let i = 0; i < cs.length; i++) {
            const prop = cs[i];
            let val = cs.getPropertyValue(prop);
            if (!val) continue;
            if (/color|background|border|outline|box-shadow/i.test(prop)) {
              val = normalizeComplexString(val);
            }
            cssText += `${prop}:${val};`;
          }
          resolvedStyleMap.set(id, cssText);
        });

        // Esperar a que las imágenes terminen de cargar
        const imgsToWait = Array.from(input.querySelectorAll('img')) as HTMLImageElement[];
        await Promise.all(imgsToWait.map(async (img) => {
          try {
            if (!img.complete) {
              await new Promise<void>((resolve) => {
                const onFinish = () => { 
                  img.removeEventListener('load', onFinish); 
                  img.removeEventListener('error', onFinish); 
                  resolve(); 
                };
                img.addEventListener('load', onFinish);
                img.addEventListener('error', onFinish);
              });
            }
            if ((img as any).decode) {
              await (img as any).decode().catch(() => {});
            }
          } catch (_) {}
        }));

        // Renderizar canvas con alta calidad
        canvas = await html2canvas(input, {
          scale: 3,
          useCORS: true,
          allowTaint: false,
          logging: false,
          backgroundColor: '#ffffff',
          imageTimeout: 15000,
          onclone: async (documentClone) => {
            const cloneElems = Array.from(documentClone.querySelectorAll('[data-export-recibo-id]')) as HTMLElement[];
            cloneElems.forEach((cloneEl) => {
              const id = cloneEl.getAttribute('data-export-recibo-id') || '';
              const cssText = resolvedStyleMap.get(id) || '';
              if (cssText) {
                try {
                  (cloneEl.style as any).cssText += cssText;
                } catch (e) {}
              }
            });

            // Convertir imágenes a data URLs
            const imgs = Array.from(documentClone.querySelectorAll('img')) as HTMLImageElement[];
            await Promise.all(imgs.map(async (img) => {
              try {
                const src = img.getAttribute('src') || '';
                if (!src || src.startsWith('data:')) return;
                img.setAttribute('crossorigin', 'anonymous');
                const data = await toDataURL(src);
                if (data) {
                  img.src = data;
                }

                await new Promise<void>((resolve) => {
                  if (img.complete) return resolve();
                  const onFinish = () => {
                    img.removeEventListener('load', onFinish);
                    img.removeEventListener('error', onFinish);
                    resolve();
                  };
                  img.addEventListener('load', onFinish);
                  img.addEventListener('error', onFinish);
                });
              } catch (e) {}
            }));
          }
        });

        // Limpieza
        elems.forEach(el => el.removeAttribute('data-export-recibo-id'));

      } catch (error: any) {
        // Si falla por problemas de color oklch, usar fallback
        console.warn('Error en método principal, usando fallback iframe:', error);
        const msg = (error && error.message) ? error.message.toLowerCase() : '';
        if (msg.includes('oklch') || msg.includes('unsupported color') || msg.includes('color function')) {
          canvas = await exportImageUsingIframe();
        } else {
          throw error;
        }
      }

      // Convertir canvas a imagen PNG
      canvas.toBlob((blob) => {
        if (!blob) {
          alert('Error al generar la imagen.');
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const filename = `Recibo_${pago.folioTransaccion}.png`;
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(url), 100);
      }, 'image/png', 1.0);

    } catch (error: any) {
      console.error('Error exportando imagen:', error);
      alert(`Error al generar la imagen: ${error?.message || error}. Por favor, intenta nuevamente.`);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  // Cálculos para la vista en pantalla (Modal)
  const totalOrdenes = ordenesDestino.reduce((acc, o) => acc + (o.totalVenta || 0), 0);
  const clienteNombre = ordenesDestino.length
    ? (typeof ordenesDestino[0].cliente === 'string' ? ordenesDestino[0].cliente : ordenesDestino[0].cliente?.nombre)
    : '-';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
        
        {/* Header Modal */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Recibo de Pago</h3>
            <p className="text-xs text-gray-500 font-mono mt-1">Ref: {pago.folioTransaccion}</p>
          </div>
          <div className="text-sm font-quicksand font-semibold text-gray-700">Stela</div>
          {/* Main Stats Grid */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Cliente</p>
              <p className="font-semibold text-gray-800">{clienteNombre}</p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Monto Recibido</p>
              <p className="text-2xl font-bold text-gray-900">${pago.monto.toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Método</p>
              <p className="font-medium text-gray-700 bg-gray-100 inline-block px-2 py-0.5 rounded text-sm">{pago.metodo}</p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Fecha</p>
              <p className="font-medium text-gray-700">{pago.fecha}</p>
            </div>
          </div>

          {/* Associated Orders (Visible only on screen, not PDF) */}
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase mb-3">Detalle de aplicación</p>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
              {ordenesDestino.map((o) => (
                <div key={o.id} className="p-3 border border-gray-100 rounded-lg bg-gray-50 hover:bg-white transition-colors flex justify-between items-center group">
                  <div>
                     <div className="text-xs text-gray-500 mb-0.5">Folio: {o.folio || 'S/N'}</div>
                     <div className="text-xs text-gray-400 font-mono">ID: {o.id.slice(0, 8)}...</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-700">${o.totalVenta.toFixed(2)}</div>
                    {typeof o.saldoRestante === 'number' && (
                        <div className="text-xs text-gray-500">
                          Resta: <span className={o.liquidada ? "text-green-600 font-medium" : "text-gray-700"}>${o.saldoRestante.toFixed(2)}</span>
                        </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
                <span className="text-xs font-medium text-gray-400 mr-2">Total aplicado:</span>
                <span className="text-sm font-bold text-gray-800">${totalOrdenes.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/30">
          <button 
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
            onClick={onClose}
            disabled={isExporting}
          >
            Cerrar
          </button>
          <button 
            className="px-4 py-2 text-sm font-medium bg-green-600 text-white hover:bg-green-700 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" 
            onClick={handleExportImage}
            disabled={isExporting}
          >
            <PhotoIcon className="w-4 h-4" />
            {isExporting ? 'Generando...' : 'Exportar Imagen'}
          </button>
          <button 
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" 
            onClick={handleExportPDF}
            disabled={isExporting}
          >
            <DocumentArrowDownIcon className="w-4 h-4" />
            {isExporting ? 'Generando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReciboPago;