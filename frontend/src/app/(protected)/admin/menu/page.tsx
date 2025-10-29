'use client';

import { useState } from 'react';
import { MenuItemsList } from '@/components/admin/menu/MenuItemsList';
import { MenuItemForm } from '@/components/admin/menu/MenuItemForm';
import { MenuPreview } from '@/components/admin/menu/MenuPreview';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';
import { useMenu, MenuItem } from '@/hooks/useMenu';

export default function MenuAdminPage() {
  const { menuItems, loading, refetch } = useMenu();
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = () => {
    setSelectedItem(null);
    setIsCreating(true);
    setIsFormOpen(true);
  };

  const handleEdit = (item: MenuItem) => {
    setSelectedItem(item);
    setIsCreating(false);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedItem(null);
    setIsCreating(false);
  };

  const handleSuccess = () => {
    refetch();
    handleFormClose();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Administración de Menú
          </h1>
          <p className="text-text-secondary mt-1">
            Gestiona los items del menú de navegación del sidebar
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Item
        </Button>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de items */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-border shadow-sm">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">
                Items de Menú
              </h2>
              <p className="text-sm text-text-secondary mt-1">
                {menuItems.length} items configurados
              </p>
            </div>
            <div className="p-4">
              <MenuItemsList
                items={menuItems}
                loading={loading}
                onEdit={handleEdit}
                onRefetch={refetch}
              />
            </div>
          </div>
        </div>

        {/* Preview del sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-border shadow-sm sticky top-6">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">
                Vista Previa
              </h2>
              <p className="text-sm text-text-secondary mt-1">
                Cómo se verá en el sidebar
              </p>
            </div>
            <div className="p-4">
              <MenuPreview items={menuItems} />
            </div>
          </div>
        </div>
      </div>

      {/* Modal de formulario */}
      {isFormOpen && (
        <MenuItemForm
          item={selectedItem}
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSuccess={handleSuccess}
          isCreating={isCreating}
        />
      )}
    </div>
  );
}
