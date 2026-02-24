import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../contexts/SubscriptionContext';
import { LockClosedIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface BusinessGateProps {
  children: React.ReactNode;
  featureName: string;
  featureDescription?: string;
}

/**
 * Wrapper component that shows an inline upgrade prompt instead of the page content
 * when the user is on the Emprendedor plan and the feature requires Business.
 * 
 * The feature is visible (not hidden from navigation) but accessing it shows
 * the upgrade prompt directly instead of the UpgradeModal.
 */
const BusinessGate: React.FC<BusinessGateProps> = ({ children, featureName, featureDescription }) => {
  const { isBusiness } = useSubscription();
  const navigate = useNavigate();

  if (isBusiness) {
    return <>{children}</>;
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full text-center p-8">
        {/* Icon */}
        <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-200">
          <LockClosedIcon className="h-10 w-10 text-white" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {featureName}
        </h2>

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
          <SparklesIcon className="h-4 w-4" />
          Exclusivo Plan Business
        </div>

        {/* Description */}
        <p className="text-gray-500 text-sm mb-8 max-w-sm mx-auto">
          {featureDescription ||
            `${featureName} está disponible exclusivamente en el Plan Business. Mejora tu plan para desbloquear esta funcionalidad.`}
        </p>

        {/* CTA */}
        <button
          onClick={() => navigate('/planes')}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-md shadow-blue-200"
        >
          <SparklesIcon className="h-5 w-5" />
          Mejorar a Business — $499/mes
        </button>

        <p className="text-xs text-gray-400 mt-4">
          Tu plan actual: Emprendedor. Puedes cambiar en cualquier momento.
        </p>
      </div>
    </div>
  );
};

export default BusinessGate;
