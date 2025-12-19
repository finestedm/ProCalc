
import React from 'react';
import { CalculationScenario } from '../types';
import { Plus, Settings2 } from 'lucide-react';

interface Props {
    scenarios: CalculationScenario[];
    activeId: string;
    onSwitch: (id: string) => void;
    onAdd: () => void;
    onManage: () => void;
    readOnly?: boolean;
}

export const ScenarioTabs: React.FC<Props> = ({ scenarios, activeId, onSwitch, onAdd, onManage, readOnly }) => {
    return (
        <div className="bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex h-10 border-b border-zinc-200 dark:border-zinc-800 select-none">
                <div
                    className="flex-1 flex overflow-x-auto [&::-webkit-scrollbar]:hidden"
                    style={{ scrollbarWidth: 'none' }}
                >
                    {scenarios.map((s) => {
                        const isActive = activeId === s.id;
                        return (
                            <button
                                key={s.id}
                                onClick={() => onSwitch(s.id)}
                                className={`
                                    relative px-4 h-full text-xs font-medium transition-colors whitespace-nowrap min-w-[120px] max-w-[200px] truncate group border-r border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-2
                                    ${isActive
                                        ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-bold border-b-2 border-b-amber-500'
                                        : 'bg-transparent text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300'
                                    }
                                `}
                            >
                                <span className="truncate">{s.name}</span>
                            </button>
                        );
                    })}
                </div>

                {!readOnly && (
                    <div className="flex items-center h-full border-l border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 shrink-0">
                        <button
                            onClick={onAdd}
                            className="w-10 h-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center border-r border-zinc-200 dark:border-zinc-800"
                            title="Dodaj Wariant Kalkulacji"
                        >
                            <Plus size={16} />
                        </button>
                        <button
                            onClick={onManage}
                            className="w-10 h-full flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                            title="Zarządzaj Wariantami"
                        >
                            <Settings2 size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
