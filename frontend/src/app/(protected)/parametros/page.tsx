'use client';

import { useState } from 'react';
import { Settings, Link, Database, Tags, CheckSquare, Workflow, DollarSign, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RelacionesParametros } from '@/components/parametros/RelacionesParametros';
import { ParametrosMaestros } from '@/components/parametros/ParametrosMaestros';
import AtributosTab from '@/components/parametros/AtributosTab';
import EstadosTab from '@/components/parametros/EstadosTab';
import ReglasNegocioTab from '@/components/parametros/ReglasNegocioTab';
import { MonedasTab } from '@/components/parametros/MonedasTab';
import { CajasTab } from '@/components/parametros/CajasTab';

type TabType = 'relaciones' | 'parametros' | 'atributos' | 'estados' | 'reglas' | 'monedas' | 'cajas';

export default function ParametrosPage() {
  const [activeTab, setActiveTab] = useState<TabType>('relaciones');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-palette-yellow rounded-lg flex items-center justify-center">
            <Settings className="w-6 h-6 text-palette-dark" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Gestión de Parámetros
            </h1>
            <p className="text-text-secondary">
              Administra las relaciones entre campos y los parámetros maestros del sistema
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-border">
        <div className="px-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('relaciones')}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                ${activeTab === 'relaciones'
                  ? 'border-palette-purple text-palette-purple'
                  : 'border-transparent text-text-secondary hover:text-palette-dark hover:border-palette-purple/30'
                }
              `}
            >
              <div className="flex items-center space-x-2">
                <Link className="w-4 h-4" />
                <span>Relaciones entre Campos</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('parametros')}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                ${activeTab === 'parametros'
                  ? 'border-palette-purple text-palette-purple'
                  : 'border-transparent text-text-secondary hover:text-palette-dark hover:border-palette-purple/30'
                }
              `}
            >
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4" />
                <span>Parámetros Maestros</span>
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
            >
              <div className="flex items-center space-x-2">
                <Tags className="w-4 h-4" />
                <span>Atributos</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('estados')}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                ${activeTab === 'estados'
                  ? 'border-palette-purple text-palette-purple'
                  : 'border-transparent text-text-secondary hover:text-palette-dark hover:border-palette-purple/30'
                }
              `}
            >
              <div className="flex items-center space-x-2">
                <CheckSquare className="w-4 h-4" />
                <span>Estados</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('reglas')}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                ${activeTab === 'reglas'
                  ? 'border-palette-purple text-palette-purple'
                  : 'border-transparent text-text-secondary hover:text-palette-dark hover:border-palette-purple/30'
                }
              `}
            >
              <div className="flex items-center space-x-2">
                <Workflow className="w-4 h-4" />
                <span>Reglas de Negocio</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('monedas')}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                ${activeTab === 'monedas'
                  ? 'border-palette-purple text-palette-purple'
                  : 'border-transparent text-text-secondary hover:text-palette-dark hover:border-palette-purple/30'
                }
              `}
            >
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4" />
                <span>Monedas</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('cajas')}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                ${activeTab === 'cajas'
                  ? 'border-palette-purple text-palette-purple'
                  : 'border-transparent text-text-secondary hover:text-palette-dark hover:border-palette-purple/30'
                }
              `}
            >
              <div className="flex items-center space-x-2">
                <Wallet className="w-4 h-4" />
                <span>Cajas</span>
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'relaciones' ? (
          <RelacionesParametros />
        ) : activeTab === 'parametros' ? (
          <ParametrosMaestros />
        ) : activeTab === 'atributos' ? (
          <div className="p-6">
            <AtributosTab />
          </div>
        ) : activeTab === 'estados' ? (
          <div className="p-6">
            <EstadosTab />
          </div>
        ) : activeTab === 'reglas' ? (
          <div className="p-6">
            <ReglasNegocioTab />
          </div>
        ) : activeTab === 'monedas' ? (
          <div className="p-6">
            <MonedasTab />
          </div>
        ) : (
          <div className="p-6">
            <CajasTab />
          </div>
        )}
      </div>
    </div>
  );
}