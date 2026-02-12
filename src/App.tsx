import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';

import {
  HomeIcon,
  CubeIcon,
  ShoppingCartIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  Bars3Icon,
  BellIcon,
  MagnifyingGlassIcon,
  TruckIcon,
  UserIcon,
  ArchiveBoxIcon,
  PhotoIcon,
  ArrowLeftOnRectangleIcon,
  ArrowPathIcon,
  SparklesIcon
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
import SaldoAFavor from './components/SaldoAFavor';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Reportes from './components/Reportes';
import SistemaRecomendaciones from './components/SistemaRecomendaciones';




// --- Configuración del Menú Lateral  ---
const menuItems = [
  { name: 'Dashboard', path: '/', icon: HomeIcon },
  { name: 'Ordenes', path: '/pedidos', icon: ShoppingCartIcon },
  { name: 'Clientes', path: '/clientes', icon: UserIcon },
  { name: 'Recomendaciones', path: '/recomendaciones', icon: SparklesIcon },
  { name: 'Entregas', path: '/entregas', icon: TruckIcon },
  { name: 'Devoluciones', path: '/devoluciones', icon: ArrowPathIcon },
  { name: 'Saldo a Favor', path: '/saldo-a-favor', icon: CurrencyDollarIcon },
  { name: 'Productos', path: '/productos', icon: CubeIcon },
  { name: 'Inventario', path: '/inventario', icon: ArchiveBoxIcon },
  { name: 'Marca de Agua', path: '/marca-agua', icon: PhotoIcon },
  { name: 'Compras', path: '/compras', icon: TruckIcon },
  { name: 'Pagos', path: '/pagos', icon: CurrencyDollarIcon },
  { name: 'Reportes', path: '/reportes', icon: ChartBarIcon },
  { name: 'Configuración', path: '/configuracion', icon: Cog6ToothIcon },
];

function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    // Fondo app: gray-50 "Ligero, evita fatiga visual" 
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">

      {/* --- 1. Topbar (Siempre visible) [cite: 20] --- */}
      <header className="bg-white border-b border-gray-200 h-16 fixed w-full top-0 z-20 flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          {/* Botón menú móvil */}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 text-gray-500">
            <Bars3Icon className="h-6 w-6" />
          </button>
          {/* Logo STELA Mini */}
          <div className="flex items-center gap-2">
            <div className="h-12 w-12 rounded-lg flex items-center justify-center bg-white text-gray-900 font-bold text-lg shadow">
              STELA
            </div>
          </div>
          {/* Indicador de rol [cite: 22] */}
          <span className="hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Operaciones
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Botón de búsqueda global [cite: 23] */}
          <div className="relative hidden md:block">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 w-64" // [cite: 160]
            />
          </div>
          {/* Botón de notificaciones [cite: 24] */}
          <button className="p-2 text-gray-400 hover:text-gray-500 relative">
            <BellIcon className="h-6 w-6" />
            <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          </button>
          {/* Usuario y Logout */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-700">{user?.email}</p>
              <p className="text-xs text-gray-500">Administrador</p>
            </div>
            {/* Avatar */}
            <div className="h-8 w-8 rounded-full bg-blue-600 border border-blue-700 flex items-center justify-center text-white text-sm font-bold">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            {/* Botón Logout */}
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

      {/* --- 2. Sidebar (Fija desktop / Drawer móvil)  --- */}
      <aside className={`
        fixed inset-y-0 left-0 z-10 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out pt-20 pb-4 overflow-y-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 lg:block
      `}>
        <nav className="px-4 space-y-1 mt-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setSidebarOpen(false)} // Cerrar en móvil al clickear
                className={`
                  flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors
                  ${isActive
                    ? 'bg-blue-50 text-blue-700' // Estado activo
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'} // Estado normal [cite: 166]
                `}
              >
                <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* --- 3. Zona de contenido [cite: 44] --- */}
      <main className="lg:pl-64 pt-16 transition-all duration-200">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {/* Aquí se renderizarán las pantallas */}
          {children}
        </div>
      </main>

      {/* Overlay para móvil cuando el sidebar está abierto */}
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
      {/* Ruta pública de login */}
      <Route path="/login" element={<Login />} />
      
      {/* Rutas protegidas */}
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/productos" element={<ProtectedRoute><Productos /></ProtectedRoute>} />
      <Route path="/productos/crear" element={<ProtectedRoute><CrearEditarProducto /></ProtectedRoute>} />
      <Route path="/productos/editar/:id" element={<ProtectedRoute><CrearEditarProducto /></ProtectedRoute>} />
      <Route path="/pedidos" element={<ProtectedRoute><Pedidos /></ProtectedRoute>} />
      <Route path="/nuevo-pedido" element={<ProtectedRoute><NuevoPedido /></ProtectedRoute>} />
      <Route path="/pedidos/editar/:id" element={<ProtectedRoute><NuevoPedido /></ProtectedRoute>} />
      <Route path="/ordenes/editar/:id" element={<ProtectedRoute><NuevoPedido /></ProtectedRoute>} />
      <Route path="/entregas" element={<ProtectedRoute><Entregas /></ProtectedRoute>} />
      <Route path="/devoluciones" element={<ProtectedRoute><Devoluciones /></ProtectedRoute>} />
      <Route path="/saldo-a-favor" element={<ProtectedRoute><SaldoAFavor /></ProtectedRoute>} />
      <Route path="/inventario" element={<ProtectedRoute><Inventario /></ProtectedRoute>} />
      <Route path="/marca-agua" element={<ProtectedRoute><MarcaAgua /></ProtectedRoute>} />
      <Route path="/compras" element={<ProtectedRoute><Compras /></ProtectedRoute>} />
      <Route path="/pagos" element={<ProtectedRoute><Pagos /></ProtectedRoute>} />
      <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
      <Route path="/recomendaciones" element={<ProtectedRoute><SistemaRecomendaciones /></ProtectedRoute>} />
      <Route path="/reportes" element={<ProtectedRoute><Reportes /></ProtectedRoute>} />
      
      {/* Ruta 404 */}
      <Route path="*" element={<ProtectedRoute><div className="text-gray-500">Próximamente...</div></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // No mostrar layout en login
  if (location.pathname === '/login' || !isAuthenticated) {
    return <AppRoutes />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Layout>
      <AppRoutes />
    </Layout>
  );
}

export default App;