'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getNotas, calcularEstadoNota, tieneEntregasVencidas } from '@/lib/firestore';
import { Nota } from '@/types';
import Link from 'next/link';

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
      <div className="flex items-center justify-center min-h-screen">
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

  // Módulos del HUB
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
    <div className="space-y-8 p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          ¡Hola, {usuarioData.nombre}! 👋
        </h1>
        <p className="text-gray-600 mt-1">
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Métricas rápidas (4 cards) */}
      {loadingNotas ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Urgentes */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-5">
            <p className="text-red-700 font-semibold text-2xl">{urgentes.length}</p>
            <p className="text-red-600 text-sm font-medium">Urgentes</p>
          </div>

          {/* Por cobrar */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-5">
            <p className="text-orange-700 font-semibold text-2xl">
              ${totalPorCobrar.toLocaleString('es-MX')}
            </p>
            <p className="text-orange-600 text-sm font-medium">Por Cobrar</p>
          </div>

          {/* Entregas hoy */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
            <p className="text-blue-700 font-semibold text-2xl">{entregasHoy}</p>
            <p className="text-blue-600 text-sm font-medium">Entregas Hoy</p>
          </div>

          {/* Cobrado hoy */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-5">
            <p className="text-green-700 font-semibold text-2xl">
              ${cobradoHoy.toLocaleString('es-MX')}
            </p>
            <p className="text-green-600 text-sm font-medium">Cobrado Hoy</p>
          </div>
        </div>
      )}

      {/* MÓDULOS HUB (6 tarjetas grandes) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modulos.map(modulo => (
          <Link
            key={modulo.titulo}
            href={modulo.href}
            className={`border-2 rounded-xl p-8 cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${modulo.color}`}
          >
            <div className="text-5xl mb-4">{modulo.icono}</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{modulo.titulo}</h2>
            <p className="text-gray-600 text-sm">{modulo.stats}</p>
          </Link>
        ))}
      </div>

      {/* Sección de urgencias (si hay) */}
      {urgentes.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-bold text-red-900 mb-4">🔴 Requieren Atención</h2>
          <div className="space-y-2">
            {urgentes.slice(0, 3).map(n => (
              <div
                key={n.id}
                onClick={() => router.push(`/dashboard/notas/${n.id}`)}
                className="bg-white p-3 rounded cursor-pointer hover:bg-red-50 transition-colors border border-red-100"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-sm font-bold text-red-600">{n.folio}</p>
                    <p className="text-sm text-gray-900">{n.clienteNombre}</p>
                  </div>
                  <p className="text-xs text-red-600 font-semibold">Ver →</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
