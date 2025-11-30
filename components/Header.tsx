
import React from 'react';
import { AppState, CalculationMode, ViewMode } from '../types';
import { Calculator as CalcIcon, Scale, LayoutDashboard, Undo2, Redo2, Menu, NotebookPen, FileText, HardDrive, Square } from 'lucide-react';
import { DropdownMenu } from './DropdownMenu';

interface Props {
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onShowComparison: () => void;
    onShowProjectManager: () => void;
    menuItems: any[];
    projectInputRef: React.RefObject<HTMLInputElement>;
    handleImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Header: React.FC<Props> = ({ 
    appState, 
    setAppState, 
    onUndo, 
    onRedo, 
    canUndo, 
    canRedo, 
    onShowComparison, 
    onShowProjectManager,
    menuItems,
    projectInputRef,
    handleImport
}) => {
    
    const isFinal = appState.mode === CalculationMode.FINAL;

    const navItems = [
        { mode: ViewMode.CALCULATOR, label: 'Kalkulator', icon: <CalcIcon size={14}/> },
        { mode: ViewMode.LOGISTICS, label: 'Logistyka', icon: <LayoutDashboard size={14}/> },
        { mode: ViewMode.NOTES, label: 'Notatki', icon: <NotebookPen size={14}/> },
        { mode: ViewMode.DOCUMENTS, label: 'Dokumenty', icon: <FileText size={14}/> },
    ];

    return (
        <header className="w-full bg-white dark:bg-black h-14 shrink-0 z-50 transition-colors border-b border-zinc-200 dark:border-zinc-800">
            <div className="max-w-[1920px] mx-auto px-6 h-full flex items-center justify-between">
                
                {/* 1. LEFT: Brand */}
                <div className="flex items-center gap-3 shrink-0">
                    <div className="w-6 h-6 bg-zinc-900 dark:bg-white text-white dark:text-black flex items-center justify-center rounded-sm">
                        <CalcIcon size={14} strokeWidth={3} />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white uppercase leading-none font-mono">
                            ProCalc<span className="text-zinc-400">.v1</span>
                        </h1>
                    </div>
                </div>

                {/* 2. CENTER: Navigation Tabs (Underline Style) */}
                <div className="flex-1 flex justify-center h-full">
                    <div className="flex h-full gap-8">
                        {navItems.map((item) => {
                            const isActive = appState.viewMode === item.mode;
                            return (
                                <button 
                                    key={item.mode}
                                    onClick={() => setAppState(prev => ({ ...prev, viewMode: item.mode }))}
                                    className={`relative h-full flex items-center gap-2 text-xs font-medium uppercase tracking-wide transition-all duration-200 border-b-2 ${
                                        isActive 
                                        ? 'text-zinc-900 dark:text-white border-zinc-900 dark:border-white' 
                                        : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 border-transparent hover:border-zinc-200'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 3. RIGHT: Actions & Mode Switcher */}
                <div className="flex items-center gap-4 shrink-0">
                    
                    {/* Mode Switcher */}
                    {appState.viewMode === ViewMode.CALCULATOR && (
                        <div className="hidden lg:flex items-center border border-zinc-200 dark:border-zinc-800 rounded-sm overflow-hidden h-8">
                            <button
                                onClick={() => setAppState(prev => ({ ...prev, mode: CalculationMode.INITIAL }))}
                                className={`px-3 h-full text-[10px] font-bold uppercase tracking-wider transition-all flex items-center ${
                                    !isFinal 
                                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' 
                                    : 'bg-transparent text-zinc-400 hover:text-zinc-600'
                                }`}
                            >
                                Wstępna
                            </button>
                            <div className="w-px h-full bg-zinc-200 dark:bg-zinc-800"></div>
                            <button
                                onClick={() => setAppState(prev => ({ ...prev, mode: CalculationMode.FINAL }))}
                                className={`px-3 h-full text-[10px] font-bold uppercase tracking-wider transition-all flex items-center ${
                                    isFinal 
                                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' 
                                    : 'bg-transparent text-zinc-400 hover:text-zinc-600'
                                }`}
                            >
                                Końcowa
                            </button>
                        </div>
                    )}

                    <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block"></div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                         <button 
                             onClick={onShowProjectManager}
                             className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                             title="Menedżer Projektów"
                        >
                             <HardDrive size={16} />
                        </button>

                         {appState.viewMode === ViewMode.CALCULATOR && (
                            <button 
                                onClick={onShowComparison} 
                                className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                                title="Porównaj Wersje"
                            >
                                <Scale size={16}/>
                            </button>
                         )}

                         <div className="hidden sm:flex items-center gap-1">
                             <button 
                                onClick={onUndo} 
                                disabled={!canUndo} 
                                className="w-8 h-8 flex items-center justify-center text-zinc-500 disabled:opacity-20 hover:text-zinc-900 dark:hover:text-white transition-colors" 
                                title="Cofnij"
                             >
                                 <Undo2 size={16}/>
                             </button>
                             <button 
                                onClick={onRedo} 
                                disabled={!canRedo} 
                                className="w-8 h-8 flex items-center justify-center text-zinc-500 disabled:opacity-20 hover:text-zinc-900 dark:hover:text-white transition-colors" 
                                title="Ponów"
                             >
                                 <Redo2 size={16}/>
                             </button>
                        </div>

                        <DropdownMenu 
                            trigger={
                                <div className="w-8 h-8 flex items-center justify-center text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-sm transition-colors">
                                    <Menu size={16} />
                                </div>
                            } 
                            items={menuItems}
                        />
                    </div>
                    <input type="file" ref={projectInputRef} className="hidden" accept=".json" onChange={handleImport} />
                </div>
            </div>
        </header>
    );
};
