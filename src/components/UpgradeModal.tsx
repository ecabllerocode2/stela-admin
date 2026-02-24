import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SparklesIcon, XMarkIcon, LockClosedIcon } from '@heroicons/react/24/outline';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
  featureDescription?: string;
}

/**
 * Modal que se muestra cuando un usuario del plan Emprendedor intenta
 * usar una funcionalidad exclusiva del plan Business.
 */
const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  featureName,
  featureDescription,
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full relative animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        {/* Content */}
        <div className="p-6 text-center">
          {/* Icon */}
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-5 shadow-lg shadow-blue-200">
            <LockClosedIcon className="h-8 w-8 text-white" />
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Funcionalidad Premium
          </h3>

          {/* Feature name */}
          <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
            <SparklesIcon className="h-4 w-4" />
            {featureName}
          </div>

          {/* Description */}
          <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
            {featureDescription ||
              `${featureName} está disponible exclusivamente en el Plan Business. Mejora tu plan para desbloquear esta y más funcionalidades avanzadas.`}
          </p>

          {/* Business plan highlights */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Plan Business incluye:</p>
            <ul className="space-y-1.5 text-sm text-gray-700">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Hasta 500 productos
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Tienda en línea personalizada
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Reportes avanzados y exportación
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Recomendaciones inteligentes
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Devoluciones y saldo a favor
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                onClose();
                navigate('/planes');
              }}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-semibold transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2"
            >
              <SparklesIcon className="h-5 w-5" />
              Mejorar a Business — $499/mes
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 px-4 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;

/**
 * Hook helper para manejar el estado del modal de upgrade.
 * Úsalo dentro de cualquier componente que necesite gate de features.
 *
 * Ejemplo:
 *   const { showUpgrade, upgradeProps, requireBusiness } = useUpgradeModal();
 *   // En un handler:
 *   if (!isBusiness) { requireBusiness('Devoluciones'); return; }
 *   // En el JSX:
 *   <UpgradeModal {...upgradeProps} />
 */
export function useUpgradeModal() {
  const [showUpgrade, setShowUpgrade] = React.useState(false);
  const [upgradeMeta, setUpgradeMeta] = React.useState({ name: '', description: '' });

  const requireBusiness = (featureName: string, description?: string) => {
    setUpgradeMeta({ name: featureName, description: description || '' });
    setShowUpgrade(true);
  };

  const upgradeProps = {
    isOpen: showUpgrade,
    onClose: () => setShowUpgrade(false),
    featureName: upgradeMeta.name,
    featureDescription: upgradeMeta.description || undefined,
  };

  return { showUpgrade, upgradeProps, requireBusiness };
}
