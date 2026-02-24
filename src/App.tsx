import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAutoUpdate } from './hooks/useAutoUpdate';

import {
  HomeIcon,
  CubeIcon,
  ShoppingCartIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  Bars3Icon,
  BellIcon,
  MagnifyingGlassIcon,
  TruckIcon,
  UserIcon,
  ArchiveBoxIcon,
  PhotoIcon,
  ArrowLeftOnRectangleIcon,
  SparklesIcon,
  Cog6ToothIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import Dashboard from './components/Dashboard';
import Productos from './components/Productos';
import CrearEditarProducto from './components/CrearEditarProducto';
import Pedidos from './components/Pedidos';
import NuevoPedido from './components/NuevoPedido';
import Entregas from './components/Entregas';
import Compras from './components/Compras';
import Pagos from './components/Pagos';
import Clientes from './components/Clientes';
import Inventario from './components/Inventario';
import MarcaAgua from './components/MarcaAgua';
import Devoluciones from './components/Devoluciones';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SubscriptionProvider, useSubscription } from './contexts/SubscriptionContext';
import TrialBanner from './components/TrialBanner';
import SubscriptionWall from './components/SubscriptionWall';
import Planes from './components/Planes';
import SubscriptionSuccess from './components/SubscriptionSuccess';
import SubscriptionCancel from './components/SubscriptionCancel';
import Reportes from './components/Reportes';
import SistemaRecomendaciones from './components/SistemaRecomendaciones';
import Configuracion from './components/Configuracion';
import MiTienda from './components/MiTienda';
import BusinessGate from './components/BusinessGate';
import SaldoAFavor from './components/SaldoAFavor';
import LandingPage from './components/LandingPage';


// --- Configuración del Menú Lateral  ---
const menuItems = [
  { name: 'Dashboard', path: '/', icon: HomeIcon },
  { name: 'Ordenes', path: '/pedidos', icon: ShoppingCartIcon },
  { name: 'Clientes', path: '/clientes', icon: UserIcon },
  { name: 'Recomendaciones', path: '/recomendaciones', icon: SparklesIcon, businessOnly: true },
  { name: 'Entregas', path: '/entregas', icon: TruckIcon },
  { name: 'Productos', path: '/productos', icon: CubeIcon },
  { name: 'Inventario', path: '/inventario', icon: ArchiveBoxIcon },
  { name: 'Marca de Agua', path: '/marca-agua', icon: PhotoIcon, businessOnly: true },
  { name: 'Compras', path: '/compras', icon: TruckIcon },
  { name: 'Pagos', path: '/pagos', icon: CurrencyDollarIcon },
  { name: 'Reportes', path: '/reportes', icon: ChartBarIcon },
  { name: 'divider', path: '', icon: HomeIcon },
  { name: 'Mi Tienda en Línea', path: '/mi-tienda', icon: GlobeAltIcon, businessOnly: true },
  { name: 'Configuración', path: '/configuracion', icon: Cog6ToothIcon },
];

function Layout({ children }: { children: React.ReactNode }) {
  useAutoUpdate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { logout, user } = useAuth();
  const { isBusiness } = useSubscription();
  const topBarRef = useRef<HTMLDivElement>(null);
  const [topHeight, setTopHeight] = useState(64);

  // Medir altura dinámica del contenedor (banner + header)
  useEffect(() => {
    if (!topBarRef.current) return;
    const ro = new ResizeObserver((entries) => {
      setTopHeight(entries[0].contentRect.height);
    });
    ro.observe(topBarRef.current);
    return () => ro.disconnect();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">

      {/* --- Banner + Header (bloque fijo unificado) --- */}
      <div ref={topBarRef} className="fixed w-full top-0 z-20">
        <TrialBanner />
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 text-gray-500">
              <Bars3Icon className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-quicksand font-bold text-gray-900 tracking-tight">
                Stela
              </div>
            </div>
            <span className="hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Operaciones
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 w-64"
              />
            </div>
            <button className="p-2 text-gray-400 hover:text-gray-500 relative">
              <BellIcon className="h-6 w-6" />
              <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-700">{user?.displayName || user?.email}</p>
                <p className="text-xs text-gray-500">Administrador</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-blue-600 border border-blue-700 flex items-center justify-center text-white text-sm font-bold">
                {(user?.displayName || user?.email || '?').charAt(0).toUpperCase()}
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="Cerrar sesión"
              >
                <ArrowLeftOnRectangleIcon className="h-6 w-6" />
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* --- 2. Sidebar --- */}
      <aside
        style={{ paddingTop: topHeight }}
        className={`
          fixed inset-y-0 left-0 z-10 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out pb-4 overflow-y-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
          lg:translate-x-0 lg:block
        `}
      >
        <nav className="px-4 space-y-1 mt-2">
          {menuItems.map((item, index) => {
            if (item.name === 'divider') {
              return <div key={`divider-${index}`} className="my-2 border-t border-gray-200" />;
            }
            const isActive = location.pathname === item.path;
            const showProBadge = item.businessOnly && !isBusiness;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors
                  ${isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                `}
              >
                <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className="flex-1">{item.name}</span>
                {showProBadge && (
                  <span className="ml-auto text-[10px] font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">
                    PRO
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* --- 3. Contenido --- */}
      <main className="lg:pl-64 transition-all duration-200" style={{ paddingTop: topHeight }}>
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 z-0 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login" element={<Login />} />

      {/* Rutas de suscripción (accesibles estando autenticado pero sin suscripción activa) */}
      <Route path="/planes" element={<ProtectedRoute><PlanesPage /></ProtectedRoute>} />
      <Route path="/subscription/success" element={<ProtectedRoute><SubscriptionSuccess /></ProtectedRoute>} />
      <Route path="/subscription/cancel" element={<ProtectedRoute><SubscriptionCancel /></ProtectedRoute>} />

      {/* Rutas protegidas (requieren suscripción activa) */}
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/productos" element={<ProtectedRoute><Productos /></ProtectedRoute>} />
      <Route path="/productos/crear" element={<ProtectedRoute><CrearEditarProducto /></ProtectedRoute>} />
      <Route path="/productos/editar/:id" element={<ProtectedRoute><CrearEditarProducto /></ProtectedRoute>} />
      <Route path="/pedidos" element={<ProtectedRoute><Pedidos /></ProtectedRoute>} />
      <Route path="/nuevo-pedido" element={<ProtectedRoute><NuevoPedido /></ProtectedRoute>} />
      <Route path="/pedidos/editar/:id" element={<ProtectedRoute><NuevoPedido /></ProtectedRoute>} />
      <Route path="/ordenes/editar/:id" element={<ProtectedRoute><NuevoPedido /></ProtectedRoute>} />
      <Route path="/entregas" element={<ProtectedRoute><Entregas /></ProtectedRoute>} />
      <Route path="/compras" element={<ProtectedRoute><Compras /></ProtectedRoute>} />
      <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
      <Route path="/inventario" element={<ProtectedRoute><Inventario /></ProtectedRoute>} />
      <Route path="/reportes" element={<ProtectedRoute><Reportes /></ProtectedRoute>} />
      <Route path="/pagos" element={<ProtectedRoute><Pagos /></ProtectedRoute>} />
      <Route path="/configuracion" element={<ProtectedRoute><Configuracion /></ProtectedRoute>} />

      {/* Rutas exclusivas Business (visibles pero con gate) */}
      <Route path="/devoluciones" element={<ProtectedRoute><BusinessGate featureName="Devoluciones y Reembolsos" featureDescription="Procesa devoluciones, gestiona reembolsos y genera créditos a favor de tus clientes automáticamente."><Devoluciones /></BusinessGate></ProtectedRoute>} />
      <Route path="/saldo-a-favor" element={<ProtectedRoute><BusinessGate featureName="Saldo a Favor" featureDescription="Visualiza y gestiona los créditos acumulados de tus clientes por devoluciones."><SaldoAFavor /></BusinessGate></ProtectedRoute>} />
      <Route path="/marca-agua" element={<ProtectedRoute><BusinessGate featureName="Marca de Agua Personalizada" featureDescription="Añade tu marca de agua personalizada a las imágenes de tus productos para proteger tu contenido."><MarcaAgua /></BusinessGate></ProtectedRoute>} />
      <Route path="/recomendaciones" element={<ProtectedRoute><BusinessGate featureName="Recomendaciones Inteligentes" featureDescription="Descubre qué productos recomendar a cada cliente y qué clientes son ideales para cada producto, con nuestro motor de IA."><SistemaRecomendaciones /></BusinessGate></ProtectedRoute>} />
      <Route path="/mi-tienda" element={<ProtectedRoute><BusinessGate featureName="Mi Tienda en Línea" featureDescription="Crea tu tienda online personalizada con tu marca, colores y productos. Tus clientes podrán ver tu catálogo y comprarte por WhatsApp."><MiTienda /></BusinessGate></ProtectedRoute>} />

      {/* 404 */}
      <Route path="*" element={<ProtectedRoute><div className="text-gray-500">Próximamente...</div></ProtectedRoute>} />
    </Routes>
  );
}

/** Wrapper para la página de planes (no necesita layout ni verificación de suscripción) */
function PlanesPage() {
  return <Planes />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <SubscriptionProvider>
          <AppContent />
        </SubscriptionProvider>
      </AuthProvider>
    </Router>
  );
}

function AppContent() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isExpired, loading: subLoading } = useSubscription();
  const location = useLocation();

  // Rutas que no necesitan layout
  const noLayoutRoutes = ['/login', '/planes', '/subscription/success', '/subscription/cancel'];
  const isNoLayoutRoute = noLayoutRoutes.some((r) => location.pathname.startsWith(r));

  // Landing page para usuarios no autenticados en la ruta raíz
  if (!isAuthenticated && !authLoading && location.pathname === '/') {
    return <LandingPage />;
  }

  // No mostrar layout en login
  if (location.pathname === '/login' || !isAuthenticated) {
    return <AppRoutes />;
  }

  // Loading
  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-6">
          <img src="/icons/stela-logo.png" alt="Stela" className="h-28 w-28 object-contain" />
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // Rutas sin layout (planes, success, cancel)
  if (isNoLayoutRoute) {
    return <AppRoutes />;
  }

  // Si la suscripción expiró, mostrar paywall (excepto en /planes y /configuracion)
  if (isExpired) {
    return (
      <Routes>
        <Route path="/planes" element={<ProtectedRoute><PlanesPage /></ProtectedRoute>} />
        <Route path="/configuracion" element={<Layout><Configuracion /></Layout>} />
        <Route path="/subscription/success" element={<ProtectedRoute><SubscriptionSuccess /></ProtectedRoute>} />
        <Route path="/subscription/cancel" element={<ProtectedRoute><SubscriptionCancel /></ProtectedRoute>} />
        <Route path="*" element={<SubscriptionWall />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <AppRoutes />
    </Layout>
  );
}

export default App;
