
import React from 'react';
import { AppState, CalculationMode, ViewMode } from '../types';
import { Calculator as CalcIcon, Scale, LayoutDashboard, Undo2, Redo2, Menu, NotebookPen, FileText, HardDrive } from 'lucide-react';
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
        { mode: ViewMode.CALCULATOR, label: 'Kalkulator', icon: <CalcIcon size={16}/> },
        { mode: ViewMode.LOGISTICS, label: 'Logistyka', icon: <LayoutDashboard size={16}/> },
        { mode: ViewMode.NOTES, label: 'Notatki', icon: <NotebookPen size={16}/> },
        { mode: ViewMode.DOCUMENTS, label: 'Dokumenty', icon: <FileText size={16}/> },
    ];

    return (
        <header className="w-full bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 h-16 shrink-0 z-50 transition-colors">
            <div className="max-w-[1920px] mx-auto px-4 h-full flex items-center justify-between gap-4">
                
                {/* 1. LEFT: Logo */}
                <div className="flex items-center gap-3 shrink-0">
                    <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 p-1.5 rounded-xl shadow-sm text-zinc-900">
                        <CalcIcon size={18} strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-none">
                            ProCalc
                        </h1>
                        <span className="hidden md:block text-[9px] font-semibold text-zinc-400 tracking-wider uppercase">Manager</span>
                    </div>
                </div>

                {/* 2. CENTER: Navigation (Desktop) - Scrollable on mobile */}
                <div className="flex-1 flex justify-center overflow-x-auto no-scrollbar mask-gradient px-2">
                    <div className="flex items-center gap-1 md:gap-2 p-1 bg-zinc-100/50 dark:bg-zinc-800/50 rounded-full border border-zinc-200/50 dark:border-zinc-700/50">
                        {navItems.map((item) => {
                            const isActive = appState.viewMode === item.mode;
                            return (
                                <button 
                                    key={item.mode}
                                    onClick={() => setAppState(prev => ({ ...prev, viewMode: item.mode }))}
                                    className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                                        isActive 
                                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-600' 
                                        : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50 dark:text-zinc-400 dark:hover:text-zinc-200'
                                    }`}
                                >
                                    <span className={isActive ? "text-yellow-600 dark:text-yellow-400" : "text-zinc-400"}>
                                        {item.icon}
                                    </span>
                                    <span className="hidden md:inline">{item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 3. RIGHT: Actions & Mode Switcher */}
                <div className="flex items-center gap-2 shrink-0">
                    
                    {/* Mode Switcher - Only in Calculator View */}
                    {appState.viewMode === ViewMode.CALCULATOR && (
                        <div className="hidden lg:flex bg-zinc-100/80 dark:bg-zinc-800 p-1 rounded-full items-center border border-zinc-200 dark:border-zinc-700 mr-2">
                            <button
                                onClick={() => setAppState(prev => ({ ...prev, mode: CalculationMode.INITIAL }))}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    !isFinal 
                                    ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-500' 
                                    : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400'
                                }`}
                            >
                                {!isFinal && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>}
                                Wstępna
                            </button>
                            
                            <button
                                onClick={() => setAppState(prev => ({ ...prev, mode: CalculationMode.FINAL }))}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    isFinal 
                                    ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-500' 
                                    : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400'
                                }`}
                            >
                                Końcowa
                                {isFinal && <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>}
                            </button>
                        </div>
                    )}

                    {/* Quick Access to Project Manager */}
                    <button 
                         onClick={onShowProjectManager}
                         className="hidden sm:flex p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"
                         title="Menedżer Projektów"
                    >
                         <HardDrive size={18} />
                    </button>

                     {/* Comparison Button */}
                     {appState.viewMode === ViewMode.CALCULATOR && (
                        <button 
                            onClick={onShowComparison} 
                            className="hidden sm:flex p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"
                            title="Porównaj Wersje"
                        >
                            <Scale size={18}/>
                        </button>
                     )}

                    <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700 mx-1 hidden sm:block"></div>

                    {/* Undo / Redo */}
                    <div className="hidden sm:flex items-center gap-0.5">
                         <button 
                            onClick={onUndo} 
                            disabled={!canUndo} 
                            className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full" 
                            title="Cofnij"
                         >
                             <Undo2 size={18}/>
                         </button>
                         <button 
                            onClick={onRedo} 
                            disabled={!canRedo} 
                            className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full" 
                            title="Ponów"
                         >
                             <Redo2 size={18}/>
                         </button>
                    </div>

                    {/* Menu */}
                    <DropdownMenu 
                        trigger={
                            <div className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-600 dark:text-zinc-300">
                                <Menu size={20} />
                            </div>
                        } 
                        items={menuItems}
                    />
                    <input type="file" ref={projectInputRef} className="hidden" accept=".json" onChange={handleImport} />
                </div>
            </div>
        </header>
    );
};
