'use client';

import { useState } from 'react';
import { MenuItem } from '@/hooks/useMenu';
import { Button } from '@/components/ui/Button';
import {
  Edit,
  Trash2,
  ChevronRight,
  ChevronDown,
  GripVertical,
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
  ArrowLeftRight,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Key,
  Sparkles,
  ScanText,
  Package
} from 'lucide-react';
import { useConfirmDialog } from '@/hooks/useConfirm';
import axios from 'axios';
import { clsx } from 'clsx';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

// Mapa de íconos para resolver dinámicamente desde el nombre
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
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Calculator,
  DollarSign,
  Download,
  FileBarChart,
  ArrowLeftRight,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Key,
  Sparkles,
  ScanText,
  Package
};

// Helper para obtener el componente de ícono desde el nombre
const getIconComponent = (iconName: string): React.ComponentType<{ className?: string }> => {
  return IconMap[iconName] || FileText; // FileText como fallback
};

interface MenuItemsListProps {
  items: MenuItem[];
  loading: boolean;
  onEdit: (item: MenuItem) => void;
  onRefetch: () => void;
}

export function MenuItemsList({ items, loading, onEdit, onRefetch }: MenuItemsListProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [reordering, setReordering] = useState(false);
  const { confirm } = useConfirmDialog();

  const toggleExpand = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const handleDelete = async (item: MenuItem) => {
    const confirmed = await confirm(
      `¿Estás seguro de que deseas eliminar "${item.title}"?`,
      'Confirmar eliminación',
      'danger'
    );

    if (!confirmed) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';
      await axios.delete(`${apiUrl}/api/menu/${item.id}`, {
        withCredentials: true,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      onRefetch();
    } catch (error) {
      console.error('Error al eliminar item:', error);
      alert('Error al eliminar el item del menú');
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    // Si no cambió de posición, no hacer nada
    if (source.index === destination.index && source.droppableId === destination.droppableId) {
      return;
    }

    setReordering(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';

      // Determinar si es un item padre o hijo
      const isParent = source.droppableId === 'root';
      const itemsList = isParent ? items : items.find(i => i.id === source.droppableId)?.children || [];

      // Reordenar la lista localmente
      const reorderedItems = Array.from(itemsList);
      const [movedItem] = reorderedItems.splice(source.index, 1);
      reorderedItems.splice(destination.index, 0, movedItem);

      // Actualizar el orderIndex de cada item afectado
      const updates = reorderedItems.map((item, index) => ({
        id: item.id,
        orderIndex: index
      }));

      // Enviar actualizaciones al backend
      await Promise.all(
        updates.map(update =>
          axios.patch(`${apiUrl}/api/menu/${update.id}/reorder`, {
            orderIndex: update.orderIndex
          }, {
            withCredentials: true,
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          })
        )
      );

      // Refrescar la lista
      onRefetch();
    } catch (error) {
      console.error('Error al reordenar items:', error);
      alert('Error al reordenar los items del menú');
    } finally {
      setReordering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-text-secondary">Cargando...</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-text-secondary text-center">
          <p className="font-medium">No hay items de menú</p>
          <p className="text-sm mt-1">Crea el primer item para comenzar</p>
        </div>
      </div>
    );
  }

  const renderMenuItem = (item: MenuItem, index: number, parentId: string | null = null) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);

    return (
      <Draggable key={item.id} draggableId={item.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            className="space-y-1"
          >
            {/* Item principal */}
            <div
              className={clsx(
                'flex items-center gap-2 p-3 rounded-lg border transition-colors',
                parentId ? 'border-gray-100 bg-gray-50 ml-8' : 'border-gray-200 bg-white',
                snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : 'hover:bg-gray-50'
              )}
            >
              {/* Drag handle */}
              <div
                {...provided.dragHandleProps}
                className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
              >
                <GripVertical className="w-4 h-4" />
              </div>

              {/* Expand/collapse para items con hijos */}
              {hasChildren && (
                <button
                  onClick={() => toggleExpand(item.id)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              )}

              {/* Ícono del item */}
              <div
                className={clsx(
                  'flex-shrink-0 w-8 h-8 rounded flex items-center justify-center',
                  'bg-palette-dark text-palette-yellow'
                )}
                title={item.icon}
              >
                {(() => {
                  const IconComponent = getIconComponent(item.icon);
                  return <IconComponent className="w-4 h-4" />;
                })()}
              </div>

              {/* Información del item */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-text-primary truncate">
                    {item.title}
                  </h4>
                  {item.superuserOnly && (
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                      Superuser
                    </span>
                  )}
                  {!item.isActive && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded">
                      Inactivo
                    </span>
                  )}
                </div>
                {item.url && (
                  <p className="text-sm text-text-secondary truncate">
                    {item.url}
                  </p>
                )}
                {item.description && (
                  <p className="text-xs text-text-light truncate">
                    {item.description}
                  </p>
                )}
              </div>

              {/* Order index */}
              <div className="text-xs text-text-secondary font-mono">
                #{item.orderIndex}
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(item)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(item)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Items hijos */}
            {hasChildren && isExpanded && (
              <Droppable droppableId={item.id} type="child">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={clsx(
                      'space-y-1',
                      snapshot.isDraggingOver && 'bg-blue-50 rounded-lg p-2'
                    )}
                  >
                    {item.children!
                      .sort((a, b) => a.orderIndex - b.orderIndex)
                      .map((child, childIndex) => renderMenuItem(child, childIndex, item.id))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            )}
          </div>
        )}
      </Draggable>
    );
  };

  // Ordenar items por orderIndex
  const sortedItems = [...items].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="space-y-2">
      {reordering && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 rounded-lg text-sm">
          Reordenando items...
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="root" type="parent">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={clsx(
                'space-y-2',
                snapshot.isDraggingOver && 'bg-blue-50 rounded-lg p-2'
              )}
            >
              {sortedItems.map((item, index) => renderMenuItem(item, index))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
