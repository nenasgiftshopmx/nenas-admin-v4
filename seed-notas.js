// Script para crear 20 notas de prueba en Firebase
// Ejecutar: node seed-notas.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, Timestamp } = require('firebase/firestore');

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

const TERE    = { email: 'tere@nenasgiftshop.com',    nombre: 'Tere' };
const CINTHIA = { email: 'cinthia@nenasgiftshop.com', nombre: 'Cinthia' };

const hoy = new Date();
hoy.setHours(0,0,0,0);

const fecha = (diasDesdeHoy) => {
  const d = new Date(hoy);
  d.setDate(hoy.getDate() + diasDesdeHoy);
  return { dia: String(d.getDate()), mes: String(d.getMonth()+1), anio: String(d.getFullYear()) };
};

const ts = (diasDesdeHoy = 0) => {
  const d = new Date(hoy);
  d.setDate(hoy.getDate() + diasDesdeHoy);
  return Timestamp.fromDate(d);
};

const trabajo = (id, producto, cantidad, precio, fechaDias, entregado = false, entregadoInfo = null) => {
  const t = {
    id: `trabajo_${id}`,
    producto,
    cantidad,
    precioUnitario: precio,
    subtotal: cantidad * precio,
    fechaEntrega: fecha(fechaDias),
    entregado,
  };
  if (entregado && entregadoInfo) {
    t.entregadoPor = entregadoInfo.email;
    t.entregadoPorNombre = entregadoInfo.nombre;
    t.entregadoA = entregadoInfo.entregadoA;
    t.fechaEntregaReal = ts(-1);
  }
  return t;
};

const abono = (id, monto, metodo, concepto, diasAtras = 0, quien) => ({
  id: `abono_${id}`,
  monto,
  fecha: ts(-diasAtras),
  cobradoPor: quien.email,
  cobradoPorNombre: quien.nombre,
  metodoPago: metodo,
  concepto,
  notas: '',
});

const nota = (folio, cliente, tel, evento, trabajos, abonos, asignada, diasCreacion = -7, archivada = false, notasExtra = '') => {
  const total = trabajos.reduce((s,t) => s + t.subtotal, 0);
  const totalAbonado = abonos.reduce((s,a) => s + a.monto, 0);
  return {
    folio,
    clienteNombre: cliente,
    clienteTelefono: tel,
    evento,
    trabajos,
    abonos,
    total,
    totalAbonado,
    saldo: total - totalAbonado,
    archivada,
    asignadaA: asignada.email,
    asignadaNombre: asignada.nombre,
    fechaCreacion: ts(diasCreacion),
    creadoPor: asignada.email,
    creadoPorNombre: asignada.nombre,
    ultimaModificacion: ts(diasCreacion),
    ultimaModificacionPor: asignada.email,
    ultimaModificacionNombre: asignada.nombre,
    notas: notasExtra,
  };
};

const notas = [

  // 1. NUEVA — recién creada, sin abonos, entrega futura (Tere)
  nota('NV-1001', 'María Rodríguez', '8681234001', 'Cumpleaños 15',
    [trabajo(1, 'Arreglo floral grande', 1, 850, 7),
     trabajo(2, 'Centros de mesa ×10', 10, 150, 7)],
    [], TERE, -1),

  // 2. EN PROCESO — un trabajo entregado, otro pendiente, con anticipo (Cinthia)
  nota('NV-1002', 'Laura Martínez', '8681234002', 'Boda',
    [trabajo(3, 'Ramo de novia', 1, 1200, -1, true, { ...CINTHIA, entregadoA: 'Laura' }),
     trabajo(4, 'Boutonnieres ×5', 5, 200, 5)],
    [abono(1, 500, 'efectivo', 'Anticipo', 10, CINTHIA)],
    CINTHIA, -10),

  // 3. URGENTE — entrega vencida hace 2 días, sin pagar (Tere)
  nota('NV-1003', 'Sandra López', '8681234003', 'Aniversario',
    [trabajo(5, 'Decoración mesa de dulces', 1, 2500, -2),
     trabajo(6, 'Globos metálicos ×20', 20, 45, -2)],
    [abono(2, 400, 'transferencia', 'Anticipo', 5, TERE)],
    TERE, -15),

  // 4. POR COBRAR — todo entregado, saldo pendiente (Cinthia)
  nota('NV-1004', 'Ana García', '8681234004', 'Baby Shower',
    [trabajo(7, 'Decoración baby shower', 1, 1800, -3, true, { ...CINTHIA, entregadoA: 'Ana' }),
     trabajo(8, 'Pastel personalizado', 1, 650, -3, true, { ...CINTHIA, entregadoA: 'Ana' })],
    [abono(3, 1000, 'efectivo', 'Anticipo', 7, CINTHIA)],
    CINTHIA, -20),

  // 5. COMPLETADA — todo entregado y pagado (Tere)
  nota('NV-1005', 'Verónica Sánchez', '8681234005', 'Cumpleaños',
    [trabajo(9, 'Piñata personalizada', 1, 450, -5, true, { ...TERE, entregadoA: 'Verónica' }),
     trabajo(10, 'Bolsas de dulces ×15', 15, 80, -5, true, { ...TERE, entregadoA: 'Verónica' })],
    [abono(4, 450, 'efectivo', 'Anticipo', 10, TERE),
     abono(5, 750, 'tarjeta', 'Liquidación', 5, TERE)],
    TERE, -25),

  // 6. MÚLTIPLES TRABAJOS — 4 productos, fechas distintas (Cinthia)
  nota('NV-1006', 'Patricia Flores', '8681234006', 'Graduación',
    [trabajo(11, 'Colgante de letras nombre', 1, 350, 3),
     trabajo(12, 'Arreglo de globos', 1, 600, 3),
     trabajo(13, 'Libro de firmas personalizado', 1, 280, 3),
     trabajo(14, 'Candy bar completo', 1, 1500, 3)],
    [abono(6, 1000, 'transferencia', 'Anticipo', 3, CINTHIA)],
    CINTHIA, -3),

  // 7. ENTREGA HOY — urgente del día (Tere)
  nota('NV-1007', 'Gabriela Torres', '8681234007', 'Despedida de soltera',
    [trabajo(15, 'Banda personalizada ×8', 8, 120, 0),
     trabajo(16, 'Sombrero de novia', 1, 250, 0)],
    [abono(7, 500, 'efectivo', 'Anticipo', 2, TERE)],
    TERE, -5),

  // 8. CLIENTE FRECUENTE — misma persona, nota nueva (Cinthia)
  nota('NV-1008', 'María Rodríguez', '8681234001', 'Graduación hijo',
    [trabajo(17, 'Marco de fotos personalizado', 1, 380, 10),
     trabajo(18, 'Arreglo de mesa', 1, 720, 10)],
    [abono(8, 300, 'efectivo', 'Anticipo', 1, CINTHIA)],
    CINTHIA, -2),

  // 9. GRAN PEDIDO — alto valor, múltiples abonos (Tere)
  nota('NV-1009', 'Fernanda Díaz', '8681234009', 'Boda VIP',
    [trabajo(19, 'Decoración salón completa', 1, 8500, 14),
     trabajo(20, 'Ramos de mesa ×20', 20, 350, 14),
     trabajo(21, 'Arco floral entrada', 1, 2200, 14)],
    [abono(9, 3000, 'transferencia', 'Anticipo 1', 20, TERE),
     abono(10, 2000, 'transferencia', 'Anticipo 2', 10, TERE)],
    TERE, -25),

  // 10. SIN ANTICIPO — nota nueva sin abonos (Cinthia)
  nota('NV-1010', 'Cristina Herrera', '8681234010', 'Cumpleaños',
    [trabajo(22, 'Pastel de pañales', 1, 550, 4)],
    [], CINTHIA, -1),

  // 11. VENCIDA HACE UNA SEMANA — cliente no ha recogido (Tere)
  nota('NV-1011', 'Rebeca Morales', '8681234011', 'XV Años',
    [trabajo(23, 'Corona de flores', 1, 680, -7),
     trabajo(24, 'Ramo de presentación', 1, 450, -7)],
    [abono(11, 300, 'efectivo', 'Anticipo', 14, TERE)],
    TERE, -20),

  // 12. PEDIDO PARCIAL — 1 de 3 trabajos entregado (Cinthia)
  nota('NV-1012', 'Daniela Ramírez', '8681234012', 'Baby Shower',
    [trabajo(25, 'Globo gigante personalizado', 1, 320, -1, true, { ...CINTHIA, entregadoA: 'Daniela' }),
     trabajo(26, 'Garland de flores', 1, 580, 2),
     trabajo(27, 'Mesa dulces decoración', 1, 1200, 2)],
    [abono(12, 800, 'transferencia', 'Anticipo', 5, CINTHIA)],
    CINTHIA, -8),

  // 13. LIQUIDADA COMPLETA — archivada (Tere)
  nota('NV-1013', 'Isabel Núñez', '8681234013', 'Boda',
    [trabajo(28, 'Decoración iglesia', 1, 3200, -15, true, { ...TERE, entregadoA: 'Isabel' }),
     trabajo(29, 'Ramo novia premium', 1, 1800, -15, true, { ...TERE, entregadoA: 'Isabel' })],
    [abono(13, 2500, 'efectivo', 'Anticipo', 25, TERE),
     abono(14, 2500, 'tarjeta', 'Liquidación', 15, TERE)],
    TERE, -30, true),

  // 14. ENTREGA MAÑANA — próxima urgente (Cinthia)
  nota('NV-1014', 'Alejandra Cruz', '8681234014', 'Cumpleaños mamá',
    [trabajo(30, 'Arreglo floral premium', 1, 950, 1),
     trabajo(31, 'Caja de regalos decorada', 1, 420, 1)],
    [abono(15, 600, 'efectivo', 'Anticipo', 3, CINTHIA)],
    CINTHIA, -4),

  // 15. SOLO TRANSFERENCIAS — cliente corporativo (Tere)
  nota('NV-1015', 'Empresa Eventos MX', '8681234015', 'Evento corporativo',
    [trabajo(32, 'Centros de mesa ×30', 30, 200, 6),
     trabajo(33, 'Arreglo recepción', 1, 1800, 6),
     trabajo(34, 'Decoración photobooth', 1, 2200, 6)],
    [abono(16, 5000, 'transferencia', 'Anticipo 50%', 7, TERE)],
    TERE, -7),

  // 16. ENTREGA EN 2 SEMANAS — planeación anticipada (Cinthia)
  nota('NV-1016', 'Mónica Vega', '8681234016', 'Boda íntima',
    [trabajo(35, 'Ramo novia silvestre', 1, 750, 14),
     trabajo(36, 'Arreglos mesa ×8', 8, 280, 14),
     trabajo(37, 'Pétalos camino', 1, 350, 14)],
    [abono(17, 1000, 'efectivo', 'Anticipo', 2, CINTHIA)],
    CINTHIA, -3),

  // 17. CLIENTE SIN TELÉFONO — para probar ese escenario (Tere)
  nota('NV-1017', 'Sofía Medina', '', 'Quinceañera',
    [trabajo(38, 'Tiara de flores', 1, 480, 8),
     trabajo(39, 'Ramo damas ×6', 6, 220, 8)],
    [abono(18, 400, 'efectivo', 'Anticipo', 1, TERE)],
    TERE, -2),

  // 18. URGENTE + POR COBRAR — vencida y sin liquidar (Cinthia)
  nota('NV-1018', 'Carmen Jiménez', '8681234018', 'Aniversario 25 años',
    [trabajo(40, 'Decoración romántica habitación', 1, 1600, -3, true, { ...CINTHIA, entregadoA: 'Carmen' }),
     trabajo(41, 'Arreglo de rosas ×100', 1, 1200, -3, true, { ...CINTHIA, entregadoA: 'Carmen' })],
    [abono(19, 500, 'efectivo', 'Anticipo', 10, CINTHIA)],
    CINTHIA, -15),

  // 19. PEDIDO ESPECIAL CON NOTAS — detalles específicos del cliente (Tere)
  nota('NV-1019', 'Brenda Castillo', '8681234019', 'Bautizo',
    [trabajo(42, 'Recordatorios ×50', 50, 35, 5),
     trabajo(43, 'Centro bautizo', 1, 850, 5),
     trabajo(44, 'Arreglo iglesia', 1, 1200, 5)],
    [abono(20, 1000, 'transferencia', 'Anticipo', 4, TERE)],
    TERE, -5, false, 'Colores azul bebé y blanco. Nombre: Sebastián. Coordinar entrega con mamá Rosa al 8681234020'),

  // 20. ÚLTIMA DEL MES — nota de hace un mes casi liquidada (Cinthia)
  nota('NV-1020', 'Lorena Peña', '8681234020', 'Cumpleaños adulto mayor',
    [trabajo(45, 'Arreglo floral 70 rosas', 1, 1400, -28, true, { ...CINTHIA, entregadoA: 'Lorena' }),
     trabajo(46, 'Pastel flores naturales', 1, 890, -28, true, { ...CINTHIA, entregadoA: 'Lorena' })],
    [abono(21, 1000, 'efectivo', 'Anticipo', 35, CINTHIA),
     abono(22, 1000, 'tarjeta', 'Segundo abono', 28, CINTHIA),
     abono(23, 200, 'efectivo', 'Abono', 20, CINTHIA)],
    CINTHIA, -35),

];

async function seedNotas() {
  console.log('🎀 Creando 20 notas de prueba en Firebase...\n');
  
  for (let i = 0; i < notas.length; i++) {
    const n = notas[i];
    try {
      await addDoc(collection(db, 'notas'), n);
      const estado = n.saldo === 0 ? '✅ Liquidada' :
                     n.archivada ? '🗃️  Archivada' :
                     n.trabajos.every(t => t.entregado) ? '⚠️  Por cobrar' :
                     n.trabajos.some(t => {
                       const f = new Date(parseInt(t.fechaEntrega.anio), parseInt(t.fechaEntrega.mes)-1, parseInt(t.fechaEntrega.dia));
                       return !t.entregado && f < new Date();
                     }) ? '🔥 Urgente' : '💼 Activa';
      console.log(`${estado} ${n.folio} — ${n.clienteNombre} — $${n.total.toLocaleString()} — ${n.asignadaNombre}`);
    } catch (error) {
      console.error(`❌ Error en ${n.folio}:`, error.message);
    }
  }
  
  console.log('\n✅ Listo. Abre https://nenas-admin-v4.vercel.app para ver las notas.');
  process.exit(0);
}

seedNotas().catch(console.error);
