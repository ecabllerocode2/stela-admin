import React, { useState, useRef } from 'react';
import { useUserProfile } from '../hooks/useUserProfile';
import type { StoreConfig } from '../hooks/useUserProfile';
import {
  GlobeAltIcon,
  LinkIcon,
  ShareIcon,
  PaintBrushIcon,
  PhotoIcon,
  ChatBubbleLeftIcon,
  MapPinIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  EyeIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';

// Simple SVG icons for social media (to avoid adding react-icons dependency)
const InstagramIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

const FacebookIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385h-3.047v-3.47h3.047v-2.642c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953h-1.514c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385c5.738-.9 10.126-5.864 10.126-11.854z" />
  </svg>
);

const WhatsAppIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'https://stela-backend.vercel.app').trim();

const MiTienda: React.FC = () => {
  const { profile, loading, storeName, storeUrl, updateProfile } = useUserProfile();
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoFileInputRef = React.useRef<HTMLInputElement>(null);

  // Form state for store configuration
  const [formData, setFormData] = useState<Partial<StoreConfig & { nombreNegocio?: string; telefono?: string }>>({});
  const [isEditing, setIsEditing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Initialize form data when profile loads
  React.useEffect(() => {
    if (profile && !isEditing) {
      setFormData({
        nombreNegocio: profile.nombreNegocio || '',
        telefono: profile.telefono || '',
        descripcionTienda: profile.descripcionTienda || '',
        logo: profile.logo || '',
        instagram: profile.instagram || '',
        facebook: profile.facebook || '',
        direccion: profile.direccion || '',
        colorPrimario: profile.colorPrimario || '#d88c6d',
        colorSecundario: profile.colorSecundario || '#f6d28c',
      });
    }
  }, [profile, isEditing]);

  const handleCopyLink = async () => {
    if (!storeUrl) return;
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = storeUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!storeUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${storeName} — Tienda en Línea`,
          text: `Visita mi tienda en línea: ${storeName}`,
          url: storeUrl,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      handleCopyLink();
    }
  };

  const handleOpenStore = () => {
    if (storeUrl) {
      window.open(storeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('files', file);
      const res = await fetch(`${BACKEND_URL}/api/upload`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      if (!data.success || !data.urls?.length) throw new Error('No se obtuvo URL de la imagen');
      const url = data.urls[0];
      handleFieldChange('logo', url);
      setLogoModalOpen(false);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error al subir el logo' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      await updateProfile(formData);
      setFeedback({ type: 'success', message: 'Tienda actualizada exitosamente.' });
      setIsEditing(false);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error al guardar los cambios.' });
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (!isEditing) setIsEditing(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-96 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <ExclamationTriangleIcon className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-yellow-800">Perfil no encontrado</h2>
        <p className="text-sm text-yellow-600 mt-1">No se encontró tu perfil de tienda. Intenta cerrar sesión y volver a iniciar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi Tienda en Línea</h1>
        <p className="text-gray-500 mt-1">Gestiona y personaliza tu tienda para tus clientes</p>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`rounded-lg p-4 flex items-start gap-3 ${
            feedback.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircleIcon className="h-5 w-5 shrink-0 mt-0.5" />
          ) : (
            <ExclamationTriangleIcon className="h-5 w-5 shrink-0 mt-0.5" />
          )}
          <p className="text-sm font-medium flex-1">{feedback.message}</p>
          <button onClick={() => setFeedback(null)} className="shrink-0">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Store Link Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <GlobeAltIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Tu tienda</h2>
            <p className="text-sm text-gray-500">{storeName}</p>
          </div>
        </div>

        {/* URL Preview */}
        {storeUrl && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4 flex items-center gap-3">
            <LinkIcon className="h-5 w-5 text-gray-400 shrink-0" />
            <span className="text-sm text-gray-700 font-mono truncate flex-1">{storeUrl}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleOpenStore}
            disabled={!storeUrl}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowTopRightOnSquareIcon className="h-5 w-5" />
            Abrir Tienda
          </button>

          <button
            onClick={handleCopyLink}
            disabled={!storeUrl}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              copied
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
            }`}
          >
            {copied ? (
              <>
                <CheckCircleIcon className="h-5 w-5" />
                ¡Copiado!
              </>
            ) : (
              <>
                <ClipboardDocumentIcon className="h-5 w-5" />
                Copiar Enlace
              </>
            )}
          </button>

          <button
            onClick={handleShare}
            disabled={!storeUrl}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShareIcon className="h-5 w-5" />
            Compartir
          </button>
        </div>
      </div>

      {/* Store Preview Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <EyeIcon className="h-5 w-5 text-purple-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Vista previa</h2>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Mini preview header */}
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ backgroundColor: formData.colorPrimario || '#d88c6d' }}
          >
            <div className="flex items-center gap-2">
              {formData.logo ? (
                <img
                  src={formData.logo}
                  alt="Logo"
                  className="h-8 w-8 rounded-full object-cover bg-white"
                />
              ) : (
                <div className="h-8 w-8 bg-white/30 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {(formData.nombreNegocio || profile.nombre || 'T').charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-white font-semibold text-sm">
                {formData.nombreNegocio || profile.nombre || 'Mi Tienda'}
              </span>
            </div>
            <div className="flex gap-2">
              <div className="w-6 h-1 bg-white/40 rounded" />
              <div className="w-6 h-1 bg-white/40 rounded" />
              <div className="w-6 h-1 bg-white/40 rounded" />
            </div>
          </div>

          {/* Mini preview body */}
          <div className="p-4 bg-gray-50">
            <div className="text-center mb-3">
              <p className="font-semibold text-gray-900 text-sm">
                Bienvenido a {formData.nombreNegocio || profile.nombre || 'Mi Tienda'}
              </p>
              {formData.descripcionTienda && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{formData.descripcionTienda}</p>
              )}
            </div>
            {/* Fake product grid */}
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="aspect-3/4 bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
            <div className="mt-3 flex justify-center gap-2">
              {formData.instagram && <InstagramIcon className="w-4 h-4 text-gray-400" />}
              {formData.facebook && <FacebookIcon className="w-4 h-4 text-gray-400" />}
              {profile.telefono && <WhatsAppIcon className="w-4 h-4 text-green-500" />}
            </div>
          </div>
        </div>
      </div>

      {/* Store Configuration */}
      <form ref={formRef} onSubmit={handleSave} className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <PaintBrushIcon className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Personalizar Tienda</h2>
            <p className="text-sm text-gray-500">Configura cómo se ve tu tienda en línea</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Nombre del negocio */}
          <div>
            <label htmlFor="nombreNegocio" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del negocio
            </label>
            <input
              id="nombreNegocio"
              type="text"
              value={formData.nombreNegocio || ''}
              onChange={(e) => handleFieldChange('nombreNegocio', e.target.value)}
              placeholder="Mi Tienda"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            <p className="text-xs text-gray-400 mt-1">Si se deja vacío, se usará tu nombre de usuario.</p>
          </div>

          {/* Descripción */}
          <div>
            <label htmlFor="descripcionTienda" className="block text-sm font-medium text-gray-700 mb-1">
              <ChatBubbleLeftIcon className="inline h-4 w-4 mr-1 text-gray-400" />
              Descripción de la tienda
            </label>
            <textarea
              id="descripcionTienda"
              rows={3}
              value={formData.descripcionTienda || ''}
              onChange={(e) => handleFieldChange('descripcionTienda', e.target.value)}
              placeholder="Describe tu negocio en pocas palabras..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
            />
          </div>

          {/* Logo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <PhotoIcon className="inline h-4 w-4 mr-1 text-gray-400" />
              Logo de la tienda
            </label>
            <div className="flex items-center gap-4">
              {formData.logo ? (
                <img src={formData.logo} alt="Logo" className="h-16 w-16 rounded-xl object-cover border border-gray-200 shadow-sm" />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center">
                  <PhotoIcon className="h-6 w-6 text-gray-400" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setLogoModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <ArrowUpTrayIcon className="h-4 w-4" />
                  {formData.logo ? 'Cambiar logo' : 'Subir logo'}
                </button>
                {formData.logo && (
                  <button type="button" onClick={() => handleFieldChange('logo', '')} className="text-xs text-red-500 hover:text-red-700 transition-colors">
                    Quitar logo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Teléfono / WhatsApp */}
          <div>
            <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-1">
              <WhatsAppIcon className="inline h-4 w-4 mr-1 text-green-500" />
              Teléfono / WhatsApp
            </label>
            <input
              id="telefono"
              type="tel"
              value={formData.telefono || ''}
              onChange={(e) => handleFieldChange('telefono', e.target.value)}
              placeholder="55 1234 5678"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            <p className="text-xs text-gray-400 mt-1">Este número se usará para el botón de WhatsApp en tu tienda.</p>
          </div>

          {/* Dirección */}
          <div>
            <label htmlFor="direccion" className="block text-sm font-medium text-gray-700 mb-1">
              <MapPinIcon className="inline h-4 w-4 mr-1 text-gray-400" />
              Dirección <span className="text-gray-400 text-xs">(opcional)</span>
            </label>
            <input
              id="direccion"
              type="text"
              value={formData.direccion || ''}
              onChange={(e) => handleFieldChange('direccion', e.target.value)}
              placeholder="Calle, Número, Colonia, Ciudad"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {/* Redes Sociales */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              Redes Sociales
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="instagram" className="block text-sm font-medium text-gray-700 mb-1">
                  <InstagramIcon className="inline h-4 w-4 mr-1 text-pink-500" />
                  Instagram
                </label>
                <input
                  id="instagram"
                  type="text"
                  value={formData.instagram || ''}
                  onChange={(e) => handleFieldChange('instagram', e.target.value)}
                  placeholder="@tu_tienda o URL completa"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label htmlFor="facebook" className="block text-sm font-medium text-gray-700 mb-1">
                  <FacebookIcon className="inline h-4 w-4 mr-1 text-blue-600" />
                  Facebook
                </label>
                <input
                  id="facebook"
                  type="text"
                  value={formData.facebook || ''}
                  onChange={(e) => handleFieldChange('facebook', e.target.value)}
                  placeholder="@tu_pagina o URL completa"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>
          </div>

          {/* Colores */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PaintBrushIcon className="h-4 w-4 text-gray-400" />
              Colores de la tienda
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="colorPrimario" className="block text-sm font-medium text-gray-700 mb-1">
                  Color Primario
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="colorPrimario"
                    type="color"
                    value={formData.colorPrimario || '#d88c6d'}
                    onChange={(e) => handleFieldChange('colorPrimario', e.target.value)}
                    className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.colorPrimario || '#d88c6d'}
                    onChange={(e) => handleFieldChange('colorPrimario', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="colorSecundario" className="block text-sm font-medium text-gray-700 mb-1">
                  Color Secundario
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="colorSecundario"
                    type="color"
                    value={formData.colorSecundario || '#f6d28c'}
                    onChange={(e) => handleFieldChange('colorSecundario', e.target.value)}
                    className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.colorSecundario || '#f6d28c'}
                    onChange={(e) => handleFieldChange('colorSecundario', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Estos colores se aplicarán en el header, botones y acentos de tu tienda.</p>
          </div>
        </div>

        {/* Save Button */}
        {isEditing && (
          <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                // Reset form data from profile
                if (profile) {
                  setFormData({
                    nombreNegocio: profile.nombreNegocio || '',
                    telefono: profile.telefono || '',
                    descripcionTienda: profile.descripcionTienda || '',
                    logo: profile.logo || '',
                    instagram: profile.instagram || '',
                    facebook: profile.facebook || '',
                    direccion: profile.direccion || '',
                    colorPrimario: profile.colorPrimario || '#d88c6d',
                    colorSecundario: profile.colorSecundario || '#f6d28c',
                  });
                }
              }}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Guardando...
                </span>
              ) : (
                'Guardar Cambios'
              )}
            </button>
          </div>
        )}
      </form>

      {/* Modal de carga de logo */}
      {logoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">Subir Logo</h3>
              <button onClick={() => setLogoModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div
                className="border-2 border-dashed border-indigo-300 rounded-xl bg-indigo-50 p-8 text-center cursor-pointer hover:bg-indigo-100 transition-colors"
                onClick={() => logoFileInputRef.current?.click()}
              >
                <ArrowUpTrayIcon className="h-10 w-10 text-indigo-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700">Haz clic para seleccionar una imagen</p>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG, WEBP — máx. 10 MB</p>
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) await handleLogoUpload(file);
                    e.target.value = '';
                  }}
                />
              </div>
              {uploadingLogo && (
                <div className="flex items-center justify-center gap-2 text-indigo-600">
                  <span className="h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium">Subiendo imagen…</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">Información</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Tu tienda se accede en: <span className="font-mono font-semibold">{storeUrl || '—'}</span></li>
          <li>• El slug de tu tienda es: <span className="font-mono font-semibold">{profile.slug || '—'}</span></li>
          <li>• Los productos que publiques en línea aparecerán automáticamente en tu tienda.</li>
          <li>• Los clientes podrán contactarte por WhatsApp al número: <span className="font-semibold">{profile.telefono || '—'}</span></li>
        </ul>
      </div>
    </div>
  );
};

export default MiTienda;
