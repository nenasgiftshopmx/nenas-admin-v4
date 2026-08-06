'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getNotas } from '@/lib/firestore';
import { Nota } from '@/types';

type TipoImpresion = 'nota' | 'trabajos_dia' | 'cobros' | 'calendario_semana';

function ImpresionContent() {
  const { user, usuarioData, loading: authLoading } = useAuth();
  const esAdmin = usuarioData?.rol === 'admin';
  const router = useRouter();

  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState<TipoImpresion>('nota');
  const [notaSeleccionada, setNotaSeleccionada] = useState<string>('');
  const [filtroPersona, setFiltroPersona] = useState<string>('todos');
  const [periodoCobros, setPeriodoCobros] = useState<'hoy' | 'semana' | 'mes'>('hoy');
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) cargarNotas();
  }, [user]);

  const cargarNotas = async () => {
    try { const data = await getNotas(); setNotas(data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const personas = Array.from(
    new Map(notas.filter(n => n.asignadaA).map(n => [n.asignadaA, { email: n.asignadaA!, nombre: n.asignadaNombre! }])).values()
  );

  const notasActivas = notas.filter(n => !n.archivada);
  const notaImprimir = notas.find(n => n.id === notaSeleccionada);

  const trabajosHoy = notasActivas.flatMap(n =>
    n.trabajos.filter(t => {
      if (t.entregado) return false;
      const f = new Date(parseInt(t.fechaEntrega.anio), parseInt(t.fechaEntrega.mes) - 1, parseInt(t.fechaEntrega.dia));
      f.setHours(0, 0, 0, 0);
      return f.getTime() === hoy.getTime();
    }).map(t => ({ ...t, nota: n }))
  ).filter(t => filtroPersona === 'todos' || t.nota.asignadaA === filtroPersona);

  const getInicioP = () => {
    if (periodoCobros === 'hoy') return hoy;
    if (periodoCobros === 'semana') { const d = new Date(hoy); d.setDate(hoy.getDate() - hoy.getDay()); return d; }
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  };

  const abonosPeriodo = notas.flatMap(n =>
    (n.abonos ?? []).filter(a => a.fecha && typeof a.fecha === 'object' && 'seconds' in a.fecha).map(a => ({ ...a, nota: n }))
  ).filter(a => {
    try {
      const f = new Date(a.fecha.seconds * 1000);
      f.setHours(0, 0, 0, 0);
      return f >= getInicioP();
    } catch {
      return false;
    }
  }).sort((a, b) => {
    try {
      return b.fecha.seconds - a.fecha.seconds;
    } catch {
      return 0;
    }
  });

  const totalCobradoPeriodo = abonosPeriodo.reduce((s, a) => s + a.monto, 0);

  const getLunesSemana = () => {
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    return lunes;
  };

  const diasSemanaActual = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(getLunesSemana());
    d.setDate(getLunesSemana().getDate() + i);
    return d;
  });

  const getTrabajosDia = (dia: Date) => {
    return notasActivas.flatMap(n =>
      n.trabajos.filter(t => {
        const f = new Date(parseInt(t.fechaEntrega.anio), parseInt(t.fechaEntrega.mes) - 1, parseInt(t.fechaEntrega.dia));
        f.setHours(0, 0, 0, 0);
        return f.getTime() === dia.getTime();
      }).map(t => ({ ...t, nota: n }))
    ).filter(t => filtroPersona === 'todos' || t.nota.asignadaA === filtroPersona);
  };

  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const formatFecha = (d: Date) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center"><div className="text-4xl animate-bounce">🎀</div><p>Cargando...</p></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b no-print">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-2xl">←</button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Imprimir / Exportar</h1>
              <p className="text-sm text-gray-500">Documentos y reportes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 no-print space-y-6">
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-4">
          <p className="text-sm font-bold text-gray-600 mb-3">¿Qué quieres imprimir?</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'nota', emoji: '🧾', label: 'Nota de Venta', desc: 'Recibo para el cliente' },
              { key: 'trabajos_dia', emoji: '📋', label: 'Trabajos del Día', desc: 'Lista de entregas de hoy' },
              ...(esAdmin ? [{ key: 'cobros', emoji: '💰', label: 'Reporte de Cobros', desc: 'Abonos por período' }] : []),
              { key: 'calendario_semana', emoji: '📅', label: 'Calendario Semanal', desc: 'Entregas de la semana' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => { setTipo(t.key as TipoImpresion); setPreview(false); }}
                className={`p-4 rounded-xl border-2 text-left transition-all ${tipo === t.key ? 'border-purple-400 bg-purple-50' : 'border-gray-100 hover:border-gray-200'}`}
              >
                <div className="text-2xl mb-1">{t.emoji}</div>
                <div className="font-bold text-sm text-gray-800">{t.label}</div>
                <div className="text-xs text-gray-500">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {tipo === 'nota' && (
          <div className="bg-white rounded-2xl border-2 border-gray-100 p-4">
            <p className="text-sm font-bold text-gray-600 mb-3">Selecciona la nota</p>
            <select value={notaSeleccionada} onChange={(e) => setNotaSeleccionada(e.target.value)} className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:outline-none">
              <option value="">— Seleccionar nota —</option>
              {notasActivas.map(n => <option key={n.id} value={n.id}>{n.folio} · {n.clienteNombre} · ${n.total.toLocaleString()}</option>)}
            </select>
          </div>
        )}

        {(tipo === 'trabajos_dia' || tipo === 'calendario_semana') && personas.length > 0 && (
          <div className="bg-white rounded-2xl border-2 border-gray-100 p-4">
            <p className="text-sm font-bold text-gray-600 mb-3">Filtrar por persona</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setFiltroPersona('todos')} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${filtroPersona === 'todos' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>Todas</button>
              {personas.map(p => (
                <button key={p.email} onClick={() => setFiltroPersona(p.email)} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${filtroPersona === p.email ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{p.nombre}</button>
              ))}
            </div>
          </div>
        )}

        {tipo === 'cobros' && (
          <div className="bg-white rounded-2xl border-2 border-gray-100 p-4">
            <p className="text-sm font-bold text-gray-600 mb-3">Período</p>
            <div className="flex gap-2">
              {[{ k: 'hoy', l: 'Hoy' }, { k: 'semana', l: 'Esta semana' }, { k: 'mes', l: 'Este mes' }].map(p => (
                <button key={p.k} onClick={() => setPeriodoCobros(p.k as any)} className={`flex-1 py-2 rounded-lg text-sm font-bold ${periodoCobros === p.k ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{p.l}</button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => setPreview(true)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">👁️ Vista previa</button>
          <button onClick={() => { setPreview(true); setTimeout(() => window.print(), 300); }} className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-bold hover:from-pink-600 hover:to-purple-700">🖨️ Imprimir / PDF</button>
        </div>
      </div>

      {preview && (
        <div className="print-area max-w-2xl mx-auto px-4 pb-8">

          {tipo === 'nota' && notaImprimir && (
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 font-sans">
              <div className="flex items-start justify-between mb-6 pb-6 border-b-2 border-gray-200">
                <div><div className="text-3xl mb-1">🎀</div><h1 className="text-2xl font-extrabold text-gray-800">Nenas Gift Shop</h1><p className="text-gray-500 text-sm">Sistema de Administración</p></div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-pink-600">{notaImprimir.folio}</div>
                  <p className="text-sm text-gray-500">{notaImprimir.fechaCreacion && typeof notaImprimir.fechaCreacion === 'object' && 'seconds' in notaImprimir.fechaCreacion ? new Date(notaImprimir.fechaCreacion.seconds * 1000).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : formatFecha(hoy)}</p>
                </div>
              </div>
              <div className="mb-6 bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-bold text-gray-500 mb-2">CLIENTE</p>
                <p className="text-xl font-bold text-gray-800">{notaImprimir.clienteNombre}</p>
                {notaImprimir.clienteTelefono && <p className="text-gray-600">{notaImprimir.clienteTelefono}</p>}
                {notaImprimir.evento && <p className="text-gray-500 text-sm">Evento: {notaImprimir.evento}</p>}
              </div>
              <div className="mb-6">
                <p className="text-xs font-bold text-gray-500 mb-3">DETALLE DEL PEDIDO</p>
                <table className="w-full">
                  <thead><tr className="border-b-2 border-gray-200">
                    <th className="text-left text-xs font-bold text-gray-500 py-2">PRODUCTO</th>
                    <th className="text-center text-xs font-bold text-gray-500 py-2">CANT</th>
                    <th className="text-right text-xs font-bold text-gray-500 py-2">PRECIO</th>
                    <th className="text-right text-xs font-bold text-gray-500 py-2">SUBTOTAL</th>
                    <th className="text-center text-xs font-bold text-gray-500 py-2">ENTREGA</th>
                  </tr></thead>
                  <tbody>
                    {notaImprimir.trabajos.map((t, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-3 text-sm text-gray-800 font-semibold">{t.producto}</td>
                        <td className="py-3 text-sm text-center text-gray-600">{t.cantidad}</td>
                        <td className="py-3 text-sm text-right text-gray-600">${t.precioUnitario.toLocaleString()}</td>
                        <td className="py-3 text-sm text-right font-bold text-gray-800">${t.subtotal.toLocaleString()}</td>
                        <td className="py-3 text-xs text-center text-gray-500">{t.fechaEntrega.dia}/{t.fechaEntrega.mes}/{t.fechaEntrega.anio}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mb-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Total del pedido:</span><span className="font-bold text-gray-800">${notaImprimir.total.toLocaleString()}</span></div>
                  {notaImprimir.abonos?.map((a, i) => (
                    <div key={i} className="flex justify-between text-sm"><span className="text-green-600">Abono ({a.concepto}):</span><span className="font-bold text-green-600">- ${a.monto.toLocaleString()}</span></div>
                  ))}
                  <div className="border-t-2 border-purple-200 pt-2 flex justify-between">
                    <span className="font-extrabold text-gray-800 text-lg">SALDO A PAGAR:</span>
                    <span className={`font-extrabold text-xl ${notaImprimir.saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ${Math.max(0, notaImprimir.total - (notaImprimir.abonos?.reduce((s, a) => s + a.monto, 0) ?? 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              {notaImprimir.notas && <div className="mb-6 border-l-4 border-purple-200 pl-4"><p className="text-xs font-bold text-gray-500 mb-1">NOTAS</p><p className="text-sm text-gray-600">{notaImprimir.notas}</p></div>}
              <div className="border-t-2 border-gray-200 pt-4 text-center text-xs text-gray-400">Atendida por: {notaImprimir.asignadaNombre || '-'} · Nenas Gift Shop 🎀</div>
            </div>
          )}

          {tipo === 'trabajos_dia' && (
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-8">
              <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-gray-200">
                <div><div className="text-2xl mb-1">🎀</div><h1 className="text-xl font-extrabold text-gray-800">Nenas Gift Shop</h1></div>
                <div className="text-right">
                  <h2 className="text-lg font-bold text-purple-600">📋 Trabajos del Día</h2>
                  <p className="text-sm text-gray-500 capitalize">{formatFecha(hoy)}</p>
                  {filtroPersona !== 'todos' && <p className="text-sm font-bold text-gray-700">{personas.find(p => p.email === filtroPersona)?.nombre}</p>}
                </div>
              </div>
              {trabajosHoy.length === 0 ? (
                <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-2">✅</div><p className="font-semibold">Sin entregas pendientes hoy</p></div>
              ) : (
                <div className="space-y-3">
                  {trabajosHoy.map((t, idx) => (
                    <div key={idx} className="border-2 border-gray-100 rounded-xl p-4 flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center font-bold text-purple-600 text-sm flex-shrink-0">{idx + 1}</div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-800">{t.producto}</p>
                        <p className="text-sm text-gray-500">{t.nota.folio} · {t.nota.clienteNombre} · ×{t.cantidad}</p>
                        {t.nota.clienteTelefono && <p className="text-xs text-gray-400">{t.nota.clienteTelefono}</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-purple-600">${t.subtotal.toLocaleString()}</p>
                        <div className="mt-2 w-24 h-8 border-2 border-dashed border-gray-300 rounded flex items-center justify-center"><span className="text-xs text-gray-300">✓ entregado</span></div>
                      </div>
                    </div>
                  ))}
                  <div className="border-t-2 border-gray-200 pt-3 flex justify-between">
                    <span className="font-bold text-gray-600">Total trabajos: {trabajosHoy.length}</span>
                    <span className="font-bold text-purple-600">${trabajosHoy.reduce((s, t) => s + t.subtotal, 0).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {tipo === 'cobros' && (
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-8">
              <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-gray-200">
                <div><div className="text-2xl mb-1">🎀</div><h1 className="text-xl font-extrabold text-gray-800">Nenas Gift Shop</h1></div>
                <div className="text-right">
                  <h2 className="text-lg font-bold text-green-600">💰 Reporte de Cobros</h2>
                  <p className="text-sm text-gray-500">{periodoCobros === 'hoy' ? formatFecha(hoy) : periodoCobros === 'semana' ? 'Esta semana' : 'Este mes'}</p>
                </div>
              </div>
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-6 text-center">
                <p className="text-sm text-green-600 font-semibold">Total cobrado</p>
                <p className="text-4xl font-extrabold text-green-600">${totalCobradoPeriodo.toLocaleString()}</p>
                <p className="text-sm text-green-500">{abonosPeriodo.length} abono(s)</p>
              </div>
              {abonosPeriodo.length === 0 ? <p className="text-center text-gray-400 py-8">Sin cobros en este período</p> : (
                <table className="w-full">
                  <thead><tr className="border-b-2 border-gray-200">
                    <th className="text-left text-xs font-bold text-gray-500 py-2">FOLIO / CLIENTE</th>
                    <th className="text-left text-xs font-bold text-gray-500 py-2">COBRADO POR</th>
                    <th className="text-left text-xs font-bold text-gray-500 py-2">MÉTODO</th>
                    <th className="text-right text-xs font-bold text-gray-500 py-2">MONTO</th>
                  </tr></thead>
                  <tbody>
                    {abonosPeriodo.map((a, idx) => (
                      <tr key={idx} className="border-b border-gray-50">
                        <td className="py-2"><p className="text-xs font-bold text-pink-600">{a.nota.folio}</p><p className="text-sm text-gray-800">{a.nota.clienteNombre}</p></td>
                        <td className="py-2 text-sm text-gray-600">{a.cobradoPorNombre}</td>
                        <td className="py-2 text-sm text-gray-600 capitalize">{a.metodoPago}</td>
                        <td className="py-2 text-right font-bold text-green-600">${a.monto.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="border-t-2 border-gray-200">
                    <td colSpan={3} className="py-3 font-extrabold text-gray-800">TOTAL</td>
                    <td className="py-3 text-right font-extrabold text-green-600 text-lg">${totalCobradoPeriodo.toLocaleString()}</td>
                  </tr></tfoot>
                </table>
              )}
            </div>
          )}

          {tipo === 'calendario_semana' && (
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
              <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-gray-200">
                <div><div className="text-2xl mb-1">🎀</div><h1 className="text-xl font-extrabold text-gray-800">Nenas Gift Shop</h1></div>
                <div className="text-right">
                  <h2 className="text-lg font-bold text-purple-600">📅 Semana de trabajo</h2>
                  <p className="text-sm text-gray-500">{formatFecha(diasSemanaActual[0])} — {formatFecha(diasSemanaActual[6])}</p>
                  {filtroPersona !== 'todos' && <p className="text-sm font-bold text-purple-600">{personas.find(p => p.email === filtroPersona)?.nombre}</p>}
                </div>
              </div>
              <div className="space-y-4">
                {diasSemanaActual.map((dia, idx) => {
                  const trabajosDia = getTrabajosDia(dia);
                  const esHoy = dia.getTime() === hoy.getTime();
                  return (
                    <div key={idx} className={`border-2 rounded-xl overflow-hidden ${esHoy ? 'border-purple-300' : 'border-gray-100'}`}>
                      <div className={`px-4 py-2 flex items-center justify-between ${esHoy ? 'bg-purple-600 text-white' : 'bg-gray-50'}`}>
                        <span className={`font-bold text-sm ${esHoy ? 'text-white' : 'text-gray-700'}`}>{diasSemana[idx]} {dia.getDate()} {dia.toLocaleDateString('es-MX', { month: 'short' })}{esHoy ? ' · HOY' : ''}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${esHoy ? 'bg-white text-purple-600' : 'bg-purple-100 text-purple-600'}`}>{trabajosDia.length} trabajo(s)</span>
                      </div>
                      {trabajosDia.length === 0 ? <div className="px-4 py-2 text-sm text-gray-300">Sin entregas</div> : (
                        <div className="divide-y divide-gray-50">
                          {trabajosDia.map((t, i) => (
                            <div key={i} className="px-4 py-2 flex items-center justify-between">
                              <div>
                                <p className="text-sm font-bold text-gray-800">{t.producto} ×{t.cantidad}</p>
                                <p className="text-xs text-gray-500">{t.nota.folio} · {t.nota.clienteNombre}</p>
                                {t.nota.clienteTelefono && <p className="text-xs text-gray-400">{t.nota.clienteTelefono}</p>}
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-gray-700">{t.nota.asignadaNombre?.split(' ')[0]}</p>
                                <div className="w-20 h-6 border border-dashed border-gray-300 rounded mt-1 flex items-center justify-center"><span className="text-xs text-gray-200">✓</span></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 no-print">
            <button onClick={() => setPreview(false)} className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">Cerrar vista previa</button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-area { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}

export default function ImpresionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center"><div className="text-4xl animate-bounce">🎀</div><p>Cargando...</p></div>
      </div>
    }>
      <ImpresionContent />
    </Suspense>
  );
}
