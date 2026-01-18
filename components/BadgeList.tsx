
import React, { useState } from 'react';
import { Badge } from '../types';
import { PLAYER_CATEGORIES, COACH_CATEGORIES, MANAGER_CATEGORIES, Category, BadgeItem } from '../data';
import { CheckCircle2, Circle, Trophy, HelpCircle, User, Award, Briefcase, Search } from 'lucide-react';
import { findMatchingBadge, normalize } from '../utils/badgeMatching';

interface BadgeListProps {
  badges: Badge[];
}

type TabType = 'zawodnik' | 'trener' | 'manager';

const BadgeList: React.FC<BadgeListProps> = ({ badges }) => {
  const [activeTab, setActiveTab] = useState<TabType>('zawodnik');
  const [searchTerm, setSearchTerm] = useState('');

  // Używamy wspólnej funkcji z utils/badgeMatching.ts dla synchronizacji z Viewer
  
  // Wrapper dla findMatchingBadge, który używa badges z props
  const findMatchingBadgeWrapper = (item: BadgeItem) => {
    if (!badges || badges.length === 0) return null;
    return findMatchingBadge(item, badges);
  };

  const currentCategories = 
    activeTab === 'zawodnik' ? PLAYER_CATEGORIES :
    activeTab === 'trener' ? COACH_CATEGORIES : 
    MANAGER_CATEGORIES;

  // Obliczanie statystyk
  let totalItems = 0;
  let collectedItems = 0;

  currentCategories.forEach(cat => {
    cat.items.forEach(item => {
      totalItems++;
      if (findMatchingBadgeWrapper(item)) collectedItems++;
    });
  });

  const progressPercentage = totalItems > 0 ? Math.round((collectedItems / totalItems) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">
      
      {/* Header Statystyk - Ciemniejszy styl */}
      <div className="bg-black/40 backdrop-blur-xl rounded-[30px] p-8 border border-white/10 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div>
            <h2 className="text-3xl font-anton uppercase text-white tracking-widest mb-2">Twój Postęp</h2>
            <div className="flex items-center gap-2 text-blue-400 font-bold uppercase tracking-wider text-xs">
              <Trophy className="w-4 h-4" />
              <span>Zdobyte odznaki: <span className="text-white text-lg ml-1">{collectedItems} / {totalItems}</span></span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto min-w-[300px]">
            <div className="flex-1 h-3 bg-blue-950/50 rounded-full overflow-hidden border border-white/10">
              <div 
                className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-1000 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="font-anton text-2xl text-blue-300">{progressPercentage}%</span>
          </div>
        </div>
      </div>

      {/* Nawigacja */}
      <div className="sticky top-0 z-20 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl">
          <div className="flex p-1 bg-black/40 rounded-xl border border-white/10 shadow-inner">
            {[
              { id: 'zawodnik', label: 'Zawodnik', icon: User },
              { id: 'trener', label: 'Trener', icon: Briefcase },
              { id: 'manager', label: 'Manager', icon: Award }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold uppercase text-[10px] tracking-widest transition-all ${
                  activeTab === tab.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-3 h-3" /> {tab.label}
              </button>
            ))}
          </div>

          <div className="relative group w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-400 transition-colors z-10" />
            <input 
              type="text" 
              placeholder="Szukaj odznaki..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:bg-black/60 transition-all shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* Lista Kategorii - Przywrócony ciemny styl */}
      <div className="space-y-6">
        {(() => {
          // Obliczamy wszystkie przefiltrowane elementy we wszystkich kategoriach
          let globalIndex = 0;
          const allFilteredItems: Array<{ category: Category; items: (string | BadgeItem)[] }> = [];
          
          currentCategories.forEach(category => {
            const filteredItems = category.items.filter(item => {
              if (!searchTerm) return true;
              const label = typeof item === 'string' ? item : item.label;
              const badge = typeof item === 'object' ? item.badge : '';
              return normalize(label).includes(normalize(searchTerm)) || 
                     normalize(badge || '').includes(normalize(searchTerm));
            });
            
            // Dodajemy kategorię tylko jeśli ma jakieś items (po filtrowaniu lub bez filtrowania)
            if (filteredItems.length > 0) {
              allFilteredItems.push({ category, items: filteredItems });
            }
          });

          return allFilteredItems.map(({ category, items: filteredItems }, idx) => {
            const categoryStartIndex = globalIndex;
            
            return (
              <div key={idx} className="bg-black/20 rounded-2xl overflow-hidden border border-white/5">
                <div className="bg-blue-900/20 px-6 py-3 border-b border-white/5 flex items-center justify-between backdrop-blur-sm">
                  <h3 className="font-anton text-lg uppercase tracking-wider text-blue-100/90">
                    {category.title}
                  </h3>
                  <span className="text-[9px] font-bold bg-black/40 text-gray-400 px-2 py-1 rounded border border-white/5">
                    {filteredItems.filter(i => findMatchingBadgeWrapper(i)).length} / {filteredItems.length}
                  </span>
                </div>
                
                <div className="divide-y divide-white/5">
                  {filteredItems.map((item, itemIdx) => {
                    const currentGlobalIndex = categoryStartIndex + itemIdx + 1;
                    globalIndex = currentGlobalIndex; // Aktualizujemy globalny indeks
                    
                    const isCollected = findMatchingBadgeWrapper(item);
                    const label = typeof item === 'string' ? item : item.label;
                    const badgeName = typeof item === 'object' ? item.badge : null;

                    return (
                      <div 
                        key={itemIdx} 
                        className={`group flex items-center justify-between p-4 transition-colors duration-200 ${
                          isCollected 
                            ? 'bg-blue-900/10' 
                            : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="shrink-0 w-8 flex items-center justify-center">
                            <span className={`text-xs font-bold ${isCollected ? 'text-blue-400' : 'text-gray-600'}`}>
                              #{currentGlobalIndex}
                            </span>
                          </div>
                          
                          <div className={`shrink-0 transition-all duration-300 ${isCollected ? 'text-green-500 scale-110' : 'text-gray-700'}`}>
                            {isCollected ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                          </div>
                          
                          <div className="flex flex-col">
                            <span className={`text-sm font-medium tracking-wide transition-colors ${isCollected ? 'text-white' : 'text-gray-400'}`}>
                              {label}
                            </span>
                            
                            {badgeName && (
                              <span className={`text-[10px] uppercase font-bold tracking-wider mt-0.5 flex items-center gap-1 ${isCollected ? 'text-blue-300' : 'text-gray-600'}`}>
                                <Trophy className="w-3 h-3" />
                                {badgeName}
                              </span>
                            )}
                          </div>
                        </div>

                        {isCollected && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1 bg-green-500/10 rounded border border-green-500/20">
                             <span className="text-[9px] font-bold text-green-500 uppercase tracking-widest">Zdobyte</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()}
      </div>

      {(() => {
        const hasAnyItems = currentCategories.some(c => c.items.length > 0);
        const hasFilteredItems = (() => {
          let globalIndex = 0;
          const allFilteredItems: Array<{ category: Category; items: (string | BadgeItem)[] }> = [];
          
          currentCategories.forEach(category => {
            const filteredItems = category.items.filter(item => {
              if (!searchTerm) return true;
              const label = typeof item === 'string' ? item : item.label;
              const badge = typeof item === 'object' ? item.badge : '';
              return normalize(label).includes(normalize(searchTerm)) || 
                     normalize(badge || '').includes(normalize(searchTerm));
            });
            
            if (filteredItems.length > 0) {
              allFilteredItems.push({ category, items: filteredItems });
            }
          });
          
          return allFilteredItems.length > 0;
        })();

        if (!hasAnyItems) {
          return (
            <div className="text-center py-20 opacity-50">
              <HelpCircle className="w-16 h-16 mx-auto mb-4 text-blue-400" />
              <p className="font-anton uppercase tracking-widest text-xl">Brak elementów</p>
            </div>
          );
        }
        
        if (searchTerm && !hasFilteredItems) {
          return (
            <div className="text-center py-20 opacity-50">
              <Search className="w-16 h-16 mx-auto mb-4 text-blue-400" />
              <p className="font-anton uppercase tracking-widest text-xl">Brak wyników wyszukiwania</p>
              <p className="text-gray-400 text-sm mt-2">Spróbuj innej frazy</p>
            </div>
          );
        }
        
        return null;
      })()}
    </div>
  );
};

export default BadgeList;
