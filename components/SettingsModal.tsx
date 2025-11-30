
import React, { useEffect, useState } from 'react';
import { GlobalSettings } from '../types';
import { Settings, X, Save, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: GlobalSettings;
  onSave: (settings: GlobalSettings) => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<GlobalSettings>({ ...settings });

  useEffect(() => {
    if (isOpen) setLocalSettings({ ...settings });
  }, [isOpen, settings]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = () => {
      onSave(localSettings);
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
        onClick={onClose}
    >
        <div 
            className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-slideUp border border-zinc-200 dark:border-zinc-700"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800">
                <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                    <Settings className="text-zinc-500" size={20}/> Globalne Ustawienia
                </h2>
                <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                    <X size={20}/>
                </button>
            </div>

            <div className="p-6 space-y-6">
                <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Opłata ORM (%)</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            step="0.1" 
                            min="0"
                            className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-400"
                            value={localSettings.ormFeePercent}
                            onChange={(e) => setLocalSettings(prev => ({ ...prev, ormFeePercent: parseFloat(e.target.value) || 0 }))}
                        />
                        <span className="absolute right-3 top-2.5 text-zinc-400 text-sm">%</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1">
                        <AlertCircle size={10}/> Doliczana do kosztów dostawców ORM
                    </p>
                </div>

                <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Ładowność Tira (kg)</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            min="0"
                            step="100"
                            className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-400"
                            value={localSettings.truckLoadCapacity}
                            onChange={(e) => setLocalSettings(prev => ({ ...prev, truckLoadCapacity: parseFloat(e.target.value) || 0 }))}
                        />
                        <span className="absolute right-3 top-2.5 text-zinc-400 text-sm">kg</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">Używana do automatycznego obliczania liczby aut</p>
                </div>
            </div>

            <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end gap-2 bg-zinc-50 dark:bg-zinc-800/50">
                <button 
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-200 rounded transition-colors"
                >
                    Anuluj
                </button>
                <button 
                    onClick={handleSave}
                    className="px-6 py-2 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white rounded transition-colors flex items-center gap-2"
                >
                    <Save size={14}/> Zapisz
                </button>
            </div>
        </div>
    </div>
  );
};
