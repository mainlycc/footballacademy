
import React, { useState } from 'react';
import { Badge } from '../types';
import { Upload, FileCode, CheckCircle, Trash2, SortAsc, SortDesc, Loader2 } from 'lucide-react';

interface UploaderProps {
  badges: Badge[];
  onUpload: (newBadges: Badge[]) => void;
  onRemove: (id: string) => void;
  onReorder: (newOrder: Badge[]) => void;
  onSupabaseUpload: (file: File, name: string) => Promise<void>;
}

const Uploader: React.FC<UploaderProps> = ({ badges, onRemove, onReorder, onSupabaseUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none');

  const processFiles = async (files: File[]) => {
    const glbFiles = files.filter(f => f.name.toLowerCase().endsWith('.glb'));
    if (glbFiles.length === 0) return;

    setIsUploading(true);
    for (const file of glbFiles) {
      const rawName = file.name.replace(/\.[^/.]+$/, "");
      await onSupabaseUpload(file, rawName || "Bez nazwy");
    }
    setIsUploading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) processFiles(Array.from(files));
  };

  const extractFirstNumber = (name: string): number => {
    const match = name.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const toggleSort = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    
    const sorted = [...badges].sort((a, b) => {
      const numA = extractFirstNumber(a.name);
      const numB = extractFirstNumber(b.name);
      if (numA !== numB) return newOrder === 'asc' ? numA - numB : numB - numA;
      return newOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    });
    
    onReorder(sorted);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h2 className="text-4xl font-anton uppercase text-white mb-2 tracking-wide">Zarządzaj w Chmurze</h2>
        <p className="text-blue-200">Pliki GLB są synchronizowane z Twoim kontem Supabase</p>
      </div>

      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const droppedFiles = Array.from(e.dataTransfer.files) as File[];
          processFiles(droppedFiles);
        }}
        className={`relative border-2 border-dashed rounded-3xl p-12 transition-all duration-300 flex flex-col items-center justify-center gap-4 ${
          isDragging ? 'bg-blue-800 border-white scale-[1.02]' : 'bg-blue-900/50 border-blue-400/50 hover:border-white'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {isUploading ? (
          <Loader2 className="w-16 h-16 text-white animate-spin" />
        ) : (
          <Upload className="w-16 h-16 text-white animate-bounce" />
        )}
        <div className="text-center">
          <p className="text-xl font-bold mb-1">{isUploading ? 'Trwa przesyłanie do chmury...' : 'Przeciągnij i upuść pliki GLB'}</p>
          {!isUploading && <p className="text-blue-300 text-sm">lub kliknij przycisk poniżej</p>}
        </div>
        <input 
          type="file" 
          accept=".glb" 
          multiple 
          onChange={handleFileChange}
          className="absolute inset-0 opacity-0 cursor-pointer"
          disabled={isUploading}
        />
        {!isUploading && (
          <button className="mt-4 px-8 py-3 bg-white text-blue-900 font-bold rounded-full hover:bg-blue-100 transition-colors uppercase tracking-wider">
            Wgraj Pliki
          </button>
        )}
      </div>

      {badges.length > 0 && (
        <div className="bg-blue-950/50 rounded-3xl p-8 border border-blue-400/20">
          <div className="flex items-center justify-between mb-6 border-b border-blue-400/20 pb-4">
            <h3 className="text-2xl font-anton uppercase flex items-center gap-2">
              <CheckCircle className="text-green-400" />
              Kolekcja w Chmurze ({badges.length})
            </h3>
            
            <button 
              onClick={toggleSort}
              className="flex items-center gap-2 px-4 py-2 bg-blue-900/50 border border-blue-400/30 rounded-xl hover:bg-white hover:text-blue-900 transition-all text-sm font-bold uppercase tracking-wider"
            >
              {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              <span>Sortuj po numerach</span>
            </button>
          </div>
          
          <div className="space-y-3">
            {badges.map((badge, index) => (
              <div key={badge.id} className="group relative bg-blue-800/20 p-4 rounded-2xl flex items-center justify-between border border-blue-400/10 hover:border-white transition-all">
                <div className="flex items-center gap-5 overflow-hidden">
                  <span className="text-blue-500 font-anton text-xl opacity-50 w-6 text-center">{index + 1}</span>
                  <div className="w-10 h-10 bg-blue-900/50 rounded-lg flex items-center justify-center">
                    <FileCode className="w-5 h-5 text-blue-300" />
                  </div>
                  <span className="truncate font-anton text-lg uppercase tracking-wide text-blue-50">{badge.name}</span>
                </div>
                <button 
                  onClick={() => onRemove(badge.id)}
                  className="p-2 text-blue-300 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                  title="Usuń trwale z chmury"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Uploader;
