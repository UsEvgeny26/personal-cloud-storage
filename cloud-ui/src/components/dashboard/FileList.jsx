import React from 'react';
import { File, Download, Trash2, Image as ImageIcon, FileText } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

export function FileList({ 
  files, 
  onFileClick,
  onDownloadFile, 
  onDeleteFile, 
  onTouchStart, 
  onTouchEnd, 
  onTouchMove 
}) {
  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
      return <ImageIcon className="w-6 h-6 text-purple-500" />;
    }
    if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) {
      return <FileText className="w-6 h-6 text-blue-500" />;
    }
    return <File className="w-6 h-6 text-gray-500" />;
  };

  return (
    <section>
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Файлы</h2>
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-100">
          {files.map((file, index) => (
            <div 
              key={file.name} 
              onClick={() => onFileClick(index)}
              onTouchStart={() => onTouchStart(file, false)}
              onTouchEnd={onTouchEnd}
              onTouchMove={onTouchMove}
              className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50 transition group gap-2 select-none"
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <div className="p-2 bg-gray-50 rounded-lg flex-shrink-0">
                  {getFileIcon(file.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 break-words line-clamp-2 leading-tight">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatBytes(file.size)} • {file.updated_at}</p>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownloadFile(file);}}
                  title="Скачать" 
                  className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFile(file);}}
                  title="Удалить" 
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}