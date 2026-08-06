'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/auth/login');
      }
    }
  }, [user, loading, router]);

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
