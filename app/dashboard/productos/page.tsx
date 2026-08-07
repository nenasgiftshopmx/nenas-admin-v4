'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useRouter } from 'next/navigation';
import {
  getProductos,
  createProducto,
  updateProducto,
  deleteProducto,
  buscarProductos,
  getProductosPorCategoria,
  contar,
  getCategorias,
  addCategoria,
  updateCategoria,
  deleteCategoria,
} from '@/lib/firestore';
import { Producto } from '@/types';

const CATEGORIAS_PREDEFINIDAS = [
  'Decoración',
  'Regalos Personalizados',
  'Accesorios',
  'Ropa',
  'Artículos para Fiesta',
  'Otros',
];

export default function ProductosPage() {
  const { user, usuarioData, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const esAdmin = usuarioData?.rol === 'admin';

  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('');
  const [vista, setVista] = useState<'lista' | 'formulario'>('lista');
  const [editando, setEditando] = useState<Producto | null>(null);
  const [productosCount, setProductosCount] = useState(0);

  // MODAL DE CATEGORÍAS
  const [modalCategorias, setModalCategorias] = useState(false);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [editandoCategoria, setEditandoCategoria] = useState<any>(null);
  const [categoriasGuardando, setCategoriasGuardando] = useState(false);

  // Estado de errores de validación
  const [errores, setErrores] = useState<{
    nombre?: string;
    categoria?: string;
    precioBase?: string;
  }>({});

  // Estado del modal de confirmación
  const [modalConfirm, setModalConfirm] = useState<{
    titulo: string;
    mensaje: string;
    onConfirm: () => void;
  } | null>(null);

  // Estado del formulario
  const [formData, setFormData] = useState({
    nombre: '',
    categoria: '',
    precioBase: '',
    precioDocena: '',
    precioMayoreo: '',
    cantidadMayoreo: '',
    descripcion: '',
    tiempoPreparacion: '',
    stock: '',
    activo: true,
  });

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      cargarProductos();
      cargarCategorias();
    }
  }, [user]);

  const cargarProductos = async () => {
    try {
      const data = await getProductos();
      setProductos(data);
      const count = await contar('productos');
      setProductosCount(count);
    } catch (error) {
      console.error(error);
      showToast('Error al cargar productos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const cargarCategorias = async () => {
    try {
      const data = await getCategorias();
      setCategorias(data);
    } catch (error) {
      console.error(error);
      showToast('Error al cargar categorías', 'error');
    }
  };

  const productosFiltrados = productos.filter((p) => {
    const matchBusqueda =
      !busqueda.trim() ||
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.descripcion && p.descripcion.toLowerCase().includes(busqueda.toLowerCase()));

    const matchCategoria = !categoriaFiltro || p.categoria === categoriaFiltro;

    return matchBusqueda && matchCategoria;
  });

  const validarFormulario = (): boolean => {
    const nuevosErrores: any = {};
    if (!formData.nombre.trim()) nuevosErrores.nombre = 'El nombre es requerido';
    if (!formData.categoria.trim()) nuevosErrores.categoria = 'La categoría es requerida';
    if (!formData.precioBase || parseFloat(formData.precioBase) <= 0) nuevosErrores.precioBase = 'El precio debe ser mayor a 0';

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const limpiarFormulario = () => {
    setFormData({
      nombre: '',
      categoria: '',
      precioBase: '',
      precioDocena: '',
      precioMayoreo: '',
      cantidadMayoreo: '',
      descripcion: '',
      tiempoPreparacion: '',
      stock: '',
      activo: true,
    });
    setErrores({});
    setEditando(null);
  };

  const handleGuardar = async () => {
    if (!validarFormulario()) return;

    setGuardando(true);
    try {
      const productoData = {
        nombre: formData.nombre.trim(),
        categoria: formData.categoria.trim(),
        precioBase: parseFloat(formData.precioBase),
        precioDocena: formData.precioDocena ? parseFloat(formData.precioDocena) : undefined,
        precioMayoreo: formData.precioMayoreo ? parseFloat(formData.precioMayoreo) : undefined,
        cantidadMayoreo: formData.cantidadMayoreo ? parseInt(formData.cantidadMayoreo) : undefined,
        descripcion: formData.descripcion.trim() || undefined,
        tiempoPreparacion: formData.tiempoPreparacion.trim() || undefined,
        stock: formData.stock ? parseInt(formData.stock) : undefined,
        activo: formData.activo,
      };

      if (editando) {
        await updateProducto(editando?.id || '',  productoData);
        showToast('Producto actualizado', 'success');
      } else {
        await createProducto(productoData);
        showToast('Producto creado', 'success');
      }

      limpiarFormulario();
      setVista('lista');
      cargarProductos();
    } catch (error) {
      showToast('Error al guardar producto', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = (id: string) => {
    setModalConfirm({
      titulo: 'Eliminar producto',
      mensaje: '¿Estás seguro de que deseas eliminar este producto?',
      onConfirm: async () => {
        try {
          await deleteProducto(id);
          showToast('Producto eliminado', 'success');
          cargarProductos();
        } catch (error) {
          showToast('Error al eliminar producto', 'error');
        }
      },
    });
  };

  // CRUD CATEGORÍAS
  const handleAgregarCategoria = async () => {
    if (!nuevaCategoria.trim()) {
      showToast('Escribe el nombre de la categoría', 'error');
      return;
    }
    setCategoriasGuardando(true);
    try {
      await addCategoria(nuevaCategoria);
      showToast('Categoría agregada', 'success');
      setNuevaCategoria('');
      cargarCategorias();
    } catch (error) {
      showToast('Error al agregar categoría', 'error');
    } finally {
      setCategoriasGuardando(false);
    }
  };

  const handleActualizarCategoria = async () => {
    if (!editandoCategoria.nombre.trim()) {
      showToast('Escribe el nombre', 'error');
      return;
    }
    setCategoriasGuardando(true);
    try {
      await updateCategoria(editandoCategoria.id, editandoCategoria.nombre);
      showToast('Categoría actualizada', 'success');
      setEditandoCategoria(null);
      cargarCategorias();
    } catch (error) {
      showToast('Error al actualizar', 'error');
    } finally {
      setCategoriasGuardando(false);
    }
  };

  const handleEliminarCategoria = async (id: string) => {
    setModalConfirm({
      titulo: 'Eliminar categoría',
      mensaje: '¿Seguro? Los productos seguirán existiendo.',
      onConfirm: async () => {
        try {
          await deleteCategoria(id);
          showToast('Categoría eliminada', 'success');
          cargarCategorias();
        } catch (error) {
          showToast('Error al eliminar', 'error');
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-gray-300 border-t-green-600 animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600">Cargando productos...</p>
        </div>
      </div>
    );
  }

  if (!user || !usuarioData) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-2xl hover:scale-110 transition-transform">←</button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">🎁 Catálogo de Productos</h1>
              <p className="text-sm text-gray-500 mt-1">{productosCount} producto(s) registrado(s)</p>
            </div>
          </div>
          {vista === 'lista' && (
            <>
              {esAdmin && (
                <button
                  onClick={() => setModalCategorias(true)}
                  className="bg-purple-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-600 mr-3"
                >
                  ⚙️ Categorías
                </button>
              )}
              <button
                onClick={() => {
                  limpiarFormulario();
                  setVista('formulario');
                }}
                className="bg-green-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-600"
              >
                ➕ Nuevo Producto
              </button>
            </>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {vista === 'lista' ? (
          <>
            {/* Filtros */}
            <div className="mb-4 space-y-3">
              <input
                type="text"
                placeholder="Buscar por nombre o descripción..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-green-400 focus:outline-none"
              />
              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-green-400 focus:outline-none"
              >
                <option value="">Todas las categorías</option>
                {[...CATEGORIAS_PREDEFINIDAS, ...categorias.map(c => c.nombre)].filter((v, i, a) => a.indexOf(v) === i).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Lista de productos */}
            {productosFiltrados.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border-2 border-gray-100">
                <div className="text-5xl mb-3">📦</div>
                <p className="text-gray-600 font-semibold">No hay productos</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {productosFiltrados.map((prod) => (
                  <div key={prod.id} className="bg-white rounded-lg p-4 border-2 border-gray-100 hover:border-green-300">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-lg">{prod.nombre}</h3>
                        <p className="text-sm text-gray-500">{prod.categoria}</p>
                      </div>
                      <span className="bg-green-100 text-green-800 text-sm font-bold px-3 py-1 rounded">${prod.precioBase}</span>
                    </div>
                    {prod.descripcion && <p className="text-sm text-gray-600 mb-2">{prod.descripcion}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditando(prod);
                          setFormData({
                            nombre: prod.nombre,
                            categoria: prod.categoria,
                            precioBase: prod.precioBase.toString(),
                            precioDocena: prod.precioDocena?.toString() || '',
                            precioMayoreo: prod.precioMayoreo?.toString() || '',
                            cantidadMayoreo: prod.cantidadMayoreo?.toString() || '',
                            descripcion: prod.descripcion || '',
                            tiempoPreparacion: prod.tiempoPreparacion || '',
                            stock: prod.stock?.toString() || '',
                            activo: prod.activo,
                          });
                          setVista('formulario');
                        }}
                        className="flex-1 bg-blue-50 text-blue-600 rounded px-3 py-1 text-sm font-semibold hover:bg-blue-100"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => handleEliminar(prod.id)}
                        className="flex-1 bg-red-50 text-red-600 rounded px-3 py-1 text-sm font-semibold hover:bg-red-100"
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Formulario */}
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 max-w-2xl">
              <h2 className="text-2xl font-bold mb-6">{editando ? 'Editar Producto' : 'Nuevo Producto'}</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Nombre *</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-green-400 focus:outline-none"
                  />
                  {errores.nombre && <p className="text-red-600 text-sm mt-1">{errores.nombre}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Categoría *</label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-green-400 focus:outline-none"
                  >
                    <option value="">Selecciona una categoría</option>
                    {[...CATEGORIAS_PREDEFINIDAS, ...categorias.map(c => c.nombre)].filter((v, i, a) => a.indexOf(v) === i).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  {errores.categoria && <p className="text-red-600 text-sm mt-1">{errores.categoria}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Precio Base *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.precioBase}
                      onChange={(e) => setFormData({ ...formData, precioBase: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-green-400 focus:outline-none"
                    />
                    {errores.precioBase && <p className="text-red-600 text-sm mt-1">{errores.precioBase}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Precio Docena</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.precioDocena}
                      onChange={(e) => setFormData({ ...formData, precioDocena: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-green-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Precio Mayoreo</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.precioMayoreo}
                      onChange={(e) => setFormData({ ...formData, precioMayoreo: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-green-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Cantidad Min. Mayoreo</label>
                    <input
                      type="number"
                      value={formData.cantidadMayoreo}
                      onChange={(e) => setFormData({ ...formData, cantidadMayoreo: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-green-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Descripción</label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-green-400 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Tiempo Preparación</label>
                    <input
                      type="text"
                      placeholder="ej: 3 días"
                      value={formData.tiempoPreparacion}
                      onChange={(e) => setFormData({ ...formData, tiempoPreparacion: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-green-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Stock</label>
                    <input
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-green-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label className="ml-2 font-semibold">Activo</label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleGuardar}
                    disabled={guardando}
                    className="flex-1 bg-green-500 text-white py-2 rounded-lg font-bold hover:bg-green-600 disabled:opacity-50"
                  >
                    {guardando ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => {
                      limpiarFormulario();
                      setVista('lista');
                    }}
                    className="flex-1 bg-gray-300 text-gray-900 py-2 rounded-lg font-bold hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODAL CATEGORÍAS */}
      {modalCategorias && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">⚙️ Gestionar Categorías</h2>

            {/* Agregar nueva */}
            <div className="mb-4 space-y-2">
              <input
                type="text"
                placeholder="Nueva categoría..."
                value={nuevaCategoria}
                onChange={(e) => setNuevaCategoria(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleAgregarCategoria}
                disabled={categoriasGuardando}
                className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 font-semibold disabled:opacity-50"
              >
                ➕ Agregar
              </button>
            </div>

            {/* Lista de categorías */}
            <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
              {categorias.map((cat) => (
                <div key={cat.id} className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                  {editandoCategoria?.id === cat.id ? (
                    <>
                      <input
                        type="text"
                        value={editandoCategoria.nombre}
                        onChange={(e) => setEditandoCategoria({ ...editandoCategoria, nombre: e.target.value })}
                        className="flex-1 px-2 py-1 border rounded text-sm"
                      />
                      <button onClick={handleActualizarCategoria} className="text-green-600 text-sm font-bold">✓</button>
                      <button onClick={() => setEditandoCategoria(null)} className="text-gray-600 text-sm">✕</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-semibold">{cat.nombre}</span>
                      <button onClick={() => setEditandoCategoria(cat)} className="text-blue-600 text-xs">✏️</button>
                      <button onClick={() => handleEliminarCategoria(cat.id)} className="text-red-600 text-xs">🗑️</button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setModalCategorias(false)}
              className="w-full bg-gray-300 text-gray-900 py-2 rounded-lg hover:bg-gray-400 font-semibold"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN */}
      {modalConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-2">{modalConfirm.titulo}</h2>
            <p className="text-gray-600 mb-6">{modalConfirm.mensaje}</p>
            <div className="flex gap-3">
              <button
                onClick={modalConfirm.onConfirm}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg font-bold hover:bg-red-600"
              >
                Eliminar
              </button>
              <button
                onClick={() => setModalConfirm(null)}
                className="flex-1 bg-gray-300 text-gray-900 py-2 rounded-lg font-bold hover:bg-gray-400"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
