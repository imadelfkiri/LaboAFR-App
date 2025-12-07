import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import { MainLayout } from "@/components/layout/main-layout";
import { AuthProvider } from "@/context/auth-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FuelTrack AFR",
  description: "Suivi des combustibles AFR dans une cimenterie",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${inter.className} dark`}>
      <body className="antialiased bg-background text-foreground">
        <AuthProvider>
          <MainLayout>{children}</MainLayout>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
