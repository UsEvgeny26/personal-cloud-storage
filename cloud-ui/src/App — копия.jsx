import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, File, Upload, FolderPlus, LogOut, 
  Download, Trash2, ChevronRight, HardDrive, 
  Image as ImageIcon, FileText, Lock, User, 
  RefreshCw, X, UploadCloud, CheckCircle2, 
  AlertCircle, ChevronDown, ChevronUp, RotateCcw
} from 'lucide-react';
import { api } from './api';

const CHUNK_SIZE = 2 * 1024 * 1024; // 2 МБ на чанк

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// === ЭКРАН АВТОРИЗАЦИИ ===
function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.login(username, password);
      onLoginSuccess();
    } catch (err) {
      setError(err.message || 'Неверный логин или пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-indigo-50 rounded-xl mb-3">
            <HardDrive className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Личное облако</h1>
          <p className="text-xs text-gray-500 mt-1">Введите данные для доступа</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Логин</label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                placeholder="admin"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Пароль</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm transition shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
          >
            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}

// === ДАШБОРД ФАЙЛОВОГО МЕНЕДЖЕРА ===
function CloudDashboard({ onLogout }) {
  // 1. Инициализация и сохранение текущего пути в localStorage
  const [pathHistory, setPathHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('cloud_path_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('cloud_path_history', JSON.stringify(pathHistory));
  }, [pathHistory]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Пагинация
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Состояние Drag & Drop
  const [isDraggingOverWindow, setIsDraggingOverWindow] = useState(false);
  const dragCounterRef = useRef(0);

  // Модальные окна
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [conflictModalData, setConflictModalData] = useState(null); 

  // 2. Инициализация и восстановление очереди загрузок из localStorage
  const [uploadQueue, setUploadQueue] = useState(() => {
    try {
      const saved = localStorage.getItem('cloud_upload_queue');
      if (!saved) return [];
      const parsed = JSON.parse(saved);

      // Если страница была обновлена во время загрузки, помечаем файлы как прерванные
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

  // Сохранение очереди в localStorage (без тяжелых/несериализуемых объектов File)
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
    localStorage.setItem('cloud_upload_queue', JSON.stringify(queueToSave));
  }, [uploadQueue]);

  const [isWidgetOpen, setIsWidgetOpen] = useState(true);

  // Контекстное меню для мобилок
  const [actionItem, setActionItem] = useState(null);
  const timerRef = useRef(null);
  const isLongPressRef = useRef(false);

  const currentPathString = pathHistory.join('/');

  // Первоначальная загрузка директории
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

  // Инициализация загрузки (Проверка конфликтов)
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

  // Запуск фоновой загрузки из очереди
  useEffect(() => {
    const pendingItem = uploadQueue.find(i => i.status === 'pending' && i.file);
    if (pendingItem) {
      uploadFileChunks(pendingItem);
    }
  }, [uploadQueue]);

  // Чанковая загрузка файла
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
      alert('Файл был потерян из-за перезагрузки страницы. Пожалуйста, выберите файл повторно.');
      return;
    }
    setUploadQueue(prev => prev.map(q => 
      q.id === item.id ? { ...q, status: 'pending', progress: 0, errorMsg: '' } : q
    ));
  };

  // Drag & Drop
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

  // Touch handlers
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

  const folders = items.filter(i => i.is_dir);
  const files = items.filter(i => !i.is_dir);

  return (
    <div 
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-screen bg-gray-50 text-gray-800 flex flex-col font-sans relative pb-24"
    >
      {/* Полноэкранный оверлей Drag & Drop */}
      {isDraggingOverWindow && (
        <div className="fixed inset-0 bg-indigo-600/90 backdrop-blur-md z-50 flex flex-col items-center justify-center text-white p-6 transition-all duration-200 pointer-events-none">
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

      {/* Основная рабочая область */}
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
            {folders.length > 0 && (
              <section className="mb-8">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Папки</h2>
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                  {folders.map((folder) => (
                    <div 
                      key={folder.name}
                      onTouchStart={() => handleTouchStart(folder, true)}
                      onTouchEnd={handleTouchEnd}
                      onTouchMove={handleTouchMove}
                      className="group relative flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition select-none"
                    >
                      <div 
                        onClick={() => handleFolderClick(folder)}
                        className="flex items-center gap-3 min-w-0 flex-1 pr-2"
                      >
                        <Folder className="w-6 h-6 text-amber-500 fill-amber-100 group-hover:scale-110 transition-transform flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-700 break-words line-clamp-2 leading-tight">
                          {folder.name}
                        </span>
                      </div>
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(folder); }}
                        className="hidden md:block opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition flex-shrink-0"
                        title="Удалить папку"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Файлы</h2>
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {files.map((file) => (
                    <div 
                      key={file.name} 
                      onTouchStart={() => handleTouchStart(file, false)}
                      onTouchEnd={handleTouchEnd}
                      onTouchMove={handleTouchMove}
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
                          onClick={() => handleDownload(file)}
                          title="Скачать" 
                          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(file)}
                          title="Удалить" 
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {folders.length === 0 && files.length === 0 && (
                  <div className="p-12 text-center text-gray-400 text-sm">
                    Папка пуста. Перетащите файлы в окно или создайте новую папку.
                  </div>
                )}
              </div>

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
            </section>
          </>
        )}
      </main>

      {/* АДАПТИВНЫЙ ВИДЖЕТ ФОНОВОЙ ЗАГРУЗКИ (Исправлена разметка для sm) */}
      {uploadQueue.length > 0 && (
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
                          <button onClick={() => retryUpload(item)} title="Повторить" className="text-red-500 hover:text-red-700 flex items-center gap-1">
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
      )}

      {/* МОДАЛЬНОЕ ОКНО КОНФЛИКТОВ ИМЕН */}
      {conflictModalData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4 text-amber-600 border-b border-gray-100 pb-3">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-base font-bold text-gray-800">Обнаружены файлы с одинаковыми именами</h3>
            </div>

            <p className="text-xs text-gray-600 mb-4">
              В текущей папке уже существуют файлы с такими именами. Выберите действие для каждого файла:
            </p>

            <div className="max-h-60 overflow-y-auto space-y-3 mb-6 pr-1">
              {Object.keys(conflictModalData.filesMap).map((fname) => {
                const item = conflictModalData.filesMap[fname];
                const isConflict = conflictModalData.conflictNames.includes(fname);

                return (
                  <div key={fname} className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-medium text-gray-800">
                      <span className="truncate">{fname}</span>
                      <span className="text-gray-400 font-normal">{formatBytes(item.file.size)}</span>
                    </div>

                    {isConflict && (
                      <div className="flex items-center gap-2">
                        <select 
                          value={item.action}
                          onChange={(e) => {
                            const newAction = e.target.value;
                            setConflictModalData(prev => ({
                              ...prev,
                              filesMap: {
                                ...prev.filesMap,
                                [fname]: { ...prev.filesMap[fname], action: newAction }
                              }
                            }));
                          }}
                          className="w-full text-xs bg-white border border-gray-300 rounded-lg p-1.5 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="overwrite">Заменить существующий</option>
                          <option value="rename">Сохранить оба (переименовать)</option>
                          <option value="skip">Пропустить загрузку</option>
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-2 border-t border-gray-100 pt-4">
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => {
                    setConflictModalData(prev => {
                      const updated = { ...prev.filesMap };
                      Object.keys(updated).forEach(k => updated[k].action = 'overwrite');
                      return { ...prev, filesMap: updated };
                    });
                  }}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Заменить все
                </button>
                <span className="text-gray-300">•</span>
                <button 
                  onClick={() => {
                    setConflictModalData(prev => {
                      const updated = { ...prev.filesMap };
                      Object.keys(updated).forEach(k => updated[k].action = 'rename');
                      return { ...prev, filesMap: updated };
                    });
                  }}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Переименовать все
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 mt-2 sm:mt-0">
                <button 
                  onClick={() => setConflictModalData(null)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Отмена
                </button>
                <button 
                  onClick={() => {
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
                  className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-sm"
                >
                  Продолжить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Мобильное контекстное меню */}
      {actionItem && (
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
              <button 
                onClick={() => setActionItem(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {!actionItem.isFolder && (
                <button 
                  onClick={() => {
                    handleDownload(actionItem.item);
                    setActionItem(null);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-50 text-indigo-700 font-medium rounded-xl hover:bg-indigo-100 transition text-sm"
                >
                  <Download className="w-5 h-5 text-indigo-600" />
                  <span>Скачать файл</span>
                </button>
              )}

              <button 
                onClick={() => {
                  handleDelete(actionItem.item);
                  setActionItem(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-red-50 text-red-600 font-medium rounded-xl hover:bg-red-100 transition text-sm"
              >
                <Trash2 className="w-5 h-5 text-red-500" />
                <span>Удалить {actionItem.isFolder ? 'папку' : 'файл'}</span>
              </button>

              <button 
                onClick={() => setActionItem(null)}
                className="w-full py-2.5 text-gray-500 font-medium text-sm rounded-xl hover:bg-gray-100 transition mt-2"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно создания папки */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Новая папка</h3>
              <button onClick={() => setShowFolderModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateFolder}>
              <input 
                type="text" 
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Имя папки"
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 mb-4"
                autoFocus
                required
              />
              <div className="flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowFolderModal(false)}
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
      )}
    </div>
  );
}

// === ГЛАВНЫЙ КОМПОНЕНТ ===
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        await api.getFiles('');
        setIsAuthenticated(true);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setCheckingAuth(false);
      }
    }
    checkAuth();
  }, []);

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
        <span>Проверка доступа...</span>
      </div>
    );
  }

  return (
    <div>
      {isAuthenticated ? (
        <CloudDashboard onLogout={() => setIsAuthenticated(false)} />
      ) : (
        <Login onLoginSuccess={() => setIsAuthenticated(true)} />
      )}
    </div>
  );
}