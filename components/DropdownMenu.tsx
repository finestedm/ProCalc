
import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

interface MenuItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

interface Props {
  items: MenuItem[];
  trigger?: React.ReactNode;
  align?: 'left' | 'right';
  buttonClassName?: string;
}

export const DropdownMenu: React.FC<Props> = ({ items, trigger, align = 'right', buttonClassName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleItemClick = (onClick: () => void) => {
    onClick();
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left h-full" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClassName || "flex items-center justify-center p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500 dark:text-zinc-400 focus:outline-none"}
      >
        {trigger || <MoreVertical size={20} />}
      </button>

      {isOpen && (
        <div 
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-zinc-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-50 animate-fadeIn`}
        >
          <div className="py-1 divide-y divide-zinc-100 dark:divide-zinc-700">
            {items.map((item, index) => (
              <button
                key={index}
                onClick={() => !item.disabled && handleItemClick(item.onClick)}
                disabled={item.disabled}
                className={`group flex w-full items-center px-4 py-3 text-sm transition-colors
                  ${item.danger 
                    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' 
                    : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700'}
                  ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {item.icon && (
                  <span className={`mr-3 ${item.danger ? 'text-red-500 dark:text-red-400' : 'text-zinc-400 group-hover:text-zinc-500 dark:text-zinc-400'}`}>
                    {item.icon}
                  </span>
                )}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
