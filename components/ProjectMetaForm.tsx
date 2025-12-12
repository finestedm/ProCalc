
import React, { useState } from 'react';
import { ProjectMeta, CalculationMode } from '../types';
import { Briefcase, Calendar, User, ChevronDown, Hash, ScanLine, Search, Layers, FileText, UserCheck } from 'lucide-react';
import { SALES_PEOPLE, SUPPORT_PEOPLE, ACTUAL_SALES_PEOPLE } from '../services/employeesDatabase';
import { INSTALLATION_TYPES, INVOICE_TEXTS } from '../services/optionsDatabase';

interface Props {
  data: ProjectMeta;
  mode: CalculationMode;
  onChange: (data: ProjectMeta) => void;
  isOpen?: boolean; // Controlled state
  onToggle?: () => void; // Toggle handler
}

export const ProjectMetaForm: React.FC<Props> = ({ data, mode, onChange, isOpen = true, onToggle }) => {
  const [internalOpen, setInternalOpen] = useState(true);
  
  // Use controlled state if provided, otherwise local
  const showContent = onToggle ? isOpen : internalOpen;
  const toggleHandler = onToggle || (() => setInternalOpen(!internalOpen));

  const handleChange = (key: keyof ProjectMeta, value: string | number) => {
    onChange({ ...data, [key]: value });
  };

  const sapPrefix = "46120";
  const displaySap = data.sapProjectNumber.startsWith(sapPrefix) 
    ? data.sapProjectNumber.slice(sapPrefix.length) 
    : data.sapProjectNumber;

  const handleSapChange = (val: string) => {
      // Only allow digits, max 5 digits (to form 10 total with prefix)
      const cleanVal = val.replace(/\D/g, '').slice(0, 5);
      handleChange('sapProjectNumber', sapPrefix + cleanVal);
  };

  const handleProjectNumberChange = (val: string) => {
      // Only allow digits, max 8 digits
      const cleanVal = val.replace(/\D/g, '').slice(0, 8);
      handleChange('projectNumber', cleanVal);
  };

  // UPDATED: Removed py-2, added h-[34px] to enforce exact height match across all inputs/selects
  const inputClass = "w-full px-3 h-[34px] bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all";
  const labelClass = "block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1 ml-1 tracking-wider";

  const renderPersonSelect = (label: string, value: string, onChange: (val: string) => void, options: string[]) => {
      return (
          <div className="w-full">
              <label className={labelClass}>{label}</label>
              <div className="relative group">
                  <User className="absolute left-2.5 top-2.5 text-zinc-400 group-focus-within:text-amber-600 pointer-events-none" size={14}/>
                  <input 
                      list={`${label.replace(/\s+/g, '')}-list`}
                      type="text" 
                      className={`${inputClass} pl-9`}
                      placeholder="Wybierz z listy..."
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                  />
                  <datalist id={`${label.replace(/\s+/g, '')}-list`}>
                      {options.map((name, i) => (
                          <option key={i} value={name} />
                      ))}
                  </datalist>
                  <div className="absolute right-2 top-2.5 text-zinc-300 pointer-events-none">
                      <ChevronDown size={14} />
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-sm border border-zinc-200 dark:border-zinc-800 mb-6 overflow-hidden transition-all duration-300 h-full flex flex-col">
      {/* Standardized Header */}
      <div 
          className="p-4 bg-white dark:bg-zinc-900 flex justify-between items-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shrink-0"
          onClick={toggleHandler}
      >
        <div className="flex items-center gap-3">
            <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-sm text-amber-600 dark:text-amber-500">
                <Briefcase size={20} />
            </div>
            <div>
                <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 font-mono uppercase tracking-tight">Szczegóły Projektu</h2>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                    {!showContent && (data.orderNumber || data.projectNumber) ? (
                        <>
                            {data.orderNumber && <span>{data.orderNumber}</span>}
                            {data.orderNumber && data.projectNumber && <span>•</span>}
                            {data.projectNumber && <span>{data.projectNumber}</span>}
                        </>
                    ) : "Numery, Daty, Osoby"}
                </div>
            </div>
        </div>
        <button className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-transform duration-300" style={{ transform: showContent ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <ChevronDown size={20}/>
        </button>
      </div>
      
      <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${showContent ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'} flex-1`}>
          <div className="overflow-hidden h-full flex flex-col">
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                <div className="md:col-span-2">
                    <label className={labelClass}>Nr Zamówienia</label>
                    <input
                        type="text"
                        value={data.orderNumber}
                        onChange={(e) => handleChange('orderNumber', e.target.value)}
                        className={`${inputClass} font-bold text-zinc-900 dark:text-white`}
                        placeholder="np. ZAM/2024/..."
                    />
                </div>
                
                {mode === CalculationMode.INITIAL && (
                    <div>
                        <label className={labelClass}>Data Zamówienia</label>
                        <div className="relative group">
                            <Calendar className="absolute left-2.5 top-2.5 text-zinc-400 group-focus-within:text-amber-600" size={14}/>
                            <input
                                type="date"
                                value={data.orderDate}
                                onChange={(e) => handleChange('orderDate', e.target.value)}
                                className={`${inputClass} pl-9`}
                            />
                        </div>
                    </div>
                )}

                {mode === CalculationMode.FINAL && (
                    <div>
                        <label className={labelClass}>Data Protokołu</label>
                        <div className="relative group">
                            <Calendar className="absolute left-2.5 top-2.5 text-zinc-400 group-focus-within:text-amber-600" size={14}/>
                            <input
                                type="date"
                                value={data.protocolDate}
                                onChange={(e) => handleChange('protocolDate', e.target.value)}
                                className={`${inputClass} pl-9`}
                            />
                        </div>
                    </div>
                )}

                <div>
                    <label className={labelClass}>Nr Projektu SAP</label>
                    <div className="relative flex items-center group">
                        <span className="absolute left-1 top-1 bottom-1 flex items-center justify-center text-zinc-400 text-[10px] font-mono select-none bg-zinc-100 dark:bg-zinc-800 px-1.5 rounded-sm border border-zinc-200 dark:border-zinc-700">{sapPrefix}</span>
                        <input
                            type="text"
                            value={displaySap}
                            onChange={(e) => handleSapChange(e.target.value)}
                            maxLength={5} 
                            className={`${inputClass} pl-14 font-mono tracking-widest`}
                            placeholder="XXXXX"
                        />
                    </div>
                </div>
                
                <div className="md:col-span-2 border-t border-zinc-100 dark:border-zinc-800 my-1"></div>

                <div className="md:col-span-2">
                    <label className={labelClass}>Nr Projektu (CRM)</label>
                    <div className="relative group">
                        <ScanLine className="absolute left-2.5 top-2.5 text-zinc-400 group-focus-within:text-amber-600" size={14}/>
                        <input
                            type="text"
                            value={data.projectNumber}
                            onChange={(e) => handleProjectNumberChange(e.target.value)}
                            className={`${inputClass} pl-9 font-mono tracking-wide`}
                            placeholder="8 cyfr (np. 12345678)"
                            maxLength={8}
                        />
                    </div>
                </div>

                {/* NEW FIELDS START */}
                <div>
                    <label className={labelClass}>Typ Projektu</label>
                    <div className="relative group">
                        <Layers className="absolute left-2.5 top-2.5 text-zinc-400 group-focus-within:text-amber-600 pointer-events-none" size={14}/>
                        <select
                            value={data.installationType || ''}
                            onChange={(e) => handleChange('installationType', e.target.value)}
                            className={`${inputClass} pl-9 appearance-none cursor-pointer`}
                        >
                            <option value="">Wybierz...</option>
                            {INSTALLATION_TYPES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <div className="absolute right-2 top-2.5 text-zinc-300 pointer-events-none">
                            <ChevronDown size={14} />
                        </div>
                    </div>
                </div>

                <div>
                    <label className={labelClass}>Tekst na Fakturze</label>
                    <div className="relative group">
                        <FileText className="absolute left-2.5 top-2.5 text-zinc-400 group-focus-within:text-amber-600 pointer-events-none" size={14}/>
                        <select
                            value={data.invoiceText || ''}
                            onChange={(e) => handleChange('invoiceText', e.target.value)}
                            className={`${inputClass} pl-9 appearance-none cursor-pointer`}
                        >
                            <option value="">Wybierz...</option>
                            {INVOICE_TEXTS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <div className="absolute right-2 top-2.5 text-zinc-300 pointer-events-none">
                            <ChevronDown size={14} />
                        </div>
                    </div>
                </div>
                {/* NEW FIELDS END */}
                
                <div className="md:col-span-2 border-t border-zinc-100 dark:border-zinc-800 my-1"></div>

                {/* PERSONEL SECTION - REORGANIZED */}
                {/* Row 1: Engineer & Specialist */}
                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    {renderPersonSelect("Inżynier", data.salesPerson, (v) => handleChange('salesPerson', v), SALES_PEOPLE)}
                    {renderPersonSelect("Specjalista", data.assistantPerson, (v) => handleChange('assistantPerson', v), SUPPORT_PEOPLE)}
                </div>
                
                {/* Row 2: Sales Person 1 (Handlowiec 1) */}
                <div className="md:col-span-2 flex gap-2 items-end">
                    <div className="flex-1">
                        {renderPersonSelect("Handlowiec 1", data.actualSalesPerson || '', (v) => handleChange('actualSalesPerson', v), ACTUAL_SALES_PEOPLE)}
                    </div>
                    <div className="w-20">
                         <label className="block text-[9px] font-bold text-zinc-400 uppercase mb-1 ml-1 tracking-wider">%</label>
                         <div className="relative">
                             <select 
                                className={`${inputClass} px-2 appearance-none cursor-pointer font-bold text-center`}
                                value={data.actualSalesPersonPercentage ?? 100}
                                onChange={(e) => handleChange('actualSalesPersonPercentage', parseInt(e.target.value))}
                             >
                                 <option value={100}>100%</option>
                                 <option value={75}>75%</option>
                                 <option value={50}>50%</option>
                                 <option value={25}>25%</option>
                                 <option value={0}>0%</option>
                             </select>
                             <div className="absolute right-1 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                                <ChevronDown size={12} />
                             </div>
                         </div>
                    </div>
                </div>

                {/* Row 3: Sales Person 2 (Handlowiec 2) */}
                <div className="md:col-span-2 flex gap-2 items-end">
                    <div className="flex-1">
                        {renderPersonSelect("Handlowiec 2", data.actualSalesPerson2 || '', (v) => handleChange('actualSalesPerson2', v), ACTUAL_SALES_PEOPLE)}
                    </div>
                    <div className="w-20">
                         <label className="block text-[9px] font-bold text-zinc-400 uppercase mb-1 ml-1 tracking-wider">%</label>
                         <div className="relative">
                             <select 
                                className={`${inputClass} px-2 appearance-none cursor-pointer font-bold text-center`}
                                value={data.actualSalesPerson2Percentage ?? 0}
                                onChange={(e) => handleChange('actualSalesPerson2Percentage', parseInt(e.target.value))}
                             >
                                 <option value={100}>100%</option>
                                 <option value={75}>75%</option>
                                 <option value={50}>50%</option>
                                 <option value={25}>25%</option>
                                 <option value={0}>0%</option>
                             </select>
                             <div className="absolute right-1 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                                <ChevronDown size={12} />
                             </div>
                         </div>
                    </div>
                </div>

            </div>
          </div>
      </div>
    </div>
  );
};