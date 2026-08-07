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
    if (updateData.total === undefined) {
      const notaActual = await getNota(id);
      updateData.total = notaActual?.total ?? 0;
    }
    updateData.saldo = updateData.total - updateData.totalAbonado;
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

export async function getCliente(id: string): Promise<Cliente | null> {
  try {
    const docRef = doc(db, 'clientes', id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Cliente : null;
  } catch (error) {
    console.error('Error obteniendo cliente:', error);
    return null;
  }
}

export async function createCliente(data: Omit<Cliente, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'clientes'), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateCliente(id: string, data: Partial<Cliente>): Promise<void> {
  try {
    const docRef = doc(db, 'clientes', id);
    await updateDoc(docRef, data);
  } catch (error) {
    console.error('Error actualizando cliente:', error);
    throw error;
  }
}

export async function deleteCliente(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'clientes', id));
  } catch (error) {
    console.error('Error eliminando cliente:', error);
    throw error;
  }
}

export async function buscarClientes(searchTerm: string): Promise<Cliente[]> {
  try {
    if (!searchTerm.trim()) {
      return await getClientes();
    }
    
    const termino = searchTerm.toLowerCase();
    const clientes = await getClientes();
    
    return clientes.filter(c => 
      c.nombre.toLowerCase().includes(termino) ||
      c.telefono.includes(termino) ||
      (c.email && c.email.toLowerCase().includes(termino))
    );
  } catch (error) {
    console.error('Error buscando clientes:', error);
    return [];
  }
}

export async function obtenerClientePorNombreTelefono(nombre: string, telefono: string): Promise<Cliente | null> {
  try {
    const clientes = await getClientes();
    return clientes.find(c => 
      c.nombre.toLowerCase() === nombre.toLowerCase() && 
      c.telefono === telefono
    ) || null;
  } catch (error) {
    console.error('Error buscando cliente:', error);
    return null;
  }
}

export async function obtenerOCrearCliente(nombre: string, telefono: string, email?: string): Promise<string> {
  try {
    // Buscar si existe
    const clienteExistente = await obtenerClientePorNombreTelefono(nombre, telefono);
    if (clienteExistente && clienteExistente.id) {
      return clienteExistente.id;
    }
    
    // No existe, crear nuevo
    const clienteData: Omit<Cliente, 'id'> = {
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      email: email?.trim() || undefined,
      totalVisitas: 0,
      totalGastado: 0,
    };
    
    return await createCliente(clienteData);
  } catch (error) {
    console.error('Error en obtenerOCrearCliente:', error);
    throw error;
  }
}

export async function actualizarEstadisticasCliente(
  clienteId: string,
  montoVenta: number
): Promise<void> {
  try {
    const cliente = await getCliente(clienteId);
    if (!cliente) return;
    
    await updateCliente(clienteId, {
      totalVisitas: (cliente.totalVisitas || 0) + 1,
      totalGastado: (cliente.totalGastado || 0) + montoVenta,
      ultimaVisita: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error actualizando estadísticas del cliente:', error);
  }
}

// ==================== PRODUCTOS ====================

export async function getProductos(): Promise<Producto[]> {
  const snapshot = await getDocs(collection(db, 'productos'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Producto));
}

export async function getProducto(id: string): Promise<Producto | null> {
  try {
    const docRef = doc(db, 'productos', id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Producto : null;
  } catch (error) {
    console.error('Error obteniendo producto:', error);
    return null;
  }
}

export async function createProducto(data: Omit<Producto, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'productos'), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateProducto(id: string, data: Partial<Producto>): Promise<void> {
  try {
    const docRef = doc(db, 'productos', id);
    await updateDoc(docRef, data);
  } catch (error) {
    console.error('Error actualizando producto:', error);
    throw error;
  }
}

export async function deleteProducto(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'productos', id));
  } catch (error) {
    console.error('Error eliminando producto:', error);
    throw error;
  }
}

export async function buscarProductos(searchTerm: string): Promise<Producto[]> {
  try {
    if (!searchTerm.trim()) {
      return await getProductos();
    }
    
    const termino = searchTerm.toLowerCase();
    const productos = await getProductos();
    
    return productos.filter(p => 
      p.nombre.toLowerCase().includes(termino) ||
      (p.categoria && p.categoria.toLowerCase().includes(termino)) ||
      (p.descripcion && p.descripcion.toLowerCase().includes(termino))
    );
  } catch (error) {
    console.error('Error buscando productos:', error);
    return [];
  }
}

export async function getProductosPorCategoria(categoria: string): Promise<Producto[]> {
  try {
    const productos = await getProductos();
    return productos.filter(p => p.categoria.toLowerCase() === categoria.toLowerCase());
  } catch (error) {
    console.error('Error obteniendo productos por categoría:', error);
    return [];
  }
}

export async function getProductosDestacados(): Promise<Producto[]> {
  try {
    const productos = await getProductos();
    return productos
      .filter(p => p.activo)
      .sort((a, b) => (b.vecesVendido || 0) - (a.vecesVendido || 0))
      .slice(0, 10);
  } catch (error) {
    console.error('Error obteniendo productos destacados:', error);
    return [];
  }
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
  if (nota.saldo <= 0) estadoPagos = 'liquidada';
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

export async function contar(coleccion: 'clientes' | 'productos'): Promise<number> {
  try {
    if (coleccion === 'clientes') {
      const clientes = await getClientes();
      return clientes.length;
    } else {
      const productos = await getProductos();
      return productos.length;
    }
  } catch (error) {
    console.error('Error contando:', error);
    return 0;
  }
}

// ===== CATEGORÍAS =====

export async function getCategorias() {
  try {
    const snap = await getDocs(collection(db, 'categorias'));
    return snap.docs.map(d => ({
      id: d.id,
      nombre: d.data().nombre,
      fechaCreacion: d.data().fechaCreacion,
    }));
  } catch (e) {
    console.error('Error getting categorías:', e);
    return [];
  }
}

export async function addCategoria(nombre: string) {
  try {
    const docRef = await addDoc(collection(db, 'categorias'), {
      nombre,
      fechaCreacion: new Date(),
    });
    return docRef.id;
  } catch (e) {
    console.error('Error adding categoría:', e);
    throw e;
  }
}

export async function updateCategoria(id: string, nombre: string) {
  try {
    await updateDoc(doc(db, 'categorias', id), {
      nombre,
      fechaActualizacion: new Date(),
    });
  } catch (e) {
    console.error('Error updating categoría:', e);
    throw e;
  }
}

export async function deleteCategoria(id: string) {
  try {
    await deleteDoc(doc(db, 'categorias', id));
  } catch (e) {
    console.error('Error deleting categoría:', e);
    throw e;
  }
}
