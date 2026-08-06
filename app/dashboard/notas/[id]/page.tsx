'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useRouter, useParams } from 'next/navigation';
import {
  getNota,
  updateNota,
  marcarTrabajoEntregado,
  registrarAbono,
  calcularEstadoNota,
  tieneEntregasVencidas,
} from '@/lib/firestore';
import { Nota } from '@/types';

export default function NotaDetalladaPage() {
  const { user, usuarioData } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const params = useParams();
  const notaId = params.id as string;

  const [nota, setNota] = useState<Nota | null>(null);
  const [loading, setLoading] = useState(true);
  const [cargandoEntrega, setCargandoEntrega] = useState(false);
  const [cargandoAbono, setCargandoAbono] = useState(false);

  const [modalEntrega, setModalEntrega] = useState<{ id: string; producto: string } | null>(null);
  const [entregadoA, setEntregadoA] = useState('');
  const [modalAbono, setModalAbono] = useState(false);
  const [abonoForm, setAbonoForm] = useState({
    monto: '',
    metodoPago: 'efectivo' as 'efectivo' | 'transferencia' | 'tarjeta',
    concepto: '',
  });

  useEffect(() => {
    if (user && notaId) {
      cargarNota();
    }
  }, [user, notaId]);

  const cargarNota = async () => {
    try {
      const data = await getNota(notaId);
      setNota(data);
    } catch (error) {
      console.error('Error cargando nota:', error);
      showToast('Error al cargar la nota', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMarcarEntrega = async () => {
    if (!modalEntrega || !usuarioData || !entregadoA.trim()) {
      showToast('Indica quién recibió el pedido', 'error');
      return;
    }

    setCargandoEntrega(true);
    try {
      await marcarTrabajoEntregado(
        notaId,
        modalEntrega.id,
        { email: usuarioData.email, nombre: usuarioData.nombre },
        entregadoA
      );
      await cargarNota();
      showToast(`Entrega confirmada a ${entregadoA} ✓`, 'success');
      setModalEntrega(null);
      setEntregadoA('');
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al marcar la entrega', 'error');
    } finally {
      setCargandoEntrega(false);
    }
  };

  const handleRegistrarAbono = async () => {
    if (!usuarioData || !abonoForm.monto) {
      showToast('Ingresa un monto válido', 'error');
      return;
    }

    const monto = parseFloat(abonoForm.monto);
    if (isNaN(monto) || monto <= 0) {
      showToast('El monto debe ser mayor a 0', 'error');
      return;
    }

    setCargandoAbono(true);
    try {
      await registrarAbono(
        notaId,
        {
          monto,
          cobradoPor: usuarioData.email,
          cobradoPorNombre: usuarioData.nombre,
          metodoPago: abonoForm.metodoPago,
          concepto: abonoForm.concepto || 'Abono',
          notas: '',
        },
        { email: usuarioData.email, nombre: usuarioData.nombre }
      );
      await cargarNota();
      showToast(`Abono de $${monto.toLocaleString()} registrado ✓`, 'success');
      setModalAbono(false);
      setAbonoForm({ monto: '', metodoPago: 'efectivo', concepto: '' });
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al registrar el abono', 'error');
    } finally {
      setCargandoAbono(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-bounce">🎀</div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!nota) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-gray-600 font-semibold mb-4">Nota no encontrada</p>
          <button
            onClick={() => router.push('/dashboard/notas')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700"
          >
            Volver a Notas
          </button>
        </div>
      </div>
    );
  }

  const estado = calcularEstadoNota(nota);
  const vencida = tieneEntregasVencidas(nota);
  // Calcular saldo real en pantalla por si está mal en Firebase
  const totalAbonado = nota.abonos?.reduce((sum, a) => sum + a.monto, 0) ?? 0;
  const saldoReal = nota.total - totalAbonado;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard/notas')}
              className="text-2xl hover:scale-110 transition-transform"
            >
              ←
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">{nota.folio}</h1>
              <p className="text-sm text-gray-500">{nota.clienteNombre}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
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
              <span className="px-3 py-1.5 rounded-full text-sm font-bold bg-red-100 text-red-700">
                🔴 Vencida
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* RESUMEN FINANCIERO - PRIMERO Y BIEN VISIBLE */}
        <div className="bg-white rounded-2xl shadow-sm border-2 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">💰 Resumen de Pagos</h2>

          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mb-4 border-2 border-purple-200">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total:</span>
                <span className="font-bold text-gray-800">${nota.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Abonado:</span>
                <span className="font-bold text-green-600">${totalAbonado.toLocaleString()}</span>
              </div>
              <div className="border-t-2 border-purple-300 pt-2 flex justify-between items-center">
                <span className="font-bold text-gray-800">SALDO:</span>
                <span className={`text-2xl font-extrabold ${
                  saldoReal > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  ${saldoReal.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* BOTÓN DE ABONO GRANDE Y VISIBLE */}
          {saldoReal > 0 && (
            <button
              onClick={() => setModalAbono(true)}
              className="w-full px-4 py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              💰 Registrar Abono
            </button>
          )}

          {saldoReal <= 0 && (
            <div className="w-full px-4 py-3 bg-green-50 text-green-700 rounded-xl font-bold text-center border-2 border-green-200">
              ✅ Nota liquidada
            </div>
          )}

          {/* Historial de Abonos */}
          {nota.abonos && nota.abonos.length > 0 && (
            <div className="mt-4">
              <h3 className="font-bold text-gray-700 mb-3 text-sm">Historial de Abonos</h3>
              <div className="space-y-2">
                {nota.abonos.map((abono, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-gray-800">${abono.monto.toLocaleString()}</span>
                      <span className="text-xs font-bold px-2 py-1 rounded bg-blue-100 text-blue-700 capitalize">
                        {abono.metodoPago === 'efectivo' ? '💵 Efectivo' :
                         abono.metodoPago === 'transferencia' ? '📱 Transferencia' : '💳 Tarjeta'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">
                      {abono.cobradoPorNombre} · {abono.fecha && typeof abono.fecha === 'object' && 'seconds' in abono.fecha ? new Date(abono.fecha.seconds * 1000).toLocaleDateString('es-MX') : 'Sin fecha'}
                    </p>
                    {abono.concepto && (
                      <p className="text-xs text-gray-500 mt-1">{abono.concepto}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info Cliente */}
        <div className="bg-white rounded-2xl shadow-sm border-2 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">👤 Información del Cliente</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Cliente</p>
              <p className="font-bold text-gray-800">{nota.clienteNombre}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Teléfono</p>
              <p className="font-bold text-gray-800">{nota.clienteTelefono || '-'}</p>
            </div>
            {nota.evento && (
              <div>
                <p className="text-sm text-gray-500">Evento</p>
                <p className="font-bold text-gray-800">{nota.evento}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">Asignada a</p>
              <p className="font-bold text-gray-800">{nota.asignadaNombre || '-'}</p>
            </div>
          </div>
        </div>

        {/* Trabajos */}
        <div className="bg-white rounded-2xl shadow-sm border-2 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">📦 Trabajos</h2>
          <div className="space-y-4">
            {nota.trabajos.map((trabajo, idx) => (
              <div key={trabajo.id} className={`rounded-xl p-4 border-2 ${
                trabajo.entregado ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-gray-500">#{idx + 1}</span>
                      {trabajo.entregado && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                          ✓ Entregado
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-gray-800">{trabajo.producto}</p>
                    <p className="text-sm text-gray-600">
                      {trabajo.cantidad} × ${trabajo.precioUnitario.toLocaleString()}
                    </p>
                    <p className="text-sm font-bold text-purple-600 mt-1">
                      Subtotal: ${trabajo.subtotal.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3 mt-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Fecha de entrega</p>
                    <p className="font-bold text-gray-800">
                      {trabajo.fechaEntrega.dia}/{trabajo.fechaEntrega.mes}/{trabajo.fechaEntrega.anio}
                    </p>
                  </div>

                  {trabajo.entregado ? (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Entregado a</p>
                      <p className="font-bold text-green-700">{trabajo.entregadoA}</p>
                      <p className="text-xs text-gray-500">por {trabajo.entregadoPorNombre}</p>
                    </div>
                  ) : (
                    <button
                      onClick={() => setModalEntrega({ id: trabajo.id, producto: trabajo.producto })}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 text-sm"
                    >
                      ✓ Marcar Entregado
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notas adicionales */}
        {nota.notas && (
          <div className="bg-white rounded-2xl shadow-sm border-2 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3">📝 Notas Adicionales</h2>
            <p className="text-gray-700">{nota.notas}</p>
          </div>
        )}

      </div>

      {/* Modal Marcar Entrega */}
      {modalEntrega && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="mb-4">
              <div className="text-2xl mb-1">📦</div>
              <h3 className="text-lg font-bold">Confirmar entrega</h3>
              <p className="text-sm text-gray-500">{modalEntrega.producto}</p>
            </div>
            <p className="text-sm text-gray-600 mb-3">¿Quién recibió este pedido?</p>
            <input
              type="text"
              value={entregadoA}
              onChange={(e) => setEntregadoA(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleMarcarEntrega()}
              placeholder="Nombre de quien recibió"
              className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setModalEntrega(null); setEntregadoA(''); }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleMarcarEntrega}
                disabled={cargandoEntrega || !entregadoA.trim()}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-60"
              >
                {cargandoEntrega ? '⏳ Guardando...' : '✓ Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Abono */}
      {modalAbono && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="mb-4">
              <div className="text-2xl mb-1">💰</div>
              <h3 className="text-lg font-bold">Registrar Abono</h3>
              <p className="text-sm text-gray-500">{nota.clienteNombre} · Saldo: ${saldoReal.toLocaleString()}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Monto *</label>
                <input
                  type="number"
                  value={abonoForm.monto}
                  onChange={(e) => setAbonoForm({ ...abonoForm, monto: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none text-lg font-bold"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Método de pago</label>
                <select
                  value={abonoForm.metodoPago}
                  onChange={(e) => setAbonoForm({ ...abonoForm, metodoPago: e.target.value as any })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none"
                >
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="transferencia">📱 Transferencia</option>
                  <option value="tarjeta">💳 Tarjeta</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Concepto</label>
                <input
                  type="text"
                  value={abonoForm.concepto}
                  onChange={(e) => setAbonoForm({ ...abonoForm, concepto: e.target.value })}
                  placeholder="Anticipo, Liquidación..."
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setModalAbono(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegistrarAbono}
                disabled={cargandoAbono || !abonoForm.monto}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-60"
              >
                {cargandoAbono ? '⏳ Guardando...' : '✓ Guardar Abono'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
