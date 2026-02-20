import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  EnvelopeIcon,
  LockClosedIcon,
  UserIcon,
  PhoneIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [nombreNegocio, setNombreNegocio] = useState('');
  const [telefono, setTelefono] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email || !password) {
        setError('Por favor completa todos los campos obligatorios');
        setLoading(false);
        return;
      }

      if (isRegisterMode) {
        // Validaciones de registro
        if (!nombre.trim()) {
          setError('El nombre es obligatorio');
          setLoading(false);
          return;
        }
        if (!telefono.trim()) {
          setError('El teléfono es obligatorio');
          setLoading(false);
          return;
        }
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

        await register(email, password, {
          nombre: nombre.trim(),
          nombreNegocio: nombreNegocio.trim() || undefined,
          telefono: telefono.trim(),
        });
      } else {
        await login(email, password);
      }

      navigate('/');
    } catch (err: unknown) {
      const error = err as { message?: string; code?: string };

      if (isRegisterMode) {
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
        if (error.message === 'No tienes permisos para acceder a esta aplicación') {
          setError('Acceso denegado.');
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

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setError('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setNombre('');
    setNombreNegocio('');
    setTelefono('');
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="text-4xl font-quicksand font-bold text-gray-900 leading-none">
              Stela
            </div>
          </div>

          {/* Título */}
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-1">
            {isRegisterMode ? 'Crear Cuenta' : <><span className="font-quicksand">Stela</span> Intranet</>}
          </h1>
          <p className="text-center text-gray-500 mb-6 text-sm">
            {isRegisterMode
              ? 'Regístrate y obtén 15 días gratis del Plan Business'
              : 'Acceso a tu panel de administración'}
          </p>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700 font-medium">⚠️ {error}</p>
              </div>
            )}

            {/* --- Campos de registro --- */}
            {isRegisterMode && (
              <>
                {/* Nombre */}
                <div>
                  <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre completo <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="nombre"
                      type="text"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Tu nombre"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Nombre del negocio */}
                <div>
                  <label htmlFor="nombreNegocio" className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del negocio <span className="text-gray-400 text-xs">(opcional)</span>
                  </label>
                  <div className="relative">
                    <BuildingStorefrontIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="nombreNegocio"
                      type="text"
                      value={nombreNegocio}
                      onChange={(e) => setNombreNegocio(e.target.value)}
                      placeholder="Mi tienda"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Teléfono */}
                <div>
                  <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <PhoneIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="telefono"
                      type="tel"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="55 1234 5678"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      disabled={loading}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
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

            {/* Contraseña */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña <span className="text-red-500">*</span>
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

            {/* Confirmar Contraseña */}
            {isRegisterMode && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar Contraseña <span className="text-red-500">*</span>
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

            {/* Submit */}
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
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {isRegisterMode ? 'Creando cuenta...' : 'Iniciando sesión...'}
                </span>
              ) : isRegisterMode ? (
                'Crear Cuenta — 15 días gratis'
              ) : (
                'Iniciar Sesión'
              )}
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
                  : '¿No tienes cuenta? Crear una nueva'}
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-center text-xs text-gray-400">
              © 2024 <span className="font-quicksand">Stela</span>. Todos los derechos reservados.
            </p>
          </div>
        </div>

        {/* Info Banner */}
        {isRegisterMode && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-700">
              <span className="font-semibold">🎁 Prueba gratis:</span> Al crear tu cuenta obtienes
              15 días del Plan Business sin costo. Sin tarjeta de crédito.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
