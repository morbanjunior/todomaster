'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [tab, setTab] = useState<'login' | 'register'>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleLogin = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            if (res.ok) {
                router.push('/dashboard');
            } else {
                const d = await res.json();
                setError(d.detail ?? 'Credenciales incorrectas.');
            }
        } catch {
            setError('No se pudo conectar al servicio de autenticación.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });
            if (res.ok) {
                setSuccess('Cuenta creada. Ahora inicia sesión.');
                setTab('login');
                setName('');
                setPassword('');
            } else {
                const d = await res.json();
                setError(d.detail ?? 'Error en el registro.');
            }
        } catch {
            setError('No se pudo conectar al servicio de autenticación.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-linear-to-br from-gray-900 via-slate-900 to-black text-white font-sans flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-emerald-400 text-center mb-2">
                    Microservices Command Center
                </h1>
                <p className="text-center text-slate-500 text-sm mb-8">
                    auth-service &rarr; user-service &rarr; task-service
                </p>

                {error && (
                    <div className="mb-4 p-4 rounded-lg border bg-red-900/30 border-red-500 text-red-300 font-medium">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-4 p-4 rounded-lg border bg-emerald-900/30 border-emerald-500 text-emerald-300 font-medium">
                        {success}
                    </div>
                )}

                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 shadow-xl">
                    <div className="flex border-b border-slate-700 mb-6">
                        <button onClick={() => setTab('login')}
                            className={`flex-1 py-3 font-semibold transition-colors border-b-2 ${tab === 'login' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                            Iniciar Sesión
                        </button>
                        <button onClick={() => setTab('register')}
                            className={`flex-1 py-3 font-semibold transition-colors border-b-2 ${tab === 'register' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                            Registrarse
                        </button>
                    </div>

                    {tab === 'login' ? (
                        <form onSubmit={handleLogin} className="space-y-4">
                            <input type="email" placeholder="Correo electrónico" required value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-600 focus:border-blue-500 text-white rounded-lg p-3 outline-none" />
                            <input type="password" placeholder="Contraseña" required value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-600 focus:border-blue-500 text-white rounded-lg p-3 outline-none" />
                            <button type="submit" disabled={loading}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors">
                                {loading ? 'Verificando...' : 'Entrar'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleRegister} className="space-y-4">
                            <input type="text" placeholder="Nombre completo" required value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-600 focus:border-emerald-500 text-white rounded-lg p-3 outline-none" />
                            <input type="email" placeholder="Correo electrónico" required value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-600 focus:border-emerald-500 text-white rounded-lg p-3 outline-none" />
                            <input type="password" placeholder="Contraseña" required value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-600 focus:border-emerald-500 text-white rounded-lg p-3 outline-none" />
                            <button type="submit" disabled={loading}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors">
                                {loading ? 'Registrando...' : 'Crear cuenta'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </main>
    );
}
