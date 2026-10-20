export const api = {
  async login(username, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Ошибка входа');
    }
    return res.json();
  },

  async logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
  },

  async getFiles(path = '', page = 1, limit = 50) {
    const res = await fetch(`/api/files?path=${encodeURIComponent(path)}&page=${page}&limit=${limit}`);
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    if (!res.ok) throw new Error('Ошибка получения списка файлов');
    return res.json();
  },

  async checkConflicts(path, filenames) {
    const res = await fetch('/api/upload/check-conflicts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, filenames })
    });
    if (!res.ok) throw new Error('Ошибка проверки конфликтов имен');
    return res.json();
  },

  async uploadChunk(formData) {
    const res = await fetch('/api/upload/chunk', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Ошибка отправки чанка файла');
    return res.json();
  },

  async createFolder(path, folderName) {
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, folder_name: folderName })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Ошибка создания папки');
    }
    return res.json();
  },

  async downloadFile(path, filename) {
    const res = await fetch(`/api/download?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error('Ошибка скачивания файла');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  async deleteItem(path) {
    const res = await fetch(`/api/items?path=${encodeURIComponent(path)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Ошибка удаления');
    return res.json();
  },

  // Получение прямой ссылки для тегов <img>, <video>, <audio>
  getFileUrl(path, inline = false) {
    if (!path) return '';
    // Добавляем параметр inline=true для предпросмотра
    const query = inline ? `?path=${encodeURIComponent(path)}&inline=true` : `?path=${encodeURIComponent(path)}`;
    return `/api/download${query}`;
  },

  // Переименование файла/папки
  async renameItem(oldPath, newName) {
    const res = await fetch('/api/files/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_path: oldPath, new_name: newName }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Ошибка переименования');
    }
    return res.json();
  }
};