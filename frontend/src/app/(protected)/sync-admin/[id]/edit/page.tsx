'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Database, RefreshCw } from 'lucide-react';
import SyncConfigForm from '../../components/SyncConfigForm';
import { SyncConfiguration } from '@/types/sync';
import { toast } from 'sonner';
import { useApiClient } from '@/hooks/useApiClient';

export default function EditSyncConfigPage() {
  const params = useParams();
  const id = params.id as string;
  const { get } = useApiClient();

  const [config, setConfig] = useState<SyncConfiguration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchConfig();
    }
  }, [id]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await get(`/api/sync/configurations/${id}`);

      if (data.success) {
        setConfig(data.data);
      } else {
        toast.error('Error al cargar configuración');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Database className="h-6 w-6" />
            Editar Configuración de Sincronización
          </CardTitle>
          <CardDescription>
            Modifica la configuración de sincronización existente
            {config?.tenant && ` - ${config.tenant.nombre}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : config ? (
            <SyncConfigForm
              initialData={{
                tenantId: config.tenantId,
                sqlServerHost: config.sqlServerHost,
                sqlServerPort: config.sqlServerPort,
                sqlServerDatabase: config.sqlServerDatabase,
                sqlServerUser: config.sqlServerUser,
                sqlServerPassword: '', // No mostrar password actual
                configuracionTablas: config.configuracionTablas,
                activo: config.activo,
              }}
              configId={id}
            />
          ) : (
            <p className="text-center text-gray-500">Configuración no encontrada</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
