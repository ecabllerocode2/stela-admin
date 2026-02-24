import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LockClosedIcon, SparklesIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

/**
 * Pantalla que se muestra cuando el trial expiró o la suscripción está inactiva.
 * Bloquea el acceso a toda la aplicación hasta que el usuario elija un plan.
 */
const SubscriptionWall: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center">
        {/* Icono */}
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
          <LockClosedIcon className="h-8 w-8 text-blue-600" />
        </div>

        {/* Título */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Tu período de prueba ha terminado
        </h1>
        <p className="text-gray-500 mb-8 max-w-sm mx-auto">
          Para seguir utilizando <span className="font-quicksand font-semibold">Stela</span> y
          gestionar tu negocio, elige un plan que se adapte a ti.
        </p>

        {/* Resumen de planes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {/* Emprendedor */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-left">
            <h3 className="font-semibold text-gray-900 mb-1">Emprendedor</h3>
            <div className="text-2xl font-bold text-gray-900 mb-3">
              $250<span className="text-sm font-normal text-gray-500">/mes</span>
            </div>
            <ul className="space-y-1.5 text-sm text-gray-600">
              <li className="flex items-center gap-1.5"><CheckIcon className="h-4 w-4 text-green-500 shrink-0" /> Hasta 100 productos</li>
              <li className="flex items-center gap-1.5"><CheckIcon className="h-4 w-4 text-green-500 shrink-0" /> Pedidos y ventas</li>
              <li className="flex items-center gap-1.5"><CheckIcon className="h-4 w-4 text-green-500 shrink-0" /> Inventario básico</li>
              <li className="flex items-center gap-1.5"><CheckIcon className="h-4 w-4 text-green-500 shrink-0" /> CRM clientes</li>
              <li className="flex items-center gap-1.5"><CheckIcon className="h-4 w-4 text-green-500 shrink-0" /> Reportes básicos</li>
              <li className="flex items-center gap-1.5 text-gray-400"><XMarkIcon className="h-4 w-4 text-gray-300 shrink-0" /> Sin tienda en línea</li>
            </ul>
          </div>

          {/* Business */}
          <div className="bg-blue-50 border-2 border-blue-500 rounded-xl p-5 text-left relative">
            <div className="absolute -top-2.5 right-3 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <SparklesIcon className="h-3 w-3" /> Popular
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Business</h3>
            <div className="text-2xl font-bold text-gray-900 mb-3">
              $499<span className="text-sm font-normal text-gray-500">/mes</span>
            </div>
            <ul className="space-y-1.5 text-sm text-gray-600">
              <li className="flex items-center gap-1.5"><CheckIcon className="h-4 w-4 text-green-500 shrink-0" /> Hasta 500 productos</li>
              <li className="flex items-center gap-1.5"><CheckIcon className="h-4 w-4 text-green-500 shrink-0" /> Todo lo del Emprendedor</li>
              <li className="flex items-center gap-1.5"><CheckIcon className="h-4 w-4 text-green-500 shrink-0" /> Tienda en línea propia</li>
              <li className="flex items-center gap-1.5"><CheckIcon className="h-4 w-4 text-green-500 shrink-0" /> Reportes avanzados + CSV/XML</li>
              <li className="flex items-center gap-1.5"><CheckIcon className="h-4 w-4 text-green-500 shrink-0" /> Recomendaciones IA</li>
              <li className="flex items-center gap-1.5"><CheckIcon className="h-4 w-4 text-green-500 shrink-0" /> Devoluciones y saldo a favor</li>
            </ul>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate('/planes')}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors text-base"
        >
          <SparklesIcon className="h-5 w-5" />
          Elegir un Plan
        </button>

        <p className="text-xs text-gray-400 mt-4">
          Tus datos están seguros. Podrás acceder a todo apenas actives tu suscripción.
        </p>
      </div>
    </div>
  );
};

export default SubscriptionWall;
