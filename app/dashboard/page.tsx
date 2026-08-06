'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getNotas, calcularEstadoNota, tieneEntregasVencidas } from '@/lib/firestore';
import { Nota } from '@/types';

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

  const clientesUnicos = new Set(notas.map(n => n.clienteNombre.toLowerCase().trim())).size;

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

      {/* Métricas principales */}
      {loadingNotas ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Urgentes */}
          <div
            onClick={() => router.push('/dashboard/notas')}
            className="bg-white rounded-lg p-6 border-l-4 border-red-500 cursor-pointer hover:shadow-md transition-shadow"
          >
            <p className="text-gray-600 text-sm font-medium">Urgentes</p>
            <p className="text-3xl font-bold text-red-600 mt-2">{urgentes.length}</p>
            <p className="text-xs text-gray-500 mt-2">Requieren atención</p>
          </div>

          {/* Por cobrar */}
          <div
            onClick={() => router.push('/dashboard/notas')}
            className="bg-white rounded-lg p-6 border-l-4 border-orange-500 cursor-pointer hover:shadow-md transition-shadow"
          >
            <p className="text-gray-600 text-sm font-medium">Por Cobrar</p>
            <p className="text-3xl font-bold text-orange-600 mt-2">
              ${totalPorCobrar.toLocaleString('es-MX')}
            </p>
            <p className="text-xs text-gray-500 mt-2">{porCobrar.length} nota(s)</p>
          </div>

          {/* Entregas hoy */}
          <div
            onClick={() => router.push('/dashboard/calendario')}
            className="bg-white rounded-lg p-6 border-l-4 border-blue-500 cursor-pointer hover:shadow-md transition-shadow"
          >
            <p className="text-gray-600 text-sm font-medium">Entregas Hoy</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{entregasHoy}</p>
            <p className="text-xs text-gray-500 mt-2">Trabajos pendientes</p>
          </div>

          {/* Cobrado hoy */}
          <div className="bg-white rounded-lg p-6 border-l-4 border-green-500">
            <p className="text-gray-600 text-sm font-medium">Cobrado Hoy</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              ${cobradoHoy.toLocaleString('es-MX')}
            </p>
            <p className="text-xs text-gray-500 mt-2">Abonos del día</p>
          </div>
        </div>
      )}

      {/* Info secundaria */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <p className="text-gray-600 text-sm">Notas Activas</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{notasActivas.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <p className="text-gray-600 text-sm">Clientes Únicos</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{clientesUnicos}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <p className="text-gray-600 text-sm">Total Nota</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ${notasActivas.reduce((s, n) => s + n.total, 0).toLocaleString('es-MX')}
          </p>
        </div>
      </div>

      {/* Notas urgentes */}
      {urgentes.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-bold text-red-900 mb-4">🔴 Requieren Atención Ahora</h2>
          <div className="space-y-2">
            {urgentes.slice(0, 5).map(n => {
              const saldo = n.total - (n.abonos?.reduce((s, a) => s + a.monto, 0) ?? 0);
              return (
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
                    {saldo > 0 && (
                      <p className="text-sm font-bold text-red-600">
                        ${saldo.toLocaleString('es-MX')}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Por cobrar */}
      {porCobrar.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
          <h2 className="text-lg font-bold text-orange-900 mb-4">💰 Pendientes de Cobro</h2>
          <div className="space-y-2">
            {porCobrar.slice(0, 5).map(n => {
              const saldo = n.total - (n.abonos?.reduce((s, a) => s + a.monto, 0) ?? 0);
              return (
                <div
                  key={n.id}
                  onClick={() => router.push(`/dashboard/notas/${n.id}`)}
                  className="bg-white p-3 rounded cursor-pointer hover:bg-orange-50 transition-colors border border-orange-100"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-mono text-sm font-bold text-orange-600">{n.folio}</p>
                      <p className="text-sm text-gray-900">{n.clienteNombre}</p>
                    </div>
                    <p className="text-sm font-bold text-orange-600">
                      ${saldo.toLocaleString('es-MX')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sin urgencias */}
      {urgentes.length === 0 && porCobrar.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <p className="text-green-900 font-semibold">✅ ¡Todo al corriente!</p>
          <p className="text-green-700 text-sm mt-1">No tienes notas urgentes ni cobros pendientes</p>
        </div>
      )}
    </div>
  );
}
