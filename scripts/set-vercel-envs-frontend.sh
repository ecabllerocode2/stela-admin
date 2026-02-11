#!/usr/bin/env bash
# Subir variables Vite (frontend) a Vercel
# Uso:
# export VERCEL_TOKEN="<token>"
# export VERCEL_PROJECT="stela-admin"  # nombre o id del proyecto en Vercel
# ./scripts/set-vercel-envs-frontend.sh production

set -e
if [ -z "$VERCEL_TOKEN" ]; then
  echo "Falta VERCEL_TOKEN" >&2
  exit 1
fi
if [ -z "$VERCEL_PROJECT" ]; then
  echo "Falta VERCEL_PROJECT" >&2
  exit 1
fi
ENV=${1:-production}

echo "Añadiendo variables VITE (Firebase) al proyecto $VERCEL_PROJECT en entorno $ENV"

vercel env add VITE_FIREBASE_API_KEY "$VITE_FIREBASE_API_KEY" $ENV --token "$VERCEL_TOKEN" || true
vercel env add VITE_FIREBASE_AUTH_DOMAIN "$VITE_FIREBASE_AUTH_DOMAIN" $ENV --token "$VERCEL_TOKEN" || true
vercel env add VITE_FIREBASE_PROJECT_ID "$VITE_FIREBASE_PROJECT_ID" $ENV --token "$VERCEL_TOKEN" || true
vercel env add VITE_FIREBASE_STORAGE_BUCKET "$VITE_FIREBASE_STORAGE_BUCKET" $ENV --token "$VERCEL_TOKEN" || true
vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID "$VITE_FIREBASE_MESSAGING_SENDER_ID" $ENV --token "$VERCEL_TOKEN" || true
vercel env add VITE_FIREBASE_APP_ID "$VITE_FIREBASE_APP_ID" $ENV --token "$VERCEL_TOKEN" || true
vercel env add VITE_FIREBASE_MEASUREMENT_ID "$VITE_FIREBASE_MEASUREMENT_ID" $ENV --token "$VERCEL_TOKEN" || true
vercel env add VITE_AUTHORIZED_UID "$VITE_AUTHORIZED_UID" $ENV --token "$VERCEL_TOKEN" || true

echo "Variables añadidas (si ya existían, Vercel puede pedir confirmación)."