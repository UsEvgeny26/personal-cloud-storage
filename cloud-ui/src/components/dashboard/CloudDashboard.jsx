import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderPlus, Upload, LogOut, ChevronRight, HardDrive, 
  RefreshCw, UploadCloud 
} from 'lucide-react';

import { api } from '../../api';
import { CHUNK_SIZE, STORAGE_KEYS } from '../../constants/config';

import { FolderList } from './FolderList';
import { FileList } from './FileList';
import { UploadWidget } from '../upload/UploadWidget';
import { CreateFolderModal } from '../modals/CreateFolderModal';
import { ConflictModal } from '../modals/ConflictModal';
import { MobileActionMenu } from '../modals/MobileActionMenu';
import { FilePreviewModal } from '../modals/FilePreviewModal';

export function CloudDashboard({ onLogout }) {
  // 1. Инициализация пути
  const [pathHistory, setPathHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PATH_HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PATH_HISTORY, JSON.stringify(pathHistory));
  }, [pathHistory]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Пагинация
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Состояние просмотра файлов (индекс выбранного файла)
  const [previewIndex, setPreviewIndex] = useState(null);

  // Drag & Drop
  const [isDraggingOverWindow, setIsDraggingOverWindow] = useState(false);
  const dragCounterRef = useRef(0);

  // Модалки
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [conflictModalData, setConflictModalData] = useState(null); 

  // Очередь загрузок
  const [uploadQueue, setUploadQueue] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.UPLOAD_QUEUE);
      if (!saved) return [];
      const parsed = JSON.parse(saved);

      return parsed.map(item => {
        if (item.status === 'uploading' || item.status === 'pending') {
          return { 
            ...item, 
            status: 'error', 
            errorMsg: 'Прервано (страница была обновлена)' 
          };
        }
        return item;
      });
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const queueToSave = uploadQueue.map(item => ({
      id: item.id,
      fileName: item.fileName || item.file?.name,
      fileSize: item.fileSize || item.file?.size,
      path: item.path,
      progress: item.progress,
      status: item.status,
      conflictAction: item.conflictAction,
      errorMsg: item.errorMsg
    }));
    localStorage.setItem(STORAGE_KEYS.UPLOAD_QUEUE, JSON.stringify(queueToSave));
  }, [uploadQueue]);

  const [isWidgetOpen, setIsWidgetOpen] = useState(true);

  // Тач-меню
  const [actionItem, setActionItem] = useState(null);
  const timerRef = useRef(null);
  const isLongPressRef = useRef(false);

  const currentPathString = pathHistory.join('/');

  const fetchFiles = async (isAppend = false, nextPage = 1) => {
    if (isAppend) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await api.getFiles(currentPathString, nextPage, 50);
      if (isAppend) {
        setItems(prev => [...prev, ...data.items]);
      } else {
        setItems(data.items);
      }
      setHasMore(data.has_more);
      setPage(data.page);
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') {
        onLogout();
      } else if (!isAppend) {
        alert('Ошибка при загрузке файлов: ' + err.message);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchFiles(false, 1);
  }, [pathHistory]);

  const handleLoadMore = () => {
    if (hasMore && !loadingMore) {
      fetchFiles(true, page + 1);
    }
  };

  const processSelectedFiles = async (fileList) => {
    const rawFiles = Array.from(fileList);
    if (rawFiles.length === 0) return;

    const filenames = rawFiles.map(f => f.name);

    try {
      const res = await api.checkConflicts(currentPathString, filenames);
      const conflicts = res.conflicts;

      if (conflicts && conflicts.length > 0) {
        const fileMap = rawFiles.reduce((acc, file) => {
          acc[file.name] = {
            file,
            action: conflicts.includes(file.name) ? 'ask' : 'overwrite'
          };
          return acc;
        }, {});

        setConflictModalData({
          filesMap: fileMap,
          conflictNames: conflicts,
          targetPath: currentPathString
        });
      } else {
        const newQueueItems = rawFiles.map(file => ({
          id: Math.random().toString(36).substring(2, 9),
          file,
          fileName: file.name,
          fileSize: file.size,
          path: currentPathString,
          progress: 0,
          status: 'pending',
          conflictAction: 'overwrite',
          errorMsg: ''
        }));
        setUploadQueue(prev => [...prev, ...newQueueItems]);
      }
    } catch (err) {
      alert('Ошибка при подготовке к загрузке: ' + err.message);
    }
  };

  useEffect(() => {
    const pendingItem = uploadQueue.find(i => i.status === 'pending' && i.file);
    if (pendingItem) {
      uploadFileChunks(pendingItem);
    }
  }, [uploadQueue]);

  const uploadFileChunks = async (queueItem) => {
    if (queueItem.conflictAction === 'skip') {
      setUploadQueue(prev => prev.map(item => 
        item.id === queueItem.id ? { ...item, status: 'skipped', progress: 100 } : item
      ));
      return;
    }

    setUploadQueue(prev => prev.map(item => 
      item.id === queueItem.id ? { ...item, status: 'uploading' } : item
    ));

    const file = queueItem.file;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1;
    const uploadId = queueItem.id + '_' + Date.now();

    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(file.size, start + CHUNK_SIZE);
        const chunkBlob = file.slice(start, end);

        const formData = new FormData();
        formData.append('upload_id', uploadId);
        formData.append('filename', file.name);
        formData.append('path', queueItem.path);
        formData.append('chunk_index', i);
        formData.append('total_chunks', totalChunks);
        formData.append('conflict_action', queueItem.conflictAction);
        formData.append('file', chunkBlob, file.name);

        await api.uploadChunk(formData);

        const currentProgress = Math.round(((i + 1) / totalChunks) * 100);
        setUploadQueue(prev => prev.map(item => 
          item.id === queueItem.id ? { ...item, progress: currentProgress } : item
        ));
      }

      setUploadQueue(prev => prev.map(item => 
        item.id === queueItem.id ? { ...item, status: 'completed', progress: 100 } : item
      ));

      if (queueItem.path === currentPathString) {
        fetchFiles(false, 1);
      }
    } catch (err) {
      setUploadQueue(prev => prev.map(item => 
        item.id === queueItem.id ? { 
          ...item, 
          status: 'error', 
          errorMsg: err.message || 'Сбой подключения' 
        } : item
      ));
    }
  };

  const retryUpload = (item) => {
    if (!item.file) {
      alert('Файл был потерян из-за перезагрузки страницы. Выберите файл повторно.');
      return;
    }
    setUploadQueue(prev => prev.map(q => 
      q.id === item.id ? { ...q, status: 'pending', progress: 0, errorMsg: '' } : q
    ));
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOverWindow(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDraggingOverWindow(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverWindow(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processSelectedFiles(files);
    }
  };

  const handleTouchStart = (item, isFolder) => {
    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (navigator.vibrate) {
        try { navigator.vibrate(50); } catch (e) {}
      }
      setActionItem({ item, isFolder });
    }, 500);
  };

  const handleTouchEnd = () => { if (timerRef.current) clearTimeout(timerRef.current); };
  const handleTouchMove = () => { if (timerRef.current) clearTimeout(timerRef.current); };

  const handleFolderClick = (folder) => {
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
    setPathHistory([...pathHistory, folder.name]);
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      await api.createFolder(currentPathString, newFolderName.trim());
      setNewFolderName('');
      setShowFolderModal(false);
      fetchFiles(false, 1);
    } catch (err) {
      alert('Ошибка при создании папки: ' + err.message);
    }
  };

  const handleDownload = async (item) => {
    const itemPath = currentPathString ? `${currentPathString}/${item.name}` : item.name;
    try {
      await api.downloadFile(itemPath, item.name);
    } catch (err) {
      alert('Ошибка скачивания: ' + err.message);
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Вы действительно хотите удалить "${item.name}"?`)) return;

    const itemPath = currentPathString ? `${currentPathString}/${item.name}` : item.name;
    try {
      await api.deleteItem(itemPath);
      fetchFiles(false, 1);
    } catch (err) {
      alert('Ошибка при удалении: ' + err.message);
    }
  };

  const handleRename = async (item, newName) => {
    const oldPath = currentPathString ? `${currentPathString}/${item.name}` : item.name;
    try {
      await api.renameItem(oldPath, newName);
      fetchFiles(false, 1);
    } catch (err) {
      alert('Ошибка при переименовании: ' + err.message);
    }
  };

  const folders = items.filter(i => i.is_dir);
  const files = items.filter(i => !i.is_dir);

  // Навигация след/пред с зацикливанием
  const handleNextPreview = () => {
    if (files.length === 0) return;
    setPreviewIndex((prev) => (prev + 1) % files.length);
  };

  const handlePrevPreview = () => {
    if (files.length === 0) return;
    setPreviewIndex((prev) => (prev - 1 + files.length) % files.length);
  };

  return (
    <div 
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-screen bg-gray-50 text-gray-800 flex flex-col font-sans relative pb-24"
    >
      {/* Drag & Drop Overlay */}
      {isDraggingOverWindow && (
        <div className="fixed inset-0 bg-indigo-600/90 backdrop-blur-md z-50 flex flex-col items-center justify-center text-white p-6 pointer-events-none">
          <div className="border-4 border-dashed border-white/60 rounded-3xl p-12 flex flex-col items-center justify-center max-w-lg w-full text-center bg-indigo-700/30">
            <UploadCloud className="w-20 h-20 text-white mb-4 animate-bounce" />
            <h2 className="text-2xl font-bold mb-2">Перетащите файлы сюда</h2>
            <p className="text-indigo-100 text-sm">
              Отпустите мышь, чтобы начать загрузку в папку: <br />
              <span className="font-semibold text-white mt-1 inline-block">
                {currentPathString ? `/${currentPathString}` : '/ (Корень)'}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Шапка */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 font-bold text-lg sm:text-xl text-slate-800">
          <HardDrive className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600" />
          <span>Personal Cloud</span>
        </div>

        <button 
          onClick={async () => {
            await api.logout();
            onLogout();
          }}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Выйти</span>
        </button>
      </header>

      {/* Рабочая область */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <nav className="flex items-center gap-1 text-sm font-medium text-gray-600 overflow-x-auto py-1">
            <button 
              onClick={() => setPathHistory([])}
              className={`hover:text-indigo-600 whitespace-nowrap ${pathHistory.length === 0 ? 'text-indigo-600 font-semibold' : ''}`}
            >
              Главная
            </button>
            {pathHistory.map((folderName, index) => (
              <React.Fragment key={index}>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <button 
                  onClick={() => setPathHistory(pathHistory.slice(0, index + 1))}
                  className={`hover:text-indigo-600 whitespace-nowrap ${index === pathHistory.length - 1 ? 'text-indigo-600 font-semibold' : ''}`}
                >
                  {folderName}
                </button>
              </React.Fragment>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => setShowFolderModal(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition text-sm"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Папка</span>
            </button>
            <label className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl cursor-pointer transition text-sm shadow-sm">
              <Upload className="w-4 h-4" />
              <span>Загрузить</span>
              <input 
                type="file" 
                className="hidden" 
                multiple 
                onChange={(e) => {
                  if (e.target.files) processSelectedFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20 text-gray-400 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            <span>Загрузка содержимого...</span>
          </div>
        ) : (
          <>
            <FolderList 
              folders={folders}
              onFolderClick={handleFolderClick}
              onDeleteFolder={handleDelete}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchMove}
            />

            <FileList 
              files={files}
              onFileClick={(index) => setPreviewIndex(index)}
              onDownloadFile={handleDownload}
              onDeleteFile={handleDelete}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchMove}
            />

            {(folders.length === 0 && files.length === 0) && (
              <div className="p-12 text-center text-gray-400 text-sm bg-white rounded-2xl border border-gray-200">
                Папка пуста. Перетащите файлы в окно или создайте новую папку.
              </div>
            )}

            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-medium text-sm transition shadow-sm inline-flex items-center gap-2"
                >
                  {loadingMore && <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />}
                  {loadingMore ? 'Загрузка элементов...' : 'Загрузить ещё'}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Модалка предпросмотра файлов */}
      {previewIndex !== null && (
        <FilePreviewModal 
          files={files}
          currentIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
          onNext={handleNextPreview}
          onPrev={handlePrevPreview}
          onDownload={handleDownload}
          onDelete={handleDelete}
          onRename={handleRename}
          currentPath={currentPathString}
        />
      )}

      {/* Модальные компоненты и Виджеты */}
      <UploadWidget 
        uploadQueue={uploadQueue}
        setUploadQueue={setUploadQueue}
        isWidgetOpen={isWidgetOpen}
        setIsWidgetOpen={setIsWidgetOpen}
        retryUpload={retryUpload}
      />

      <CreateFolderModal 
        show={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        onSubmit={handleCreateFolder}
        folderName={newFolderName}
        setFolderName={setNewFolderName}
      />

      <ConflictModal 
        conflictData={conflictModalData}
        onClose={() => setConflictModalData(null)}
        setConflictModalData={setConflictModalData}
        onConfirm={() => {
          const newQueue = Object.values(conflictModalData.filesMap).map(entry => ({
            id: Math.random().toString(36).substring(2, 9),
            file: entry.file,
            fileName: entry.file.name,
            fileSize: entry.file.size,
            path: conflictModalData.targetPath,
            progress: 0,
            status: 'pending',
            conflictAction: entry.action,
            errorMsg: ''
          }));

          setUploadQueue(prev => [...prev, ...newQueue]);
          setConflictModalData(null);
        }}
      />

      <MobileActionMenu 
        actionItem={actionItem}
        onClose={() => setActionItem(null)}
        onDownload={handleDownload}
        onDelete={handleDelete}
      />
    </div>
  );
}