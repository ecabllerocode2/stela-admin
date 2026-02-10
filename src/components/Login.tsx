import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/malim-logo-negro.png';
import { EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validar campos
      if (!email || !password) {
        setError('Por favor completa todos los campos');
        setLoading(false);
        return;
      }

      // Intentar login
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      // Mensajes de error más claros
      const error = err as { message?: string; code?: string };
      if (error.message === 'No tienes permisos para acceder a esta aplicación') {
        setError('Acceso denegado. No tienes permisos para acceder a esta aplicación.');
      } else if (error.code === 'auth/user-not-found') {
        setError('Usuario no encontrado');
      } else if (error.code === 'auth/wrong-password') {
        setError('Contraseña incorrecta');
      } else if (error.code === 'auth/invalid-email') {
        setError('Email inválido');
      } else if (error.code === 'auth/user-disabled') {
        setError('Usuario deshabilitado');
      } else {
        setError('Error al iniciar sesión. Intenta nuevamente.');
      }
      console.error('Error de autenticación:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img 
              src={logo} 
              alt="Malim Logo" 
              className="h-16 w-16 rounded-lg shadow-md" 
            />
          </div>

          {/* Título */}
          <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
            Malim Intranet
          </h1>
          <p className="text-center text-gray-500 mb-8">
            Acceso a panel administrativo
          </p>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700 font-medium">⚠️ {error}</p>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <EnvelopeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <LockClosedIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 px-4 rounded-lg font-semibold text-white transition duration-200 ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  Iniciando sesión...
                </span>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-500">
              Panel administrativo seguro
            </p>
            <p className="text-center text-xs text-gray-400 mt-2">
              © 2024 Malim. Todos los derechos reservados.
            </p>
          </div>
        </div>

        {/* Info Message */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">
            <span className="font-semibold">💡 Información:</span> Usa tus credenciales de Firebase Auth para acceder.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
