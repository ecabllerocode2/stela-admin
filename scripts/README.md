# 📜 Scripts de Utilidad - Malim Intranet

## 📦 Contenido

### `generar-perfiles-clientes.js`
Script para analizar el historial de pedidos y generar/actualizar perfiles de cliente con métricas de negocio.

---

## 🚀 Instalación y Configuración

### 1. Instalar Dependencias

```bash
cd scripts
npm install firebase-admin
```

### 2. Obtener Credenciales de Firebase Admin

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: `malim-app`
3. Ve a **Configuración del proyecto** (⚙️)
4. Pestaña **Cuentas de servicio**
5. Click en **Generar nueva clave privada**
6. Descarga el archivo JSON
7. **Renómbralo** como `firebase-admin-key.json`
8. **Guárdalo** en la carpeta `scripts/`

```
scripts/
├── generar-perfiles-clientes.js
├── firebase-admin-key.json  ← Aquí
└── README.md
```

⚠️ **IMPORTANTE**: Este archivo contiene credenciales sensibles. Ya está incluido en `.gitignore`

---

## 📊 Script: Generar Perfiles de Clientes

### ¿Qué hace?

1. ✅ Lee todos los clientes de Firestore
2. ✅ Para cada cliente, busca sus pedidos en la colección `ordenes`
3. ✅ Calcula métricas de negocio:
   - Frecuencia de compra
   - Recencia (días desde última compra)
   - Gasto promedio y presupuesto máximo
   - Preferencias (categorías, colores, tallas favoritas)
   - Satisfacción estimada
   - Clasificación (activo/inactivo/nuevo)
4. ✅ Actualiza el documento del cliente con el perfil generado

### Uso Básico

```bash
# Desde la raíz del proyecto
node scripts/generar-perfiles-clientes.js
```

### Salida Esperada

```
🚀 Iniciando generación de perfiles de clientes...

📅 Período de análisis: últimos 365 días
⚙️  Umbrales: Activo ≤90d | Riesgo >180d

👥 Total de clientes encontrados: 148

────────────────────────────────────────────────────────────

📊 Analizando: María López...
   📦 Pedidos encontrados: 12 (8 en últimos 12m)
   ✅ Perfil generado:
      - Tipo: activo
      - Pedidos: 8
      - Última compra: 15 días atrás
      - Gasto promedio: $420
      - Satisfacción: 4.2/5

📊 Analizando: Carlos Pérez...
   📦 Pedidos encontrados: 3 (3 en últimos 12m)
   ✅ Perfil generado:
      - Tipo: activo
      - Pedidos: 3
      - Última compra: 45 días atrás
      - Gasto promedio: $280
      - Satisfacción: 3.8/5

⏳ Progreso: 10/148 clientes procesados...

[... continúa ...]

════════════════════════════════════════════════════════════
✨ RESUMEN DE EJECUCIÓN
════════════════════════════════════════════════════════════
✅ Clientes procesados: 148
💾 Perfiles actualizados: 145
❌ Errores: 3
════════════════════════════════════════════════════════════

🎉 ¡Todos los perfiles se generaron correctamente!

✅ Script completado
```

### Configuración Avanzada

Puedes ajustar los umbrales editando la constante `CONFIG` en el script:

```javascript
const CONFIG = {
  // Período de análisis en días
  PERIODO_ANALISIS_DIAS: 365,  // Cambiar a 180 para 6 meses
  
  // Umbrales para clasificación
  DIAS_CLIENTE_ACTIVO: 90,     // Cambiar a 60 para ser más estricto
  DIAS_CLIENTE_RIESGO: 180,
  MIN_PEDIDOS_ACTIVO: 2,       // Cambiar a 3 para mayor exigencia
  
  // Top preferencias
  TOP_CATEGORIAS: 5,           // Top 5 categorías favoritas
  TOP_COLORES: 5,
  TOP_PRENDAS: 10,
  TOP_TALLAS: 3,
};
```

---

## ⚙️ Automatización

### Opción 1: Cron Job (Diario)

```bash
# Agregar a crontab (Linux/Mac)
crontab -e

# Ejecutar todos los días a las 2 AM
0 2 * * * cd /ruta/al/proyecto && node scripts/generar-perfiles-clientes.js >> logs/perfiles.log 2>&1
```

### Opción 2: GitHub Actions (Recomendado)

Crear `.github/workflows/actualizar-perfiles.yml`:

```yaml
name: Actualizar Perfiles de Clientes

on:
  schedule:
    # Ejecutar cada día a las 3 AM UTC
    - cron: '0 3 * * *'
  workflow_dispatch: # Permite ejecutar manualmente

jobs:
  actualizar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Instalar dependencias
        run: |
          cd scripts
          npm install
      
      - name: Crear archivo de credenciales
        run: |
          echo '${{ secrets.FIREBASE_ADMIN_KEY }}' > scripts/firebase-admin-key.json
      
      - name: Ejecutar script
        run: node scripts/generar-perfiles-clientes.js
      
      - name: Limpiar credenciales
        if: always()
        run: rm -f scripts/firebase-admin-key.json
```

**Setup:**
1. Ve a tu repositorio en GitHub
2. Settings → Secrets and variables → Actions
3. New repository secret
4. Nombre: `FIREBASE_ADMIN_KEY`
5. Valor: Contenido completo del archivo `firebase-admin-key.json`

---

## 🔍 Troubleshooting

### Error: "No se encontró el archivo firebase-admin-key.json"

**Solución**: Asegúrate de haber descargado y guardado el archivo de credenciales en `scripts/firebase-admin-key.json`

### Error: "Permission denied"

**Solución**: Verifica que la cuenta de servicio tenga permisos de lectura/escritura en Firestore:
1. Firebase Console → Firestore Database → Rules
2. Asegúrate que las reglas permitan acceso desde el servidor

### Error: "ECONNREFUSED" o timeouts

**Solución**: Verifica tu conexión a internet y que Firebase esté accesible.

### Error: "Customer with XX credit"

**Solución**: Asegúrate de tener un plan de pago activo en Firebase (Blaze plan) si tienes muchos clientes.

---

## 📈 Mejores Prácticas

### ✅ Hacer

- ✅ Ejecutar el script en horarios de bajo tráfico (madrugada)
- ✅ Hacer backup de Firestore antes de la primera ejecución
- ✅ Revisar los logs para detectar errores
- ✅ Monitorear el uso de Firestore después de ejecutar

### ❌ Evitar

- ❌ Ejecutar durante horas pico de la aplicación
- ❌ Modificar manualmente perfiles después del script (se sobrescribirán)
- ❌ Compartir el archivo `firebase-admin-key.json` (¡es secreto!)
- ❌ Ejecutar múltiples instancias simultáneamente

---

## 🔮 Próximos Pasos

Después de ejecutar este script, considera:

1. **Implementar Cloud Functions** para actualizaciones en tiempo real
2. **Añadir sistema de satisfacción** para datos más precisos
3. **Migrar a subcolecciones** para mejor organización
4. **Crear dashboard de análisis** para visualizar tendencias

Ver: `ANALISIS-CATEGORIZACION-CLIENTES.md` para más detalles.

---

## 📞 Soporte

Si tienes problemas ejecutando el script:

1. Revisa los logs de error
2. Verifica las credenciales de Firebase
3. Asegúrate de tener Node.js v16 o superior
4. Consulta el archivo `ANALISIS-CATEGORIZACION-CLIENTES.md`

---

## 📝 Changelog

### v1.0.0 (2025-12-25)
- ✨ Primera versión del script
- 📊 Análisis de 365 días de historial
- 🎯 Clasificación en 4 categorías (VIP, Regular, Riesgo, Inactivo)
- 📈 Cálculo de 20+ métricas de negocio
- 🔄 Actualización automática en Firestore
