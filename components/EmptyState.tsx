
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
}

export const EmptyState: React.FC<Props> = ({ icon: Icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-sm bg-zinc-50/50 dark:bg-zinc-900/50 transition-colors group">
      <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform duration-300">
        <Icon size={32} className="text-zinc-400 dark:text-zinc-500" strokeWidth={1.5} />
      </div>
      <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">{title}</h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mb-6">{description}</p>
      
      {action && (
        <button 
          onClick={action.onClick}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-amber-400 dark:hover:border-amber-500 shadow-sm rounded-sm text-xs font-bold text-zinc-700 dark:text-zinc-200 transition-all hover:shadow-md"
        >
          {action.icon && <action.icon size={14} className="text-amber-500" />}
          {action.label}
        </button>
      )}
    </div>
  );
};
