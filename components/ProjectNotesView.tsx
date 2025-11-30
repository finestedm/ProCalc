
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
                 <NotebookPen className="text-yellow-500"/>