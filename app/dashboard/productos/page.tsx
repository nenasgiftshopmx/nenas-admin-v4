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
    if (user) cargarProductos();
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

  const productosFiltrados = productos.filter((p) => {
    const matchBusqueda =
      !busqueda.trim() ||
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.descripcion && p.descripcion.toLowerCase().includes(busqueda.toLowerCase()));

    const matchCategoria = !categoriaFiltro || p.categoria === categoriaFiltro;

    return matchBusqueda && matchCategoria;
  });

  const handleGuardar = async () => {
    if (!formData.nombre.trim()) {
      showToast('El nombre es requerido', 'error');
      return;
    }
    if (!formData.categoria) {
      showToast('Selecciona una categoría', 'error');
      return;
    }
    if (!formData.precioBase || parseFloat(formData.precioBase) <= 0) {
      showToast('El precio base debe ser mayor a 0', 'error');
      return;
    }

    setGuardando(true);
    try {
      const productoData: Omit<Producto, 'id'> = {
        nombre: formData.nombre.trim(),
        categoria: formData.categoria,
        precioBase: parseFloat(formData.precioBase),
        precioDocena: formData.precioDocena ? parseFloat(formData.precioDocena) : undefined,
        precioMayoreo: formData.precioMayoreo ? parseFloat(formData.precioMayoreo) : undefined,
        cantidadMayoreo: formData.cantidadMayoreo ? parseInt(formData.cantidadMayoreo) : undefined,
        descripcion: formData.descripcion.trim() || undefined,
        tiempoPreparacion: formData.tiempoPreparacion ? parseInt(formData.tiempoPreparacion) : undefined,
        stock: formData.stock ? parseInt(formData.stock) : undefined,
        activo: formData.activo,
        vecesVendido: editando?.vecesVendido || 0,
      };

      if (editando?.id) {
        await updateProducto(editando.id, productoData);
        showToast('Producto actualizado correctamente', 'success');
      } else {
        await createProducto(productoData);
        showToast('Producto creado correctamente', 'success');
      }

      await cargarProductos();
      setVista('lista');
      limpiarFormulario();
    } catch (error) {
      console.error(error);
      showToast('Error al guardar producto', 'error');
    } finally {
      setGuardando(false);
    }
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
    setEditando(null);
  };

  const handleEditar = (producto: Producto) => {
    setFormData({
      nombre: producto.nombre,
      categoria: producto.categoria,
      precioBase: producto.precioBase.toString(),
      precioDocena: producto.precioDocena?.toString() || '',
      precioMayoreo: producto.precioMayoreo?.toString() || '',
      cantidadMayoreo: producto.cantidadMayoreo?.toString() || '',
      descripcion: producto.descripcion || '',
      tiempoPreparacion: producto.tiempoPreparacion?.toString() || '',
      stock: producto.stock?.toString() || '',
      activo: producto.activo,
    });
    setEditando(producto);
    setVista('formulario');
  };

  const handleEliminar = (producto: Producto) => {
    if (!esAdmin) {
      showToast('Solo admin puede eliminar productos', 'error');
      return;
    }

    setModalConfirm({
      titulo: 'Eliminar producto',
      mensaje: `¿Eliminar "${producto.nombre}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        setModalConfirm(null);
        try {
          await deleteProducto(producto.id!);
          await cargarProductos();
          showToast(`${producto.nombre} eliminado`, 'success');
        } catch (error) {
          console.error(error);
          showToast('Error al eliminar producto', 'error');
        }
      },
    });
  };

  if (authLoading || loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-bounce">🎀</div>
          <p className="text-gray-600">Cargando productos...</p>
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
            <h1 className="text-2xl font-bold text-gray-800">🎁 Catálogo de Productos</h1>
            <p className="text-sm text-gray-500 mt-1">{productosCount} producto(s) registrado(s)</p>
          </div>
          {vista === 'lista' && (
            <button
              onClick={() => {
                limpiarFormulario();
                setVista('formulario');
              }}
              className="bg-green-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-600"
            >
              ➕ Nuevo Producto
            </button>
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
                {CATEGORIAS_PREDEFINIDAS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Lista de productos */}
            {productosFiltrados.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border-2 border-gray-100">
                <div className="text-5xl mb-3">📦</div>
                <p className="text-gray-600 font-semibold">No hay productos registrados</p>
                <p className="text-gray-500 text-sm mt-1">
                  {busqueda || categoriaFiltro
                    ? 'Intenta con otra búsqueda'
                    : 'Crea tu primer producto ahora'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {productosFiltrados.map((producto) => (
                  <div
                    key={producto.id}
                    className={`rounded-2xl p-4 border-2 transition-all ${
                      producto.activo
                        ? 'bg-white border-gray-100 hover:shadow-md'
                        : 'bg-gray-50 border-gray-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg text-gray-800">{producto.nombre}</h3>
                          {!producto.activo && (
                            <span className="text-xs bg-gray-300 text-gray-700 px-2 py-1 rounded-full">
                              Inactivo
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{producto.categoria}</p>
                      </div>
                    </div>

                    {producto.descripcion && (
                      <p className="text-sm text-gray-600 mb-3">{producto.descripcion}</p>
                    )}

                    {/* Precios */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Precio Base:</span>
                        <span className="font-bold text-green-600">${(producto.precioBase || 0).toLocaleString()}</span>
                      </div>
                      {producto.precioDocena && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Precio x Docena:</span>
                          <span className="font-bold text-blue-600">${(producto.precioDocena || 0).toLocaleString()}</span>
                        </div>
                      )}
                      {producto.precioMayoreo && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            Mayoreo ({producto.cantidadMayoreo}+ pzas):
                          </span>
                          <span className="font-bold text-purple-600">${(producto.precioMayoreo || 0).toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Información adicional */}
                    {(producto.tiempoPreparacion || producto.stock) && (
                      <div className="flex gap-2 text-xs mb-3">
                        {producto.tiempoPreparacion && (
                          <div className="bg-orange-100 text-orange-700 px-2 py-1 rounded">
                            ⏱️ {producto.tiempoPreparacion} días
                          </div>
                        )}
                        {producto.stock !== undefined && (
                          <div
                            className={`px-2 py-1 rounded ${
                              producto.stock > 5
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            📦 {producto.stock} en stock
                          </div>
                        )}
                      </div>
                    )}

                    {/* Botones */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditar(producto)}
                        className="flex-1 bg-blue-100 text-blue-600 px-3 py-2 rounded-lg font-semibold hover:bg-blue-200 text-sm"
                      >
                        ✏️ Editar
                      </button>
                      {esAdmin && (
                        <button
                          onClick={() => handleEliminar(producto)}
                          className="flex-1 bg-red-100 text-red-600 px-3 py-2 rounded-lg font-semibold hover:bg-red-200 text-sm"
                        >
                          🗑️ Eliminar
                        </button>
                      )}
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
                {editando ? '✏️ Editar Producto' : '➕ Nuevo Producto'}
              </h2>

              <div className="space-y-4">
                {/* Nombre */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Nombre del Producto *
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej: Taza Personalizada"
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-green-400 focus:outline-none"
                  />
                </div>

                {/* Categoría */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Categoría *
                  </label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-green-400 focus:outline-none"
                  >
                    <option value="">Selecciona una categoría</option>
                    {CATEGORIAS_PREDEFINIDAS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Descripción
                  </label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    placeholder="Detalles del producto..."
                    rows={2}
                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-green-400 focus:outline-none"
                  />
                </div>

                {/* Precios */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Precio Base *
                    </label>
                    <input
                      type="number"
                      value={formData.precioBase}
                      onChange={(e) => setFormData({ ...formData, precioBase: e.target.value })}
                      placeholder="0.00"
                      step="0.01"
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-green-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Precio Docena
                    </label>
                    <input
                      type="number"
                      value={formData.precioDocena}
                      onChange={(e) => setFormData({ ...formData, precioDocena: e.target.value })}
                      placeholder="Opcional"
                      step="0.01"
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-green-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Precio Mayoreo */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Precio Mayoreo
                    </label>
                    <input
                      type="number"
                      value={formData.precioMayoreo}
                      onChange={(e) => setFormData({ ...formData, precioMayoreo: e.target.value })}
                      placeholder="Opcional"
                      step="0.01"
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-green-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Cantidad Mínima
                    </label>
                    <input
                      type="number"
                      value={formData.cantidadMayoreo}
                      onChange={(e) => setFormData({ ...formData, cantidadMayoreo: e.target.value })}
                      placeholder="Ej: 50"
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-green-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Información Adicional */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Tiempo de Preparación (días)
                    </label>
                    <input
                      type="number"
                      value={formData.tiempoPreparacion}
                      onChange={(e) => setFormData({ ...formData, tiempoPreparacion: e.target.value })}
                      placeholder="Ej: 3"
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-green-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Stock Disponible
                    </label>
                    <input
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      placeholder="Opcional"
                      className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-green-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Estado */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="activo"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="activo" className="text-sm font-semibold text-gray-700">
                    ✅ Producto Activo
                  </label>
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
