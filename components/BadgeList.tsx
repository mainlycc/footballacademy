
import React, { useMemo, useState } from 'react';
import { Badge } from '../types';
import { Category, BadgeItem } from '../data';
import { CheckCircle2, Circle, Trophy, HelpCircle, User, Award, Briefcase, Search } from 'lucide-react';
import { findMatchingBadge, normalize } from '../utils/badgeMatching';
import {
  CatalogTab,
  getCatalogItemKey,
  getCategoriesForTab,
} from '../utils/catalogOverrides';
import {
  getCatalogMatchingItem,
  getDisplayLabel,
  usesExactCatalogMatching,
} from '../utils/catalogDisambiguation';

interface BadgeListProps {
  badges: Badge[];
}

const BadgeList: React.FC<BadgeListProps> = ({ badges }) => {
  const [activeTab, setActiveTab] = useState<CatalogTab>('zawodnik');
  const [searchTerm, setSearchTerm] = useState('');

  const rawCategories = useMemo(() => getCategoriesForTab(activeTab), [activeTab]);

  const findMatching = (item: BadgeItem, categoryTitle: string) => {
    if (!badges?.length) return null;
    const matchingItem = getCatalogMatchingItem(item, categoryTitle);
    return findMatchingBadge(matchingItem, badges, {
      exact: usesExactCatalogMatching(item, categoryTitle),
    });
  };

  type Row = {
    category: Category;
    rawItem: BadgeItem;
    item: BadgeItem;
    itemKey: string;
    displayLabel: string;
  };

  const rows = useMemo(() => {
    const result: Row[] = [];
    rawCategories.forEach((category) => {
      category.items.forEach((rawItem) => {
        const baseLabel = typeof rawItem === 'string' ? rawItem : rawItem.label;
        const displayLabel = getDisplayLabel(baseLabel, category.title);
        if (searchTerm) {
          const badge = typeof rawItem === 'object' ? rawItem.badge : '';
          const match =
            normalize(displayLabel).includes(normalize(searchTerm)) ||
            normalize(baseLabel).includes(normalize(searchTerm)) ||
            normalize(badge || '').includes(normalize(searchTerm));
          if (!match) return;
        }
        result.push({
          category,
          rawItem,
          item: rawItem,
          itemKey: getCatalogItemKey(activeTab, category.title, rawItem),
          displayLabel,
        });
      });
    });
    return result;
  }, [rawCategories, activeTab, searchTerm]);

  const rowsByCategory = useMemo(() => {
    const map = new Map<string, { category: Category; rows: Row[] }>();
    rows.forEach((row) => {
      const existing = map.get(row.category.title);
      if (existing) existing.rows.push(row);
      else map.set(row.category.title, { category: row.category, rows: [row] });
    });
    return Array.from(map.values());
  }, [rows]);

  let totalItems = 0;
  let collectedItems = 0;
  rawCategories.forEach((cat) => {
    cat.items.forEach((rawItem) => {
      totalItems++;
      if (findMatching(rawItem, cat.title)) collectedItems++;
    });
  });

  const progressPercentage = totalItems > 0 ? Math.round((collectedItems / totalItems) * 100) : 0;

  let globalIndex = 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">
      <div className="bg-black/40 backdrop-blur-xl rounded-[30px] p-8 border border-white/10 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div>
            <h2 className="text-3xl font-anton uppercase text-white tracking-widest mb-2">Twój Postęp</h2>
            <div className="flex items-center gap-2 text-blue-400 font-bold uppercase tracking-wider text-xs">
              <Trophy className="w-4 h-4" />
              <span>
                Zdobyte odznaki:{' '}
                <span className="text-white text-lg ml-1">
                  {collectedItems} / {totalItems}
                </span>
              </span>
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

      <div className="sticky top-0 z-20 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl">
          <div className="flex p-1 bg-black/40 rounded-xl border border-white/10 shadow-inner">
            {[
              { id: 'zawodnik' as CatalogTab, label: 'Zawodnik', icon: User },
              { id: 'trener' as CatalogTab, label: 'Trener', icon: Briefcase },
              { id: 'manager' as CatalogTab, label: 'Manager', icon: Award },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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

      <div className="space-y-6">
        {rowsByCategory.map(({ category, rows: catRows }) => (
          <div key={category.title} className="bg-black/20 rounded-2xl overflow-hidden border border-white/5">
            <div className="bg-blue-900/20 px-6 py-3 border-b border-white/5 flex items-center justify-between backdrop-blur-sm">
              <h3 className="font-anton text-lg uppercase tracking-wider text-blue-100/90">
                {category.title}
              </h3>
              <span className="text-[9px] font-bold bg-black/40 text-gray-400 px-2 py-1 rounded border border-white/5">
                {catRows.filter((r) => findMatching(r.item, category.title)).length} / {catRows.length}
              </span>
            </div>

            <div className="divide-y divide-white/5">
              {catRows.map((row) => {
                globalIndex += 1;
                const { item, displayLabel } = row;
                const isCollected = !!findMatching(item, category.title);
                const matchingItem = getCatalogMatchingItem(item, category.title);
                const badgeName =
                  typeof matchingItem === 'object' ? matchingItem.badge : null;

                return (
                  <div
                    key={row.itemKey}
                    className={`group flex items-center justify-between p-4 transition-colors duration-200 ${
                      isCollected ? 'bg-blue-900/10' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="shrink-0 w-8 flex items-center justify-center">
                        <span
                          className={`text-xs font-bold ${isCollected ? 'text-blue-400' : 'text-gray-600'}`}
                        >
                          #{globalIndex}
                        </span>
                      </div>

                      <div
                        className={`shrink-0 transition-all duration-300 ${isCollected ? 'text-green-500 scale-110' : 'text-gray-700'}`}
                      >
                        {isCollected ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span
                          className={`text-sm font-medium tracking-wide transition-colors ${isCollected ? 'text-white' : 'text-gray-400'}`}
                        >
                          {displayLabel}
                        </span>

                        {badgeName && (
                          <span
                            className={`text-[10px] uppercase font-bold tracking-wider mt-0.5 flex items-center gap-1 truncate ${isCollected ? 'text-blue-300' : 'text-gray-600'}`}
                          >
                            <Trophy className="w-3 h-3 shrink-0" />
                            {badgeName}
                          </span>
                        )}
                      </div>
                    </div>

                    {isCollected && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1 bg-green-500/10 rounded border border-green-500/20 shrink-0">
                        <span className="text-[9px] font-bold text-green-500 uppercase tracking-widest">
                          Zdobyte
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {totalItems === 0 && (
        <div className="text-center py-20 opacity-50">
          <HelpCircle className="w-16 h-16 mx-auto mb-4 text-blue-400" />
          <p className="font-anton uppercase tracking-widest text-xl">Brak elementów</p>
        </div>
      )}

      {searchTerm && rows.length === 0 && totalItems > 0 && (
        <div className="text-center py-20 opacity-50">
          <Search className="w-16 h-16 mx-auto mb-4 text-blue-400" />
          <p className="font-anton uppercase tracking-widest text-xl">Brak wyników wyszukiwania</p>
          <p className="text-gray-400 text-sm mt-2">Spróbuj innej frazy</p>
        </div>
      )}
    </div>
  );
};

export default BadgeList;
