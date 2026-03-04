/**
 * StelaAdmin — Panel interno de marketing para el equipo Stela.
 * Solo accesible por el UID autorizado (STELA_ADMIN_UID).
 *
 * Muestra la lista de usuarios registrados con datos relevantes para
 * marketing: plan, productos cargados, teléfono, fecha de registro, etc.
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '../credenciales';
import { useAuth } from '../contexts/AuthContext';

// UID exclusivo con acceso a este panel
const STELA_ADMIN_UID = 'AMGV7yNH8Paw8LExLblWDK2s3gs1';

// ───── Tipos ─────────────────────────────────────────────
interface UserRow {
  uid: string;
  email: string;
  nombre: string;
  nombreNegocio: string;
  telefono: string;
  slug: string;
  createdAt: Date | null;
  // Subscription
  plan: string | null;
  status: string | null;
  trialEnd: Date | null;
  // Derived
  daysSinceRegistration: number;
  trialDaysLeft: number;
  productCount: number | null; // null = loading
  tiendaActiva: boolean;
}

type FilterKey = 'all' | 'trialing' | 'active' | 'expired' | 'no-products' | 'recent';

// ───── Helpers ───────────────────────────────────────────
function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function planLabel(plan: string | null, status: string | null): string {
  if (status === 'trialing') return 'Trial';
  if (plan === 'business') return 'Business';
  if (plan === 'emprendedor') return 'Emprendedor';
  if (status === 'canceled') return 'Cancelado';
  if (status === 'past_due') return 'Pago pendiente';
  return plan || 'Sin plan';
}

function planColor(plan: string | null, status: string | null): string {
  if (status === 'trialing') return 'bg-yellow-100 text-yellow-800';
  if (status === 'active' && plan === 'business') return 'bg-purple-100 text-purple-800';
  if (status === 'active' && plan === 'emprendedor') return 'bg-blue-100 text-blue-800';
  if (status === 'canceled' || status === 'past_due' || status === 'incomplete') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-600';
}

function buildWhatsAppUrl(phone: string, message: string): string {
  // Clean phone: remove spaces, dashes, etc. Keep + and digits
  const clean = phone.replace(/[^\d+]/g, '');
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

// ───── Plantillas de mensaje ─────────────────────────────
const MESSAGE_TEMPLATES: { label: string; template: (u: UserRow) => string }[] = [
  {
    label: '👋 Bienvenida',
    template: (u) =>
      `¡Hola${u.nombre ? ` ${u.nombre.split(' ')[0]}` : ''}! 👋 Soy del equipo de Stela. Vi que te registraste recientemente y quería darte la bienvenida. ¿Tienes alguna duda sobre cómo empezar? Estoy aquí para ayudarte 😊`,
  },
  {
    label: '📦 Ayuda con productos',
    template: (u) =>
      `¡Hola${u.nombre ? ` ${u.nombre.split(' ')[0]}` : ''}! 👋 Vi que te registraste en Stela hace unos días. ¿Necesitas ayuda para subir tus primeros productos? Te puedo guiar paso a paso, es muy fácil 🚀`,
  },
  {
    label: '⏰ Trial por vencer',
    template: (u) =>
      `¡Hola${u.nombre ? ` ${u.nombre.split(' ')[0]}` : ''}! Te escribo del equipo de Stela. Tu período de prueba está por terminar${u.trialDaysLeft > 0 ? ` (te quedan ${u.trialDaysLeft} días)` : ''}. ¿Te gustaría que te explique los planes disponibles para que no pierdas acceso? 💡`,
  },
  {
    label: '🎉 Seguimiento',
    template: (u) =>
      `¡Hola${u.nombre ? ` ${u.nombre.split(' ')[0]}` : ''}! ¿Cómo te ha ido con Stela? Quería saber si necesitas algo o si hay alguna funcionalidad que te gustaría que tuviéramos. Tu opinión nos ayuda mucho 🙌`,
  },
];

// ───── Componente principal ──────────────────────────────
export default function StelaAdmin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'createdAt' | 'daysSinceRegistration' | 'productCount' | 'plan'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // ── Guard: solo UID autorizado ──
  if (!user || user.uid !== STELA_ADMIN_UID) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Acceso denegado</h2>
          <p className="text-gray-500">No tienes permisos para ver esta página.</p>
        </div>
      </div>
    );
  }

  // ── Fetch data ──
  useEffect(() => {
    fetchAllUsers();
  }, []);

  async function fetchAllUsers() {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch all users
      const usersSnap = await getDocs(collection(db, 'users'));
      // 2. Fetch all subscriptions
      const subsSnap = await getDocs(collection(db, 'subscriptions'));

      const subsMap = new Map<string, any>();
      subsSnap.forEach((doc) => {
        subsMap.set(doc.id, doc.data());
      });

      const now = new Date();

      const rows: UserRow[] = usersSnap.docs.map((doc) => {
        const d = doc.data();
        const sub = subsMap.get(doc.id);
        const createdAt = toDate(d.createdAt);
        const trialEnd = toDate(sub?.trialEnd);
        const daysSinceRegistration = createdAt ? daysBetween(createdAt, now) : 0;
        const trialDaysLeft =
          trialEnd && sub?.status === 'trialing'
            ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
            : 0;

        return {
          uid: doc.id,
          email: d.email || '',
          nombre: d.nombre || '',
          nombreNegocio: d.nombreNegocio || '',
          telefono: d.telefono || '',
          slug: d.slug || '',
          createdAt,
          plan: sub?.plan || null,
          status: sub?.status || null,
          trialEnd,
          daysSinceRegistration,
          trialDaysLeft,
          productCount: null,
          tiendaActiva: d.tiendaActiva === true,
        };
      });

      setUsers(rows);

      // 3. Fetch product counts asynchronously (non-blocking per user)
      rows.forEach(async (row) => {
        try {
          const q = query(collection(db, 'productos_public'), where('userId', '==', row.uid));
          const countSnap = await getCountFromServer(q);
          setUsers((prev) => {
            const copy = [...prev];
            const target = copy.find((u) => u.uid === row.uid);
            if (target) target.productCount = countSnap.data().count;
            return copy;
          });
        } catch {
          // Silently set to 0 on error
          setUsers((prev) => {
            const copy = [...prev];
            const target = copy.find((u) => u.uid === row.uid);
            if (target) target.productCount = 0;
            return copy;
          });
        }
      });
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }

  // ── Filtering & Sorting ──
  const filtered = useMemo(() => {
    let list = [...users];

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.nombre.toLowerCase().includes(q) ||
          u.nombreNegocio.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.telefono.includes(q)
      );
    }

    // Filter
    switch (filter) {
      case 'trialing':
        list = list.filter((u) => u.status === 'trialing');
        break;
      case 'active':
        list = list.filter((u) => u.status === 'active');
        break;
      case 'expired':
        list = list.filter(
          (u) =>
            u.status === 'canceled' ||
            u.status === 'past_due' ||
            u.status === 'incomplete' ||
            (u.status === 'trialing' && u.trialDaysLeft === 0)
        );
        break;
      case 'no-products':
        list = list.filter((u) => u.productCount !== null && u.productCount === 0);
        break;
      case 'recent':
        list = list.filter((u) => u.daysSinceRegistration <= 7);
        break;
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'createdAt':
          cmp = (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
          break;
        case 'daysSinceRegistration':
          cmp = a.daysSinceRegistration - b.daysSinceRegistration;
          break;
        case 'productCount':
          cmp = (a.productCount ?? -1) - (b.productCount ?? -1);
          break;
        case 'plan':
          cmp = (a.plan || '').localeCompare(b.plan || '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [users, filter, search, sortField, sortDir]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = users.length;
    const trialing = users.filter((u) => u.status === 'trialing' && u.trialDaysLeft > 0).length;
    const activeEmprendedor = users.filter((u) => u.status === 'active' && u.plan === 'emprendedor').length;
    const activeBusiness = users.filter((u) => u.status === 'active' && u.plan === 'business').length;
    const expired = users.filter(
      (u) =>
        u.status === 'canceled' ||
        u.status === 'past_due' ||
        (u.status === 'trialing' && u.trialDaysLeft === 0)
    ).length;
    const noProducts = users.filter((u) => u.productCount !== null && u.productCount === 0).length;
    const recentNoProducts = users.filter(
      (u) => u.daysSinceRegistration >= 2 && u.daysSinceRegistration <= 5 && (u.productCount ?? 0) === 0
    ).length;
    const last7days = users.filter((u) => u.daysSinceRegistration <= 7).length;
    return { total, trialing, activeEmprendedor, activeBusiness, expired, noProducts, recentNoProducts, last7days };
  }, [users]);

  function toggleSort(field: typeof sortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  const SortIcon = ({ field }: { field: typeof sortField }) => (
    <span className="ml-1 text-xs opacity-60">
      {sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );

  // ── Render ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          <p className="text-gray-500">Cargando usuarios…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-red-700 mb-2">Error al cargar datos</h2>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={fetchAllUsers}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel de Marketing Stela</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gestión de usuarios y seguimiento para campañas de marketing &middot; {users.length} usuarios totales
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard label="Total" value={stats.total} color="gray" />
        <StatCard label="En Trial" value={stats.trialing} color="yellow" />
        <StatCard label="Emprendedor" value={stats.activeEmprendedor} color="blue" />
        <StatCard label="Business" value={stats.activeBusiness} color="purple" />
        <StatCard label="Expirados" value={stats.expired} color="red" />
        <StatCard label="Sin productos" value={stats.noProducts} color="orange" />
        <StatCard
          label="⚠️ Necesitan ayuda"
          value={stats.recentNoProducts}
          color="red"
          tooltip="Registrados hace 2-5 días sin productos"
        />
        <StatCard label="Últimos 7 días" value={stats.last7days} color="green" />
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex flex-wrap gap-2">
          {([
            ['all', 'Todos'],
            ['trialing', 'En Trial'],
            ['active', 'Activos'],
            ['expired', 'Expirados'],
            ['no-products', 'Sin productos'],
            ['recent', 'Recientes (7d)'],
          ] as [FilterKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${
                filter === key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Buscar por nombre, negocio, email o teléfono…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          onClick={fetchAllUsers}
          className="px-3 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg border border-gray-300 transition"
        >
          🔄 Actualizar
        </button>
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-400">
        Mostrando {filtered.length} de {users.length} usuarios
      </p>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Usuario
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                onClick={() => toggleSort('plan')}
              >
                Plan <SortIcon field="plan" />
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                onClick={() => toggleSort('productCount')}
              >
                Productos <SortIcon field="productCount" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Teléfono
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                onClick={() => toggleSort('createdAt')}
              >
                Registro <SortIcon field="createdAt" />
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                onClick={() => toggleSort('daysSinceRegistration')}
              >
                Días <SortIcon field="daysSinceRegistration" />
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Tienda
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">
                  No se encontraron usuarios con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <React.Fragment key={u.uid}>
                  <tr
                    className={`hover:bg-gray-50 transition cursor-pointer ${
                      needsAttention(u) ? 'bg-amber-50/50' : ''
                    }`}
                    onClick={() => setExpandedUser(expandedUser === u.uid ? null : u.uid)}
                  >
                    {/* User info */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold shrink-0">
                          {(u.nombre || u.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {u.nombre || u.email}
                          </p>
                          {u.nombreNegocio && (
                            <p className="text-xs text-gray-500 truncate">{u.nombreNegocio}</p>
                          )}
                          <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${planColor(
                          u.plan,
                          u.status
                        )}`}
                      >
                        {planLabel(u.plan, u.status)}
                      </span>
                      {u.status === 'trialing' && u.trialDaysLeft > 0 && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {u.trialDaysLeft}d restantes
                        </p>
                      )}
                      {u.status === 'trialing' && u.trialDaysLeft === 0 && (
                        <p className="text-[10px] text-red-500 mt-0.5 font-medium">Trial vencido</p>
                      )}
                    </td>

                    {/* Products */}
                    <td className="px-4 py-3 text-center">
                      {u.productCount === null ? (
                        <span className="inline-block h-4 w-8 bg-gray-200 rounded animate-pulse" />
                      ) : (
                        <span
                          className={`text-sm font-semibold ${
                            u.productCount === 0 ? 'text-red-500' : 'text-green-600'
                          }`}
                        >
                          {u.productCount}
                        </span>
                      )}
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-3">
                      {u.telefono ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-700">{u.telefono}</span>
                          <a
                            href={buildWhatsAppUrl(u.telefono, '')}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-green-500 hover:bg-green-600 text-white transition shrink-0"
                            title="Abrir WhatsApp"
                          >
                            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                            </svg>
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Sin teléfono</span>
                      )}
                    </td>

                    {/* Registration date */}
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {formatDate(u.createdAt)}
                    </td>

                    {/* Days since registration */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-sm font-medium ${
                          u.daysSinceRegistration <= 1
                            ? 'text-green-600'
                            : u.daysSinceRegistration <= 7
                            ? 'text-yellow-600'
                            : 'text-gray-500'
                        }`}
                      >
                        {u.daysSinceRegistration}d
                      </span>
                    </td>

                    {/* Tienda activa */}
                    <td className="px-4 py-3 text-center">
                      {u.tiendaActiva ? (
                        <span className="text-green-600 text-lg" title="Tienda activa">✓</span>
                      ) : (
                        <span className="text-gray-300 text-lg" title="Tienda inactiva">✗</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedUser(expandedUser === u.uid ? null : u.uid);
                        }}
                        className="text-xs px-2.5 py-1.5 rounded-md bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition font-medium"
                      >
                        💬 Mensajes
                      </button>
                    </td>
                  </tr>

                  {/* Expanded: WhatsApp templates */}
                  {expandedUser === u.uid && (
                    <tr>
                      <td colSpan={8} className="px-4 py-4 bg-gray-50 border-b border-gray-200">
                        <div className="max-w-3xl">
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">
                            Plantillas de WhatsApp para {u.nombre || u.email}
                          </p>
                          {!u.telefono ? (
                            <p className="text-sm text-red-500 italic">
                              Este usuario no tiene teléfono registrado. No se puede enviar WhatsApp.
                            </p>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {MESSAGE_TEMPLATES.map((tpl, i) => {
                                const msg = tpl.template(u);
                                return (
                                  <a
                                    key={i}
                                    href={buildWhatsAppUrl(u.telefono, msg)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:border-green-400 hover:shadow-sm transition group"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold text-gray-700 mb-1">
                                        {tpl.label}
                                      </p>
                                      <p className="text-xs text-gray-500 line-clamp-2">{msg}</p>
                                    </div>
                                    <span className="shrink-0 text-xs px-2 py-1 rounded bg-green-500 text-white font-medium group-hover:bg-green-600 transition">
                                      Enviar
                                    </span>
                                  </a>
                                );
                              })}
                            </div>
                          )}

                          {/* Quick info summary */}
                          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-400">
                            <span>UID: {u.uid}</span>
                            {u.slug && <span>Slug: {u.slug}</span>}
                            {u.slug && (
                              <a
                                href={`https://stela.shop/${u.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Ver tienda →
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ───── Sub-components ────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  tooltip,
}: {
  label: string;
  value: number;
  color: string;
  tooltip?: string;
}) {
  const colorMap: Record<string, string> = {
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    green: 'bg-green-50 border-green-200 text-green-700',
  };

  return (
    <div
      className={`rounded-xl border p-3 text-center ${colorMap[color] || colorMap.gray}`}
      title={tooltip}
    >
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wide mt-0.5 opacity-75">{label}</p>
    </div>
  );
}

/** Determina si un usuario necesita atención (highlight en la tabla) */
function needsAttention(u: UserRow): boolean {
  // Registrado hace 2+ días sin productos
  if (u.daysSinceRegistration >= 2 && (u.productCount ?? 0) === 0) return true;
  // Trial por vencer (3 días o menos)
  if (u.status === 'trialing' && u.trialDaysLeft > 0 && u.trialDaysLeft <= 3) return true;
  return false;
}
