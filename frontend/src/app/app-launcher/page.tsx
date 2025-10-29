'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import axiomaLogo from '@/assets/axioma_logo_300x500.png';
import { AppCard, App } from '@/components/launcher/AppCard';
import { FileText, ScanText, CheckCircle, BookOpen, User, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

// Datos mock de aplicaciones
const apps: App[] = [
  {
    id: 'rendiciones',
    name: 'Rendiciones',
    description: 'Gestión completa de rendiciones de gastos y documentos',
    icon: <FileText className="w-16 h-16 text-white" />,
    color: '#352151', // palette-dark
    bgColor: '#8E6AAA', // palette-purple
    route: '/dashboard',
    lastUpdate: ''
  },
  {
    id: 'parse',
    name: 'Parse',
    description: 'Extracción inteligente de datos con IA',
    icon: <ScanText className="w-16 h-16 text-white" />,
    color: '#059669', // green-600
    bgColor: '#10b981', // green-500
    route: '/dashboard', // Por ahora va al mismo lado
    lastUpdate: ''
  },
  {
    id: 'checkpoint',
    name: 'Checkpoint',
    description: 'Gestión de RRHH',
    icon: <CheckCircle className="w-16 h-16 text-white" />,
    color: '#dc2626', // red-600
    bgColor: '#f97316', // orange-500
    route: 'https://checkpoint.axiomacloud.com',
    lastUpdate: ''
  },
  {
    id: 'docs',
    name: 'Docs',
    description: 'Gestión de ISO y Documentación',
    icon: <BookOpen className="w-16 h-16 text-white" />,
    color: '#0284c7', // sky-600
    bgColor: '#06b6d4', // cyan-500
    route: 'https://docs.axiomacloud.com',
    lastUpdate: ''
  }
];

export default function AppLauncherPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isEntering, setIsEntering] = useState(false);

  useEffect(() => {
    // Iniciar la animación de entrada después de un pequeño delay
    const timer = setTimeout(() => {
      setIsEntering(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 relative"
      style={{
        background: `linear-gradient(135deg, #FCE5B7 0%, #FCE5B7 25%, #F1ABB5 50%, #8E6AAA 75%, #352151 100%)`,
      }}
    >
      {/* User info en esquina superior derecha */}
      <div className="absolute top-6 right-6 flex items-center gap-4">
        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
          <div className="w-8 h-8 bg-palette-yellow rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-palette-dark" />
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-white drop-shadow">
              {user?.nombre && user?.apellido
                ? `${user.nombre} ${user.apellido}`
                : user?.email}
            </p>
            {user?.nombre && user?.apellido && (
              <p className="text-xs text-white/70 drop-shadow">
                {user?.email}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors rounded-full p-2 border border-white/20"
          title="Cerrar sesión"
        >
          <LogOut className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Card contenedor principal */}
      <div className="w-full max-w-7xl mx-auto">
        <div className="p-12">
          {/* Header con logo */}
          <div className="text-center mb-16">
            <div className="mx-auto h-64 w-64 relative mb-8 -mt-8">
              <Image
                src={axiomaLogo}
                alt="Axioma Logo"
                fill
                sizes="256px"
                className="object-contain"
                priority
              />
            </div>
            <p className="text-lg text-white/90 drop-shadow">
              Selecciona una aplicación para continuar
            </p>
          </div>

          {/* Grid de aplicaciones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 justify-items-center">
            {apps.map((app, index) => (
              <div
                key={app.id}
                className="transition-all duration-1000 ease-out"
                style={{
                  transform: isEntering ? 'translateY(0)' : 'translateY(-100vh)',
                  opacity: isEntering ? 1 : 0,
                  transitionDelay: `${index * 200}ms`,
                }}
              >
                <AppCard app={app} />
              </div>
            ))}
          </div>

          {/* Footer info */}
          <div className="mt-12 text-center">
            <p className="text-xs text-white/60 drop-shadow">
              v2.0.0 - {new Date().getFullYear()} Axioma Cloud
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
