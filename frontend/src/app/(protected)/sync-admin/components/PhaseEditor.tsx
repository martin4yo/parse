'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { PhaseConfig } from '@/types/sync';
import { Code } from 'lucide-react';

interface PhaseEditorProps {
  title: string;
  phase?: PhaseConfig;
  onChange: (phase: PhaseConfig | undefined) => void;
  description?: string;
}

export default function PhaseEditor({
  title,
  phase,
  onChange,
  description,
}: PhaseEditorProps) {
  const isEnabled = phase?.enabled ?? false;

  const handleToggle = (enabled: boolean) => {
    if (enabled) {
      onChange({
        enabled: true,
        ejecutarEn: 'origen',
        sql: '',
      });
    } else {
      onChange(undefined);
    }
  };

  const handleChange = (updates: Partial<PhaseConfig>) => {
    if (phase) {
      onChange({
        ...phase,
        ...updates,
      });
    }
  };

  return (
    <Card className={isEnabled ? '' : 'opacity-60'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
          </div>
          <Switch checked={isEnabled} onCheckedChange={handleToggle} />
        </div>
        {description && (
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        )}
      </CardHeader>

      {isEnabled && phase && (
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor={`ejecutar-${title}`}>Ejecutar en</Label>
            <Select
              id={`ejecutar-${title}`}
              value={phase.ejecutarEn}
              onChange={(e) =>
                handleChange({ ejecutarEn: e.target.value as 'origen' | 'destino' })
              }
            >
              <option value="origen">
                Origen (SQL Server del cliente)
              </option>
              <option value="destino">
                Destino (SQL Server para bajada / PostgreSQL para subida)
              </option>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              Define dónde se ejecutará el código SQL
            </p>
          </div>

          <div>
            <Label htmlFor={`sql-${title}`}>Código SQL</Label>
            <Textarea
              id={`sql-${title}`}
              value={phase.sql}
              onChange={(e) => handleChange({ sql: e.target.value })}
              placeholder={
                title === 'Pre-Process'
                  ? 'EXEC sp_preparar_datos\nCREATE TABLE IF NOT EXISTS...'
                  : 'UPDATE log_sync SET ultima_ejecucion = GETDATE()\nMERGE table AS t USING temp_table AS s...'
              }
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              {title === 'Pre-Process'
                ? 'SQL a ejecutar ANTES de la extracción/carga de datos'
                : 'SQL a ejecutar DESPUÉS de la extracción/carga de datos'}
            </p>
          </div>

          {title === 'Post-Process' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-xs text-blue-800">
                <strong>Placeholders disponibles:</strong>
                <br />
                • <code>{'{temp_table}'}</code> - Tabla temporal creada
                <br />
                • <code>{'{target_table}'}</code> - Tabla destino
                <br />
                • <code>@ultimaSync</code> - Fecha de última sincronización (solo incremental)
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
