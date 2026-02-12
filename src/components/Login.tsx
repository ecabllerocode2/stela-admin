import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const { login, register, loginWithGoogle } = useAuth();
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

      // Validar confirmación de contraseña en modo registro
      if (isRegisterMode) {
        if (!confirmPassword) {
          setError('Por favor confirma tu contraseña');
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Las contraseñas no coinciden');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres');
          setLoading(false);
          return;
        }
      }

      // Ejecutar login o registro
      if (isRegisterMode) {
        await register(email, password);
      } else {
        await login(email, password);
      }
      
      navigate('/');
    } catch (err: unknown) {
      // Mensajes de error más claros
      const error = err as { message?: string; code?: string };
      
      if (isRegisterMode) {
        // Errores específicos de registro
        if (error.code === 'auth/email-already-in-use') {
          setError('Este email ya está registrado. ¿Quieres iniciar sesión en su lugar?');
        } else if (error.code === 'auth/weak-password') {
          setError('La contraseña es muy débil. Usa al menos 6 caracteres.');
        } else if (error.code === 'auth/invalid-email') {
          setError('Email inválido');
        } else {
          setError('Error al crear la cuenta. Intenta nuevamente.');
        }
      } else {
        // Errores específicos de login
        if (error.message === 'No tienes permisos para acceder a esta aplicación') {
          setError('Acceso denegado. No tienes permisos para acceder a esta aplicación.');
        } else if (error.code === 'auth/user-not-found') {
          setError('Usuario no encontrado. ¿Quieres crear una cuenta?');
        } else if (error.code === 'auth/wrong-password') {
          setError('Contraseña incorrecta');
        } else if (error.code === 'auth/invalid-email') {
          setError('Email inválido');
        } else if (error.code === 'auth/user-disabled') {
          setError('Usuario deshabilitado');
        } else {
          setError('Error al iniciar sesión. Intenta nuevamente.');
        }
      }
      console.error('Error de autenticación:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err: unknown) {
      const error = err as { message?: string; code?: string };
      if (error.message === 'No tienes permisos para acceder a esta aplicación') {
        setError('Acceso denegado. Tu cuenta de Google no está autorizada.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        setError('Inicio de sesión cancelado');
      } else {
        setError('Error al iniciar sesión con Google. Intenta nuevamente.');
      }
      console.error('Error de autenticación con Google:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setError('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="h-16 w-16 rounded-lg shadow-md flex items-center justify-center text-xl font-bold text-gray-900">
              STELA
            </div>
          </div>

          {/* Título */}
          <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
            {isRegisterMode ? 'Crear Cuenta' : 'STELA Intranet'}
          </h1>
          <p className="text-center text-gray-500 mb-8">
            {isRegisterMode ? 'Regístrate para acceder al panel' : 'Acceso a panel administrativo'}
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

            {/* Confirm Password Input - Solo en modo registro */}
            {isRegisterMode && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmar Contraseña
                </label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

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
                  {isRegisterMode ? 'Creando cuenta...' : 'Iniciando sesión...'}
                </span>
              ) : (
                isRegisterMode ? 'Crear Cuenta' : 'Iniciar Sesión'
              )}
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">o</span>
              </div>
            </div>

            {/* Google Login Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className={`w-full py-2.5 px-4 rounded-lg font-semibold border border-gray-300 transition duration-200 ${
                loading
                  ? 'bg-gray-50 cursor-not-allowed text-gray-400'
                  : 'bg-white hover:bg-gray-50 text-gray-700 active:scale-95'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuar con Google
              </span>
            </button>

            {/* Toggle Mode */}
            <div className="text-center">
              <button
                type="button"
                onClick={toggleMode}
                disabled={loading}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {isRegisterMode 
                  ? '¿Ya tienes cuenta? Iniciar sesión' 
                  : '¿No tienes cuenta? Crear una nueva'
                }
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-500">
              Panel administrativo seguro
            </p>
            <p className="text-center text-xs text-gray-400 mt-2">
              © 2024 STELA. Todos los derechos reservados.
            </p>
          </div>
        </div>

        {/* Info Message */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">
            <span className="font-semibold">💡 Información:</span> {isRegisterMode 
              ? 'Durante el desarrollo, todas las cuentas nuevas tendrán acceso completo a la aplicación.'
              : 'Usa tu email y contraseña, o inicia sesión con Google para acceder.'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
