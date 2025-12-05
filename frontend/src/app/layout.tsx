import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ChatWidgetWrapper } from '@/components/chat';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Axioma - Parse',
  description: 'Sistema de extracción de información de documentos digitales',
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <ChatWidgetWrapper />
        </AuthProvider>
      </body>
    </html>
  );
}