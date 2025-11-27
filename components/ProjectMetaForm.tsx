
import React, { useState } from 'react';
import { ProjectMeta, CalculationMode } from '../types';
import { Briefcase, Calendar, User, ChevronUp, ChevronDown } from 'lucide-react';

interface Props {
  data: ProjectMeta;
  mode: CalculationMode;
  onChange: (data: ProjectMeta) => void;
}

export const ProjectMetaForm: React.FC<Props> = ({ data, mode, onChange }) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleChange = (key: keyof ProjectMeta, value: string) => {
    onChange({ ...data, [key]: value });
  };

  // Helper for SAP number: strips prefix for display, adds it back for storage
  const sapPrefix = "46120";
  const displaySap = data.sapProjectNumber.startsWith(sapPrefix) 
    ? data.sapProjectNumber.slice(sapPrefix.length) 
    : data.sapProjectNumber;

  const handleSapChange = (val: string) => {
      // Allow only digits
      const cleanVal = val.replace(/\D/g, '');
      handleChange('sapProjectNumber', sapPrefix + cleanVal);
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 mb-8 overflow-hidden transition-colors">
      <div 
          className="p-4 flex justify-between items-center cursor-pointer bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
      >
        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <Briefcase className="text-yellow-500" size={20} /> Szczegóły Projektu
        </h2>
        <div className="flex items-center gap-4">
            {!isOpen && (data.orderNumber || data.projectNumber) && (
                 <span className="text-sm text-zinc-500 dark:text-zinc-400 font-medium hidden sm:inline">
                     {data.orderNumber && <>Zam: <strong className="text-zinc-700 dark:text-zinc-300">{data.orderNumber}</strong></>}
                     {data.orderNumber && data.projectNumber && <span className="mx-2">|</span>}
                     {data.projectNumber && <>Proj: <strong className="text-zinc-700 dark:text-zinc-300">{data.projectNumber}</strong></>}
                 </span>
            )}
            <button className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300">
                {isOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
            </button>
        </div>
      </div>
      
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
              <div className="p-6 border-t border-zinc-100 dark:border-zinc-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nr Zamówienia</label>
                <input
                    type="text"
                    value={data.orderNumber}
                    onChange={(e) => handleChange('orderNumber', e.target.value)}
                    className="w-full p-2 border rounded text-sm focus:ring-yellow-400 focus:border-yellow-400 outline-none bg-white dark:bg-zinc-700 dark:text-white dark:border-zinc-600"
                />
                </div>
                
                {mode === CalculationMode.INITIAL && (
                    <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Zamówienia</label>
                    <div className="relative">
                        <Calendar className="absolute left-2 top-2.5 text-gray-400" size={16}/>
                        <input
                            type="date"
                            value={data.orderDate}
                            onChange={(e) => handleChange('orderDate', e.target.value)}
                            className="w-full pl-8 p-2 border rounded text-sm focus:ring-yellow-400 focus:border-yellow-400 outline-none bg-white dark:bg-zinc-700 dark:text-white dark:border-zinc-600"
                        />
                    </div>
                    </div>
                )}

                {mode === CalculationMode.FINAL && (
                    <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Protokołu</label>
                    <div className="relative">
                        <Calendar className="absolute left-2 top-2.5 text-gray-400" size={16}/>
                        <input
                            type="date"
                            value={data.protocolDate}
                            onChange={(e) => handleChange('protocolDate', e.target.value)}
                            className="w-full pl-8 p-2 border rounded text-sm focus:ring-yellow-400 focus:border-yellow-400 outline-none bg-white dark:bg-zinc-700 dark:text-white dark:border-zinc-600"
                        />
                    </div>
                    </div>
                )}

                <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nr Projektu SAP</label>
                <div className="relative flex items-center">
                    <span className="absolute left-3 text-gray-500 text-sm select-none bg-gray-50 dark:bg-zinc-600 px-1 rounded-sm">{sapPrefix}</span>
                    <input
                        type="text"
                        value={displaySap}
                        onChange={(e) => handleSapChange(e.target.value)}
                        maxLength={10} 
                        className="w-full pl-16 p-2 border rounded text-sm focus:ring-yellow-400 focus:border-yellow-400 outline-none bg-white dark:bg-zinc-700 dark:text-white dark:border-zinc-600"
                        placeholder="XXXXX"
                    />
                </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nr Projektu</label>
                    <input
                        type="text"
                        value={data.projectNumber}
                        onChange={(e) => handleChange('projectNumber', e.target.value)}
                        className="w-full p-2 border rounded text-sm focus:ring-yellow-400 focus:border-yellow-400 outline-none bg-white dark:bg-zinc-700 dark:text-white dark:border-zinc-600"
                    />
                </div>
                <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Handlowiec</label>
                <div className="relative">
                    <User className="absolute left-2 top-2.5 text-gray-400" size={16}/>
                    <input
                        type="text"
                        value={data.salesPerson}
                        onChange={(e) => handleChange('salesPerson', e.target.value)}
                        className="w-full pl-8 p-2 border rounded text-sm focus:ring-yellow-400 focus:border-yellow-400 outline-none bg-white dark:bg-zinc-700 dark:text-white dark:border-zinc-600"
                    />
                </div>
                </div>
                <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Wsparcie Sprzedaży</label>
                <div className="relative">
                    <User className="absolute left-2 top-2.5 text-gray-400" size={16}/>
                    <input
                        type="text"
                        value={data.assistantPerson}
                        onChange={(e) => handleChange('assistantPerson', e.target.value)}
                        className="w-full pl-8 p-2 border rounded text-sm focus:ring-yellow-400 focus:border-yellow-400 outline-none bg-white dark:bg-zinc-700 dark:text-white dark:border-zinc-600"
                    />
                </div>
                </div>
            </div>
          </div>
      </div>
    </div>
  );
};