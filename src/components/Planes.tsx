import React, { useState } from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';
import {
  CheckIcon,
  SparklesIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

const PLANS = [
  {
    id: 'emprendedor' as const,
    name: 'Emprendedor',
    price: 250,
    description: 'Ideal para quienes inician su negocio',
    features: [
      'Gestión de productos',
      'Control de inventario',
      'Registro de clientes',
      'Órdenes y pedidos',
      'Reportes básicos',
    ],
    popular: false,
  },
  {
    id: 'business' as const,
    name: 'Business',
    price: 499,
    description: 'Para negocios en crecimiento',
    features: [
      'Todo lo del plan Emprendedor',
      'Entregas y logística',
      'Pagos y finanzas',
      'Saldo a favor de clientes',
      'Sistema de recomendaciones IA',
      'Marca de agua personalizada',
      'Reportes avanzados',
      'Soporte prioritario',
    ],
    popular: true,
  },
];

const Planes: React.FC = () => {
  const { subscription, subscribe, openPortal, isActive, isTrialing } = useSubscription();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSubscribe = async (planId: 'emprendedor' | 'business') => {
    setError('');
    setLoadingPlan(planId);
    try {
      await subscribe(planId);
    } catch (err: any) {
      setError(err.message || 'Error al procesar la suscripción');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManage = async () => {
    setError('');
    setLoadingPlan('portal');
    try {
      await openPortal();
    } catch (err: any) {
      setError(err.message || 'Error al abrir el portal');
    } finally {
      setLoadingPlan(null);
    }
  };

  const currentPlan = subscription?.plan;
  const hasActiveSub = isActive && !isTrialing;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          {isActive && (
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Volver al Dashboard
            </button>
          )}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Elige tu plan
          </h1>
          <p className="text-gray-500 max-w-md mx-auto">
            Selecciona el plan que mejor se adapte a las necesidades de tu negocio.
            {isTrialing && ' Tu prueba gratuita está activa.'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="max-w-md mx-auto mb-6 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">⚠️ {error}</p>
          </div>
        )}

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id && hasActiveSub;
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-sm border-2 p-6 flex flex-col ${
                  plan.popular
                    ? 'border-blue-500 ring-1 ring-blue-500'
                    : 'border-gray-200'
                }`}
              >
                {/* Badge popular */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <SparklesIcon className="h-3.5 w-3.5" />
                    Más Popular
                  </div>
                )}

                {/* Plan info */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{plan.name}</h3>
                  <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                    <span className="text-gray-500 text-sm">MXN/mes</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent ? (
                  <button
                    onClick={handleManage}
                    disabled={loadingPlan === 'portal'}
                    className="w-full py-2.5 px-4 rounded-lg font-semibold border-2 border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    {loadingPlan === 'portal' ? 'Abriendo...' : 'Gestionar Suscripción'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={!!loadingPlan}
                    className={`w-full py-2.5 px-4 rounded-lg font-semibold text-white transition-colors ${
                      plan.popular
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-gray-800 hover:bg-gray-900'
                    } ${loadingPlan ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {loadingPlan === plan.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Procesando...
                      </span>
                    ) : hasActiveSub ? (
                      'Cambiar a este plan'
                    ) : (
                      'Suscribirme'
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="text-center mt-10 space-y-2">
          <p className="text-sm text-gray-500">
            Todos los precios son en pesos mexicanos (MXN) e incluyen IVA.
          </p>
          <p className="text-sm text-gray-500">
            Puedes cancelar en cualquier momento. Sin contratos a largo plazo.
          </p>
          {hasActiveSub && (
            <button
              onClick={handleManage}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Administrar método de pago y facturación →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Planes;
