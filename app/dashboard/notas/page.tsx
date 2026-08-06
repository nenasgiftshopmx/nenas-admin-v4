'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useRouter } from 'next/navigation';
import {
  getNotas, createNota, updateNota, deleteNota,
  marcarTrabajoEntregado, registrarAbono, archivarNota,
  calcularEstadoNota, tieneEntregasVencidas, generarFolio,
  getClientes, createCliente, getProductos, createProducto,
  buscarClientes, buscarProductos,
} from '@/lib/firestore';
import { Nota, Trabajo, Abono, Cliente, Producto } from '@/types';

export default function NotasPage() {
  const { user, usuarioData, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const esAdmin = usuarioData?.rol === 'admin';

  // Estados principales
  const [notas, setNotas] = useState<Nota[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [vista, setVista] = useState<'lista' | 'formulario'>('lista');
  const [filtro, setFiltro] = useState<'todos' | 'urgentes' | 'por_cobrar' | 'archivo'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<Nota | null>(null);

  const [modalConfirm, setModalConfirm] = useState<{ titulo: string; mensaje: string; onConfirm: () => void; } | null>(null);
  
  const USUARIOS_SISTEMA = [
    { email: 'tere@nenasgiftshop.com', nombre: 'Tere' },
    { email: 'cinthia@nenasgiftshop.com', nombre: 'Cinthia' },
    { email: 'veronica@nenasgiftshop.com', nombre: 'Vero' },
  ];

  // Estados del formulario
  const [formData, setFormData] = useState({
    clienteId: '',
    clienteNombre: '',
    clienteTelefono: '',
    evento: '',
    trabajos: [] as Trabajo[],
    abonos: [] as Abono[],
    notas: '',
    asignadaA: '',
    asignadaNombre: '',
    anticipoMonto: '',
  });

  // Estados para dropdowns de cliente
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([]);
  const [abiertoDDCliente, setAbiertoDDCliente] = useState(false);
  const [modalNuevoCliente, setModalNuevoCliente] = useState<{ nombre: string; telefono: string; email: string } | null>(null);

  // Estados para dropdowns de producto
  const [busquedaProducto, setBusquedaProducto] = useState<{ [key: string]: string }>({});
  const [productosFiltrados, setProductosFiltrados] = useState<{ [key: string]: Producto[] }>({});
  const [abiertoDDProducto, setAbiertoDDProducto] = useState<{ [key: string]: boolean }>({});
  const [modalNuevoProducto, setModalNuevoProducto] = useState<{ trabajoId: string; nombre: string; categoria: string; precioBase: string } | null>(null);

  // Estados para modales de entrega y abono
  const [modalEntrega, setModalEntrega] = useState<{ notaId: string; trabajoId: string; producto: string } | null>(null);
  const [entregadoA, setEntregadoA] = useState('');
  const [cargandoEntrega, setCargandoEntrega] = useState(false);
  const [modalAbono, setModalAbono] = useState<{ id: string; clienteNombre: string } | null>(null);
  const [cargandoAbono, setCargandoAbono] = useState(false);
  const [abonoForm, setAbonoForm] = useState({ monto: '', cobradoPor: '', metodoPago: 'efectivo' as 'efectivo' | 'transferencia' | 'tarjeta', concepto: '', notas: '' });

  useEffect(() => { if (!authLoading && !user) router.push('/'); }, [user, authLoading, router]);
  useEffect(() => { if (user) cargarDatos(); }, [user]);

  const cargarDatos = async () => {
    try {
      const [notasData, clientesData, productosData] = await Promise.all([
        getNotas(),
        getClientes(),
        getProductos(),
      ]);
      setNotas(notasData);
      setClientes(clientesData);
      setProductos(productosData);
    } catch { showToast('Error al cargar datos', 'error'); }
    finally { setLoading(false); }
  };

  // ===== FUNCIONES DE CLIENTE =====
  const handleBusquedaCliente = (valor: string) => {
    setBusquedaCliente(valor);
    if (valor.trim()) {
      const filtrados = clientes.filter(c =>
        c.nombre.toLowerCase().includes(valor.toLowerCase()) ||
        c.telefono.toLowerCase().includes(valor.toLowerCase())
      );
      setClientesFiltrados(filtrados);
    } else {
      setClientesFiltrados(clientes);
    }
  };

  const seleccionarCliente = (cliente: Cliente) => {
    setFormData({
      ...formData,
      clienteId: cliente.id || '',
      clienteNombre: cliente.nombre,
      clienteTelefono: cliente.telefono,
    });
    setBusquedaCliente('');
    setClientesFiltrados([]);
    setAbiertoDDCliente(false);
  };

  const crearNuevoCliente = async () => {
    if (!modalNuevoCliente || !modalNuevoCliente.nombre.trim()) {
      showToast('El nombre es requerido', 'error');
      return;
    }
    try {
      const clienteId = await createCliente({
        nombre: modalNuevoCliente.nombre.trim(),
        telefono: modalNuevoCliente.telefono.trim(),
        email: modalNuevoCliente.email.trim(),
        totalVisitas: 1,
        totalGastado: 0,
      });
      const clienteConId: Cliente = {
        id: clienteId || '',
        nombre: modalNuevoCliente.nombre.trim(),
        telefono: modalNuevoCliente.telefono.trim(),
        email: modalNuevoCliente.email.trim(),
        totalVisitas: 1,
        totalGastado: 0,
      };
      setClientes([...clientes, clienteConId]);
      seleccionarCliente(clienteConId);
      setModalNuevoCliente(null);
      showToast('✅ Cliente creado correctamente', 'success');
    } catch {
      showToast('Error al crear cliente', 'error');
    }
  };

  // ===== FUNCIONES DE PRODUCTO =====
  const handleBusquedaProducto = (trabajoId: string, valor: string) => {
    setBusquedaProducto({ ...busquedaProducto, [trabajoId]: valor });
    if (valor.trim()) {
      const filtrados = productos.filter(p =>
        p.nombre.toLowerCase().includes(valor.toLowerCase()) &&
        p.activo
      );
      setProductosFiltrados({ ...productosFiltrados, [trabajoId]: filtrados });
    } else {
      setProductosFiltrados({ ...productosFiltrados, [trabajoId]: productos.filter(p => p.activo) });
    }
  };

  const seleccionarProducto = (trabajo: Trabajo, producto: Producto) => {
    const trabajos = formData.trabajos.map(t => {
      if (t.id === trabajo.id) {
        const t2 = { ...t, producto: producto.nombre, precioUnitario: producto.precioBase };
        t2.subtotal = t2.cantidad * t2.precioUnitario;
        return t2;
      }
      return t;
    });
    setFormData({ ...formData, trabajos });
    setBusquedaProducto({ ...busquedaProducto, [trabajo.id]: '' });
    setProductosFiltrados({ ...productosFiltrados, [trabajo.id]: [] });
    setAbiertoDDProducto({ ...abiertoDDProducto, [trabajo.id]: false });
  };

  const crearNuevoProducto = async () => {
    if (!modalNuevoProducto || !modalNuevoProducto.nombre.trim()) {
      showToast('El nombre es requerido', 'error');
      return;
    }
    try {
      const productoId = await createProducto({
        nombre: modalNuevoProducto.nombre.trim(),
        categoria: modalNuevoProducto.categoria || 'Otros',
        precioBase: parseFloat(modalNuevoProducto.precioBase) || 0,
        activo: true,
        vecesVendido: 0,
      });
      const productoConId: Producto = {
        id: productoId || '',
        nombre: modalNuevoProducto.nombre.trim(),
        categoria: modalNuevoProducto.categoria || 'Otros',
        precioBase: parseFloat(modalNuevoProducto.precioBase) || 0,
        activo: true,
        vecesVendido: 0,
      };
      setProductos([...productos, productoConId]);
      
      const trabajo = formData.trabajos.find(t => t.id === modalNuevoProducto.trabajoId);
      if (trabajo) {
        seleccionarProducto(trabajo, productoConId);
      }
      setModalNuevoProducto(null);
      showToast('✅ Producto creado correctamente', 'success');
    } catch {
      showToast('Error al crear producto', 'error');
    }
  };

  // ===== FUNCIONES DE TRABAJOS =====
  const agregarTrabajo = () => {
    const t: Trabajo = {
      id: `trabajo_${Date.now()}`,
      producto: '',
      cantidad: 1,
      precioUnitario: 0,
      subtotal: 0,
      fechaEntrega: { dia: '', mes: '', anio: new Date().getFullYear().toString() },
      entregado: false,
    };
    setFormData({ ...formData, trabajos: [...formData.trabajos, t] });
  };

  const actualizarTrabajo = (id: string, campo: string, valor: any) => {
    const trabajos = formData.trabajos.map(t => {
      if (t.id !== id) return t;
      const u = { ...t, [campo]: valor };
      if (campo === 'cantidad' || campo === 'precioUnitario') u.subtotal = u.cantidad * u.precioUnitario;
      return u;
    });
    setFormData({ ...formData, trabajos });
  };

  const eliminarTrabajo = (id: string) => {
    setFormData({ ...formData, trabajos: formData.trabajos.filter(t => t.id !== id) });
  };

  const calcularTotal = () => formData.trabajos.reduce((s, t) => s + t.subtotal, 0);

  // ===== GUARDAR NOTA =====
  const handleGuardar = async () => {
    if (!usuarioData) return;
    if (!formData.clienteNombre) { showToast('El nombre del cliente es requerido', 'error'); return; }
    if (formData.trabajos.length === 0) { showToast('Agrega al menos un trabajo', 'error'); return; }
    setGuardando(true);
    try {
      const total = calcularTotal();
      
      // Procesar anticipo si existe
      let abonos = [...formData.abonos];
      if (formData.anticipoMonto && parseFloat(formData.anticipoMonto) > 0) {
        const montoAnticipo = parseFloat(formData.anticipoMonto);
        const ahora = new Date();
        abonos.push({
          id: `abono_${Date.now()}`,
          monto: montoAnticipo,
          fecha: {
            seconds: Math.floor(ahora.getTime() / 1000),
            nanoseconds: 0,
          } as any,
          cobradoPor: usuarioData.email,
          cobradoPorNombre: usuarioData.nombre,
          metodoPago: 'efectivo',
          concepto: 'Anticipo',
          notas: '',
        });
      }
      
      const notaData: Omit<Nota, 'id'> = {
        folio: editando?.folio || generarFolio(),
        clienteId: formData.clienteId || undefined,
        clienteNombre: formData.clienteNombre,
        clienteTelefono: formData.clienteTelefono,
        fechaCreacion: editando?.fechaCreacion || null as any,
        creadoPor: editando?.creadoPor || usuarioData.email,
        creadoPorNombre: editando?.creadoPorNombre || usuarioData.nombre,
        asignadaA: formData.asignadaA || usuarioData.email,
        asignadaNombre: formData.asignadaNombre || usuarioData.nombre,
        trabajos: formData.trabajos,
        total,
        abonos,
        totalAbonado: abonos.reduce((s, a) => s + a.monto, 0),
        saldo: total - abonos.reduce((s, a) => s + a.monto, 0),
        archivada: false,
        notas: formData.notas,
        evento: formData.evento,
        ultimaModificacion: null as any,
        ultimaModificacionPor: usuarioData.email,
        ultimaModificacionNombre: usuarioData.nombre,
      };
      if (editando?.id) {
        await updateNota(editando.id, notaData, { email: usuarioData.email, nombre: usuarioData.nombre });
        showToast('Nota actualizada correctamente', 'success');
      } else {
        await createNota(notaData, { email: usuarioData.email, nombre: usuarioData.nombre });
        showToast('Nota creada correctamente', 'success');
      }
      await cargarDatos();
      setVista('lista');
      limpiarFormulario();
    } catch { showToast('Error al guardar la nota', 'error'); }
    finally { setGuardando(false); }
  };

  const limpiarFormulario = () => {
    setFormData({ clienteId: '', clienteNombre: '', clienteTelefono: '', evento: '', trabajos: [], abonos: [], notas: '', asignadaA: '', asignadaNombre: '', anticipoMonto: '' });
    setEditando(null);
    setBusquedaCliente('');
    setClientesFiltrados([]);
    setBusquedaProducto({});
    setProductosFiltrados({});
  };

  const handleEditar = (nota: Nota) => {
    setFormData({
      clienteId: nota.clienteId || '',
      clienteNombre: nota.clienteNombre,
      clienteTelefono: nota.clienteTelefono,
      evento: nota.evento || '',
      trabajos: nota.trabajos,
      abonos: nota.abonos,
      notas: nota.notas || '',
      asignadaA: nota.asignadaA || '',
      asignadaNombre: nota.asignadaNombre || '',
      anticipoMonto: '',
    });
    setEditando(nota);
    setVista('formulario');
  };

  const handleEliminar = (nota: Nota) => {
    if (!esAdmin) return;
    setModalConfirm({
      titulo: 'Eliminar nota',
      mensaje: `¿Eliminar la nota ${nota.folio} de ${nota.clienteNombre}? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        if (!usuarioData) return;
        setModalConfirm(null);
        try { await deleteNota(nota.id!, { email: usuarioData.email, nombre: usuarioData.nombre }); await cargarDatos(); showToast(`Nota ${nota.folio} eliminada`, 'info'); }
        catch { showToast('Error al eliminar la nota', 'error'); }
      },
    });
  };

  const handleArchivar = (nota: Nota) => {
    if (!esAdmin) return;
    setModalConfirm({
      titulo: nota.archivada ? 'Desarchivar nota' : 'Archivar nota',
      mensaje: nota.archivada ? `¿Regresar la nota ${nota.folio} a activas?` : `¿Archivar la nota ${nota.folio} de ${nota.clienteNombre}?`,
      onConfirm: async () => {
        if (!usuarioData) return;
        setModalConfirm(null);
        try { await archivarNota(nota.id!, { email: usuarioData.email, nombre: usuarioData.nombre }); await cargarDatos(); showToast(nota.archivada ? 'Nota desarchivada' : 'Nota archivada', 'success'); }
        catch { showToast('Error al archivar la nota', 'error'); }
      },
    });
  };

  const handleMarcarEntrega = async () => {
    if (!modalEntrega || !usuarioData || !entregadoA.trim()) { showToast('Indica quién recibió el pedido', 'error'); return; }
    setCargandoEntrega(true);
    try {
      await marcarTrabajoEntregado(modalEntrega.notaId, modalEntrega.trabajoId, { email: usuarioData.email, nombre: usuarioData.nombre }, entregadoA);
      await cargarDatos();
      showToast(`Entrega confirmada a ${entregadoA}`, 'success');
      setModalEntrega(null); setEntregadoA('');
    } catch { showToast('Error al marcar la entrega', 'error'); }
    finally { setCargandoEntrega(false); }
  };

  const handleRegistrarAbono = async () => {
    if (!modalAbono || !usuarioData || !abonoForm.monto) { showToast('Ingresa un monto válido', 'error'); return; }
    const monto = parseFloat(abonoForm.monto);
    if (isNaN(monto) || monto <= 0) { showToast('El monto debe ser mayor a 0', 'error'); return; }
    setCargandoAbono(true);
    try {
      await registrarAbono(modalAbono.id, { monto, cobradoPor: abonoForm.cobradoPor || usuarioData.email, cobradoPorNombre: usuarioData.nombre, metodoPago: abonoForm.metodoPago, concepto: abonoForm.concepto || 'Abono', notas: abonoForm.notas }, { email: usuarioData.email, nombre: usuarioData.nombre });
      await cargarDatos();
      showToast(`Abono de $${monto.toLocaleString()} registrado`, 'success');
      setModalAbono(null);
      setAbonoForm({ monto: '', cobradoPor: '', metodoPago: 'efectivo', concepto: '', notas: '' });
    } catch { showToast('Error al registrar el abono', 'error'); }
    finally { setCargandoAbono(false); }
  };

  const abrirWhatsApp = (telefono: string, nombre: string, folio: string) => {
    const num = telefono.replace(/\D/g, '');
    const msg = encodeURIComponent(`Hola ${nombre}, te contactamos de Nenas Gift Shop sobre tu pedido ${folio} 🎀`);
    window.open(`https://wa.me/52${num}?text=${msg}`, '_blank');
  };

  const notasActivas = notas.filter(n => !n.archivada);
  const countUrgentes = notasActivas.filter(n => { const e = calcularEstadoNota(n); return e.estadoGeneral === 'urgente' || tieneEntregasVencidas(n); }).length;
  const countPorCobrar = notasActivas.filter(n => calcularEstadoNota(n).estadoGeneral === 'por_cobrar').length;
  const countArchivo = notas.filter(n => n.archivada).length;

  const notasFiltradas = notas.filter(nota => {
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (!nota.clienteNombre.toLowerCase().includes(q) && !nota.folio.toLowerCase().includes(q) && !nota.clienteTelefono?.toLowerCase().includes(q)) return false;
    }
    if (filtro === 'archivo') return nota.archivada === true;
    if (nota.archivada) return false;
    if (filtro === 'urgentes') { const e = calcularEstadoNota(nota); return e.estadoGeneral === 'urgente' || tieneEntregasVencidas(nota); }
    if (filtro === 'por_cobrar') return calcularEstadoNota(nota).estadoGeneral === 'por_cobrar';
    return true;
  });

  const formatFecha = (nota: Nota) => {
    if (!nota.fechaCreacion) return '';
    try {
      if (nota.fechaCreacion && typeof nota.fechaCreacion === 'object' && 'seconds' in nota.fechaCreacion) {
        return new Date(nota.fechaCreacion.seconds * 1000).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
      }
      return '';
    }
    catch { return ''; }
  };

  if (authLoading || loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="text-4xl mb-3 animate-bounce">🎀</div><p className="text-gray-600">Cargando...</p></div>
    </div>
  );

  const filtrosDisponibles = [
    { key: 'todos', label: 'Todas', emoji: '📋', count: notasActivas.length },
    { key: 'urgentes', label: 'Urgentes', emoji: '🔥', count: countUrgentes },
    { key: 'por_cobrar', label: 'Por Cobrar', emoji: '💰', count: countPorCobrar },
    ...(esAdmin ? [{ key: 'archivo', label: 'Archivo', emoji: '🗃️', count: countArchivo }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-2xl hover:scale-110 transition-transform">←</button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Notas de Venta</h1>
              <p className="text-sm text-gray-500">{notasFiltradas.length} notas</p>
            </div>
          </div>
          {vista === 'lista' && (
            <button onClick={() => setVista('formulario')} className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg font-bold hover:from-pink-600 hover:to-purple-700">
              + Nueva Nota
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {vista === 'lista' ? (
          <>
            <div className="mb-6 space-y-4">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {filtrosDisponibles.map(f => (
                  <button key={f.key} onClick={() => setFiltro(f.key as any)}
                    className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${filtro === f.key ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>
                    {f.emoji} {f.label}
                    {f.count > 0 && (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${filtro === f.key ? 'bg-white text-purple-600' : 'bg-purple-100 text-purple-700'}`}>{f.count}</span>
                    )}
                  </button>
                ))}
              </div>
              <input type="text" placeholder="🔍 Buscar por cliente, folio o teléfono..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none" />
            </div>

            <div className="grid gap-4">
              {notasFiltradas.map(nota => {
                const estado = calcularEstadoNota(nota);
                const vencida = tieneEntregasVencidas(nota);
                const saldoReal = nota.total - (nota.abonos?.reduce((s, a) => s + a.monto, 0) ?? 0);
                const fechaCreacion = formatFecha(nota);
                return (
                  <div key={nota.id} className="bg-white rounded-xl shadow-sm border-2 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-extrabold text-pink-600">{nota.folio}</span>
                          {fechaCreacion && <span className="text-xs text-gray-400">📅 {fechaCreacion}</span>}
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${estado.estadoGeneral === 'completada' ? 'bg-green-100 text-green-700' : estado.estadoGeneral === 'por_cobrar' ? 'bg-red-100 text-red-700' : estado.estadoGeneral === 'urgente' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                            {estado.estadoGeneral === 'completada' ? '✓ Completada' : estado.estadoGeneral === 'por_cobrar' ? '⚠ Por Cobrar' : estado.estadoGeneral === 'urgente' ? '🔥 Urgente' : '💼 En Proceso'}
                          </span>
                          {vencida && <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">🔴 Vencida</span>}
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg">{nota.clienteNombre}</h3>
                        <div className="flex items-center gap-3">
                          <p className="text-sm text-gray-500">{nota.trabajos.length} trabajo(s){esAdmin ? ` · $${nota.total.toLocaleString()}` : ''}</p>
                          {nota.clienteTelefono && <p className="text-sm text-gray-400">{nota.clienteTelefono}</p>}
                        </div>
                        {saldoReal > 0 && esAdmin && (
                          <p className="text-sm font-bold text-red-600 mt-1">Saldo: ${saldoReal.toLocaleString()}</p>
                        )}
                        {saldoReal > 0 && !esAdmin && (
                          <p className="text-sm font-bold text-orange-600 mt-1">Tiene saldo pendiente</p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => router.push(`/dashboard/notas/${nota.id}`)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100">
                        Ver detalle
                      </button>
                      <button onClick={() => handleEditar(nota)} className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-sm font-semibold hover:bg-purple-100">
                        ✏️ Editar
                      </button>
                      {saldoReal > 0 && (
                        <button onClick={() => setModalAbono({ id: nota.id!, clienteNombre: nota.clienteNombre })} className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-sm font-semibold hover:bg-green-100">
                          💰 Cobrar
                        </button>
                      )}
                      {nota.clienteTelefono && (
                        <button onClick={() => abrirWhatsApp(nota.clienteTelefono, nota.clienteNombre, nota.folio)} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-semibold hover:bg-emerald-100">
                          💬 WhatsApp
                        </button>
                      )}
                      {esAdmin && (
                        <button onClick={() => handleArchivar(nota)} className="px-3 py-1.5 bg-yellow-50 text-yellow-600 rounded-lg text-sm font-semibold hover:bg-yellow-100">
                          {nota.archivada ? '📤 Desarchivar' : '🗃️ Archivar'}
                        </button>
                      )}
                      {esAdmin && (
                        <button onClick={() => handleEliminar(nota)} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100">
                          🗑️ Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {notasFiltradas.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📭</div>
                  <p className="text-gray-500 font-semibold">No hay notas</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border-2 p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">{editando ? `Editar Nota ${editando.folio}` : 'Nueva Nota'}</h2>

              {/* CLIENTE CON DROPDOWN */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">Cliente *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={abiertoDDCliente ? busquedaCliente : formData.clienteNombre}
                    onChange={(e) => {
                      if (abiertoDDCliente) {
                        handleBusquedaCliente(e.target.value);
                      }
                    }}
                    onFocus={() => {
                      setAbiertoDDCliente(true);
                      handleBusquedaCliente(busquedaCliente);
                    }}
                    placeholder="Selecciona o escribe un cliente..."
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none"
                  />
                  {abiertoDDCliente && clientesFiltrados.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border-2 border-purple-300 rounded-lg mt-1 shadow-lg z-10 max-h-48 overflow-y-auto">
                      {clientesFiltrados.map(c => (
                        <button
                          key={c.id}
                          onClick={() => seleccionarCliente(c)}
                          className="w-full text-left px-4 py-2 hover:bg-purple-50 border-b last:border-b-0"
                        >
                          <div className="font-semibold">{c.nombre}</div>
                          <div className="text-xs text-gray-500">{c.telefono}</div>
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setAbiertoDDCliente(false);
                          setModalNuevoCliente({ nombre: busquedaCliente, telefono: '', email: '' });
                        }}
                        className="w-full text-left px-4 py-2 bg-green-50 text-green-600 font-semibold hover:bg-green-100 border-t-2"
                      >
                        ➕ Crear cliente: "{busquedaCliente}"
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Teléfono</label>
                  <input type="tel" value={formData.clienteTelefono} onChange={(e) => setFormData({ ...formData, clienteTelefono: e.target.value })} className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none" placeholder="8681234567" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Evento</label>
                  <input type="text" value={formData.evento} onChange={(e) => setFormData({ ...formData, evento: e.target.value })} className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none" placeholder="Cumpleaños, Boda..." />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">Asignar a</label>
                <select
                  value={formData.asignadaA}
                  onChange={(e) => {
                    const u = USUARIOS_SISTEMA.find(u => u.email === e.target.value);
                    setFormData({ ...formData, asignadaA: e.target.value, asignadaNombre: u?.nombre || '' });
                  }}
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none"
                >
                  <option value="">— Seleccionar persona —</option>
                  {USUARIOS_SISTEMA.map(u => (
                    <option key={u.email} value={u.email}>{u.nombre}</option>
                  ))}
                </select>
              </div>

              {/* ANTICIPO OPCIONAL */}
              <div className="mb-6 bg-green-50 rounded-lg p-4 border-2 border-green-200">
                <label className="block text-sm font-bold text-gray-700 mb-2">💰 Anticipo (Opcional)</label>
                <input
                  type="number"
                  value={formData.anticipoMonto}
                  onChange={(e) => setFormData({ ...formData, anticipoMonto: e.target.value })}
                  placeholder="Monto del anticipo"
                  className="w-full px-4 py-2 rounded-lg border-2 border-green-300 focus:border-green-500 focus:outline-none"
                  step="0.01"
                />
                {formData.anticipoMonto && parseFloat(formData.anticipoMonto) > 0 && (
                  <p className="text-xs text-green-700 mt-2">✅ Se registrará ${parseFloat(formData.anticipoMonto).toLocaleString()} como anticipo</p>
                )}
              </div>

              {/* TRABAJOS CON DROPDOWN DE PRODUCTOS */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-gray-800">Trabajos</h3>
                  <button onClick={agregarTrabajo} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700">+ Agregar</button>
                </div>
                <div className="space-y-4">
                  {formData.trabajos.map((trabajo, idx) => (
                    <div key={trabajo.id} className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-gray-700">Trabajo {idx + 1}</span>
                        <button onClick={() => eliminarTrabajo(trabajo.id)} className="text-red-500 hover:text-red-700 font-bold">✕</button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="col-span-2 relative">
                          <input
                            type="text"
                            value={abiertoDDProducto[trabajo.id] ? busquedaProducto[trabajo.id] || '' : trabajo.producto}
                            onChange={(e) => {
                              if (abiertoDDProducto[trabajo.id]) {
                                handleBusquedaProducto(trabajo.id, e.target.value);
                              }
                            }}
                            onFocus={() => {
                              setAbiertoDDProducto({ ...abiertoDDProducto, [trabajo.id]: true });
                              handleBusquedaProducto(trabajo.id, busquedaProducto[trabajo.id] || '');
                            }}
                            placeholder="Selecciona o escribe un producto..."
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-purple-400 focus:outline-none"
                          />
                          {abiertoDDProducto[trabajo.id] && (productosFiltrados[trabajo.id] || []).length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white border-2 border-purple-300 rounded-lg mt-1 shadow-lg z-10 max-h-40 overflow-y-auto">
                              {(productosFiltrados[trabajo.id] || []).map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => seleccionarProducto(trabajo, p)}
                                  className="w-full text-left px-3 py-2 hover:bg-purple-50 border-b last:border-b-0 text-sm"
                                >
                                  <div className="font-semibold">{p.nombre}</div>
                                  <div className="text-xs text-gray-500">${p.precioBase.toLocaleString()}</div>
                                </button>
                              ))}
                              <button
                                onClick={() => {
                                  setAbiertoDDProducto({ ...abiertoDDProducto, [trabajo.id]: false });
                                  setModalNuevoProducto({ trabajoId: trabajo.id, nombre: busquedaProducto[trabajo.id] || '', categoria: 'Otros', precioBase: '' });
                                }}
                                className="w-full text-left px-3 py-2 bg-green-50 text-green-600 font-semibold hover:bg-green-100 border-t-2 text-sm"
                              >
                                ➕ Crear: "{busquedaProducto[trabajo.id] || ''}"
                              </button>
                            </div>
                          )}
                        </div>
                        <input type="number" value={trabajo.cantidad} onChange={(e) => actualizarTrabajo(trabajo.id, 'cantidad', parseInt(e.target.value) || 0)} placeholder="Cantidad" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-purple-400 focus:outline-none" />
                        <input type="number" value={trabajo.precioUnitario} onChange={(e) => actualizarTrabajo(trabajo.id, 'precioUnitario', parseFloat(e.target.value) || 0)} placeholder="Precio" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-purple-400 focus:outline-none" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-600 mb-1">Fecha de Entrega</label>
                        <input
                          type="date"
                          value={trabajo.fechaEntrega.anio && trabajo.fechaEntrega.mes && trabajo.fechaEntrega.dia
                            ? `${trabajo.fechaEntrega.anio}-${trabajo.fechaEntrega.mes.toString().padStart(2, '0')}-${trabajo.fechaEntrega.dia.toString().padStart(2, '0')}`
                            : ''
                          }
                          onChange={(e) => {
                            if (e.target.value) {
                              const [anio, mes, dia] = e.target.value.split('-');
                              actualizarTrabajo(trabajo.id, 'fechaEntrega', { dia, mes, anio });
                            }
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-purple-400 focus:outline-none text-sm"
                        />
                      </div>
                      <div className="text-right"><span className="font-bold text-gray-800">Subtotal: ${trabajo.subtotal.toLocaleString()}</span></div>
                    </div>
                  ))}
                  {formData.trabajos.length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl"><p className="text-gray-400">Agrega al menos un trabajo</p></div>
                  )}
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mb-6 border-2 border-purple-200">
                <div className="text-right">
                  <p className="text-sm text-gray-600 mb-1">Total</p>
                  <p className="text-3xl font-extrabold text-purple-600">${calcularTotal().toLocaleString()}</p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">Notas adicionales</label>
                <textarea value={formData.notas} onChange={(e) => setFormData({ ...formData, notas: e.target.value })} className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none" rows={3} placeholder="Detalles, especificaciones..." />
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setVista('lista'); limpiarFormulario(); }} disabled={guardando} className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 disabled:opacity-50">Cancelar</button>
                <button onClick={handleGuardar} disabled={guardando} className="flex-1 px-4 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg font-bold hover:from-pink-600 hover:to-purple-700 disabled:opacity-60 flex items-center justify-center gap-2">
                  {guardando ? <><span className="animate-spin">⏳</span> Guardando...</> : editando ? 'Actualizar Nota' : 'Crear Nota'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL NUEVO CLIENTE */}
      {modalNuevoCliente && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">➕ Nuevo Cliente</h3>
            <div className="space-y-3">
              <input type="text" value={modalNuevoCliente.nombre} onChange={(e) => setModalNuevoCliente({ ...modalNuevoCliente, nombre: e.target.value })} placeholder="Nombre *" className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none" />
              <input type="tel" value={modalNuevoCliente.telefono} onChange={(e) => setModalNuevoCliente({ ...modalNuevoCliente, telefono: e.target.value })} placeholder="Teléfono" className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none" />
              <input type="email" value={modalNuevoCliente.email} onChange={(e) => setModalNuevoCliente({ ...modalNuevoCliente, email: e.target.value })} placeholder="Email" className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setModalNuevoCliente(null)} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">Cancelar</button>
              <button onClick={crearNuevoCliente} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700">Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO PRODUCTO */}
      {modalNuevoProducto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">➕ Nuevo Producto</h3>
            <div className="space-y-3">
              <input type="text" value={modalNuevoProducto.nombre} onChange={(e) => setModalNuevoProducto({ ...modalNuevoProducto, nombre: e.target.value })} placeholder="Nombre *" className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none" />
              <select value={modalNuevoProducto.categoria} onChange={(e) => setModalNuevoProducto({ ...modalNuevoProducto, categoria: e.target.value })} className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none">
                <option value="Otros">Otros</option>
                <option value="Decoración">Decoración</option>
                <option value="Regalos Personalizados">Regalos Personalizados</option>
                <option value="Accesorios">Accesorios</option>
                <option value="Ropa">Ropa</option>
              </select>
              <input type="number" value={modalNuevoProducto.precioBase} onChange={(e) => setModalNuevoProducto({ ...modalNuevoProducto, precioBase: e.target.value })} placeholder="Precio Base" className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setModalNuevoProducto(null)} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">Cancelar</button>
              <button onClick={crearNuevoProducto} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700">Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* MODALES EXISTENTES (Confirmación, Entrega, Abono) */}
      {modalConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-center mb-4"><div className="text-4xl mb-2">⚠️</div><h3 className="text-lg font-bold text-gray-800">{modalConfirm.titulo}</h3></div>
            <p className="text-gray-600 text-sm text-center mb-6">{modalConfirm.mensaje}</p>
            <div className="flex gap-2">
              <button onClick={() => setModalConfirm(null)} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">Cancelar</button>
              <button onClick={modalConfirm.onConfirm} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {modalEntrega && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="mb-4"><div className="text-2xl mb-1">📦</div><h3 className="text-lg font-bold">Confirmar entrega</h3><p className="text-sm text-gray-500">{modalEntrega.producto}</p></div>
            <p className="text-sm text-gray-600 mb-3">¿Quién recibió este pedido?</p>
            <input type="text" value={entregadoA} onChange={(e) => setEntregadoA(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleMarcarEntrega()} placeholder="Nombre de quien recibió" className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none mb-4" autoFocus />
            <div className="flex gap-2">
              <button onClick={() => { setModalEntrega(null); setEntregadoA(''); }} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">Cancelar</button>
              <button onClick={handleMarcarEntrega} disabled={cargandoEntrega || !entregadoA.trim()} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-60">
                {cargandoEntrega ? '⏳ Guardando...' : '✓ Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAbono && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="mb-4"><div className="text-2xl mb-1">💰</div><h3 className="text-lg font-bold">Registrar Abono</h3><p className="text-sm text-gray-500">{modalAbono.clienteNombre}</p></div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Monto *</label>
                <input type="number" value={abonoForm.monto} onChange={(e) => setAbonoForm({ ...abonoForm, monto: e.target.value })} placeholder="0.00" className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none text-lg font-bold" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Método de pago</label>
                <select value={abonoForm.metodoPago} onChange={(e) => setAbonoForm({ ...abonoForm, metodoPago: e.target.value as any })} className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none">
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="transferencia">📱 Transferencia</option>
                  <option value="tarjeta">💳 Tarjeta</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Concepto</label>
                <input type="text" value={abonoForm.concepto} onChange={(e) => setAbonoForm({ ...abonoForm, concepto: e.target.value })} placeholder="Anticipo, Liquidación..." className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setModalAbono(null)} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">Cancelar</button>
              <button onClick={handleRegistrarAbono} disabled={cargandoAbono || !abonoForm.monto} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-60">
                {cargandoAbono ? '⏳ Guardando...' : '✓ Guardar Abono'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
