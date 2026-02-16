import React, { useState, useEffect, useMemo } from 'react';
import { 
    CubeIcon, ShoppingCartIcon, CurrencyDollarIcon, WalletIcon,
    ExclamationTriangleIcon, PlusIcon, BanknotesIcon,
    TruckIcon, ClockIcon, ChartBarIcon, TagIcon
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../credenciales';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts';
import { userQuery } from '../utils/multitenancy';

// --- Interfaces ---
interface Producto {
  id: string;
  name: string;
  variants: Array<{
    colorName: string;
    sizes: Array<{
      size: string;
      stock: number;
      isInStock: boolean;
    }>;
  }>;
  cost?: number;
  publicPrice?: number;
}

interface Orden {
  id: string;
  cliente: { nombre: string } | string;
  totalVenta: number;
  saldoPendiente?: number;
  estadoPedido: string;
  fechaCreacion?: string;
  fechaEntrega?: string;
  items: Array<{
    nombre: string;
    cantidad: number;
    precio: number;
    costo?: number;
    comprado?: boolean;
    cancelado?: boolean;
    pagadoProveedor?: boolean;
    origen?: 'stock' | 'pedido';
  }>;
}

interface ClienteCredito {
  cliente: string;
  saldoTotal: number;
}

interface InventoryMovement {
  tipo: string;
  comprado?: boolean;
  cancelado?: boolean;
  pagadoProveedor?: boolean;
  costo?: number;
  cantidad?: number;
  productoNombre?: string;
}

// --- Mapeo de Clases Literales para KPI Card ---
const kpiColorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    red: 'bg-red-600',
    amber: 'bg-amber-500',
    purple: 'bg-purple-600',
    indigo: 'bg-indigo-600',
    teal: 'bg-teal-600',
    gray: 'bg-gray-500',
};

// --- Subcomponente: Tarjeta KPI ---
interface KPICardProps {
    title: string;
    value: string;
    unit: string;
    icon: React.ElementType;
    color: keyof typeof kpiColorClasses;
    path?: string;
    description?: string;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, unit, icon: Icon, color, path, description }) => {
    const CardContainer = path ? Link : 'div';

    return (
        <CardContainer 
            to={path || '#'}
            className={`
                bg-white shadow-sm rounded-lg p-5 transition duration-200 border border-gray-100
                ${path ? 'hover:shadow-md hover:border-blue-300 cursor-pointer hover:-translate-y-0.5' : ''}
            `}
        >
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{title}</p>
                    <div className="flex items-baseline">
                        <span className="text-2xl font-bold text-gray-900">{value}</span>
                        <span className="ml-2 text-xs font-medium text-gray-500">{unit}</span>
                    </div>
                    {description && (
                        <p className="text-xs text-gray-400 mt-1">{description}</p>
                    )}
                </div>
                <div className={`h-12 w-12 p-3 rounded-full text-white ${kpiColorClasses[color]} flex-shrink-0`}>
                    <Icon className="h-full w-full" />
                </div>
            </div>
        </CardContainer>
    );
};

// --- Mapeo de Clases Literales para Alertas ---
const alertColorMap = {
    'amber-500': { border: 'border-amber-500', text: 'text-amber-500', bg: 'bg-amber-50' }, 
    'red-600': { border: 'border-red-600', text: 'text-red-600', bg: 'bg-red-50' }, 
    'blue-600': { border: 'border-blue-600', text: 'text-blue-600', bg: 'bg-blue-50' }, 
  'pink-600': { border: 'border-pink-600', text: 'text-pink-600', bg: 'bg-pink-50' },
};

// --- Mapeo de Clases Literales para Acciones Rápidas ---
const actionColorMap = {
    'blue': { bg: 'bg-blue-50', text: 'text-blue-600', hover: 'group-hover:bg-blue-100' },
    'green': { bg: 'bg-green-50', text: 'text-green-600', hover: 'group-hover:bg-green-100' },
    'amber': { bg: 'bg-amber-50', text: 'text-amber-600', hover: 'group-hover:bg-amber-100' },
    'purple': { bg: 'bg-purple-50', text: 'text-purple-600', hover: 'group-hover:bg-purple-100' },
};

// --- Componente Principal Dashboard ---
const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const uid = user?.uid;
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [clientesCredito, setClientesCredito] = useState<ClienteCredito[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);

  // --- Carga de Datos ---
  useEffect(() => {
    if (!uid) return;
    const fetchData = async () => {
      try {
        const [productosSnap, ordenesSnap, creditoSnap, movimientosSnap] = await Promise.all([
          getDocs(userQuery('productos', uid)),
          getDocs(userQuery('ordenes', uid)),
          getDocs(userQuery('clientes_credito', uid)),
          getDocs(userQuery('inventory_movements', uid)),
          getDocs(userQuery('clientes', uid))
        ]);

        setProductos(productosSnap.docs.map(d => ({ id: d.id, ...d.data() } as Producto)));
        setOrdenes(ordenesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Orden)));
        setClientesCredito(creditoSnap.docs.map(d => d.data() as ClienteCredito).filter(c => (c.saldoTotal || 0) > 0));
        setInventoryMovements(movimientosSnap.docs.map(d => d.data() as InventoryMovement).filter(m => m.tipo === 'entrada'));
        setClientes((await getDocs(userQuery('clientes', uid))).docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error('Error cargando datos del dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [uid]);

  // --- Cálculos de KPIs ---
  const kpis = useMemo(() => {
    if (loading) return [];

    // 1. Prendas por comprar - Contar cada ITEM una sola vez (igual que en Compras.tsx)
    // Solo órdenes NO entregadas y con items NO comprados, NO cancelados
    let prendasPorComprar = 0;
    
    // Items de órdenes (solo de órdenes que NO están entregadas)
    ordenes.forEach(orden => {
      // Filtro: solo órdenes que NO están entregadas (igual que en Compras.tsx)
      if (orden.estadoPedido === 'entregado') return;
      
      (orden.items || []).forEach(item => {
        if (item.comprado === false && !item.cancelado) {
          prendasPorComprar += 1;
        }
      });
    });
    
    // Items de inventory_movements (query en Compras filtra comprado === false)
    inventoryMovements.forEach(m => {
      // En Compras.tsx el query es: where('comprado', '==', false)
      // Así que solo procesar si no está pagado
      if (m.comprado === false && !m.cancelado) {
        prendasPorComprar += 1;
      }
    });

    // 2. Costo por pagar - Solo items NO comprados, NO cancelados y NO pagados
    // (igual que en Compras.tsx: totalPagar suma solo items sin pagadoProveedor)
    let costoPorPagar = 0;
    
    ordenes.forEach(orden => {
      // Filtro: solo órdenes que NO están entregadas (igual que en Compras.tsx)
      if (orden.estadoPedido === 'entregado') return;
      
      (orden.items || []).forEach(item => {
        if (item.comprado === false && !item.cancelado && !item.pagadoProveedor) {
          costoPorPagar += Number(item.costo || 0);
        }
      });
    });
    
    inventoryMovements.forEach(m => {
      if (m.comprado === false && !m.cancelado && !m.pagadoProveedor) {
        costoPorPagar += Number(m.costo || 0) * (m.cantidad || 1);
      }
    });

    // 3. Total de cuentas por cobrar
    const cuentasPorCobrar = ordenes.reduce((acc, orden) => {
      return acc + (orden.saldoPendiente || 0);
    }, 0);

    // 4. Inventario: cantidad y valor (igual que en Inventario.tsx)
    let cantidadInventario = 0;
    let valorInventario = 0;
    
    productos.forEach(prod => {
      prod.variants?.forEach(variant => {
        variant.sizes?.forEach(size => {
          if (size.isInStock && size.stock > 0) {
            cantidadInventario += size.stock;
            // Valor = costo (no publicPrice como estaba mal)
            valorInventario += size.stock * (prod.cost || 0);
          }
        });
      });
    });

    // 5. Pedidos pendientes
    const pedidosPendientes = ordenes.filter(o => o.estadoPedido === 'pendiente' || o.estadoPedido === 'confirmado').length;

    // 6. Pedidos por entregar
    const pedidosPorEntregar = ordenes.filter(o => o.estadoPedido === 'enviado' || o.estadoPedido === 'listo').length;

    // 7. Saldo a favor acumulado
    const saldoAFavor = clientesCredito.reduce((acc, c) => acc + c.saldoTotal, 0);

    // 8. Ventas pendientes de pago
    const ventasPendientes = ordenes.filter(o => (o.saldoPendiente || 0) > 0).length;

    return [
      { 
        title: 'Prendas por Comprar', 
        value: prendasPorComprar.toString(), 
        unit: 'prendas', 
        icon: ShoppingCartIcon, 
        color: 'red' as keyof typeof kpiColorClasses,
        path: '/compras',
        description: 'Pendientes de proveedor'
      },
      { 
        title: 'Costo por Pagar', 
        value: `$${(costoPorPagar / 1000).toFixed(1)}k`, 
        unit: 'MXN', 
        icon: CurrencyDollarIcon, 
        color: 'amber' as keyof typeof kpiColorClasses,
        path: '/compras',
        description: 'A proveedores'
      },
      { 
        title: 'Cuentas por Cobrar', 
        value: `$${(cuentasPorCobrar / 1000).toFixed(1)}k`, 
        unit: 'MXN', 
        icon: BanknotesIcon, 
        color: 'blue' as keyof typeof kpiColorClasses,
        path: '/pagos',
        description: `${ventasPendientes} órdenes con saldo`
      },
      { 
        title: 'Inventario Total', 
        value: cantidadInventario.toString(), 
        unit: 'prendas', 
        icon: CubeIcon, 
        color: 'green' as keyof typeof kpiColorClasses,
        path: '/inventario',
        description: 'En stock disponible'
      },
      { 
        title: 'Valor Inventario', 
        value: `$${(valorInventario / 1000).toFixed(1)}k`, 
        unit: 'MXN', 
        icon: WalletIcon, 
        color: 'teal' as keyof typeof kpiColorClasses,
        path: '/inventario',
        description: 'Precio público'
      },
      { 
        title: 'Pedidos Pendientes', 
        value: pedidosPendientes.toString(), 
        unit: 'órdenes', 
        icon: ClockIcon, 
        color: 'purple' as keyof typeof kpiColorClasses,
        path: '/pedidos',
        description: 'Por procesar'
      },
      { 
        title: 'Por Entregar', 
        value: pedidosPorEntregar.toString(), 
        unit: 'envíos', 
        icon: TruckIcon, 
        color: 'indigo' as keyof typeof kpiColorClasses,
        path: '/entregas',
        description: 'Listos o en camino'
      },
      { 
        title: 'Saldo a Favor', 
        value: `$${(saldoAFavor / 1000).toFixed(1)}k`, 
        unit: 'MXN', 
        icon: TagIcon, 
        color: 'gray' as keyof typeof kpiColorClasses,
        path: '/saldo-a-favor',
        description: `${clientesCredito.length} clientes`
      },
    ];
  }, [loading, productos, ordenes, clientesCredito, inventoryMovements]);

  // --- Alertas Inteligentes ---
  const alertas = useMemo(() => {
    if (loading) return [];

    const alerts = [];

    // Alerta: Cumpleaños hoy
    const today = new Date();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();

    const parseDateFlexible = (val: any): Date | null => {
      if (!val) return null;
      
      // Firestore Timestamp: extraer mes/día sin conversión de zona horaria
      if (typeof val === 'object' && typeof val.toDate === 'function') {
        const d = val.toDate();
        // Retornar fecha como si fuera local para evitar desplazamientos UTC
        const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD en UTC
        const [y, m, dy] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, dy);
      }
      
      if (typeof val === 'number') return new Date(val);
      
      if (typeof val === 'string') {
        const s = val.trim();
        
        // handle YYYY-MM-DD (treat as local date to avoid UTC shift)
        const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
        if (isoDateOnly) {
          const [y, m, d] = s.split('-').map(Number);
          return new Date(y, m - 1, d);
        }
        
        // handle DD/MM/YYYY or DD-MM-YYYY
        if (s.includes('/')) {
          const parts = s.split('/');
          if (parts.length === 3) {
            const d = Number(parts[0]);
            const m = Number(parts[1]) - 1;
            const y = Number(parts[2]);
            return new Date(y, m, d);
          }
        }
        
        if (s.includes('-')) {
          const parts = s.split('-');
          // handle DD-MM-YYYY
          if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
            const d = Number(parts[0]);
            const m = Number(parts[1]) - 1;
            const y = Number(parts[2]);
            return new Date(y, m, d);
          }
        }
        
        // handle other formats
        const possible = new Date(s);
        if (!isNaN(possible.getTime())) return possible;
      }
      
      return null;
    };

    const birthdayNames: string[] = [];
    clientes.forEach(c => {
      const v = c.cumpleaños || c.fechaNacimiento || c.fecha_nacimiento || c.birthday || c.cumple || c.birthdate || c.fecha;
      const d = parseDateFlexible(v);
      if (d) {
        if (d.getDate() === todayDate && d.getMonth() === todayMonth) {
          const nombre = c.cliente || c.nombre || c.name || c.displayName || c.razonSocial || c.fullName || c.alias || c.id;
          if (nombre) birthdayNames.push(nombre);
        }
      }
    });

    // Debug: log cumpleaños detectados
    if (clientes.length > 0) {
      console.log('🎂 Verificando cumpleaños:');
      console.log('Fecha de hoy (local):', new Date().toLocaleString(), `Mes: ${todayMonth}, Día: ${todayDate}`);
      console.log(`Total clientes: ${clientes.length}`);
      
      // Mostrar estructura del primer cliente
      if (clientes.length > 0) {
        console.log('📋 Estructura del primer cliente:');
        console.log(JSON.stringify(clientes[0], null, 2));
      }
      
      let logCount = 0;
      clientes.forEach(c => {
        const nombre = c.nombre || c.name || c.displayName || c.razonSocial || c.fullName || c.alias || c.id;
        
        // Buscar en TODOS los campos del objeto
        const v = c.fechaNacimiento || c.fecha_nacimiento || c.birthday || c.cumple || c.birthdate || c.fecha;
        
        if (logCount < 10) {
          const d = parseDateFlexible(v);
          const match = d && d.getDate() === todayDate && d.getMonth() === todayMonth;
          
          console.log(`  ${nombre}:`);
          console.log(`    Raw value: ${JSON.stringify(v)}`);
          if (d) {
            console.log(`    Parseada: ${d.toLocaleString()} (Mes: ${d.getMonth()}, Día: ${d.getDate()}) | Match: ${match}`);
          } else {
            console.log(`    NO PARSEADA`);
          }
          
          logCount++;
        }
      });
      console.log(`Cumpleaños encontrados hoy: ${birthdayNames.length}`);
    }

    if (birthdayNames.length > 0) {
      const maxShow = 6;
      const namesShown = birthdayNames.slice(0, maxShow).join(', ');
      const more = birthdayNames.length > maxShow ? ` (+${birthdayNames.length - maxShow} más)` : '';
      alerts.push({
        title: 'Cumpleaños Hoy',
        description: `${namesShown}${more}`,
        Icon: SparklesIcon,
        tailwindColor: 'pink-600' as keyof typeof alertColorMap,
        path: '/clientes'
      });
    }

    // Alerta 1: Stock crítico (productos con <5 unidades totales)
    const productosBajoStock = productos.filter(prod => {
      const totalStock = prod.variants?.reduce((acc, v) => {
        return acc + (v.sizes?.reduce((sum, s) => sum + (s.isInStock ? s.stock : 0), 0) || 0);
      }, 0) || 0;
      return totalStock > 0 && totalStock < 5;
    });

    if (productosBajoStock.length > 0) {
      alerts.push({
        title: 'Stock Crítico',
        description: `${productosBajoStock.length} productos tienen menos de 5 unidades en inventario.`,
        Icon: ExclamationTriangleIcon,
        tailwindColor: 'amber-500' as keyof typeof alertColorMap,
        path: '/inventario'
      });
    }

    // Alerta 2: Compras pendientes urgentes
    const comprasUrgentes = ordenes.reduce((acc, orden) => {
      return acc + (orden.items || []).filter(item => !item.comprado && item.origen === 'pedido').length;
    }, 0);

    if (comprasUrgentes > 10) {
      alerts.push({
        title: 'Compras Pendientes',
        description: `Hay ${comprasUrgentes} prendas por comprar a proveedores. Revisa urgente.`,
        Icon: ShoppingCartIcon,
        tailwindColor: 'red-600' as keyof typeof alertColorMap,
        path: '/compras'
      });
    }

    // Alerta 3: Cuentas por cobrar atrasadas
    const hoy = new Date();
    const ordenesAtrasadas = ordenes.filter(o => {
      if ((o.saldoPendiente || 0) <= 0) return false;
      const fechaRef = o.fechaEntrega || o.fechaCreacion;
      if (!fechaRef) return false;
      const fecha = new Date(fechaRef);
      const dias = Math.floor((hoy.getTime() - fecha.getTime()) / (1000 * 3600 * 24));
      return dias > 30;
    });

    if (ordenesAtrasadas.length > 0) {
      alerts.push({
        title: 'Pagos Atrasados',
        description: `${ordenesAtrasadas.length} clientes tienen pagos con más de 30 días de atraso.`,
        Icon: BanknotesIcon,
        tailwindColor: 'blue-600' as keyof typeof alertColorMap,
        path: '/pagos'
      });
    }

    // Alerta 4: Pedidos pendientes sin procesar
    const pendientesSinProcesar = ordenes.filter(o => o.estadoPedido === 'pendiente').length;
    if (pendientesSinProcesar > 5) {
      alerts.push({
        title: 'Pedidos Sin Procesar',
        description: `${pendientesSinProcesar} pedidos están esperando confirmación o procesamiento.`,
        Icon: ClockIcon,
        tailwindColor: 'amber-500' as keyof typeof alertColorMap,
        path: '/pedidos'
      });
    }

    return alerts;
  }, [loading, productos, ordenes, clientes]);

  // --- Acciones Rápidas ---
  const acciones = [
    { name: 'Nueva Venta', icon: PlusIcon, path: '/nuevo-pedido', color: 'green' as keyof typeof actionColorMap },
    { name: 'Registrar Pago', icon: CurrencyDollarIcon, path: '/pagos', color: 'blue' as keyof typeof actionColorMap },
    { name: 'Registrar Compra', icon: ShoppingCartIcon, path: '/compras', color: 'amber' as keyof typeof actionColorMap },
    { name: 'Ver Reportes', icon: ChartBarIcon, path: '/reportes', color: 'purple' as keyof typeof actionColorMap },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Resumen general del negocio</p>
      </div>

      {/* Acciones Rápidas */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Acciones Rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {acciones.map((action, index) => {
            const colorClasses = actionColorMap[action.color];
            return (
              <Link
                key={index}
                to={action.path}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-white shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition duration-150 group"
              >
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${colorClasses.bg} ${colorClasses.text} mb-2 ${colorClasses.hover} transition`}>
                  <action.icon className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-gray-800 text-center">{action.name}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Alertas Inteligentes */}
      {alertas.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Alertas Inteligentes</h2>
          <div className="space-y-3">
            {alertas.map((alert, index) => {
              const colorClasses = alertColorMap[alert.tailwindColor];
              return (
                <Link
                  key={index}
                  to={alert.path}
                  className={`flex items-start p-4 rounded-lg bg-white shadow-sm border-l-4 ${colorClasses.border} hover:shadow-md transition duration-150 cursor-pointer ${colorClasses.bg}`}
                >
                  <alert.Icon className={`h-6 w-6 mr-3 mt-0.5 ${colorClasses.text} flex-shrink-0`} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{alert.title}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{alert.description}</p>
                  </div>
                  <span className="text-sm font-medium text-blue-600 ml-2">Ver →</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* KPIs Grid */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Métricas Clave</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi, index) => (
            <KPICard key={index} {...kpi} />
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;