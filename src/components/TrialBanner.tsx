import React from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

const TrialBanner: React.FC = () => {
  const { isTrialing, trialDaysLeft, subscription, isActive } = useSubscription();
  const navigate = useNavigate();

  // No mostrar si no hay suscripción
  if (!subscription) return null;

  // Mostrar banner de cancelación pendiente incluso para suscripciones activas pagadas
  if (isActive && subscription.cancelAtPeriodEnd) {
    // Calcular la fecha de fin del período
    const periodEnd = subscription.currentPeriodEnd;
    let endDateStr = '';
    if (periodEnd) {
      const endDate = periodEnd?.toDate ? periodEnd.toDate() : new Date(periodEnd);
      endDateStr = endDate.toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }

    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-amber-800">
          <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
          <span>
            Tu suscripción se cancelará{endDateStr ? ` el ${endDateStr}` : ' al final del período actual'}.
            {endDateStr && ' Hasta esa fecha conservas acceso completo a tu plan.'}
          </span>
        </div>
        <button
          onClick={() => navigate('/planes')}
          className="text-amber-700 hover:text-amber-900 font-medium whitespace-nowrap ml-4"
        >
          Reactivar
        </button>
      </div>
    );
  }

  // Banner de trial
  if (isTrialing) {
    const urgency = trialDaysLeft <= 3;
    return (
      <div
        className={`${
          urgency ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'
        } border-b px-4 py-2 flex items-center justify-between text-sm`}
      >
        <div className={`flex items-center gap-2 ${urgency ? 'text-orange-800' : 'text-blue-800'}`}>
          <ClockIcon className="h-4 w-4 flex-shrink-0" />
          <span>
            {trialDaysLeft > 1
              ? `Te quedan ${trialDaysLeft} días de prueba gratuita del Plan Business.`
              : trialDaysLeft === 1
              ? 'Te queda 1 día de prueba gratuita.'
              : 'Tu prueba gratuita termina hoy.'}
          </span>
        </div>
        <button
          onClick={() => navigate('/planes')}
          className={`${
            urgency
              ? 'bg-orange-600 hover:bg-orange-700'
              : 'bg-blue-600 hover:bg-blue-700'
          } text-white px-3 py-1 rounded-md font-medium text-xs whitespace-nowrap ml-4 transition-colors`}
        >
          Ver Planes
        </button>
      </div>
    );
  }

  return null;
};

export default TrialBanner;
