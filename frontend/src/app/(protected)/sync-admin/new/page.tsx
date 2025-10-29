'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Database } from 'lucide-react';
import SyncConfigForm from '../components/SyncConfigForm';

export default function NewSyncConfigPage() {
  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Database className="h-6 w-6" />
            Nueva Configuración de Sincronización
          </CardTitle>
          <CardDescription>
            Configura una nueva sincronización bidireccional entre SQL Server y PostgreSQL
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SyncConfigForm />
        </CardContent>
      </Card>
    </div>
  );
}
