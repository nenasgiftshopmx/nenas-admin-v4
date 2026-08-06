'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getNotas, calcularEstadoNota } from '@/lib/firestore';
import { Nota } from '@/types';

interface ClienteResumen {
  nombre: string;
  telefono: string;
  notas: Nota[];
  totalGastado: number;
  totalAbonado: number;
  saldoPendiente: number;
  trabajosPendientes: number;
  trabajosEntregados: number;
  ultimaVisita: any;
  visitas: number;
}

export default function ClientesPage() {
  const { user, usuarioData, loading: authLoading } = useAuth();
  const router = useRouter();

  const [clientes, setClientes] = useState<ClienteResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [clienteDetalle, setClienteDetalle] = useState<ClienteResumen | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) cargarClientes();
  }, [user]);

  const cargarClientes = async () => {
    try {
      const notas = await getNotas();

      // Agrupar notas por cliente (por nombre normalizado)
      const mapa: Record<string, ClienteResumen> = {};

      notas.forEach(nota => {
        const key = nota.clienteNombre.toLowerCase().trim();
        if (!mapa[key]) {
          mapa[key] = {
            nombre: nota.clienteNombre,
            telefono: nota.clienteTelefono || '',
            notas: [],
            totalGastado: 0,
            totalAbonado: 0,
            saldoPendiente: 0,
            trabajosPendientes: 0,
            trabajosEntregados: 0,
            ultimaVisita: null,
            visitas: 0,
          };
        }

        const c = mapa[key];
        c.notas.push(nota);
        c.visitas++;
        c.totalGastado += nota.total;

        const abonado = nota.abonos?.reduce((s, a) => s + a.monto, 0) ?? 0;
        c.totalAbonado += abonado;
        c.saldoPendiente += Math.max(0, nota.total - abonado);

        nota.trabajos.forEach(t => {
          if (t.entregado) c.trabajosEntregados++;
          else c.trabajosPendientes++;
        });

        if (!nota.archivada) {
          if (!c.ultimaVisita || (nota.fechaCreacion && nota.fechaCreacion.seconds > c.ultimaVisita.seconds)) {
            c.ultimaVisita = nota.fechaCreacion;
          }
        }

        // Actualizar teléfono si el actual está vacío
        if (!c.telefono && nota.clienteTelefono) {
          c.telefono = nota.clienteTelefono;
        }
      });

      // Ordenar por saldo pendiente desc, luego por visitas desc
      const lista = Object.values(mapa).sort((a, b) => {
        if (b.saldoPendiente !== a.saldoPendiente) return b.saldoPendiente - a.saldoPendiente;
        return b.visitas - a.visitas;
      });

      setClientes(lista);
    } catch (error) {
      console.error('Error cargando clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.telefono.includes(busqueda)
  );

  const abrirWhatsApp = (telefono: string, nombre: string) => {
    const num = telefono.replace(/\D/g, '');
    const msg = encodeURIComponent(`Hola ${nombre}, te contactamos de Nenas Gift Shop 🎀`);
    window.open(`https://wa.me/52${num}?text=${msg}`, '_blank');
  };

  const formatFecha = (ts: any) => {
    if (!ts) return '-';
    try {
      return new Date(ts.seconds * 1000).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return '-'; }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-bounce">🎀</div>
          <p className="text-gray-600">Cargando clientes...</p>
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
            <button onClick={() => router.push('/dashboard')} className="text-2xl hover:scale-110 transition-transform">←</button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Clientes</h1>
              <p className="text-sm text-gray-500">{clientesFiltrados.length} clientes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Resumen rápido */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border-2 border-gray-100 p-3 text-center">
            <div className="text-2xl font-extrabold text-gray-800">{clientes.length}</div>
            <div className="text-xs text-gray-500">Total clientes</div>
          </div>
          <div className="bg-red-50 rounded-xl border-2 border-red-100 p-3 text-center">
            <div className="text-2xl font-extrabold text-red-600">
              ${clientes.reduce((s, c) => s + c.saldoPendiente, 0).toLocaleString()}
            </div>
            <div className="text-xs text-red-500">Por cobrar</div>
          </div>
          <div className="bg-purple-50 rounded-xl border-2 border-purple-100 p-3 text-center">
            <div className="text-2xl font-extrabold text-purple-600">
              {clientes.filter(c => c.saldoPendiente > 0).length}
            </div>
            <div className="text-xs text-purple-500">Con saldo</div>
          </div>
        </div>

        {/* Búsqueda */}
        <input
          type="text"
          placeholder="🔍 Buscar por nombre o teléfono..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none"
        />

        {/* Lista de clientes */}
        <div className="space-y-3">
          {clientesFiltrados.map((cliente, idx) => (
            <div
              key={idx}
              className={`bg-white rounded-xl border-2 p-4 ${
                cliente.saldoPendiente > 0 ? 'border-red-100' : 'border-gray-100'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">{cliente.nombre}</h3>
                  <div className="flex items-center gap-3 mt-0.5">
                    {cliente.telefono && (
                      <span className="text-sm text-gray-400">{cliente.telefono}</span>
                    )}
                    <span className="text-xs text-gray-400">{cliente.visitas} visita(s)</span>
                    <span className="text-xs text-gray-400">Última: {formatFecha(cliente.ultimaVisita)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-extrabold text-gray-800">${cliente.totalGastado.toLocaleString()}</div>
                  <div className="text-xs text-gray-400">total histórico</div>
                </div>
              </div>

              {/* Barra de estado */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="text-sm font-bold text-gray-600">${cliente.totalAbonado.toLocaleString()}</div>
                  <div className="text-xs text-gray-400">Abonado</div>
                </div>
                <div className={`rounded-lg p-2 text-center ${cliente.saldoPendiente > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <div className={`text-sm font-bold ${cliente.saldoPendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${cliente.saldoPendiente.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">Saldo</div>
                </div>
                <div className={`rounded-lg p-2 text-center ${cliente.trabajosPendientes > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
                  <div className={`text-sm font-bold ${cliente.trabajosPendientes > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {cliente.trabajosPendientes > 0 ? `${cliente.trabajosPendientes} pend.` : '✓ Todo'}
                  </div>
                  <div className="text-xs text-gray-400">Entregas</div>
                </div>
              </div>

              {/* Notas activas del cliente */}
              {cliente.notas.filter(n => !n.archivada).length > 0 && (
                <div className="border-t border-gray-100 pt-3 mb-3">
                  <p className="text-xs font-bold text-gray-500 mb-2">NOTAS ACTIVAS</p>
                  <div className="space-y-1">
                    {cliente.notas.filter(n => !n.archivada).map(nota => {
                      const saldo = nota.total - (nota.abonos?.reduce((s, a) => s + a.monto, 0) ?? 0);
                      const estado = calcularEstadoNota(nota);
                      const pendientes = nota.trabajos.filter(t => !t.entregado).length;
                      return (
                        <button
                          key={nota.id}
                          onClick={() => router.push(`/dashboard/notas/${nota.id}`)}
                          className="w-full flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 hover:bg-purple-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-pink-600">{nota.folio}</span>
                            {pendientes > 0 && (
                              <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">
                                {pendientes} pend.
                              </span>
                            )}
                            {estado.estadoGeneral === 'urgente' && (
                              <span className="text-xs">🔥</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {saldo > 0 && <span className="text-xs font-bold text-red-600">${saldo.toLocaleString()}</span>}
                            <span className="text-xs text-gray-400">→</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/dashboard/notas?busqueda=${encodeURIComponent(cliente.nombre)}`)}
                  className="flex-1 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-sm font-semibold hover:bg-purple-100"
                >
                  📋 Ver notas
                </button>
                {cliente.telefono && (
                  <button
                    onClick={() => abrirWhatsApp(cliente.telefono, cliente.nombre)}
                    className="flex-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-semibold hover:bg-emerald-100"
                  >
                    💬 WhatsApp
                  </button>
                )}
              </div>
            </div>
          ))}

          {clientesFiltrados.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">👥</div>
              <p className="text-gray-500 font-semibold">No se encontraron clientes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
