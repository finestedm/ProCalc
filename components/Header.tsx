import React from 'react';
import { AppState, CalculationMode, ViewMode } from '../types';
import { Calculator as CalcIcon, Scale, LayoutDashboard, Undo2, Redo2, Menu, NotebookPen, FileText, Upload } from 'lucide-react';
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

    return (
        <>
            {/* Top Bar: Logo & Actions - STICKY */}
            <div className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-900 dark:bg-black shadow-md text-white">
                <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-14 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-yellow-500 p-1.5 rounded shadow-lg shadow-yellow-500/20">
                            <CalcIcon className="text-zinc-900" size={20} />
                        </div>
                        <h1 className="text-lg font-bold tracking-tight">ProCalc <span className="text-yellow-500">Manager</span></h1>
                    </div>

                    <div className="flex items-center gap-3">
                         <div className="flex bg-zinc-800 rounded-lg p-0.5 border border-zinc-700 mr-2">
                             <button onClick={onUndo} disabled={!canUndo} className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors" title="Cofnij (Ctrl+Z)">
                                 <Undo2 size={16}/>
                             </button>
                             <button onClick={onRedo} disabled={!canRedo} className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors" title="Ponów (Ctrl+Shift+Z)">
                                 <Redo2 size={16}/>
                             </button>
                         </div>
                         <DropdownMenu 
                            trigger={<Menu size={20} className="text-zinc-300 hover:text-white" />} 
                            items={menuItems}
                         />
                         <input type="file" ref={projectInputRef} className="hidden" accept=".json" onChange={handleImport} />
                    </div>
                </div>
            </div>

            {/* Bottom Bar: Navigation & Modes - SCROLLS AWAY */}
            <div className="bg-zinc-900 dark:bg-black border-b border-zinc-800 shadow-sm relative z-40 text-white">
                <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-14 flex flex-col md:flex-row justify-between items-center gap-2 overflow-x-auto">
                    
                    {/* View Switcher (Tabs) */}
                    <div className="flex items-center gap-1 h-full">
                        <button 
                            onClick={() => setAppState(prev => ({ ...prev, viewMode: ViewMode.CALCULATOR }))}
                            className={`h-full px-4 flex items-center gap-2 text-sm font-semibold border-b-2 transition-colors ${appState.viewMode === ViewMode.CALCULATOR ? 'border-yellow-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
                        >
                            <CalcIcon size={16}/> Kalkulator
                        </button>
                        <button 
                            onClick={() => setAppState(prev => ({ ...prev, viewMode: ViewMode.LOGISTICS }))}
                            className={`h-full px-4 flex items-center gap-2 text-sm font-semibold border-b-2 transition-colors ${appState.viewMode === ViewMode.LOGISTICS ? 'border-yellow-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
                        >
                            <LayoutDashboard size={16}/> Logistyka
                        </button>
                        <button 
                            onClick={() => setAppState(prev => ({ ...prev, viewMode: ViewMode.NOTES }))}
                            className={`h-full px-4 flex items-center gap-2 text-sm font-semibold border-b-2 transition-colors ${appState.viewMode === ViewMode.NOTES ? 'border-yellow-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
                        >
                            <NotebookPen size={16}/> Notatki
                        </button>
                        <button 
                            onClick={() => setAppState(prev => ({ ...prev, viewMode: ViewMode.DOCUMENTS }))}
                            className={`h-full px-4 flex items-center gap-2 text-sm font-semibold border-b-2 transition-colors ${appState.viewMode === ViewMode.DOCUMENTS ? 'border-yellow-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
                        >
                            <FileText size={16}/> Dokumenty
                        </button>
                    </div>

                    {/* Calculation Mode & Compare */}
                    {appState.viewMode === ViewMode.CALCULATOR && (
                        <div className="flex items-center gap-2 py-2">
                            <div className="flex bg-zinc-800 p-1 rounded-lg border border-zinc-700 items-center">
                                <button
                                    onClick={() => setAppState(prev => ({ ...prev, mode: CalculationMode.INITIAL }))}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!isFinal ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                                >
                                    Wstępna
                                </button>
                                
                                {/* Compare Button in the middle */}
                                <button 
                                    onClick={onShowComparison} 
                                    className="mx-1 p-1.5 text-zinc-400 hover:text-yellow-500 transition-colors"
                                    title="Porównaj Wersje"
                                >
                                    <Scale size={16}/>
                                </button>

                                <button
                                    onClick={() => setAppState(prev => ({ ...prev, mode: CalculationMode.FINAL }))}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${isFinal ? 'bg-green-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                                >
                                    Końcowa
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};