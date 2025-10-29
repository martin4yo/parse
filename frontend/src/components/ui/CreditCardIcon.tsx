interface CreditCardIconProps {
  brand: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-10 h-7',
  md: 'w-12 h-8',
  lg: 'w-16 h-10'
};

export function CreditCardIcon({ brand, className = '', size = 'md' }: CreditCardIconProps) {
  const baseClasses = `${sizeClasses[size]} ${className} rounded-md shadow-sm`;

  // Verificar que brand no sea null, undefined o vacío
  if (!brand || typeof brand !== 'string') {
    return (
      <div className={`${baseClasses} bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center text-white border border-gray-400`}>
        <div className="w-3 h-2 bg-gray-300 rounded-sm"></div>
      </div>
    );
  }

  switch (brand.toLowerCase()) {
    case 'visa':
      return (
        <div className={`${baseClasses} bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-xs border border-blue-500`}>
          VISA
        </div>
      );

    case 'mastercard':
      return (
        <div className={`${baseClasses} bg-gradient-to-br from-gray-800 to-black flex items-center justify-center relative border border-gray-700`}>
          <div className="relative flex items-center justify-center w-5 h-4">
            <div className="w-3.5 h-3.5 bg-red-500 rounded-full absolute left-0"></div>
            <div className="w-3.5 h-3.5 bg-yellow-400 rounded-full absolute right-0"></div>
            <div className="w-3.5 h-3.5 bg-orange-500 rounded-full absolute left-1/2 transform -translate-x-1/2 opacity-80 mix-blend-multiply"></div>
          </div>
        </div>
      );

    case 'amex':
    case 'american express':
      return (
        <div className={`${baseClasses} bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs border border-blue-400`}>
          AMEX
        </div>
      );

    case 'discover':
      return (
        <div className={`${baseClasses} bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white font-bold text-xs border border-orange-400`}>
          DISC
        </div>
      );

    case 'diners':
      return (
        <div className={`${baseClasses} bg-gradient-to-br from-sky-600 to-sky-800 flex items-center justify-center relative border border-sky-500`}>
          <div className="flex items-center space-x-0.5">
            <div className="w-3 h-3 border-2 border-white rounded-full"></div>
            <div className="w-3 h-3 border-2 border-white rounded-full -ml-1"></div>
          </div>
        </div>
      );

    case 'jcb':
      return (
        <div className={`${baseClasses} bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs border border-cyan-400`}>
          JCB
        </div>
      );

    case 'unknown':
    default:
      return (
        <div className={`${baseClasses} bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center text-white border border-gray-400`}>
          <div className="w-3 h-2 bg-gray-300 rounded-sm"></div>
        </div>
      );
  }
}

// Función helper para formatear número de tarjeta
export function formatCardNumber(number: string): string {
  // Remover todo lo que no sean dígitos
  const cleaned = number.replace(/\D/g, '');
  
  // Formatear en grupos de 4 dígitos
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
}

// Función helper para obtener últimos 4 dígitos
export function getLastFourDigits(number: string): string {
  const cleaned = number.replace(/\D/g, '');
  return cleaned.slice(-4);
}

// Función helper para enmascarar número de tarjeta
export function maskCardNumber(number: string): string {
  const cleaned = number.replace(/\D/g, '');
  if (cleaned.length < 4) return cleaned;
  
  const lastFour = cleaned.slice(-4);
  const masked = '*'.repeat(cleaned.length - 4);
  
  return formatCardNumber(masked + lastFour);
}

export default CreditCardIcon;