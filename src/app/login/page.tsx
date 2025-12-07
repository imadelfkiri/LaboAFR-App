"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Fuel, Lock } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/'); // Redirection vers la page principale
    } catch (err) {
      setError("Email ou mot de passe incorrect. Veuillez réessayer.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-900 dark:to-slate-950">
      <Card className="w-full max-w-md mx-4 text-center rounded-2xl shadow-lg border-brand-line/30">
        <CardHeader className="p-8">
            <div className="flex justify-center mb-4">
                <div className='flex h-14 w-14 items-center justify-center rounded-full bg-primary/10'>
                    <Fuel className="h-8 w-8 text-primary" />
                </div>
            </div>
          <CardTitle className="text-2xl font-bold text-foreground">Connexion sécurisée</CardTitle>
          <CardDescription>Connectez-vous avec votre compte autorisé pour accéder au LaboAFR</CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-0">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2 text-left">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="votreadresse@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md text-center">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? 'Connexion en cours...' : 'Se connecter'}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-6">
            <Lock className="inline-block h-3 w-3 mr-1" />
            Accès réservé aux utilisateurs autorisés
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
