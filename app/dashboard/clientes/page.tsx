'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useRouter } from 'next/navigation';
import {
  getClientes,
  createCliente,
  updateCliente,
  deleteCliente,
  buscarClientes,
  contar,
} from '@/lib/firestore';
import { Cliente } from '@/types';

export default function ClientesPage() {
  const { user, usuarioData, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const esAdmin = usuarioData?.rol === 'admin';

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [vista, setVista] = useState<'lista' | 'formulario'>('lista');
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [clientesCount, setClientesCount] = useState(0);

  // Estado del modal de confirmación
  const [modalConfirm, setModalConfirm] = useState<{
    titulo: string;
    mensaje: string;
    onConfirm: () => void;
  } | null>(null);

  // Estado del formulario
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    ocasionesRecurrentes: [] as string[],
    notas: '',
  });

  const [ocasionInput, setOcasionInput] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) cargarClientes();
  }, [user]);

  const cargarClientes = async () => {
    try {
      const data = await getClientes();
      setClientes(data);
      const count = await contar('clientes');
      setClientesCount(count);
    } catch (error) {
      console.error(error);
      showToast('Error al cargar clientes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const clientesFiltrados = busqueda.trim()
    ? clientes.filter(c =>
        c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.telefono.includes(busqueda) ||
        (c.email && c.email.toLowerCase().includes(busqueda.toLowerCase()))
      )
    : clientes;

  const handleGuardar = async () => {
    if (!formData.nombre.trim()) {
      showToast('El nombre es requerido', 'error');
      return;
    }
    if (!formData.telefono.trim()) {
      showToast('El teléfono es requerido', 'error');
      return;
    }

    setGuardando(true);
    try {
      const clienteData: Omit<Cliente, 'id'> = {
        nombre: formData.nombre.trim(),
        telefono: formData.telefono.trim(),
        email: formData.email.trim() || undefined,
        ocasionesRecurrentes: formData.ocasionesRecurrentes,
        notas: formData.notas.trim() || undefined,
        totalVisitas: editando?.totalVisitas || 0,
        totalGastado: editando?.totalGastado || 0,
      };

      // Solo agregar ultimaVisita si existe
      if (editando?.ultimaVisita) {
        (clienteData as any).ultimaVisita = editando.ultimaVisita;
      }

      if (editando?.id) {
        await updateCliente(editando.id, clienteData);
        showToast('Cliente actualizado correctamente', 'success');
      } else {
        await createCliente(clienteData);
        showToast('Cliente creado correctamente', 'success');
      }

      await cargarClientes();
      setVista('lista');
      limpiarFormulario();
    } catch (error) {
      console.error(error);
      showToast('Error al guardar cliente', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const limpiarFormulario = () => {
    setFormData({
      nombre: '',
      telefono: '',
      email: '',
      ocasionesRecurrentes: [],
      notas: '',
    });
    setEditando(null);
    setOcasionInput('');
  };

  const handleEditar = (cliente: Cliente) => {
    setFormData({
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      email: cliente.email || '',
      ocasionesRecurrentes: cliente.ocasionesRecurrentes || [],
      notas: cliente.notas || '',
    });
    setEditando(cliente);
    setVista('formulario');
  };

  const handleEliminar = (cliente: Cliente) => {
    if (!esAdmin) {
      showToast('Solo admin puede eliminar clientes', 'error');
      return;
    }

    setModalConfirm({
      titulo: 'Eliminar cliente',
      mensaje: `¿Eliminar a ${cliente.nombre}? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        setModalConfirm(null);
        try {
          await deleteCliente(cliente.id!);
          await cargarClientes();
          showToast(`${cliente.nombre} eliminado`, 'success');
        } catch (error) {
          console.error(error);
          showToast('Error al eliminar cliente', 'error');
        }
      },
    });
  };

  const agregarOcasion = () => {
    if (!ocasionInput.trim()) return;
    if (!formData.ocasionesRecurrentes.includes(ocasionInput.trim())) {
      setFormData({
        ...formData,
        ocasionesRecurrentes: [...formData.ocasionesRecurrentes, ocasionInput.trim()],
      });
    }
    setOcasionInput('');
  };

  const eliminarOcasion = (ocasion: string) => {
    setFormData({
      ...formData,
      ocasionesRecurrentes: formData.ocasionesRecurrentes.filter(o => o !== ocasion),
    });
  };

  if (authLoading || loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-bounce">🎀</div>
          <p className="text-gray-600">Cargando clientes...</p>
        </div>
      </div>
    );

  if (!user || !usuarioData) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
      <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-2xl hover:scale-110 transition-transform">←</button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">👥 Catálogo de Clientes</h1>
              <p className="text-sm text-gray-500 mt-1">{clientesCount} cliente(s) registrado(s)</p>
            </div>
          </div>
          {vista === 'lista' && (
            <button
              onClick={() => {
                limpiarFormulario();
                setVista('formulario');
              }}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600"
            >
              ➕ Nuevo Cliente
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {vista === 'lista' ? (
          <>
            {/* Búsqueda */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono o email..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-400 focus:outline-none"
              />
            </div>

            {/* Lista de clientes */}
            {clientesFiltrados.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border-2 border-gray-100">
                <div className="text-5xl mb-3">😢</div>
                <p className="text-gray-600 font-semibold">No hay clientes registrados</p>
                <p className="text-gray-500 text-sm mt-1">
                  {busqueda ? 'Intenta con otra búsqueda' : 'Crea tu primer cliente ahora'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {clientesFiltrados.map((cliente) => (
                  <div
                    key={cliente.id}
                    className="bg-white rounded-2xl p-4 border-2 border-gray-100 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-800">{cliente.nombre}</h3>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-gray-600">
                            📞 <span className="font-semibold">{cliente.telefono}</span>
                          </p>
                          {cliente.email && (
                            <p className="text-sm text-gray-600">
                              📧 <span className="font-semibold">{cliente.email}</span>
                            </p>
                          )}
                        </div>
                        <div className="mt-3 flex gap-4 text-sm">
                          <div className="bg-blue-50 px-3 py-1 rounded-lg">
                            <span className="text-blue-600 font-bold">
                              {cliente.totalVisitas || 0}
                            </span>
                            <span className="text-blue-500 text-xs ml-1">visitas</span>
                          </div>
                          <div className="bg-green-50 px-3 py-1 rounded-lg">
                            <span className="text-green-600 font-bold">
                              ${(cliente.totalGastado || 0).toLocaleString()}
                            </span>
                            <span className="text-green-500 text-xs ml-1">gastado</span>
                          </div>
                        </div>
                        {cliente.ocasionesRecurrentes && cliente.ocasionesRecurrentes.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {cliente.ocasionesRecurrentes.map((ocasion, idx) => (
                              <span
                                key={idx}
                                className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full"
                              >
                                {ocasion}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditar(cliente)}
                          className="bg-blue-100 text-blue-600 px-3 py-2 rounded-lg font-semibold hover:bg-blue-200 text-sm"
                        >
                          ✏️ Editar
                        </button>
                        {esAdmin && (
                          <button
                            onClick={() => handleEliminar(cliente)}
                            className="bg-red-100 text-red-600 px-3 py-2 rounded-lg font-semibold hover:bg-red-200 text-sm"
                          >
                            🗑️ Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Formulario */}
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                {editando ? '✏️ Editar Cliente' : '➕ Nuevo Cliente'}
              </h2>

              <div className="space-y-4">
                {/* Nombre */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Nombre completo"
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-400 focus:outline-none"
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Teléfono *
                  </label>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="Ej: 8641234567"
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-400 focus:outline-none"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="correo@ejemplo.com"
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-400 focus:outline-none"
                  />
                </div>

                {/* Ocasiones Recurrentes */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Ocasiones Recurrentes
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={ocasionInput}
                      onChange={(e) => setOcasionInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && agregarOcasion()}
                      placeholder="Ej: Cumpleaños, Aniversario"
                      className="flex-1 px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-400 focus:outline-none"
                    />
                    <button
                      onClick={agregarOcasion}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600"
                    >
                      Agregar
                    </button>
                  </div>
                  {formData.ocasionesRecurrentes.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.ocasionesRecurrentes.map((ocasion) => (
                        <div
                          key={ocasion}
                          className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full flex items-center gap-2 text-sm"
                        >
                          {ocasion}
                          <button
                            onClick={() => eliminarOcasion(ocasion)}
                            className="font-bold hover:text-purple-900"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notas */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Notas Adicionales
                  </label>
                  <textarea
                    value={formData.notas}
                    onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                    placeholder="Información adicional del cliente..."
                    rows={3}
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-400 focus:outline-none"
                  />
                </div>

                {/* Botones */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleGuardar}
                    disabled={guardando}
                    className="flex-1 bg-green-500 text-white px-4 py-3 rounded-lg font-bold hover:bg-green-600 disabled:opacity-50"
                  >
                    {guardando ? '💾 Guardando...' : '✅ Guardar'}
                  </button>
                  <button
                    onClick={() => {
                      setVista('lista');
                      limpiarFormulario();
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-3 rounded-lg font-bold hover:bg-gray-400"
                  >
                    ❌ Cancelar
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal de confirmación */}
      {modalConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-2">{modalConfirm.titulo}</h3>
            <p className="text-gray-600 mb-6">{modalConfirm.mensaje}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setModalConfirm(null)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={modalConfirm.onConfirm}
                className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
