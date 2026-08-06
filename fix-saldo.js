// Script para corregir saldos incorrectos en Firebase
// Ejecutar: node fix-saldo.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

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

async function fixSaldos() {
  console.log('🔍 Revisando notas...');
  const snapshot = await getDocs(collection(db, 'notas'));
  
  let corregidas = 0;
  
  for (const docSnap of snapshot.docs) {
    const nota = docSnap.data();
    const total = nota.total || 0;
    const totalAbonado = nota.totalAbonado || 0;
    const saldoCorrecto = total - totalAbonado;
    
    if (nota.saldo !== saldoCorrecto) {
      console.log(`⚠️  ${nota.folio} - ${nota.clienteNombre}`);
      console.log(`   Saldo actual: $${nota.saldo} → Correcto: $${saldoCorrecto}`);
      
      await updateDoc(doc(db, 'notas', docSnap.id), {
        saldo: saldoCorrecto
      });
      
      console.log(`   ✅ Corregido`);
      corregidas++;
    }
  }
  
  if (corregidas === 0) {
    console.log('✅ Todos los saldos están correctos');
  } else {
    console.log(`\n✅ ${corregidas} nota(s) corregida(s)`);
  }
  
  process.exit(0);
}

fixSaldos().catch(console.error);
