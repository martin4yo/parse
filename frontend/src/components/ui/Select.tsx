'use client';

import { SelectHTMLAttributes, forwardRef, HTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
  onValueChange?: (value: string) => void;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', children, onValueChange, onChange, ...props }, ref) => {
    const baseStyles = `
      w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
      focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
      disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
      bg-white text-gray-900
    `;

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange?.(e);
      onValueChange?.(e.target.value);
    };

    return (
      <select
        ref={ref}
        className={`${baseStyles} ${className}`.trim()}
        onChange={handleChange}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = 'Select';

// Componentes adicionales para compatibilidad con shadcn/ui
export const SelectTrigger = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <Select ref={ref} className={className} {...props}>
        {children}
      </Select>
    );
  }
);

SelectTrigger.displayName = 'SelectTrigger';

export const SelectValue = ({ children, placeholder }: { children?: React.ReactNode; placeholder?: string }) => {
  return <>{children || placeholder}</>;
};

export const SelectContent = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

export const SelectItem = forwardRef<HTMLOptionElement, { value: string; children: React.ReactNode }>(
  ({ value, children }, ref) => {
    return (
      <option ref={ref} value={value}>
        {children}
      </option>
    );
  }
);

SelectItem.displayName = 'SelectItem';