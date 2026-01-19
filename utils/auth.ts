/**
 * Moduł autoryzacji - proste logowanie z jednym kontem
 * 
 * Dane logowania dla klienta:
 * Login: admin
 * Hasło: football2024
 */

const AUTH_STORAGE_KEY = 'fa_dashboard_auth';
const VALID_USERNAME = 'admin';
const VALID_PASSWORD = 'football2024';

/**
 * Próbuje zalogować użytkownika z podanymi danymi
 * @param username - nazwa użytkownika
 * @param password - hasło
 * @returns true jeśli logowanie się powiodło, false w przeciwnym razie
 */
export function login(username: string, password: string): boolean {
  if (username === VALID_USERNAME && password === VALID_PASSWORD) {
    localStorage.setItem(AUTH_STORAGE_KEY, 'true');
    return true;
  }
  return false;
}

/**
 * Wylogowuje użytkownika (usuwa sesję z localStorage)
 */
export function logout(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

/**
 * Sprawdza czy użytkownik jest zalogowany
 * @returns true jeśli użytkownik jest zalogowany, false w przeciwnym razie
 */
export function isAuthenticated(): boolean {
  return localStorage.getItem(AUTH_STORAGE_KEY) === 'true';
}
