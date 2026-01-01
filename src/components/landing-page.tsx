"use client";

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Factory, FlaskConical, Leaf } from 'lucide-react';

export function LandingPage() {
    return (
        <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background">
            {/* Background Image with Overlay */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/images/engineer-bg.png"
                    alt="Ingénieur Laboratoire AFR"
                    className="object-cover w-full h-full opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
                <div className="absolute inset-0 bg-black/40" />
            </div>

            {/* Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-full z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[20%] left-[10%] w-64 h-64 bg-primary/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-[20%] right-[10%] w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />
            </div>

            {/* Logo Brand */}
            <div className="absolute top-6 left-6 z-20 animate-fade-in">
                <div className="bg-white/95 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl shadow-black/20 hover:scale-105 transition-transform duration-300">
                    <img
                        src="/images/logo-asment.png"
                        alt="Asment Temara"
                        className="h-12 w-auto object-contain"
                    />
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 container mx-auto px-4 flex flex-col items-center text-center space-y-8">

                {/* Animated Badge */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel bg-primary/10 border-primary/20 text-primary text-sm font-medium backdrop-blur-md"
                >
                    <Leaf className="w-4 h-4" />
                    <span>Surveillance Environnementale & Énergétique</span>
                </motion.div>

                {/* Hero Title */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="max-w-4xl space-y-4"
                >
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-tight">
                        Le futur des <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                            Combustibles Alternatifs
                        </span>
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto font-light leading-relaxed">
                        Plateforme avancée de suivi, d'analyse et d'optimisation des performances énergétiques pour l'industrie du ciment.
                    </p>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.8 }}
                    className="flex flex-col sm:flex-row items-center gap-6 mt-8"
                >
                    <Link href="/login">
                        <Button size="lg" className="h-14 px-8 text-lg bg-primary hover:bg-emerald-600 rounded-full shadow-lg shadow-emerald-900/20 transition-all hover:scale-105 group">
                            Accéder au Laboratoire
                            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </Link>

                    <Link href="/documentation" className="hidden sm:block">
                        <Button variant="ghost" size="lg" className="h-14 px-8 text-lg text-gray-300 hover:text-white hover:bg-white/5 rounded-full backdrop-blur-sm transition-all border border-transparent hover:border-white/10">
                            Documentation
                        </Button>
                    </Link>
                </motion.div>

                {/* Features Grid */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 1.2 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 w-full max-w-5xl"
                >
                    {[
                        { icon: FlaskConical, title: "Analyses Précises", desc: "Suivi rigoureux des paramètres chimiques et calorifiques." },
                        { icon: Factory, title: "Optimisation Industrielle", desc: "Maximisation du taux de substitution et réduction des coûts." },
                        { icon: Leaf, title: "Impact Carbone", desc: "Réduction significative de l'empreinte environnementale." }
                    ].map((feature, i) => (
                        <div key={i} className="glass-panel p-6 rounded-2xl border border-white/5 bg-black/20 backdrop-blur-sm hover:bg-white/5 transition-all duration-300 group">
                            <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <feature.icon className="w-6 h-6 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                            <p className="text-sm text-gray-400">{feature.desc}</p>
                        </div>
                    ))}
                </motion.div>

            </div>

            {/* Footer */}
            <div className="absolute bottom-6 text-gray-500 text-sm">
                © 2025 FuelTrack AFR - Système de Management Énergétique
            </div>
        </div>
    );
}
