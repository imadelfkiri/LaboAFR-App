
"use client";

import type {Metadata} from 'next';
import { Toaster } from "@/components/ui/toaster"
import './globals.css';
import { MainLayout } from '@/components/layout/main-layout';

// This is a client component, so metadata should be exported from page.tsx files if needed statically.
// export const metadata: Metadata = {
//   title: 'FuelTrack AFR',
//   description: 'Suivi des combustibles AFR dans une cimenterie',
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="fr">
      <head>
        <title>FuelTrack AFR</title>
        <meta name="description" content="Suivi des combustibles AFR dans une cimenterie" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"></link>
      </head>
      <body className="antialiased">
        <MainLayout>{children}</MainLayout>
        <Toaster />
      </body>
    </html>
  );
}
