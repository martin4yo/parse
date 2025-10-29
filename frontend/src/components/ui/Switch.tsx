'use client';

import { forwardRef, InputHTMLAttributes } from 'react';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className = '', checked, onCheckedChange, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      onCheckedChange?.(e.target.checked);
    };

    return (
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          ref={ref}
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={handleChange}
          {...props}
        />
        <div className={`
          w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300
          rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white
          after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white
          after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all
          peer-checked:bg-blue-600 ${className}
        `} />
      </label>
    );
  }
);

Switch.displayName = 'Switch';
