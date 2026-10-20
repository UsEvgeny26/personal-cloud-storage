import React, { useState, useEffect } from 'react';
import { 
  X, ChevronLeft, ChevronRight, Download, Trash2, Edit2, 
  File, FileText, Music, Check, RefreshCw, ExternalLink
} from 'lucide-react';
import { formatBytes } from '../../utils/formatters';
import { api } from '../../api';

export function FilePreviewModal({ 
  files, 
  currentIndex, 
  onClose, 
  onNext, 
  onPrev, 
  onDownload, 
  onDelete, 
  onRename,
  currentPath 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Определение мобильного устройства
  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const currentFile = files[currentIndex];

  const itemPath = currentFile 
    ? (currentPath ? `${currentPath}/${currentFile.name}` : currentFile.name) 
    : '';
  const fileUrl = itemPath ? api.getFileUrl(itemPath, true) : '';
  const ext = currentFile?.name.split('.').pop().toLowerCase() || '';

  // Определение типа файла
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
  const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
  const isAudio = ['mp3', 'wav', 'm4a', 'flac'].includes(ext);
  const isPdf = ext === 'pdf';

  useEffect(() => {
    if (currentFile) {
      setNewName(currentFile.name);
      setIsEditing(false);
      
      // На мобильных устройствах для PDF лоадер сразу выключаем
      if (isPdf && isMobile) {
        setIsLoading(false);
      } else if (isImage || isVideo || isPdf) {
        setIsLoading(true);
      } else {
        setIsLoading(false);
      }
    }
  }, [currentIndex, currentFile, isMobile, isPdf, isImage, isVideo]);

  // Защитный таймаут для PDF на ПК (если iframe вдруг задерживает onLoad)
  useEffect(() => {
    let timer;
    if (isLoading && isPdf && !isMobile) {
      timer = setTimeout(() => {
        setIsLoading(false);
      }, 2500);
    }
    return () => clearTimeout(timer);
  }, [isLoading, isPdf, isMobile, currentIndex]);

  // Навигация с клавиатуры
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isEditing) return;
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, files, isEditing]);

  if (!currentFile) return null;

  const handleSaveRename = (e) => {
    e.preventDefault();
    if (newName.trim() && newName !== currentFile.name) {
      onRename(currentFile, newName.trim());
    }
    setIsEditing(false);
  };

  const renderContent = () => {
    if (isImage) {
      return (
        <img 
          key={fileUrl} 
          src={fileUrl} 
          alt={currentFile.name} 
          onLoad={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
          className={`max-h-[75vh] max-w-full object-contain rounded-lg shadow-xl transition-opacity duration-200 ${
            isLoading ? 'hidden' : 'block'
          }`}
        />
      );
    }

    if (isVideo) {
      return (
        <video 
          key={fileUrl}
          src={fileUrl} 
          controls 
          autoPlay
          onLoadedData={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
          className={`max-h-[75vh] max-w-full rounded-lg shadow-xl ${
            isLoading ? 'hidden' : 'block'
          }`}
        />
      );
    }

    if (isAudio) {
      return (
        <div className="flex flex-col items-center bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl max-w-md w-full">
          <div className="p-6 bg-indigo-500/10 rounded-full mb-6">
            <Music className="w-16 h-16 text-indigo-400 animate-pulse" />
          </div>
          <p className="text-white text-base font-medium mb-4 text-center break-all">{currentFile.name}</p>
          <audio src={fileUrl} controls autoPlay className="w-full" />
        </div>
      );
    }

    if (isPdf) {
      // Для мобильных устройств: специальная карточка вместо iframe
      if (isMobile) {
        return (
          <div className="flex flex-col items-center justify-center p-6 bg-slate-800/90 rounded-2xl border border-slate-700 max-w-sm w-full text-center shadow-xl">
            <div className="p-4 bg-red-500/10 rounded-2xl mb-4">
              <FileText className="w-12 h-12 text-red-400" />
            </div>
            <p className="text-slate-100 font-semibold text-base break-all mb-1">{currentFile.name}</p>
            <p className="text-slate-400 text-xs mb-6">{formatBytes(currentFile.size)}</p>

            <a 
              href={fileUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-sm font-medium transition shadow-md flex items-center justify-center gap-2 mb-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Открыть PDF</span>
            </a>
          </div>
        );
      }

      // Для ПК: iframe на 70% ширины экрана (70vw)
      return (
        <iframe 
          key={fileUrl}
          src={fileUrl} 
          title={currentFile.name}
          onLoad={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
          className={`w-full md:w-[85svw] h-[85vh] rounded-xl bg-white shadow-xl ${
            isLoading ? 'hidden' : 'block'
          }`}
        />
      );
    }

    // Заглушка для остальных файлов
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-800/80 rounded-2xl border border-slate-700 max-w-sm w-full text-center">
        <File className="w-20 h-20 text-slate-400 mb-4" />
        <p className="text-slate-200 font-medium text-sm break-all mb-1">{currentFile.name}</p>
        <p className="text-slate-400 text-xs mb-4">{formatBytes(currentFile.size)}</p>
        <span className="text-xs text-slate-400 bg-slate-700/50 px-3 py-1.5 rounded-lg">
          Предпросмотр недоступен
        </span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col justify-between p-4 sm:p-6 select-none animate-fadeIn">
      {/* Верхняя панель */}
      <div className="flex items-center justify-between gap-4 text-white z-10">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {isEditing ? (
            <form onSubmit={handleSaveRename} className="flex items-center gap-2 max-w-md w-full">
              <input 
                type="text" 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-slate-800 text-white text-sm px-3 py-1.5 rounded-lg border border-indigo-500 focus:outline-none w-full"
                autoFocus
              />
              <button type="submit" className="p-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white">
                <Check className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setIsEditing(false)} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-sm sm:text-base font-semibold truncate text-slate-100">
                {currentFile.name}
              </h3>
              <button 
                onClick={() => setIsEditing(true)} 
                title="Переименовать"
                className="p-1 text-slate-400 hover:text-white transition flex-shrink-0"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <span className="text-xs text-slate-400 font-medium">
            {currentIndex + 1} / {files.length}
          </span>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Центральная область просмотра */}
      <div className="relative flex-1 flex items-center justify-center my-4 overflow-hidden">
        {/* Левая стрелка */}
        {files.length > 1 && (
          <button 
            onClick={onPrev}
            className="absolute left-0 sm:left-2 top-1/2 -translate-y-1/2 p-3 text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800/90 border border-slate-700/50 rounded-full transition z-10 shadow-lg"
            title="Предыдущий файл (←)"
          >
            <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
        )}

        {/* Индикатор загрузки */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 text-gray-400 py-20 z-10">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            <span className="text-sm font-medium text-slate-300">Загрузка файла...</span>
          </div>
        )}

        {/* Контент */}
        <div className="flex items-center justify-center max-w-full max-h-full p-2">
          {renderContent()}
        </div>

        {/* Правая стрелка */}
        {files.length > 1 && (
          <button 
            onClick={onNext}
            className="absolute right-0 sm:right-2 top-1/2 -translate-y-1/2 p-3 text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800/90 border border-slate-700/50 rounded-full transition z-10 shadow-lg"
            title="Следующий файл (→)"
          >
            <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
        )}
      </div>

      {/* Нижняя панель управления */}
      <div className="flex items-center justify-center gap-3 z-10">
        <button 
          onClick={() => onDownload(currentFile)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs sm:text-sm font-medium border border-slate-700/60 transition shadow-sm"
        >
          <Download className="w-4 h-4 text-indigo-400" />
          <span>Скачать</span>
        </button>

        {/* <button 
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs sm:text-sm font-medium border border-slate-700/60 transition shadow-sm"
        >
          <Edit2 className="w-4 h-4 text-amber-400" />
          <span>Переименовать</span>
        </button> */}

        <button 
          onClick={() => onDelete(currentFile)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-red-900/40 text-slate-200 hover:text-red-300 rounded-xl text-xs sm:text-sm font-medium border border-slate-700/60 transition shadow-sm"
        >
          <Trash2 className="w-4 h-4 text-red-400" />
          <span>Удалить</span>
        </button>
      </div>
    </div>
  );
}