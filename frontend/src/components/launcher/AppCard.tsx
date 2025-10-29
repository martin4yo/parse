'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

export interface App {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string; // Color primario
  bgColor: string; // Color de fondo
  route: string;
  lastUpdate: string; // Fecha en formato legible
}

interface AppCardProps {
  app: App;
}

export function AppCard({ app }: AppCardProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || isLoading) return;

    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Calcular inclinación (más sutil)
    const tiltX = ((y - centerY) / centerY) * -10; // -10 a 10 grados
    const tiltY = ((x - centerX) / centerX) * 10; // -10 a 10 grados

    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseLeave = () => {
    if (isLoading) return;
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
  };

  const handleClick = () => {
    // Iniciar animación de carga
    setIsLoading(true);

    // Dar tiempo para la animación antes de navegar
    setTimeout(() => {
      router.push(app.route);
    }, 1500);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className="relative cursor-pointer"
      style={{
        perspective: '1000px',
      }}
    >
      <div
        className={clsx(
          'relative rounded-full w-64 h-64 ease-out',
          'shadow-lg hover:shadow-2xl',
          'transition-all duration-300',
          isHovered && !isLoading && 'scale-110'
        )}
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(${isHovered && !isLoading ? '20px' : '0px'})`,
          transformStyle: 'preserve-3d',
          transition: 'transform 0.3s ease-out',
        }}
      >
        {/* Fondo con gradiente */}
        <div
          className="absolute inset-0 rounded-full opacity-90"
          style={{
            background: `linear-gradient(135deg, ${app.bgColor} 0%, ${app.color} 100%)`,
          }}
        />

        {/* Brillo superior (efecto 3D) */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%)',
          }}
        />

        {/* Efecto de llenado durante la carga */}
        {isLoading && (
          <div
            className="absolute inset-0 rounded-full bg-white/30 backdrop-blur-sm origin-bottom"
            style={{
              animation: 'fillUp 1.5s ease-out forwards',
              clipPath: 'circle(50% at 50% 50%)',
            }}
          />
        )}

        {/* Contenido */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center p-8 text-center">
          {/* Ícono */}
          <div
            className={clsx(
              'mb-4 transition-transform duration-300',
              isHovered && 'scale-110'
            )}
            style={{
              filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))',
            }}
          >
            {app.icon}
          </div>

          {/* Nombre */}
          <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">
            {app.name}
          </h3>

          {/* Descripción */}
          <p className="text-sm text-white/90 line-clamp-2">
            {app.description}
          </p>
        </div>

        {/* Anillo decorativo al hacer hover */}
        {isHovered && !isLoading && (
          <div
            className="absolute inset-0 rounded-full border-4 border-white/30 animate-pulse"
            style={{
              transform: 'scale(1.05)',
            }}
          />
        )}
      </div>
    </div>
  );
}
