


import React, { useState } from 'react';
import { CalculationData, ProjectTask } from '../types';
import { NotebookPen, CheckSquare, Square, Plus, Trash2, StickyNote, ArrowLeft, Check, ListTodo, Calendar, Link } from 'lucide-react';

interface Props {
    data: CalculationData;
    onChange: (updates: Partial<CalculationData>) => void;
    onBack: () => void;
}

export const ProjectNotesView: React.FC<Props> = ({ data, onChange, onBack }) => {
    const [newTaskText, setNewTaskText] = useState('');
    const [newTaskDate, setNewTaskDate] = useState('');

    const addTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskText.trim()) return;

        const newTask: ProjectTask = {
            id: Math.random().toString(36).substr(2, 9),
            text: newTaskText.trim(),
            isCompleted: false,
            dueDate: newTaskDate || undefined
        };

        onChange({ tasks: [...(data.tasks || []), newTask] });
        setNewTaskText('');
        setNewTaskDate('');
    };

    const toggleTask = (taskId: string) => {
        const updatedTasks = (data.tasks || []).map(t =>
            t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t
        );
        onChange({ tasks: updatedTasks });
    };

    const updateTaskDate = (taskId: string, date: string) => {
        const updatedTasks = (data.tasks || []).map(t =>
            t.id === taskId ? { ...t, dueDate: date } : t
        );
        onChange({ tasks: updatedTasks });
    };

    const removeTask = (taskId: string) => {
        const updatedTasks = (data.tasks || []).filter(t => t.id !== taskId);
        onChange({ tasks: updatedTasks });
    };

    const completedCount = (data.tasks || []).filter(t => t.isCompleted).length;
    const totalCount = (data.tasks || []).length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
                <button onClick={onBack} className="text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white flex items-center gap-1 transition-colors">
                    <ArrowLeft size={18} /> Wróć
                </button>
                <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                    <NotebookPen className="text-yellow-500" /> Notatki i Zadania
                </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-140px)]">

                {/* LEFT COLUMN: General Notes */}
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm flex flex-col overflow-hidden h-full">
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between">
                        <h3 className="font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2 uppercase text-xs tracking-wider">
                            <StickyNote size={16} className="text-amber-500" /> Notatki Projektowe
                        </h3>
                        <span className="text-[10px] text-zinc-400">Opis, założenia, uwagi handlowe</span>
                    </div>
                    <div className="flex-1 p-0 relative">
                        <textarea
                            className="w-full h-full p-4 resize-none outline-none bg-yellow-50/20 dark:bg-zinc-950/50 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 border-none focus:ring-0"
                            placeholder="Wpisz tutaj ogólne uwagi do projektu..."
                            value={data.projectNotes || ''}
                            onChange={(e) => onChange({ projectNotes: e.target.value })}
                        />
                    </div>
                </div>

                {/* RIGHT COLUMN: Checklist */}
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm flex flex-col overflow-hidden h-full">
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2 uppercase text-xs tracking-wider">
                                <ListTodo size={16} className="text-blue-500" /> Lista Zadań (To-Do)
                            </h3>
                            <span className="text-[10px] font-mono font-bold bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-400">
                                {completedCount} / {totalCount}
                            </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>

                    <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                        <form onSubmit={addTask} className="flex gap-2">
                            <input
                                type="text"
                                className="flex-1 px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-900 focus:border-blue-400 outline-none transition-colors placeholder-zinc-400"
                                placeholder="Dodaj nowe zadanie..."
                                value={newTaskText}
                                onChange={(e) => setNewTaskText(e.target.value)}
                            />
                            <input
                                type="date"
                                className="w-32 px-2 py-2 border border-zinc-200 dark:border-zinc-700 rounded text-xs bg-white dark:bg-zinc-900 focus:border-blue-400 outline-none"
                                value={newTaskDate}
                                onChange={(e) => setNewTaskDate(e.target.value)}
                            />
                            <button
                                type="submit"
                                disabled={!newTaskText.trim()}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded transition-colors flex items-center justify-center"
                            >
                                <Plus size={18} />
                            </button>
                        </form>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 bg-zinc-50/30 dark:bg-zinc-900/20 custom-scrollbar">
                        {(data.tasks || []).length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-zinc-400 opacity-60">
                                <CheckSquare size={48} strokeWidth={1} className="mb-2" />
                                <p className="text-sm">Brak zadań. Dodaj pierwsze zadanie powyżej.</p>
                            </div>
                        ) : (
                            <ul className="space-y-2">
                                {(data.tasks || []).map(task => (
                                    <li
                                        key={task.id}
                                        className={`group flex flex-col p-3 bg-white dark:bg-zinc-900 border rounded transition-all hover:shadow-sm ${task.isCompleted
                                            ? 'border-green-200 dark:border-green-900/30 bg-green-50/30 dark:bg-green-900/10'
                                            : 'border-zinc-200 dark:border-zinc-800'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => toggleTask(task.id)}
                                                className={`shrink-0 transition-colors ${task.isCompleted ? 'text-green-500' : 'text-zinc-300 hover:text-blue-500'
                                                    }`}
                                            >
                                                {task.isCompleted ? <CheckSquare size={20} /> : <Square size={20} />}
                                            </button>

                                            <span className={`flex-1 text-sm ${task.isCompleted ? 'line-through text-zinc-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                                                {task.text}
                                            </span>

                                            <button
                                                onClick={() => removeTask(task.id)}
                                                className="text-zinc-300 hover:text-red-500 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                                                title="Usuń zadanie"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-4 ml-8 mt-2 text-xs">
                                            <div className="flex items-center gap-1 text-zinc-400">
                                                <Calendar size={12} />
                                                <input
                                                    type="date"
                                                    className="bg-transparent border-0 p-0 text-xs text-zinc-500 focus:ring-0 cursor-pointer hover:text-blue-500"
                                                    value={task.dueDate || ''}
                                                    onChange={(e) => updateTaskDate(task.id, e.target.value)}
                                                />
                                            </div>

                                            {task.linkedItemId && (
                                                <div className="flex items-center gap-1 text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                                    <Link size={10} /> Połączone z harmonogramem
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};