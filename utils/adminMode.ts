/**
 * Tryb admina — ukryta nakładka pozwalająca edytować kolory odznak.
 *
 * **Tylko lokalnie:** w buildzie produkcyjnym (`vite build`) wejście `/admin1`
 * i cała edycja są wyłączone (`import.meta.env.DEV === false`), żeby na produkcji
 * nie było tej powierzchni w ogóle.
 *
 * Aktywacja wymaga PIN-u z `process.env.ADMIN_PIN` (Vite + `.env.local`) lub
 * fallbacku poniżej — ale tylko gdy `isAdminEditingEnabled()` jest prawdą.
 *
 * Stan w localStorage: `fa_admin_mode`. Zmiany emitują `fa-admin-mode-change`.
 */

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'fa_admin_mode';
const EVENT_NAME = 'fa-admin-mode-change';
const FALLBACK_PIN = 'fa-admin-2026';

/** Ścieżka URL aktywacji edycji (bez linku w UI — trzeba znać adres). */
export const ADMIN_ENTRY_PATH = '/admin1';

export const normalizeAdminPathname = (pathname: string): string => {
  const p = pathname || '/';
  if (p !== '/' && p.endsWith('/')) return p.replace(/\/+$/, '') || '/';
  return p;
};

export const isAdminEntryPath = (pathname: string): boolean =>
  normalizeAdminPathname(pathname) === ADMIN_ENTRY_PATH;

/** `true` tylko przy `vite` / `npm run dev` — w produkcji zawsze `false`. */
export const isAdminEditingEnabled = (): boolean => import.meta.env.DEV;

const getConfiguredPin = (): string => {
  if (typeof process !== 'undefined' && process.env && process.env.ADMIN_PIN) {
    return String(process.env.ADMIN_PIN);
  }
  return FALLBACK_PIN;
};

const dispatchChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }
};

export const isAdminMode = (): boolean => {
  if (!isAdminEditingEnabled()) return false;
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const enableAdminMode = (pin: string): boolean => {
  if (!isAdminEditingEnabled()) return false;
  const expected = getConfiguredPin();
  if (!pin || pin.trim() !== expected) {
    return false;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, 'true');
    dispatchChange();
    return true;
  } catch {
    return false;
  }
};

export const disableAdminMode = (): void => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    dispatchChange();
  } catch {
    // ignore
  }
};

export const useAdminMode = (): boolean => {
  const [adminMode, setAdminMode] = useState<boolean>(() => isAdminMode());

  useEffect(() => {
    const handler = () => setAdminMode(isAdminMode());
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  return adminMode;
};
