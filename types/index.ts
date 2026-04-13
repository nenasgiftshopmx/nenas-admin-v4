// ==================== SISTEMA OPTIMIZADO - TYPES ====================

// ==================== TRABAJO/PRODUCTO EN UNA NOTA ====================
export interface Trabajo {
  id: string; // ID único del trabajo
  producto: string; // Nombre del producto
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  detalles?: string; // Especificaciones
  fotos?: string[]; // URLs de Cloudinary
  
  // Entrega de este trabajo específico
  fechaEntrega: {
    dia: string;
    mes: string;
    anio: string;
    hora?: string; // Opcional: "10:00 AM", "Tarde", etc
  };
  
  // Estado de entrega de este trabajo
  entregado: boolean;
  entregadoPor?: string; // Email
  entregadoPorNombre?: string;
  entregadoA?: string; // Quien recibió
  fechaEntregaReal?: any; // Timestamp
}

// ==================== ABONO/PAGO ====================
export interface Abono {
  id: string;
  monto: number;
  fecha: any; // Timestamp
  cobradoPor: string; // Email
  cobradoPorNombre: string;
  metodoPago: 'efectivo' | 'transferencia' | 'tarjeta';
  concepto: string; // "Anticipo", "Abono parcial", "Liquidación"
  notas?: string;
}

// ==================== NOTA (PEDIDO COMPLETO) ====================
export interface Nota {
  id?: string;
  folio: string; // NV-XXXX
  
  // CLIENTE
  clienteId?: string; // Referencia al cliente
  clienteNombre: string;
  clienteTelefono: string;
  visitaNumero?: number; // Cuántas veces ha venido este cliente
  
  // METADATA
  fechaCreacion: any; // Timestamp
  creadoPor: string; // Email
  creadoPorNombre: string;
  
  // ASIGNACIÓN
  asignadaA?: string; // Email (Tere/Cinthia/Vero)
  asignadaNombre?: string;
  
  // TRABAJOS (1 a N trabajos en esta visita)
  trabajos: Trabajo[];
  
  // FINANCIERO
  total: number; // Calculado automáticamente
  abonos: Abono[]; // Timeline de pagos
  totalAbonado: number; // Calculado
  saldo: number; // Calculado
  
  // ESTADOS CALCULADOS (no se guardan, se calculan en tiempo real)
  // estadoEntregas: 'pendiente' | 'parcial' | 'completa'
  // estadoPagos: 'sin_pagar' | 'abonos' | 'liquidada'
  // estadoGeneral: 'nueva' | 'en_proceso' | 'urgente' | 'completada'
  
  // ARCHIVO
  archivada: boolean;
  fechaArchivo?: any;
  
  // NOTAS ADICIONALES
  notas?: string;
  evento?: string; // "Cumpleaños", "Boda", etc
  
  // AUDITORÍA
  ultimaModificacion: any;
  ultimaModificacionPor: string;
  ultimaModificacionNombre: string;
}

// ==================== CLIENTE ====================
export interface Cliente {
  id?: string;
  nombre: string;
  telefono: string;
  email?: string;
  
  // Estadísticas
  totalVisitas: number; // Cuántas notas tiene
  totalGastado: number;
  ultimaVisita?: any; // Timestamp
  
  // Preferencias (opcional)
  ocasionesRecurrentes?: string[]; // ["Cumpleaños hijo", "Aniversario"]
  notas?: string;
  
  createdAt?: any;
}

// ==================== PRODUCTO (CATÁLOGO) ====================
export interface Producto {
  id?: string;
  nombre: string;
  categoria: string;
  
  // Precios
  precioBase: number;
  precioDocena?: number;
  precioMayoreo?: number;
  cantidadMayoreo?: number;
  
  // Info
  descripcion?: string;
  tiempoPreparacion?: number; // días
  stock?: number;
  activo: boolean;
  
  // Estadísticas
  vecesVendido?: number;
  
  createdAt?: any;
}

// ==================== AUDITORÍA ====================
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

// ==================== USUARIO ====================
export interface Usuario {
  uid: string;
  email: string;
  nombre: string;
  rol: 'admin' | 'colaboradora' | 'solo_lectura';
  color: string; // Para calendario
  activo: boolean;
}

// ==================== TIPOS AUXILIARES ====================

// Para el dashboard y filtros
export type EstadoNota = 
  | 'nueva'           // Recién creada
  | 'en_proceso'      // Tiene trabajos pendientes
  | 'parcial'         // Algunos trabajos entregados
  | 'por_cobrar'      // Todo entregado pero falta pago
  | 'completada'      // Todo entregado y pagado
  | 'urgente';        // Tiene entregas vencidas

// Para reportes
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
