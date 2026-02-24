import React, { useState } from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import {
  CheckIcon,
  SparklesIcon,
  ArrowLeftIcon,
  XMarkIcon,
  ArrowsRightLeftIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

const PLANS = [
  {
    id: 'emprendedor' as const,
    name: 'Emprendedor',
    price: 250,
    description: 'Ideal para quienes inician su negocio de moda',
    features: [
      { text: 'Hasta 100 productos', included: true },
      { text: '3 imágenes por variante', included: true },
      { text: '10 descripciones con IA al mes', included: true },
      { text: 'Pedidos y ventas', included: true },
      { text: 'Inventario (entrada de stock)', included: true },
      { text: 'CRM Clientes básico', included: true },
      { text: 'Compras a proveedores', included: true },
      { text: 'Entregas básicas', included: true },
      { text: 'Cuentas por cobrar básico', included: true },
      { text: 'Dashboard (4 KPIs esenciales)', included: true },
      { text: 'Reportes básicos (vista general)', included: true },
      { text: 'Inventario avanzado (merma/regalos)', included: false },
      { text: 'Devoluciones y reembolsos', included: false },
      { text: 'Saldo a favor de clientes', included: false },
      { text: 'Recibos y resúmenes PDF', included: false },
      { text: 'CRM avanzado (perfiles, clasificación)', included: false },
      { text: 'Reportes avanzados (4 vistas + export)', included: false },
      { text: 'Recomendaciones inteligentes', included: false },
      { text: 'Tienda en línea personalizada', included: false },
      { text: 'Asesora de Estilo IA "Mia"', included: false },
      { text: 'Marca de agua personalizada', included: false },
      { text: 'Historial de pagos completo', included: false },
    ],
    popular: false,
  },
  {
    id: 'business' as const,
    name: 'Business',
    price: 499,
    description: 'Para negocios en crecimiento que quieren vender más',
    features: [
      { text: 'Hasta 500 productos', included: true },
      { text: '8 imágenes por variante', included: true },
      { text: 'Descripciones con IA ilimitadas', included: true },
      { text: 'Pedidos y ventas', included: true },
      { text: 'Inventario completo (+ merma + regalos)', included: true },
      { text: 'CRM avanzado (perfiles, clasificación VIP)', included: true },
      { text: 'Compras a proveedores', included: true },
      { text: 'Entregas con zonas y logística', included: true },
      { text: 'Cuentas por cobrar + aging', included: true },
      { text: 'Dashboard completo (8 KPIs + alertas)', included: true },
      { text: 'Reportes avanzados (4 vistas + CSV/XML)', included: true },
      { text: 'Devoluciones y reembolsos', included: true },
      { text: 'Saldo a favor de clientes', included: true },
      { text: 'Recibos y resúmenes PDF', included: true },
      { text: 'Historial de pagos completo', included: true },
      { text: 'Recomendaciones inteligentes', included: true },
      { text: 'Tienda en línea personalizada', included: true },
      { text: 'Asesora de Estilo IA "Mia"', included: true },
      { text: 'Marca de agua personalizada', included: true },
      { text: 'Soporte prioritario (WhatsApp)', included: true },
    ],
    popular: true,
  },
];

const Planes: React.FC = () => {
  const { subscription, subscribe, openPortal, changePlan, isActive, isTrialing } = useSubscription();
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [changePlanModal, setChangePlanModal] = useState<{
    open: boolean;
    targetPlanId: 'emprendedor' | 'business' | null;
    isUpgrade: boolean;
  }>({ open: false, targetPlanId: null, isUpgrade: false });

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

  const handleChangePlanClick = (targetPlanId: 'emprendedor' | 'business') => {
    const isUpgrade = targetPlanId === 'business';
    setChangePlanModal({ open: true, targetPlanId, isUpgrade });
  };

  const handleConfirmChangePlan = async () => {
    if (!changePlanModal.targetPlanId) return;
    setError('');
    setLoadingPlan(changePlanModal.targetPlanId);
    setChangePlanModal(prev => ({ ...prev, open: false }));
    try {
      await changePlan(changePlanModal.targetPlanId);
    } catch (err: any) {
      setError(err.message || 'Error al cambiar de plan');
    } finally {
      setLoadingPlan(null);
    }
  };

  const currentPlan = subscription?.plan;
  const hasActiveSub = isActive && !isTrialing;
  const targetPlanName = changePlanModal.targetPlanId === 'business' ? 'Business' : 'Emprendedor';
  const targetPlanPrice = changePlanModal.targetPlanId === 'business' ? 499 : 250;
  const currentPlanName = currentPlan === 'business' ? 'Business' : 'Emprendedor';

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
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature.text} className={`flex items-start gap-2 text-sm ${feature.included ? 'text-gray-700' : 'text-gray-400'}`}>
                      {feature.included ? (
                        <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XMarkIcon className="h-5 w-5 text-gray-300 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={feature.included ? '' : 'line-through'}>{feature.text}</span>
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
                ) : hasActiveSub ? (
                  /* Usuario con suscripción activa cambiando a otro plan */
                  <button
                    onClick={() => handleChangePlanClick(plan.id)}
                    disabled={!!loadingPlan}
                    className={`w-full py-2.5 px-4 rounded-lg font-semibold text-white transition-colors flex items-center justify-center gap-2 ${
                      plan.popular
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-gray-800 hover:bg-gray-900'
                    } ${loadingPlan ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {loadingPlan === plan.id ? (
                      <>
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <ArrowsRightLeftIcon className="h-4 w-4" />
                        Cambiar a {plan.name}
                      </>
                    )}
                  </button>
                ) : (
                  /* Usuario sin suscripción, nueva suscripción */
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
            <>
              <p className="text-sm text-gray-500">
                Al cambiar de plan, solo se cobra la diferencia proporcional del período restante.
              </p>
              <button
                onClick={handleManage}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Administrar método de pago y facturación →
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modal de confirmación de cambio de plan */}
      {changePlanModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full relative">
            {/* Close button */}
            <button
              onClick={() => setChangePlanModal({ open: false, targetPlanId: null, isUpgrade: false })}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>

            <div className="p-6">
              {/* Icon */}
              <div className="mx-auto w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <ArrowsRightLeftIcon className="h-7 w-7 text-blue-600" />
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                {changePlanModal.isUpgrade ? 'Mejorar' : 'Cambiar'} a Plan {targetPlanName}
              </h3>

              <p className="text-sm text-gray-500 text-center mb-5">
                {currentPlanName} → {targetPlanName} (${targetPlanPrice} MXN/mes)
              </p>

              {/* Proration info box */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 space-y-3">
                <div className="flex items-start gap-2">
                  <InformationCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">¿Cómo funciona el cobro?</p>
                    {changePlanModal.isUpgrade ? (
                      <ul className="space-y-1.5 text-blue-800">
                        <li className="flex items-start gap-1.5">
                          <CheckIcon className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span><strong>Acceso inmediato</strong> a todas las funcionalidades Business.</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <CheckIcon className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span><strong>Solo pagas la diferencia</strong> proporcional por los días que faltan de tu ciclo actual. No se te cobra el mes completo.</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <CheckIcon className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>A partir del <strong>próximo ciclo de facturación</strong>, se te cobrará el precio completo del plan Business ($499 MXN/mes).</span>
                        </li>
                      </ul>
                    ) : (
                      <ul className="space-y-1.5 text-blue-800">
                        <li className="flex items-start gap-1.5">
                          <CheckIcon className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>El cambio se aplica <strong>de inmediato</strong>.</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <CheckIcon className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Se te <strong>acredita</strong> el saldo no utilizado de tu plan actual para los días restantes.</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <CheckIcon className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>A partir del <strong>próximo ciclo</strong>, se cobra el precio del Plan Emprendedor ($250 MXN/mes).</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <InformationCircleIcon className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <span className="text-amber-800">Las funcionalidades exclusivas de Business dejarán de estar disponibles.</span>
                        </li>
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleConfirmChangePlan}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowsRightLeftIcon className="h-5 w-5" />
                  Confirmar cambio a {targetPlanName}
                </button>
                <button
                  onClick={() => setChangePlanModal({ open: false, targetPlanId: null, isUpgrade: false })}
                  className="w-full py-2 px-4 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Planes;
