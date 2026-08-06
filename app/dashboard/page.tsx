'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getNotas, calcularEstadoNota, tieneEntregasVencidas } from '@/lib/firestore';
import { Nota } from '@/types';

export default function DashboardPage() {
  const { user, usuarioData, loading, signOut } = useAuth();
  const router = useRouter();
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loadingNotas, setLoadingNotas] = useState(true);

  useEffect(() => { if (!loading && !user) router.push('/'); }, [user, loading, router]);
  useEffect(() => { if (user) cargarNotas(); }, [user]);

  const cargarNotas = async () => {
    try { const data = await getNotas(); setNotas(data); }
    catch (e) { console.error(e); }
    finally { setLoadingNotas(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center"><div className="text-4xl mb-3 animate-bounce">🎀</div><p className="text-gray-600">Cargando...</p></div>
    </div>
  );
  if (!user || !usuarioData) return null;

  const esAdmin = usuarioData.rol === 'admin';
  const notasActivas = notas.filter(n => !n.archivada);
  const urgentes = notasActivas.filter(n => { const e = calcularEstadoNota(n); return e.estadoGeneral === 'urgente' || tieneEntregasVencidas(n); });
  const enProceso = notasActivas.filter(n => { const e = calcularEstadoNota(n); return e.estadoGeneral === 'en_proceso' || e.estadoGeneral === 'nueva'; });
  const porCobrar = notasActivas.filter(n => calcularEstadoNota(n).estadoGeneral === 'por_cobrar');
  const totalPorCobrar = notasActivas.reduce((sum, n) => { const s = n.total - (n.abonos?.reduce((x,a) => x+a.monto,0)??0); return sum+(s>0?s:0); }, 0);
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const finSemana = new Date(hoy); finSemana.setDate(hoy.getDate()+7);
  const entregasHoy = notasActivas.filter(n => n.trabajos.some(t => { if(t.entregado) return false; const f=new Date(parseInt(t.fechaEntrega.anio),parseInt(t.fechaEntrega.mes)-1,parseInt(t.fechaEntrega.dia)); return f.getTime()===hoy.getTime(); })).length;
  const entregasSemana = notasActivas.filter(n => n.trabajos.some(t => { if(t.entregado) return false; const f=new Date(parseInt(t.fechaEntrega.anio),parseInt(t.fechaEntrega.mes)-1,parseInt(t.fechaEntrega.dia)); return f>=hoy&&f<=finSemana; })).length;
  const cobradoHoy = notas.reduce((sum,n) => sum+(n.abonos?.filter(a => { 
    if (!a.fecha || typeof a.fecha !== 'object' || !('seconds' in a.fecha)) return false;
    const f=new Date(a.fecha.seconds*1000); 
    f.setHours(0,0,0,0); 
    return f.getTime()===hoy.getTime(); 
  }).reduce((s,a)=>s+a.monto,0)??0), 0);
  const clientesUnicos = new Set(notas.map(n => n.clienteNombre.toLowerCase().trim())).size;
  const fechaHoy = hoy.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'});

  // Vista Vero — solo sus notas asignadas
  const misNotas = notasActivas.filter(n => n.asignadaA === usuarioData.email);
  const misUrgentes = misNotas.filter(n => { const e = calcularEstadoNota(n); return e.estadoGeneral === 'urgente' || tieneEntregasVencidas(n); });
  const misEntregasHoy = misNotas.filter(n => n.trabajos.some(t => { if(t.entregado) return false; const f=new Date(parseInt(t.fechaEntrega.anio),parseInt(t.fechaEntrega.mes)-1,parseInt(t.fechaEntrega.dia)); return f.getTime()===hoy.getTime(); })).length;

  const modulos = [
    { icon: '📋', label: 'Notas',      ruta: '/dashboard/notas',                     color: 'text-purple-600', badge: urgentes.length > 0 ? urgentes.length : null, badgeColor: 'bg-red-500' },
    { icon: '👥', label: 'Clientes',   ruta: '/dashboard/clientes',                  color: 'text-blue-600',   badge: null },
    { icon: '📅', label: 'Calendario', ruta: '/dashboard/calendario',                color: 'text-indigo-600', badge: entregasHoy > 0 ? entregasHoy : null, badgeColor: 'bg-blue-500' },
    { icon: '📊', label: 'Reportes',   ruta: esAdmin ? '/dashboard/reportes' : null, color: esAdmin ? 'text-green-600' : 'text-gray-300', badge: null, bloqueado: !esAdmin },
    { icon: '🖨️', label: 'Imprimir',  ruta: '/dashboard/impresion',                 color: 'text-pink-600',   badge: null },
    { icon: '🎁', label: 'Productos',  ruta: '/dashboard/productos',                color: 'text-green-600',   badge: null },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white shadow-sm border-b flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🎀</div>
            <div>
              <h1 className="text-lg font-bold text-gray-800 leading-tight">Nenas Gift Shop</h1>
              <p className="text-xs text-gray-500 capitalize">{fechaHoy}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold text-gray-800">{usuarioData.nombre}</p>
              <p className="text-xs text-gray-500 capitalize">{usuarioData.rol}</p>
            </div>
            <button onClick={signOut} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600">Salir</button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-7xl mx-auto px-4 py-4">

          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-800">¡Bienvenida, {usuarioData.nombre}! 👋</h2>
            <p className="text-gray-500 text-xs mt-0.5">{esAdmin ? 'Resumen del negocio' : 'Tus tareas de hoy'}</p>
          </div>

          {loadingNotas ? (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-2xl p-4 border-2 border-gray-100 animate-pulse h-24"></div>)}
            </div>
          ) : esAdmin ? (
            <>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button onClick={() => router.push('/dashboard/notas')} className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 text-left hover:shadow-md active:scale-95 transition-all">
                  <div className="text-2xl mb-1">🔥</div>
                  <div className="text-2xl font-extrabold text-orange-600">{urgentes.length}</div>
                  <div className="text-xs font-semibold text-orange-700">Urgentes</div>
                  <div className="text-xs text-orange-400">Requieren atención</div>
                </button>
                <button onClick={() => router.push('/dashboard/notas')} className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-left hover:shadow-md active:scale-95 transition-all">
                  <div className="text-2xl mb-1">💸</div>
                  <div className="text-xl font-extrabold text-red-600">${totalPorCobrar.toLocaleString()}</div>
                  <div className="text-xs font-semibold text-red-700">Por Cobrar</div>
                  <div className="text-xs text-red-400">{porCobrar.length} nota(s)</div>
                </button>
                <button onClick={() => router.push('/dashboard/calendario')} className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 text-left hover:shadow-md active:scale-95 transition-all">
                  <div className="text-2xl mb-1">📦</div>
                  <div className="text-2xl font-extrabold text-blue-600">{entregasHoy}</div>
                  <div className="text-xs font-semibold text-blue-700">Entregas Hoy</div>
                  <div className="text-xs text-blue-400">{entregasSemana} esta semana</div>
                </button>
                <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4">
                  <div className="text-2xl mb-1">✅</div>
                  <div className="text-2xl font-extrabold text-green-600">${cobradoHoy.toLocaleString()}</div>
                  <div className="text-xs font-semibold text-green-700">Cobrado Hoy</div>
                  <div className="text-xs text-green-400">Abonos del día</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-white border-2 border-gray-100 rounded-xl p-3 text-center">
                  <div className="text-lg font-extrabold text-gray-800">{notasActivas.length}</div>
                  <div className="text-xs text-gray-500">Activas</div>
                </div>
                <div className="bg-white border-2 border-gray-100 rounded-xl p-3 text-center">
                  <div className="text-lg font-extrabold text-purple-600">{enProceso.length}</div>
                  <div className="text-xs text-gray-500">En Proceso</div>
                </div>
                <div className="bg-white border-2 border-gray-100 rounded-xl p-3 text-center">
                  <div className="text-lg font-extrabold text-blue-600">{clientesUnicos}</div>
                  <div className="text-xs text-gray-500">Clientes</div>
                </div>
              </div>
              {urgentes.length > 0 && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 mb-4">
                  <h3 className="font-bold text-orange-700 mb-2 text-sm">🔥 Requieren atención ahora</h3>
                  <div className="space-y-2">
                    {urgentes.slice(0,3).map(n => {
                      const saldo = n.total-(n.abonos?.reduce((s,a)=>s+a.monto,0)??0);
                      return (
                        <button key={n.id} onClick={() => router.push(`/dashboard/notas/${n.id}`)} className="w-full bg-white rounded-xl px-3 py-2 flex items-center justify-between hover:shadow-sm border border-orange-100">
                          <div className="text-left"><span className="text-xs font-bold text-pink-600">{n.folio}</span><p className="font-bold text-gray-800 text-sm">{n.clienteNombre}</p></div>
                          <div className="text-right">{saldo>0&&<p className="text-sm font-bold text-red-600">${saldo.toLocaleString()}</p>}<p className="text-xs text-gray-400">Ver →</p></div>
                        </button>
                      );
                    })}
                    {urgentes.length>3&&<button onClick={()=>router.push('/dashboard/notas')} className="w-full text-center text-xs text-orange-600 font-semibold py-1">Ver {urgentes.length-3} más →</button>}
                  </div>
                </div>
              )}
            </>
          ) : (
            // ===== VISTA VERO =====
            <>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button onClick={() => router.push('/dashboard/notas')} className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 text-left hover:shadow-md active:scale-95 transition-all">
                  <div className="text-2xl mb-1">🔥</div>
                  <div className="text-2xl font-extrabold text-orange-600">{misUrgentes.length}</div>
                  <div className="text-xs font-semibold text-orange-700">Mis Urgentes</div>
                  <div className="text-xs text-orange-400">Requieren atención</div>
                </button>
                <button onClick={() => router.push('/dashboard/calendario')} className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 text-left hover:shadow-md active:scale-95 transition-all">
                  <div className="text-2xl mb-1">📦</div>
                  <div className="text-2xl font-extrabold text-blue-600">{misEntregasHoy}</div>
                  <div className="text-xs font-semibold text-blue-700">Mis Entregas Hoy</div>
                  <div className="text-xs text-blue-400">Ver calendario</div>
                </button>
                <button onClick={() => router.push('/dashboard/notas')} className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 text-left hover:shadow-md active:scale-95 transition-all">
                  <div className="text-2xl mb-1">📋</div>
                  <div className="text-2xl font-extrabold text-purple-600">{misNotas.length}</div>
                  <div className="text-xs font-semibold text-purple-700">Mis Notas</div>
                  <div className="text-xs text-purple-400">Asignadas a mí</div>
                </button>
                <button onClick={() => router.push('/dashboard/notas')} className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 text-left hover:shadow-md active:scale-95 transition-all">
                  <div className="text-2xl mb-1">➕</div>
                  <div className="text-xl font-extrabold text-green-600">Nueva</div>
                  <div className="text-xs font-semibold text-green-700">Nota de Venta</div>
                  <div className="text-xs text-green-400">Capturar pedido</div>
                </button>
              </div>
              {misUrgentes.length > 0 && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 mb-4">
                  <h3 className="font-bold text-orange-700 mb-2 text-sm">🔥 Mis entregas urgentes</h3>
                  <div className="space-y-2">
                    {misUrgentes.slice(0,3).map(n => (
                      <button key={n.id} onClick={() => router.push(`/dashboard/notas/${n.id}`)} className="w-full bg-white rounded-xl px-3 py-2 flex items-center justify-between hover:shadow-sm border border-orange-100">
                        <div className="text-left"><span className="text-xs font-bold text-pink-600">{n.folio}</span><p className="font-bold text-gray-800 text-sm">{n.clienteNombre}</p></div>
                        <p className="text-xs text-gray-400">Ver →</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {misUrgentes.length === 0 && misEntregasHoy === 0 && (
                <div className="bg-green-50 border-2 border-green-100 rounded-2xl p-6 text-center mb-4">
                  <div className="text-4xl mb-2">🎉</div>
                  <p className="font-bold text-green-700">¡Todo al corriente!</p>
                  <p className="text-xs text-green-500 mt-1">No tienes entregas urgentes hoy</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-100 shadow-lg z-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-6">
            {modulos.map((m, idx) => (
              <button
                key={idx}
                onClick={() => m.ruta && router.push(m.ruta)}
                disabled={!m.ruta}
                className={`relative flex flex-col items-center justify-center py-2 px-1 transition-all active:scale-90 ${m.ruta ? 'hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
              >
                {m.badge && (
                  <span className={`absolute top-1 right-2 ${m.badgeColor} text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none`}>
                    {m.badge > 9 ? '9+' : m.badge}
                  </span>
                )}
                <span className={`text-2xl mb-0.5 ${(m as any).bloqueado ? 'opacity-20' : ''}`}>{m.icon}</span>
                <span className={`text-xs font-semibold ${m.ruta ? m.color : 'text-gray-400'}`}>{m.label}</span>
                {(m as any).proximamente && <span className="text-gray-300" style={{fontSize:'8px'}}>pronto</span>}
                {(m as any).bloqueado && <span className="text-gray-300" style={{fontSize:'8px'}}>🔒</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
