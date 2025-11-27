
import React, { useState } from 'react';
import { AddressData } from '../types';
import { Copy, Users, Lock, CreditCard, Phone, Mail, User, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react';

interface Props {
  data: {
    payer: AddressData;
    recipient: AddressData;
    orderingParty: AddressData;
  };
  onChange: (field: 'payer' | 'recipient' | 'orderingParty', value: AddressData) => void;
  readOnly?: boolean;
}

const AddressForm: React.FC<{
  title: string;
  value: AddressData;
  onChange: (val: AddressData) => void;
  onCopyFrom?: () => void;
  copyLabel?: string;
  readOnly?: boolean;
  showContactFields?: boolean;
}> = ({ title, value, onChange, onCopyFrom, copyLabel, readOnly, showContactFields }) => {
  const [nipError, setNipError] = useState(false);

  const handleNipBlur = () => {
      const nip = value.nip.replace(/[^0-9]/g, ''); // Strip non-digits
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

  return (
    <div className={`p-5 rounded-xl border border-zinc-100 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-900/40 hover:bg-white dark:hover:bg-zinc-900/60 transition-colors duration-200 ${readOnly ? 'opacity-80' : ''}`}>
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 text-sm uppercase tracking-wide">
                <div className="p-1.5 bg-white dark:bg-zinc-800 rounded-md text-zinc-500 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-700"><Users size={14} /></div>
                {title} 
                {readOnly && <Lock size={12} className="text-zinc-400"/>}
            </h3>
            {onCopyFrom && !readOnly && (
                <button
                onClick={onCopyFrom}
                className="text-[10px] flex items-center gap-1 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1 rounded-md font-medium"
                >
                <Copy size={10} /> {copyLabel}
                </button>
            )}
        </div>
        
        <div className="space-y-3">
            <input
                type="text"
                placeholder={readOnly ? "Dane zablokowane" : "Nazwa firmy / Imię i Nazwisko"}
                className="w-full p-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-300 dark:focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition-all disabled:opacity-50"
                value={value.name}
                onChange={(e) => onChange({ ...value, name: e.target.value })}
                disabled={readOnly}
            />
            <div className="grid grid-cols-2 gap-3">
                <input
                type="text"
                placeholder="Ulica i numer"
                className="col-span-2 w-full p-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-300 dark:focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition-all disabled:opacity-50"
                value={value.street}
                onChange={(e) => onChange({ ...value, street: e.target.value })}
                disabled={readOnly}
                />
                <input
                type="text"
                placeholder="Kod"
                className="w-full p-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-300 dark:focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition-all disabled:opacity-50"
                value={value.zip}
                onChange={(e) => onChange({ ...value, zip: e.target.value })}
                onBlur={handleZipBlur}
                disabled={readOnly}
                />
                <input
                type="text"
                placeholder="Miasto"
                className="w-full p-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-300 dark:focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition-all disabled:opacity-50"
                value={value.city}
                onChange={(e) => onChange({ ...value, city: e.target.value })}
                disabled={readOnly}
                />
            </div>
            
            {/* NIP Field */}
            <div className="relative group">
                <CreditCard className={`absolute left-3 top-3 ${nipError ? 'text-red-400' : 'text-zinc-400 group-focus-within:text-zinc-600'}`} size={16} />
                <input
                    type="text"
                    placeholder="NIP"
                    className={`w-full pl-10 p-2.5 bg-white dark:bg-zinc-800 border rounded-lg text-sm outline-none transition-all disabled:opacity-50 ${
                        nipError 
                        ? 'border-red-300 focus:ring-4 focus:ring-red-50 text-red-600' 
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-300 dark:focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800'
                    }`}
                    value={value.nip}
                    onChange={(e) => { onChange({ ...value, nip: e.target.value }); setNipError(false); }}
                    onBlur={handleNipBlur}
                    disabled={readOnly}
                />
                {nipError && <AlertCircle className="absolute right-3 top-3 text-red-500" size={16} title="Nieprawidłowy format NIP" />}
            </div>

            {showContactFields && (
                <div className="pt-3 border-t border-dashed border-zinc-200 dark:border-zinc-700 space-y-3 mt-3">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Kontakt</p>
                    <div className="relative group">
                        <User className="absolute left-3 top-3 text-zinc-400 group-focus-within:text-zinc-600" size={16} />
                        <input
                            type="text"
                            placeholder="Imię i Nazwisko"
                            className="w-full pl-10 p-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-300 dark:focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition-all disabled:opacity-50"
                            value={value.contactPerson || ''}
                            onChange={(e) => onChange({ ...value, contactPerson: e.target.value })}
                            disabled={readOnly}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="relative group">
                            <Mail className="absolute left-3 top-3 text-zinc-400 group-focus-within:text-zinc-600" size={16} />
                            <input
                                type="text"
                                placeholder="Email"
                                className="w-full pl-10 p-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-300 dark:focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition-all disabled:opacity-50"
                                value={value.email || ''}
                                onChange={(e) => onChange({ ...value, email: e.target.value })}
                                disabled={readOnly}
                            />
                        </div>
                        <div className="relative group">
                            <Phone className="absolute left-3 top-3 text-zinc-400 group-focus-within:text-zinc-600" size={16} />
                            <input
                                type="text"
                                placeholder="Telefon"
                                className="w-full pl-10 p-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-300 dark:focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition-all disabled:opacity-50"
                                value={value.phone || ''}
                                onChange={(e) => onChange({ ...value, phone: e.target.value })}
                                disabled={readOnly}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="pt-2">
                <label className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">Nr Klienta</label>
                <input
                type="text"
                className="w-full p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-600 dark:text-zinc-300 focus:border-zinc-300 dark:focus:border-zinc-500 focus:ring-2 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition-all disabled:opacity-50"
                value={value.clientId}
                onChange={(e) => onChange({ ...value, clientId: e.target.value })}
                disabled={readOnly}
                placeholder="-"
                />
            </div>
        </div>
    </div>
  );
};

export const CustomerSection: React.FC<Props> = ({ data, onChange, readOnly }) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleCopy = (source: AddressData, targetKey: 'recipient' | 'orderingParty') => {
    onChange(targetKey, { ...source });
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 mb-8 overflow-hidden transition-all duration-300">
        <div 
            className="p-5 flex justify-between items-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            onClick={() => setIsOpen(!isOpen)}
        >
            <div className="flex items-center gap-3">
                <div className="bg-yellow-100 p-2 rounded-lg text-yellow-600">
                    <Users size={20} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight">Dane Klienta</h2>
                    {!isOpen && data.payer.name && (
                        <p className="text-xs text-zinc-500 mt-0.5">Płatnik: {data.payer.name}</p>
                    )}
                </div>
            </div>
            <button className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-transform duration-300" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <ChevronDown size={20}/>
            </button>
        </div>
        
        <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
                <div className="p-6 pt-0 border-t border-transparent grid grid-cols-1 md:grid-cols-3 gap-6">
                    {readOnly && (
                        <div className="col-span-1 md:col-span-3 bg-yellow-50/50 text-yellow-800 text-sm p-3 rounded-lg border border-yellow-200/50 flex items-center gap-2">
                            <Lock size={16}/> Dane teleadresowe są dziedziczone z Kalkulacji Wstępnej.
                        </div>
                    )}
                    <AddressForm
                        title="Płatnik"
                        value={data.payer}
                        onChange={(val) => onChange('payer', val)}
                        readOnly={readOnly}
                    />
                    <AddressForm
                        title="Odbiorca"
                        value={data.recipient}
                        onChange={(val) => onChange('recipient', val)}
                        onCopyFrom={() => handleCopy(data.payer, 'recipient')}
                        copyLabel="Kopiuj"
                        readOnly={readOnly}
                        showContactFields={true}
                    />
                    <AddressForm
                        title="Zleceniodawca"
                        value={data.orderingParty}
                        onChange={(val) => onChange('orderingParty', val)}
                        onCopyFrom={() => handleCopy(data.payer, 'orderingParty')}
                        copyLabel="Kopiuj"
                        readOnly={readOnly}
                    />
                </div>
            </div>
        </div>
    </div>
  );
};
