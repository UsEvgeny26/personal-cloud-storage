import React from 'react';
import { Folder, Trash2 } from 'lucide-react';

export function FolderList({ 
  folders, 
  onFolderClick, 
  onDeleteFolder, 
  onTouchStart, 
  onTouchEnd, 
  onTouchMove 
}) {
  if (!folders || folders.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Папки</h2>
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        {folders.map((folder) => (
          <div 
            key={folder.name}
            onTouchStart={() => onTouchStart(folder, true)}
            onTouchEnd={onTouchEnd}
            onTouchMove={onTouchMove}
            className="group relative flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition select-none"
          >
            <div 
              onClick={() => onFolderClick(folder)}
              className="flex items-center gap-3 min-w-0 flex-1 pr-2"
            >
              <Folder className="w-6 h-6 text-amber-500 fill-amber-100 group-hover:scale-110 transition-transform flex-shrink-0" />
              <span className="text-sm font-medium text-gray-700 break-words line-clamp-2 leading-tight">
                {folder.name}
              </span>
            </div>
            
            <button 
              onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder); }}
              className="hidden md:block opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition flex-shrink-0"
              title="Удалить папку"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}