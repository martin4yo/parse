'use client';

import { useState, useEffect } from 'react';
import { Users, UserPlus, Edit, Trash2, Settings, X, Search, UserX, UserCheck2, Mail, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { usersApi, userAtributosApi, atributosApi, valoresAtributoApi, authApi, type User, type Profile, type UserAtributo, type Atributo, type ValorAtributo } from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useConfirmDialog } from '@/hooks/useConfirm';

// Esquemas de validación
const userSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional().or(z.literal('')),
  nombre: z.string().min(1, 'El nombre es requerido'),
  apellido: z.string().min(1, 'El apellido es requerido'),
  profileId: z.string().optional(),
  tenantId: z.string().optional(),
});

const userAtributoSchema = z.object({
  atributoId: z.string().min(1, 'Debe seleccionar un atributo'),
  valorAtributoId: z.string().min(1, 'Debe seleccionar un valor'),
});

type UserFormData = z.infer<typeof userSchema>;
type UserAtributoFormData = z.infer<typeof userAtributoSchema>;

type TabType = 'usuarios' | 'atributos';

export default function UsuariosPage() {
  const [activeTab, setActiveTab] = useState<TabType>('usuarios');
  const [users, setUsers] = useState<User[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [availableTenants, setAvailableTenants] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
  const [userAtributos, setUserAtributos] = useState<UserAtributo[]>([]);
  const [atributos, setAtributos] = useState<any[]>([]);
  const [valoresAtributo, setValoresAtributo] = useState<ValorAtributo[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showAtributoModal, setShowAtributoModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingUserAtributo, setEditingUserAtributo] = useState<UserAtributo | null>(null);
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
      tenantId: '',
    }
  });

  // Formulario para atributos de usuario
  const atributoForm = useForm<UserAtributoFormData>({
    resolver: zodResolver(userAtributoSchema),
    defaultValues: {
      atributoId: '',
      valorAtributoId: '',
    }
  });

  const selectedAtributoId = atributoForm.watch('atributoId');

  // Hook para confirmación de eliminación
  const { confirmDelete } = useConfirmDialog();

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await Promise.all([
          loadUsers(),
          loadProfiles(),
          loadAtributos(),
          loadAvailableTenants()
        ]);
      } catch (error) {
        // Individual load functions will handle their own toast errors
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      loadUserAtributos(selectedUser.id);
    }
  }, [selectedUser]);

  useEffect(() => {
    if (selectedAtributoId) {
      loadValoresAtributo(selectedAtributoId);
      atributoForm.setValue('valorAtributoId', '');
    }
  }, [selectedAtributoId, atributoForm]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await usersApi.getAll();
      setUsers(response.users);
      if (response.users.length > 0 && !selectedUser) {
        setSelectedUser(response.users[0]);
      }
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

  const loadAtributos = async () => {
    try {
      const response = await atributosApi.getAll();
      setAtributos(response);
    } catch (error) {
      toast.error('Error al cargar atributos');
      console.error('Error loading atributos:', error);
    }
  };

  const loadUserAtributos = async (userId: string) => {
    try {
      const response = await userAtributosApi.getByUserId(userId);
      setUserAtributos(response.userAtributos || []);
    } catch (error) {
      toast.error('Error al cargar atributos del usuario');
      console.error('Error loading user atributos:', error);
    }
  };

  const loadValoresAtributo = async (atributoId: string) => {
    try {
      const response = await valoresAtributoApi.getAll(atributoId);
      setValoresAtributo(response.valoresAtributo || []);
    } catch (error) {
      toast.error('Error al cargar valores del atributo');
      console.error('Error loading valores atributo:', error);
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

  const handleCreateUserAtributo = () => {
    if (!selectedUser) return;

    setEditingUserAtributo(null);
    atributoForm.reset({
      atributoId: '',
      valorAtributoId: '',
    });
    setValoresAtributo([]);
    setShowAtributoModal(true);
  };

  const handleEditUserAtributo = (userAtributo: UserAtributo) => {
    setEditingUserAtributo(userAtributo);
    atributoForm.reset({
      atributoId: userAtributo.valores_atributo?.atributoId || '',
      valorAtributoId: userAtributo.valorAtributoId,
    });
    if (userAtributo.valores_atributo?.atributoId) {
      loadValoresAtributo(userAtributo.valores_atributo.atributoId);
    }
    setShowAtributoModal(true);
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

      // Si estamos editando el usuario seleccionado, actualizar la selección
      if (editingUser && selectedUser && editingUser.id === selectedUser.id) {
        const updatedUser = users.find(u => u.id === editingUser.id);
        if (updatedUser) {
          setSelectedUser(updatedUser);
        }
      }
    } catch (error) {
      toast.error('Error al guardar usuario');
      console.error('Error saving user:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmitUserAtributo = async (data: UserAtributoFormData) => {
    if (!selectedUser) return;

    try {
      setLoading(true);

      if (editingUserAtributo) {
        await userAtributosApi.update(editingUserAtributo.id, {
          valorAtributoId: data.valorAtributoId
        });
        toast.success('Atributo del usuario actualizado correctamente');
      } else {
        await userAtributosApi.create({
          userId: selectedUser.id,
          valorAtributoId: data.valorAtributoId
        });
        toast.success('Atributo asignado al usuario correctamente');
      }

      setShowAtributoModal(false);
      atributoForm.reset();
      await loadUserAtributos(selectedUser.id);
    } catch (error) {
      toast.error('Error al guardar atributo del usuario');
      console.error('Error saving user atributo:', error);
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

      // Si eliminamos el usuario seleccionado, seleccionar otro
      if (selectedUser && user.id === selectedUser.id) {
        const remainingUsers = users.filter(u => u.id !== user.id);
        setSelectedUser(remainingUsers.length > 0 ? remainingUsers[0] : null);
      }
    } catch (error) {
      toast.error('Error al eliminar usuario');
      console.error('Error deleting user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUserAtributo = async (userAtributo: UserAtributo) => {
    const atributoName = userAtributo.valores_atributo?.atributos?.descripcion || 'este atributo';
    const confirmed = await confirmDelete(atributoName);
    if (!confirmed) return;

    try {
      setLoading(true);
      await userAtributosApi.delete(userAtributo.id);
      if (selectedUser) {
        await loadUserAtributos(selectedUser.id);
      }
      toast.success('Atributo removido del usuario correctamente');
    } catch (error) {
      toast.error('Error al eliminar atributo');
      console.error('Error deleting user atributo:', error);
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

      // Si el usuario seleccionado es el que cambió, actualizarlo también
      if (selectedUser && selectedUser.id === user.id) {
        setSelectedUser(prev => prev ? { ...prev, activo: response.user.activo } : null);
      }
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

      // Si el usuario seleccionado es el que cambió, actualizarlo también
      if (selectedUser && selectedUser.id === user.id) {
        setSelectedUser(prev => prev ? { ...prev, emailVerified: true } : null);
      }
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
              Administra los usuarios del sistema y sus atributos asociados
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
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
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
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
                }
              `}
              disabled={!selectedUser}
            >
              <div className="flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span>Atributos de Usuario</span>
              </div>
            </button>
          </nav>
        </div>
      </div>


      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'usuarios' ? (
          <div className="p-6 h-full flex flex-col">
            <div className="bg-white rounded-lg border border-border flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
                <div className="flex items-center space-x-4">
                  <h3 className="text-lg font-semibold text-text-primary">Usuarios</h3>
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
                            onClick={() => setSelectedUser(user)}
                            className={`
                              cursor-pointer transition-colors
                              ${selectedUser?.id === user.id
                                ? 'bg-primary/10'
                                : 'hover:bg-gray-50'
                              }
                            `}
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
                              <div className="flex items-center">
                                {user.activo ? (
                                  <>
                                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                                    <span className="text-sm font-medium text-green-700">Activo</span>
                                  </>
                                ) : (
                                  <>
                                    <div className="w-2 h-2 bg-red-500 rounded-full mr-2" />
                                    <span className="text-sm font-medium text-red-700">Inactivo</span>
                                  </>
                                )}
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

          </div>
        ) : activeTab === 'atributos' ? (
          <div className="p-6">
            {!selectedUser ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-text-secondary">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Selecciona un usuario para administrar sus atributos</p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-border flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">
                      Atributos de {selectedUser.apellido}, {selectedUser.nombre}
                    </h3>
                    <p className="text-sm text-text-secondary">{selectedUser.email}</p>
                  </div>
                  <Button
                    onClick={handleCreateUserAtributo}
                    size="sm"
                    className="flex items-center space-x-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Asignar Atributo</span>
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {userAtributos.length === 0 ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="text-center text-text-secondary">
                        <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No hay atributos asignados a este usuario</p>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-border">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                              Código Atributo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                              Atributo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                              Código Valor
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                              Nombre
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                              Acciones
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-border">
                          {userAtributos.map((userAtributo) => (
                            <tr
                              key={userAtributo.id}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-text-secondary font-mono">
                                  {userAtributo.valores_atributo?.atributos?.codigo}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-text-primary">
                                  {userAtributo.valores_atributo?.atributos?.descripcion}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-text-secondary font-mono">
                                  {userAtributo.valores_atributo?.codigo}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-text-secondary">
                                  {userAtributo.valores_atributo?.descripcion}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                <div className="flex items-center justify-end space-x-2">
                                  <button
                                    onClick={() => handleEditUserAtributo(userAtributo)}
                                    className="p-1 text-green-600 hover:text-green-700 rounded"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUserAtributo(userAtributo)}
                                    className="p-1 text-red-600 hover:text-red-900 rounded"
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
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
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

      {/* Modal de Atributo */}
      {showAtributoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">
                {editingUserAtributo ? 'Editar Atributo' : 'Asignar Atributo'}
              </h3>
              <button
                onClick={() => setShowAtributoModal(false)}
                className="text-text-secondary hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={atributoForm.handleSubmit(onSubmitUserAtributo)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Atributo
                </label>
                <select
                  {...atributoForm.register('atributoId')}
                  disabled={!!editingUserAtributo}
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:bg-gray-100"
                >
                  <option value="">Seleccionar atributo</option>
                  {atributos.map((atributo) => (
                    <option key={atributo.id} value={atributo.id}>
                      {atributo.descripcion}
                    </option>
                  ))}
                </select>
                {atributoForm.formState.errors.atributoId && (
                  <p className="text-red-500 text-sm mt-1">{atributoForm.formState.errors.atributoId.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Valor
                </label>
                <select
                  {...atributoForm.register('valorAtributoId')}
                  disabled={!selectedAtributoId}
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:bg-gray-100"
                >
                  <option value="">Seleccionar valor</option>
                  {valoresAtributo.map((valor) => (
                    <option key={valor.id} value={valor.id}>
                      {valor.descripcion}
                    </option>
                  ))}
                </select>
                {atributoForm.formState.errors.valorAtributoId && (
                  <p className="text-red-500 text-sm mt-1">{atributoForm.formState.errors.valorAtributoId.message}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAtributoModal(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading || !selectedAtributoId} className="flex-1">
                  {loading ? 'Guardando...' : editingUserAtributo ? 'Actualizar' : 'Asignar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
