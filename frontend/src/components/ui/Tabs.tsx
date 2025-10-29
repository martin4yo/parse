'use client';

import { createContext, useContext, ReactNode, useState } from 'react';

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: ReactNode;
}

export function Tabs({ value: controlledValue, defaultValue, onValueChange, className = '', children }: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue || '');

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const handleValueChange = (newValue: string) => {
    if (!isControlled) {
      setUncontrolledValue(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  className?: string;
  children: ReactNode;
}

export function TabsList({ className = '', children }: TabsListProps) {
  return (
    <div className={`
      inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1
      ${className}
    `}>
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  className?: string;
  children: ReactNode;
  title?: string;
}

export function TabsTrigger({ value, className = '', children, title }: TabsTriggerProps) {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('TabsTrigger must be used within Tabs');
  }

  const { value: currentValue, onValueChange } = context;
  const isActive = currentValue === value;

  return (
    <button
      type="button"
      onClick={() => onValueChange(value)}
      title={title}
      className={`
        inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5
        text-sm font-medium ring-offset-white transition-all
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
        disabled:pointer-events-none disabled:opacity-50
        ${isActive
          ? 'bg-gray-800 text-palette-yellow shadow-sm font-semibold'
          : 'bg-white text-gray-800 hover:bg-gray-50'
        }
        ${className}
      `}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  className?: string;
  children: ReactNode;
}

export function TabsContent({ value, className = '', children }: TabsContentProps) {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('TabsContent must be used within Tabs');
  }

  const { value: currentValue } = context;

  if (currentValue !== value) {
    return null;
  }

  return (
    <div
      className={`
        mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-primary focus-visible:ring-offset-2
        ${className}
      `}
    >
      {children}
    </div>
  );
}