import { useState, useEffect } from 'react';
import axios from 'axios';

export interface MenuItem {
  id: string;
  parentId: string | null;
  title: string;
  icon: string;
  url: string | null;
  description: string | null;
  orderIndex: number;
  isActive: boolean;
  requiresPermission: string | null;
  superuserOnly: boolean;
  tenantId: string | null;
  createdAt: string;
  updatedAt: string;
  children?: MenuItem[];
}

interface UseMenuResult {
  menuItems: MenuItem[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useMenu(): UseMenuResult {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      setError(null);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5100';
      const response = await axios.get<MenuItem[]>(`${apiUrl}/api/menu`, {
        withCredentials: true,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      setMenuItems(response.data);
    } catch (err) {
      console.error('❌ Error al cargar el menú:', err);
      setError(err instanceof Error ? err : new Error('Error desconocido'));
      // En caso de error, usar menú vacío
      setMenuItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  return {
    menuItems,
    loading,
    error,
    refetch: fetchMenu
  };
}
