
import React, { useState, Suspense, useEffect, useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Preload } from '@react-three/drei';
import { Badge } from '../types';
import Badge3D from './Badge3D';
import { PLAYER_CATEGORIES, COACH_CATEGORIES, MANAGER_CATEGORIES, BadgeItem } from '../data';
import { ChevronLeft, ChevronRight, Trophy, Loader2, Download, RotateCw, Sparkles, User, Briefcase, Award, Trash2 } from 'lucide-react';
import { findMatchingBadge, normalize } from '../utils/badgeMatching';

interface ViewerProps {
  badges: Badge[];
  onRefresh: () => Promise<void>;
  onRemove?: (id: string) => Promise<void>;
}

type TabType = 'zawodnik' | 'trener' | 'manager';

const Viewer: React.FC<ViewerProps> = ({ badges, onRefresh, onRemove }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [spinTrigger, setSpinTrigger] = useState(0);
  const [isLit, setIsLit] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('zawodnik');
  const [showTooltip, setShowTooltip] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Używamy wspólnej funkcji z utils/badgeMatching.ts dla synchronizacji z BadgeList

  // Typ dla itemu z ewentualną odznaką
  interface BadgeItemWithMatch {
    item: BadgeItem;
    badge: Badge | null;
    label: string;
  }

  // Filtrowanie wszystkich items z kategorii - pokazujemy wszystkie, także te bez odznak
  // UWAGA: Ta sama odznaka może pasować do wielu items (jak w BadgeList)
  const allItems = useMemo(() => {
    const currentCategories = 
      activeTab === 'zawodnik' ? PLAYER_CATEGORIES :
      activeTab === 'trener' ? COACH_CATEGORIES : 
      MANAGER_CATEGORIES;

    const items: BadgeItemWithMatch[] = [];

    // Przejdź przez wszystkie kategorie i pozycje w kolejności
    // Dodaj WSZYSTKIE items, także te bez dopasowanych odznak
    // Używamy tej samej logiki co BadgeList - każdy item który pasuje pokazuje odznakę
    currentCategories.forEach(category => {
      category.items.forEach(item => {
        const label = typeof item === 'string' ? item : item.label;
        const matchedBadge = findMatchingBadge(item, badges);
        
        items.push({
          item,
          badge: matchedBadge, // Używamy bezpośrednio matchedBadge, bez filtrowania po usedBadgeIds
          label
        });
      });
    });

    return items;
  }, [badges, activeTab]);
  
  // Liczba items z dopasowanymi odznakami (tak jak w BadgeList, dla spójności)
  const itemsWithBadges = useMemo(() => {
    const currentCategories = 
      activeTab === 'zawodnik' ? PLAYER_CATEGORIES :
      activeTab === 'trener' ? COACH_CATEGORIES : 
      MANAGER_CATEGORIES;
    
    let count = 0;
    currentCategories.forEach(cat => {
      cat.items.forEach(item => {
        if (findMatchingBadge(item, badges)) {
          count++;
        }
      });
    });
    return count;
  }, [badges, activeTab]);

  const lastBadgeId = useRef<string | null>(null);
  
  // Resetuj index gdy zmienia się tab
  useEffect(() => {
    setCurrentIndex(0);
    lastBadgeId.current = null;
  }, [activeTab]);
  
  // Ref do zapamiętania nazwy odznaki przed usunięciem (do znalezienia następnej o tej samej nazwie)
  const nextBadgeNameRef = useRef<string | null>(null);
  
  // Sprawdź czy aktualna pozycja nadal istnieje po zmianie badges
  useEffect(() => {
    // Jeśli nie ma żadnych items, zresetuj
    if (allItems.length === 0) {
      setCurrentIndex(0);
      lastBadgeId.current = null;
      nextBadgeNameRef.current = null;
      return;
    }
    
    // Jeśli mamy zapamiętaną nazwę następnej odznaki (po usunięciu), znajdź ją
    if (nextBadgeNameRef.current) {
      const nextItem = allItems.find(itemWithMatch => 
        itemWithMatch.badge && normalize(itemWithMatch.badge.name) === nextBadgeNameRef.current
      );
      
      if (nextItem) {
        const nextIndex = allItems.findIndex(item => 
          item.badge && item.badge.id === nextItem.badge?.id
        );
        if (nextIndex !== -1) {
          setCurrentIndex(nextIndex);
          nextBadgeNameRef.current = null; // Reset
          return;
        }
      } else {
        // Nie znaleziono odznaki o tej nazwie, zresetuj
        nextBadgeNameRef.current = null;
      }
    }
    
    // Sprawdź czy obecnie wyświetlana pozycja nadal istnieje
    const currentItemAtIndex = allItems[currentIndex];
    if (!currentItemAtIndex) {
      // Nie ma pozycji pod aktualnym indexem, przejdź do pierwszej dostępnej
      setCurrentIndex(0);
      lastBadgeId.current = null;
      return;
    }
    
    // Jeśli obecna pozycja ma odznakę, sprawdź czy ta odznaka nadal istnieje w badges
    if (currentItemAtIndex.badge) {
      const badgeStillExistsInAll = badges.some(b => b.id === currentItemAtIndex.badge?.id);
      if (!badgeStillExistsInAll) {
        // Aktualna odznaka została usunięta, ale pozycja zostaje (bez odznaki)
        lastBadgeId.current = null;
      }
    }
    
    // Jeśli obecny index jest poza zakresem, zresetuj do ostatniego dostępnego
    if (currentIndex >= allItems.length) {
      setCurrentIndex(Math.max(0, allItems.length - 1));
      lastBadgeId.current = null;
    }
  }, [badges, allItems, currentIndex]);
  
  const currentItem = allItems[currentIndex] || null;
  const currentBadge = currentItem?.badge || null;
  const hasBadge = currentItem?.badge !== null && currentItem?.badge !== undefined && currentItem?.badge.url && currentItem?.badge.url.trim().length > 0;
  const badgeUrl = hasBadge && currentItem?.badge?.url ? currentItem.badge.url : null;

  useEffect(() => {
    // Reset loader i światła gdy nie ma odznaki
    if (!currentBadge || !hasBadge) {
      setIsLoading(false);
      setIsLit(false);
      lastBadgeId.current = null;
      return;
    }

    const isNewBadge = currentBadge.id !== lastBadgeId.current;

    if (isNewBadge) {
      lastBadgeId.current = currentBadge.id;
      setIsLit(false); // Reset illumination on badge change
      setIsLoading(true); // Reset loading state on badge change
    }
  }, [currentBadge?.id, hasBadge]);

  if (allItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-blue-300 uppercase font-anton tracking-widest">
        Brak pozycji w wybranej kategorii
      </div>
    );
  }

  if (!currentItem) return (
    <div className="flex items-center justify-center h-full text-blue-300 uppercase font-anton tracking-widest">
       Brak pozycji
    </div>
  );

  // Separated Functions
  const handleSpin = () => {
    setSpinTrigger(s => s + 1);
  };

  const toggleLight = () => {
    setIsLit(prev => !prev);
  };

  const next = () => {
    setCurrentIndex((prev) => (prev + 1) % allItems.length);
  };
  
  const prev = () => {
    setCurrentIndex((prev) => (prev - 1 + allItems.length) % allItems.length);
  };

  const handleDownloadGLB = async () => {
    if (!currentBadge || !currentBadge.url) return;
    
    try {
      setIsDownloading(true);
      const response = await fetch(currentBadge.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentBadge.name}.glb`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Błąd pobierania:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRemove = async () => {
    if (!onRemove || !currentItem?.badge) return;
    
    // Zapamiętaj nazwę aktualnej odznaki (znormalizowaną) do znalezienia następnej
    const currentBadgeNormalizedName = normalize(currentItem.badge.name);
    const currentBadgeId = currentItem.badge.id;
    
    // Zapisz nazwę do ref, aby useEffect mógł znaleźć następną odznakę o tej samej nazwie
    nextBadgeNameRef.current = currentBadgeNormalizedName;
    
    try {
      // Usuń aktualną odznakę (to zaktualizuje badges w App.tsx)
      await onRemove(currentBadgeId);
      // useEffect automatycznie znajdzie następną odznakę o tej samej nazwie
    } catch (error) {
      console.error("Błąd usuwania odznaki:", error);
      nextBadgeNameRef.current = null; // Reset w przypadku błędu
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row items-stretch gap-6 h-[75vh]">
      <div className="relative flex-[3] bg-black rounded-[40px] border border-white/10 overflow-hidden shadow-2xl group/viewer">
        {/* Loader overlay - pokazuj tylko gdy jest odznaka */}
        {isLoading && hasBadge && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
              <span className="text-blue-300 font-anton uppercase tracking-widest text-sm">Ładowanie odznaki...</span>
            </div>
          </div>
        )}
        {hasBadge && badgeUrl ? (
          <Canvas 
            camera={{ position: [0, 0, 4], fov: 45 }} 
            dpr={[1, 2]} 
            shadows
            gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
            onPointerMissed={() => setIsLit(false)}
          >
            <Suspense fallback={null}>
              <Badge3D 
                key={currentBadge.id}
                url={badgeUrl} 
                spinTrigger={spinTrigger} 
                zoomLevel={Number(currentBadge.zoom_level ?? 0)} 
                isLit={isLit}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setIsLit(true);
                  handleSpin();
                }}
                onLoadComplete={() => setIsLoading(false)}
              />
              <Preload all />
            </Suspense>
          </Canvas>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black/20">
            <div className="flex flex-col items-center gap-4 px-8 text-center">
              <div className="w-24 h-24 rounded-full bg-red-500/10 border-4 border-red-500/20 flex items-center justify-center">
                <Trophy className="w-12 h-12 text-red-400/50" />
              </div>
              <div className="space-y-2">
                <p className="text-red-400 font-anton uppercase tracking-widest text-lg">Brak odznaki w bazie</p>
                <p className="text-gray-400 text-sm font-medium">Ta odznaka nie została jeszcze dodana do systemu</p>
              </div>
            </div>
          </div>
        )}

        <div className="absolute inset-y-0 left-0 flex items-center px-6 pointer-events-none">
          <button onClick={prev} className="pointer-events-auto p-4 bg-black/40 hover:bg-white text-white hover:text-black rounded-full border border-white/10 backdrop-blur-md transition-all shadow-xl active:scale-90">
            <ChevronLeft className="w-8 h-8" />
          </button>
        </div>
        <div className="absolute inset-y-0 right-0 flex items-center px-6 pointer-events-none">
          <button onClick={next} className="pointer-events-auto p-4 bg-black/40 hover:bg-white text-white hover:text-black rounded-full border border-white/10 backdrop-blur-md transition-all shadow-xl active:scale-90">
            <ChevronRight className="w-8 h-8" />
          </button>
        </div>
      </div>

      <div className="w-full md:w-[320px] flex flex-col py-4 px-2 h-full">
        {/* Górna sekcja - stała wysokość */}
        <div className="flex-shrink-0 space-y-8 relative">
          <div className="animate-in fade-in slide-in-from-left-4 duration-500 min-h-[180px] max-h-[180px] flex flex-col justify-start relative overflow-visible pt-2">
            <span className="px-4 py-1.5 bg-blue-500/10 backdrop-blur-md text-blue-300 border border-blue-400/20 font-black text-[9px] rounded-full uppercase tracking-[0.3em] mb-4 inline-block relative z-10">
              FOOTBALL ACADEMY
            </span>
            <div 
              className="relative z-10 flex-1 flex flex-col overflow-visible"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <h1 
                className="text-2xl md:text-3xl font-anton uppercase text-white leading-tight tracking-wide drop-shadow-2xl cursor-pointer relative"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: '1.25'
                }}
              >
                {currentItem.label}
              </h1>
              {/* Tooltip z pełną nazwą - pokazuje się po najechaniu, powyżej nazwy, nie nachodzi na guziki */}
              {showTooltip && (
                <div 
                  className="absolute bottom-full left-0 right-0 px-4 py-3 bg-black/95 text-white text-base font-anton uppercase tracking-wide rounded-xl whitespace-normal break-words shadow-2xl border border-white/20 backdrop-blur-md z-[10000] mb-2" 
                  style={{
                    maxHeight: '120px',
                    overflowY: 'auto'
                  }}
                >
                  {currentItem.label}
                  {/* Strzałka tooltipa wskazująca w dół */}
                  <div className="absolute top-full left-6 w-0 h-0 border-l-6 border-r-6 border-t-6 border-transparent border-t-black/95"></div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 flex-shrink-0 mt-4">
            <button 
              onClick={handleSpin} 
              disabled={!hasBadge}
              className="py-5 rounded-2xl font-anton text-[11px] uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl flex flex-col items-center justify-center gap-2 bg-blue-800/20 text-white border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <RotateCw className="w-5 h-5" /> 
              <span>OBRÓĆ</span>
            </button>

            <button 
              onClick={toggleLight} 
              disabled={!hasBadge}
              className={`py-5 rounded-2xl font-anton text-[11px] uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl flex flex-col items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed
                ${isLit ? 'bg-white text-blue-900' : 'bg-blue-800/20 text-white border border-white/10 hover:bg-white/5'}
              `}
            >
              <Sparkles className="w-5 h-5" /> 
              <span>{isLit ? 'ŚWIATŁO' : 'ODBLOKUJ'}</span>
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3 flex-shrink-0">
            <button 
              onClick={handleDownloadGLB} 
              disabled={isDownloading || !hasBadge} 
              className="py-5 bg-blue-800/20 text-white border border-white/10 rounded-2xl font-anton text-[11px] uppercase tracking-[0.2em] hover:bg-white hover:text-blue-900 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 gap-2"
            >
              {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 
              POBIERZ
            </button>
            
            {onRemove && hasBadge && (
              <button 
                onClick={handleRemove} 
                className="py-5 bg-red-800/20 text-white border border-red-400/20 rounded-2xl font-anton text-[11px] uppercase tracking-[0.2em] hover:bg-red-600 hover:text-white transition-all active:scale-95 flex items-center justify-center flex-shrink-0 gap-2"
              >
                <Trash2 className="w-4 h-4" /> 
                USUŃ
              </button>
            )}
            {!hasBadge && (
              <div className="py-5 bg-gray-800/20 text-gray-500 border border-gray-500/20 rounded-2xl font-anton text-[11px] uppercase tracking-[0.2em] flex items-center justify-center flex-shrink-0 gap-2 opacity-50">
                <Trophy className="w-4 h-4" /> 
                BRAK
              </div>
            )}
          </div>
        </div>

        {/* Dolna sekcja - przyklejona do dołu */}
        <div className="mt-auto pt-8 border-t border-white/10 space-y-4 flex-shrink-0">
          {/* Tabs */}
          <div className="flex p-1 bg-black/40 rounded-xl border border-white/10">
            {[
              { id: 'zawodnik' as TabType, label: 'Zawodnik', icon: User },
              { id: 'trener' as TabType, label: 'Trener', icon: Briefcase },
              { id: 'manager' as TabType, label: 'Manager', icon: Award }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-bold uppercase text-[9px] tracking-widest transition-all ${
                  activeTab === tab.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-3 h-3" /> {tab.label}
              </button>
            ))}
          </div>

          {/* Kolekcja info - pokazujemy wszystkie items z kategorii */}
          <div className="flex items-center justify-between text-blue-400 font-bold uppercase tracking-[0.4em] text-[10px]">
             <span className="flex items-center gap-2"><Trophy className="w-3 h-3" /> KOLEKCJA {currentIndex + 1} / {allItems.length}</span>
          </div>
          <div className="flex gap-1.5">
            {allItems.map((item, idx) => (
              <div 
                key={idx} 
                className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'flex-1 bg-white' : 'w-2 '} ${item.badge ? 'bg-white/10' : 'bg-red-500/30'}`} 
                title={item.badge ? item.label : `${item.label} - brak odznaki`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Viewer;
