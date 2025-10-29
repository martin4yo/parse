'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast, { Toaster } from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import axiomaLogo from '@/assets/axioma_logo_300x500.png';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { authApi, Profile } from '@/lib/api';
import { authUtils } from '@/lib/auth';

const registerSchema = z.object({
  nombre: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'El nombre no puede tener más de 50 caracteres'),
  apellido: z
    .string()
    .min(2, 'El apellido debe tener al menos 2 caracteres')
    .max(50, 'El apellido no puede tener más de 50 caracteres'),
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Email inválido'),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(100, 'La contraseña es muy larga'),
  confirmPassword: z
    .string()
    .min(6, 'Confirma tu contraseña'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });


  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      const { confirmPassword, ...registerData } = data;
      const response = await authApi.register(registerData);

      // No hacer login automático - usuario debe verificar email primero
      toast.success('¡Cuenta creada! Revisa tu email para verificar tu cuenta.');

      // Mostrar información adicional si el email no se pudo enviar
      if (response.emailSent === false) {
        toast.error('Error al enviar email de verificación. Contacta con soporte.');
      }

      // Redirigir a login después de un delay para que vea el mensaje
      setTimeout(() => {
        router.push('/auth/login');
      }, 3000);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Error al crear la cuenta';
      toast.error(errorMessage);
      
      // Mostrar errores de validación si existen
      if (error.response?.data?.errors) {
        error.response.data.errors.forEach((err: any) => {
          toast.error(err.msg);
        });
      }
    } finally {
      setIsLoading(false);
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

      {/* Card contenedor principal */}
      <Card className="w-full max-w-4xl mx-auto">
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
                <h2 className="text-2xl font-bold text-palette-dark">
                  Rendiciones
                </h2>
              </div>
            </div>

            {/* Sección Derecha - Formulario */}
            <div className="flex-1 bg-white p-8">
              <div className="w-full max-w-sm mx-auto px-8">
                <div className="text-center mb-8">
                  <h3 className="text-xl font-semibold text-palette-dark mb-4">
                    Registro de Usuario
                  </h3>
                  <p className="text-sm text-palette-purple">
                    Completa los datos para registrarte
                  </p>
                </div>

                {/* Formulario */}
                <div className="space-y-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Nombre"
                  placeholder="Juan"
                  error={errors.nombre?.message}
                  {...register('nombre')}
                />
                <Input
                  label="Apellido"
                  placeholder="Pérez"
                  error={errors.apellido?.message}
                  {...register('apellido')}
                />
              </div>

              <Input
                label="Email"
                type="email"
                placeholder="juan.perez@email.com"
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

              <div className="relative">
                <Input
                  label="Confirmar Contraseña"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  error={errors.confirmPassword?.message}
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-9 text-text-secondary hover:text-text-primary"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
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
                Crear Cuenta
              </Button>
            </form>

                <div className="mt-8 text-center">
                  <p className="text-sm text-palette-purple">
                    ¿Ya tienes cuenta?{' '}
                    <Link
                      href="/auth/login"
                      className="font-medium text-palette-dark hover:text-palette-purple underline"
                    >
                      Inicia sesión aquí
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