'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { user, usuarioData, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-bounce">🎀</div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user || !usuarioData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🎀</div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Nenas Gift Shop</h1>
              <p className="text-sm text-gray-500">Sistema de Administración</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold text-gray-800">{usuarioData.nombre}</p>
              <p className="text-xs text-gray-500 capitalize">{usuarioData.rol}</p>
            </div>
            <button
              onClick={signOut}
              className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
          <div className="text-6xl mb-4">✨</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            ¡Bienvenida, {usuarioData.nombre}!
          </h2>
          <p className="text-gray-600 mb-8">
            Sistema optimizado listo para comenzar
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl p-6 border-2 border-pink-100">
              <div className="text-3xl mb-2">📋</div>
              <p className="font-bold text-gray-800">Notas</p>
              <p className="text-sm text-gray-600 mt-1">Próximamente</p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-100">
              <div className="text-3xl mb-2">👥</div>
              <p className="font-bold text-gray-800">Clientes</p>
              <p className="text-sm text-gray-600 mt-1">Próximamente</p>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-100">
              <div className="text-3xl mb-2">📊</div>
              <p className="font-bold text-gray-800">Reportes</p>
              <p className="text-sm text-gray-600 mt-1">Próximamente</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
