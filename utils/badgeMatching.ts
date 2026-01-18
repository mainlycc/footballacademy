import { Badge } from '../types';
import { BadgeItem } from '../data';

// Funkcja normalizująca (używana w BadgeList i Viewer)
export const normalize = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/\.glb$/, '') // Usuń rozszerzenie
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Usuń polskie znaki (ą -> a)
    .replace(/ł/g, 'l') // Ręczna poprawka dla 'ł', czasem NFD tego nie łapie w niektórych przeglądarkach
    .replace(/[^a-z0-9\s]/g, ' ') // Zamień znaki specjalne na spację (zachowaj cyfry i litery)
    .replace(/\s+/g, ' ') // Zredukuj podwójne spacje
    .trim();
};

// Funkcja dopasowania odznaki (używana w BadgeList i Viewer)
export const findMatchingBadge = (item: BadgeItem, allBadges: Badge[]): Badge | null => {
  const label = typeof item === 'string' ? item : item.label;
  const badgeName = typeof item === 'object' ? item.badge : null;

  // A. Normalizacja nazwy z listy (pełna)
  const normalizedLabel = normalize(label);
  
  // B. Normalizacja nazwy z listy (bez zawartości nawiasów, np. usuwa "(Owen)")
  // To kluczowe dla zadań typu "Zwód 2 (Owen)" vs plik "Zwód 2.glb"
  const labelNoParens = label.replace(/\s*\(.*?\)\s*/g, ''); 
  const normalizedLabelNoParens = normalize(labelNoParens);

  const normalizedBadgeName = badgeName ? normalize(badgeName) : null;

  return allBadges.find(uploadedBadge => {
    const uploadedName = normalize(uploadedBadge.name);

    // 1. Sprawdź czy nazwa pliku pasuje do "Odznaki" (jeśli zdefiniowana)
    if (normalizedBadgeName && uploadedName === normalizedBadgeName) return true;
    if (normalizedBadgeName && uploadedName.includes(normalizedBadgeName)) return true;

    // 2. Sprawdź dokładne dopasowanie do nazwy zadania
    if (uploadedName === normalizedLabel) return true;

    // 3. Sprawdź dopasowanie do nazwy bez nawiasów
    if (uploadedName === normalizedLabelNoParens) return true;

    // 4. Luźniejsze dopasowanie (zawieranie się nazw)
    // Jeśli nazwa pliku jest długa (>4 znaki) i zawiera się w zadaniu (lub odwrotnie)
    if (uploadedName.length > 4 && normalizedLabel.includes(uploadedName)) return true;
    if (uploadedName.length > 4 && normalizedLabelNoParens.includes(uploadedName)) return true;
    
    // Odwrotnie: Jeśli zadanie (bez nawiasów) zawiera się w nazwie pliku
    if (normalizedLabelNoParens.length > 4 && uploadedName.includes(normalizedLabelNoParens)) return true;

    return false;
  }) || null;
};
