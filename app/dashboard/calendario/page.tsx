'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getNotas } from '@/lib/firestore';
import { Nota } from '@/types';

type VistaCalendario = 'semana' | 'mes';
type FiltroPersona = 'todos' | string;

interface TrabajoCalendario {
  nota: Nota;
  trabajoId: string;
  producto: string;
  cantidad: number;
  fechaEntrega: Date;
  entregado: boolean;
  asignadaNombre: string;
  asignadaA: string;
}

const COLORES_PERSONA: Record<string, string> = {
  'cinthia': 'bg-purple-100 border-purple-300 text-purple-800',
  'tere': 'bg-pink-100 border-pink-300 text-pink-800',
  'default': 'bg-blue-100 border-blue-300 text-blue-800',
};

const getColorPersona = (nombre: string) => {
  const key = nombre.toLowerCase();
  if (key.includes('cinthia')) return COLORES_PERSONA['cinthia'];
  if (key.includes('tere')) return COLORES_PERSONA['tere'];
  return COLORES_PERSONA['default'];
};

const getBadgePersona = (nombre: string) => {
  const key = nombre.toLowerCase();
  if (key.includes('cinthia')) return 'bg-purple-500 text-white';
  if (key.includes('tere')) return 'bg-pink-500 text-white';
  return 'bg-blue-500 text-white';
};

export default function CalendarioPage() {
  const { user, usuarioData, loading: authLoading } = useAuth();
  const router = useRouter();

  const [trabajos, setTrabajos] = useState<TrabajoCalendario[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<VistaCalendario>('semana');
  const [filtroPersona, setFiltroPersona] = useState<FiltroPersona>('todos');
  const [fechaBase, setFechaBase] = useState(new Date());
  const [personas, setPersonas] = useState<{ email: string; nombre: string }[]>([]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) cargarDatos();
  }, [user]);

  const cargarDatos = async () => {
    try {
      const notas = await getNotas();
      const trabajosFlat: TrabajoCalendario[] = [];
      const personasMap: Record<string, { email: string; nombre: string }> = {};

      notas.filter(n => !n.archivada).forEach(nota => {
        if (nota.asignadaA && nota.asignadaNombre) {
          personasMap[nota.asignadaA] = { email: nota.asignadaA, nombre: nota.asignadaNombre };
        }
        nota.trabajos.forEach(t => {
          try {
            const fecha = new Date(
              parseInt(t.fechaEntrega.anio),
              parseInt(t.fechaEntrega.mes) - 1,
              parseInt(t.fechaEntrega.dia)
            );
            if (!isNaN(fecha.getTime())) {
              trabajosFlat.push({
                nota,
                trabajoId: t.id,
                producto: t.producto,
                cantidad: t.cantidad,
                fechaEntrega: fecha,
                entregado: t.entregado,
                asignadaNombre: nota.asignadaNombre || 'Sin asignar',
                asignadaA: nota.asignadaA || '',
              });
            }
          } catch {}
        });
      });

      setTrabajos(trabajosFlat);
      setPersonas(Object.values(personasMap));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Obtener días de la semana actual
  const getDiasSemana = () => {
    const lunes = new Date(fechaBase);
    lunes.setDate(fechaBase.getDate() - ((fechaBase.getDay() + 6) % 7));
    lunes.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes);
      d.setDate(lunes.getDate() + i);
      return d;
    });
  };

  // Obtener días del mes actual
  const getDiasMes = () => {
    const inicio = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), 1);
    const fin = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + 1, 0);
    const dias: Date[] = [];
    // Padding inicio
    const primerDia = (inicio.getDay() + 6) % 7;
    for (let i = 0; i < primerDia; i++) {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() - (primerDia - i));
      dias.push(d);
    }
    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
      dias.push(new Date(d));
    }
    return dias;
  };

  const trabajosFiltrados = trabajos.filter(t => {
    if (filtroPersona === 'todos') return true;
    return t.asignadaA === filtroPersona;
  });

  const getTrabajosDia = (dia: Date) => {
    return trabajosFiltrados.filter(t => {
      const f = new Date(t.fechaEntrega);
      f.setHours(0, 0, 0, 0);
      return f.getTime() === dia.getTime();
    });
  };

  const navegar = (dir: number) => {
    const nueva = new Date(fechaBase);
    if (vista === 'semana') nueva.setDate(fechaBase.getDate() + dir * 7);
    else nueva.setMonth(fechaBase.getMonth() + dir);
    setFechaBase(nueva);
  };

  const irAHoy = () => setFechaBase(new Date());

  const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const formatTitulo = () => {
    if (vista === 'semana') {
      const dias = getDiasSemana();
      return `${dias[0].getDate()} - ${dias[6].getDate()} ${dias[6].toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}`;
    }
    return fechaBase.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-bounce">🎀</div>
          <p className="text-gray-600">Cargando calendario...</p>
        </div>
      </div>
    );
  }

  const diasVista = vista === 'semana' ? getDiasSemana() : getDiasMes();
  const pendientesTotal = trabajosFiltrados.filter(t => !t.entregado).length;
  const vencidosTotal = trabajosFiltrados.filter(t => !t.entregado && t.fechaEntrega < hoy).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-2xl hover:scale-110 transition-transform">←</button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Calendario</h1>
              <p className="text-sm text-gray-500">{pendientesTotal} entregas pendientes{vencidosTotal > 0 ? ` · ${vencidosTotal} vencidas` : ''}</p>
            </div>
          </div>
          {/* Botón imprimir */}
          <button
            onClick={() => window.print()}
            className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-200 flex items-center gap-1"
          >
            🖨️ Imprimir
          </button>
        </div>
      </div>

      {/* Controles */}
      <div className="bg-white border-b px-4 py-3 space-y-3">
        {/* Filtro por persona */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFiltroPersona('todos')}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap ${filtroPersona === 'todos' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            👥 Todas
          </button>
          {personas.map(p => (
            <button
              key={p.email}
              onClick={() => setFiltroPersona(p.email)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap ${
                filtroPersona === p.email
                  ? getBadgePersona(p.nombre) + ' shadow-md'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {p.nombre.includes('inthia') ? '💜' : p.nombre.includes('ere') ? '🩷' : '👤'} {p.nombre}
            </button>
          ))}
        </div>

        {/* Vista semana/mes + navegación */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <button
              onClick={() => setVista('semana')}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold ${vista === 'semana' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              Semana
            </button>
            <button
              onClick={() => setVista('mes')}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold ${vista === 'mes' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              Mes
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => navegar(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 font-bold">‹</button>
            <button onClick={irAHoy} className="px-3 py-1 rounded-lg bg-purple-100 text-purple-700 text-sm font-bold hover:bg-purple-200">Hoy</button>
            <button onClick={() => navegar(1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 font-bold">›</button>
          </div>
        </div>

        <p className="text-sm font-bold text-gray-700 capitalize">{formatTitulo()}</p>
      </div>

      <div className="max-w-7xl mx-auto px-2 py-4">
        {/* Vista Semana */}
        {vista === 'semana' && (
          <div className="space-y-3">
            {getDiasSemana().map((dia, idx) => {
              const trabajosDia = getTrabajosDia(dia);
              const esHoy = dia.getTime() === hoy.getTime();
              const esPasado = dia < hoy;
              return (
                <div key={idx} className={`bg-white rounded-xl border-2 overflow-hidden ${esHoy ? 'border-purple-400' : 'border-gray-100'}`}>
                  <div className={`px-4 py-2 flex items-center justify-between ${esHoy ? 'bg-purple-600 text-white' : esPasado ? 'bg-gray-50' : 'bg-white'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${esHoy ? 'text-white' : 'text-gray-700'}`}>{diasSemana[idx]}</span>
                      <span className={`text-lg font-extrabold ${esHoy ? 'text-white' : 'text-gray-800'}`}>{dia.getDate()}</span>
                      <span className={`text-sm capitalize ${esHoy ? 'text-purple-200' : 'text-gray-400'}`}>
                        {dia.toLocaleDateString('es-MX', { month: 'short' })}
                      </span>
                      {esHoy && <span className="text-xs bg-white text-purple-600 px-2 py-0.5 rounded-full font-bold">Hoy</span>}
                    </div>
                    {trabajosDia.length > 0 && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${esHoy ? 'bg-white text-purple-600' : 'bg-purple-100 text-purple-700'}`}>
                        {trabajosDia.length}
                      </span>
                    )}
                  </div>

                  {trabajosDia.length === 0 ? (
                    <div className="px-4 py-3 text-gray-300 text-sm">Sin entregas</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {trabajosDia.map((t, i) => (
                        <button
                          key={i}
                          onClick={() => router.push(`/dashboard/notas/${t.nota.id}`)}
                          className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 ${t.entregado ? 'opacity-50' : ''}`}
                        >
                          <div className="text-left flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getBadgePersona(t.asignadaNombre)}`}>
                                {t.asignadaNombre.split(' ')[0]}
                              </span>
                              {t.entregado && <span className="text-xs text-green-600 font-bold">✓ Entregado</span>}
                              {!t.entregado && t.fechaEntrega < hoy && <span className="text-xs text-red-600 font-bold">🔴 Vencido</span>}
                            </div>
                            <p className="text-sm font-bold text-gray-800">{t.producto}</p>
                            <p className="text-xs text-gray-500">{t.nota.folio} · {t.nota.clienteNombre} · ×{t.cantidad}</p>
                          </div>
                          <span className="text-gray-300 text-sm">→</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Vista Mes */}
        {vista === 'mes' && (
          <div>
            {/* Headers días */}
            <div className="grid grid-cols-7 mb-1">
              {diasSemana.map(d => (
                <div key={d} className="text-center text-xs font-bold text-gray-400 py-1">{d}</div>
              ))}
            </div>
            {/* Grid días */}
            <div className="grid grid-cols-7 gap-1">
              {getDiasMes().map((dia, idx) => {
                const trabajosDia = getTrabajosDia(dia);
                const esHoy = dia.getTime() === hoy.getTime();
                const esMesActual = dia.getMonth() === fechaBase.getMonth();
                const tieneVencidos = trabajosDia.some(t => !t.entregado && t.fechaEntrega < hoy);
                return (
                  <div
                    key={idx}
                    className={`min-h-[60px] rounded-lg p-1 border ${
                      esHoy ? 'border-purple-400 bg-purple-50' :
                      tieneVencidos ? 'border-red-200 bg-red-50' :
                      trabajosDia.length > 0 ? 'border-blue-100 bg-blue-50' :
                      'border-gray-100 bg-white'
                    } ${!esMesActual ? 'opacity-30' : ''}`}
                  >
                    <div className={`text-xs font-bold mb-1 ${esHoy ? 'text-purple-600' : 'text-gray-500'}`}>
                      {dia.getDate()}
                    </div>
                    {trabajosDia.slice(0, 2).map((t, i) => (
                      <button
                        key={i}
                        onClick={() => router.push(`/dashboard/notas/${t.nota.id}`)}
                        className={`w-full text-left text-xs px-1 py-0.5 rounded mb-0.5 truncate border ${getColorPersona(t.asignadaNombre)} ${t.entregado ? 'opacity-40' : ''}`}
                      >
                        {t.producto}
                      </button>
                    ))}
                    {trabajosDia.length > 2 && (
                      <div className="text-xs text-gray-400 font-bold">+{trabajosDia.length - 2}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Leyenda */}
      <div className="max-w-7xl mx-auto px-4 pb-6">
        <div className="bg-white rounded-xl border-2 border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 mb-2">LEYENDA</p>
          <div className="flex flex-wrap gap-3">
            {personas.map(p => (
              <div key={p.email} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-full ${p.nombre.toLowerCase().includes('inthia') ? 'bg-purple-500' : p.nombre.toLowerCase().includes('ere') ? 'bg-pink-500' : 'bg-blue-500'}`}></div>
                <span className="text-xs text-gray-600">{p.nombre}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400"></div><span className="text-xs text-gray-600">Vencido</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-400"></div><span className="text-xs text-gray-600">Entregado</span></div>
          </div>
        </div>
      </div>

      {/* Estilos de impresión */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          button { display: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
