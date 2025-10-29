import { LabelHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {}

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={clsx(
          'block text-sm font-medium text-text-primary mb-2',
          className
        )}
        {...props}
      />
    );
  }
);

Label.displayName = 'Label';

export { Label };
