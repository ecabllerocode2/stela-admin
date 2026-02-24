import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../credenciales';
import { useAuth } from './AuthContext';

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'https://stela-backend.vercel.app').trim();

// ─── Tipos ──────────────────────────────────────────────────────────
export interface SubscriptionData {
  plan: 'emprendedor' | 'business' | null;
  status: 'active' | 'trialing' | 'canceled' | 'past_due' | 'incomplete' | null;
  currentPeriodEnd: any; // Firestore Timestamp
  trialEnd: any;
  cancelAtPeriodEnd: boolean;
  hasHadTrial: boolean;
  stripeSubscriptionId?: string | null;
}

export interface SubscriptionContextType {
  subscription: SubscriptionData | null;
  loading: boolean;
  /** true si el usuario tiene acceso (active o trialing) */
  isActive: boolean;
  /** true si está en período de prueba */
  isTrialing: boolean;
  /** Días restantes del trial (0 si no aplica) */
  trialDaysLeft: number;
  /** true si el trial ya expiró y no se suscribió */
  isExpired: boolean;
  /** true si el plan actual es 'business' O está en trial (trial = acceso business) */
  isBusiness: boolean;
  /** true si el plan actual es 'emprendedor' (y no trial) */
  isEmprendedor: boolean;
  /** Plan actual: 'emprendedor' | 'business' | null */
  currentPlan: 'emprendedor' | 'business' | null;
  /** Límites del plan actual */
  planLimits: PlanLimits;
  /** Abre Stripe Checkout para suscribirse */
  subscribe: (planId: 'emprendedor' | 'business') => Promise<void>;
  /** Abre el portal de Stripe para gestionar suscripción */
  openPortal: () => Promise<void>;
  /** Cancela la suscripción al final del período */
  cancelSubscription: () => Promise<void>;
  /** Cambia de plan (emprendedor ↔ business) */
  changePlan: (newPlanId: 'emprendedor' | 'business') => Promise<void>;
}

export interface PlanLimits {
  maxProducts: number;
  maxImagesPerVariant: number;
  maxAiDescriptions: number; // por mes, -1 = ilimitado
  hasAdvancedReports: boolean;
  hasRecommendations: boolean;
  hasOnlineStore: boolean;
  hasReturns: boolean;
  hasCreditBalance: boolean;
  hasPaymentHistory: boolean;
  hasReceipts: boolean;
  hasWatermark: boolean;
  hasAdvancedCRM: boolean;
  hasAdvancedInventory: boolean; // merma, regalos
  hasAdvancedDashboard: boolean;
}

export const PLAN_LIMITS: Record<'emprendedor' | 'business', PlanLimits> = {
  emprendedor: {
    maxProducts: 100,
    maxImagesPerVariant: 3,
    maxAiDescriptions: 10,
    hasAdvancedReports: false,
    hasRecommendations: false,
    hasOnlineStore: false,
    hasReturns: false,
    hasCreditBalance: false,
    hasPaymentHistory: false,
    hasReceipts: false,
    hasWatermark: false,
    hasAdvancedCRM: false,
    hasAdvancedInventory: false,
    hasAdvancedDashboard: false,
  },
  business: {
    maxProducts: 500,
    maxImagesPerVariant: 8,
    maxAiDescriptions: -1,
    hasAdvancedReports: true,
    hasRecommendations: true,
    hasOnlineStore: true,
    hasReturns: true,
    hasCreditBalance: true,
    hasPaymentHistory: true,
    hasReceipts: true,
    hasWatermark: true,
    hasAdvancedCRM: true,
    hasAdvancedInventory: true,
    hasAdvancedDashboard: true,
  },
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// ─── Provider ───────────────────────────────────────────────────────
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  // Escuchar cambios en la suscripción en Firestore (realtime)
  useEffect(() => {
    if (!user?.uid) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, 'subscriptions', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setSubscription({
            plan: data.plan || null,
            status: data.status || null,
            currentPeriodEnd: data.currentPeriodEnd || null,
            trialEnd: data.trialEnd || null,
            cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
            hasHadTrial: data.hasHadTrial || false,
            stripeSubscriptionId: data.stripeSubscriptionId || null,
          });
        } else {
          setSubscription(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error escuchando suscripción:', err);
        setLoading(false);
      }
    );

    return unsub;
  }, [user?.uid]);

  // ─── Cálculos derivados ─────────────────────────────────────────
  const isTrialing = subscription?.status === 'trialing';

  // Verificar si el trial local ha expirado (trialEnd ya pasó)
  const trialHasExpired = (() => {
    if (!isTrialing || !subscription?.trialEnd) return false;
    const trialEnd = subscription.trialEnd?.toDate
      ? subscription.trialEnd.toDate()
      : new Date(subscription.trialEnd);
    return new Date() >= trialEnd;
  })();

  // Si tiene stripeSubscriptionId, es una suscripción real de Stripe (no trial local)
  const hasRealSubscription = !!subscription?.stripeSubscriptionId;

  // isActive: tiene acceso si es active, o si es trialing y el trial no ha expirado
  const isActive =
    subscription?.status === 'active' ||
    (isTrialing && !trialHasExpired);

  const trialDaysLeft = (() => {
    if (!isTrialing || !subscription?.trialEnd || trialHasExpired) return 0;
    const trialEnd = subscription.trialEnd?.toDate
      ? subscription.trialEnd.toDate()
      : new Date(subscription.trialEnd);
    const now = new Date();
    const diff = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  })();

  const isExpired =
    !loading &&
    (!subscription ||
      subscription.status === 'canceled' ||
      subscription.status === 'past_due' ||
      subscription.status === 'incomplete' ||
      (isTrialing && trialHasExpired && !hasRealSubscription) ||
      (!isActive && subscription.hasHadTrial));

  // ─── Plan-level gating ──────────────────────────────────────────
  // Trial = acceso Business completo. Si no hay trial, usar plan real.
  const currentPlan: 'emprendedor' | 'business' | null =
    isTrialing && !trialHasExpired
      ? 'business' // trial = business completo
      : subscription?.plan || null;

  const isBusiness = currentPlan === 'business';
  const isEmprendedor = currentPlan === 'emprendedor';
  const planLimits = PLAN_LIMITS[currentPlan || 'emprendedor'];

  // ─── Helper para obtener headers autenticados ───────────────────
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!user) throw new Error('No autenticado');
    const token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }, [user]);

  // ─── Acciones ───────────────────────────────────────────────────
  const subscribe = useCallback(
    async (planId: 'emprendedor' | 'business') => {
      if (!user) throw new Error('No autenticado');
      const headers = await getAuthHeaders();

      const res = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          planId,
          userId: user.uid,
          email: user.email,
          displayName: user.displayName || user.email,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al crear sesión');
      window.location.href = data.url;
    },
    [user, getAuthHeaders]
  );

  const openPortal = useCallback(async () => {
    if (!user) throw new Error('No autenticado');
    const headers = await getAuthHeaders();

    const res = await fetch(`${BACKEND_URL}/api/create-portal-session`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: user.uid }),
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Error al crear portal');
    window.location.href = data.url;
  }, [user, getAuthHeaders]);

  const cancelSubscription = useCallback(async () => {
    if (!user) throw new Error('No autenticado');
    const headers = await getAuthHeaders();

    const res = await fetch(`${BACKEND_URL}/api/cancel-subscription`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: user.uid }),
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Error al cancelar');
  }, [user, getAuthHeaders]);

  const changePlan = useCallback(
    async (newPlanId: 'emprendedor' | 'business') => {
      if (!user) throw new Error('No autenticado');
      const headers = await getAuthHeaders();

      const res = await fetch(`${BACKEND_URL}/api/change-plan`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: user.uid, newPlanId }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al cambiar plan');
    },
    [user, getAuthHeaders]
  );

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        loading,
        isActive,
        isTrialing,
        trialDaysLeft,
        isExpired,
        isBusiness,
        isEmprendedor,
        currentPlan,
        planLimits,
        subscribe,
        openPortal,
        cancelSubscription,
        changePlan,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription debe usarse dentro de SubscriptionProvider');
  return ctx;
}
