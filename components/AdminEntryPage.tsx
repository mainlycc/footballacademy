import React, { useState, FormEvent } from 'react';
import { Lock, AlertCircle } from 'lucide-react';
import { enableAdminMode } from '../utils/adminMode';

interface AdminEntryPageProps {
  onLeave: () => void;
}

/**
 * Wejście ukryte pod stałą ścieżką (patrz `ADMIN_ENTRY_PATH` w `utils/adminMode.ts`).
 * Nie ma linku w UI — adres trzeba znać z góry.
 */
const AdminEntryPage: React.FC<AdminEntryPageProps> = ({ onLeave }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const ok = enableAdminMode(pin);
    if (ok) {
      onLeave();
    } else {
      setError('Nieprawidłowy PIN');
      setPin('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-950 to-black p-6">
      <div className="max-w-sm w-full bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-[32px] shadow-2xl space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
            <Lock className="w-8 h-8 text-blue-300" />
          </div>
          <h2 className="text-xl font-anton uppercase tracking-widest text-white leading-tight">
            Dostęp techniczny
          </h2>
          <p className="text-blue-200/80 text-xs leading-relaxed">
            Wpisz PIN, aby włączyć lokalną edycję kolorów modeli. To ustawienie jest widoczne tylko w tej przeglądarce.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError('');
            }}
            autoFocus
            placeholder="PIN"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/40 transition-all text-center font-mono tracking-[0.3em]"
          />

          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full px-6 py-3 bg-white text-blue-900 rounded-xl font-anton text-sm uppercase tracking-widest shadow-xl hover:bg-blue-50 active:scale-[0.98] transition-all"
          >
            Kontynuuj
          </button>
        </form>

        <button
          type="button"
          onClick={onLeave}
          className="w-full text-center text-blue-300/70 hover:text-blue-200 text-[10px] font-bold uppercase tracking-widest py-2"
        >
          Wróć do aplikacji
        </button>
      </div>
    </div>
  );
};

export default AdminEntryPage;
