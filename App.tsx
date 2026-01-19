
import React, { useState, useEffect } from 'react';
import { ViewMode, Badge } from './types';
import Uploader from './components/Uploader';
import Viewer from './components/Viewer';
import BadgeList from './components/BadgeList';
import Login from './components/Login';
import { LayoutDashboard, ShieldCheck, ListChecks, Loader2, Cloud, AlertCircle, Database, LogOut } from 'lucide-react';
import { getBadgesFromSupabase, uploadBadgeToSupabase, deleteBadgeFromSupabase, isSupabaseConfigured } from './db';
import { isAuthenticated, logout } from './utils/auth';

const App: React.FC = () => {
  const [isAuthenticatedState, setIsAuthenticatedState] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('viewer');
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshBadges = async () => {
    try {
      const loadedBadges = await getBadgesFromSupabase();
      setBadges(loadedBadges);
    } catch (err) {
      console.error("Błąd ładowania z Supabase:", err);
    }
  };

  useEffect(() => {
    // Sprawdź autoryzację przy starcie
    setIsAuthenticatedState(isAuthenticated());
  }, []);

  useEffect(() => {
    // Ładuj dane tylko jeśli użytkownik jest zalogowany
    if (!isAuthenticatedState) {
      setIsLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    const init = async () => {
      await refreshBadges();
      setIsLoading(false);
    };
    init();
  }, [isAuthenticatedState]);

  const handleUpload = async (newBadges: any[]) => {
    setIsLoading(true);
    await refreshBadges();
    setIsLoading(false);
  };

  const handleSupabaseUpload = async (file: File, name: string) => {
    try {
      await uploadBadgeToSupabase(file, name);
      await refreshBadges();
    } catch (err) {
      alert("Błąd podczas wgrywania pliku do chmury.");
      console.error(err);
    }
  };

  const handleRemove = async (id: string) => {
    const badgeToDelete = badges.find(b => b.id === id);
    if (!badgeToDelete) return;

    try {
      await deleteBadgeFromSupabase(id, (badgeToDelete as any).file_path);
      // Aktualizuj lokalny stan
      setBadges(prev => prev.filter(b => b.id !== id));
      // Dodatkowo odśwież z bazy, aby upewnić się że wszystko jest zsynchronizowane
      await refreshBadges();
    } catch (err) {
      console.error("Błąd usuwania z Supabase:", err);
      // W przypadku błędu, również odśwież listę
      await refreshBadges();
    }
  };

  const handleReorder = (newOrder: Badge[]) => {
    setBadges(newOrder);
  };

  const handleLoginSuccess = () => {
    setIsAuthenticatedState(true);
  };

  const handleLogout = () => {
    logout();
    setIsAuthenticatedState(false);
    setViewMode('viewer');
  };

  // Jeśli użytkownik nie jest zalogowany, pokaż panel logowania
  if (!isAuthenticatedState) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-950 p-6">
        <div className="max-w-md w-full bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-[40px] shadow-2xl text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-blue-400/10 rounded-3xl flex items-center justify-center">
            <Database className="w-10 h-10 text-blue-400" />
          </div>
          <h2 className="text-3xl font-anton uppercase tracking-widest text-white leading-tight">Wymagana Konfiguracja</h2>
          <div className="space-y-4 text-blue-200 text-sm leading-relaxed">
            <p>Aplikacja wymaga połączenia z <strong>Supabase</strong>, aby przechowywać odznaki 3D.</p>
            <p className="bg-black/20 p-4 rounded-2xl border border-white/5 text-[11px] font-mono text-left">
              Skonfiguruj zmienne środowiskowe:<br/>
              <span className="text-blue-400">SUPABASE_URL</span><br/>
              <span className="text-blue-400">SUPABASE_ANON_KEY</span>
            </p>
          </div>
          <div className="flex items-center gap-2 justify-center text-blue-400 text-[10px] font-bold uppercase tracking-widest">
            <AlertCircle className="w-3 h-3" /> Status: Brak połączenia
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-white animate-spin" />
          <p className="font-anton tracking-widest uppercase text-blue-200">Synchronizacja z chmurą...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-900 via-blue-950 to-black text-white selection:bg-white selection:text-blue-900 overflow-hidden">
      <nav className="shrink-0 z-50 bg-blue-950/90 backdrop-blur-xl border-b border-white/10 px-6 py-2 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <div className="relative w-10 h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center p-1 shadow-[0_0_20px_rgba(255,255,255,0.15)] overflow-hidden">
              <img 
                src="https://www.footballacademy.pl/img/logos/fa.png" 
                alt="Football Academy Logo" 
                className="w-full h-full object-contain"
                onError={(e) => {
                   e.currentTarget.src = "https://www.footballacademy.pl/img/logo.png";
                }}
              />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-anton tracking-widest uppercase leading-none">FOOTBALL ACADEMY</h1>
              <p className="text-[8px] font-bold uppercase tracking-[0.4em] text-blue-300 mt-0.5 flex items-center gap-1">
                <Cloud className="w-2 h-2" /> SYSTEM
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white/5 p-0.5 rounded-xl border border-white/10 overflow-x-auto max-w-full">
              <button onClick={() => setViewMode('viewer')} className={`flex items-center gap-2 px-3 md:px-5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${viewMode === 'viewer' ? 'bg-white text-blue-900 shadow-xl' : 'text-blue-100 hover:bg-white/5'}`}>
                <LayoutDashboard className="w-3 h-3" /><span>Przegląd</span>
              </button>
              <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-3 md:px-5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${viewMode === 'list' ? 'bg-white text-blue-900 shadow-xl' : 'text-blue-100 hover:bg-white/5'}`}>
                <ListChecks className="w-3 h-3" /><span>Lista</span>
              </button>
              <button onClick={() => setViewMode('uploader')} className={`flex items-center gap-2 px-3 md:px-5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${viewMode === 'uploader' ? 'bg-white text-blue-900 shadow-xl' : 'text-blue-100 hover:bg-white/5'}`}>
                <ShieldCheck className="w-3 h-3" /><span>Zarządzaj</span>
              </button>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap text-blue-100 hover:bg-white/10 border border-white/10 hover:border-white/20"
              title="Wyloguj się"
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden md:inline">Wyloguj</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 container mx-auto py-4 px-4 overflow-y-auto">
        <div className="h-full flex flex-col justify-center">
          {viewMode === 'viewer' ? (
            <Viewer badges={badges} onRefresh={refreshBadges} onRemove={handleRemove} />
          ) : viewMode === 'list' ? (
            <BadgeList badges={badges} />
          ) : (
            <Uploader 
              badges={badges} 
              onUpload={handleUpload} 
              onRemove={handleRemove}
              onReorder={handleReorder}
              onSupabaseUpload={handleSupabaseUpload}
            />
          )}
        </div>
      </main>

      <footer className="shrink-0 py-4 border-t border-white/5 opacity-50">
        <div className="container mx-auto px-4 text-center">
          <p className="text-blue-400 text-[9px] font-bold tracking-[0.4em] uppercase">
            &copy; {new Date().getFullYear()} Football Academy
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
