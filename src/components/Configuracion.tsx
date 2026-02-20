import React, { useState } from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';
import {
  CreditCardIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const PLAN_DETAILS = {
  emprendedor: {
    name: 'Emprendedor',
    price: '$250',
    currency: 'MXN',
    features: ['Gestión de productos', 'Pedidos y entregas', 'Clientes', 'Reportes básicos'],
  },
  business: {
    name: 'Business',
    price: '$499',
    currency: 'MXN',
    features: [
      'Todo del plan Emprendedor',
      'Recomendaciones IA',
      'Reportes avanzados',
      'Marca de agua personalizada',
      'Soporte prioritario',
    ],
  },
};

const Configuracion: React.FC = () => {
  const { subscription, isTrialing, trialDaysLeft, changePlan, cancelSubscription, openPortal, subscribe } =
    useSubscription();
  const { user } = useAuth();

  const [changingPlan, setChangingPlan] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const currentPlan = subscription?.plan || null;
  const otherPlan: 'emprendedor' | 'business' = currentPlan === 'business' ? 'emprendedor' : 'business';

  const formatDate = (dateVal: any) => {
    if (!dateVal) return '—';
    const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const handleChangePlan = async () => {
    setChangingPlan(true);
    setFeedback(null);
    try {
      await changePlan(otherPlan);
      setFeedback({
        type: 'success',
        message: `Plan cambiado exitosamente a ${PLAN_DETAILS[otherPlan].name}.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al cambiar el plan.',
      });
    } finally {
      setChangingPlan(false);
    }
  };

  const handleCancel = async () => {
    setCanceling(true);
    setFeedback(null);
    try {
      await cancelSubscription();
      setShowCancelConfirm(false);
      setFeedback({
        type: 'success',
        message: 'Tu suscripción se cancelará al final del período de facturación actual.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al cancelar la suscripción.',
      });
    } finally {
      setCanceling(false);
    }
  };

  const handleReactivate = async () => {
    setChangingPlan(true);
    setFeedback(null);
    try {
      // Reactivar es básicamente cambiar al mismo plan (que quita cancel_at_period_end)
      if (currentPlan) {
        await changePlan(currentPlan);
        setFeedback({ type: 'success', message: 'Suscripción reactivada exitosamente.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al reactivar.' });
    } finally {
      setChangingPlan(false);
    }
  };

  const handleSubscribe = async (planId: 'emprendedor' | 'business') => {
    try {
      await subscribe(planId);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al iniciar suscripción.' });
    }
  };

  // Si no tiene suscripción real (solo trial o expirado)
  if (!subscription?.stripeSubscriptionId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="text-gray-500 mt-1">Gestiona tu cuenta y suscripción</p>
        </div>

        {/* Info de cuenta */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cuenta</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Nombre:</span>
              <p className="font-medium text-gray-900">{user?.displayName || '—'}</p>
            </div>
            <div>
              <span className="text-gray-500">Email:</span>
              <p className="font-medium text-gray-900">{user?.email || '—'}</p>
            </div>
          </div>
        </div>

        {/* Suscripción - no activa */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCardIcon className="h-5 w-5 text-gray-400" />
            Suscripción
          </h2>

          {isTrialing && (
            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <p className="text-blue-800 font-medium">Período de prueba</p>
              <p className="text-blue-600 text-sm mt-1">
                Te quedan {trialDaysLeft} día{trialDaysLeft !== 1 ? 's' : ''} de prueba gratuita.
              </p>
            </div>
          )}

          <p className="text-gray-600 mb-4">No tienes una suscripción activa. Elige un plan para continuar:</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['emprendedor', 'business'] as const).map((planId) => {
              const plan = PLAN_DETAILS[planId];
              return (
                <div key={planId} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                  <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {plan.price} <span className="text-sm font-normal text-gray-500">{plan.currency}/mes</span>
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-gray-600">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-1.5">
                        <CheckCircleIcon className="h-4 w-4 text-green-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleSubscribe(planId)}
                    className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Suscribirme
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Suscripción activa
  const plan = currentPlan ? PLAN_DETAILS[currentPlan] : null;
  const otherPlanDetails = PLAN_DETAILS[otherPlan];
  const isUpgrade = otherPlan === 'business';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 mt-1">Gestiona tu cuenta y suscripción</p>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`rounded-lg p-4 flex items-start gap-3 ${
            feedback.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircleIcon className="h-5 w-5 shrink-0 mt-0.5" />
          ) : (
            <ExclamationTriangleIcon className="h-5 w-5 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium">{feedback.message}</p>
          </div>
          <button onClick={() => setFeedback(null)} className="shrink-0">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Info de cuenta */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cuenta</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Nombre:</span>
            <p className="font-medium text-gray-900">{user?.displayName || '—'}</p>
          </div>
          <div>
            <span className="text-gray-500">Email:</span>
            <p className="font-medium text-gray-900">{user?.email || '—'}</p>
          </div>
        </div>
      </div>

      {/* Suscripción actual */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CreditCardIcon className="h-5 w-5 text-gray-400" />
          Suscripción
        </h2>

        {/* Estado actual */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900">
                Plan {plan?.name || currentPlan}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  subscription.cancelAtPeriodEnd
                    ? 'bg-amber-100 text-amber-800'
                    : subscription.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : subscription.status === 'trialing'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {subscription.cancelAtPeriodEnd
                  ? 'Cancelación pendiente'
                  : subscription.status === 'active'
                  ? 'Activo'
                  : subscription.status === 'trialing'
                  ? 'Prueba'
                  : subscription.status || 'Desconocido'}
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-1">
              {plan?.price} {plan?.currency}/mes
            </p>
          </div>
          <div className="text-sm text-gray-500 text-right">
            <p>Próximo cobro: {formatDate(subscription.currentPeriodEnd)}</p>
            {subscription.cancelAtPeriodEnd && (
              <p className="text-amber-600 font-medium mt-1">
                Se cancelará el {formatDate(subscription.currentPeriodEnd)}
              </p>
            )}
          </div>
        </div>

        {/* Cambiar plan */}
        <div className="border border-gray-200 rounded-lg p-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <ArrowPathIcon className="h-4 w-4 text-gray-400" />
                {isUpgrade ? 'Mejorar' : 'Cambiar'} a Plan {otherPlanDetails.name}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {otherPlanDetails.price} {otherPlanDetails.currency}/mes
                {isUpgrade
                  ? ' — Accede a más funcionalidades'
                  : ' — Ahorra con el plan básico'}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-gray-500">
                {otherPlanDetails.features.slice(0, 3).map((f) => (
                  <li key={f} className="flex items-center gap-1">
                    <CheckCircleIcon className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={handleChangePlan}
              disabled={changingPlan}
              className={`shrink-0 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                isUpgrade
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
              }`}
            >
              {changingPlan ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Cambiando...
                </span>
              ) : isUpgrade ? (
                `Mejorar a ${otherPlanDetails.name}`
              ) : (
                `Cambiar a ${otherPlanDetails.name}`
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            El cambio se aplica inmediatamente con prorrateo. Se ajustará el monto en tu próxima factura.
          </p>
        </div>

        {/* Reactivar o Cancelar */}
        {subscription.cancelAtPeriodEnd ? (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-medium text-amber-900">Cancelación pendiente</h3>
                <p className="text-sm text-amber-700 mt-1">
                  Tu suscripción se cancelará el {formatDate(subscription.currentPeriodEnd)}.
                  Puedes reactivarla en cualquier momento.
                </p>
              </div>
              <button
                onClick={handleReactivate}
                disabled={changingPlan}
                className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {changingPlan ? 'Reactivando...' : 'Reactivar suscripción'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {!showCancelConfirm ? (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
              >
                Cancelar suscripción
              </button>
            ) : (
              <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                <h3 className="font-medium text-red-900 mb-2">¿Estás seguro?</h3>
                <p className="text-sm text-red-700 mb-4">
                  Tu suscripción se mantendrá activa hasta el final del período de facturación actual
                  ({formatDate(subscription.currentPeriodEnd)}). Después de eso, perderás acceso a las funcionalidades.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    disabled={canceling}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {canceling ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Cancelando...
                      </span>
                    ) : (
                      'Sí, cancelar'
                    )}
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 transition-colors"
                  >
                    No, conservar mi plan
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Gestionar en Stripe */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={openPortal}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            Gestionar métodos de pago e historial de facturas →
          </button>
        </div>
      </div>
    </div>
  );
};

export default Configuracion;
