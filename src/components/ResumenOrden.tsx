/**
 * Componente ResumenOrden
 * 
 * Componente reutilizable que muestra un resumen detallado de una orden con opción de exportar a PDF.
 * 
 * Uso:
 * ```tsx
 * import ResumenOrden from './components/ResumenOrden';
 * 
 * // En tu componente:
 * const [modalOpen, setModalOpen] = useState(false);
 * const [selectedOrden, setSelectedOrden] = useState<Orden | null>(null);
 * 
 * const handleAbrirResumen = (orden: Orden) => {
 *   setSelectedOrden(orden);
 *   setModalOpen(true);
 * };
 * 
 * return (
 *   <>
 *     <button onClick={() => handleAbrirResumen(miOrden)}>Ver Resumen</button>
 *     <ResumenOrden
 *       isOpen={modalOpen}
 *       orden={selectedOrden}
 *       onClose={() => setModalOpen(false)}
 *       esEntregaPersonal={(lugar) => ZONAS_PERSONALES.includes(lugar?.toLowerCase() || '')}
 *     />
 *   </>
 * );
 * ```
 */

import React, { useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { DocumentArrowDownIcon, PhotoIcon } from '@heroicons/react/24/outline';
import ReciboPago from './ReciboPago';
import { useUserProfile } from '../hooks/useUserProfile';

interface Orden {
  id: string;
  cliente: { nombre: string; uid?: string } | string;
  totalVenta: number;
  estadoPedido: string;
  fechaCreacion?: string;
  fechaEntrega?: string | null;
  fechaEnvio?: string | null;
  entrega: string;
  lugar?: string;
  items: any[];
  timestamp?: any;
  descuentoPorcentaje?: number;
  descuentoMonto?: number;
  pagos?: Array<{ monto: number; fecha: string; metodo: string; registradoPor?: string }>;
  totalPagado?: number;
  saldoPendiente?: number;
}

interface ResumenOrdenProps {
  isOpen: boolean;
  orden: Orden | null;
  onClose: () => void;
  esEntregaPersonal: (lugar?: string) => boolean;
}

const ResumenOrden: React.FC<ResumenOrdenProps> = ({ isOpen, orden, onClose, esEntregaPersonal }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [reciboSeleccionado, setReciboSeleccionado] = useState<{ pago: any; ordenesDestino: any[] } | null>(null);
  const { storeName } = useUserProfile();

  // En ResumenOrden.tsx

  const handleExportPDF = async () => {
    if (!orden || !contentRef.current || isExporting) return;

    // Helper: convierte una URL de imagen a data URL (base64)
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

    // Fallback robusto: renderizar contenido en un iframe con CSS inline (sin Tailwind)
    const exportUsingIframe = async () => {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.top = '0';
      iframe.style.width = '800px';
      iframe.style.height = '1100px';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) throw new Error('No se pudo crear documento en iframe');

      const clienteNombre = typeof orden.cliente === 'string' ? orden.cliente : orden.cliente?.nombre;

      // Agrupar items por nombre de prenda
      const itemsAgrupadosMap = new Map<string, any>();
      (orden.items || []).forEach((item: any) => {
        const key = item.nombre || 'Sin nombre';
        if (itemsAgrupadosMap.has(key)) {
          const existing = itemsAgrupadosMap.get(key);
          existing.cantidad += 1;
          existing.variantes.push({ talla: item.talla, color: item.color, precio: item.precio });
          existing.subtotalTotal += (item.precio || 0);
        } else {
          itemsAgrupadosMap.set(key, {
            ...item,
            cantidad: 1,
            variantes: [{ talla: item.talla, color: item.color, precio: item.precio }],
            subtotalTotal: (item.precio || 0)
          });
        }
      });
      const itemsAgrupadosArray = Array.from(itemsAgrupadosMap.values());

      const itemsHtmlParts: string[] = [];
      for (const item of itemsAgrupadosArray) {
        let src = item.foto || '';
        if (src && !src.startsWith('data:')) {
          const data = await toDataURL(src);
          if (data) src = data;
        }
        const variantesHtml = item.variantes.map((v: any) => 
          `<li>Talla: ${v.talla || '-'}, Color: ${v.color || '-'} — $${(v.precio || 0).toFixed(2)}</li>`
        ).join('');
        itemsHtmlParts.push(`
          <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:12px;display:flex;gap:12px;">
            <div style="flex:0 0 80px;height:80px;overflow:hidden;border-radius:6px;background:#f3f4f6;">
              <img crossorigin="anonymous" src="${src}" alt="${item.nombre || ''}" style="width:100%;height:100%;object-fit:cover;display:block;"/>
            </div>
            <div style="flex:1;">
              <div style="font-weight:600;color:#111827;margin-bottom:6px;">${item.nombre || ''}</div>
              <div style="font-size:13px;color:#374151;margin-bottom:6px;font-weight:500;">Variantes:</div>
              <ul style="font-size:12px;color:#374151;margin:0 0 6px 0;padding-left:20px;">${variantesHtml}</ul>
              <div style="font-size:13px;color:#111827;">Cantidad total: ${item.cantidad}</div>
              <div style="font-size:14px;color:#111827;font-weight:600;margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;">Subtotal: $${item.subtotalTotal.toFixed(2)}</div>
            </div>
          </div>
        `);
      }

      const subtotalCalc = (orden.totalVenta || 0) + (orden.descuentoMonto || 0);
      const descuentoMonto = orden.descuentoMonto || 0;
      const totalFinal = orden.totalVenta || 0;
      const totalPagadoCalc = (orden.totalPagado ?? (orden.pagos || []).reduce((a, p) => a + (p.monto || 0), 0));
      const saldoRestanteCalc = (orden.saldoPendiente ?? Math.max(orden.totalVenta - totalPagadoCalc, 0));

      const pagosHtml = (orden.pagos && orden.pagos.length > 0) ? `
        <div style="margin-top:16px;padding:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
          <div style="font-weight:600;margin-bottom:8px;color:#111827;font-size:14px;">Pagos</div>
          ${orden.pagos.map(p => `
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e5e7eb;font-size:13px;">
              <div style="color:#374151;">${p.fecha} · ${p.metodo}</div>
              <div style="font-weight:600;color:#111827;">$${p.monto.toFixed(2)}</div>
            </div>
          `).join('')}
        </div>
      ` : '';

      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resumen</title>
        <style>
          body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;padding:20px;color:#111827;background:#ffffff}
          .container{max-width:760px;margin:0 auto}
        </style>
      </head><body>
        <div class="container">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <div style="font-size:22px;font-weight:700;color:#111827;letter-spacing:0.5px;">${storeName}</div>
            <div>
              <h1 style="font-size:20px;margin:0;color:#111827;">Resumen de Orden</h1>
              <p style="color:#6b7280;margin:2px 0 0 0;">Cliente: ${clienteNombre || '-'}</p>
            </div>
          </div>
          ${itemsHtmlParts.join('\n')}
          <div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:8px;color:#111827;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#6b7280;">Subtotal:</span><span style="font-weight:600;">$${subtotalCalc.toFixed(2)}</span></div>
            ${descuentoMonto > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px;color:#2563eb;"><span>Descuento (${orden.descuentoPorcentaje || 0}%):</span><span>-$${descuentoMonto.toFixed(2)}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;border-top:1px solid #e5e7eb;padding-top:8px;margin-bottom:6px;font-weight:700;font-size:16px;"><span>Total Final:</span><span>$${totalFinal.toFixed(2)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:13px;"><span style="color:#6b7280;">Total pagado:</span><span style="font-weight:600;">$${totalPagadoCalc.toFixed(2)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:14px;margin-top:4px;"><span style="font-weight:600;color:#111827;">Saldo restante:</span><span style="font-weight:700;color:#dc2626;">$${saldoRestanteCalc.toFixed(2)}</span></div>
          </div>

          ${pagosHtml}

          <div style="margin-top:12px;padding:12px;border:1px solid #dbeafe;background:#f0f9ff;border-radius:8px;">
            <div style="font-weight:600;margin-bottom:6px;color:#0f172a;">Información de Entrega</div>
            <div style="font-size:13px;color:#0f172a;">Zona: ${orden.lugar || '-'}</div>
            <div style="font-size:13px;color:#0f172a;">Tipo: ${esEntregaPersonal(orden.lugar) ? 'Entrega Personal' : 'Paquetería'}</div>
            ${orden.fechaEnvio ? `<div style="font-size:13px;color:#0f172a;">Fecha de Envío: ${orden.fechaEnvio}</div>` : ''}
            ${orden.fechaEntrega ? `<div style="font-size:13px;color:#0f172a;">Fecha de Entrega: ${orden.fechaEntrega}</div>` : ''}
          </div>
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
        imgs.forEach(img => {
          if (img.complete) return finish();
          img.addEventListener('load', finish);
          img.addEventListener('error', finish);
        });
      });

      const canvas = await html2canvas(doc.body as HTMLElement, { scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff', imageTimeout: 15000 });
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF('p', 'mm', 'a4');
      let heightLeft = imgHeight;
      let position = 0;
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      const filename = `Resumen_${clienteNombre || 'cliente'}_${(orden.id || '').slice(0,8)}.pdf`;
      pdf.save(filename);

      setTimeout(() => { try { document.body.removeChild(iframe); } catch (e) {} }, 500);
    };

    try {
      setIsExporting(true);
      const clienteNombre = typeof orden.cliente === 'string' ? orden.cliente : orden.cliente?.nombre;
      
      // Esperar un poco más para asegurar renderizado de imágenes
      await new Promise(resolve => setTimeout(resolve, 500));

      const input = contentRef.current;

      const PLACEHOLDER_IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAn8B9p3C9QAAAABJRU5ErkJggg==';

      // Recolectar estilos resueltos para evitar funciones de color no soportadas (ej. oklch)
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
        // Replace occurrences of color functions like oklch(...) with normalized color
        const funcRegex = /(oklch\([^)]*\))/gi;
        let res = str.replace(funcRegex, (m) => {
          try {
            const n = normalizeColor(m);
            return n || m;
          } catch (e) {
            return m;
          }
        });
        return res;
      };

      elems.forEach((el, idx) => {
        const id = `export-${idx}`;
        el.setAttribute('data-export-id', id);
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

      // Esperar a que las imágenes dentro del contenido terminen de cargar y decodificarse
      try {
        const imgsToWait = Array.from(input.querySelectorAll('img')) as HTMLImageElement[];
        await Promise.all(imgsToWait.map(async (img) => {
          try {
            if (!img.complete) {
              await new Promise<void>((resolve) => {
                const onFinish = () => { img.removeEventListener('load', onFinish); img.removeEventListener('error', onFinish); resolve(); };
                img.addEventListener('load', onFinish);
                img.addEventListener('error', onFinish);
              });
            }
            if ((img as any).decode) {
              await (img as any).decode().catch(() => {});
            }
          } catch (_) {}
        }));
      } catch (_) {}

      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 15000,
        scrollY: -window.scrollY,
        windowWidth: document.documentElement.offsetWidth,
        windowHeight: document.documentElement.offsetHeight,
        onclone: async (documentClone) => {
          const element = documentClone.querySelector('.p-6.space-y-6') as HTMLElement;
          if (element) {
            element.style.overflow = 'visible';
            element.style.height = 'auto';
          }

          // Aplicar estilos resueltos al clon para evitar funciones CSS no soportadas
          const cloneElems = Array.from(documentClone.querySelectorAll('[data-export-id]')) as HTMLElement[];
          cloneElems.forEach((cloneEl) => {
            const id = cloneEl.getAttribute('data-export-id') || '';
            const cssText = resolvedStyleMap.get(id) || '';
            if (cssText) {
              try {
                // Append computed cssText; use cssText para cubrir todas las propiedades
                (cloneEl.style as any).cssText += cssText;
              } catch (e) {
                // ignorar si falla
              }
            }
          });

          // Inline images: intenta convertir imágenes externas a data URLs para evitar problemas de CORS
          const imgs = Array.from(documentClone.querySelectorAll('img')) as HTMLImageElement[];
          await Promise.all(imgs.map(async (img) => {
            try {
              const src = img.getAttribute('src') || '';
              if (!src || src.startsWith('data:')) return;
              img.setAttribute('crossorigin', 'anonymous');
              const data = await toDataURL(src);
              if (data) {
                img.src = data;
              } else {
                // Si no pudimos convertir a data URL, restaurar la src original
                const original = src;
                if (original) img.src = original;
              }

              // Esperar a que la imagen del clon termine de cargar (o falle) antes de renderizar
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
            } catch (e) {
              try { img.src = PLACEHOLDER_IMG; } catch (_) {}
            }
          }));
        }
      });

      // Limpieza: eliminar atributos temporales que añadimos
      elems.forEach(el => el.removeAttribute('data-export-id'));

      // Obtener dimensiones
      const imgWidth = 210; // A4 width en mm
      const pageHeight = 297; // A4 height en mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      let heightLeft = imgHeight;
      let position = 0;

      const imgData = canvas.toDataURL('image/jpeg', 0.95); // Usar JPEG con calidad 0.95 reduce el peso

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight); // Ajustado para que encaje mejor
      heightLeft -= pageHeight;

      // Lógica para múltiples páginas (si es muy largo)
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const filename = `Resumen_${clienteNombre}_${orden.id.slice(0, 8)}.pdf`;
      pdf.save(filename);

    } catch (error: any) {
      console.error('Error exportando PDF:', error);
      const msg = (error && error.message) ? error.message.toLowerCase() : '';
      if (msg.includes('oklch') || msg.includes('unsupported color') || msg.includes('color function')) {
        try {
          await exportUsingIframe();
          return;
        } catch (errIframe) {
          console.error('Fallback iframe también falló:', errIframe);
          alert(`Error al generar el PDF incluso en fallback: ${(errIframe as any)?.message || errIframe}`);
          return;
        }
      }
      alert(`Error al generar el PDF: ${error?.message || error}. Verifica que las imágenes carguen correctamente.`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportImage = async () => {
    if (!orden || !contentRef.current || isExporting) return;

    // Helper: convierte una URL de imagen a data URL (base64)
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

    // Fallback usando iframe con CSS inline (sin Tailwind)
    const exportImageUsingIframe = async () => {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.top = '0';
      iframe.style.width = '800px';
      iframe.style.height = '1100px';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) throw new Error('No se pudo crear documento en iframe');

      const clienteNombre = typeof orden.cliente === 'string' ? orden.cliente : orden.cliente?.nombre;

      // Agrupar items por nombre de prenda
      const itemsAgrupadosMap = new Map<string, any>();
      (orden.items || []).forEach((item: any) => {
        const key = item.nombre || 'Sin nombre';
        if (itemsAgrupadosMap.has(key)) {
          const existing = itemsAgrupadosMap.get(key);
          existing.cantidad += 1;
          existing.variantes.push({ talla: item.talla, color: item.color, precio: item.precio });
          existing.subtotalTotal += (item.precio || 0);
        } else {
          itemsAgrupadosMap.set(key, {
            ...item,
            cantidad: 1,
            variantes: [{ talla: item.talla, color: item.color, precio: item.precio }],
            subtotalTotal: (item.precio || 0)
          });
        }
      });
      const itemsAgrupadosArray = Array.from(itemsAgrupadosMap.values());

      const itemsHtmlParts: string[] = [];
      for (const item of itemsAgrupadosArray) {
        let src = item.foto || '';
        if (src && !src.startsWith('data:')) {
          const data = await toDataURL(src);
          if (data) src = data;
        }
        const variantesHtml = item.variantes.map((v: any) => 
          `<li>Talla: ${v.talla || '-'}, Color: ${v.color || '-'} — $${(v.precio || 0).toFixed(2)}</li>`
        ).join('');
        itemsHtmlParts.push(`
          <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:12px;display:flex;gap:12px;">
            <div style="flex:0 0 80px;height:80px;overflow:hidden;border-radius:6px;background:#f3f4f6;">
              <img crossorigin="anonymous" src="${src}" alt="${item.nombre || ''}" style="width:100%;height:100%;object-fit:cover;display:block;"/>
            </div>
            <div style="flex:1;">
              <div style="font-weight:600;color:#111827;margin-bottom:6px;">${item.nombre || ''}</div>
              <div style="font-size:13px;color:#374151;margin-bottom:6px;font-weight:500;">Variantes:</div>
              <ul style="font-size:12px;color:#374151;margin:0 0 6px 0;padding-left:20px;">${variantesHtml}</ul>
              <div style="font-size:13px;color:#111827;">Cantidad total: ${item.cantidad}</div>
              <div style="font-size:14px;color:#111827;font-weight:600;margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;">Subtotal: $${item.subtotalTotal.toFixed(2)}</div>
            </div>
          </div>
        `);
      }

      const subtotalCalc = (orden.totalVenta || 0) + (orden.descuentoMonto || 0);
      const descuentoMonto = orden.descuentoMonto || 0;
      const totalFinal = orden.totalVenta || 0;
      const totalPagadoCalc = (orden.totalPagado ?? (orden.pagos || []).reduce((a, p) => a + (p.monto || 0), 0));
      const saldoRestanteCalc = (orden.saldoPendiente ?? Math.max(orden.totalVenta - totalPagadoCalc, 0));

      const pagosHtml = (orden.pagos && orden.pagos.length > 0) ? `
        <div style="margin-top:16px;padding:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
          <div style="font-weight:600;margin-bottom:8px;color:#111827;font-size:14px;">Pagos</div>
          ${orden.pagos.map(p => `
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e5e7eb;font-size:13px;">
              <div style="color:#374151;">${p.fecha} · ${p.metodo}</div>
              <div style="font-weight:600;color:#111827;">$${p.monto.toFixed(2)}</div>
            </div>
          `).join('')}
        </div>
      ` : '';

      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resumen</title>
        <style>
          body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;padding:20px;color:#111827;background:#ffffff}
          .container{max-width:760px;margin:0 auto}
        </style>
      </head><body>
        <div class="container">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <div style="font-size:22px;font-weight:700;color:#111827;letter-spacing:0.5px;">${storeName}</div>
            <div>
              <h1 style="font-size:20px;margin:0;color:#111827;">Resumen de Orden</h1>
              <p style="color:#6b7280;margin:2px 0 0 0;">Cliente: ${clienteNombre || '-'}</p>
            </div>
          </div>
          ${itemsHtmlParts.join('\n')}
          <div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:8px;color:#111827;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#6b7280;">Subtotal:</span><span style="font-weight:600;">$${subtotalCalc.toFixed(2)}</span></div>
            ${descuentoMonto > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px;color:#2563eb;"><span>Descuento (${orden.descuentoPorcentaje || 0}%):</span><span>-$${descuentoMonto.toFixed(2)}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;border-top:1px solid #e5e7eb;padding-top:8px;margin-bottom:6px;font-weight:700;font-size:16px;"><span>Total Final:</span><span>$${totalFinal.toFixed(2)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:13px;"><span style="color:#6b7280;">Total pagado:</span><span style="font-weight:600;">$${totalPagadoCalc.toFixed(2)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:14px;margin-top:4px;"><span style="font-weight:600;color:#111827;">Saldo restante:</span><span style="font-weight:700;color:#dc2626;">$${saldoRestanteCalc.toFixed(2)}</span></div>
          </div>

          ${pagosHtml}

          <div style="margin-top:12px;padding:12px;border:1px solid #dbeafe;background:#f0f9ff;border-radius:8px;">
            <div style="font-weight:600;margin-bottom:6px;color:#0f172a;">Información de Entrega</div>
            <div style="font-size:13px;color:#0f172a;">Zona: ${orden.lugar || '-'}</div>
            <div style="font-size:13px;color:#0f172a;">Tipo: ${esEntregaPersonal(orden.lugar) ? 'Entrega Personal' : 'Paquetería'}</div>
            ${orden.fechaEnvio ? `<div style="font-size:13px;color:#0f172a;">Fecha de Envío: ${orden.fechaEnvio}</div>` : ''}
            ${orden.fechaEntrega ? `<div style="font-size:13px;color:#0f172a;">Fecha de Entrega: ${orden.fechaEntrega}</div>` : ''}
          </div>
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
        imgs.forEach(img => {
          if (img.complete) return finish();
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

      setTimeout(() => { try { document.body.removeChild(iframe); } catch (e) {} }, 500);

      return canvas;
    };

    try {
      setIsExporting(true);
      const clienteNombre = typeof orden.cliente === 'string' ? orden.cliente : orden.cliente?.nombre;
      
      let canvas: HTMLCanvasElement;

      try {
        // Esperar un poco para asegurar renderizado de imágenes
        await new Promise(resolve => setTimeout(resolve, 500));

        const input = contentRef.current;
        const PLACEHOLDER_IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAn8B9p3C9QAAAABJRU5ErkJggg==';

        // Recolectar estilos resueltos para evitar funciones de color no soportadas
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
          let res = str.replace(funcRegex, (m) => {
            try {
              const n = normalizeColor(m);
              return n || m;
            } catch (e) {
              return m;
            }
          });
          return res;
        };

        elems.forEach((el, idx) => {
          const id = `export-img-${idx}`;
          el.setAttribute('data-export-img-id', id);
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
        try {
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
        } catch (_) {}

        // Renderizar canvas con alta calidad (scale 3 para mejor calidad para WhatsApp)
        canvas = await html2canvas(input, {
          scale: 3, // Mayor calidad para imagen
          useCORS: true,
          allowTaint: false,
          logging: false,
          backgroundColor: '#ffffff',
          imageTimeout: 15000,
          scrollY: -window.scrollY,
          windowWidth: document.documentElement.offsetWidth,
          windowHeight: document.documentElement.offsetHeight,
          onclone: async (documentClone) => {
            const element = documentClone.querySelector('.p-6.space-y-6') as HTMLElement;
            if (element) {
              element.style.overflow = 'visible';
              element.style.height = 'auto';
            }

            // Aplicar estilos resueltos al clon
            const cloneElems = Array.from(documentClone.querySelectorAll('[data-export-img-id]')) as HTMLElement[];
            cloneElems.forEach((cloneEl) => {
              const id = cloneEl.getAttribute('data-export-img-id') || '';
              const cssText = resolvedStyleMap.get(id) || '';
              if (cssText) {
                try {
                  (cloneEl.style as any).cssText += cssText;
                } catch (e) {
                  // ignorar si falla
                }
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
                } else {
                  const original = src;
                  if (original) img.src = original;
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
              } catch (e) {
                try { img.src = PLACEHOLDER_IMG; } catch (_) {}
              }
            }));
          }
        });

        // Limpieza: eliminar atributos temporales
        elems.forEach(el => el.removeAttribute('data-export-img-id'));

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

      // Convertir canvas a imagen PNG de alta calidad
      canvas.toBlob((blob) => {
        if (!blob) {
          alert('Error al generar la imagen.');
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const filename = `Resumen_${clienteNombre}_${orden.id.slice(0, 8)}.png`;
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Limpiar el URL después de un tiempo
        setTimeout(() => URL.revokeObjectURL(url), 100);
      }, 'image/png', 1.0); // PNG con calidad máxima

    } catch (error: any) {
      console.error('Error exportando imagen:', error);
      alert(`Error al generar la imagen: ${error?.message || error}. Por favor, intenta nuevamente.`);
    } finally {
      setIsExporting(false);
    }
  };

  // Agrupar items por nombre de prenda (no por variante)
  const itemsAgrupados = React.useMemo(() => {
    if (!orden || !orden.items) return [];

    const grouped = new Map<string, any>();
    
    orden.items.forEach((item: any) => {
      const key = item.nombre || 'Sin nombre';
      if (grouped.has(key)) {
        const existing = grouped.get(key);
        existing.cantidad += 1;
        existing.variantes.push({ talla: item.talla, color: item.color, precio: item.precio });
        existing.subtotalTotal += (item.precio || 0);
      } else {
        grouped.set(key, {
          ...item,
          cantidad: 1,
          variantes: [{ talla: item.talla, color: item.color, precio: item.precio }],
          subtotalTotal: (item.precio || 0)
        });
      }
    });

    return Array.from(grouped.values());
  }, [orden]);

  if (!isOpen || !orden) return null;

  const clienteNombre = typeof orden.cliente === 'string' ? orden.cliente : orden.cliente?.nombre;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Encabezado */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-5 flex justify-between items-start z-10">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Resumen de Orden</span>
              <span className="text-xl font-bold text-gray-900">{storeName}</span>
              <p className="text-xs text-gray-400 mt-0.5">ID: {orden.id.slice(0, 12)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Contenido */}
        <div ref={contentRef} className="p-6 space-y-6">
          {/* Información del Cliente */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Cliente</h3>
            <p className="text-sm text-gray-700">{clienteNombre}</p>
          </div>

          {/* Items */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Prendas ({itemsAgrupados.length})</h3>
            <div className="space-y-3">
              {itemsAgrupados.map((item, idx) => {
                return (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Imagen (solo primera variante) */}
                      {item.foto && (
                        <div className="md:col-span-1">
                          <img
                            crossOrigin="anonymous" referrerPolicy="no-referrer"
                            src={item.foto}
                            alt={item.nombre}
                            className="w-full h-24 object-cover rounded-md"
                          />
                        </div>
                      )}
                      
                      {/* Detalles */}
                      <div className={item.foto ? 'md:col-span-3' : 'md:col-span-4'}>
                        <div className="space-y-2">
                          <h4 className="font-semibold text-gray-900">{item.nombre}</h4>
                          
                          {/* Lista de Variantes (tallas y colores) */}
                          <div className="text-sm text-gray-600">
                            <p className="font-medium text-gray-700 mb-1">Variantes:</p>
                            <ul className="list-disc list-inside space-y-0.5 ml-2">
                              {item.variantes.map((v: any, vIdx: number) => (
                                <li key={vIdx}>
                                  Talla: <span className="font-medium text-gray-900">{v.talla || '-'}</span>, Color: <span className="font-medium text-gray-900">{v.color || '-'}</span> — ${(v.precio || 0).toFixed(2)}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Cantidad total */}
                          <div className="text-sm text-gray-600">
                            <p>Cantidad total: <span className="font-medium text-gray-900">{item.cantidad}</span></p>
                          </div>

                          {/* Subtotal agregado */}
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 font-semibold">Subtotal:</span>
                              <span className="font-bold text-gray-900">${item.subtotalTotal.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resumen de Totales */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium text-gray-900">
                ${(orden.totalVenta + (orden.descuentoMonto || 0)).toFixed(2)}
              </span>
            </div>
            
            {orden.descuentoPorcentaje && orden.descuentoPorcentaje > 0 && (
              <>
                <div className="flex justify-between text-sm text-blue-600">
                  <span>Descuento ({orden.descuentoPorcentaje}%):</span>
                  <span>-${(orden.descuentoMonto || 0).toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between">
                  <span className="font-semibold text-gray-900">Total Final:</span>
                  <span className="font-bold text-lg text-gray-900">${orden.totalVenta.toFixed(2)}</span>
                </div>
              </>
            )}
            {/* Pagado y Saldo restante */}
            {(() => {
              const totalPagadoCalc = (orden.totalPagado ?? (orden.pagos || []).reduce((a, p) => a + (p.monto || 0), 0));
              const saldoRestanteCalc = (orden.saldoPendiente ?? Math.max(orden.totalVenta - totalPagadoCalc, 0));
              return (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total pagado:</span>
                    <span className="font-medium text-gray-900">${totalPagadoCalc.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-gray-900">Saldo restante:</span>
                    <span className="font-bold text-red-600">${saldoRestanteCalc.toFixed(2)}</span>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Lista de Pagos (si existen) - debajo de Totales */}
          {orden.pagos && orden.pagos.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mt-4">Pagos</h3>
              <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                {orden.pagos.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <div className="flex-1">
                      <div className="text-gray-700">{p.fecha} · {p.metodo}</div>
                      <div className="font-semibold text-gray-900">${p.monto.toFixed(2)}</div>
                    </div>
                    <button
                      onClick={() => {
                        const clienteNombre = typeof orden.cliente === 'string' ? orden.cliente : orden.cliente?.nombre;
                        const totalPagadoCalc = (orden.totalPagado ?? (orden.pagos || []).reduce((a, pago) => a + (pago.monto || 0), 0));
                        const saldoRestanteCalc = (orden.saldoPendiente ?? Math.max(orden.totalVenta - totalPagadoCalc, 0));
                        setReciboSeleccionado({
                          pago: { ...p, folioTransaccion: `TX-${orden.id.slice(0,6)}-${idx}` },
                          ordenesDestino: [{
                            id: orden.id,
                            folio: (orden as any).folio || null,
                            cliente: { nombre: clienteNombre || 'Cliente' },
                            totalVenta: orden.totalVenta,
                            saldoRestante: saldoRestanteCalc,
                            liquidada: saldoRestanteCalc <= 0
                          }]
                        });
                      }}
                      className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Ver recibo
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Información de Entrega */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-gray-900 mb-2">Información de Entrega</h3>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-gray-600">Zona:</span>{' '}
                <span className="font-medium text-gray-900">{orden.lugar || '-'}</span>
              </p>
              <p>
                <span className="text-gray-600">Tipo:</span>{' '}
                <span className="font-medium text-gray-900">
                  {esEntregaPersonal(orden.lugar) ? 'Entrega Personal' : 'Paquetería'}
                </span>
              </p>
              {orden.fechaEnvio && (
                <p>
                  <span className="text-gray-600">Fecha de Envío:</span>{' '}
                  <span className="font-medium text-gray-900">{orden.fechaEnvio}</span>
                </p>
              )}
              {orden.fechaEntrega && (
                <p>
                  <span className="text-gray-600">Fecha de Entrega:</span>{' '}
                  <span className="font-medium text-gray-900">{orden.fechaEntrega}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Pie de página */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex gap-2">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cerrar
          </button>
          <button
            onClick={handleExportImage}
            disabled={isExporting}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <PhotoIcon className="h-5 w-5" />
            {isExporting ? 'Generando...' : 'Exportar Imagen'}
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <DocumentArrowDownIcon className="h-5 w-5" />
            {isExporting ? 'Generando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      {/* Modal de Recibo de Pago */}
      {reciboSeleccionado && (
        <ReciboPago
          isOpen={true}
          pago={reciboSeleccionado.pago}
          ordenesDestino={reciboSeleccionado.ordenesDestino}
          onClose={() => setReciboSeleccionado(null)}
        />
      )}
    </div>
  );
};

export default ResumenOrden;
