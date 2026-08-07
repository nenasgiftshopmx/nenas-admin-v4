// ==================== SISTEMA OPTIMIZADO - TYPES ====================

export interface Trabajo {
  id: string;
  producto: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  detalles?: string;
  fotos?: string[];
  fechaEntrega: {
    dia: string;
    mes: string;
    anio: string;
    hora?: string;
  };
  entregado: boolean;
  entregadoPor?: string;
  entregadoPorNombre?: string;
  entregadoA?: string;
  fechaEntregaReal?: any;
}

export interface Abono {
  id: string;
  monto: number;
  fecha: any;
  cobradoPor: string;
  cobradoPorNombre: string;
  metodoPago: 'efectivo' | 'transferencia' | 'tarjeta';
  concepto: string;
  notas?: string;
}

export interface Nota {
  id?: string;
  folio: string;

  // CLIENTE
  clienteId?: string;
  clienteNombre: string;
  clienteTelefono: string;
  visitaNumero?: number;

  // IMÁGENES DE REFERENCIA ← NUEVO
  imagenes?: string[]; // URLs de Firebase Storage (máx 2)

  // METADATA
  fechaCreacion: any;
  creadoPor: string;
  creadoPorNombre: string;

  // ASIGNACIÓN
  asignadaA?: string;
  asignadaNombre?: string;

  // TRABAJOS
  trabajos: Trabajo[];

  // FINANCIERO
  total: number;
  abonos: Abono[];
  totalAbonado: number;
  saldo: number;

  // ARCHIVO
  archivada: boolean;
  fechaArchivo?: any;

  // NOTAS ADICIONALES
  notas?: string;
  evento?: string;

  // AUDITORÍA
  ultimaModificacion: any;
  ultimaModificacionPor: string;
  ultimaModificacionNombre: string;
}

export interface Cliente {
  id?: string;
  nombre: string;
  telefono: string;
  email?: string;
  totalVisitas: number;
  totalGastado: number;
  ultimaVisita?: any;
  ocasionesRecurrentes?: string[];
  notas?: string;
  createdAt?: any;
}

export interface Producto {
  id?: string;
  nombre: string;
  categoria: string;
  precioBase: number;
  precioDocena?: number;
  precioMayoreo?: number;
  cantidadMayoreo?: number;
  descripcion?: string;
  tiempoPreparacion?: number;
  stock?: number;
  activo: boolean;
  vecesVendido?: number;
  createdAt?: any;
}

export interface AuditLog {
  id?: string;
  notaId: string;
  notaFolio: string;
  accion: 'crear' | 'editar' | 'eliminar' | 'entregar' | 'cobrar' | 'archivar';
  usuario: string;
  usuarioNombre: string;
  fecha: any;
  detalles: string;
  cambios?: {
    campo: string;
    antes: any;
    despues: any;
  }[];
}

export interface Usuario {
  uid: string;
  email: string;
  nombre: string;
  rol: 'admin' | 'colaboradora' | 'solo_lectura';
  color: string;
  activo: boolean;
}

export type EstadoNota =
  | 'nueva'
  | 'en_proceso'
  | 'parcial'
  | 'por_cobrar'
  | 'completada'
  | 'urgente';

export interface ReporteVentas {
  periodo: string;
  totalVentas: number;
  totalCobrado: number;
  porCobrar: number;
  notasCompletadas: number;
  notasPendientes: number;
}

export interface CuentaPorCobrar {
  notaId: string;
  folio: string;
  cliente: string;
  total: number;
  abonado: number;
  saldo: number;
  diasVencido?: number;
  ultimaEntrega?: any;
}
