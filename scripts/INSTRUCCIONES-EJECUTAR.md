# 🔑 Instrucciones para Ejecutar el Script

## Paso 1: Obtener la Clave de Servicio

El script necesita autenticación de Firebase Admin. Tienes 2 opciones:

### Opción A: Descargar Clave de Servicio (Recomendado - 2 minutos)

1. Ve a: https://console.firebase.google.com/project/stela-a8c06/settings/serviceaccounts/adminsdk
2. Click en **"Generar nueva clave privada"**
3. Se descargará un archivo JSON
4. **Guárdalo** como: `/workspaces/intranet-malim/scripts/service-account-key.json`

### Opción B: Usar Variables de Entorno

Si ya tienes una clave, puedes exportar las credenciales:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/ruta/a/tu/service-account-key.json"
```

## Paso 2: Instalar Dependencias (si es necesario)

```bash
cd /workspaces/intranet-malim/scripts
npm install
```

## Paso 3: Ejecutar el Script

```bash
cd /workspaces/intranet-malim
node scripts/generar-perfiles-clientes.js
```

## ⚠️ Seguridad

El archivo `service-account-key.json` contiene credenciales sensibles.
**NO lo subas a GitHub** - ya está en `.gitignore`

## 🔧 Alternativa: Script sin Firebase Admin

Si prefieres no usar Firebase Admin, puedo crear una versión del script que:
- Se ejecute desde el frontend
- Use las credenciales web que ya tienes
- Se active con un botón en la interfaz de Clientes

¿Prefieres esta opción?
