'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getNotas, calcularEstadoNota, tieneEntregasVencidas } from '@/lib/firestore';
import { Nota } from '@/types';
import Link from 'next/link';

// Logo Nenas (SVG)
function LogoNenas() {
  return (
    <svg width="60" height="60" viewBox="0 0 100 100" className="rounded-full">
      <circle cx="50" cy="50" r="48" fill="#0F3B66" stroke="white" strokeWidth="2" />
      <g fill="#FF4D7D">
        <path d="M 50 15 Q 45 20 40 18 Q 42 15 40 10 Q 50 5 60 10 Q 58 15 60 18 Q 55 20 50 15" />
      </g>
      <text x="50" y="65" fontSize="48" fontWeight="bold" fill="white" textAnchor="middle" fontFamily="Arial">
        01
      </text>
    </svg>
  );
}

// BUSCADOR INLINE
function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getNotas();
        setNotas(data);
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const q = query.toLowerCase();
    const resultados: any[] = [];

    notas.forEach(n => {
      if (n.folio.toLowerCase().includes(q) || n.clienteNombre.toLowerCase().includes(q)) {
        const saldo = n.total - (n.abonos?.reduce((s, a) => s + a.monto, 0) ?? 0);
        resultados.push({
          id: n.id,
          folio: n.folio,
          cliente: n.clienteNombre,
          monto: saldo,
        });
      }
    });

    setResults(resultados.slice(0, 5));
  }, [query, notas]);

  return (
    <div className="relative w-full mb-4">
      <input
        type="text"
        placeholder="🔍 Buscar notas, clientes..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowResults(true);
        }}
        onFocus={() => setShowResults(true)}
        className="w-full px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                router.push(`/dashboard/notas/${r.id}`);
                setQuery('');
                setShowResults(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0 text-sm"
            >
              <span className="font-bold text-blue-600">{r.folio}</span>
              <span className="ml-2">{r.cliente}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user, usuarioData, loading } = useAuth();
  const router = useRouter();
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loadingNotas, setLoadingNotas] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) cargarNotas();
  }, [user]);

  const cargarNotas = async () => {
    try {
      const data = await getNotas();
      setNotas(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingNotas(false);
    }
  };

  if (loading || !user || !usuarioData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-gray-300 border-t-blue-600 animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  const notasActivas = notas.filter(n => !n.archivada);
  const urgentes = notasActivas.filter(n => {
    const e = calcularEstadoNota(n);
    return e.estadoGeneral === 'urgente' || tieneEntregasVencidas(n);
  });
  const porCobrar = notasActivas.filter(n => {
    const saldo = n.total - (n.abonos?.reduce((s, a) => s + a.monto, 0) ?? 0);
    return saldo > 0;
  });

  const totalPorCobrar = porCobrar.reduce((sum, n) => {
    const s = n.total - (n.abonos?.reduce((x, a) => x + a.monto, 0) ?? 0);
    return sum + (s > 0 ? s : 0);
  }, 0);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const entregasHoy = notasActivas.filter(n =>
    n.trabajos.some(t => {
      if (t.entregado) return false;
      const f = new Date(
        parseInt(t.fechaEntrega.anio),
        parseInt(t.fechaEntrega.mes) - 1,
        parseInt(t.fechaEntrega.dia)
      );
      return f.getTime() === hoy.getTime();
    })
  ).length;

  const cobradoHoy = notas.reduce((sum, n) =>
    sum +
    (n.abonos
      ?.filter(a => {
        try {
          const f =
            a.fecha && typeof a.fecha === 'object' && 'seconds' in a.fecha
              ? new Date(a.fecha.seconds * 1000)
              : hoy;
          const fCopia = new Date(f);
          fCopia.setHours(0, 0, 0, 0);
          return fCopia.getTime() === hoy.getTime();
        } catch {
          return true;
        }
      })
      .reduce((s, a) => s + a.monto, 0) ?? 0),
    0
  );

  const modulos = [
    {
      titulo: 'Notas',
      icono: '📋',
      color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
      href: '/dashboard/notas',
      stats: `${notasActivas.length} activas`,
    },
    {
      titulo: 'Clientes',
      icono: '👥',
      color: 'bg-green-50 border-green-200 hover:bg-green-100',
      href: '/dashboard/clientes',
      stats: `${new Set(notas.map(n => n.clienteNombre.toLowerCase().trim())).size} únicos`,
    },
    {
      titulo: 'Productos',
      icono: '🎁',
      color: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
      href: '/dashboard/productos',
      stats: 'Catálogo',
    },
    {
      titulo: 'Calendario',
      icono: '📅',
      color: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
      href: '/dashboard/calendario',
      stats: `${entregasHoy} hoy`,
    },
    {
      titulo: 'Reportes',
      icono: '📊',
      color: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
      href: '/dashboard/reportes',
      stats: 'Análisis',
    },
    {
      titulo: 'Impresión',
      icono: '🖨️',
      color: 'bg-red-50 border-red-200 hover:bg-red-100',
      href: '/dashboard/impresion',
      stats: 'Notas',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 py-4 px-4 flex items-start justify-center">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="space-y-4 p-5 bg-gray-50 pb-32">
          {/* Header */}
          <div className="flex items-center gap-4">
            <LogoNenas />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Hola, {usuarioData.nombre}! 👋
              </h1>
              <p className="text-xs text-gray-600 mt-1">
                {new Date().toLocaleDateString('es-MX', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>

          {/* BUSCADOR AQUÍ */}
          <SearchBar />

          {/* Métricas */}
          {loadingNotas ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-20 bg-gray-200 rounded-lg animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 font-bold text-xl">{urgentes.length}</p>
                <p className="text-red-600 text-xs font-medium">Urgentes</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-orange-700 font-bold text-lg">
                  ${(totalPorCobrar / 1000).toFixed(0)}K
                </p>
                <p className="text-orange-600 text-xs font-medium">Cobrar</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-blue-700 font-bold text-xl">{entregasHoy}</p>
                <p className="text-blue-600 text-xs font-medium">Entregas</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-700 font-bold text-lg">
                  ${(cobradoHoy / 1000).toFixed(0)}K
                </p>
                <p className="text-green-600 text-xs font-medium">Cobrado</p>
              </div>
            </div>
          )}

          {/* Módulos */}
          <div className="grid grid-cols-2 gap-3">
            {modulos.map(modulo => (
              <Link
                key={modulo.titulo}
                href={modulo.href}
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${modulo.color}`}
              >
                <div className="text-3xl mb-1">{modulo.icono}</div>
                <h3 className="text-sm font-bold text-gray-900">{modulo.titulo}</h3>
                <p className="text-xs text-gray-600 mt-0.5">{modulo.stats}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
