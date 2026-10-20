import React from 'react';
import { AlertCircle } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

export function ConflictModal({ conflictData, onClose, onConfirm, setConflictModalData }) {
  if (!conflictData) return null;

  return (
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
          {Object.keys(conflictData.filesMap).map((fname) => {
            const item = conflictData.filesMap[fname];
            const isConflict = conflictData.conflictNames.includes(fname);

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
                  Object.keys(updated).forEach(k => updated[k].action = 'skip');
                  return { ...prev, filesMap: updated };
                });
              }}
              className="text-xs text-indigo-600 hover:underline"
            >
              Пропустить все
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 mt-2 sm:mt-0">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              Отмена
            </button>
            <button 
              onClick={onConfirm}
              className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-sm"
            >
              Продолжить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}