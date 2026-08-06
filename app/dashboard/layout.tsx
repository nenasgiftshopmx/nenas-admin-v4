'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { usuarioData } = useAuth();

  const modulos = [
    { icon: '📋', label: 'Notas',      ruta: '/dashboard/notas',      color: 'text-purple-600' },
    { icon: '👥', label: 'Clientes',   ruta: '/dashboard/clientes',   color: 'text-blue-600'   },
    { icon: '📅', label: 'Calendario', ruta: '/dashboard/calendario', color: 'text-indigo-600' },
    { icon: '📊', label: 'Reportes',   ruta: '/dashboard/reportes',   color: 'text-green-600'  },
    { icon: '🖨️', label: 'Imprimir',  ruta: '/dashboard/impresion',  color: 'text-pink-600'   },
    { icon: '🎁', label: 'Productos',  ruta: '/dashboard/productos',  color: 'text-green-600'  },
  ];

  // No mostrar navbar en la página raíz del dashboard (home)
  const esHome = pathname === '/dashboard';
  // No mostrar en vista detallada de nota
  const esDetalle = pathname.startsWith('/dashboard/notas/') && pathname !== '/dashboard/notas';

  if (esHome || esDetalle) {
    return <>{children}</>;
  }

  const activo = modulos.find(m => m.ruta && pathname.startsWith(m.ruta));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Contenido con padding inferior para que no tape la navbar */}
      <div className="flex-1 pb-16">
        {children}
      </div>

      {/* Barra de navegación inferior fija */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-100 shadow-lg z-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-6">
            {modulos.map((m, idx) => {
              const estaActivo = m.ruta && pathname.startsWith(m.ruta);
              return (
                <button
                  key={idx}
                  onClick={() => m.ruta && router.push(m.ruta)}
                  disabled={!m.ruta}
                  className={`relative flex flex-col items-center justify-center py-2 px-1 transition-all active:scale-90 ${
                    m.ruta ? 'hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'
                  } ${estaActivo ? 'border-t-2 border-purple-500 -mt-0.5' : ''}`}
                >
                  <span className={`text-2xl mb-0.5 transition-transform ${estaActivo ? 'scale-110' : ''}`}>
                    {m.icon}
                  </span>
                  <span className={`text-xs font-semibold ${estaActivo ? 'text-purple-600 font-bold' : m.ruta ? m.color : 'text-gray-400'}`}>
                    {m.label}
                  </span>
                  {!m.ruta && <span className="text-gray-300" style={{fontSize:'8px'}}>pronto</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
