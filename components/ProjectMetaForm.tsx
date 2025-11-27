
import React, { useState } from 'react';
import { ProjectMeta, CalculationMode } from '../types';
import { Briefcase, Calendar, User, ChevronDown } from 'lucide-react';

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

  const sapPrefix = "46120";
  const displaySap = data.sapProjectNumber.startsWith(sapPrefix) 
    ? data.sapProjectNumber.slice(sapPrefix.length) 
    : data.sapProjectNumber;

  const handleSapChange = (val: string) => {
      const cleanVal = val.replace(/\D/g, '');
      handleChange('sapProjectNumber', sapPrefix + cleanVal);
  };

  const inputClass = "w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-800 placeholder-zinc-400 focus:bg-white focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100 outline-none transition-all dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-100 dark:focus:bg-zinc-800";
  const labelClass = "block text-xs font-bold text-zinc-500 uppercase mb-1.5 ml-1";

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 mb-8 overflow-hidden transition-all duration-300">
      <div 
          className="p-5 flex justify-between items-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
            <div className="bg-yellow-100 p-2 rounded-lg text-yellow-600">
                <Briefcase size={20} />
            </div>
            <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight">Szczegóły Projektu</h2>
                {!isOpen && (data.orderNumber || data.projectNumber) && (
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500">
                        {data.orderNumber && <span>Zam: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{data.orderNumber}</span></span>}
                        {data.orderNumber && data.projectNumber && <span className="w-1 h-1 rounded-full bg-zinc-300"></span>}
                        {data.projectNumber && <span>Proj: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{data.projectNumber}</span></span>}
                    </div>
                )}
            </div>
        </div>
        <button className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-transform duration-300" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <ChevronDown size={20}/>
        </button>
      </div>
      
      <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
              <div className="p-6 pt-0 border-t border-transparent grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <div>
                    <label className={labelClass}>Nr Zamówienia</label>
                    <input
                        type="text"
                        value={data.orderNumber}
                        onChange={(e) => handleChange('orderNumber', e.target.value)}
                        className={inputClass}
                        placeholder="np. ZAM/2024/..."
                    />
                </div>
                
                {mode === CalculationMode.INITIAL && (
                    <div>
                        <label className={labelClass}>Data Zamówienia</label>
                        <div className="relative group">
                            <Calendar className="absolute left-3 top-2.5 text-zinc-400 group-focus-within:text-zinc-600" size={16}/>
                            <input
                                type="date"
                                value={data.orderDate}
                                onChange={(e) => handleChange('orderDate', e.target.value)}
                                className={`${inputClass} pl-10`}
                            />
                        </div>
                    </div>
                )}

                {mode === CalculationMode.FINAL && (
                    <div>
                        <label className={labelClass}>Data Protokołu</label>
                        <div className="relative group">
                            <Calendar className="absolute left-3 top-2.5 text-zinc-400 group-focus-within:text-zinc-600" size={16}/>
                            <input
                                type="date"
                                value={data.protocolDate}
                                onChange={(e) => handleChange('protocolDate', e.target.value)}
                                className={`${inputClass} pl-10`}
                            />
                        </div>
                    </div>
                )}

                <div>
                    <label className={labelClass}>Nr Projektu SAP</label>
                    <div className="relative flex items-center group">
                        <span className="absolute left-3 text-zinc-400 text-sm font-medium select-none bg-zinc-100 dark:bg-zinc-600 px-1.5 py-0.5 rounded-md text-xs">{sapPrefix}</span>
                        <input
                            type="text"
                            value={displaySap}
                            onChange={(e) => handleSapChange(e.target.value)}
                            maxLength={10} 
                            className={`${inputClass} pl-20 font-mono`}
                            placeholder="XXXXX"
                        />
                    </div>
                </div>
                <div>
                    <label className={labelClass}>Nr Projektu</label>
                    <input
                        type="text"
                        value={data.projectNumber}
                        onChange={(e) => handleChange('projectNumber', e.target.value)}
                        className={inputClass}
                        placeholder="np. P-2024-..."
                    />
                </div>
                <div>
                    <label className={labelClass}>Handlowiec</label>
                    <div className="relative group">
                        <User className="absolute left-3 top-2.5 text-zinc-400 group-focus-within:text-zinc-600" size={16}/>
                        <input
                            type="text"
                            value={data.salesPerson}
                            onChange={(e) => handleChange('salesPerson', e.target.value)}
                            className={`${inputClass} pl-10`}
                            placeholder="Imię Nazwisko"
                        />
                    </div>
                </div>
                <div>
                    <label className={labelClass}>Wsparcie Sprzedaży</label>
                    <div className="relative group">
                        <User className="absolute left-3 top-2.5 text-zinc-400 group-focus-within:text-zinc-600" size={16}/>
                        <input
                            type="text"
                            value={data.assistantPerson}
                            onChange={(e) => handleChange('assistantPerson', e.target.value)}
                            className={`${inputClass} pl-10`}
                            placeholder="Imię Nazwisko"
                        />
                    </div>
                </div>
            </div>
          </div>
      </div>
    </div>
  );
};
