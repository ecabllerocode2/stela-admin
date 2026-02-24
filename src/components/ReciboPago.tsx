import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

import { DocumentArrowDownIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { doc as firestoreDoc, getDoc } from 'firebase/firestore';
import { db } from '../credenciales';
import { useUserProfile } from '../hooks/useUserProfile';

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
  const [isExporting, setIsExporting] = useState(false);
  const { storeName } = useUserProfile();

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

    // Logo (texto con nombre del negocio)
    try {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.setTextColor(colorTextoPrincipal.r, colorTextoPrincipal.g, colorTextoPrincipal.b);
      pdf.text(storeName, centerX, 60, { align: 'center' });
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
    if (isExporting) return;

    try {
      setIsExporting(true);

      // --- Preparar datos del recibo ---
      const clienteNombre = ordenesDestino.length
        ? (typeof ordenesDestino[0].cliente === 'string'
            ? ordenesDestino[0].cliente
            : ordenesDestino[0].cliente?.nombre)
        : '-';

      const itemNames: string[] = [];
      try {
        for (const ord of ordenesDestino) {
          const snap = await getDoc(firestoreDoc(db, 'ordenes', ord.id));
          const data: any = snap.exists() ? snap.data() : null;
          const items: any[] = Array.isArray(data?.items) ? data.items : [];
          items.forEach((it) => { if (it?.nombre) itemNames.push(String(it.nombre)); });
        }
      } catch (_) {}

      const uniqueNames = Array.from(new Set(itemNames));
      const shown = uniqueNames.slice(0, 6);
      const remaining = Math.max(0, uniqueNames.length - shown.length);
      const itemsSummary = shown.length
        ? (remaining > 0 ? `${shown.join(', ')} (+${remaining} más)` : shown.join(', '))
        : 'N/A';

      // --- Construir recibo en iframe oculto ---
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:320px;height:500px;border:none;visibility:hidden;';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error('No se pudo crear documento en iframe');

      const html = `<!doctype html><html><head><meta charset="utf-8"><style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#fff;width:320px;}
        .receipt{width:320px;background:#fff;}
        .header{background:rgb(244,232,228);padding:30px 24px 24px;text-align:center;}
        .brand{font-size:20px;font-weight:700;color:rgb(60,40,30);letter-spacing:0.5px;margin-bottom:6px;}
        .tagline{font-size:13px;color:rgb(80,60,50);font-style:italic;letter-spacing:0.2px;}
        .body{padding:22px 28px 16px;}
        .amount-label{font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:rgb(120,110,110);text-align:center;margin-bottom:6px;}
        .amount{font-size:38px;font-weight:700;color:rgb(40,30,20);text-align:center;margin-bottom:18px;font-variant-numeric:tabular-nums;}
        .divider{height:1px;background:rgb(230,220,215);margin:0 0 18px;}
        .row{margin-bottom:15px;text-align:center;}
        .row-label{font-size:8.5px;text-transform:uppercase;letter-spacing:0.9px;color:rgb(120,110,110);margin-bottom:3px;}
        .row-value{font-size:11px;font-weight:600;color:rgb(40,30,20);word-break:break-word;}
        .footer{text-align:center;padding:10px 24px 18px;border-top:1px solid rgb(230,220,215);}
        .footer-text{font-size:9px;color:rgb(150,140,140);font-style:italic;}
      </style></head><body>
        <div class="receipt">
          <div class="header">
            <div class="brand">${storeName}</div>
            <div class="tagline">¡Gracias por tu pago!</div>
          </div>
          <div class="body">
            <div class="amount-label">CANTIDAD PAGADA</div>
            <div class="amount">$${pago.monto.toFixed(2)}</div>
            <div class="divider"></div>
            <div class="row"><div class="row-label">FOLIO DE AUTORIZACIÓN</div><div class="row-value">${pago.folioTransaccion || 'N/A'}</div></div>
            <div class="row"><div class="row-label">MÉTODO DE PAGO</div><div class="row-value">${pago.metodo}</div></div>
            <div class="row"><div class="row-label">FECHA</div><div class="row-value">${pago.fecha}</div></div>
            <div class="row"><div class="row-label">CLIENTE</div><div class="row-value">${clienteNombre || '-'}</div></div>
            <div class="row"><div class="row-label">PRENDAS</div><div class="row-value">${itemsSummary}</div></div>
          </div>
          <div class="footer"><div class="footer-text">Comprobante electrónico de pago</div></div>
        </div>
      </body></html>`;

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      // Esperar a que las fuentes y el layout estén listos
      try {
        if ((iframeDoc as any).fonts?.ready) await (iframeDoc as any).fonts.ready;
      } catch (_) {}
      await new Promise(r => setTimeout(r, 200));

      const canvas = await html2canvas(iframeDoc.body as HTMLElement, {
        scale: 3,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        imageTimeout: 12000,
      });

      setTimeout(() => { try { document.body.removeChild(iframe); } catch (_) {} }, 400);

      canvas.toBlob((blob) => {
        if (!blob) { alert('Error al generar la imagen.'); return; }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Recibo_${pago.folioTransaccion}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
      }, 'image/png', 1.0);

    } catch (error: any) {
      console.error('Error exportando imagen:', error);
      alert(`Error al generar la imagen: ${error?.message || error}`);
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200">

        {/* Header — Nombre del negocio + folio */}
        <div className="bg-rose-50 px-5 py-4 border-b border-rose-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-rose-400 uppercase tracking-widest mb-0.5">Comprobante de pago</p>
            <h3 className="text-xl font-bold text-gray-900">{storeName}</h3>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 font-mono">Ref: {pago.folioTransaccion}</p>
          </div>
        </div>

        {/* Monto destacado */}
        <div className="px-5 py-5 bg-white text-center border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Cantidad pagada</p>
          <p className="text-4xl font-bold text-gray-900 tabular-nums">${pago.monto.toFixed(2)}</p>
        </div>

        {/* Detalles del pago */}
        <div className="px-5 py-4 grid grid-cols-2 gap-4 border-b border-gray-100">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Cliente</p>
            <p className="font-semibold text-gray-800 text-sm">{clienteNombre}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Fecha</p>
            <p className="font-medium text-gray-700 text-sm">{pago.fecha}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Método</p>
            <span className="text-sm font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{pago.metodo}</span>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Estado</p>
            <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">Confirmado</span>
          </div>
        </div>

        {/* Órdenes aplicadas */}
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Detalle de aplicación</p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {ordenesDestino.map((o) => (
              <div key={o.id} className="p-2.5 border border-gray-100 rounded-lg bg-gray-50 flex justify-between items-center">
                <div>
                  <div className="text-xs text-gray-500">Folio: {o.folio || 'S/N'}</div>
                  <div className="text-xs text-gray-400 font-mono">ID: {o.id.slice(0, 8)}…</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-800">${o.totalVenta.toFixed(2)}</div>
                  {typeof o.saldoRestante === 'number' && (
                    <div className="text-xs text-gray-500">
                      Resta: <span className={o.liquidada ? 'text-green-600 font-semibold' : 'text-gray-600'}>${o.saldoRestante.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-end gap-1 text-xs text-gray-400">
            <span>Total aplicado:</span>
            <span className="font-bold text-gray-700">${totalOrdenes.toFixed(2)}</span>
          </div>
        </div>

        {/* Acciones */}
        <div className="px-5 py-3 flex justify-end gap-2 bg-gray-50/50">
          <button
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            onClick={onClose}
            disabled={isExporting}
          >
            Cerrar
          </button>
          <button
            className="px-4 py-2 text-sm font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50 transition-colors"
            onClick={handleExportImage}
            disabled={isExporting}
          >
            <PhotoIcon className="w-4 h-4" />
            {isExporting ? 'Generando…' : 'Imagen'}
          </button>
          <button
            className="px-4 py-2 text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50 transition-colors"
            onClick={handleExportPDF}
            disabled={isExporting}
          >
            <DocumentArrowDownIcon className="w-4 h-4" />
            {isExporting ? 'Generando…' : 'PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReciboPago;