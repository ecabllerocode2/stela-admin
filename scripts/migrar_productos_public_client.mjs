import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';

// Configuración: mismos valores que en src/credenciales.ts (sin modificar ese archivo)
const firebaseConfig = {
  apiKey: "AIzaSyAcPmOLCEeL5sRenwhtTWCIBawWNcnD4Ls",
  authDomain: "malim-app.firebaseapp.com",
  projectId: "malim-app",
  storageBucket: "malim-app.firebasestorage.app",
  messagingSenderId: "953747301080",
  appId: "1:953747301080:web:d3cfd18e9be012bb822dad",
  measurementId: "G-9DD5YEX28R"
};

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
  console.log('Iniciando migración productos -> productos_public ...');
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
