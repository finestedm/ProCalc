
import React, { useState } from 'react';
import { CalculationData, ProjectTask } from '../types';
import { NotebookPen, CheckSquare, Square, Plus, Trash2, StickyNote, ArrowLeft } from 'lucide-react';

interface Props {
  data: CalculationData;
  onChange: (updates: Partial<CalculationData>) => void;
  onBack: () => void;
}

export const ProjectNotesView: React.FC<Props> = ({ data, onChange, onBack }) => {
  const [newTaskText, setNewTaskText] = useState('');

  const addTask = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTaskText.trim()) return;
      
      const newTask: ProjectTask = {
          id: Math.random().toString(36).substr(2, 9),
          text: newTaskText.trim(),
          isCompleted: false
      };
      
      onChange({ tasks: [...(data.tasks || []), newTask] });
      setNewTaskText('');
  };

  const toggleTask = (taskId: string) => {
      const updatedTasks = (data.tasks || []).map(t => 
          t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t
      );
      onChange({ tasks: updatedTasks });
  };

  const removeTask = (taskId: string) => {
      const updatedTasks = (data.tasks || []).filter(t => t.id !== taskId);
      onChange({ tasks: updatedTasks });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center gap-4 mb-4">
             <button onClick={onBack} className="text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white flex items-center gap-1 transition-colors">
                 <ArrowLeft size={18} /> Wróć
             </button>
             <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                 <NotebookPen className="text-yellow-500"/> Notatki i Zadania Projektowe
             </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Task List */}
            <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700">
                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
                    <CheckSquare size={20} className="text-zinc-500"/> Lista Zadań
                </h3>
                
                <form onSubmit={addTask} className="flex gap-2 mb-4">
                    <input 
                        type="text" 
                        placeholder="Dodaj nowe zadanie..."
                        className="flex-1 p-2 border rounded text-sm focus:border-yellow-400 outline-none bg-white dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                        value={newTaskText}
                        onChange={(e) => setNewTaskText(e.target.value)}
                    />
                    <button type="submit" className="bg-yellow-400 text-zinc-900 p-2 rounded hover:bg-yellow-500">
                        <Plus size={20}/>
                    </button>
                </form>

                <div className="space-y-2">
                    {(!data.tasks || data.tasks.length === 0) && (
                        <p className="text-sm text-gray-400 italic text-center py-4">Brak zadań.</p>
                    )}
                    {(data.tasks || []).map(task => (
                        <div key={task.id} className="flex items-start gap-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded group">
                             <button onClick={() => toggleTask(task.id)} className="mt-0.5 text-gray-400 hover:text-yellow-500 dark:text-gray-500">
                                 {task.isCompleted ? <CheckSquare size={18} className="text-green-500"/> : <Square size={18}/>}
                             </button>
                             <span className={`text-sm flex-1 break-words ${task.isCompleted ? 'text-gray-400 line-through' : 'text-zinc-700 dark:text-zinc-200'}`}>
                                 {task.text}
                             </span>
                             <button onClick={() => removeTask(task.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Trash2 size={16}/>
                             </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* General Notes */}
            <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 flex flex-col">
                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
                    <StickyNote size={20} className="text-yellow-500"/> Notatki Ogólne
                </h3>
                <textarea
                    className="flex-1 w-full p-4 border rounded text-sm bg-yellow-50 dark:bg-zinc-900 border-yellow-100 dark:border-zinc-700 focus:border-yellow-400 outline-none resize-none min-h-[300px]"
                    placeholder="Miejsce na luźne notatki, informacje o kontakcie, ważne ustalenia..."
                    value={data.projectNotes || ''}
                    onChange={(e) => onChange({ projectNotes: e.target.value })}
                />
            </div>
        </div>
    </div>
  );
};
