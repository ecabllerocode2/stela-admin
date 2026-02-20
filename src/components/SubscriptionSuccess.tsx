import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../credenciales';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'https://stela-backend.vercel.app').trim();

const SubscriptionSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(5);
  const { user } = useAuth();
  const sessionId = searchParams.get('session_id');
  const hasUpdated = useRef(false);

  // Al montar, actualizar el status de la suscripción en Firestore
  // consultando el backend para obtener datos frescos de Stripe
  useEffect(() => {
    if (!user?.uid || hasUpdated.current) return;
    hasUpdated.current = true;

    const updateSubscription = async () => {
      try {
        // Consultar el backend con sessionId para que sincronice directamente con Stripe
        const params = new URLSearchParams({ userId: user.uid });
        if (sessionId) params.append('sessionId', sessionId);

        const res = await fetch(
          `${BACKEND_URL}/api/subscription-status?${params.toString()}`
        );
        const data = await res.json();

        if (data.success && data.subscription) {
          // Actualizar directamente en Firestore para que el listener lo capture
          const newStatus = data.subscription.status || 'active';
          await updateDoc(doc(db, 'subscriptions', user.uid), {
            status: newStatus,
            plan: data.subscription.plan,
            stripeSubscriptionId: data.subscription.stripeSubscriptionId || null,
            cancelAtPeriodEnd: data.subscription.cancelAtPeriodEnd || false,
            updatedAt: serverTimestamp(),
          });
          console.log('✅ Suscripción actualizada tras checkout:', newStatus);
        }
      } catch (err) {
        console.warn('⚠️ No se pudo actualizar suscripción post-checkout:', err);
      }
    };

    updateSubscription();
  }, [user?.uid]);

  // Countdown y redirect separados del setState
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Navigate cuando countdown llega a 0
  useEffect(() => {
    if (countdown === 0) {
      navigate('/');
    }
  }, [countdown, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircleIcon className="h-10 w-10 text-green-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          ¡Suscripción activada!
        </h1>
        <p className="text-gray-500 mb-6">
          Tu suscripción ha sido configurada exitosamente. Ya puedes utilizar
          todas las funcionalidades de <span className="font-quicksand font-semibold">Stela</span>.
        </p>

        <button
          onClick={() => navigate('/')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors"
        >
          Ir al Dashboard
        </button>

        <p className="text-xs text-gray-400 mt-4">
          Redirigiendo en {countdown} segundos...
        </p>
      </div>
    </div>
  );
};

export default SubscriptionSuccess;
