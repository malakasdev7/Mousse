import type { Metadata } from 'next';
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { PwaRegister } from './pwa-register';

const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
});
const fraunces = Fraunces({ variable: '--font-fraunces', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: 'Doce Margem — Precificação inteligente',
  description:
    'Gestão de custos, receitas e preços para uma operação artesanal mais lucrativa.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Doce Margem',
  },
  openGraph: {
    title: 'Doce Margem — Precificação inteligente',
    description:
      'Gestão de custos, receitas e preços para uma operação artesanal mais lucrativa.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Doce Margem' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Doce Margem — Precificação inteligente',
    description:
      'Gestão de custos, receitas e preços para uma operação artesanal mais lucrativa.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${jakarta.variable} ${fraunces.variable}`}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
