'use client';

import { FileQuestion, Home } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="p-4 bg-gray-100 rounded-full">
            <FileQuestion className="w-16 h-16 text-gray-400" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">404</h1>
          <h2 className="text-xl font-semibold text-gray-700">Página no encontrada</h2>
          <p className="text-gray-500">
            La página que estás buscando no existe o ha sido movida.
          </p>
        </div>
        
        <div className="space-y-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 bg-primary text-palette-dark rounded-lg hover:bg-primary-600 transition-colors"
          >
            <Home className="w-4 h-4 mr-2" />
            Volver al Dashboard
          </Link>
          
          <div className="text-sm text-gray-400">
            o usa la navegación del sidebar para encontrar lo que buscas
          </div>
        </div>
      </div>
    </div>
  );
}