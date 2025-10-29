interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
}

export function Badge({ children, className = '', variant = 'default' }: BadgeProps) {
  const baseStyles = 'inline-flex items-center px-2 py-1 text-xs font-medium rounded-full';

  const variants = {
    default: 'bg-blue-100 text-blue-800',
    secondary: 'bg-gray-100 text-gray-800',
    outline: 'border border-gray-300 bg-white text-gray-800',
    destructive: 'bg-red-100 text-red-800'
  };

  const combinedClassName = `${baseStyles} ${variants[variant]} ${className}`.trim();

  return (
    <span className={combinedClassName}>
      {children}
    </span>
  );
}