
import React, { useState } from 'react';
import { AppState, CalculationMode, ViewMode, ProjectStage } from '../types';
import { Calculator as CalcIcon, Scale, LayoutDashboard, Undo2, Redo2, Menu, NotebookPen, FileText, HardDrive, Square, PanelRight, Keyboard, PenLine, Send, Lock, Shield, LogOut, User, Edit } from 'lucide-react';
import { DropdownMenu } from './DropdownMenu';
import { useAuth } from '../contexts/AuthContext';
import { ProfileEditModal } from './ProfileEditModal';
import { RequestAccessModal } from './RequestAccessModal';

interface Props {
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onShowComparison: () => void;
    onShowProjectManager: () => void;
    onShowShortcuts: () => void;
    onShowAdminPanel: () => void;
    menuItems: any[];
    projectInputRef: React.RefObject<HTMLInputElement>;
    handleImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onToggleSidebar?: () => void;
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
    onShowShortcuts,
    onShowAdminPanel,
    menuItems,
    projectInputRef,
    handleImport,
    onToggleSidebar
}) => {
    const { profile, signOut } = useAuth();
    const [showProfileEdit, setShowProfileEdit] = useState(false);
    const [showAccessRequest, setShowAccessRequest] = useState(false);

    const handleLogout = async () => {
        await signOut();
    };

    const isFinal = appState.mode === CalculationMode.FINAL;

    const navItems = [
        { mode: ViewMode.CALCULATOR, label: 'Kalkulator', icon: <CalcIcon size={18} /> },
        { mode: ViewMode.LOGISTICS, label: 'Logistyka', icon: <LayoutDashboard size={18} /> },
        { mode: ViewMode.NOTES, label: 'Notatki', icon: <NotebookPen size={18} /> },
        { mode: ViewMode.DOCUMENTS, label: 'Dokumenty', icon: <FileText size={18} /> },
    ];

    const getStageConfig = (stage: ProjectStage) => {
        switch (stage) {
            case 'OPENING':
                return { label: 'Realizacja', color: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400', icon: <Send size={10} /> };
            case 'FINAL':
                return { label: 'Zamknięty', color: 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-400', icon: <Lock size={10} /> };
            case 'DRAFT':
            default:
                return { label: 'Szkic', color: 'text-zinc-500 bg-zinc-100 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400', icon: <PenLine size={10} /> };
        }
    };

    const stageConfig = getStageConfig(appState.stage);

    const activeData = appState.mode === CalculationMode.INITIAL ? appState.initial : appState.final;
    const projectNumber = activeData.meta.projectNumber;
    const clientName = activeData.orderingParty.name;

    return (
        <header className="w-full bg-white dark:bg-black h-14 shrink-0 z-50 transition-colors border-b border-zinc-200 dark:border-zinc-800">
            <div className="max-w-[1920px] mx-auto px-4 md:px-6 h-full flex items-center justify-between">

                {/* 1. LEFT: Brand */}
                <div className="flex items-center gap-3 shrink-0">
                    <div className="w-8 h-8 flex items-center justify-center mr-1">
                        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {/* Red Arrow */}
                            <path d="M12 2L19 9H15V13H9V9H5L12 2Z" fill="#D52B1E" />
                            {/* J Body */}
                            <path d="M15 13V18C15 20.2 13.2 22 11 22H7V18H11V13H15Z" fill="currentColor" className="text-zinc-900 dark:text-white" />
                        </svg>
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white uppercase leading-none font-mono">
                            JH WE-Calc<span className="text-zinc-400">.v1</span>
                        </h1>
                        {(projectNumber || clientName) && (
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-[200px] leading-tight mt-0.5" title={`${projectNumber || ''} ${clientName || ''}`}>
                                {projectNumber && <span className="font-mono font-bold mr-1">{projectNumber}</span>}
                                {clientName}
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. CENTER: Navigation Tabs (Underline Style) */}
                <div className="flex-1 flex justify-center h-full overflow-x-auto no-scrollbar">
                    {appState.viewMode !== ViewMode.DASHBOARD && (
                        <div className="flex h-full gap-4 md:gap-8 px-2">
                            {navItems.map((item) => {
                                const isActive = appState.viewMode === item.mode;
                                return (
                                    <button
                                        key={item.mode}
                                        onClick={() => setAppState(prev => ({ ...prev, viewMode: item.mode }))}
                                        className={`relative h-full flex items-center gap-2 text-xs font-bold uppercase tracking-wide transition-all duration-200 border-b-2 font-mono whitespace-nowrap ${isActive
                                            ? 'text-zinc-900 dark:text-white border-zinc-900 dark:border-white'
                                            : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 border-transparent hover:border-zinc-200'
                                            }`}
                                        title={item.label}
                                    >
                                        <span className="block md:hidden">{item.icon}</span>
                                        <span className="hidden md:block">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 3. RIGHT: Actions & Mode Switcher */}
                <div className="flex items-center gap-2 md:gap-4 shrink-0">

                    {/* Stage Indicator & Mode Switcher */}
                    {appState.viewMode === ViewMode.CALCULATOR && (
                        <div className="flex items-center gap-3">
                            {/* Stage Badge */}
                            <div className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-bold uppercase tracking-wider select-none ${stageConfig.color}`}>
                                {stageConfig.icon}
                                {stageConfig.label}
                            </div>

                            <div className="hidden lg:flex items-center border border-zinc-200 dark:border-zinc-800 rounded overflow-hidden h-8">
                                <button
                                    onClick={() => setAppState(prev => ({ ...prev, mode: CalculationMode.INITIAL }))}
                                    className={`px-3 h-full text-[10px] font-bold uppercase tracking-wider transition-all flex items-center font-mono ${!isFinal
                                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                                        : 'bg-transparent text-zinc-400 hover:text-zinc-600'
                                        }`}
                                >
                                    Wstępna
                                </button>
                                <div className="w-px h-full bg-zinc-200 dark:bg-zinc-800"></div>
                                <button
                                    onClick={() => setAppState(prev => ({ ...prev, mode: CalculationMode.FINAL }))}
                                    className={`px-3 h-full text-[10px] font-bold uppercase tracking-wider transition-all flex items-center font-mono ${isFinal
                                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                                        : 'bg-transparent text-zinc-400 hover:text-zinc-600'
                                        }`}
                                >
                                    Końcowa
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block"></div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 md:gap-2">
                        {/* Mobile Sidebar Toggle - Only on small screens */}
                        {onToggleSidebar && (
                            <button
                                onClick={onToggleSidebar}
                                className="xl:hidden w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                                title="Podsumowanie Projektu"
                            >
                                <PanelRight size={18} />
                            </button>
                        )}

                        <div className="hidden sm:flex items-center gap-1">
                            {/* [NEW] Lock/Unlock Button - Subtler, only for certain roles */}
                            {(profile?.is_admin || profile?.role === 'logistics' || profile?.role === 'manager') && appState.viewMode !== ViewMode.DASHBOARD && (
                                <button
                                    onClick={() => setAppState(prev => ({ ...prev, isLocked: !prev.isLocked }))}
                                    className={`w-8 h-8 flex items-center justify-center transition-colors rounded ${appState.isLocked
                                        ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                                        : 'text-zinc-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                                    title={appState.isLocked ? "Odkblokuj edycję" : "Zablokuj edycję"}
                                >
                                    {appState.isLocked ? <Lock size={16} /> : <Shield size={16} />}
                                </button>
                            )}

                            {/* Visual Indicator for Read Only users */}
                            {appState.isLocked && !profile?.is_admin && profile?.role !== 'logistics' && appState.viewMode !== ViewMode.DASHBOARD && (
                                <button
                                    onClick={() => setShowAccessRequest(true)}
                                    className="flex items-center px-2 text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 rounded h-8 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
                                    title="Kliknij aby poprosić o odblokowanie"
                                >
                                    <Lock size={12} className="mr-1" /> ZABLOKOWANE
                                </button>
                            )}

                            <button
                                onClick={onUndo}
                                disabled={!canUndo}
                                className="w-8 h-8 flex items-center justify-center text-zinc-500 disabled:opacity-20 hover:text-zinc-900 dark:hover:text-white transition-colors"
                                title="Cofnij (Ctrl+Z)"
                            >
                                <Undo2 size={16} />
                            </button>
                            <button
                                onClick={onRedo}
                                disabled={!canRedo}
                                className="w-8 h-8 flex items-center justify-center text-zinc-500 disabled:opacity-20 hover:text-zinc-900 dark:hover:text-white transition-colors"
                                title="Ponów (Ctrl+Y)"
                            >
                                <Redo2 size={16} />
                            </button>
                        </div>

                        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block"></div>

                        <button
                            onClick={() => setAppState(prev => ({ ...prev, viewMode: ViewMode.DASHBOARD }))}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${appState.viewMode === ViewMode.DASHBOARD
                                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-lg shadow-zinc-900/20'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                }`}
                            title="Otwórz Pulpit"
                        >
                            <User size={14} className={appState.viewMode === ViewMode.DASHBOARD ? '' : 'text-zinc-500'} />
                            <span className="text-xs font-bold uppercase tracking-tight">
                                {profile?.full_name || profile?.email || 'User'}
                            </span>
                        </button>

                        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block"></div>

                        <DropdownMenu
                            trigger={
                                <div className="w-8 h-8 flex items-center justify-center text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors cursor-pointer">
                                    <Menu size={18} />
                                </div>
                            }
                            items={menuItems}
                        />
                    </div>
                    <input type="file" ref={projectInputRef} className="hidden" accept=".json" onChange={handleImport} />
                </div>
            </div>

            {appState.activeCalculationId && (
                <RequestAccessModal
                    isOpen={showAccessRequest}
                    onClose={() => setShowAccessRequest(false)}
                    calculationId={appState.activeCalculationId}
                    projectNumber={projectNumber || 'Bez Projektu'}
                    onSuccess={() => {
                        // Maybe show a global checkmark?
                    }}
                />
            )}
        </header >
    );
};
