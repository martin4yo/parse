'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApiClient } from '@/hooks/useApiClient';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Plus, Search, Edit, Users, BarChart3, Building2, Eye, Ban, Trash2 } from 'lucide-react';

interface Plan {
  id: string;
  codigo: string;
  nombre: string;
  precio: number;
}

interface Tenant {
  id: string;
  nombre: string;
  slug: string;
  cuit: string;
  planId: string | null;
  planes: Plan | null;
  activo: boolean;
  createdAt: string;
  _count: {
    users: number;
  };
}

export default function TenantsPage() {
  const { user } = useAuth();

  // Solo superusers pueden gestionar tenants
  if (!user?.superuser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Acceso Denegado
          </h1>
          <p className="text-gray-600 mb-4">
            Solo los superusuarios pueden gestionar tenants.
          </p>
        </div>
      </div>
    );
  }
  const { get, post, put, delete: del } = useApiClient();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    slug: '',
    cuit: '',
    plan: '',
    activo: true
  });

  const fetchPlanes = async () => {
    try {
      const response = await get('/api/planes');
      if (response.success) {
        setPlanes(response.planes);
      }
    } catch (error) {
      console.error('Error cargando planes:', error);
    }
  };

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { search })
      });

      const response = await get(`/api/tenants?${params}`);

      if (response.success) {
        setTenants(response.data);
        setPagination(response.pagination);
      }
    } catch (error) {
      console.error('Error cargando tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanes();
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [pagination.page, search]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getPlanBadgeColor = (planCodigo: string) => {
    switch (planCodigo) {
      case 'Common': return 'bg-gray-800 text-white';
      case 'Uncommon': return 'bg-gray-400 text-white';
      case 'Rare': return 'bg-yellow-500 text-black';
      case 'Mythic': return 'bg-orange-500 text-white';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  const openModal = (tenant?: Tenant) => {
    if (tenant) {
      setEditingTenant(tenant);
      setFormData({
        nombre: tenant.nombre,
        slug: tenant.slug,
        cuit: tenant.cuit,
        plan: tenant.planId || '',
        activo: tenant.activo
      });
    } else {
      setEditingTenant(null);
      setFormData({
        nombre: '',
        slug: '',
        cuit: '',
        plan: planes.length > 0 ? planes[0].id : '',
        activo: true
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTenant(null);
    setFormData({
      nombre: '',
      slug: '',
      cuit: '',
      plan: 'Common',
      activo: true
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingTenant) {
        // Actualizar tenant existente
        await put(`/api/tenants/${editingTenant.id}`, formData);
        console.log('Tenant actualizado exitosamente');
      } else {
        // Crear nuevo tenant
        await post('/api/tenants', formData);
        console.log('Tenant creado exitosamente');
      }

      closeModal();
      await fetchTenants(); // Recargar la lista
    } catch (error) {
      console.error('Error guardando tenant:', error);
      alert('Error guardando tenant: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (tenant: Tenant) => {
    try {
      await put(`/api/tenants/${tenant.id}`, {
        activo: !tenant.activo
      });
      console.log(`Tenant ${tenant.activo ? 'desactivado' : 'activado'} exitosamente`);
      await fetchTenants(); // Recargar la lista
    } catch (error) {
      console.error('Error cambiando estado del tenant:', error);
      alert('Error cambiando estado del tenant: ' + (error as Error).message);
    }
  };

  const handleDelete = async (tenant: Tenant) => {
    if (confirm(`¿Estás seguro de que deseas eliminar el tenant "${tenant.nombre}"?`)) {
      try {
        await del(`/api/tenants/${tenant.id}`);
        console.log('Tenant eliminado exitosamente');
        await fetchTenants(); // Recargar la lista
      } catch (error) {
        console.error('Error eliminando tenant:', error);
        alert('Error eliminando tenant: ' + (error as Error).message);
      }
    }
  };

  return (
    <ProtectedRoute>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-palette-dark" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                Gestión de Tenants
              </h1>
              <p className="text-text-secondary mt-1">
                Administra las organizaciones del sistema
              </p>
            </div>
          </div>
          <Button onClick={() => openModal()} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Tenant
          </Button>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-secondary">Total Tenants</p>
                  <div className="text-2xl font-bold text-text-primary mt-1">
                    {pagination.total}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-blue-50">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-secondary">Activos</p>
                  <div className="text-2xl font-bold text-text-primary mt-1">
                    {tenants.filter(t => t.activo).length}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-green-50">
                  <BarChart3 className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-secondary">Plan Mythic</p>
                  <div className="text-2xl font-bold text-text-primary mt-1">
                    {tenants.filter(t => t.planes?.codigo === 'Mythic').length}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-purple-50">
                  <BarChart3 className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-secondary">Total Usuarios</p>
                  <div className="text-2xl font-bold text-text-primary mt-1">
                    {tenants.reduce((acc, t) => acc + t._count.users, 0)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-orange-50">
                  <Users className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Búsqueda y filtros */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre, slug, CUIT..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de tenants */}
        <Card>
          <CardHeader>
            <CardTitle>Tenants Registrados</CardTitle>
          </CardHeader>
          <CardContent className="!p-0">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : (
              <>
                <div className="overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-border">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Nombre
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Slug
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                          CUIT
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Plan
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Usuarios
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Creado
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-border">
                      {tenants.map((tenant) => (
                        <tr
                          key={tenant.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-text-primary font-medium">
                              {tenant.nombre}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                              {tenant.slug}
                            </code>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-text-secondary">
                              {tenant.cuit}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {tenant.planes ? (
                              <Badge
                                className="text-white"
                                style={{
                                  backgroundColor: tenant.planes.color || '#9333ea'
                                }}
                              >
                                {tenant.planes.nombre}
                              </Badge>
                            ) : (
                              <span className="text-sm text-gray-400">Sin plan</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-text-secondary">
                                {tenant._count.users}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge
                              variant={tenant.activo ? "default" : "secondary"}
                            >
                              {tenant.activo ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-text-secondary">
                              {formatDate(tenant.createdAt)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => openModal(tenant)}
                                className="p-1 text-green-600 hover:text-green-700 rounded"
                                title="Editar tenant"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggleStatus(tenant)}
                                className={`p-1 rounded ${
                                  tenant.activo
                                    ? 'text-orange-600 hover:text-orange-700'
                                    : 'text-blue-600 hover:text-blue-700'
                                }`}
                                title={tenant.activo ? 'Desactivar tenant' : 'Activar tenant'}
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(tenant)}
                                className="p-1 text-red-600 hover:text-red-900 rounded"
                                title="Eliminar tenant"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                {pagination.pages > 1 && (
                  <div className="flex justify-between items-center mt-4 px-6 pb-4">
                    <p className="text-sm text-gray-600">
                      Mostrando {tenants.length} de {pagination.total} tenants
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page === 1}
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page === pagination.pages}
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Modal de edición/creación */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-text-primary">
                  {editingTenant ? 'Editar Tenant' : 'Nuevo Tenant'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre
                  </label>
                  <Input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                    placeholder="Nombre del tenant"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Slug
                  </label>
                  <Input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    required
                    placeholder="slug-del-tenant"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CUIT
                  </label>
                  <Input
                    type="text"
                    value={formData.cuit}
                    onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                    required
                    placeholder="20-12345678-9"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plan
                  </label>
                  <select
                    value={formData.plan}
                    onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Sin plan</option>
                    {planes.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.nombre} {plan.precio ? `- $${plan.precio}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="activo"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="activo" className="text-sm font-medium text-gray-700">
                    Activo
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeModal}
                    disabled={saving}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving
                      ? 'Guardando...'
                      : editingTenant ? 'Actualizar' : 'Crear'
                    }
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}