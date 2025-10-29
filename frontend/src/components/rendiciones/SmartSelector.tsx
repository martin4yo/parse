'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { api } from '@/lib/api';

interface ParameterOption {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
}

interface SmartSelectorProps {
  value: string;
  fieldType: string; // tipo_comprobante, tipo_producto, etc.
  parentValue?: string | null; // Valor del campo padre para filtrar
  onSelect: (codigo: string, nombre: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
  className?: string;
}

export const SmartSelector: React.FC<SmartSelectorProps> = ({
  value,
  fieldType,
  parentValue,
  onSelect,
  onClose,
  position,
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [options, setOptions] = useState<ParameterOption[]>([]);
  const [filteredOptions, setFilteredOptions] = useState<ParameterOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);


  // Cargar opciones con búsqueda desde el servidor
  const loadOptionsWithSearch = useCallback(async (searchTerm: string = '') => {
    try {
      setLoading(true);
      setError(null);
      
      const params: any = {
        tipo_campo: fieldType,
        limit: '100'
      };
      
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }
      
      // Agregar filtro por valor padre si se está usando filtrado por padre
      // Si parentValue es undefined, significa que no hay relación padre-hijo
      // Si parentValue es null o string vacío, significa que hay relación pero no hay valor padre
      if (parentValue !== undefined) {
        params.valor_padre = parentValue || '';
      }
      
      console.log('SmartSelector making API call:', { 
        fieldType, 
        searchTerm, 
        parentValue,
        params,
        url: '/parametros/maestros'
      });
      
      console.log('DEBUG SmartSelector: parentValue received =', parentValue);
      
      const response = await api.get('/parametros/maestros', { params });
      const data = response.data;
      
      console.log('SmartSelector API response:', { 
        dataLength: data?.length, 
        data: data?.slice(0, 3) // Solo los primeros 3 para no spam la consola
      });
      
      setOptions(data);
      setFilteredOptions(data);
      
      // Si hay un valor inicial, encontrar su índice
      if (value && !searchTerm) {
        console.log('DEBUG SmartSelector: Looking for value in options:', {
          value,
          dataLength: data.length,
          sampleOptions: data.slice(0, 3).map((opt: ParameterOption) => ({ codigo: opt.codigo, nombre: opt.nombre }))
        });

        const index = data.findIndex((option: ParameterOption) =>
          option.codigo === value || option.nombre === value
        );

        console.log('DEBUG SmartSelector: Found index:', {
          index,
          foundOption: index >= 0 ? data[index] : 'Not found',
          finalSelectedIndex: index >= 0 ? index : 0
        });

        if (index >= 0) {
          // Valor encontrado, seleccionar el item correspondiente
          setSelectedIndex(index);
        } else {
          // Valor no encontrado, mantener el searchTerm con el valor actual
          // pero no seleccionar ningún item específico
          setSelectedIndex(0);
          setSearchTerm(value); // Mantener el valor en el input de búsqueda
        }
      } else {
        setSelectedIndex(0);
      }
    } catch (err: any) {
      console.error('Error loading parameters:', err);
      setError(err.response?.data?.message || err.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [fieldType, value, parentValue]);

  // Debounce para búsqueda en tiempo real
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    
    // Limpiar timeout anterior
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Establecer nuevo timeout para búsqueda
    const timeout = setTimeout(() => {
      loadOptionsWithSearch(term);
    }, 300); // 300ms de debounce
    
    setSearchTimeout(timeout);
  };

  // Efectos - cargar con el valor inicial si existe
  useEffect(() => {
    // Si hay un valor inicial (character tipeado), buscar con ese valor
    if (value && value.trim()) {
      loadOptionsWithSearch(value);
    } else {
      loadOptionsWithSearch();
    }
  }, [loadOptionsWithSearch]);

  // Cleanup timeout al desmontar
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  // Capturar eventos globales para evitar que se propaguen a la grilla y manejar navegación
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Prevenir propagación de todas las teclas de navegación
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Manejar navegación con flechas arriba/abajo desde cualquier lugar
        if (e.key === 'ArrowDown') {
          setSelectedIndex(prev => 
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
        } else if (e.key === 'ArrowUp') {
          setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        }
      }
      
      // Manejar Enter y Escape desde cualquier lugar
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (filteredOptions.length > 0 && selectedIndex >= 0) {
          const selected = filteredOptions[selectedIndex];
          onSelect(selected.codigo, selected.nombre);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    // Agregar listener con capture=true para interceptar antes que otros handlers
    document.addEventListener('keydown', handleGlobalKeyDown, true);
    
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [filteredOptions, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    // Enfocar el input al montar
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      // Si hay valor inicial (como un carácter escrito), posicionar cursor al final
      // Si no hay valor inicial, seleccionar todo el texto
      if (value && value.length > 0) {
        // Posicionar cursor al final
        const length = value.length;
        searchInputRef.current.setSelectionRange(length, length);
      } else {
        searchInputRef.current.select();
      }
    }
  }, []);

  // Mantener el foco en el input cuando cambia el searchTerm
  useEffect(() => {
    // Asegurarse de que el input mantenga el foco después de cambios
    if (searchInputRef.current && document.activeElement !== searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchTerm]);

  useEffect(() => {
    // Scroll automático al item seleccionado
    if (listRef.current && filteredOptions.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ 
          block: 'nearest',
          behavior: 'smooth' 
        });
      }
    }
  }, [selectedIndex, filteredOptions]);

  // Manejo de teclado para el contenedor (principalmente para detener propagación)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // SIEMPRE detener la propagación para evitar que afecte a la grilla
    e.stopPropagation();
    
    // Las teclas de navegación ya se manejan en el listener global
    // Solo necesitamos manejar Tab aquí ya que no está en el listener global
    if (e.key === 'Tab') {
      e.preventDefault();
      if (filteredOptions.length > 0 && selectedIndex >= 0) {
        const selected = filteredOptions[selectedIndex];
        onSelect(selected.codigo, selected.nombre);
      }
    }
  };

  // Selección con click
  const handleSelect = (option: ParameterOption) => {
    onSelect(option.codigo, option.nombre);
  };

  // Calcular posición del popup para que no se corte - Calcular solo una vez
  const popupStyle = React.useMemo(() => {
    const style: React.CSSProperties = {
      position: 'fixed',
      zIndex: 9999,
      width: '400px', // Ancho fijo
      height: '400px', // Altura fija (no máxima, sino fija)
    };

    // Ajustar posición horizontal
    if (position.x + 400 > window.innerWidth) {
      // Si no cabe a la derecha, alinearlo desde la derecha
      (style as any).right = Math.max(10, window.innerWidth - position.x - 100);
    } else {
      // Si cabe, posición normal desde la izquierda
      (style as any).left = position.x;
    }

    // Ajustar posición vertical
    if (position.y + 400 > window.innerHeight) {
      // Si no cabe abajo, mostrar arriba
      (style as any).bottom = Math.max(10, window.innerHeight - position.y + 20);
    } else {
      // Si cabe, posición normal desde arriba
      (style as any).top = position.y;
    }

    return style;
  }, []); // Calcular solo una vez, no recalcular nunca

  return (
    <>
      {/* Backdrop transparente para capturar eventos */}
      <div
        className="fixed inset-0 z-[9998]"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onMouseDown={(e) => e.stopPropagation()}
      />
      
      {/* Modal content */}
      <div
        ref={containerRef}
        className={`flex flex-col h-full bg-white border border-gray-300 rounded-lg shadow-xl overflow-hidden ${className}`}
        data-smart-selector
        style={popupStyle}
        onKeyDown={handleKeyDown}
      >
        {/* Header con campo de búsqueda */}
        <div className="flex-shrink-0 p-3 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                // Solo detener propagación, la navegación se maneja globalmente
                e.stopPropagation();
                // Tab necesita manejarse aquí
                if (e.key === 'Tab') {
                  handleKeyDown(e);
                }
              }}
              placeholder={`Buscar en ${fieldType?.replace('_', ' ') || 'parámetros'}...`}
              className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={onClose}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Lista de opciones */}
        <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-4 text-center text-gray-500">
            <div className="animate-spin inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2"></div>
            Cargando opciones...
          </div>
        )}

        {error && (
          <div className="p-4 text-center text-red-500">
            <p className="text-sm">Error: {error}</p>
            <button
              onClick={() => loadOptionsWithSearch()}
              className="mt-2 text-xs text-blue-500 hover:text-blue-700 underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && filteredOptions.length === 0 && (
          <div className="p-4 text-center text-gray-500">
            <p className="text-sm">No se encontraron opciones</p>
            {searchTerm && (
              <button
                onClick={() => handleSearchChange('')}
                className="mt-1 text-xs text-blue-500 hover:text-blue-700 underline"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        )}

        {!loading && !error && filteredOptions.length > 0 && (
          <ul ref={listRef} className="py-1">
            {filteredOptions.map((option, index) => (
              <li
                key={`${option.id}-${option.codigo}`}
                className={`px-4 py-2 cursor-pointer text-sm transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-100 text-blue-900'
                    : 'hover:bg-gray-100'
                }`}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {option.codigo}
                    </div>
                    <div className="text-gray-600 truncate">
                      {option.nombre}
                    </div>
                    {option.descripcion && option.descripcion !== option.nombre && (
                      <div className="text-xs text-gray-500 truncate">
                        {option.descripcion}
                      </div>
                    )}
                  </div>
                  {index === selectedIndex && (
                    <ChevronDown className="h-4 w-4 text-blue-500 ml-2 flex-shrink-0" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        </div>

        {/* Footer con ayuda de teclado */}
        {!loading && !error && filteredOptions.length > 0 && (
          <div className="flex-shrink-0 px-3 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>↑↓ navegar</span>
              <span>Enter seleccionar</span>
              <span>Esc cancelar</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};