'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import toast, { Toaster } from 'react-hot-toast';
import { CheckCircle, XCircle, Mail, Loader2 } from 'lucide-react';
import axiomaLogo from '@/assets/axioma_logo_300x500.png';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { authApi } from '@/lib/api';

function VerifyEmailContent() {
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setVerificationStatus('error');
      setMessage('Token de verificación no válido');
      return;
    }

    verifyEmail(token);
  }, [searchParams]);

  const verifyEmail = async (token: string) => {
    try {
      console.log('🔄 [VERIFY] Iniciando verificación con token:', token);

      const response = await authApi.verifyEmail(token);
      console.log('✅ [VERIFY] Respuesta del servidor:', response);

      if (response.success) {
        setVerificationStatus('success');
        setMessage(response.message);
        toast.success('¡Email verificado exitosamente!');
      } else {
        setVerificationStatus('error');
        setMessage(response.error || 'Error al verificar el email');
        toast.error(response.error || 'Error al verificar el email');
      }
    } catch (error: any) {
      console.error('❌ [VERIFY] Error en verificación:', error);
      setVerificationStatus('error');
      const errorMessage = error.response?.data?.error || error.message || 'Error al verificar el email';
      setMessage(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleGoToLogin = () => {
    router.push('/auth/login');
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

      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto h-24 w-24 relative mb-4">
            <Image
              src={axiomaLogo}
              alt="Axioma Logo"
              fill
              sizes="96px"
              className="object-contain"
              priority
            />
          </div>
          <CardTitle>Verificación de Email</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          {verificationStatus === 'loading' && (
            <div className="space-y-4">
              <Loader2 className="h-12 w-12 mx-auto text-blue-500 animate-spin" />
              <h3 className="text-lg font-medium text-text-primary">
                Verificando tu email...
              </h3>
              <p className="text-text-secondary">
                Por favor espera mientras procesamos tu verificación.
              </p>
            </div>
          )}

          {verificationStatus === 'success' && (
            <div className="space-y-4">
              <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
              <h3 className="text-xl font-semibold text-text-primary">
                ¡Email Verificado!
              </h3>
              <p className="text-text-secondary">
                {message}
              </p>
              <div className="pt-4">
                <Button
                  onClick={handleGoToLogin}
                  className="w-full"
                >
                  Iniciar Sesión
                </Button>
              </div>
            </div>
          )}

          {verificationStatus === 'error' && (
            <div className="space-y-4">
              <XCircle className="h-16 w-16 mx-auto text-red-500" />
              <h3 className="text-xl font-semibold text-text-primary">
                Error de Verificación
              </h3>
              <p className="text-text-secondary">
                {message}
              </p>
              <div className="space-y-2 pt-4">
                <Button
                  onClick={() => router.push('/auth/register')}
                  variant="outline"
                  className="w-full"
                >
                  Volver a Registro
                </Button>
                <div className="text-center">
                  <Link
                    href="/auth/login"
                    className="text-sm font-medium text-palette-dark hover:text-palette-purple underline"
                  >
                    ¿Ya tienes cuenta? Inicia sesión
                  </Link>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, #FCE5B7 0%, #FCE5B7 25%, #F1ABB5 50%, #8E6AAA 75%, #352151 100%)`,
        }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}