import React from 'react';
import { UploadCloud, ChevronDown, ChevronUp, X, CheckCircle2, RotateCcw } from 'lucide-react';

export function UploadWidget({ 
  uploadQueue, 
  setUploadQueue, 
  isWidgetOpen, 
  setIsWidgetOpen, 
  retryUpload 
}) {
  if (uploadQueue.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 max-w-none sm:max-w-sm w-auto sm:w-full bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden transition-all duration-300 z-40">
      <div className="bg-slate-900 text-white p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <UploadCloud className="w-5 h-5 text-indigo-400 flex-shrink-0" />
          <span className="text-xs font-semibold truncate">
            Загрузка файлов ({uploadQueue.filter(i => i.status === 'completed').length}/{uploadQueue.length})
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button 
            onClick={() => setIsWidgetOpen(!isWidgetOpen)} 
            className="p-1 text-gray-400 hover:text-white transition"
          >
            {isWidgetOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button 
            onClick={() => setUploadQueue([])} 
            className="p-1 text-gray-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isWidgetOpen && (
        <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 p-2">
          {uploadQueue.map((item) => {
            const displayName = item.fileName || item.file?.name;
            return (
              <div key={item.id} className="p-2.5 text-xs">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="font-medium text-gray-800 truncate">{displayName}</span>
                  <span className="flex-shrink-0">
                    {item.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {item.status === 'error' && (
                      <button 
                        onClick={() => retryUpload(item)} 
                        title="Повторить" 
                        className="text-red-500 hover:text-red-700 flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {item.status === 'skipped' && <span className="text-gray-400">Пропущен</span>}
                    {item.status === 'uploading' && <span className="text-indigo-600 font-semibold">{item.progress}%</span>}
                  </span>
                </div>

                {item.status === 'uploading' && (
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-1.5 transition-all duration-200" 
                      style={{ width: `${item.progress}%` }}
                    ></div>
                  </div>
                )}

                {item.status === 'error' && (
                  <p className="text-red-500 text-[11px] mt-0.5">{item.errorMsg}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}