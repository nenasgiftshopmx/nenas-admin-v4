// Script para eliminar todas las notas de prueba de Firebase
// Ejecutar: node limpiar-notas.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBGxUY_Pnzv6XwcBTqWJ6KDplQ2DPgJpTk",
  authDomain: "nenas-admin.firebaseapp.com",
  projectId: "nenas-admin",
  storageBucket: "nenas-admin.firebasestorage.app",
  messagingSenderId: "416408781689",
  appId: "1:416408781689:web:72dd6ee7d85a4eda5ee5a8",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function limpiarNotas() {
  console.log('🧹 Eliminando todas las notas de prueba...\n');

  const snapshot = await getDocs(collection(db, 'notas'));

  if (snapshot.empty) {
    console.log('✅ No hay notas que eliminar.');
    process.exit(0);
  }

  console.log(`📋 Encontradas ${snapshot.docs.length} notas. Eliminando...\n`);

  for (const docSnap of snapshot.docs) {
    const nota = docSnap.data();
    await deleteDoc(doc(db, 'notas', docSnap.id));
    console.log(`🗑️  Eliminada: ${nota.folio} — ${nota.clienteNombre}`);
  }

  console.log(`\n✅ Listo. ${snapshot.docs.length} notas eliminadas.`);
  console.log('🎀 La app está limpia y lista para Verónica.');
  process.exit(0);
}

limpiarNotas().catch(console.error);
