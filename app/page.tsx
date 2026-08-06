'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      // Si está autenticado, va a dashboard
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Si está cargando, mostrar spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800">
        <div className="text-center">
          <div className="mb-4">
            <div className="w-12 h-12 rounded-full border-4 border-white border-t-transparent animate-spin mx-auto"></div>
          </div>
          <p className="text-white font-semibold">Cargando...</p>
        </div>
      </div>
    );
  }

  // Si no está autenticado, mostrar la página de login que ya existe
  // (No intenta redirigir, simplemente muestra el login en la raíz)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-2">Nenas Gift Shop</h1>
        <p className="text-gray-600 text-center mb-6">Admin Panel</p>
        
        {/* Aquí va el contenido de login existente */}
        {/* Por ahora solo un mensaje indicando que necesita autenticarse */}
        <p className="text-center text-gray-600 text-sm mb-4">
          Por favor, inicia sesión para continuar.
        </p>
        
        {/* Link a la página de login existente si existe */}
        <a 
          href="/auth/login"
          className="block w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded text-center hover:bg-blue-700 transition-colors"
        >
          Ir a Login
        </a>
      </div>
    </div>
  );
}
