
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
      // Optional: Standardize storage format? For now just validation visual.
  };

  const handleZipBlur = () => {
      let zip = value.zip.replace(/[^0-9]/g, '');
      if (zip.length === 5) {
          zip = zip.slice(0, 2) + '-' + zip.slice(2);
          onChange({ ...value, zip });
      }
  };

  return (
    <div className={`bg-white p-4 rounded-lg shadow-sm border border-zinc-200 ${readOnly ? 'bg-zinc-50 opacity-80' : ''}`}>
        <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-zinc-700 flex items-center gap-2">
            <Users size={18} className="text-yellow-600" /> {title} {readOnly && <Lock size={14} className="text-gray-400"/>}
        </h3>
        {onCopyFrom && !readOnly && (
            <button
            onClick={onCopyFrom}
            className="text-xs flex items-center gap-1 text-yellow-700 hover:text-yellow-900 transition-colors bg-yellow-100 px-2 py-1 rounded"
            >
            <Copy size={12} /> {copyLabel}
            </button>
        )}
        </div>
        <div className="space-y-3">
        <input
            type="text"
            placeholder={readOnly ? "Dane zablokowane" : "Nazwa firmy / Imię i Nazwisko"}
            className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-yellow-400 outline-none disabled:bg-gray-100"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            disabled={readOnly}
        />
        <div className="grid grid-cols-2 gap-2">
            <input
            type="text"
            placeholder="Ulica i numer"
            className="col-span-2 w-full p-2 border rounded text-sm focus:ring-2 focus:ring-yellow-400 outline-none disabled:bg-gray-100"
            value={value.street}
            onChange={(e) => onChange({ ...value, street: e.target.value })}
            disabled={readOnly}
            />
            <input
            type="text"
            placeholder="Kod (xx-xxx)"
            className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-yellow-400 outline-none disabled:bg-gray-100"
            value={value.zip}
            onChange={(e) => onChange({ ...value, zip: e.target.value })}
            onBlur={handleZipBlur}
            disabled={readOnly}
            />
            <input
            type="text"
            placeholder="Miasto"
            className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-yellow-400 outline-none disabled:bg-gray-100"
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            disabled={readOnly}
            />
        </div>
        
        {/* NIP Field */}
        <div className="relative">
            <CreditCard className={`absolute left-2 top-2.5 ${nipError ? 'text-red-400' : 'text-gray-400'}`} size={14} />
            <input
                type="text"
                placeholder="NIP"
                className={`w-full pl-8 p-2 border rounded text-sm outline-none disabled:bg-gray-100 ${
                    nipError 
                    ? 'border-red-300 focus:ring-2 focus:ring-red-200 text-red-600' 
                    : 'focus:ring-2 focus:ring-yellow-400'
                }`}
                value={value.nip}
                onChange={(e) => { onChange({ ...value, nip: e.target.value }); setNipError(false); }}
                onBlur={handleNipBlur}
                disabled={readOnly}
            />
            {nipError && <AlertCircle className="absolute right-2 top-2.5 text-red-500" size={16} title="Nieprawidłowy format NIP (wymagane 10 cyfr)" />}
        </div>

        {showContactFields && (
            <div className="pt-2 border-t border-dashed border-gray-200 space-y-2 mt-2">
                <p className="text-xs text-gray-400 font-semibold uppercase">Osoba kontaktowa</p>
                <div className="relative">
                    <User className="absolute left-2 top-2.5 text-gray-400" size={14} />
                    <input
                        type="text"
                        placeholder="Imię i Nazwisko"
                        className="w-full pl-8 p-2 border rounded text-sm focus:ring-2 focus:ring-yellow-400 outline-none disabled:bg-gray-100"
                        value={value.contactPerson || ''}
                        onChange={(e) => onChange({ ...value, contactPerson: e.target.value })}
                        disabled={readOnly}
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                        <Mail className="absolute left-2 top-2.5 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Email"
                            className="w-full pl-8 p-2 border rounded text-sm focus:ring-2 focus:ring-yellow-400 outline-none disabled:bg-gray-100"
                            value={value.email || ''}
                            onChange={(e) => onChange({ ...value, email: e.target.value })}
                            disabled={readOnly}
                        />
                    </div>
                    <div className="relative">
                        <Phone className="absolute left-2 top-2.5 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Telefon"
                            className="w-full pl-8 p-2 border rounded text-sm focus:ring-2 focus:ring-yellow-400 outline-none disabled:bg-gray-100"
                            value={value.phone || ''}
                            onChange={(e) => onChange({ ...value, phone: e.target.value })}
                            disabled={readOnly}
                        />
                    </div>
                </div>
            </div>
        )}

        <div className="pt-2 border-t border-gray-100 mt-2">
            <div>
                <label className="text-xs text-gray-500">Nr Klienta</label>
                <input
                type="text"
                className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-yellow-400 outline-none disabled:bg-gray-100"
                value={value.clientId}
                onChange={(e) => onChange({ ...value, clientId: e.target.value })}
                disabled={readOnly}
                />
            </div>
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
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 mb-8 overflow-hidden transition-colors">
        <div 
            className="p-4 flex justify-between items-center cursor-pointer bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors"
            onClick={() => setIsOpen(!isOpen)}
        >
            <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                <Users className="text-yellow-500" size={20} /> Dane Klienta
            </h2>
            <div className="flex items-center gap-4">
                {!isOpen && data.payer.name && (
                    <span className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                        Płatnik: <strong className="text-zinc-700 dark:text-zinc-300">{data.payer.name}</strong>
                    </span>
                )}
                <button className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300">
                    {isOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                </button>
            </div>
        </div>
        
        <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
                <div className="p-6 border-t border-zinc-100 dark:border-zinc-700 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {readOnly && (
                        <div className="col-span-1 md:col-span-3 bg-yellow-50 text-yellow-800 text-sm p-3 rounded border border-yellow-200 flex items-center gap-2">
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
                        copyLabel="Kopiuj z Płatnika"
                        readOnly={readOnly}
                        showContactFields={true}
                    />
                    <AddressForm
                        title="Zleceniodawca"
                        value={data.orderingParty}
                        onChange={(val) => onChange('orderingParty', val)}
                        onCopyFrom={() => handleCopy(data.payer, 'orderingParty')}
                        copyLabel="Kopiuj z Płatnika"
                        readOnly={readOnly}
                    />
                </div>
            </div>
        </div>
    </div>
  );
};