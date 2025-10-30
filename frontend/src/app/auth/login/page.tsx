'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast, { Toaster } from 'react-hot-toast';
import { Eye, EyeOff, ScanText } from 'lucide-react';
import Image from 'next/image';
import axiomaLogo from '@/assets/axioma_logo_300x500.png';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Email inválido'),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [progress, setProgress] = useState(0);
  const router = useRouter();
  const { login, isLoading } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    // Iniciar la animación de entrada después de un pequeño delay
    const timer = setTimeout(() => {
      setIsEntering(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password);
      toast.success('¡Bienvenido!');

      // Mostrar splash screen
      setShowSplash(true);

      // Animar barra de progreso
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 2;
        });
      }, 30);

      // Navegar después de que termine la animación
      setTimeout(() => {
        router.push('/parse');
      }, 2000);
    } catch (error: any) {
      const errorMessage = error.message || 'Error al iniciar sesión';

      // Verificar si es error de email no verificado
      if (error.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        toast.error(errorMessage, { duration: 6000 });
        toast('Puedes reenviar el email de verificación desde tu email', {
          icon: '📧',
          duration: 8000,
        });
      } else {
        toast.error(errorMessage);
      }
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{
        background: `linear-gradient(135deg, #FCE5B7 0%, #FCE5B7 25%, #F1ABB5 50%, #8E6AAA 75%, #352151 100%)`,
      }}
    >
      {/* @ts-ignore */}
      <Toaster position="top-right" />

      {/* Splash Screen con Logo y Progreso */}
      {showSplash && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, #FCE5B7 0%, #FCE5B7 25%, #F1ABB5 50%, #8E6AAA 75%, #352151 100%)`,
            animation: 'fadeIn 0.5s ease-in-out',
          }}
        >
          <div className="flex flex-col items-center justify-center gap-8">
            {/* Logo de Axioma */}
            <div className="relative w-96 h-96 animate-pulse">
              <Image
                src={axiomaLogo}
                alt="Axioma Logo"
                fill
                sizes="384px"
                className="object-contain"
                priority
              />
            </div>

            {/* Barra de Progreso */}
            <div className="w-96">
              <div className="h-2 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm">
                <div
                  className="h-full bg-gradient-to-r from-palette-purple to-palette-pink transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-white text-center mt-4 text-lg font-medium">
                Cargando...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Card contenedor principal */}
      <Card
        className="w-full max-w-4xl mx-auto ease-in-out"
        style={{
          transform: isExiting
            ? 'translateY(-150vh)'
            : isEntering
              ? 'translateY(0)'
              : 'translateY(-100vh)',
          opacity: isExiting ? 0 : isEntering ? 1 : 0,
          transition: 'all 1.5s ease-in-out',
        }}
      >
        <CardContent className="p-0">
          <div className="flex">
            {/* Sección Izquierda - Logo y Texto */}
            <div className="flex-1 p-8 bg-white/90 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center -mt-24">
                <div className="mx-auto h-80 w-80 relative -mb-16">
                  <Image
                    src={axiomaLogo}
                    alt="Axioma Logo"
                    fill
                    sizes="320px"
                    className="object-contain"
                    priority
                  />
                </div>
                <div className="flex items-center justify-center gap-4">
                  <ScanText className="w-12 h-12 text-palette-purple" />
                  <h2 className="text-4xl font-bold text-palette-dark">
                    Parse
                  </h2>
                </div>
              </div>
            </div>

            {/* Sección Derecha - Formulario */}
            <div className="flex-1 bg-white p-8">
              <div className="w-full max-w-sm mx-auto px-8">
                <div className="text-center mb-8">
                  <h3 className="text-xl font-semibold text-palette-dark mb-4">
                    Iniciar Sesión
                  </h3>
                  <p className="text-sm text-palette-purple">
                    Ingresa a tu cuenta para continuar
                  </p>
                </div>

                {/* Formulario */}
                <div className="space-y-6">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <Input
                    label="Email"
                    type="email"
                    placeholder="tu@email.com"
                    error={errors.email?.message}
                    {...register('email')}
                  />

                  <div className="relative">
                    <Input
                      label="Contraseña"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      error={errors.password?.message}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-9 text-text-secondary hover:text-text-primary"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    loading={isLoading}
                  >
                    Iniciar Sesión
                  </Button>
                </form>

                <div className="my-6 relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-palette-purple">o continúa con</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';
                    window.location.href = `${backendUrl}/api/auth/google`;
                  }}
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continuar con Google
                </Button>

                <div className="mt-8 text-center">
                  <p className="text-sm text-palette-purple">
                    ¿No tienes cuenta?{' '}
                    <Link
                      href="/auth/register"
                      className="font-medium text-palette-dark hover:text-palette-purple underline"
                    >
                      Regístrate aquí
                    </Link>
                  </p>
                </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}