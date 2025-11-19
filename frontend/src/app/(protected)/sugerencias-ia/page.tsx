'use client';

import { useState, useEffect } from 'react';
import { sugerenciasIAApi, SugerenciaIA, SugerenciaIAStats } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Check, X, Trash2, Filter, TrendingUp, Clock, CheckCircle2, XCircle, Lightbulb } from 'lucide-react';
import { useConfirmDialog } from '@/hooks/useConfirm';
import toast from 'react-hot-toast';

export default function SugerenciasIAPage() {
  const [sugerencias, setSugerencias] = useState<SugerenciaIA[]>([]);
  const [stats, setStats] = useState<SugerenciaIAStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { confirmDelete } = useConfirmDialog();

  // Filtros
  const [estadoFilter, setEstadoFilter] = useState<string>('pendiente');
  const [confianzaMinFilter, setConfianzaMinFilter] = useState<number>(0);

  useEffect(() => {
    loadData();
  }, [estadoFilter, confianzaMinFilter]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [sugerenciasRes, statsRes] = await Promise.all([
        sugerenciasIAApi.list({
          estado: estadoFilter || undefined,
          confianzaMin: confianzaMinFilter > 0 ? confianzaMinFilter / 100 : undefined,
          limit: 100
        }),
        sugerenciasIAApi.stats()
      ]);

      setSugerencias(sugerenciasRes.data);
      setStats(statsRes.data);
    } catch (error: any) {
      console.error('Error cargando sugerencias:', error);
      toast.error('Error al cargar sugerencias');
    } finally {
      setLoading(false);
    }
  };

  const handleAprobar = async (id: string) => {
    try {
      await sugerenciasIAApi.aprobar(id);
      toast.success('Sugerencia aprobada');
      loadData();
    } catch (error: any) {
      console.error('Error aprobando sugerencia:', error);
      toast.error(error.response?.data?.error || 'Error al aprobar sugerencia');
    }
  };

  const handleRechazar = async (id: string) => {
    try {
      await sugerenciasIAApi.rechazar(id);
      toast.success('Sugerencia rechazada');
      loadData();
    } catch (error: any) {
      console.error('Error rechazando sugerencia:', error);
      toast.error(error.response?.data?.error || 'Error al rechazar sugerencia');
    }
  };

  const handleAprobarBatch = async () => {
    if (selectedIds.size === 0) {
      toast.error('Selecciona al menos una sugerencia');
      return;
    }

    try {
      const result = await sugerenciasIAApi.aprobarBatch(
        Array.from(selectedIds),
        confianzaMinFilter > 0 ? confianzaMinFilter / 100 : undefined
      );
      toast.success(`${result.data.aprobadas} sugerencias aprobadas`);
      setSelectedIds(new Set());
      loadData();
    } catch (error: any) {
      console.error('Error aprobando batch:', error);
      toast.error('Error al aprobar sugerencias');
    }
  };

  const handleDelete = async (id: string, texto: string) => {
    const confirmed = await confirmDelete(`"${texto.substring(0, 50)}..."`);
    if (!confirmed) return;

    try {
      await sugerenciasIAApi.delete(id);
      toast.success('Sugerencia eliminada');
      loadData();
    } catch (error: any) {
      console.error('Error eliminando sugerencia:', error);
      toast.error('Error al eliminar sugerencia');
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === sugerencias.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sugerencias.map(s => s.id)));
    }
  };

  const getConfianzaColor = (confianza: number) => {
    if (confianza >= 0.9) return 'text-green-600 bg-green-50';
    if (confianza >= 0.75) return 'text-yellow-600 bg-yellow-50';
    return 'text-orange-600 bg-orange-50';
  };

  const getEstadoBadge = (estado: string) => {
    const badges = {
      pendiente: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pendiente' },
      aprobada: { color: 'bg-green-100 text-green-800', icon: CheckCircle2, label: 'Aprobada' },
      rechazada: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rechazada' },
      aplicada: { color: 'bg-blue-100 text-blue-800', icon: Check, label: 'Aplicada' }
    };

    const badge = badges[estado as keyof typeof badges] || badges.pendiente;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Lightbulb className="w-6 h-6 text-palette-dark" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                Sugerencias de IA
              </h1>
              <p className="text-text-secondary">
                Clasificaciones automáticas pendientes de revisión
              </p>
            </div>
          </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-secondary">Pendientes</p>
                  <div className="text-2xl font-bold text-text-primary mt-1">{stats.pendientes}</div>
                </div>
                <div className="p-3 rounded-lg bg-yellow-100">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-secondary">Aprobadas</p>
                  <div className="text-2xl font-bold text-text-primary mt-1">{stats.aprobadas}</div>
                </div>
                <div className="p-3 rounded-lg bg-green-100">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-secondary">Rechazadas</p>
                  <div className="text-2xl font-bold text-text-primary mt-1">{stats.rechazadas}</div>
                </div>
                <div className="p-3 rounded-lg bg-red-100">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-secondary">Aplicadas</p>
                  <div className="text-2xl font-bold text-text-primary mt-1">{stats.aplicadas}</div>
                </div>
                <div className="p-3 rounded-lg bg-blue-100">
                  <Check className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-secondary">Confianza Promedio</p>
                  <div className="text-2xl font-bold text-text-primary mt-1">
                    {(parseFloat(stats.promedioConfianza.toString()) * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-purple-100">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros y Acciones */}
      <div className="bg-gray-50 rounded-lg p-4 border border-border">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-secondary" />
            <span className="text-sm font-medium text-text-secondary">Filtros:</span>
          </div>

          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobada">Aprobada</option>
            <option value="rechazada">Rechazada</option>
            <option value="aplicada">Aplicada</option>
          </select>

          <select
            value={confianzaMinFilter}
            onChange={(e) => setConfianzaMinFilter(parseInt(e.target.value))}
            className="px-3 py-1.5 border rounded-lg text-sm"
          >
            <option value="0">Cualquier confianza</option>
            <option value="90">Confianza &gt; 90%</option>
            <option value="80">Confianza &gt; 80%</option>
            <option value="70">Confianza &gt; 70%</option>
          </select>

          {selectedIds.size > 0 && (
            <>
              <div className="h-6 w-px bg-gray-300" />
              <Button
                onClick={handleAprobarBatch}
                size="sm"
                variant="primary"
              >
                <Check className="w-4 h-4 mr-1" />
                Aprobar {selectedIds.size} seleccionadas
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Lista de Sugerencias */}
      <div className="space-y-4">
        {sugerencias.length === 0 ? (
          <div className="text-center py-12">
            <Lightbulb className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-text-secondary">No hay sugerencias con los filtros seleccionados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Select All */}
            {estadoFilter === 'pendiente' && sugerencias.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.size === sugerencias.length}
                  onChange={selectAll}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-text-secondary">
                  {selectedIds.size === sugerencias.length
                    ? `${sugerencias.length} seleccionadas`
                    : 'Seleccionar todas'}
                </span>
              </div>
            )}

            {sugerencias.map((sugerencia) => (
              <div
                key={sugerencia.id}
                className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  {estadoFilter === 'pendiente' && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(sugerencia.id)}
                      onChange={() => toggleSelect(sugerencia.id)}
                      className="mt-1 w-4 h-4 rounded border-gray-300"
                    />
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-text-primary">
                            {sugerencia.reglas_negocio?.nombre || 'Regla sin nombre'}
                          </h3>
                          {getEstadoBadge(sugerencia.estado)}
                        </div>
                        <p className="text-sm text-text-secondary line-clamp-1">
                          {sugerencia.textoAnalizado}
                        </p>
                      </div>

                      {/* Confianza */}
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${getConfianzaColor(parseFloat(sugerencia.confianza.toString()))}`}>
                        {(parseFloat(sugerencia.confianza.toString()) * 100).toFixed(0)}%
                      </div>
                    </div>

                    {/* Sugerencia */}
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-2">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-blue-900 mb-1">
                            Sugerencia IA: {sugerencia.valorSugerido.nombre || sugerencia.valorSugerido.codigo}
                          </p>
                          {sugerencia.razon && (
                            <p className="text-xs text-blue-700">{sugerencia.razon}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-xs text-text-secondary">
                      <span>Campo: {sugerencia.campoDestino}</span>
                      <span>•</span>
                      <span>
                        {new Date(sugerencia.createdAt).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {sugerencia.estado === 'pendiente' && (
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleAprobar(sugerencia.id)}
                        size="sm"
                        variant="primary"
                        title="Aprobar"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => handleRechazar(sugerencia.id)}
                        size="sm"
                        variant="danger"
                        title="Rechazar"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => handleDelete(sugerencia.id, sugerencia.textoAnalizado)}
                        size="sm"
                        variant="ghost"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
