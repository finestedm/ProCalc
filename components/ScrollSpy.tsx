
import React, { useEffect, useState } from 'react';

interface Section {
  id: string;
  label: string;
}

interface Props {
  sections: Section[];
  containerRef: React.RefObject<HTMLElement>;
}

export const ScrollSpy: React.FC<Props> = ({ sections, containerRef }) => {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Offset to trigger activation when section is near top
      const scrollPosition = container.scrollTop + 150; 

      let currentId = '';
      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          // Check intersection
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            currentId = section.id;
            break;
          }
        }
      }
      if (currentId && currentId !== activeId) setActiveId(currentId);
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => container.removeEventListener('scroll', handleScroll);
  }, [sections, containerRef, activeId]);

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="w-8 h-full bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col items-center py-4 gap-0 shrink-0 select-none">
        {sections.map((section) => {
            const isActive = activeId === section.id;
            
            return (
                <button
                    key={section.id}
                    onClick={() => scrollTo(section.id)}
                    className={`
                        group relative w-full flex items-center justify-center py-3 transition-all duration-200
                        ${isActive ? 'opacity-100' : 'opacity-60 hover:opacity-100'}
                    `}
                    title={section.label}
                >
                    <div 
                        className={`
                            whitespace-nowrap uppercase tracking-widest transition-all
                            ${isActive 
                                ? 'text-[10px] text-zinc-900 dark:text-white font-black' 
                                : 'text-[9px] text-zinc-400 dark:text-zinc-500 font-medium'}
                        `}
                        style={{ 
                            writingMode: 'vertical-rl',
                            transform: 'rotate(-180deg)',
                        }}
                    >
                        {section.label}
                    </div>
                    
                    {/* Active Indicator Line */}
                    {isActive && (
                        <div className="absolute right-0 top-1 bottom-1 w-0.5 bg-amber-500 rounded-l-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                    )}
                </button>
            );
        })}
    </div>
  );
};
