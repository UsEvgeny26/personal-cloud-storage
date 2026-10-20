import React from 'react';
import { Folder, File, Download, Trash2, X } from 'lucide-react';

export function MobileActionMenu({ actionItem, onClose, onDownload, onDelete }) {
  if (!actionItem) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            {actionItem.isFolder ? (
              <Folder className="w-5 h-5 text-amber-500 flex-shrink-0" />
            ) : (
              <File className="w-5 h-5 text-indigo-500 flex-shrink-0" />
            )}
            <h3 className="text-sm font-bold text-gray-800 break-words line-clamp-2">
              {actionItem.item.name}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          {!actionItem.isFolder && (
            <button 
              onClick={() => {
                onDownload(actionItem.item);
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-50 text-indigo-700 font-medium rounded-xl hover:bg-indigo-100 transition text-sm"
            >
              <Download className="w-5 h-5 text-indigo-600" />
              <span>Скачать файл</span>
            </button>
          )}

          <button 
            onClick={() => {
              onDelete(actionItem.item);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 bg-red-50 text-red-600 font-medium rounded-xl hover:bg-red-100 transition text-sm"
          >
            <Trash2 className="w-5 h-5 text-red-500" />
            <span>Удалить {actionItem.isFolder ? 'папку' : 'файл'}</span>
          </button>

          <button 
            onClick={onClose}
            className="w-full py-2.5 text-gray-500 font-medium text-sm rounded-xl hover:bg-gray-100 transition mt-2"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}