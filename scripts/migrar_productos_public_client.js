/*
 * Migración productos -> productos_public (sin costos/proveedor)
 * Usa el mismo config del frontend (src/credenciales.ts) sin modificarlo.
 * Requiere reglas abiertas o un usuario con permisos de escritura.
 *
 * Ejecución (Node 18+):
 *   npm install ts-node firebase
 *   node -r ts-node/register/transpile-only scripts/migrar_productos_public_client.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } = require('firebase/firestore');
const { firebaseConfig } = require('../src/credenciales');

const buildPublicProduct = (data) => ({
  name: data.name || '',
  productSku: data.productSku || '',
  category: data.category || '',
  publicPrice: data.publicPrice || 0,
  offerPercentage: data.offerPercentage || 0,
  shortDetails: data.shortDetails || '',
  longDescription: data.longDescription || '',
  publishOnline: !!data.publishOnline,
  dateAdded: data.dateAdded || Date.now(),
  variants: (data.variants || []).map((v) => ({
    id: v.id,
    variantSku: v.variantSku,
    colorName: v.colorName,
    hexColor: v.hexColor,
    imageUrls: v.imageUrls || [],
    sizes: (v.sizes || []).map((s) => ({
      size: s.size,
      stock: s.stock,
      isInStock: s.isInStock,
    })),
  })),
});

async function migrate() {
  console.log('Iniciando migración...');
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const snap = await getDocs(collection(db, 'productos'));
  let published = 0;
  let removed = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const ref = doc(db, 'productos_public', docSnap.id);

    if (data.publishOnline) {
      const pub = buildPublicProduct(data);
      await setDoc(ref, pub, { merge: true });
      published += 1;
    } else {
      await deleteDoc(ref).catch(() => {});
      removed += 1;
    }
  }

  console.log(`Migración completa. Publicados: ${published}, removidos: ${removed}`);
}

migrate().catch((err) => {
  console.error('Error en migración:', err);
  process.exit(1);
});
