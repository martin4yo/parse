'use client';

import { useState, useEffect } from 'react';
import { Users, UserPlus, Edit, Trash2, X, CheckCircle, XCircle, Search, UserX, UserCheck2, Mail, CheckCircle2, Banknote, Tag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { usersApi, authApi, type User, type Profile } from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useConfirmDialog } from '@/hooks/useConfirm';
import { UserAtributosManager } from '@/components/usuarios/UserAtributosManager';

// Esquemas de validación
const userSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional().or(z.literal('')),
  nombre: z.string().min(1, 'El nombre es requerido'),
  apellido: z.string().min(1, 'El apellido es requerido'),
  profileId: z.string().optional(),
  tenantId: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;
type TabType = 'usuarios' | 'atributos';

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [availableTenants, setAvailableTenants] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('usuarios');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Filter users based on search term
  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      user.nombre.toLowerCase().includes(searchLower) ||
      user.apellido.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      `${user.apellido}, ${user.nombre}`.toLowerCase().includes(searchLower)
    );
  });
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  // Formulario para usuarios
  const userForm = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: '',
      password: '',
      nombre: '',
      apellido: '',
      profileId: '',
      recibeNotificacionesEmail: false,
      esUsuarioTesoreria: false,
      tenantId: '',
    }
  });

  // Hook para confirmación de eliminación
  const { confirmDelete } = useConfirmDialog();

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await Promise.all([
          loadUsers(),
          loadProfiles(),
          loadAvailableTenants()
        ]);
      } catch (error) {
        // Individual load functions will handle their own toast errors
      }
    };

    loadInitialData();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await usersApi.getAll();
      setUsers(response.users);
    } catch (error) {
      toast.error('Error al cargar usuarios');
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProfiles = async () => {
    try {
      const response = await authApi.getProfiles();
      setProfiles(response.profiles || []);
    } catch (error) {
      toast.error('Error al cargar perfiles');
      console.error('Error loading profiles:', error);
    }
  };

  const loadAvailableTenants = async () => {
    try {
      const response = await authApi.getAvailableTenants();
      setAvailableTenants(response.tenants || []);
    } catch (error: any) {
      // Solo mostrar error si realmente hay un problema, no si simplemente no es superuser
      if (error.response?.status !== 403) {
        toast.error('Error al cargar tenants disponibles');
      }
      console.error('Error loading available tenants:', error);
      setAvailableTenants([]);
    }
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    userForm.reset({
      email: '',
      password: '',
      nombre: '',
      apellido: '',
      profileId: '',
      tenantId: '',
    });
    setShowUserModal(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setSelectedUser(user);
    userForm.reset({
      email: user.email,
      password: '', // No mostrar contraseña actual
      nombre: user.nombre,
      apellido: user.apellido,
      profileId: user.profileId || '',
      tenantId: user.tenantId || '',
    });
    setShowUserModal(true);
  };

  const onSubmitUser = async (data: UserFormData) => {
    try {
      setLoading(true);
      
      // Preparar los datos, excluyendo password si está vacío en edición
      const submitData = { ...data };
      if (editingUser && !data.password) {
        delete submitData.password;
      }
      
      if (editingUser) {
        // Si se está editando y el tenant cambió, usar el endpoint de assign-tenant
        if (data.tenantId !== editingUser.tenantId) {
          await authApi.assignTenant(editingUser.id, data.tenantId || '');
          toast.success('Empresa del usuario actualizada correctamente');
        } else {
          // Para otros cambios, usar el endpoint normal de update
          await usersApi.update(editingUser.id, submitData);
          toast.success('Usuario actualizado correctamente');
        }
      } else {
        await usersApi.create(submitData as Required<UserFormData>);
        toast.success('Usuario creado correctamente');
      }
      
      setShowUserModal(false);
      userForm.reset();
      await loadUsers();
    } catch (error) {
      toast.error('Error al guardar usuario');
      console.error('Error saving user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    const confirmed = await confirmDelete(`${user.apellido}, ${user.nombre}`);
    if (!confirmed) return;

    try {
      setLoading(true);
      await usersApi.delete(user.id);
      await loadUsers();
      toast.success('Usuario eliminado correctamente');
    } catch (error) {
      toast.error('Error al eliminar usuario');
      console.error('Error deleting user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    try {
      setLoading(true);
      const response = await usersApi.toggleStatus(user.id);
      toast.success(response.message);

      // Actualizar el estado local del usuario
      setUsers(prevUsers => prevUsers.map(u =>
        u.id === user.id ? { ...u, activo: response.user.activo } : u
      ));
    } catch (error) {
      toast.error('Error al cambiar estado del usuario');
      console.error('Error toggling user status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async (user: User) => {
    try {
      setLoading(true);
      await authApi.resendVerification(user.email);
      toast.success(`Email de verificación enviado a ${user.email}`);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Error al enviar email de verificación';
      toast.error(errorMessage);
      console.error('Error resending verification:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailManually = async (user: User) => {
    const confirmed = await confirmDelete(`verificar manualmente el email de ${user.apellido}, ${user.nombre}`);
    if (!confirmed) return;

    try {
      setLoading(true);
      const response = await usersApi.verifyEmail(user.id);
      toast.success(response.message);

      // Actualizar el estado local del usuario
      setUsers(prevUsers => prevUsers.map(u =>
        u.id === user.id ? { ...u, emailVerified: true } : u
      ));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Error al verificar email';
      toast.error(errorMessage);
      console.error('Error verifying email manually:', error);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Users className="w-6 h-6 text-palette-dark" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Gestión de Usuarios
            </h1>
            <p className="text-text-secondary">
              Administra los usuarios del sistema
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-border">
        <div className="px-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('usuarios')}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                ${activeTab === 'usuarios'
                  ? 'border-palette-purple text-palette-purple'
                  : 'border-transparent text-text-secondary hover:text-palette-dark hover:border-palette-purple/30'
                }
              `}
            >
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Usuarios</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('atributos')}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                ${activeTab === 'atributos'
                  ? 'border-palette-purple text-palette-purple'
                  : 'border-transparent text-text-secondary hover:text-palette-dark hover:border-palette-purple/30'
                }
              `}
              disabled={!selectedUser}
            >
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4" />
                <span>Atributos por Usuario</span>
                {selectedUser && (
                  <span className="text-xs bg-palette-purple/10 text-palette-purple px-2 py-0.5 rounded">
                    {selectedUser.nombre} {selectedUser.apellido}
                  </span>
                )}
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="p-6 h-full flex flex-col">
          {activeTab === 'usuarios' ? (
            <div className="bg-white rounded-lg border border-border flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
                <div className="flex items-center space-x-4">
                  <h3 className="text-lg font-semibold text-text-primary">Lista de Usuarios</h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-secondary" />
                    <input
                      type="text"
                      placeholder="Buscar usuarios..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm w-64"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleCreateUser}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Nuevo Usuario</span>
                </Button>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
                {loading && users.length === 0 ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-text-secondary">Cargando usuarios...</div>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-text-secondary">{searchTerm ? 'No se encontraron usuarios que coincidan con la búsqueda' : 'No hay usuarios registrados'}</div>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-border sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                            Nombre
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                            Empresa
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                            Fecha de Creación
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-border">
                        {filteredUsers.map((user) => (
                          <tr
                            key={user.id}
                            className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedUser?.id === user.id ? 'bg-palette-purple/5' : ''}`}
                            onClick={() => {
                              setSelectedUser(user);
                              setActiveTab('atributos');
                            }}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-text-primary">
                                {user.apellido}, {user.nombre}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-text-secondary">
                                {user.email}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col space-y-1">
                                <div className="flex items-center">
                                  {user.activo ? (
                                    <>
                                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                                      <span className="text-sm font-medium text-green-700">Activo</span>
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-4 h-4 text-red-500 mr-2" />
                                      <span className="text-sm font-medium text-red-700">Inactivo</span>
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center">
                                  {user.emailVerified ? (
                                    <>
                                      <CheckCircle className="w-3 h-3 text-blue-500 mr-1" />
                                      <span className="text-xs text-blue-700">Email verificado</span>
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-3 h-3 text-orange-500 mr-1" />
                                      <span className="text-xs text-orange-700">Sin verificar</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-text-secondary">
                                {user.tenant ? user.tenant.nombre : 'Sin empresa'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-text-secondary">
                                {new Date(user.createdAt).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditUser(user);
                                  }}
                                  className="p-1 text-green-600 hover:text-green-700 rounded"
                                  title="Editar usuario"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                {!user.emailVerified && (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleResendVerification(user);
                                      }}
                                      className="p-1 text-blue-600 hover:text-blue-700 rounded"
                                      title="Reenviar email de verificación"
                                    >
                                      <Mail className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleVerifyEmailManually(user);
                                      }}
                                      className="p-1 text-green-600 hover:text-green-700 rounded"
                                      title="Verificar email manualmente"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleUserStatus(user);
                                  }}
                                  className="p-1 text-orange-600 hover:text-orange-700 rounded"
                                  title={user.activo ? 'Desactivar usuario' : 'Activar usuario'}
                                >
                                  {user.activo ? (
                                    <UserX className="w-4 h-4" />
                                  ) : (
                                    <UserCheck2 className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteUser(user);
                                  }}
                                  className="p-1 text-red-600 hover:text-red-900 rounded"
                                  title="Eliminar usuario permanentemente"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                )}
              </div>
            </div>
          ) : (
            // Tab Atributos por Usuario
            <div className="bg-white rounded-lg border border-border flex flex-col h-full">
              <div className="p-6">
                {selectedUser ? (
                  <>
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-text-primary mb-2">
                        Atributos de {selectedUser.nombre} {selectedUser.apellido}
                      </h3>
                      <p className="text-sm text-text-secondary">
                        Email: {selectedUser.email}
                      </p>
                    </div>
                    <UserAtributosManager userId={selectedUser.id} />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <Tag className="w-12 h-12 text-gray-300 mb-4" />
                    <p className="text-text-secondary">
                      Selecciona un usuario en el tab "Usuarios" para gestionar sus atributos
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Usuario */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-text-secondary hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={userForm.handleSubmit(onSubmitUser)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Email
                </label>
                <input
                  {...userForm.register('email')}
                  type="email"
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
                {userForm.formState.errors.email && (
                  <p className="text-red-500 text-sm mt-1">{userForm.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  {editingUser ? 'Nueva Contraseña (opcional)' : 'Contraseña'}
                </label>
                <input
                  {...userForm.register('password')}
                  type="password"
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
                {userForm.formState.errors.password && (
                  <p className="text-red-500 text-sm mt-1">{userForm.formState.errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Nombre
                </label>
                <input
                  {...userForm.register('nombre')}
                  type="text"
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
                {userForm.formState.errors.nombre && (
                  <p className="text-red-500 text-sm mt-1">{userForm.formState.errors.nombre.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Apellido
                </label>
                <input
                  {...userForm.register('apellido')}
                  type="text"
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
                {userForm.formState.errors.apellido && (
                  <p className="text-red-500 text-sm mt-1">{userForm.formState.errors.apellido.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Perfil
                </label>
                <select
                  {...userForm.register('profileId')}
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                >
                  <option value="">Sin perfil</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Empresa
                </label>
                <select
                  {...userForm.register('tenantId')}
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                >
                  <option value="">Sin empresa</option>
                  {availableTenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowUserModal(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Guardando...' : editingUser ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}