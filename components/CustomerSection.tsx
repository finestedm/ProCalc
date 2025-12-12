
import React, { useState } from 'react';
import { AddressData } from '../types';
import { Copy, Users, Lock, CreditCard, Phone, Mail, User, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { DropdownMenu } from './DropdownMenu';

interface Props {
  data: {
    payer: AddressData;
    recipient: AddressData;
    orderingParty: AddressData;
  };
  onChange: (field: 'payer' | 'recipient' | 'orderingParty', value: AddressData) => void;
  readOnly?: boolean;
  isOpen?: boolean; // Controlled state
  onToggle?: () => void; // Toggle handler
}

const AddressForm: React.FC<{
  title: string;
  value: AddressData;
  onChange: (val: AddressData) => void;
  copyOptions?: { label: string; onClick: () => void }[];
  readOnly?: boolean;
  showContactFields?: boolean;
}> = ({ title, value, onChange, copyOptions, readOnly, showContactFields }) => {
  const [nipError, setNipError] = useState(false);

  const handleNipBlur = () => {
      const nip = value.nip.replace(/[^0-9]/g, ''); 
      if (nip.length > 0 && nip.length !== 10) {
          setNipError(true);
      } else {
          setNipError(false);
      }
  };

  const handleZipBlur = () => {
      let zip = value.zip.replace(/[^0-9]/g, '');
      if (zip.length === 5) {
          zip = zip.slice(0, 2) + '-' + zip.slice(2);
          onChange({ ...value, zip });
      }
  };

  // Standard input style class to ensure uniformity
  const standardInputClass = "w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-none text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-amber-500 focus:ring-0 outline-none transition-all disabled:opacity-50";

  return (
    <div className={`p-4 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 ${readOnly ? 'opacity-70 pointer-events-none' : ''} h-full flex flex-col`}>
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase text-xs tracking-wider flex items-center gap-2">
                {title} 
                {readOnly && <Lock size={10} className="text-zinc-400"/>}
            </h3>
            {copyOptions && copyOptions.length > 0 && !readOnly && (
                <DropdownMenu 
                    items={copyOptions}
                    trigger={
                        <div className="text-[10px] uppercase font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors flex items-center gap-1 cursor-pointer">
                            <Copy size={10} /> Kopiuj
                        </div>
                    }
                    align="right"
                />
            )}
        </div>
        
        <div className="space-y-2 flex-1">
            <input
                type="text"
                placeholder={readOnly ? "Zablokowane" : "Nazwa Firmy / Imię i Nazwisko"}
                className={standardInputClass}
                value={value.name}
                onChange={(e) => onChange({ ...value, name: e.target.value })}
                disabled={readOnly}
            />
            <div className="grid grid-cols-3 gap-2">
                <input
                type="text"
                placeholder="Ulica i nr"
                className={`col-span-3 ${standardInputClass}`}
                value={value.street}
                onChange={(e) => onChange({ ...value, street: e.target.value })}
                disabled={readOnly}
                />
                <input
                type="text"
                placeholder="Kod"
                className={standardInputClass}
                value={value.zip}
                onChange={(e) => onChange({ ...value, zip: e.target.value })}
                onBlur={handleZipBlur}
                disabled={readOnly}
                />
                <input
                type="text"
                placeholder="Miasto"
                className={`col-span-2 ${standardInputClass}`}
                value={value.city}
                onChange={(e) => onChange({ ...value, city: e.target.value })}
                disabled={readOnly}
                />
            </div>
            
            <div className="relative group">
                <CreditCard className={`absolute left-3 top-2.5 ${nipError ? 'text-red-400' : 'text-zinc-400'}`} size={14} />
                <input
                    type="text"
                    placeholder="NIP"
                    className={`w-full pl-9 px-3 py-2 bg-transparent border rounded-none text-xs outline-none transition-all disabled:opacity-50 font-mono ${
                        nipError 
                        ? 'border-red-500 text-red-600' 
                        : 'border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white focus:border-amber-500'
                    }`}
                    value={value.nip}
                    onChange={(e) => { onChange({ ...value, nip: e.target.value }); setNipError(false); }}
                    onBlur={handleNipBlur}
                    disabled={readOnly}
                />
                {nipError && (
                    <div className="absolute right-2 top-2.5 text-red-500" title="Niepoprawny format NIP">
                        <AlertCircle size={14} />
                    </div>
                )}
            </div>

            {showContactFields && (
                <div className="pt-3 mt-3 border-t border-dashed border-zinc-200 dark:border-zinc-800 space-y-2">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Dane Kontaktowe</p>
                    <div className="relative group">
                        <User className="absolute left-3 top-2.5 text-zinc-400" size={14} />
                        <input
                            type="text"
                            placeholder="Osoba Kontaktowa"
                            className={`pl-9 ${standardInputClass}`}
                            value={value.contactPerson || ''}
                            onChange={(e) => onChange({ ...value, contactPerson: e.target.value })}
                            disabled={readOnly}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="relative group">
                            <Mail className="absolute left-3 top-2.5 text-zinc-400" size={14} />
                            <input
                                type="text"
                                placeholder="Email"
                                className={`pl-9 ${standardInputClass}`}
                                value={value.email || ''}
                                onChange={(e) => onChange({ ...value, email: e.target.value })}
                                disabled={readOnly}
                            />
                        </div>
                        <div className="relative group">
                            <Phone className="absolute left-3 top-2.5 text-zinc-400" size={14} />
                            <input
                                type="text"
                                placeholder="Telefon"
                                className={`pl-9 ${standardInputClass}`}
                                value={value.phone || ''}
                                onChange={(e) => onChange({ ...value, phone: e.target.value })}
                                disabled={readOnly}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="pt-1 mt-auto">
                <input
                type="text"
                className={`${standardInputClass} font-mono`} // Applied same styling + font-mono for ID
                value={value.clientId}
                onChange={(e) => onChange({ ...value, clientId: e.target.value })}
                disabled={readOnly}
                placeholder="ID Klienta"
                />
            </div>
        </div>
    </div>
  );
};

export const CustomerSection: React.FC<Props> = ({ data, onChange, readOnly, isOpen = true, onToggle }) => {
  const [internalOpen, setInternalOpen] = useState(true);
  
  // Use controlled state if provided, otherwise local
  const showContent = onToggle ? isOpen : internalOpen;
  const toggleHandler = onToggle || (() => setInternalOpen(!internalOpen));

  const handleCopy = (source: AddressData, targetKey: 'payer' | 'recipient' | 'orderingParty') => {
    onChange(targetKey, { ...source });
  };

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden mb-6 h-full flex flex-col">
        <div 
            className="p-4 bg-white dark:bg-zinc-900 flex justify-between items-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shrink-0"
            onClick={toggleHandler}
        >
            <div className="flex items-center gap-3">
                <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-sm text-amber-600 dark:text-amber-500">
                    <Users size={20} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 font-mono uppercase tracking-tight">Dane Klienta</h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {!showContent && data.payer.name ? data.payer.name : "Płatnik, Odbiorca, Zamawiający"}
                    </p>
                </div>
            </div>
            <button className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-transform duration-300" style={{ transform: showContent ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <ChevronDown size={20}/>
            </button>
        </div>
        
        <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${showContent ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'} flex-1`}>
            <div className="overflow-hidden h-full flex flex-col">
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-zinc-50/50 dark:bg-black border-t border-zinc-100 dark:border-zinc-800 flex-1">
                    {readOnly && (
                        <div className="col-span-1 md:col-span-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 text-xs text-zinc-500 flex items-center gap-2 shrink-0">
                            <Lock size={12}/> Dane zablokowane z wyceny wstępnej.
                        </div>
                    )}
                    <AddressForm
                        title="Płatnik"
                        value={data.payer}
                        onChange={(val) => onChange('payer', val)}
                        copyOptions={[
                            { label: "Kopiuj z Odbiorcy", onClick: () => handleCopy(data.recipient, 'payer') },
                            { label: "Kopiuj z Zamawiającego", onClick: () => handleCopy(data.orderingParty, 'payer') }
                        ]}
                        readOnly={readOnly}
                    />
                    <AddressForm
                        title="Odbiorca"
                        value={data.recipient}
                        onChange={(val) => onChange('recipient', val)}
                        copyOptions={[
                            { label: "Kopiuj z Płatnika", onClick: () => handleCopy(data.payer, 'recipient') },
                            { label: "Kopiuj z Zamawiającego", onClick: () => handleCopy(data.orderingParty, 'recipient') }
                        ]}
                        readOnly={readOnly}
                        showContactFields={true}
                    />
                    <AddressForm
                        title="Zamawiający"
                        value={data.orderingParty}
                        onChange={(val) => onChange('orderingParty', val)}
                        copyOptions={[
                            { label: "Kopiuj z Płatnika", onClick: () => handleCopy(data.payer, 'orderingParty') },
                            { label: "Kopiuj z Odbiorcy", onClick: () => handleCopy(data.recipient, 'orderingParty') }
                        ]}
                        readOnly={readOnly}
                    />
                </div>
            </div>
        </div>
    </div>
  );
};
