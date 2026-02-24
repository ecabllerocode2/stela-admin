import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  CubeIcon,
  ShoppingCartIcon,
  ChartBarIcon,
  UserGroupIcon,
  SparklesIcon,
  GlobeAltIcon,
  ArchiveBoxIcon,
  CurrencyDollarIcon,
  PhotoIcon,
  ArrowRightIcon,
  CheckIcon,
  XMarkIcon,
  DevicePhoneMobileIcon,
  BoltIcon,
  ShieldCheckIcon,
  ClockIcon,
  TruckIcon,
  ArrowTrendingUpIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';

/* ------------------------------------------------------------------ */
/*  Animated counter hook                                              */
/* ------------------------------------------------------------------ */
function useCountUp(end: number, duration = 2000, start = 0) {
  const [value, setValue] = useState(start);
  const ref = useRef<HTMLSpanElement>(null);
  const counted = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !counted.current) {
          counted.current = true;
          const startTime = performance.now();
          const tick = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(start + (end - start) * eased));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [end, duration, start]);

  return { value, ref };
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */
const features = [
  {
    icon: CubeIcon,
    title: 'Catálogo de Productos',
    desc: 'Gestiona cientos de productos con variantes de color, talla, imágenes múltiples y SKU automático. Todo organizado para vender más rápido.',
    color: 'blue',
  },
  {
    icon: ShoppingCartIcon,
    title: 'Órdenes y Pedidos',
    desc: 'Crea pedidos al instante, selecciona productos, aplica descuentos y envía notas de venta por WhatsApp a tus clientes.',
    color: 'emerald',
  },
  {
    icon: UserGroupIcon,
    title: 'CRM de Clientes',
    desc: 'Historial de compras, clasificación VIP, perfil de consumo con IA, tallas frecuentes y colores favoritos por cliente.',
    color: 'violet',
  },
  {
    icon: ArchiveBoxIcon,
    title: 'Inventario en Tiempo Real',
    desc: 'Stock actualizado automáticamente con cada venta. Registra mermas, regalos y movimientos con trazabilidad total.',
    color: 'amber',
  },
  {
    icon: CurrencyDollarIcon,
    title: 'Cobranza y Pagos',
    desc: 'Controla cuentas por cobrar, registra abonos parciales, genera recibos de pago y visualiza morosidad por cliente.',
    color: 'rose',
  },
  {
    icon: ChartBarIcon,
    title: 'Reportes y Analíticas',
    desc: 'Dashboards de ventas, finanzas, operaciones y clientes. Exporta a CSV y toma decisiones basadas en datos reales.',
    color: 'cyan',
  },
  {
    icon: TruckIcon,
    title: 'Entregas y Logística',
    desc: 'Organiza entregas por fecha, lugar y estado. Tus clientes saben exactamente cuándo recibirán su pedido.',
    color: 'orange',
  },
  {
    icon: SparklesIcon,
    title: 'Recomendaciones con IA',
    desc: 'Nuestro motor inteligente sugiere qué productos recomendar a cada cliente basándose en su historial de compra.',
    color: 'purple',
  },
  {
    icon: GlobeAltIcon,
    title: 'Tu Tienda en Línea',
    desc: 'Obtén tu propia tienda web con tu marca, tus colores y tu catálogo. Tus clientes te compran por WhatsApp.',
    color: 'teal',
  },
  {
    icon: PhotoIcon,
    title: 'Marca de Agua',
    desc: 'Protege las imágenes de tus productos con tu logo como marca de agua, listas para compartir en redes.',
    color: 'pink',
  },
  {
    icon: DevicePhoneMobileIcon,
    title: '100% Mobile-First',
    desc: 'Diseñada para funcionar perfectamente en tu teléfono. Gestiona tu negocio desde cualquier lugar.',
    color: 'indigo',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Datos Seguros',
    desc: 'Tu información vive en la nube con Firebase, con respaldo automático y acceso exclusivo a tu cuenta.',
    color: 'slate',
  },
];

const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', ring: 'ring-blue-200' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', ring: 'ring-emerald-200' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-600', ring: 'ring-violet-200' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600', ring: 'ring-amber-200' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-600', ring: 'ring-rose-200' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600', ring: 'ring-cyan-200' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-600', ring: 'ring-orange-200' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', ring: 'ring-purple-200' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-600', ring: 'ring-teal-200' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-600', ring: 'ring-pink-200' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', ring: 'ring-indigo-200' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-200' },
};

const emprendedorFeatures = [
  { text: 'Hasta 100 productos', included: true },
  { text: '3 imágenes por variante', included: true },
  { text: 'Órdenes y pedidos ilimitados', included: true },
  { text: 'CRM básico de clientes', included: true },
  { text: 'Inventario en tiempo real', included: true },
  { text: 'Entregas y logística', included: true },
  { text: 'Compras a proveedores', included: true },
  { text: 'Cobranza básica', included: true },
  { text: 'Dashboard con KPIs esenciales', included: true },
  { text: 'Reporte general', included: true },
  { text: 'Reportes avanzados (Finanzas, Operaciones, Clientes)', included: false },
  { text: 'Recomendaciones con IA', included: false },
  { text: 'Tu tienda en línea', included: false },
  { text: 'Marca de agua personalizada', included: false },
  { text: 'Historial y recibos de pago', included: false },
];

const businessFeatures = [
  { text: 'Hasta 500 productos', included: true },
  { text: '8 imágenes por variante', included: true },
  { text: 'Órdenes y pedidos ilimitados', included: true },
  { text: 'CRM avanzado con perfiles de IA', included: true },
  { text: 'Inventario con mermas y regalos', included: true },
  { text: 'Entregas y logística', included: true },
  { text: 'Compras a proveedores', included: true },
  { text: 'Cobranza avanzada + historial', included: true },
  { text: 'Dashboard completo (todos los KPIs)', included: true },
  { text: 'Reportes avanzados (Finanzas, Operaciones, Clientes)', included: true },
  { text: 'Recomendaciones con IA', included: true },
  { text: 'Tu tienda en línea con tu marca', included: true },
  { text: 'Marca de agua personalizada', included: true },
  { text: 'Devoluciones y saldo a favor', included: true },
  { text: 'Historial y recibos de pago', included: true },
];

const testimonials = [
  {
    quote: 'Antes llevaba todo en libretas y WhatsApp. Con Stela organicé mi inventario de 200 prendas en una tarde.',
    name: 'Mariana R.',
    role: 'Boutique de ropa femenina',
  },
  {
    quote: 'Los reportes me ayudaron a darme cuenta de qué productos vender más y cuáles ya no recomprar. Mis ventas subieron un 30%.',
    name: 'Andrea L.',
    role: 'Showroom de moda',
  },
  {
    quote: 'Mis clientas ahora ven el catálogo en mi tienda en línea y me piden por WhatsApp. Todo automatizado.',
    name: 'Sofía G.',
    role: 'Venta por redes sociales',
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
const LandingPage: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const stat1 = useCountUp(100, 2000);
  const stat2 = useCountUp(500, 2000);
  const stat3 = useCountUp(15, 1500);

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">

      {/* ==================== NAVBAR ==================== */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-lg border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/icons/stela-logo.png" alt="Stela" className="h-9 w-9 object-contain" />
            <span className="text-2xl font-quicksand font-bold tracking-tight">Stela</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#funcionalidades" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Funcionalidades</a>
            <a href="#precios" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Precios</a>
            <a href="#testimonios" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Testimonios</a>
            <Link
              to="/login"
              className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              Iniciar Sesión
            </Link>
            <Link
              to="/login?register=1"
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm shadow-blue-200"
            >
              Prueba Gratis
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-gray-600">
            <Bars3Icon className="h-6 w-6" />
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3 shadow-lg">
            <a href="#funcionalidades" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-gray-700">Funcionalidades</a>
            <a href="#precios" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-gray-700">Precios</a>
            <a href="#testimonios" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-gray-700">Testimonios</a>
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-gray-700">Iniciar Sesión</Link>
            <Link
              to="/login?register=1"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-center bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
            >
              Prueba Gratis 15 Días
            </Link>
          </div>
        )}
      </nav>

      {/* ==================== HERO ==================== */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-pulse" style={{ animationDelay: '2s' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-6 border border-blue-100">
            <BoltIcon className="h-3.5 w-3.5" />
            Plataforma #1 para boutiques y marcas de ropa en México
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
            <span className="block">Tu negocio de moda,</span>
            <span className="block bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
              completamente organizado
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-gray-600 leading-relaxed mb-10">
            Inventario, ventas, clientes, entregas, cobranza y reportes. <br className="hidden sm:block" />
            Todo lo que necesitas para{' '}
            <strong className="text-gray-900">vender más y preocuparte menos</strong>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              to="/login?register=1"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-base font-bold px-8 py-4 rounded-2xl transition-all shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5"
            >
              Comienza Gratis — 15 días
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
            <a
              href="#funcionalidades"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-gray-700 text-base font-semibold px-8 py-4 rounded-2xl border border-gray-200 hover:border-gray-300 transition-all hover:shadow-md"
            >
              Ver funcionalidades
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 max-w-lg mx-auto gap-6">
            <div className="text-center">
              <p className="text-3xl sm:text-4xl font-extrabold text-gray-900">
                <span ref={stat1.ref}>{stat1.value}</span>+
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">Productos gestionados</p>
            </div>
            <div className="text-center">
              <p className="text-3xl sm:text-4xl font-extrabold text-gray-900">
                <span ref={stat2.ref}>{stat2.value}</span>+
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">Pedidos procesados</p>
            </div>
            <div className="text-center">
              <p className="text-3xl sm:text-4xl font-extrabold text-gray-900">
                <span ref={stat3.ref}>{stat3.value}</span>
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">Días de prueba gratis</p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== PROBLEM / SOLUTION ==================== */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Problem */}
            <div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-6 leading-tight">
                ¿Sigues llevando tu negocio en{' '}
                <span className="line-through decoration-red-400 decoration-4">libretas y WhatsApp</span>?
              </h2>
              <div className="space-y-4">
                {[
                  'No sabes exactamente cuánto inventario tienes',
                  'Los clientes te preguntan y no encuentras la info',
                  'No sabes cuánto te deben ni quién lleva más tiempo sin pagar',
                  'Pierdes tiempo creando notas de venta a mano',
                  'No tienes un catálogo profesional para compartir',
                ].map((problem) => (
                  <div key={problem} className="flex items-start gap-3">
                    <XMarkIcon className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-gray-700">{problem}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Solution */}
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
              <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-5 border border-green-100">
                <CheckIcon className="h-3.5 w-3.5" />
                Con Stela, todo cambia
              </div>
              <div className="space-y-4">
                {[
                  'Inventario actualizado en automático con cada venta',
                  'Perfil de cada cliente con historial, tallas y preferencias',
                  'Cuentas por cobrar con días de atraso y alertas',
                  'Notas de venta generadas al instante, listas para WhatsApp',
                  'Tu tienda en línea con tu marca, sin saber programar',
                ].map((solution) => (
                  <div key={solution} className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center mt-0.5 shrink-0">
                      <CheckIcon className="h-3 w-3 text-green-600" />
                    </div>
                    <p className="text-gray-700 font-medium">{solution}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FEATURES ==================== */}
      <section id="funcionalidades" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
              Todo lo que necesitas, en un solo lugar
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Más de 12 módulos diseñados específicamente para negocios de ropa y moda.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => {
              const c = colorMap[f.color] || colorMap.blue;
              return (
                <div
                  key={f.title}
                  className="group relative bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300"
                >
                  <div className={`inline-flex items-center justify-center h-12 w-12 rounded-xl ${c.bg} ${c.text} ring-4 ${c.ring} mb-4`}>
                    <f.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================== HOW IT WORKS ==================== */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
            Empieza en minutos, no en semanas
          </h2>
          <p className="text-lg text-gray-500 mb-14 max-w-xl mx-auto">
            Sin instalaciones, sin contratos. Solo crea tu cuenta y comienza.
          </p>

          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                icon: UserGroupIcon,
                title: 'Crea tu cuenta',
                desc: 'Regístrate con tu correo en menos de 1 minuto. Obtienes 15 días gratis con TODAS las funcionalidades.',
              },
              {
                step: '2',
                icon: CubeIcon,
                title: 'Sube tu inventario',
                desc: 'Añade tus productos con fotos, colores, tallas y precios. Organiza tu catálogo en minutos.',
              },
              {
                step: '3',
                icon: ArrowTrendingUpIcon,
                title: 'Vende y crece',
                desc: 'Crea pedidos, controla pagos, envía notas por WhatsApp y mira tus reportes crecer.',
              },
            ].map((step) => (
              <div key={step.step} className="flex flex-col items-center text-center">
                <div className="relative mb-5">
                  <div className="h-16 w-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                    <step.icon className="h-8 w-8 text-white" />
                  </div>
                  <span className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center text-xs font-bold text-blue-600">
                    {step.step}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== PRICING ==================== */}
      <section id="precios" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
              Planes simples, sin letras chiquitas
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              Elige el plan que se ajuste a tu etapa. Siempre puedes crecer.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Emprendedor */}
            <div className="relative bg-white rounded-3xl border border-gray-200 p-8 flex flex-col">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900">Emprendedor</h3>
                <p className="text-sm text-gray-500 mt-1">Para negocios que están comenzando</p>
              </div>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-5xl font-extrabold text-gray-900">$250</span>
                <span className="text-gray-500 font-medium">/mes MXN</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {emprendedorFeatures.map((f) => (
                  <li key={f.text} className="flex items-start gap-2.5">
                    {f.included ? (
                      <CheckIcon className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <XMarkIcon className="h-5 w-5 text-gray-300 shrink-0 mt-0.5" />
                    )}
                    <span className={f.included ? 'text-sm text-gray-700' : 'text-sm text-gray-400'}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                to="/login?register=1"
                className="w-full text-center py-3.5 px-6 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:border-blue-400 hover:text-blue-600 transition-all"
              >
                Comenzar Prueba Gratis
              </Link>
            </div>

            {/* Business */}
            <div className="relative bg-gradient-to-b from-blue-600 to-blue-700 rounded-3xl p-8 text-white flex flex-col shadow-2xl shadow-blue-200">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-amber-400 text-amber-900 text-xs font-bold px-4 py-1 rounded-full shadow-md uppercase tracking-wider">
                  Más popular
                </span>
              </div>
              <div className="mb-6">
                <h3 className="text-xl font-bold">Business</h3>
                <p className="text-sm text-blue-200 mt-1">Para negocios que quieren crecer</p>
              </div>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-5xl font-extrabold">$499</span>
                <span className="text-blue-200 font-medium">/mes MXN</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {businessFeatures.map((f) => (
                  <li key={f.text} className="flex items-start gap-2.5">
                    <CheckIcon className="h-5 w-5 text-blue-300 shrink-0 mt-0.5" />
                    <span className="text-sm text-blue-50">{f.text}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/login?register=1"
                className="w-full text-center py-3.5 px-6 rounded-xl bg-white text-blue-700 font-bold hover:bg-blue-50 transition-all shadow-md"
              >
                Comenzar Prueba Gratis
              </Link>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 mt-8">
            <ClockIcon className="inline h-4 w-4 mr-1 -mt-0.5" />
            Ambos planes incluyen 15 días gratis con acceso completo al plan Business. Sin tarjeta de crédito.
          </p>
        </div>
      </section>

      {/* ==================== TESTIMONIALS ==================== */}
      <section id="testimonios" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
              Lo que dicen nuestras usuarias
            </h2>
            <p className="text-lg text-gray-500">
              Negocios reales, resultados reales.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col"
              >
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <svg key={s} className="h-5 w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed flex-1 italic">"{t.quote}"</p>
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <p className="text-sm font-bold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== FINAL CTA ==================== */}
      <section className="py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA3KSIvPjwvc3ZnPg==')] opacity-50" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-6 leading-tight">
            ¿Lista para organizar tu negocio <br className="hidden sm:block" /> y vender más?
          </h2>
          <p className="text-lg text-blue-100 mb-10 max-w-xl mx-auto">
            Únete a emprendedoras que ya están creciendo con Stela. 15 días gratis, sin compromisos.
          </p>
          <Link
            to="/login?register=1"
            className="inline-flex items-center gap-2 bg-white text-blue-700 text-lg font-bold px-10 py-4 rounded-2xl hover:bg-blue-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
          >
            Crear mi cuenta gratis
            <ArrowRightIcon className="h-5 w-5" />
          </Link>
          <p className="text-sm text-blue-200 mt-5">
            Sin tarjeta de crédito · Configuración en 1 minuto · Cancela cuando quieras
          </p>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src="/icons/stela-logo.png" alt="Stela" className="h-8 w-8 object-contain brightness-200" />
              <span className="text-xl font-quicksand font-bold text-white">Stela</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</a>
              <a href="#precios" className="hover:text-white transition-colors">Precios</a>
              <Link to="/login" className="hover:text-white transition-colors">Iniciar Sesión</Link>
            </div>
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} Stela. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
