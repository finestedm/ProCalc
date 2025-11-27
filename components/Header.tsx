import React from 'react';
import { AppState, CalculationMode, ViewMode } from '../types';
import { Calculator as CalcIcon, Scale, LayoutDashboard, Undo2, Redo2, Menu, NotebookPen, FileText, Check } from 'lucide-react';
import { DropdownMenu } from './DropdownMenu';

interface Props {
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onShowComparison: () => void;
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
        <>
            {/* Top Bar: Logo & Actions - STICKY */}
            <div className="sticky top-0 z-50 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-16 flex justify-between items-center">
                    {/* Logo Area */}
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 p-2 rounded-lg shadow-sm text-zinc-900">
                            <CalcIcon size={20} strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-none">
                                ProCalc
                            </h1>
                            <span className="text-[10px] font-semibold text-zinc-400 tracking-wider uppercase">Manager Projektów</span>
                        </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-3">
                         <div className="hidden md:flex items-center gap-1 bg-zinc-50 dark:bg-zinc-800 p-1 rounded-md border border-zinc-200 dark:border-zinc-700 mr-2">
                             <button 
                                onClick={onUndo} 
                                disabled={!canUndo} 
                                className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 disabled:opacity-30 transition-colors" 
                                title="Cofnij (Ctrl+Z)"
                             >
                                 <Undo2 size={18}/>
                             </button>
                             <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>
                             <button 
                                onClick={onRedo} 
                                disabled={!canRedo} 
                                className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 disabled:opacity-30 transition-colors" 
                                title="Ponów (Ctrl+Shift+Z)"
                             >
                                 <Redo2 size={18}/>
                             </button>
                         </div>
                         
                         <DropdownMenu 
                            trigger={
                                <div className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-600 dark:text-zinc-300">
                                    <Menu size={20} />
                                </div>
                            } 
                            items={menuItems}
                         />
                         <input type="file" ref={projectInputRef} className="hidden" accept=".json" onChange={handleImport} />
                    </div>
                </div>
            </div>

            {/* Bottom Bar: Navigation & Modes - SCROLLS AWAY (Not sticky) */}
            <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 relative z-40">
                <div className="max-w-[1600px] mx-auto px-4 md:px-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        
                        {/* Navigation Tabs */}
                        <div className="flex items-center gap-6 h-12 overflow-x-auto w-full md:w-auto no-scrollbar">
                            {navItems.map((item) => {
                                const isActive = appState.viewMode === item.mode;
                                return (
                                    <button 
                                        key={item.mode}
                                        onClick={() => setAppState(prev => ({ ...prev, viewMode: item.mode }))}
                                        className={`h-full flex items-center gap-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap px-1 ${
                                            isActive 
                                            ? 'border-yellow-500 text-zinc-900 dark:text-white' 
                                            : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                                        }`}
                                    >
                                        <span className={isActive ? "text-yellow-600 dark:text-yellow-400" : "text-zinc-400"}>
                                            {item.icon}
                                        </span>
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Segmented Control for Calculation Mode */}
                        {appState.viewMode === ViewMode.CALCULATOR && (
                            <div className="flex items-center gap-3 py-2">
                                {/* Comparison Button */}
                                <button 
                                    onClick={onShowComparison} 
                                    className="p-2 text-zinc-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/10"
                                    title="Porównaj Wersje"
                                >
                                    <Scale size={18}/>
                                </button>

                                {/* Segmented Control */}
                                <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg flex items-center shadow-inner">
                                    <button
                                        onClick={() => setAppState(prev => ({ ...prev, mode: CalculationMode.INITIAL }))}
                                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-2 ${
                                            !isFinal 
                                            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm ring-1 ring-black/5' 
                                            : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400'
                                        }`}
                                    >
                                        Wstępna
                                        {!isFinal && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>}
                                    </button>
                                    
                                    <button
                                        onClick={() => setAppState(prev => ({ ...prev, mode: CalculationMode.FINAL }))}
                                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-2 ${
                                            isFinal 
                                            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm ring-1 ring-black/5' 
                                            : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400'
                                        }`}
                                    >
                                        Końcowa
                                        {isFinal && <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};