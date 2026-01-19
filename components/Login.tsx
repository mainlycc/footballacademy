import React, { useState, FormEvent } from 'react';
import { LogIn, Lock, User, AlertCircle } from 'lucide-react';
import { login } from '../utils/auth';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Symulacja małego opóźnienia dla lepszego UX
    await new Promise(resolve => setTimeout(resolve, 300));

    const success = login(username.trim(), password);
    
    if (success) {
      onLoginSuccess();
    } else {
      setError('Nieprawidłowa nazwa użytkownika lub hasło');
      setPassword('');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-950 to-black p-6">
      <div className="max-w-md w-full bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-[40px] shadow-2xl space-y-6">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-blue-400/10 rounded-3xl flex items-center justify-center">
            <Lock className="w-10 h-10 text-blue-400" />
          </div>
          <h2 className="text-3xl font-anton uppercase tracking-widest text-white leading-tight">
            Logowanie
          </h2>
          <p className="text-blue-200 text-sm">
            Wprowadź dane dostępowe, aby kontynuować
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="username" className="block text-blue-200 text-xs font-bold uppercase tracking-widest">
              Nazwa użytkownika
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <User className="w-5 h-5 text-blue-400" />
              </div>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all"
                placeholder="Wprowadź nazwę użytkownika"
                autoComplete="username"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-blue-200 text-xs font-bold uppercase tracking-widest">
              Hasło
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Lock className="w-5 h-5 text-blue-400" />
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all"
                placeholder="Wprowadź hasło"
                autoComplete="current-password"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white text-blue-900 rounded-xl font-anton text-sm uppercase tracking-widest shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
                <span>Logowanie...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Zaloguj się</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-white/5">
          <p className="text-center text-blue-400/60 text-[10px] font-bold uppercase tracking-widest">
            Football Academy Dashboard
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
