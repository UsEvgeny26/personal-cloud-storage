import React from 'react';
import { X } from 'lucide-react';

export function CreateFolderModal({ show, onClose, onSubmit, folderName, setFolderName }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">Новая папка</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={onSubmit}>
          <input 
            type="text" 
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Имя папки"
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 mb-4"
            autoFocus
            required
          />
          <div className="flex justify-end gap-2">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              Отмена
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-sm"
            >
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}