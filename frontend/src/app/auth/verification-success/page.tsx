'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { CheckCircle, Mail } from 'lucide-react';
import axiomaLogo from '@/assets/axioma_logo_300x500.png';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function VerificationSuccessPage() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{
        backgroundImage: `linear-gradient(rgba(249, 250, 251, 0.92), rgba(249, 250, 251, 0.92)), url('https://images.unsplash.com/photo-1556761175-b413da4baf72?ixlib=rb-4.0.3&auto=format&fit=crop&w=1974&q=80')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
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
          <CardTitle>¡Cuenta Verificada!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="space-y-4">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
            <h3 className="text-xl font-semibold text-text-primary">
              ¡Tu email ha sido verificado exitosamente!
            </h3>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium text-green-800">
                    Verificación completada
                  </p>
                  <p className="text-sm text-green-600">
                    Ya puedes iniciar sesión con tu cuenta
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => router.push('/auth/login')}
              className="w-full"
              size="lg"
            >
              Iniciar Sesión
            </Button>

            <p className="text-sm text-text-secondary">
              Serás redirigido al dashboard después de iniciar sesión
            </p>
          </div>

          <div className="pt-6 border-t border-gray-200">
            <p className="text-xs text-text-secondary">
              Si tienes problemas para acceder, contacta con soporte técnico
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}