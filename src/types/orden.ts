/**
 * Tipos compartidos para componentes reutilizables
 * 
 * Este archivo contiene las interfaces que se utilizan en componentes
 * reutilizables como ResumenOrden para facilitar su uso desde diferentes módulos.
 */

export interface Orden {
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
}

export interface Item {
  id?: string;
  nombre: string;
  talla?: string;
  color?: string;
  cantidad: number;
  precio: number;
  imagen?: string;
  origen?: 'stock' | 'bajo_pedido';
}

export interface Cliente {
  nombre: string;
  uid?: string;
}
export interface ItemDevuelto {
  nombre: string;
  talla: string;
  color: string;
  cantidad: number;
  precioUnitario: number;
  razon: string;
  imagen?: string;
  productoId?: string;
  variantId?: number;
  sku?: string;
}

export interface Devolucion {
  id: string;
  ordenId: string;
  cliente: { nombre: string; uid?: string } | string;
  items: ItemDevuelto[];
  totalDevuelto: number;
  metodoReembolso: 'dinero' | 'saldo_favor' | 'ambos';
  saldoFavor?: number;
  reembolsoMonto?: number;
  fechaDevolucion: string;
  estadoDevolucion: 'pendiente' | 'procesada' | 'rechazada';
  notas?: string;
  registradoPor?: string;
  fechaCreacion: string;
  timestamp?: any;
}

export interface MovimientoSaldo {
  tipo: 'devolucion' | 'compra';
  monto: number;
  referencia: string;
  fecha: string;
  balance_anterior: number;
  balance_nuevo: number;
}

export interface ClienteCredito {
  cliente: string;
  saldoTotal: number;
  movimientos: MovimientoSaldo[];
  fechaCreacion?: any;
  fechaActualizacion?: string;
  timestamp?: any;
}