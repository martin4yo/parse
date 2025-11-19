'use client';

import { useState, useEffect } from 'react';
import { MenuItem } from '@/hooks/useMenu';
import { Button } from '@/components/ui/Button';
import {
  X,
  Home,
  Upload,
  CreditCard,
  Settings,
  LogOut,
  User,
  Users,
  FileText,
  PieChart,
  Receipt,
  Shield,
  Send,
  Building2,
  BarChart3,
  FileCheck,
  Banknote,
  CheckCircle,
  Folder,
  TrendingUp,
  Calculator,
  DollarSign,
  Download,
  FileBarChart,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Key,
  Sparkles,
  ScanText,
  Package,
  Lightbulb
} from 'lucide-react';
import axios from 'axios';
import { useConfirmDialog } from '@/hooks/useConfirm';

// Mapa de íconos
const IconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  Upload,
  CreditCard,
  Settings,
  LogOut,
  User,
  Users,
  FileText,
  PieChart,
  Receipt,
  Shield,
  Send,
  Building2,
  BarChart3,
  FileCheck,
  Banknote,
  CheckCircle,
  Folder,
  TrendingUp,
  Calculator,
  DollarSign,
  Download,
  FileBarChart,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Key,
  Sparkles,
  ScanText,
  Package,
  Lightbulb
};

const getIconComponent = (iconName: string) => {
  return IconMap[iconName] || FileText;
};

interface MenuItemFormProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isCreating: boolean;
}

const AVAILABLE_ICONS = [
  'Home', 'Upload', 'CreditCard', 'Settings', 'LogOut', 'User', 'Users',
  'FileText', 'PieChart', 'Receipt', 'Shield', 'Send', 'Building2',
  'BarChart3', 'FileCheck', 'Banknote', 'CheckCircle', 'Folder',
  'TrendingUp', 'Calculator', 'DollarSign', 'Download', 'FileBarChart',
  'ArrowUpCircle', 'ArrowDownCircle', 'RefreshCw', 'Key', 'Sparkles',
  'ScanText', 'Package', 'Lightbulb'
];

export function MenuItemForm({ item, isOpen, onClose, onSuccess, isCreating }: MenuItemFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    icon: 'FileText',
    url: '',
    description: '',
    parentId: '',
    orderIndex: 0,
    isActive: true,
    superuserOnly: false,
    requiresPermission: ''
  });
  const [loading, setLoading] = useState(false);
  const [parentItems, setParentItems] = useState<MenuItem[]>([]);
  const { confirm } = useConfirmDialog();

  // Cargar items padre disponibles
  useEffect(() => {
    const fetchParentItems = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5100';
        const response = await axios.get<MenuItem[]>(`${apiUrl}/api/menu`, {
          withCredentials: true,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        setParentItems(response.data);
      } catch (error) {
        console.error('Error al cargar items padre:', error);
      }
    };

    if (isOpen) {
      fetchParentItems();
    }
  }, [isOpen]);

  // Cargar datos del item al editar
  useEffect(() => {
    if (item && !isCreating) {
      setFormData({
        title: item.title,
        icon: item.icon,
        url: item.url || '',
        description: item.description || '',
        parentId: item.parentId || '',
        orderIndex: item.orderIndex,
        isActive: item.isActive,
        superuserOnly: item.superuserOnly,
        requiresPermission: item.requiresPermission || ''
      });
    } else {
      // Reset para crear nuevo
      setFormData({
        title: '',
        icon: 'FileText',
        url: '',
        description: '',
        parentId: '',
        orderIndex: 0,
        isActive: true,
        superuserOnly: false,
        requiresPermission: ''
      });
    }
  }, [item, isCreating]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5100';

      const payload = {
        ...formData,
        url: formData.url || null,
        description: formData.description || null,
        parentId: formData.parentId || null,
        requiresPermission: formData.requiresPermission || null
      };

      if (isCreating) {
        // Crear nuevo item
        await axios.post(`${apiUrl}/api/menu`, payload, {
          withCredentials: true,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
      } else {
        // Actualizar item existente
        await axios.put(`${apiUrl}/api/menu/${item!.id}`, payload, {
          withCredentials: true,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Error al guardar item:', error);
      await confirm(
        'Ocurrió un error al guardar el item del menú. Por favor, intenta nuevamente.',
        'Error',
        'danger'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-text-primary">
            {isCreating ? 'Nuevo Item de Menú' : 'Editar Item de Menú'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Título *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ej: Dashboard"
            />
          </div>

          {/* Ícono */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Ícono *
            </label>
            <div className="flex gap-3">
              <select
                required
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {AVAILABLE_ICONS.map(icon => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
              {/* Preview del ícono */}
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-palette-dark flex items-center justify-center text-palette-yellow">
                {(() => {
                  const IconComponent = getIconComponent(formData.icon);
                  return <IconComponent className="w-5 h-5" />;
                })()}
              </div>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              Ícono de lucide-react que se mostrará
            </p>
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              URL
            </label>
            <input
              type="text"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="/dashboard"
            />
            <p className="text-xs text-text-secondary mt-1">
              Dejar vacío si es solo un contenedor con sub-items
            </p>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              placeholder="Descripción del item de menú"
            />
          </div>

          {/* Item Padre */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Item Padre
            </label>
            <select
              value={formData.parentId}
              onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Ninguno (Item de nivel 1)</option>
              {parentItems.map(parent => (
                <option key={parent.id} value={parent.id}>
                  {parent.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-secondary mt-1">
              Selecciona un padre para crear un sub-item (nivel 2)
            </p>
          </div>

          {/* Orden */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Orden
            </label>
            <input
              type="number"
              min="0"
              value={formData.orderIndex}
              onChange={(e) => setFormData({ ...formData, orderIndex: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-text-secondary mt-1">
              Número para ordenar items (menor = primero)
            </p>
          </div>

          {/* Permisos */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Permiso Requerido
            </label>
            <input
              type="text"
              value={formData.requiresPermission}
              onChange={(e) => setFormData({ ...formData, requiresPermission: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="ej: admin.users"
            />
            <p className="text-xs text-text-secondary mt-1">
              Opcional: Código de permiso para mostrar este item
            </p>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary"
              />
              <span className="text-sm font-medium text-text-primary">
                Activo
              </span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.superuserOnly}
                onChange={(e) => setFormData({ ...formData, superuserOnly: e.target.checked })}
                className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary"
              />
              <span className="text-sm font-medium text-text-primary">
                Solo Superusuarios
              </span>
            </label>
          </div>

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? 'Guardando...' : (isCreating ? 'Crear' : 'Guardar')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
