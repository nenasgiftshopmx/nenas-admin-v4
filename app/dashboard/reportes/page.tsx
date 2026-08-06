'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getNotas } from '@/lib/firestore';
import { Nota } from '@/types';

type TabReporte = 'entregas' | 'pagos' | 'equipo';

export default function ReportesPage() {
  const { user, usuarioData, loading: authLoading } = useAuth();
  const router = useRouter();

  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabReporte>('entregas');
  const [periodoAbonos, setPeriodoAbonos] = useState<'hoy' | 'semana' | 'mes'>('semana');

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && usuarioData?.rol === 'admin') cargarNotas();
    else if (user && usuarioData) setLoading(false);
  }, [user, usuarioData]);

  const cargarNotas = async () => {
    try { const data = await getNotas(); setNotas(data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center"><div className="text-4xl mb-3 animate-bounce">🎀</div><p className="text-gray-600">Cargando...</p></div>
      </div>
    );
  }

  // ACCESO DENEGADO para no admins
  if (usuarioData?.rol !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-8">
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-8 max-w-sm w-full text-center shadow-sm">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Acceso restringido</h2>
          <p className="text-gray-500 text-sm mb-6">
            Los reportes de ventas y estadísticas solo están disponibles para administradoras.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const inicioSemana = new Date(hoy);
  inicioSemana.setDate(hoy.getDate() - hoy.getDay());
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const notasActivas = notas.filter(n => !n.archivada);

  const todosTrabajos = notasActivas.flatMap(n => n.trabajos.map(t => ({ ...t, nota: n })));
  const trabajosPendientes = todosTrabajos.filter(t => !t.entregado);
  const trabajosEntregados = todosTrabajos.filter(t => t.entregado);

  const vencidos = trabajosPendientes.filter(t => {
    const f = new Date(parseInt(t.fechaEntrega.anio), parseInt(t.fechaEntrega.mes) - 1, parseInt(t.fechaEntrega.dia));
    return f < hoy;
  });

  const proximos7dias = trabajosPendientes.filter(t => {
    const f = new Date(parseInt(t.fechaEntrega.anio), parseInt(t.fechaEntrega.mes) - 1, parseInt(t.fechaEntrega.dia));
    const fin = new Date(hoy); fin.setDate(hoy.getDate() + 7);
    return f >= hoy && f <= fin;
  }).sort((a, b) => {
    const fa = new Date(parseInt(a.fechaEntrega.anio), parseInt(a.fechaEntrega.mes) - 1, parseInt(a.fechaEntrega.dia));
    const fb = new Date(parseInt(b.fechaEntrega.anio), parseInt(b.fechaEntrega.mes) - 1, parseInt(b.fechaEntrega.dia));
    return fa.getTime() - fb.getTime();
  });

  const tasaCumplimiento = todosTrabajos.length > 0 ? Math.round((trabajosEntregados.length / todosTrabajos.length) * 100) : 0;

  const getPeriodoInicio = () => {
    if (periodoAbonos === 'hoy') return hoy;
    if (periodoAbonos === 'semana') return inicioSemana;
    return inicioMes;
  };

  const abonosPeriodo = notas.flatMap(n => (n.abonos ?? []).map(a => ({ ...a, nota: n })))
    .filter(a => { 
      try {
        // Si fecha es null, tratarla como "hoy"
        const f = a.fecha && typeof a.fecha === 'object' && 'seconds' in a.fecha 
          ? new Date(a.fecha.seconds * 1000)
          : hoy;
        const fCopia = new Date(f);
        fCopia.setHours(0,0,0,0); 
        return fCopia >= getPeriodoInicio();
      } catch {
        // Si hay error, asumir que es de hoy
        return hoy >= getPeriodoInicio();
      }
    })
    .sort((a, b) => {
      try {
        const aSeconds = a.fecha && typeof a.fecha === 'object' && 'seconds' in a.fecha ? a.fecha.seconds : Math.floor(hoy.getTime() / 1000);
        const bSeconds = b.fecha && typeof b.fecha === 'object' && 'seconds' in b.fecha ? b.fecha.seconds : Math.floor(hoy.getTime() / 1000);
        return bSeconds - aSeconds;
      } catch {
        return 0;
      }
    });

  const totalCobradoPeriodo = abonosPeriodo.reduce((s, a) => s + a.monto, 0);

  const clientesConSaldo = notasActivas
    .filter(n => { const s = n.total - (n.abonos?.reduce((x,a) => x+a.monto,0)??0); return s > 0; })
    .map(n => ({
      nota: n,
      saldo: n.total - (n.abonos?.reduce((s,a) => s+a.monto,0)??0),
      diasSinPagar: n.fechaCreacion && typeof n.fechaCreacion === 'object' && 'seconds' in n.fechaCreacion ? Math.floor((hoy.getTime() - new Date(n.fechaCreacion.seconds*1000).getTime()) / (1000*60*60*24)) : 0,
      todoEntregado: n.trabajos.every(t => t.entregado),
    })).sort((a, b) => b.saldo - a.saldo);

  const porCobrarEntregadas = clientesConSaldo.filter(c => c.todoEntregado);
  const porCobrarSinEntregar = clientesConSaldo.filter(c => !c.todoEntregado);
  const totalPorCobrarEntregadas = porCobrarEntregadas.reduce((s,c) => s+c.saldo, 0);
  const totalPorCobrarSinEntregar = porCobrarSinEntregar.reduce((s,c) => s+c.saldo, 0);

  const entregasPorUsuario: Record<string, { nombre: string; entregados: number }> = {};
  trabajosEntregados.forEach(t => {
    const key = t.entregadoPor || 'desconocido';
    if (!entregasPorUsuario[key]) entregasPorUsuario[key] = { nombre: t.entregadoPorNombre || 'Sin asignar', entregados: 0 };
    entregasPorUsuario[key].entregados++;
  });
  const equipoOrdenado = Object.values(entregasPorUsuario).sort((a, b) => b.entregados - a.entregados);

  const cobrosPorUsuario: Record<string, { nombre: string; total: number; count: number }> = {};
  notas.flatMap(n => n.abonos ?? []).filter(a => a && a.cobradoPor).forEach(a => {
    if (!cobrosPorUsuario[a.cobradoPor]) cobrosPorUsuario[a.cobradoPor] = { nombre: a.cobradoPorNombre || 'Desconocido', total: 0, count: 0 };
    cobrosPorUsuario[a.cobradoPor].total += a.monto;
    cobrosPorUsuario[a.cobradoPor].count++;
  });
  const cobrosOrdenados = Object.values(cobrosPorUsuario).sort((a, b) => b.total - a.total);

  const formatFecha = (dia: string, mes: string, anio: string) => `${dia}/${mes}/${anio}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-2xl hover:scale-110 transition-transform">←</button>
            <div><h1 className="text-xl font-bold text-gray-800">Reportes</h1><p className="text-sm text-gray-500">Vista del negocio</p></div>
          </div>
          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">🔒 Admin</span>
        </div>
      </div>

      <div className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 flex gap-0">
          {[{ key: 'entregas', label: '📦 Entregas' }, { key: 'pagos', label: '💰 Pagos' }, { key: 'equipo', label: '👥 Equipo' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as TabReporte)}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${tab === t.key ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {tab === 'entregas' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border-2 border-gray-100 p-4 text-center">
                <div className="text-4xl font-extrabold text-purple-600">{tasaCumplimiento}%</div>
                <div className="text-sm text-gray-500">Tasa de cumplimiento</div>
                <div className="text-xs text-gray-400 mt-1">{trabajosEntregados.length} de {todosTrabajos.length} entregas</div>
              </div>
              <div className={`rounded-xl border-2 p-4 text-center ${vencidos.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <div className={`text-4xl font-extrabold ${vencidos.length > 0 ? 'text-red-600' : 'text-green-600'}`}>{vencidos.length}</div>
                <div className={`text-sm ${vencidos.length > 0 ? 'text-red-600' : 'text-green-600'}`}>{vencidos.length > 0 ? '🔴 Vencidos' : '✅ Sin vencidos'}</div>
                <div className="text-xs text-gray-400 mt-1">Trabajos atrasados</div>
              </div>
            </div>

            {vencidos.length > 0 && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <h3 className="font-bold text-red-700 mb-3">🔴 Entregas vencidas</h3>
                <div className="space-y-2">
                  {vencidos.map((t, idx) => {
                    const diasRetraso = Math.floor((hoy.getTime() - new Date(parseInt(t.fechaEntrega.anio), parseInt(t.fechaEntrega.mes)-1, parseInt(t.fechaEntrega.dia)).getTime()) / (1000*60*60*24));
                    return (
                      <button key={idx} onClick={() => router.push(`/dashboard/notas/${t.nota.id}`)} className="w-full bg-white rounded-lg px-3 py-2 flex items-center justify-between hover:shadow-sm border border-red-100">
                        <div className="text-left"><p className="text-xs font-bold text-pink-600">{t.nota.folio}</p><p className="text-sm font-bold text-gray-800">{t.nota.clienteNombre}</p><p className="text-xs text-gray-500">{t.producto}</p></div>
                        <div className="text-right"><p className="text-xs font-bold text-red-600">{diasRetraso} día(s) atraso</p><p className="text-xs text-gray-400">{formatFecha(t.fechaEntrega.dia, t.fechaEntrega.mes, t.fechaEntrega.anio)}</p></div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-white border-2 border-gray-100 rounded-xl p-4">
              <h3 className="font-bold text-gray-700 mb-3">📅 Próximos 7 días ({proximos7dias.length})</h3>
              {proximos7dias.length === 0 ? <p className="text-gray-400 text-sm text-center py-4">Sin entregas programadas</p> : (
                <div className="space-y-2">
                  {proximos7dias.map((t, idx) => {
                    const fechaEntrega = new Date(parseInt(t.fechaEntrega.anio), parseInt(t.fechaEntrega.mes)-1, parseInt(t.fechaEntrega.dia));
                    const diasRestantes = Math.ceil((fechaEntrega.getTime() - hoy.getTime()) / (1000*60*60*24));
                    return (
                      <button key={idx} onClick={() => router.push(`/dashboard/notas/${t.nota.id}`)} className="w-full bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between hover:bg-purple-50 border border-gray-100">
                        <div className="text-left"><p className="text-xs font-bold text-pink-600">{t.nota.folio} · {t.nota.clienteNombre}</p><p className="text-sm text-gray-700">{t.producto}</p></div>
                        <div className="text-right">
                          <p className={`text-xs font-bold ${diasRestantes === 0 ? 'text-red-600' : diasRestantes <= 2 ? 'text-orange-600' : 'text-green-600'}`}>{diasRestantes === 0 ? '¡Hoy!' : `${diasRestantes} día(s)`}</p>
                          <p className="text-xs text-gray-400">{formatFecha(t.fechaEntrega.dia, t.fechaEntrega.mes, t.fechaEntrega.anio)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'pagos' && (
          <>
            <div className="flex gap-2">
              {[{ k: 'hoy', l: 'Hoy' }, { k: 'semana', l: 'Esta semana' }, { k: 'mes', l: 'Este mes' }].map(p => (
                <button key={p.k} onClick={() => setPeriodoAbonos(p.k as any)} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${periodoAbonos === p.k ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>{p.l}</button>
              ))}
            </div>

            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5 text-center">
              <div className="text-4xl font-extrabold text-green-600">${totalCobradoPeriodo.toLocaleString()}</div>
              <div className="text-sm text-green-700 font-semibold mt-1">Cobrado {periodoAbonos === 'hoy' ? 'hoy' : periodoAbonos === 'semana' ? 'esta semana' : 'este mes'}</div>
              <div className="text-xs text-green-500">{abonosPeriodo.length} abono(s)</div>
            </div>

            {abonosPeriodo.length > 0 && (
              <div className="bg-white border-2 border-gray-100 rounded-xl p-4">
                <h3 className="font-bold text-gray-700 mb-3">Abonos registrados</h3>
                <div className="space-y-2">
                  {abonosPeriodo.map((a, idx) => (
                    <button key={idx} onClick={() => router.push(`/dashboard/notas/${a.nota.id}`)} className="w-full flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 hover:bg-purple-50 border border-gray-100">
                      <div className="text-left"><p className="text-xs font-bold text-pink-600">{a.nota.folio} · {a.nota.clienteNombre}</p><p className="text-xs text-gray-500">{a.cobradoPorNombre || 'Desconocido'} · {a.concepto}</p></div>
                      <div className="text-right"><p className="font-bold text-green-600">${a.monto.toLocaleString()}</p><p className="text-xs text-gray-400">{a.metodoPago === 'efectivo' ? '💵' : a.metodoPago === 'transferencia' ? '📱' : '💳'} {a.metodoPago}</p></div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Resumen desglose */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-red-50 border-2 border-red-100 rounded-xl p-3 text-center">
                <div className="text-xl font-extrabold text-red-600">${clientesConSaldo.reduce((s,c) => s+c.saldo, 0).toLocaleString()}</div>
                <div className="text-xs text-red-500 font-semibold">Total por cobrar</div>
                <div className="text-xs text-red-400">{clientesConSaldo.length} nota(s)</div>
              </div>
              <div className="bg-orange-50 border-2 border-orange-100 rounded-xl p-3 text-center">
                <div className="text-xl font-extrabold text-orange-600">${totalPorCobrarEntregadas.toLocaleString()}</div>
                <div className="text-xs text-orange-500 font-semibold">Entregadas</div>
                <div className="text-xs text-orange-400">{porCobrarEntregadas.length} nota(s)</div>
              </div>
              <div className="bg-yellow-50 border-2 border-yellow-100 rounded-xl p-3 text-center">
                <div className="text-xl font-extrabold text-yellow-600">${totalPorCobrarSinEntregar.toLocaleString()}</div>
                <div className="text-xs text-yellow-600 font-semibold">Sin entregar</div>
                <div className="text-xs text-yellow-500">{porCobrarSinEntregar.length} nota(s)</div>
              </div>
            </div>

            {/* Por cobrar - Entregadas (prioritario cobrar) */}
            {porCobrarEntregadas.length > 0 && (
              <div className="bg-white border-2 border-orange-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">⚠️</span>
                  <div>
                    <h3 className="font-bold text-orange-700">Ya entregado — pendiente de cobro</h3>
                    <p className="text-xs text-orange-500">Producto entregado pero no pagado completamente</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {porCobrarEntregadas.map((c, idx) => (
                    <button key={idx} onClick={() => router.push(`/dashboard/notas/${c.nota.id}`)} className="w-full flex items-center justify-between bg-orange-50 rounded-lg px-3 py-2 hover:bg-orange-100 border border-orange-100">
                      <div className="text-left"><p className="text-xs font-bold text-pink-600">{c.nota.folio}</p><p className="text-sm font-bold text-gray-800">{c.nota.clienteNombre}</p><p className="text-xs text-gray-400">{c.diasSinPagar} días desde creación</p></div>
                      <div className="text-right"><p className="font-bold text-orange-600">${c.saldo.toLocaleString()}</p><p className="text-xs text-gray-400">de ${c.nota.total.toLocaleString()}</p></div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Por cobrar - Sin entregar */}
            {porCobrarSinEntregar.length > 0 && (
              <div className="bg-white border-2 border-yellow-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📦</span>
                  <div>
                    <h3 className="font-bold text-yellow-700">Pendiente entregar y cobrar</h3>
                    <p className="text-xs text-yellow-500">Trabajos aún no entregados con saldo pendiente</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {porCobrarSinEntregar.map((c, idx) => (
                    <button key={idx} onClick={() => router.push(`/dashboard/notas/${c.nota.id}`)} className="w-full flex items-center justify-between bg-yellow-50 rounded-lg px-3 py-2 hover:bg-yellow-100 border border-yellow-100">
                      <div className="text-left"><p className="text-xs font-bold text-pink-600">{c.nota.folio}</p><p className="text-sm font-bold text-gray-800">{c.nota.clienteNombre}</p><p className="text-xs text-gray-400">{c.nota.trabajos.filter(t => !t.entregado).length} trabajo(s) pendiente(s)</p></div>
                      <div className="text-right"><p className="font-bold text-yellow-600">${c.saldo.toLocaleString()}</p><p className="text-xs text-gray-400">de ${c.nota.total.toLocaleString()}</p></div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {clientesConSaldo.length === 0 && (
              <div className="bg-green-50 border-2 border-green-100 rounded-xl p-6 text-center">
                <div className="text-4xl mb-2">✅</div>
                <p className="text-green-600 font-semibold">Todo cobrado</p>
              </div>
            )}
          </>
        )}

        {tab === 'equipo' && (
          <>
            <div className="bg-white border-2 border-gray-100 rounded-xl p-4">
              <h3 className="font-bold text-gray-700 mb-3">📦 Entregas realizadas</h3>
              {equipoOrdenado.length === 0 ? <p className="text-gray-400 text-sm text-center py-4">Sin entregas registradas</p> : (
                <div className="space-y-3">
                  {equipoOrdenado.map((u, idx) => {
                    const pct = trabajosEntregados.length > 0 ? Math.round((u.entregados / trabajosEntregados.length) * 100) : 0;
                    return (
                      <div key={idx}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm">{u.nombre.charAt(0)}</div>
                            <span className="font-semibold text-gray-800">{u.nombre}</span>
                          </div>
                          <div className="text-right"><span className="font-bold text-purple-600">{u.entregados}</span><span className="text-xs text-gray-400 ml-1">entregas ({pct}%)</span></div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2"><div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white border-2 border-gray-100 rounded-xl p-4">
              <h3 className="font-bold text-gray-700 mb-3">💰 Cobros por persona</h3>
              {cobrosOrdenados.length === 0 ? <p className="text-gray-400 text-sm text-center py-4">Sin cobros registrados</p> : (
                <div className="space-y-3">
                  {cobrosOrdenados.map((u, idx) => {
                    const total = cobrosOrdenados.reduce((s,c) => s+c.total, 0);
                    const pct = total > 0 ? Math.round((u.total / total) * 100) : 0;
                    return (
                      <div key={idx}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-sm">{u.nombre.charAt(0)}</div>
                            <div><span className="font-semibold text-gray-800">{u.nombre}</span><p className="text-xs text-gray-400">{u.count} cobro(s)</p></div>
                          </div>
                          <div className="text-right"><span className="font-bold text-green-600">${u.total.toLocaleString()}</span><p className="text-xs text-gray-400">{pct}%</p></div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2"><div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-purple-50 border-2 border-purple-100 rounded-xl p-4 text-center">
                <div className="text-2xl font-extrabold text-purple-600">{trabajosEntregados.length}</div>
                <div className="text-xs text-purple-500">Total entregas</div>
              </div>
              <div className="bg-green-50 border-2 border-green-100 rounded-xl p-4 text-center">
                <div className="text-2xl font-extrabold text-green-600">${notas.flatMap(n => n.abonos??[]).reduce((s,a) => s+a.monto, 0).toLocaleString()}</div>
                <div className="text-xs text-green-500">Total cobrado histórico</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
