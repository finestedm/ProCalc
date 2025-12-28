
import React, { useState } from 'react';
import { AppState, CalculationMode, ViewMode, ProjectStage } from '../types';
import { Calculator as CalcIcon, Scale, LayoutDashboard, Undo2, Redo2, Menu, NotebookPen, FileText, HardDrive, Square, PanelRight, Keyboard, PenLine, Send, Lock, Shield, LogOut, User, Edit, ArrowLeft, CheckCircle, AlertCircle, PlayCircle, Clock, Archive, History, FilePlus } from 'lucide-react';
import { DropdownMenu } from './DropdownMenu';
import { useAuth } from '../contexts/AuthContext';
import { ProfileEditModal } from './ProfileEditModal';
import { RequestAccessModal } from './RequestAccessModal';
import { NotificationCenter } from './NotificationCenter';
import { STAGE_LABELS, STAGE_COLORS, lifecycleService } from '../services/lifecycleService';
import { ApprovalRequestModal } from './ApprovalRequestModal';

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
    showUndoRedo?: boolean;
    onToggleLock?: () => void;
    onShowHistory?: () => void;
    onAction?: (action: string, meta?: any) => void;
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
    onToggleSidebar,
    showUndoRedo = true,

    onToggleLock,
    onShowHistory,
    onAction
}) => {
    const { profile, signOut } = useAuth();
    const [showProfileEdit, setShowProfileEdit] = useState(false);
    const [showAccessRequest, setShowAccessRequest] = useState(false);

    // Lifecycle Logic
    const [showLifecycleMenu, setShowLifecycleMenu] = useState(false);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [approvalValidationResult, setApprovalValidationResult] = useState<any>({ approved: false, reasons: [] });

    const stage = appState.stage || 'DRAFT';
    const canApprove = profile?.is_admin || profile?.role === 'manager';

    const renderLifecycleActions = () => {
        if (!onAction) return null;

        switch (stage) {
            case 'DRAFT':
                return (
                    <button
                        onClick={() => {
                            const result = lifecycleService.evaluateAutoApproval(
                                appState.initial,
                                appState.exchangeRate,
                                appState.offerCurrency,
                                appState.targetMargin,
                                appState.manualPrice
                            );
                            setApprovalValidationResult(result);
                            setShowApprovalModal(true);
                            setShowLifecycleMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors"
                    >
                        <Clock size={14} />
                        Wyślij do Akceptacji
                    </button>
                );
            case 'PENDING_APPROVAL':
                if (canApprove) {
                    return (

                        <div className="flex flex-col gap-2 p-1">
                            {appState.approvalRequest && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-2 mb-1">
                                    <div className="text-[10px] uppercase font-bold text-amber-600 mb-1 flex justify-between items-center">
                                        <span>Zgłoszenie: {appState.approvalRequest.requesterName || 'Użytkownik'}</span>
                                        <span>{new Date(appState.approvalRequest.requestDate).toLocaleDateString()}</span>
                                    </div>
                                    {appState.approvalRequest.reasons.length > 0 && (
                                        <div className="text-[10px] text-red-600 dark:text-red-400 font-bold mb-1">
                                            {appState.approvalRequest.reasons.join(', ')}
                                        </div>
                                    )}
                                    {appState.approvalRequest.message && (
                                        <div className="text-[10px] text-zinc-600 dark:text-zinc-400 italic bg-white dark:bg-black/20 p-1.5 rounded border border-amber-100 dark:border-amber-900/50">
                                            "{appState.approvalRequest.message}"
                                        </div>
                                    )}
                                </div>
                            )}

                            <button
                                onClick={() => { onAction('APPROVE'); setShowLifecycleMenu(false); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors"
                            >
                                <CheckCircle size={14} />
                                Zatwierdź Projekt
                            </button>
                            <button
                                onClick={() => { onAction('REJECT'); setShowLifecycleMenu(false); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            >
                                <AlertCircle size={14} />
                                Odrzuć (Do Poprawy)
                            </button>
                        </div>
                    );
                }
                return <div className="px-3 py-2 text-xs text-zinc-500 italic">Oczekiwanie na Managera</div>;

            case 'APPROVED':
                return (
                    <button
                        onClick={() => { onAction('START_REALIZATION'); setShowLifecycleMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                    >
                        <PlayCircle size={14} />
                        Przekaż do Realizacji
                    </button>
                );

            case 'OPENING':
                const isLogisticsRole = profile?.role === 'logistics' || profile?.is_admin;
                return (
                    <div className="flex flex-col gap-2 p-1">
                        {isLogisticsRole && (
                            <button
                                onClick={() => {
                                    const result = lifecycleService.evaluateAutoApproval(
                                        appState.initial,
                                        appState.exchangeRate,
                                        appState.offerCurrency,
                                        appState.targetMargin,
                                        appState.manualPrice
                                    );
                                    setApprovalValidationResult(result);
                                    setShowApprovalModal(true);
                                    setShowLifecycleMenu(false);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors"
                            >
                                <Clock size={14} />
                                Wyślij do Akceptacji
                            </button>
                        )}
                        {canApprove && (
                            <button
                                onClick={() => { onAction('FINISH'); setShowLifecycleMenu(false); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-bold text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors text-ellipsis overflow-hidden whitespace-nowrap"
                            >
                                <Archive size={14} />
                                Zakończ
                            </button>
                        )}
                        {!isLogisticsRole && !canApprove && (
                            <div className="px-3 py-2 text-xs text-zinc-500 italic">W Realizacji (Logistyka)</div>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

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
            case 'SENT_TO_CLOSE':
                return { label: 'Do Zamknięcia', color: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400', icon: <Clock size={10} /> };
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
                    {appState.viewMode !== ViewMode.DASHBOARD && (
                        <button
                            onClick={() => window.history.back()}
                            className="mr-2 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                            title="Powrót"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div
                        className="w-8 h-8 flex items-center justify-center mr-1 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setAppState(prev => ({ ...prev, viewMode: ViewMode.DASHBOARD }))}
                        title="Pulpit"
                    >
                        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {/* Red Arrow */}
                            <path d="M12 2L19 9H15V13H9V9H5L12 2Z" fill="#D52B1E" />
                            {/* J Body */}
                            <path d="M15 13V18C15 20.2 13.2 22 11 22H7V18H11V13H15Z" fill="currentColor" className="text-zinc-900 dark:text-white" />
                        </svg>
                    </div>
                    <div
                        className="flex flex-col cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setAppState(prev => ({ ...prev, viewMode: ViewMode.DASHBOARD }))}
                        title="Pulpit"
                    >
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
                            {/* LIFECYCLE BADGE WITH POPOVER */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowLifecycleMenu(!showLifecycleMenu)}
                                    className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-transparent shadow-sm hover:shadow text-[10px] font-bold uppercase tracking-wider select-none cursor-pointer transition-all ${stageConfig.color}`}
                                    title="Kliknij, aby zarządzać statusem"
                                >
                                    {stageConfig.icon}
                                    {stageConfig.label}
                                </button>

                                {/* POPOVER MENU */}
                                {showLifecycleMenu && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setShowLifecycleMenu(false)}
                                        ></div>
                                        <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl z-50 p-1 animate-in fade-in zoom-in-95 origin-top-right">
                                            <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 mb-1">
                                                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Status Projektu</div>
                                                <div className="text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2 mt-0.5">
                                                    <div className={`w-2 h-2 rounded-full ${stageConfig.color.replace('text-white', '').replace('bg-', 'bg-')}`}></div>
                                                    {stageConfig.label}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="py-1 space-y-0.5">
                                                {renderLifecycleActions()}
                                            </div>

                                            <div className="border-t border-zinc-100 dark:border-zinc-800 my-1"></div>

                                            {/* History Link */}
                                            <button
                                                onClick={() => { onShowHistory(); setShowLifecycleMenu(false); }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded transition-colors"
                                            >
                                                <History size={14} />
                                                Historia i Wersje
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            <ApprovalRequestModal
                                isOpen={showApprovalModal}
                                onClose={() => setShowApprovalModal(false)}
                                autoValidation={approvalValidationResult}
                                onConfirm={(message, forceManual) => {
                                    if (onAction) onAction('REQUEST_APPROVAL', { message, forceManual });
                                }}
                            />

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

                        {/* Notification Center */}
                        <NotificationCenter />
                        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block"></div>

                        <div className="hidden sm:flex items-center gap-1">
                            {/* [NEW] Lock/Unlock Button - Subtler, only for certain roles */}
                            {(profile?.is_admin || profile?.role === 'logistics' || profile?.role === 'manager') && appState.viewMode !== ViewMode.DASHBOARD && (
                                <button
                                    onClick={onToggleLock}
                                    className={`w-8 h-8 flex items-center justify-center transition-colors rounded ${appState.isLocked
                                        ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                                        : 'text-zinc-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                                    title={appState.isLocked ? "Odkblokuj edycję (Globalnie)" : "Zablokuj edycję (Globalnie)"}
                                >
                                    {appState.isLocked ? <Lock size={16} /> : <Shield size={16} />}
                                </button>
                            )}

                            {/* Visual Indicator for Read Only users */}
                            {appState.isLocked && !profile?.is_admin && profile?.role !== 'logistics' && appState.viewMode !== ViewMode.DASHBOARD && (
                                <div
                                    className="flex items-center px-2 text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 rounded h-8 border border-red-200 dark:border-red-800 transition-colors cursor-default select-none"
                                    title="Edycja zablokowana. Zapisanie zmian będzie wymagało podania powodu."
                                >
                                    <Lock size={12} className="mr-1" /> ZABLOKOWANE
                                </div>
                            )}

                            {showUndoRedo && (
                                <>
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
                                </>
                            )}
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

            {
                appState.activeCalculationId && (
                    <RequestAccessModal
                        isOpen={showAccessRequest}
                        onClose={() => setShowAccessRequest(false)}
                        calculationId={appState.activeCalculationId}
                        projectNumber={projectNumber || 'Bez Projektu'}
                        onSuccess={() => {
                            // Maybe show a global checkmark?
                        }}
                    />
                )
            }
        </header >
    );
};
