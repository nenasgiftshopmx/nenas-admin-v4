'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  getNotas,
  createNota,
  updateNota,
  deleteNota,
  marcarTrabajoEntregado,
  registrarAbono,
  archivarNota,
  calcularEstadoNota,
  tieneEntregasVencidas,
  generarFolio,
} from '@/lib/firestore';
import { Nota, Trabajo, Abono } from '@/types';

export default function NotasPage() {
  const { user, usuarioData, loading: authLoading } = useAuth();
  const router = useRouter();

  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<'lista' | 'formulario'>('lista');
  const [filtro, setFiltro] = useState<'todos' | 'urgentes' | 'por_cobrar' | 'archivo'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<Nota | null>(null);

  // Estado del formulario
  const [formData, setFormData] = useState({
    clienteNombre: '',
    clienteTelefono: '',
    evento: '',
    trabajos: [] as Trabajo[],
    abonos: [] as Abono[],
    notas: '',
  });

  // Modales
  const [modalEntrega, setModalEntrega] = useState<{ notaId: string; trabajoId: string } | null>(null);
  const [entregadoA, setEntregadoA] = useState('');
  const [modalAbono, setModalAbono] = useState<string | null>(null);
  const [abonoForm, setAbonoForm] = useState({
    monto: '',
    cobradoPor: '',
    metodoPago: 'efectivo' as 'efectivo' | 'transferencia' | 'tarjeta',
    concepto: '',
    notas: '',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      cargarNotas();
    }
  }, [user]);

  const cargarNotas = async () => {
    try {
      const data = await getNotas();
      setNotas(data);
    } catch (error) {
      console.error('Error cargando notas:', error);
    } finally {
      setLoading(false);
    }
  };

  const agregarTrabajo = () => {
    const nuevoTrabajo: Trabajo = {
      id: `trabajo_${Date.now()}`,
      producto: '',
      cantidad: 1,
      precioUnitario: 0,
      subtotal: 0,
      fechaEntrega: {
        dia: '',
        mes: '',
        anio: new Date().getFullYear().toString(),
      },
      entregado: false,
    };
    setFormData({ ...formData, trabajos: [...formData.trabajos, nuevoTrabajo] });
  };

  const actualizarTrabajo = (id: string, campo: string, valor: any) => {
    const trabajos = formData.trabajos.map(t => {
      if (t.id === id) {
        const updated = { ...t, [campo]: valor };
        if (campo === 'cantidad' || campo === 'precioUnitario') {
          updated.subtotal = updated.cantidad * updated.precioUnitario;
        }
        return updated;
      }
      return t;
    });
    setFormData({ ...formData, trabajos });
  };

  const eliminarTrabajo = (id: string) => {
    setFormData({ ...formData, trabajos: formData.trabajos.filter(t => t.id !== id) });
  };

  const calcularTotal = () => {
    return formData.trabajos.reduce((sum, t) => sum + t.subtotal, 0);
  };

  const handleGuardar = async () => {
    if (!usuarioData) return;
    if (!formData.clienteNombre || formData.trabajos.length === 0) {
      alert('Complete los campos requeridos');
      return;
    }

    try {
      const total = calcularTotal();
      const notaData: Omit<Nota, 'id'> = {
        folio: editando?.folio || generarFolio(),
        clienteNombre: formData.clienteNombre,
        clienteTelefono: formData.clienteTelefono,
        fechaCreacion: editando?.fechaCreacion || null as any,
        creadoPor: editando?.creadoPor || usuarioData.email,
        creadoPorNombre: editando?.creadoPorNombre || usuarioData.nombre,
        asignadaA: usuarioData.email,
        asignadaNombre: usuarioData.nombre,
        trabajos: formData.trabajos,
        total,
        abonos: formData.abonos,
        totalAbonado: formData.abonos.reduce((sum, a) => sum + a.monto, 0),
        saldo: total - formData.abonos.reduce((sum, a) => sum + a.monto, 0),
        archivada: false,
        notas: formData.notas,
        evento: formData.evento,
        ultimaModificacion: null as any,
        ultimaModificacionPor: usuarioData.email,
        ultimaModificacionNombre: usuarioData.nombre,
      };

      if (editando?.id) {
        await updateNota(editando.id, notaData, {
          email: usuarioData.email,
          nombre: usuarioData.nombre,
        });
      } else {
        await createNota(notaData, {
          email: usuarioData.email,
          nombre: usuarioData.nombre,
        });
      }

      await cargarNotas();
      setVista('lista');
      limpiarFormulario();
    } catch (error) {
      console.error('Error guardando nota:', error);
      alert('Error al guardar');
    }
  };

  const limpiarFormulario = () => {
    setFormData({
      clienteNombre: '',
      clienteTelefono: '',
      evento: '',
      trabajos: [],
      abonos: [],
      notas: '',
    });
    setEditando(null);
  };

  const handleEditar = (nota: Nota) => {
    setFormData({
      clienteNombre: nota.clienteNombre,
      clienteTelefono: nota.clienteTelefono,
      evento: nota.evento || '',
      trabajos: nota.trabajos,
      abonos: nota.abonos,
      notas: nota.notas || '',
    });
    setEditando(nota);
    setVista('formulario');
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta nota?')) return;
    if (!usuarioData) return;

    try {
      await deleteNota(id, {
        email: usuarioData.email,
        nombre: usuarioData.nombre,
      });
      await cargarNotas();
    } catch (error) {
      console.error('Error eliminando:', error);
    }
  };

  const handleMarcarEntrega = async () => {
    if (!modalEntrega || !usuarioData || !entregadoA) return;

    try {
      await marcarTrabajoEntregado(
        modalEntrega.notaId,
        modalEntrega.trabajoId,
        { email: usuarioData.email, nombre: usuarioData.nombre },
        entregadoA
      );
      await cargarNotas();
      setModalEntrega(null);
      setEntregadoA('');
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleRegistrarAbono = async () => {
    if (!modalAbono || !usuarioData || !abonoForm.monto) return;

    try {
      await registrarAbono(
        modalAbono,
        {
          monto: parseFloat(abonoForm.monto),
          cobradoPor: abonoForm.cobradoPor || usuarioData.email,
          cobradoPorNombre: usuarioData.nombre,
          metodoPago: abonoForm.metodoPago,
          concepto: abonoForm.concepto || 'Abono',
          notas: abonoForm.notas,
        },
        { email: usuarioData.email, nombre: usuarioData.nombre }
      );
      await cargarNotas();
      setModalAbono(null);
      setAbonoForm({
        monto: '',
        cobradoPor: '',
        metodoPago: 'efectivo',
        concepto: '',
        notas: '',
      });
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const notasFiltradas = notas.filter(nota => {
    // Busqueda
    if (busqueda && !nota.clienteNombre.toLowerCase().includes(busqueda.toLowerCase()) && 
        !nota.folio.toLowerCase().includes(busqueda.toLowerCase())) {
      return false;
    }

    // Filtros
    if (filtro === 'archivo') {
      return nota.archivada === true;
    }
    
    if (nota.archivada) return false;

    if (filtro === 'urgentes') {
      const estado = calcularEstadoNota(nota);
      return estado.estadoGeneral === 'urgente' || tieneEntregasVencidas(nota);
    }

    if (filtro === 'por_cobrar') {
      const estado = calcularEstadoNota(nota);
      return estado.estadoGeneral === 'por_cobrar';
    }

    return true;
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-bounce">🎀</div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-2xl hover:scale-110 transition-transform">
              ←
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Notas de Venta</h1>
              <p className="text-sm text-gray-500">{notasFiltradas.length} notas</p>
            </div>
          </div>

          {vista === 'lista' && (
            <button
              onClick={() => setVista('formulario')}
              className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg font-bold hover:from-pink-600 hover:to-purple-700"
            >
              + Nueva Nota
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {vista === 'lista' ? (
          <>
            {/* Filtros */}
            <div className="mb-6 space-y-4">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {[
                  { key: 'todos', label: 'Todas', emoji: '📋' },
                  { key: 'urgentes', label: 'Urgentes', emoji: '🔥' },
                  { key: 'por_cobrar', label: 'Por Cobrar', emoji: '💰' },
                  { key: 'archivo', label: 'Archivo', emoji: '🗃️' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFiltro(f.key as any)}
                    className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
                      filtro === f.key
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border'
                    }`}
                  >
                    {f.emoji} {f.label}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Buscar por cliente o folio..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none"
              />
            </div>

            {/* Lista */}
            <div className="grid gap-4">
              {notasFiltradas.map(nota => {
                const estado = calcularEstadoNota(nota);
                const vencida = tieneEntregasVencidas(nota);

                return (
                  <div key={nota.id} className="bg-white rounded-xl shadow-sm border-2 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="text-sm font-extrabold text-pink-600">{nota.folio}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            estado.estadoGeneral === 'completada' ? 'bg-green-100 text-green-700' :
                            estado.estadoGeneral === 'por_cobrar' ? 'bg-red-100 text-red-700' :
                            estado.estadoGeneral === 'urgente' ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {estado.estadoGeneral === 'completada' ? '✓ Completada' :
                             estado.estadoGeneral === 'por_cobrar' ? '⚠ Por Cobrar' :
                             estado.estadoGeneral === 'urgente' ? '🔥 Urgente' :
                             '💼 En Proceso'}
                          </span>
                          {vencida && (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                              🔴 Vencida
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg">{nota.clienteNombre}</h3>
                        <p className="text-sm text-gray-500">{nota.trabajos.length} trabajo(s) · ${nota.total.toLocaleString()}</p>
                        {nota.saldo > 0 && (
                          <p className="text-sm font-bold text-red-600 mt-1">Saldo: ${nota.saldo.toLocaleString()}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditar(nota)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100"
                      >
                        Editar
                      </button>
                      {nota.saldo > 0 && (
                        <button
                          onClick={() => setModalAbono(nota.id!)}
                          className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-sm font-semibold hover:bg-green-100"
                        >
                          💰 Cobrar
                        </button>
                      )}
                      <button
                        onClick={() => handleEliminar(nota.id!)}
                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100"
                      >
                        Eliminar
                      </button>
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
          // FORMULARIO
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border-2 p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                {editando ? 'Editar Nota' : 'Nueva Nota'}
              </h2>

              {/* Cliente */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Cliente *</label>
                  <input
                    type="text"
                    value={formData.clienteNombre}
                    onChange={(e) => setFormData({ ...formData, clienteNombre: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none"
                    placeholder="Nombre del cliente"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Teléfono</label>
                  <input
                    type="tel"
                    value={formData.clienteTelefono}
                    onChange={(e) => setFormData({ ...formData, clienteTelefono: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none"
                    placeholder="8681234567"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">Evento</label>
                <input
                  type="text"
                  value={formData.evento}
                  onChange={(e) => setFormData({ ...formData, evento: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none"
                  placeholder="Cumpleaños, Boda, etc."
                />
              </div>

              {/* Trabajos */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-gray-800">Trabajos</h3>
                  <button
                    onClick={agregarTrabajo}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700"
                  >
                    + Agregar
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.trabajos.map((trabajo, idx) => (
                    <div key={trabajo.id} className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-gray-700">Trabajo {idx + 1}</span>
                        <button
                          onClick={() => eliminarTrabajo(trabajo.id)}
                          className="text-red-500 hover:text-red-700 font-bold"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="col-span-2">
                          <input
                            type="text"
                            value={trabajo.producto}
                            onChange={(e) => actualizarTrabajo(trabajo.id, 'producto', e.target.value)}
                            placeholder="Producto/Servicio"
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-purple-400 focus:outline-none"
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            value={trabajo.cantidad}
                            onChange={(e) => actualizarTrabajo(trabajo.id, 'cantidad', parseInt(e.target.value) || 0)}
                            placeholder="Cantidad"
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-purple-400 focus:outline-none"
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            value={trabajo.precioUnitario}
                            onChange={(e) => actualizarTrabajo(trabajo.id, 'precioUnitario', parseFloat(e.target.value) || 0)}
                            placeholder="Precio"
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-purple-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <input
                          type="text"
                          value={trabajo.fechaEntrega.dia}
                          onChange={(e) => actualizarTrabajo(trabajo.id, 'fechaEntrega', { ...trabajo.fechaEntrega, dia: e.target.value })}
                          placeholder="Día"
                          className="px-3 py-2 rounded-lg border border-gray-300 focus:border-purple-400 focus:outline-none text-sm"
                        />
                        <input
                          type="text"
                          value={trabajo.fechaEntrega.mes}
                          onChange={(e) => actualizarTrabajo(trabajo.id, 'fechaEntrega', { ...trabajo.fechaEntrega, mes: e.target.value })}
                          placeholder="Mes"
                          className="px-3 py-2 rounded-lg border border-gray-300 focus:border-purple-400 focus:outline-none text-sm"
                        />
                        <input
                          type="text"
                          value={trabajo.fechaEntrega.anio}
                          onChange={(e) => actualizarTrabajo(trabajo.id, 'fechaEntrega', { ...trabajo.fechaEntrega, anio: e.target.value })}
                          placeholder="Año"
                          className="px-3 py-2 rounded-lg border border-gray-300 focus:border-purple-400 focus:outline-none text-sm"
                        />
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-gray-800">Subtotal: ${trabajo.subtotal.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mb-6 border-2 border-purple-200">
                <div className="text-right">
                  <p className="text-sm text-gray-600 mb-1">Total</p>
                  <p className="text-3xl font-extrabold text-purple-600">${calcularTotal().toLocaleString()}</p>
                </div>
              </div>

              {/* Notas */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">Notas adicionales</label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none"
                  rows={3}
                  placeholder="Detalles, especificaciones..."
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setVista('lista');
                    limpiarFormulario();
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGuardar}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg font-bold hover:from-pink-600 hover:to-purple-700"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Marcar Entrega */}
      {modalEntrega && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Marcar como entregado</h3>
            <input
              type="text"
              value={entregadoA}
              onChange={(e) => setEntregadoA(e.target.value)}
              placeholder="¿Quién recibió?"
              className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setModalEntrega(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleMarcarEntrega}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Abono */}
      {modalAbono && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Registrar Abono</h3>
            <div className="space-y-3">
              <input
                type="number"
                value={abonoForm.monto}
                onChange={(e) => setAbonoForm({ ...abonoForm, monto: e.target.value })}
                placeholder="Monto"
                className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none"
                autoFocus
              />
              <select
                value={abonoForm.metodoPago}
                onChange={(e) => setAbonoForm({ ...abonoForm, metodoPago: e.target.value as any })}
                className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none"
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
              <input
                type="text"
                value={abonoForm.concepto}
                onChange={(e) => setAbonoForm({ ...abonoForm, concepto: e.target.value })}
                placeholder="Concepto (ej: Anticipo, Liquidación)"
                className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setModalAbono(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegistrarAbono}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
