import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { Nota, Trabajo, Abono, Cliente, Producto } from '@/types';

// ==================== NOTAS ====================

export async function getNotas(): Promise<Nota[]> {
  const q = query(collection(db, 'notas'), orderBy('fechaCreacion', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Nota));
}

export async function getNota(id: string): Promise<Nota | null> {
  const docRef = doc(db, 'notas', id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Nota : null;
}

export async function createNota(
  data: Omit<Nota, 'id'>,
  usuario: { email: string; nombre: string }
): Promise<string> {
  const notaData = {
    ...data,
    fechaCreacion: Timestamp.now(),
    creadoPor: usuario.email,
    creadoPorNombre: usuario.nombre,
    ultimaModificacion: Timestamp.now(),
    ultimaModificacionPor: usuario.email,
    ultimaModificacionNombre: usuario.nombre,
    archivada: false,
    total: calcularTotal(data.trabajos),
    totalAbonado: data.abonos.reduce((sum, a) => sum + a.monto, 0),
    saldo: calcularTotal(data.trabajos) - data.abonos.reduce((sum, a) => sum + a.monto, 0),
  };
  
  const docRef = await addDoc(collection(db, 'notas'), notaData);
  
  // Registrar en auditoría
  await registrarAuditoria({
    notaId: docRef.id,
    notaFolio: data.folio,
    accion: 'crear',
    usuario: usuario.email,
    usuarioNombre: usuario.nombre,
    detalles: `Nota creada: ${data.clienteNombre}`,
  });
  
  return docRef.id;
}

export async function updateNota(
  id: string,
  data: Partial<Nota>,
  usuario: { email: string; nombre: string }
): Promise<void> {
  const docRef = doc(db, 'notas', id);
  
  const updateData = {
    ...data,
    ultimaModificacion: Timestamp.now(),
    ultimaModificacionPor: usuario.email,
    ultimaModificacionNombre: usuario.nombre,
  };
  
  if (data.trabajos) {
    updateData.total = calcularTotal(data.trabajos);
  }
  
  if (data.abonos) {
    updateData.totalAbonado = data.abonos.reduce((sum, a) => sum + a.monto, 0);
    updateData.saldo = (updateData.total || 0) - updateData.totalAbonado;
  }
  
  await updateDoc(docRef, updateData);
  
  const nota = await getNota(id);
  if (nota) {
    await registrarAuditoria({
      notaId: id,
      notaFolio: nota.folio,
      accion: 'editar',
      usuario: usuario.email,
      usuarioNombre: usuario.nombre,
      detalles: 'Nota actualizada',
    });
  }
}

export async function deleteNota(id: string, usuario: { email: string; nombre: string }): Promise<void> {
  const nota = await getNota(id);
  if (nota) {
    await registrarAuditoria({
      notaId: id,
      notaFolio: nota.folio,
      accion: 'eliminar',
      usuario: usuario.email,
      usuarioNombre: usuario.nombre,
      detalles: `Nota eliminada: ${nota.clienteNombre}`,
    });
  }
  
  await deleteDoc(doc(db, 'notas', id));
}

// ==================== TRABAJOS ====================

export async function marcarTrabajoEntregado(
  notaId: string,
  trabajoId: string,
  usuario: { email: string; nombre: string },
  entregadoA: string
): Promise<void> {
  const nota = await getNota(notaId);
  if (!nota) return;
  
  const trabajos = nota.trabajos.map(t => {
    if (t.id === trabajoId) {
      return {
        ...t,
        entregado: true,
        entregadoPor: usuario.email,
        entregadoPorNombre: usuario.nombre,
        entregadoA,
        fechaEntregaReal: Timestamp.now(),
      };
    }
    return t;
  });
  
  await updateNota(notaId, { trabajos }, usuario);
  
  await registrarAuditoria({
    notaId,
    notaFolio: nota.folio,
    accion: 'entregar',
    usuario: usuario.email,
    usuarioNombre: usuario.nombre,
    detalles: `Trabajo entregado a ${entregadoA}`,
  });
}

// ==================== ABONOS ====================

export async function registrarAbono(
  notaId: string,
  abono: Omit<Abono, 'id' | 'fecha'>,
  usuario: { email: string; nombre: string }
): Promise<void> {
  const nota = await getNota(notaId);
  if (!nota) return;
  
  const nuevoAbono: Abono = {
    ...abono,
    id: `abono_${Date.now()}`,
    fecha: Timestamp.now(),
  };
  
  const abonos = [...nota.abonos, nuevoAbono];
  
  await updateNota(notaId, { abonos }, usuario);
  
  await registrarAuditoria({
    notaId,
    notaFolio: nota.folio,
    accion: 'cobrar',
    usuario: usuario.email,
    usuarioNombre: usuario.nombre,
    detalles: `Abono registrado: $${abono.monto}`,
  });
}

// ==================== ARCHIVO ====================

export async function archivarNota(
  notaId: string,
  usuario: { email: string; nombre: string }
): Promise<void> {
  await updateNota(
    notaId,
    {
      archivada: true,
      fechaArchivo: Timestamp.now(),
    },
    usuario
  );
}

export async function desarchivarNota(
  notaId: string,
  usuario: { email: string; nombre: string }
): Promise<void> {
  await updateNota(
    notaId,
    {
      archivada: false,
      fechaArchivo: null,
    },
    usuario
  );
}

// ==================== CLIENTES ====================

export async function getClientes(): Promise<Cliente[]> {
  const snapshot = await getDocs(collection(db, 'clientes'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente));
}

export async function createCliente(data: Omit<Cliente, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'clientes'), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

// ==================== PRODUCTOS ====================

export async function getProductos(): Promise<Producto[]> {
  const snapshot = await getDocs(collection(db, 'productos'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Producto));
}

export async function createProducto(data: Omit<Producto, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'productos'), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

// ==================== AUDITORÍA ====================

async function registrarAuditoria(data: {
  notaId: string;
  notaFolio: string;
  accion: string;
  usuario: string;
  usuarioNombre: string;
  detalles: string;
}): Promise<void> {
  await addDoc(collection(db, 'auditoria'), {
    ...data,
    fecha: Timestamp.now(),
  });
}

// ==================== UTILIDADES ====================

function calcularTotal(trabajos: Trabajo[]): number {
  return trabajos.reduce((sum, t) => sum + t.subtotal, 0);
}

export function calcularEstadoNota(nota: Nota): {
  estadoEntregas: 'pendiente' | 'parcial' | 'completa';
  estadoPagos: 'sin_pagar' | 'abonos' | 'liquidada';
  estadoGeneral: 'nueva' | 'en_proceso' | 'urgente' | 'por_cobrar' | 'completada';
} {
  const trabajosEntregados = nota.trabajos.filter(t => t.entregado).length;
  const totalTrabajos = nota.trabajos.length;
  
  let estadoEntregas: 'pendiente' | 'parcial' | 'completa' = 'pendiente';
  if (trabajosEntregados === totalTrabajos) estadoEntregas = 'completa';
  else if (trabajosEntregados > 0) estadoEntregas = 'parcial';
  
  let estadoPagos: 'sin_pagar' | 'abonos' | 'liquidada' = 'sin_pagar';
  if (nota.saldo === 0) estadoPagos = 'liquidada';
  else if (nota.totalAbonado > 0) estadoPagos = 'abonos';
  
  let estadoGeneral: 'nueva' | 'en_proceso' | 'urgente' | 'por_cobrar' | 'completada' = 'nueva';
  
  if (estadoEntregas === 'completa' && estadoPagos === 'liquidada') {
    estadoGeneral = 'completada';
  } else if (estadoEntregas === 'completa' && estadoPagos !== 'liquidada') {
    estadoGeneral = 'por_cobrar';
  } else if (tieneEntregasVencidas(nota)) {
    estadoGeneral = 'urgente';
  } else if (trabajosEntregados > 0 || nota.totalAbonado > 0) {
    estadoGeneral = 'en_proceso';
  }
  
  return { estadoEntregas, estadoPagos, estadoGeneral };
}

export function tieneEntregasVencidas(nota: Nota): boolean {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  return nota.trabajos.some(t => {
    if (t.entregado) return false;
    
    const fechaEntrega = new Date(
      parseInt(t.fechaEntrega.anio),
      parseInt(t.fechaEntrega.mes) - 1,
      parseInt(t.fechaEntrega.dia)
    );
    
    return fechaEntrega < hoy;
  });
}

export function generarFolio(): string {
  return 'NV-' + String(Math.floor(Math.random() * 9000) + 1000);
}
