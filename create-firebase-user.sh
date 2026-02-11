#!/bin/bash

# Script para crear usuario en Firebase Auth
# Este script requiere que tengas firebase-cli instalado
# npm install -g firebase-tools

echo "🔒 Script de Creación de Usuario Firebase"
echo "=========================================="
echo ""

# Preguntar email y contraseña
read -p "Email del usuario administrativo: " EMAIL
read -sp "Contraseña (8+ caracteres): " PASSWORD
echo ""
read -sp "Confirma la contraseña: " PASSWORD_CONFIRM
echo ""

# Validar que las contraseñas coincidan
if [ "$PASSWORD" != "$PASSWORD_CONFIRM" ]; then
  echo "❌ Las contraseñas no coinciden"
  exit 1
fi

# Validar longitud de contraseña
if [ ${#PASSWORD} -lt 8 ]; then
  echo "❌ La contraseña debe tener al menos 8 caracteres"
  exit 1
fi

# Validar email
if [[ ! "$EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
  echo "❌ Email inválido"
  exit 1
fi

echo ""
echo "✅ Validaciones completadas"
echo ""
echo "Para crear el usuario en Firebase Auth, debes ir a:"
echo "1. Firebase Console: https://console.firebase.google.com/"
echo "2. Selecciona proyecto: stela-a8c06"
echo "3. Ve a Authentication → Users"
echo "4. Haz clic en 'Crear usuario'"
echo "5. Ingresa:"
echo "   Email: $EMAIL"
echo "   Contraseña: $PASSWORD"
echo ""
echo "🔐 IMPORTANTE:"
echo "- Guarda estas credenciales en un lugar seguro"
echo "- NO compartas la contraseña con nadie"
echo "- Si olvidas la contraseña, podrás restablecerla desde Firebase Console"
echo ""
echo "Después de crear el usuario, será posible iniciar sesión en:"
echo "https://intranet-malim.vercel.app"
