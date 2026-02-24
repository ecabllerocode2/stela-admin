// Script para generar public/version.json y actualizar el CACHE_NAME del SW en cada build
import { writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const buildId = Math.random().toString(36).substring(2, 15);

const version = {
  timestamp: Date.now(),
  date: new Date().toISOString(),
  buildId,
};

// 1. Escribir public/version.json
writeFileSync(
  resolve(__dirname, 'public', 'version.json'),
  JSON.stringify(version, null, 2)
);
console.log('✅ Version file generated:', version);

// 2. Actualizar CACHE_NAME en public/sw.js para invalidar caché en cada deploy
const swPath = resolve(__dirname, 'public', 'sw.js');
let swContent = readFileSync(swPath, 'utf-8');
swContent = swContent.replace(
  /const CACHE_NAME = ['"`][^'"`]*['"`]/,
  `const CACHE_NAME = 'stela-admin-${buildId}'`
);
writeFileSync(swPath, swContent);
console.log('✅ Service Worker cache name actualizado: stela-admin-' + buildId);
