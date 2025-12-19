
import React, { useState, useEffect } from 'react';
import { Supplier, SupplierItem, Currency, SupplierStatus } from '../types';
import { X, Save, Maximize2, Calendar, Hash, Tag, Globe, MapPin, Building2, AtSign, User, Phone, AlertCircle } from 'lucide-react';
import { DataGrid } from './DataGrid';

interface Props {
    supplier: Supplier;
    onSave: (supplier: Supplier) => void;
    onClose: () => void;
}

export const SupplierDetailModal: React.FC<Props> = ({ supplier, onSave, onClose }) => {
    const [localSupplier, setLocalSupplier] = useState<Supplier>(JSON.parse(JSON.stringify(supplier)));

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const updateSupplierField = (field: keyof Supplier, value: any) => {
        setLocalSupplier(prev => ({ ...prev, [field]: value }));
    };

    const updateItem = (itemId: string, field: keyof SupplierItem, value: any) => {
        const newItems = [...localSupplier.items];
        const index = newItems.findIndex(i => i.id === itemId);
        if (index >= 0) {
            newItems[index] = { ...newItems[index], [field]: value };
            setLocalSupplier({ ...localSupplier, items: newItems });
        }
    };

    const moveItem = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === localSupplier.items.length - 1) return;

        const newItems = [...localSupplier.items];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        const temp = newItems[index];
        newItems[index] = newItems[targetIndex];
        newItems[targetIndex] = temp;
        setLocalSupplier({ ...localSupplier, items: newItems });
    };

    const removeItem = (itemId: string) => {
        const newItems = localSupplier.items.filter(i => i.id !== itemId);
        setLocalSupplier({ ...localSupplier, items: newItems });
    };

    const addItem = () => {
        const newItem: SupplierItem = {
            id: Math.random().toString(36).substr(2, 9),
            itemDescription: '',
            componentNumber: '',
            quantity: 1,
            weight: 0,
            unitPrice: 0
        };
        setLocalSupplier({ ...localSupplier, items: [...localSupplier.items, newItem] });
    };

    // Validation Logic
    const validateField = (field: keyof Supplier, value: any): boolean => {
        // ORM or Excluded suppliers are implicitly valid in context, but for editing we show validation
        if (localSupplier.isOrm) return true;

        const strVal = String(value || '').trim();

        switch (field) {
            case 'name':
            case 'street':
            case 'city':
                return strVal.length > 0;
            case 'nip':
                return strVal.replace(/[^0-9]/g, '').length === 10;
            case 'zip':
                return /^\d{2}-?\d{3}$/.test(strVal);
            case 'email':
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal);
            default:
                return true; // Other fields are optional or don't need strict validation here
        }
    };

    const getValidationClass = (field: keyof Supplier) => {
        const isValid = validateField(field, localSupplier[field]);
        return isValid
            ? 'border-zinc-200 dark:border-zinc-600 focus:border-yellow-400'
            : 'border-red-500 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 focus:border-red-600';
    };

    const errors = [
        !validateField('name', localSupplier.name) && 'Nazwa',
        !validateField('street', localSupplier.street) && 'Ulica',
        !validateField('zip', localSupplier.zip) && 'Kod pocztowy',
        !validateField('city', localSupplier.city) && 'Miasto',
        !validateField('nip', localSupplier.nip) && 'NIP',
        !validateField('email', localSupplier.email) && 'Email',
    ].filter(Boolean) as string[];

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col overflow-hidden animate-slideUp border border-zinc-200 dark:border-zinc-700"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header / Toolbar */}
                <div className="flex flex-col border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                    <div className="flex justify-between items-center p-4 pb-2">
                        <div className="flex items-center gap-3">
                            <div className="bg-yellow-500 p-2 rounded text-white shadow-sm">
                                <Maximize2 size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 leading-tight">Edycja Dostawcy</h2>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Tryb pełnoekranowy</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {errors.length > 0 && !localSupplier.isOrm && (
                                <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded border border-red-200 dark:border-red-800 text-xs font-bold animate-pulse">
                                    <AlertCircle size={14} />
                                    <span>Błędy: {errors.length}</span>
                                </div>
                            )}
                            <button
                                onClick={() => onSave(localSupplier)}
                                className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded font-bold shadow-sm transition-colors text-sm"
                            >
                                <Save size={18} /> Zapisz i Zamknij
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    {/* Editable Fields Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 px-4 pb-4">
                        <div className="col-span-1 md:col-span-2">
                            <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                                Nazwa Dostawcy <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                className={`w-full p-2 border rounded bg-white dark:bg-zinc-700 dark:text-white text-sm font-semibold outline-none transition-all ${getValidationClass('name')}`}
                                value={localSupplier.name}
                                onChange={(e) => updateSupplierField('name', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1"><Hash size={10} /> Nr Oferty</label>
                            <input
                                type="text"
                                className="w-full p-2 border rounded border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 dark:text-white text-sm focus:border-yellow-400 outline-none"
                                value={localSupplier.offerNumber}
                                onChange={(e) => updateSupplierField('offerNumber', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1"><Calendar size={10} /> Data Dostawy</label>
                            <div className="flex gap-1 items-center flex-nowrap">
                                <input
                                    type="date"
                                    className="w-full p-2 border rounded border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 dark:text-white text-sm focus:border-yellow-400 outline-none disabled:bg-zinc-100 dark:disabled:bg-zinc-700 disabled:text-zinc-400 min-w-0"
                                    value={localSupplier.deliveryDate === 'ASAP' ? '' : localSupplier.deliveryDate}
                                    onChange={(e) => updateSupplierField('deliveryDate', e.target.value)}
                                    disabled={localSupplier.deliveryDate === 'ASAP'}
                                />
                                <button
                                    onClick={() => updateSupplierField('deliveryDate', localSupplier.deliveryDate === 'ASAP' ? '' : 'ASAP')}
                                    className={`px-2 py-2 rounded text-[10px] font-bold border transition-colors flex-shrink-0 whitespace-nowrap h-[38px] ${localSupplier.deliveryDate === 'ASAP' ? 'bg-red-500 text-white border-red-600' : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-red-400 hover:text-red-500'}`}
                                >
                                    ASAP
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1"><Globe size={10} /> Waluta</label>
                                <select
                                    className="w-full p-2 border rounded border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 dark:text-white text-sm focus:border-yellow-400 outline-none disabled:bg-zinc-100 disabled:text-zinc-400"
                                    value={localSupplier.currency}
                                    onChange={(e) => updateSupplierField('currency', e.target.value)}
                                    disabled={localSupplier.isOrm}
                                >
                                    <option value={Currency.PLN}>PLN</option>
                                    <option value={Currency.EUR}>EUR</option>
                                </select>
                            </div>
                            <div className="w-20">
                                <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1"><Tag size={10} /> Rabat %</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="w-full p-2 border rounded border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 dark:text-white text-sm focus:border-yellow-400 outline-none disabled:bg-zinc-100 disabled:text-zinc-400"
                                    value={localSupplier.discount}
                                    onChange={(e) => updateSupplierField('discount', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Address Fields (New Section) */}
                    <div className="px-4 pb-4 border-t border-dashed border-zinc-200 dark:border-zinc-700 pt-3">
                        <div className="text-[10px] font-bold text-zinc-400 uppercase mb-2">Dane do zamówienia (Adres / Kontakt)</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="relative group">
                                <MapPin className={`absolute left-2 top-2.5 ${validateField('street', localSupplier.street) ? 'text-zinc-400' : 'text-red-500'}`} size={14} />
                                <input
                                    type="text"
                                    placeholder="Ulica i nr *"
                                    className={`w-full pl-8 p-2 border rounded bg-white dark:bg-zinc-700 dark:text-white text-xs outline-none ${getValidationClass('street')}`}
                                    value={localSupplier.street || ''}
                                    onChange={(e) => updateSupplierField('street', e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Kod *"
                                    className={`w-20 p-2 border rounded bg-white dark:bg-zinc-700 dark:text-white text-xs outline-none ${getValidationClass('zip')}`}
                                    value={localSupplier.zip || ''}
                                    onChange={(e) => updateSupplierField('zip', e.target.value)}
                                    title="Format: XX-XXX lub XXXXX"
                                />
                                <input
                                    type="text"
                                    placeholder="Miasto *"
                                    className={`flex-1 p-2 border rounded bg-white dark:bg-zinc-700 dark:text-white text-xs outline-none ${getValidationClass('city')}`}
                                    value={localSupplier.city || ''}
                                    onChange={(e) => updateSupplierField('city', e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2">
                                <div className="relative group flex-1">
                                    <Building2 className={`absolute left-2 top-2.5 ${validateField('nip', localSupplier.nip) ? 'text-zinc-400' : 'text-red-500'}`} size={14} />
                                    <input
                                        type="text"
                                        placeholder="NIP *"
                                        className={`w-full pl-8 p-2 border rounded bg-white dark:bg-zinc-700 dark:text-white text-xs outline-none font-mono ${getValidationClass('nip')}`}
                                        value={localSupplier.nip || ''}
                                        onChange={(e) => updateSupplierField('nip', e.target.value)}
                                        title="Wymagane 10 cyfr"
                                    />
                                </div>
                                <div className="relative group flex-1">
                                    <Phone className="absolute left-2 top-2.5 text-zinc-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Telefon"
                                        className="w-full pl-8 p-2 border rounded border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 dark:text-white text-xs focus:border-yellow-400 outline-none"
                                        value={localSupplier.phone || ''}
                                        onChange={(e) => updateSupplierField('phone', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <AtSign className={`absolute left-2 top-2.5 ${validateField('email', localSupplier.email) ? 'text-zinc-400' : 'text-red-500'}`} size={14} />
                                    <input
                                        type="text"
                                        placeholder="Email *"
                                        className={`w-full pl-8 p-2 border rounded bg-white dark:bg-zinc-700 dark:text-white text-xs outline-none ${getValidationClass('email')}`}
                                        value={localSupplier.email || ''}
                                        onChange={(e) => updateSupplierField('email', e.target.value)}
                                    />
                                </div>
                                <div className="relative flex-1">
                                    <User className="absolute left-2 top-2.5 text-zinc-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Osoba kont."
                                        className="w-full pl-8 p-2 border rounded border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 dark:text-white text-xs focus:border-yellow-400 outline-none"
                                        value={localSupplier.contactPerson || ''}
                                        onChange={(e) => updateSupplierField('contactPerson', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* DataGrid Styled Table */}
                <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-zinc-900 p-4">
                    <DataGrid
                        items={localSupplier.items}
                        currency={localSupplier.currency}
                        isOrm={localSupplier.isOrm}
                        onUpdateItem={updateItem}
                        onDeleteItem={removeItem}
                        onAddItem={addItem}
                        onMoveItem={moveItem}
                        className="h-full" // Force full height in modal
                    />
                </div>

                {/* Footer Summary */}
                <div className="bg-zinc-50 dark:bg-zinc-800 p-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end items-center gap-8 text-sm shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                    <div className="flex gap-6 text-zinc-600 dark:text-zinc-400">
                        <div>
                            Pozycji: <span className="font-bold text-zinc-900 dark:text-white">{localSupplier.items.length}</span>
                        </div>
                        <div>
                            Waga całk.: <span className="font-bold text-zinc-900 dark:text-white">{localSupplier.items.reduce((s, i) => s + (i.weight * i.quantity), 0).toLocaleString()} kg</span>
                        </div>
                    </div>
                    <div className="pl-6 border-l border-zinc-300 dark:border-zinc-600">
                        <span className="text-zinc-500 dark:text-zinc-400 uppercase text-xs font-bold mr-2">Suma Netto ({localSupplier.currency}):</span>
                        <span className="font-mono font-bold text-xl text-zinc-900 dark:text-white">
                            {localSupplier.items.reduce((sum, i) => sum + (i.quantity * (localSupplier.isOrm ? i.unitPrice * 0.5 : i.unitPrice)), 0).toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
