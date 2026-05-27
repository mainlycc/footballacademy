
import React, { useState, Suspense, useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { Preload, useGLTF } from '@react-three/drei';
import { Badge } from '../types';
import Badge3D from './Badge3D';
import BadgeColorPanel from './BadgeColorPanel';
import AdminLightingPanel from './AdminLightingPanel';
import AdminMeshLayoutPanel from './AdminMeshLayoutPanel';
import LayoutMarqueeBridge, { type LayoutMarqueeBridgeHandle } from './LayoutMarqueeBridge';
import LayoutMarqueeOverlay from './LayoutMarqueeOverlay';
import { BadgeItem } from '../data';
import { ChevronLeft, ChevronRight, Trophy, Loader2, Download, RotateCw, Sparkles, User, Briefcase, Award, Trash2, Image, FileCode, Palette, Sun, LayoutGrid } from 'lucide-react';
import { findMatchingBadge, normalize } from '../utils/badgeMatching';
import { useAdminMode, disableAdminMode } from '../utils/adminMode';
import { useBadgeLightingConfig } from '../utils/badgeLightingConfig';
import { useCatalogOverrides } from '../hooks/useCatalogOverrides';
import {
  CatalogTab,
  getCatalogItemKey,
  getCategoriesForTab,
  getEffectiveItem,
} from '../utils/catalogOverrides';
import { loadViewerPosition, saveViewerPosition } from '../utils/viewerPosition';
import {
  getCatalogMatchingItem,
  usesExactCatalogMatching,
} from '../utils/catalogDisambiguation';

type TextureDragApi = {
  /** Czy panel ma aktywną grupę do przeciągania. */
  isEnabled: () => boolean;
  onPointerDown: (e: any) => void;
  onPointerMove: (e: any) => void;
  onPointerUp: (e: any) => void;
  onPointerLeave: (e: any) => void;
};

interface ViewerProps {
  badges: Badge[];
  onRefresh: () => Promise<void>;
  onRemove?: (id: string) => Promise<void>;
}

type TabType = CatalogTab;
type AdminPanelTab = 'kolory' | 'swiatlo' | 'uklad';

// Komponent wewnętrzny do przechwycenia renderera z Canvas
const CanvasCapture: React.FC<{ 
  onCaptureReady: (captureFn: (badgeName: string) => void) => void;
  onSVGCaptureReady: (captureFn: (badgeName: string) => void) => void;
}> = ({ onCaptureReady, onSVGCaptureReady }) => {
  const { gl } = useThree();
  const onCaptureReadyRef = useRef(onCaptureReady);
  const onSVGCaptureReadyRef = useRef(onSVGCaptureReady);
  
  // Aktualizuj ref przy każdej zmianie callback
  useEffect(() => {
    onCaptureReadyRef.current = onCaptureReady;
  }, [onCaptureReady]);
  
  useEffect(() => {
    onSVGCaptureReadyRef.current = onSVGCaptureReady;
  }, [onSVGCaptureReady]);
  
  useEffect(() => {
    const capture = (badgeName: string) => {
      const canvas = gl.domElement;
      canvas.toBlob((blob) => {
        if (blob) {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${badgeName}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }
      }, 'image/png');
    };
    
    const captureSVG = (badgeName: string) => {
      const canvas = gl.domElement;
      const width = canvas.width;
      const height = canvas.height;
      
      // Konwertuj canvas do base64
      const base64Data = canvas.toDataURL('image/png');
      
      // Utwórz SVG z osadzonym obrazem
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <image href="${base64Data}" width="100%" height="100%"/>
</svg>`;
      
      // Utwórz blob z SVG
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${badgeName}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    };
    
    onCaptureReadyRef.current(capture);
    onSVGCaptureReadyRef.current(captureSVG);
  }, [gl]);
  
  return null;
};

const Viewer: React.FC<ViewerProps> = ({ badges, onRefresh, onRemove }) => {
  const savedPositionRef = useRef(loadViewerPosition());
  const adminMode = useAdminMode();
  const { overrides } = useCatalogOverrides();
  const { config: lightingConfig, update: updateLightingConfig, reset: resetLightingConfig } = useBadgeLightingConfig();
  const [adminPanelTab, setAdminPanelTab] = useState<AdminPanelTab>('kolory');
  const textureDragApiRef = useRef<TextureDragApi | null>(null);
  const [editScene, setEditScene] = useState<THREE.Object3D | null>(null);
  const [marqueeSelectedMeshes, setMarqueeSelectedMeshes] = useState<Set<string>>(new Set());
  const layoutMarqueeBridgeRef = useRef<LayoutMarqueeBridgeHandle | null>(null);
  const layoutModeActive = adminMode && adminPanelTab === 'uklad';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [spinTrigger, setSpinTrigger] = useState(0);
  const [isLit, setIsLit] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingPNG, setIsDownloadingPNG] = useState(false);
  const [isDownloadingSVG, setIsDownloadingSVG] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(savedPositionRef.current.activeTab);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const badgeLoadTokenRef = useRef(0);
  const activeCatalogItemRef = useRef<HTMLButtonElement | null>(null);

  // Reset sceny edycji gdy zmienia się odznaka lub tryb admina.
  const handleSceneReady = useCallback((scene: THREE.Object3D) => {
    setEditScene(scene);
  }, []);

  useEffect(() => {
    if (!adminMode) setEditScene(null);
  }, [adminMode]);

  useEffect(() => {
    if (!adminMode) setAdminPanelTab('kolory');
  }, [adminMode]);

  useEffect(() => {
    if (!layoutModeActive) setMarqueeSelectedMeshes(new Set());
  }, [layoutModeActive]);

  const handleMarqueeSelection = useCallback((paths: string[], additive: boolean) => {
    setMarqueeSelectedMeshes((prev) => {
      if (additive) {
        const next = new Set(prev);
        paths.forEach((p) => next.add(p));
        return next;
      }
      return new Set(paths);
    });
  }, []);
  
  // Ref do przechowywania funkcji pobierania PNG z komponentu Canvas
  const downloadPNGRef = useRef<((badgeName: string) => void) | null>(null);
  // Ref do przechowywania funkcji pobierania SVG z komponentu Canvas
  const downloadSVGRef = useRef<((badgeName: string) => void) | null>(null);
  
  // Używamy wspólnej funkcji z utils/badgeMatching.ts dla synchronizacji z BadgeList

  // Typ dla itemu z ewentualną odznaką
  interface BadgeItemWithMatch {
    item: BadgeItem;
    badge: Badge | null;
    label: string;
    categoryTitle: string;
    itemKey: string;
  }

  const persistViewerPosition = useCallback(
    (tab: TabType, index: number, items: BadgeItemWithMatch[]) => {
      const row = items[index];
      if (!row) return;
      savedPositionRef.current = {
        activeTab: tab,
        itemKeyByTab: {
          ...savedPositionRef.current.itemKeyByTab,
          [tab]: row.itemKey,
        },
      };
      saveViewerPosition(savedPositionRef.current);
    },
    []
  );

  const restoreIndexForTab = useCallback(
    (tab: TabType, items: BadgeItemWithMatch[]): number => {
      if (!items.length) return 0;
      const key = savedPositionRef.current.itemKeyByTab[tab];
      if (!key) return 0;
      const idx = items.findIndex((i) => i.itemKey === key);
      return idx >= 0 ? idx : 0;
    },
    []
  );

  // Filtrowanie wszystkich items z kategorii - pokazujemy wszystkie, także te bez odznak
  // UWAGA: Ta sama odznaka może pasować do wielu items (jak w BadgeList)
  const allItems = useMemo(() => {
    const items: BadgeItemWithMatch[] = [];

    getCategoriesForTab(activeTab).forEach((category) => {
      category.items.forEach((rawItem) => {
        const effectiveItem = getEffectiveItem(activeTab, category.title, rawItem, overrides);
        const matchingItem = getCatalogMatchingItem(effectiveItem, category.title);
        const label =
          typeof matchingItem === 'string' ? matchingItem : matchingItem.label;
        const matchedBadge = findMatchingBadge(matchingItem, badges, {
          exact: usesExactCatalogMatching(effectiveItem, category.title),
        });

        items.push({
          item: effectiveItem,
          badge: matchedBadge,
          label,
          categoryTitle: category.title,
          itemKey: getCatalogItemKey(activeTab, category.title, rawItem),
        });
      });
    });

    return items;
  }, [badges, activeTab, overrides]);

  const bumpBadgeLoad = useCallback(() => {
    badgeLoadTokenRef.current += 1;
    setIsLoading(true);
    return badgeLoadTokenRef.current;
  }, []);

  const finishBadgeLoad = useCallback((token: number) => {
    if (token === badgeLoadTokenRef.current) setIsLoading(false);
  }, []);

  const itemHasRenderableBadge = useCallback((item: BadgeItemWithMatch | undefined) => {
    const url = item?.badge?.url?.trim();
    return Boolean(url && url.length > 0);
  }, []);

  const jumpToIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= allItems.length || index === currentIndex) return;
      const target = allItems[index];
      if (itemHasRenderableBadge(target)) bumpBadgeLoad();
      else setIsLoading(false);
      setCurrentIndex(index);
    },
    [allItems, currentIndex, bumpBadgeLoad, itemHasRenderableBadge]
  );

  // Preload GLB w tle — szybsze skoki między odznakami
  useEffect(() => {
    const urls = new Set<string>();
    allItems.forEach((item) => {
      const url = item.badge?.url?.trim();
      if (url) urls.add(url);
    });
    urls.forEach((url) => {
      try {
        useGLTF.preload(url);
      } catch {
        /* ignore preload errors */
      }
    });
  }, [allItems]);

  useEffect(() => {
    activeCatalogItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIndex, activeTab]);

  const itemsWithBadges = useMemo(() => {
    let count = 0;
    getCategoriesForTab(activeTab).forEach((cat) => {
      cat.items.forEach((rawItem) => {
        const eff = getEffectiveItem(activeTab, cat.title, rawItem, overrides);
        if (
          findMatchingBadge(getCatalogMatchingItem(eff, cat.title), badges, {
            exact: usesExactCatalogMatching(eff, cat.title),
          })
        )
          count++;
      });
    });
    return count;
  }, [badges, activeTab, overrides]);

  const lastBadgeId = useRef<string | null>(null);
  const hasInitialRestoreRef = useRef(false);
  const prevActiveTabRef = useRef(activeTab);

  // Przy starcie i zmianie zakładki — przywróć ostatnią pozycję (nie przy każdym odświeżeniu badges)
  useEffect(() => {
    if (!allItems.length) return;

    const tabChanged = prevActiveTabRef.current !== activeTab;
    prevActiveTabRef.current = activeTab;

    if (!hasInitialRestoreRef.current || tabChanged) {
      hasInitialRestoreRef.current = true;
      const idx = restoreIndexForTab(activeTab, allItems);
      if (itemHasRenderableBadge(allItems[idx])) bumpBadgeLoad();
      else setIsLoading(false);
      setCurrentIndex(idx);
      if (tabChanged) lastBadgeId.current = null;
    }
  }, [activeTab, allItems, restoreIndexForTab, bumpBadgeLoad, itemHasRenderableBadge]);

  // Zapisuj bieżącą odznakę (localStorage)
  useEffect(() => {
    if (!allItems.length) return;
    persistViewerPosition(activeTab, currentIndex, allItems);
  }, [activeTab, currentIndex, allItems, persistViewerPosition]);

  const handleActiveTabChange = useCallback(
    (tab: TabType) => {
      if (tab === activeTab) return;
      persistViewerPosition(activeTab, currentIndex, allItems);
      savedPositionRef.current.activeTab = tab;
      saveViewerPosition(savedPositionRef.current);
      setActiveTab(tab);
    },
    [activeTab, currentIndex, allItems, persistViewerPosition]
  );
  
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
      setIsLit(false);
    }
  }, [currentBadge?.id, hasBadge]);

  const badgeLoadTokenForRender = badgeLoadTokenRef.current;

  const goNext = useCallback(() => {
    if (!allItems.length) return;
    jumpToIndex((currentIndex + 1) % allItems.length);
  }, [allItems.length, currentIndex, jumpToIndex]);

  const goPrev = useCallback(() => {
    if (!allItems.length) return;
    jumpToIndex((currentIndex - 1 + allItems.length) % allItems.length);
  }, [allItems.length, currentIndex, jumpToIndex]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev]);

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

  const handleDownloadPNG = async () => {
    if (!currentBadge || !downloadPNGRef.current) return;
    
    try {
      setIsDownloadingPNG(true);
      setIsCapturing(true);
      
      // Zapamiętaj czy światło było włączone przed wykonaniem screenshotu
      const wasLit = isLit;
      
      // Jeśli światło nie jest włączone, włącz je
      if (!isLit) {
        setIsLit(true);
        // Czekaj aż światło się załaduje (lerp w Badge3D potrzebuje czasu)
        await new Promise(resolve => setTimeout(resolve, 800));
      } else {
        // Jeśli już jest włączone, daj chwilę na stabilizację
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Wywołaj funkcję przechwyconą z Canvas z nazwą odznaki
      downloadPNGRef.current(currentBadge.name);
      
      // Małe opóźnienie, aby upewnić się, że screenshot został wykonany
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Przywróć poprzedni stan światła (jeśli było wyłączone, wyłącz je z powrotem)
      if (!wasLit) {
        setIsLit(false);
      }
    } catch (error) {
      console.error("Błąd pobierania PNG:", error);
    } finally {
      setIsDownloadingPNG(false);
      setIsCapturing(false);
    }
  };

  const handleDownloadSVG = async () => {
    if (!currentBadge || !downloadSVGRef.current) return;
    
    try {
      setIsDownloadingSVG(true);
      setIsCapturing(true);
      
      // Zapamiętaj czy światło było włączone przed wykonaniem screenshotu
      const wasLit = isLit;
      
      // Jeśli światło nie jest włączone, włącz je
      if (!isLit) {
        setIsLit(true);
        // Czekaj aż światło się załaduje (lerp w Badge3D potrzebuje czasu)
        await new Promise(resolve => setTimeout(resolve, 800));
      } else {
        // Jeśli już jest włączone, daj chwilę na stabilizację
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Wywołaj funkcję przechwyconą z Canvas z nazwą odznaki
      downloadSVGRef.current(currentBadge.name);
      
      // Małe opóźnienie, aby upewnić się, że screenshot został wykonany
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Przywróć poprzedni stan światła (jeśli było wyłączone, wyłącz je z powrotem)
      if (!wasLit) {
        setIsLit(false);
      }
    } catch (error) {
      console.error("Błąd pobierania SVG:", error);
    } finally {
      setIsDownloadingSVG(false);
      setIsCapturing(false);
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
    <div className={`w-full ${adminMode ? 'max-w-[1500px]' : 'max-w-7xl'} mx-auto flex flex-col md:flex-row items-stretch gap-6 h-[75vh]`}>
      <div className="relative flex-[3] bg-black rounded-[40px] border border-white/10 overflow-hidden shadow-2xl group/viewer">
        {layoutModeActive && hasBadge && (
          <LayoutMarqueeOverlay bridgeRef={layoutMarqueeBridgeRef} enabled={layoutModeActive} />
        )}
        {/* Loader overlay - pokazuj tylko gdy jest odznaka */}
        {isLoading && hasBadge && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
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
            gl={{ alpha: true, premultipliedAlpha: false, antialias: true, preserveDrawingBuffer: true }}
            onPointerMissed={() => setIsLit(false)}
          >
            <Suspense fallback={null}>
              <CanvasCapture 
                onCaptureReady={(fn) => { downloadPNGRef.current = fn; }} 
                onSVGCaptureReady={(fn) => { downloadSVGRef.current = fn; }}
              />
              {layoutModeActive && editScene && (
                <LayoutMarqueeBridge
                  ref={layoutMarqueeBridgeRef}
                  scene={editScene}
                  onSelection={handleMarqueeSelection}
                />
              )}
              <Badge3D 
                key={currentBadge.id}
                url={badgeUrl} 
                spinTrigger={spinTrigger} 
                zoomLevel={Number(currentBadge.zoom_level ?? 0)} 
                isLit={isLit}
                hideShadows={isCapturing}
                adminMode={adminMode}
                onSceneReady={adminMode ? handleSceneReady : undefined}
                lightingConfig={lightingConfig}
                onPointerDown={
                  layoutModeActive
                    ? undefined
                    : (e) => {
                        // Tryb kolory: jeśli panel ma aktywne „przesuwanie myszką”, deleguj drag.
                        const api = textureDragApiRef.current;
                        if (adminMode && adminPanelTab === 'kolory' && api?.isEnabled()) {
                          e.stopPropagation();
                          api.onPointerDown(e);
                          return;
                        }
                        e.stopPropagation();
                        setIsLit(true);
                        handleSpin();
                      }
                }
                onPointerMove={
                  layoutModeActive
                    ? undefined
                    : (e) => {
                        const api = textureDragApiRef.current;
                        if (adminMode && adminPanelTab === 'kolory' && api?.isEnabled()) {
                          e.stopPropagation();
                          api.onPointerMove(e);
                        }
                      }
                }
                onPointerUp={
                  layoutModeActive
                    ? undefined
                    : (e) => {
                        const api = textureDragApiRef.current;
                        if (adminMode && adminPanelTab === 'kolory' && api?.isEnabled()) {
                          e.stopPropagation();
                          api.onPointerUp(e);
                        }
                      }
                }
                onPointerLeave={
                  layoutModeActive
                    ? undefined
                    : (e) => {
                        const api = textureDragApiRef.current;
                        if (adminMode && adminPanelTab === 'kolory' && api?.isEnabled()) {
                          api.onPointerLeave(e);
                        }
                      }
                }
                onLoadComplete={() => finishBadgeLoad(badgeLoadTokenForRender)}
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

        <div className="absolute inset-y-0 left-0 z-50 flex items-center px-6 pointer-events-none">
          <button onClick={goPrev} className="pointer-events-auto p-4 bg-black/40 hover:bg-white text-white hover:text-black rounded-full border border-white/10 backdrop-blur-md transition-all shadow-xl active:scale-90">
            <ChevronLeft className="w-8 h-8" />
          </button>
        </div>
        <div className="absolute inset-y-0 right-0 z-50 flex items-center px-6 pointer-events-none">
          <button onClick={goNext} className="pointer-events-auto p-4 bg-black/40 hover:bg-white text-white hover:text-black rounded-full border border-white/10 backdrop-blur-md transition-all shadow-xl active:scale-90">
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
          
          <div className="grid grid-cols-3 gap-3 flex-shrink-0">
            <button 
              onClick={handleDownloadGLB} 
              disabled={isDownloading || !hasBadge} 
              className="py-5 bg-blue-800/20 text-white border border-white/10 rounded-2xl font-anton text-[11px] uppercase tracking-[0.2em] hover:bg-white hover:text-blue-900 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 gap-2"
            >
              {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 
              GLB
            </button>
            
            <button 
              onClick={handleDownloadPNG} 
              disabled={isDownloadingPNG || !hasBadge} 
              className="py-5 bg-blue-800/20 text-white border border-white/10 rounded-2xl font-anton text-[11px] uppercase tracking-[0.2em] hover:bg-white hover:text-blue-900 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 gap-2"
            >
              {isDownloadingPNG ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />} 
              PNG
            </button>
            
            <button 
              onClick={handleDownloadSVG} 
              disabled={isDownloadingSVG || !hasBadge} 
              className="py-5 bg-blue-800/20 text-white border border-white/10 rounded-2xl font-anton text-[11px] uppercase tracking-[0.2em] hover:bg-white hover:text-blue-900 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 gap-2"
            >
              {isDownloadingSVG ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCode className="w-4 h-4" />} 
              SVG
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3 flex-shrink-0">
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
                onClick={() => handleActiveTabChange(tab.id)}
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
          <div
            className="max-h-36 overflow-y-auto overflow-x-hidden rounded-xl border border-white/10 bg-black/30 p-1 space-y-0.5"
            role="listbox"
            aria-label="Lista odznak w kolekcji"
          >
            {allItems.map((item, idx) => {
              const isActive = idx === currentIndex;
              const hasItemBadge = Boolean(item.badge?.url?.trim());
              const showCategory =
                idx === 0 || allItems[idx - 1].categoryTitle !== item.categoryTitle;
              return (
                <React.Fragment key={item.itemKey}>
                  {showCategory && (
                    <div className="px-2 pt-2 pb-0.5 text-[8px] font-bold uppercase tracking-widest text-blue-400/80 sticky top-0 bg-black/90 backdrop-blur-sm z-10">
                      {item.categoryTitle}
                    </div>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    ref={isActive ? activeCatalogItemRef : undefined}
                    onClick={() => jumpToIndex(idx)}
                    title={hasItemBadge ? item.label : `${item.label} — brak odznaki w bazie`}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-medium leading-tight transition-all truncate ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md'
                        : hasItemBadge
                          ? 'text-gray-300 hover:bg-white/10'
                          : 'text-red-300/70 hover:bg-red-500/10'
                    }`}
                  >
                    <span className="block truncate">{item.label}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
          <p className="text-[9px] text-gray-500 uppercase tracking-wider">
            Kliknij pozycję lub użyj ← → — nie musisz czekać na załadowanie
          </p>
        </div>
      </div>

      {adminMode && (
        <div className="w-full md:w-[380px] flex-shrink-0 bg-blue-950/60 backdrop-blur-xl border border-amber-400/20 rounded-[32px] shadow-2xl p-4 overflow-hidden flex flex-col gap-2 min-h-0">
          <button
            type="button"
            onClick={() => disableAdminMode()}
            className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-blue-200/70 hover:text-white py-2 px-2 rounded-lg border border-white/10 hover:bg-white/5 transition text-left"
          >
            Wyłącz tryb admina
          </button>
          <div className="flex p-1 bg-black/40 rounded-xl border border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => setAdminPanelTab('kolory')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg font-bold uppercase text-[9px] tracking-widest transition-all ${
                adminPanelTab === 'kolory'
                  ? 'bg-amber-500/90 text-black shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Palette className="w-3 h-3" /> Kolory
            </button>
            <button
              type="button"
              onClick={() => setAdminPanelTab('swiatlo')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg font-bold uppercase text-[9px] tracking-widest transition-all ${
                adminPanelTab === 'swiatlo'
                  ? 'bg-amber-500/90 text-black shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sun className="w-3 h-3" /> Światło
            </button>
            <button
              type="button"
              onClick={() => setAdminPanelTab('uklad')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg font-bold uppercase text-[9px] tracking-widest transition-all ${
                adminPanelTab === 'uklad'
                  ? 'bg-amber-500/90 text-black shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutGrid className="w-3 h-3" /> Układ
            </button>
          </div>
          <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
            {adminPanelTab === 'kolory' ? (
              <BadgeColorPanel
                badge={hasBadge ? currentBadge : null}
                scene={editScene}
                onSaved={onRefresh}
                onTextureDragApi={(api) => {
                  textureDragApiRef.current = api;
                }}
              />
            ) : adminPanelTab === 'swiatlo' ? (
              <AdminLightingPanel
                config={lightingConfig}
                onChange={updateLightingConfig}
                onReset={resetLightingConfig}
              />
            ) : (
              <AdminMeshLayoutPanel
                badge={hasBadge ? currentBadge : null}
                scene={editScene}
                marqueeSelectedMeshes={marqueeSelectedMeshes}
                onMarqueeMeshesChange={setMarqueeSelectedMeshes}
                onSaved={onRefresh}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Viewer;
