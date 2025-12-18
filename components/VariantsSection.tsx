
import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { CalculationData, ProjectVariant, VariantItem, VariantItemType, Currency, VariantStatus } from '../types';
import { Layers, Search, Trash2, Eye, EyeOff, ChevronDown, ChevronUp, Check, X, Crosshair, MinusCircle, Link, ArrowRight, Edit2, Lock, Plus, MousePointer2, Receipt, GripVertical, CornerDownRight, Outdent, GitBranch, Copy, Package } from 'lucide-react';
import { convert, calculateStageCost, formatCurrency } from '../services/calculationService';

interface Props {
    data: CalculationData;
    onChange: (data: CalculationData) => void;
    exchangeRate: number;
    offerCurrency: Currency;
    onConfirm: (title: string, message: string, onConfirm: () => void, isDanger?: boolean) => void;
    onEnterPickingMode?: (variantId: string) => void;
    ormFeePercent: number;
}

interface SearchResult {
    id: string;
    type: VariantItemType;
    label: string;
    description?: string;
    isGroup?: boolean;
    groupId?: string; // For macro selection or linking items to parents
    value?: number; // Estimated value for display
    currency?: Currency;
    isRecommended?: boolean; // Smart linking recommendation
}

interface TreeNode {
    variant: ProjectVariant;
    children: TreeNode[];
    depth: number;
}

export const VariantsSection: React.FC<Props> = ({ data, onChange, exchangeRate, offerCurrency, onConfirm, onEnterPickingMode, ormFeePercent }) => {
    const [isOpen, setIsOpen] = useState(true);
    const [newVariantName, setNewVariantName] = useState('');
    const [activeVariantId, setActiveVariantId] = useState<string | null>(null); // For editing (expanding row)
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false); // Controls visibility
    const [hoveredItemId, setHoveredItemId] = useState<{ id: string, type: VariantItemType } | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number, left: number, width: number } | null>(null);

    // Drag & Drop State
    const [draggedVariantId, setDraggedVariantId] = useState<string | null>(null);
    const [dragOverVariantId, setDragOverVariantId] = useState<string | null>(null);

    const searchInputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // --- POSITIONING & DROPDOWN LOGIC ---
    const updateDropdownPosition = () => {
        if (searchInputRef.current) {
            const rect = searchInputRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + 5,
                left: rect.left,
                width: rect.width
            });
        }
    };

    useLayoutEffect(() => {
        if (showDropdown && activeVariantId) {
            updateDropdownPosition();
            window.addEventListener('scroll', updateDropdownPosition, true);
            window.addEventListener('resize', updateDropdownPosition);
        }
        return () => {
            window.removeEventListener('scroll', updateDropdownPosition, true);
            window.removeEventListener('resize', updateDropdownPosition);
        };
    }, [showDropdown, activeVariantId, searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                searchInputRef.current &&
                !searchInputRef.current.contains(event.target as Node)
            ) {
                setShowDropdown(false);
            }
        };
        if (showDropdown) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDropdown]);


    // --- TREE BUILDER ---
    const variantTree = useMemo(() => {
        const variants = data.variants || [];
        const map = new Map<string, TreeNode>();

        // Init nodes
        variants.forEach(v => map.set(v.id, { variant: v, children: [], depth: 0 }));

        const roots: TreeNode[] = [];

        variants.forEach(v => {
            const node = map.get(v.id)!;
            if (v.parentId && map.has(v.parentId)) {
                const parent = map.get(v.parentId)!;
                parent.children.push(node);
            } else {
                roots.push(node);
            }
        });

        // Assign depth recursively
        const assignDepth = (node: TreeNode, depth: number) => {
            node.depth = depth;
            node.children.forEach(child => assignDepth(child, depth + 1));
        };
        roots.forEach(r => assignDepth(r, 0));

        return roots;
    }, [data.variants]);

    // Flatten for rendering
    const flattenTree = (nodes: TreeNode[]): TreeNode[] => {
        let result: TreeNode[] = [];
        nodes.forEach(node => {
            result.push(node);
            if (!node.variant.isCollapsed) {
                result = [...result, ...flattenTree(node.children)];
            }
        });
        return result;
    };

    const visibleRows = flattenTree(variantTree);


    // --- ACTIONS ---

    const addVariant = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newVariantName.trim()) return;
        const newVariant: ProjectVariant = {
            id: Math.random().toString(36).substr(2, 9),
            name: newVariantName.trim(),
            status: 'NEUTRAL', // Start as Neutral
            items: []
        };
        onChange({ ...data, variants: [...(data.variants || []), newVariant] });
        setNewVariantName('');
        setActiveVariantId(newVariant.id);
        setShowDropdown(true); // Auto open search for new variant
    };

    const createChildVariant = (parentId: string) => {
        const parent = data.variants.find(v => v.id === parentId);
        if (!parent) return;

        const newVariant: ProjectVariant = {
            id: Math.random().toString(36).substr(2, 9),
            name: `${parent.name} (Opcja)`,
            status: 'NEUTRAL',
            items: JSON.parse(JSON.stringify(parent.items)), // Deep copy items from parent
            parentId: parentId
        };

        // Immutable update for parent (expand) + add new variant
        const newVariants = data.variants.map(v =>
            v.id === parentId ? { ...v, isCollapsed: false } : v
        );

        const newData = { ...data, variants: [...newVariants, newVariant] };

        recalculateGlobalExclusions(newData);
        onChange(newData);
        setActiveVariantId(newVariant.id); // Auto-focus for editing
    };

    const removeVariant = (id: string) => {
        onConfirm(
            "Usuwanie wariantu",
            "Czy na pewno chcesz usunąć ten wariant? Jeśli posiada pod-warianty, one również zostaną usunięte.",
            () => {
                // Recursive delete check
                const getDescendants = (rootId: string, all: ProjectVariant[]): string[] => {
                    const children = all.filter(v => v.parentId === rootId);
                    let ids = children.map(c => c.id);
                    children.forEach(c => ids = [...ids, ...getDescendants(c.id, all)]);
                    return ids;
                };

                const descendants = getDescendants(id, data.variants);
                const idsToRemove = new Set([id, ...descendants]);

                const newData = { ...data, variants: data.variants.filter(v => !idsToRemove.has(v.id)) };
                recalculateGlobalExclusions(newData);
                onChange(newData);
            },
            true
        );
    };

    const updateVariantName = (id: string, newName: string) => {
        const newVariants = data.variants.map(v =>
            v.id === id ? { ...v, name: newName } : v
        );
        onChange({ ...data, variants: newVariants });
    };

    const setVariantStatus = (id: string, status: VariantStatus) => {
        const newVariants = data.variants.map(v => {
            if (v.id === id) {
                const nextStatus: VariantStatus = (v.status === status && status !== 'NEUTRAL') ? 'NEUTRAL' : status;
                return { ...v, status: nextStatus };
            }
            return v;
        });

        const newData = { ...data, variants: newVariants };
        recalculateGlobalExclusions(newData);
        onChange(newData);
    };

    const handleSoloVariant = (variantId: string) => {
        const newVariants = data.variants.map(v => ({
            ...v,
            status: v.id === variantId ? 'INCLUDED' : 'NEUTRAL' as VariantStatus
        }));

        const newData = { ...data, variants: newVariants };
        recalculateGlobalExclusions(newData);
        onChange(newData);
    };

    // --- HIERARCHY ACTIONS ---

    const toggleCollapse = (id: string) => {
        const newVariants = data.variants.map(v =>
            v.id === id ? { ...v, isCollapsed: !v.isCollapsed } : v
        );
        onChange({ ...data, variants: newVariants });
    };

    const makeChild = (childId: string, parentId: string) => {
        // Prevent circular: Check if parentId is a descendant of childId
        const getDescendants = (rootId: string, all: ProjectVariant[]): Set<string> => {
            const children = all.filter(v => v.parentId === rootId);
            let ids = new Set(children.map(c => c.id));
            children.forEach(c => {
                getDescendants(c.id, all).forEach(id => ids.add(id));
            });
            return ids;
        };

        if (childId === parentId) return; // Can't be own parent
        const descendants = getDescendants(childId, data.variants);
        if (descendants.has(parentId)) {
            alert("Nie można przenieść wariantu do własnego pod-wariantu (pętla).");
            return;
        }

        const newVariants = data.variants.map(v => {
            if (v.id === childId) return { ...v, parentId: parentId };
            if (v.id === parentId) return { ...v, isCollapsed: false }; // Auto-expand parent
            return v;
        });

        onChange({ ...data, variants: newVariants });
    };

    const makeRoot = (id: string) => {
        const newVariants = data.variants.map(v =>
            v.id === id ? { ...v, parentId: undefined } : v
        );
        onChange({ ...data, variants: newVariants });
    };

    // --- DRAG AND DROP HANDLERS ---
    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.stopPropagation();
        setDraggedVariantId(id);
        // Create ghost image if needed, or default is fine
    };

    const handleDragOver = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedVariantId === id) return; // Can't drop on self
        setDragOverVariantId(id);
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedVariantId && draggedVariantId !== targetId) {
            makeChild(draggedVariantId, targetId);
        }
        setDraggedVariantId(null);
        setDragOverVariantId(null);
    };

    // --- EXCLUSION LOGIC ---
    const recalculateGlobalExclusions = (d: CalculationData) => {
        const includedVariants = d.variants.filter(v => v.status === 'INCLUDED');
        const excludedVariants = d.variants.filter(v => v.status === 'EXCLUDED');

        const collectIds = (variants: ProjectVariant[]): Set<string> => {
            const ids = new Set<string>();
            variants.forEach(v => {
                v.items.forEach(vItem => {
                    if (vItem.type === 'SUPPLIER_ITEM') {
                        if (vItem.id.startsWith('group_supp_')) {
                            const suppId = vItem.id.replace('group_supp_', '');
                            const supp = d.suppliers.find(s => s.id === suppId);
                            supp?.items.forEach(i => ids.add(i.id));
                        } else {
                            ids.add(vItem.id);
                        }
                    } else {
                        ids.add(vItem.id);
                    }
                });
            });
            return ids;
        };

        const whitelist = collectIds(includedVariants);
        const blacklist = collectIds(excludedVariants);
        const hasInclusions = includedVariants.length > 0;

        const isItemExcluded = (id: string): boolean => {
            if (hasInclusions && !whitelist.has(id)) return true;
            if (blacklist.has(id)) return true;
            return false;
        };

        d.suppliers.forEach(s => s.items.forEach(i => i.isExcluded = isItemExcluded(i.id)));
        d.transport.forEach(t => t.isExcluded = isItemExcluded(t.id));
        d.otherCosts.forEach(o => o.isExcluded = isItemExcluded(o.id));
        d.installation.stages.forEach(stage => stage.isExcluded = isItemExcluded(stage.id));
        // Also handle Global Custom Items
        d.installation.customItems.forEach(i => i.isExcluded = isItemExcluded(i.id));
    };

    // --- VARIANT ITEM MANAGEMENT ---
    const addItemToVariant = (variantId: string, result: SearchResult) => {
        const itemsToAdd: VariantItem[] = [{ id: result.id, type: result.type, originalDescription: result.label }];

        const newVariants = data.variants.map(v => {
            if (v.id === variantId) {
                const currentItems = [...v.items];
                itemsToAdd.forEach(item => {
                    if (!currentItems.some(i => i.id === item.id && i.type === item.type)) {
                        currentItems.push(item);
                    }
                });
                return { ...v, items: currentItems };
            }
            return v;
        });

        const newData = { ...data, variants: newVariants };
        recalculateGlobalExclusions(newData);
        onChange(newData);
        setSearchTerm('');
    };

    const removeItemFromVariant = (variantId: string, itemId: string, type: VariantItemType) => {
        const newVariants = data.variants.map(v => {
            if (v.id === variantId) {
                return {
                    ...v,
                    items: v.items.filter(i => !(i.id === itemId && i.type === type))
                };
            }
            return v;
        });

        const newData = { ...data, variants: newVariants };
        recalculateGlobalExclusions(newData);
        onChange(newData);
    };

    const getItemValue = (id: string, type: VariantItemType): { val: number, curr: Currency } => {
        if (type === 'SUPPLIER_ITEM') {
            if (id.startsWith('group_supp_')) {
                const suppId = id.replace('group_supp_', '');
                const s = data.suppliers.find(x => x.id === suppId);
                if (s) {
                    const sVal = s.items.reduce((sum, i) => sum + (i.quantity * (s.isOrm ? i.unitPrice * 0.5 : i.unitPrice)), 0);
                    const discounted = sVal * (1 - s.discount / 100);
                    const withMarkup = discounted * (1 + (s.extraMarkupPercent || 0) / 100);
                    const fee = s.isOrm ? withMarkup * (ormFeePercent / 100) : 0;
                    return { val: withMarkup + fee, curr: s.currency };
                }
            } else {
                for (const s of data.suppliers) {
                    const item = s.items.find(i => i.id === id);
                    if (item) {
                        const price = s.isOrm ? item.unitPrice * 0.5 : item.unitPrice;
                        const baseVal = item.quantity * price;
                        const discounted = baseVal * (1 - s.discount / 100);
                        const withMarkup = discounted * (1 + (s.extraMarkupPercent || 0) / 100);
                        const fee = s.isOrm ? withMarkup * (ormFeePercent / 100) : 0;
                        return { val: withMarkup + fee, curr: s.currency };
                    }
                }
            }
        } else if (type === 'STAGE') {
            const stage = data.installation.stages.find(s => s.id === id);
            if (stage) return { val: calculateStageCost(stage, data, { ignoreExclusions: true }), curr: Currency.PLN };
        } else if (type === 'TRANSPORT') {
            const t = data.transport.find(x => x.id === id);
            if (t) return { val: t.totalPrice, curr: t.currency };
        } else if (type === 'OTHER') {
            const c = data.otherCosts.find(x => x.id === id);
            if (c) return { val: c.price, curr: c.currency };
        } else if (type === 'CUSTOM_INSTALLATION_ITEM') {
            const item = data.installation.customItems.find(i => i.id === id);
            if (item) {
                // If it's a parent, sum children
                const children = data.installation.customItems.filter(c => c.parentId === id);
                if (children.length > 0) {
                    const childSum = children.reduce((acc, c) => acc + (c.quantity * c.unitPrice), 0);
                    return { val: childSum, curr: Currency.PLN };
                }
                return { val: item.quantity * item.unitPrice, curr: Currency.PLN };
            }
        }
        return { val: 0, curr: Currency.PLN };
    };

    const calculateVariantTotal = (variant: ProjectVariant): number => {
        return variant.items.reduce((sum, vItem) => {
            const { val, curr } = getItemValue(vItem.id, vItem.type);
            return sum + convert(val, curr, offerCurrency, exchangeRate);
        }, 0);
    };

    // --- SEARCH LOGIC ---
    const getContextFromVariant = (variant: ProjectVariant) => {
        const activeSupplierIds = new Set<string>();
        variant.items.forEach(item => {
            if (item.type === 'SUPPLIER_ITEM') {
                if (item.id.startsWith('group_supp_')) {
                    activeSupplierIds.add(item.id.replace('group_supp_', ''));
                } else {
                    const s = data.suppliers.find(sup => sup.items.some(i => i.id === item.id));
                    if (s) activeSupplierIds.add(s.id);
                }
            } else if (item.type === 'TRANSPORT') {
                const t = data.transport.find(tr => tr.id === item.id);
                if (t?.supplierId) activeSupplierIds.add(t.supplierId);
                if (t?.linkedSupplierIds) t.linkedSupplierIds.forEach(id => activeSupplierIds.add(id));
            } else if (item.type === 'STAGE') {
                const st = data.installation.stages.find(s => s.id === item.id);
                if (st?.linkedSupplierIds) st.linkedSupplierIds.forEach(id => activeSupplierIds.add(id));
            }
        });
        return { activeSupplierIds };
    };

    const searchItems = (term: string, currentVariant: ProjectVariant): SearchResult[] => {
        if (!term && currentVariant.items.length === 0) return [];
        const lower = term.toLowerCase();
        const results: SearchResult[] = [];
        const { activeSupplierIds } = getContextFromVariant(currentVariant);

        data.suppliers.forEach(s => {
            const match = !term || s.name.toLowerCase().includes(lower) || (s.customTabName && s.customTabName.toLowerCase().includes(lower));
            const isRelated = activeSupplierIds.has(s.id);
            if (match) {
                results.push({
                    id: `group_supp_${s.id}`, groupId: s.id, type: 'SUPPLIER_ITEM', label: `DOSTAWCA: ${s.customTabName || s.name}`, isGroup: true, isRecommended: isRelated
                });
            }
            if (term) {
                s.items.forEach(i => {
                    if (i.itemDescription.toLowerCase().includes(lower) || i.componentNumber.toLowerCase().includes(lower)) {
                        results.push({ id: i.id, type: 'SUPPLIER_ITEM', groupId: s.id, label: `[Mat] ${i.itemDescription}`, description: `${s.customTabName || s.name} | ${i.componentNumber}` });
                    }
                });
            }
        });

        data.installation.stages.forEach(st => {
            const match = !term || st.name.toLowerCase().includes(lower);
            const isRelated = st.linkedSupplierIds.some(sid => activeSupplierIds.has(sid));
            if (match) {
                results.push({ id: st.id, type: 'STAGE', label: `[Etap] ${st.name}`, description: `${st.linkedSupplierIds.length} dostawców | ${st.calcMethod === 'BOTH' ? 'Łączona' : st.calcMethod}`, isRecommended: isRelated });
            }
        });

        // ADDED: Global Installation Items Search
        data.installation.customItems.forEach(ci => {
            const match = !term || ci.description.toLowerCase().includes(lower);
            if (match) {
                // If it's a parent, indicate context
                let desc = `${ci.quantity} szt. | ${formatCurrency(ci.unitPrice, 'PLN')}`;
                let label = `[Dodatek Globalny] ${ci.description}`;

                if (ci.parentId) {
                    const parent = data.installation.customItems.find(p => p.id === ci.parentId);
                    if (parent) {
                        label = `[${parent.description}] > ${ci.description}`;
                    }
                } else {
                    // Check if it's a group
                    const children = data.installation.customItems.filter(c => c.parentId === ci.id);
                    if (children.length > 0) {
                        desc = `Grupa (${children.length} poz.)`;
                    }
                }

                results.push({ id: ci.id, type: 'CUSTOM_INSTALLATION_ITEM', label: label, description: desc, isRecommended: false });
            }
        });

        data.transport.forEach(t => {
            const name = t.name || (t.supplierId ? data.suppliers.find(s => s.id === t.supplierId)?.name : 'Transport');
            const match = !term || (name && name.toLowerCase().includes(lower));
            let isRelated = false;
            if (t.supplierId && activeSupplierIds.has(t.supplierId)) isRelated = true;
            if (t.linkedSupplierIds && t.linkedSupplierIds.some(id => activeSupplierIds.has(id))) isRelated = true;
            if (match) {
                results.push({ id: t.id, type: 'TRANSPORT', label: `[Transport] ${name}`, description: `${t.trucksCount} aut | ${t.totalPrice.toFixed(0)} ${t.currency}`, isRecommended: isRelated });
            }
        });

        data.otherCosts.forEach(c => {
            const match = !term || c.description.toLowerCase().includes(lower);
            if (match) {
                results.push({ id: c.id, type: 'OTHER', label: `[Inne] ${c.description}`, description: `${c.price.toFixed(2)} ${c.currency}`, isRecommended: false });
            }
        });

        results.sort((a, b) => (b.isRecommended === true ? 1 : 0) - (a.isRecommended === true ? 1 : 0));
        return results;
    };

    const activeVariant = data.variants.find(v => v.id === activeVariantId);
    const searchResults = activeVariant ? searchItems(searchTerm, activeVariant) : [];

    // --- TOOLTIP LOGIC ---
    const handleMouseEnterItem = (e: React.MouseEvent, id: string, type: VariantItemType) => {
        setHoveredItemId({ id, type });
        setTooltipPosition({ x: e.clientX, y: e.clientY });
    };

    const renderTooltip = () => {
        if (!hoveredItemId) return null;
        let content = null;
        let title = '';

        if (hoveredItemId.type === 'SUPPLIER_ITEM' && hoveredItemId.id.startsWith('group_supp_')) {
            const suppId = hoveredItemId.id.replace('group_supp_', '');
            const s = data.suppliers.find(x => x.id === suppId);
            if (s) {
                title = s.customTabName || s.name;
                const totalWeight = s.items.reduce((acc, i) => acc + (i.weight * i.quantity), 0);
                content = (
                    <>
                        <div className="space-y-1 mb-2">
                            {s.items.slice(0, 5).map(i => <div key={i.id} className="flex justify-between"><span className="truncate w-40">{i.itemDescription}</span><span className="text-zinc-400">{i.quantity} szt.</span></div>)}
                            {s.items.length > 5 && <div className="italic text-zinc-500 text-[10px]">+ {s.items.length - 5} innych...</div>}
                        </div>
                        <div className="pt-1 border-t border-zinc-700 font-bold text-yellow-500">Total Waga: {totalWeight.toFixed(0)} kg</div>
                    </>
                );
            }
        } else if (hoveredItemId.type === 'STAGE') {
            const stage = data.installation.stages.find(s => s.id === hoveredItemId.id);
            if (stage) {
                title = stage.name;
                content = (
                    <div className="space-y-1">
                        <div className="flex justify-between"><span className="text-zinc-400">Metoda:</span> <span>{stage.calcMethod}</span></div>
                        {stage.calcMethod !== 'TIME' && <div className="flex justify-between"><span className="text-zinc-400">Miejsca:</span> <span>{stage.palletSpots} szt.</span></div>}
                        <div className="pt-1 border-t border-zinc-700 font-bold text-yellow-500 text-right">{calculateStageCost(stage, data, { ignoreExclusions: true }).toFixed(2)} PLN</div>
                    </div>
                );
            }
        }
        if (!content) return null;
        return <div className="fixed z-[9999] bg-zinc-900 text-white p-3 rounded shadow-xl text-xs w-64 pointer-events-none" style={{ top: tooltipPosition.y + 10, left: tooltipPosition.x + 10 }}><div className="font-bold mb-2 border-b border-zinc-700 pb-1">{title}</div>{content}</div>;
    };

    const headerClass = "p-3 border-b dark:border-zinc-700 bg-zinc-100/50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 text-left";
    const cellClass = "p-3 border-b border-zinc-100 dark:border-zinc-800/50 text-sm align-middle";

    return (
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 mb-6 overflow-hidden transition-colors relative z-0">
            {renderTooltip()}

            <div
                className="p-4 bg-white dark:bg-zinc-900 flex justify-between items-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-3">
                    <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded text-amber-600 dark:text-amber-500">
                        <Layers size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 font-mono uppercase tracking-tight">Warianty / Symulacje</h2>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                            Zarządzanie opcjami what-if (Drzewo wariantów)
                            {data.variants.some(v => v.status === 'INCLUDED') && (
                                <span className="bg-green-100 text-green-700 px-1 rounded text-[10px] font-bold border border-green-200">SOLO MODE</span>
                            )}
                        </div>
                    </div>
                </div>
                <button className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-transform duration-300" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <ChevronDown size={20} />
                </button>
            </div>

            <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="p-0 border-t border-transparent">
                        {/* Add New Variant Toolbar */}
                        <div className="p-4 flex justify-end">
                            <form onSubmit={addVariant} className="flex gap-2 w-full md:w-auto">
                                <input
                                    type="text"
                                    placeholder="Nazwa wariantu..."
                                    className="flex-1 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded text-xs bg-white dark:bg-zinc-900 focus:border-amber-400 outline-none min-w-[200px]"
                                    value={newVariantName}
                                    onChange={(e) => setNewVariantName(e.target.value)}
                                />
                                <button type="submit" className="bg-zinc-800 hover:bg-zinc-700 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-2">
                                    <Plus size={12} /> Utwórz
                                </button>
                            </form>
                        </div>

                        {/* Variants Table */}
                        <div className="overflow-x-auto min-h-[100px] border-t border-zinc-100 dark:border-zinc-800">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                                <thead>
                                    <tr>
                                        <th className={`${headerClass} w-5`}></th> {/* Drag Handle */}
                                        <th className={`${headerClass} w-2/5`}>Nazwa Wariantu</th>
                                        <th className={`${headerClass} text-center`}>Elementy</th>
                                        <th className={`${headerClass} text-right`}>Wartość ({offerCurrency})</th>
                                        <th className={`${headerClass} text-center w-64`}>Status</th>
                                        <th className={`${headerClass} w-48 text-center`}>Akcje</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-zinc-950 divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {visibleRows.length === 0 && (
                                        <tr><td colSpan={6} className="p-8 text-center text-zinc-400 italic text-xs">Brak wariantów. Dodaj pierwszy wariant powyżej.</td></tr>
                                    )}

                                    {visibleRows.map(({ variant, depth, children }) => {
                                        const variantCost = calculateVariantTotal(variant);
                                        const isEditing = activeVariantId === variant.id;
                                        const isDragTarget = dragOverVariantId === variant.id;
                                        const hasChildren = children.length > 0;

                                        return (
                                            <React.Fragment key={variant.id}>
                                                <tr
                                                    className={`transition-colors group
                                                ${variant.status === 'INCLUDED' ? 'bg-green-50/50 dark:bg-green-900/10' : variant.status === 'EXCLUDED' ? 'bg-red-50/50 dark:bg-red-900/10' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}
                                                ${isDragTarget ? 'ring-2 ring-inset ring-amber-400 bg-amber-50 dark:bg-amber-900/20' : ''}
                                            `}
                                                    draggable={!isEditing}
                                                    onDragStart={(e) => handleDragStart(e, variant.id)}
                                                    onDragOver={(e) => handleDragOver(e, variant.id)}
                                                    onDrop={(e) => handleDrop(e, variant.id)}
                                                    onDragEnd={() => { setDraggedVariantId(null); setDragOverVariantId(null); }}
                                                >
                                                    <td className="p-0 text-center cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500">
                                                        <div className="flex justify-center h-full items-center"><GripVertical size={12} /></div>
                                                    </td>
                                                    <td className={cellClass}>
                                                        <div className="flex items-center" style={{ paddingLeft: `${depth * 24}px` }}>
                                                            {/* Hierarchy Visuals */}
                                                            {depth > 0 && (
                                                                <div className="mr-2 text-zinc-300 flex items-center h-full">
                                                                    <CornerDownRight size={16} strokeWidth={1.5} className="shrink-0" />
                                                                </div>
                                                            )}

                                                            {hasChildren ? (
                                                                <button onClick={() => toggleCollapse(variant.id)} className="mr-1 p-0.5 text-zinc-500 hover:text-zinc-800 transition-colors">
                                                                    {variant.isCollapsed ? <ChevronDown size={14} className="-rotate-90" /> : <ChevronDown size={14} />}
                                                                </button>
                                                            ) : <div className="w-5 shrink-0"></div>}

                                                            <div className="flex-1 min-w-0">
                                                                <div className="relative group/edit">
                                                                    <input
                                                                        type="text"
                                                                        className="w-full bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-amber-400 outline-none font-bold text-zinc-700 dark:text-zinc-200 transition-colors py-1 text-xs"
                                                                        value={variant.name}
                                                                        onChange={(e) => updateVariantName(variant.id, e.target.value)}
                                                                    />
                                                                    <Edit2 size={10} className="absolute right-0 top-1/2 -translate-y-1/2 text-zinc-300 opacity-0 group-hover/edit:opacity-100 pointer-events-none" />
                                                                </div>
                                                                {variant.parentId && <div className="text-[9px] text-zinc-400 font-mono mt-0.5 flex items-center gap-1"><GitBranch size={8} />Pod-wariant</div>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className={`${cellClass} text-center`}>
                                                        <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full text-[10px] font-bold border border-zinc-200 dark:border-zinc-700">
                                                            {variant.items.length}
                                                        </span>
                                                    </td>
                                                    <td className={`${cellClass} text-right font-mono font-bold text-zinc-700 dark:text-zinc-300`}>
                                                        {variantCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td className={`${cellClass} text-center`}>
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button onClick={() => handleSoloVariant(variant.id)} className="p-1.5 rounded text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors" title="SOLO (Tylko ten)"><Crosshair size={14} /></button>
                                                            <button onClick={() => setVariantStatus(variant.id, 'EXCLUDED')} className={`p-1.5 rounded transition-colors ${variant.status === 'EXCLUDED' ? 'bg-red-100 text-red-600' : 'text-zinc-400 hover:text-red-500 hover:bg-red-50'}`} title="WYKLUCZ"><EyeOff size={14} /></button>
                                                            <button onClick={() => setVariantStatus(variant.id, 'INCLUDED')} className={`p-1.5 rounded transition-colors ${variant.status === 'INCLUDED' ? 'bg-green-100 text-green-600' : 'text-zinc-400 hover:text-green-500 hover:bg-green-50'}`} title="UWZGLĘDNIJ"><Eye size={14} /></button>
                                                            <button onClick={() => setVariantStatus(variant.id, 'NEUTRAL')} className={`p-1.5 rounded transition-colors ${variant.status === 'NEUTRAL' ? 'text-zinc-300 cursor-default' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'}`} title="RESET"><MinusCircle size={14} /></button>
                                                        </div>
                                                    </td>
                                                    <td className={`${cellClass} text-center`}>
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button onClick={() => {
                                                                setActiveVariantId(isEditing ? null : variant.id);
                                                                setShowDropdown(true);
                                                            }} className={`text-[10px] px-2 py-1 rounded border transition-colors font-bold uppercase ${isEditing ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50'}`}>{isEditing ? 'Gotowe' : 'Edytuj'}</button>

                                                            {/* Create Child Button */}
                                                            <button
                                                                onClick={() => createChildVariant(variant.id)}
                                                                className="text-zinc-400 hover:text-purple-500 p-1 transition-colors"
                                                                title="Utwórz pod-wariant (kopiuj elementy)"
                                                            >
                                                                <GitBranch size={14} />
                                                            </button>

                                                            {variant.parentId && (
                                                                <button onClick={() => makeRoot(variant.id)} className="text-zinc-400 hover:text-blue-500 p-1 transition-colors" title="Przenieś do głównego poziomu (Outdent)">
                                                                    <Outdent size={14} />
                                                                </button>
                                                            )}

                                                            <button onClick={() => removeVariant(variant.id)} className="text-zinc-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 size={12} /></button>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {isEditing && (
                                                    <tr>
                                                        <td colSpan={6} className="bg-zinc-50/50 dark:bg-black/20 p-0 border-b border-zinc-100 dark:border-zinc-700 animate-fadeIn">
                                                            <div className="p-4 relative">
                                                                <div className="flex gap-2 items-center relative z-50 mb-4">
                                                                    <div className="relative flex-1">
                                                                        <Search className="absolute left-3 top-2.5 text-zinc-400" size={14} />
                                                                        <input
                                                                            ref={searchInputRef}
                                                                            type="text"
                                                                            className="w-full pl-9 p-2 border border-zinc-200 dark:border-zinc-700 rounded text-xs outline-none focus:border-amber-400 dark:bg-zinc-900 dark:text-white transition-all font-mono"
                                                                            placeholder="Szukaj elementów (Etap, Dostawca, Transport, Inne Koszty, Globalne)..."
                                                                            value={searchTerm}
                                                                            onChange={(e) => {
                                                                                setSearchTerm(e.target.value);
                                                                                setShowDropdown(true);
                                                                            }}
                                                                            onFocus={() => setShowDropdown(true)}
                                                                            autoFocus
                                                                        />
                                                                    </div>
                                                                    {onEnterPickingMode && (
                                                                        <button
                                                                            onClick={() => onEnterPickingMode(variant.id)}
                                                                            className="bg-amber-400 hover:bg-amber-500 text-black px-3 py-2 rounded transition-colors shadow-sm flex items-center gap-2 font-bold text-[10px] uppercase whitespace-nowrap"
                                                                            title="Wybierz elementy myszką z innych sekcji"
                                                                        >
                                                                            <MousePointer2 size={14} /> Tryb Wybierania
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                {/* Fixed Position Dropdown */}
                                                                {showDropdown && (searchTerm.length > 0 || searchResults.length > 0) && activeVariantId && dropdownPosition && (
                                                                    <div
                                                                        ref={dropdownRef}
                                                                        className="fixed bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-2xl rounded-xl max-h-80 overflow-y-auto z-[9999] flex flex-col"
                                                                        style={{
                                                                            top: dropdownPosition.top,
                                                                            left: dropdownPosition.left,
                                                                            width: dropdownPosition.width
                                                                        }}
                                                                    >
                                                                        <div className="sticky top-0 bg-zinc-50 dark:bg-zinc-800 p-2 flex justify-between items-center text-[9px] font-bold text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-700 tracking-wider">
                                                                            <span>Wyniki Wyszukiwania</span>
                                                                            <button onClick={() => setShowDropdown(false)} className="hover:text-red-500 p-1"><X size={12} /></button>
                                                                        </div>

                                                                        {searchResults.length === 0 && searchTerm ? (
                                                                            <div className="p-4 text-xs text-zinc-400 text-center">Brak wyników dla "{searchTerm}".</div>
                                                                        ) : (
                                                                            searchResults.map((res, i) => {
                                                                                const isExactMatch = variant.items.some(x => x.id === res.id && x.type === res.type);
                                                                                let isParentGroupSelected = false;
                                                                                if (res.type === 'SUPPLIER_ITEM' && !res.isGroup && res.groupId) {
                                                                                    isParentGroupSelected = variant.items.some(x => x.id === `group_supp_${res.groupId}` && x.type === 'SUPPLIER_ITEM');
                                                                                }
                                                                                let isChildSelected = false;
                                                                                if (res.isGroup && res.groupId) {
                                                                                    const supp = data.suppliers.find(s => s.id === res.groupId);
                                                                                    if (supp) {
                                                                                        isChildSelected = supp.items.some(i => variant.items.some(v => v.id === i.id));
                                                                                    }
                                                                                }
                                                                                const isDisabled = isExactMatch || isParentGroupSelected || isChildSelected;

                                                                                return (
                                                                                    <button
                                                                                        key={`${res.id}-${i}`}
                                                                                        onClick={() => !isDisabled && addItemToVariant(variant.id, res)}
                                                                                        disabled={isDisabled}
                                                                                        className={`w-full text-left p-2 text-xs border-b border-zinc-100 dark:border-zinc-800 last:border-0 flex justify-between items-center transition-colors ${isDisabled ? 'bg-zinc-50 dark:bg-zinc-900/50 opacity-50 cursor-not-allowed' : 'hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}
                                                                                    >
                                                                                        <div>
                                                                                            <div className={`font-bold flex items-center gap-2 ${isDisabled ? 'text-zinc-400' : 'text-zinc-700 dark:text-zinc-200'}`}>
                                                                                                {res.isRecommended && !isDisabled && <Link size={10} className="text-green-500" />}
                                                                                                {res.label}
                                                                                            </div>
                                                                                            {res.description && <div className="text-[9px] text-zinc-500 mt-0.5">{res.description}</div>}
                                                                                            {isParentGroupSelected && <div className="text-[9px] text-red-400 italic mt-0.5">Grupa nadrzędna już wybrana</div>}
                                                                                            {isChildSelected && <div className="text-[9px] text-red-400 italic mt-0.5">Elementy tej grupy są już wybrane</div>}
                                                                                        </div>
                                                                                        {isDisabled ? (isExactMatch ? <Check size={12} className="text-green-500" /> : <Lock size={10} className="text-zinc-400" />) : (res.isRecommended ? <ArrowRight size={12} className="text-green-500 opacity-50" /> : null)}
                                                                                    </button>
                                                                                );
                                                                            })
                                                                        )}
                                                                    </div>
                                                                )}

                                                                <div className="space-y-1 max-h-[200px] overflow-y-auto border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                                                                    {variant.items.length === 0 && <div className="p-6 text-center text-xs text-zinc-400 italic">Pusty wariant. Dodaj elementy korzystając z wyszukiwarki lub przycisku "Tryb Wybierania".</div>}
                                                                    {variant.items.map((item, idx) => {
                                                                        const { val, curr } = getItemValue(item.id, item.type);
                                                                        return (
                                                                            <div
                                                                                key={`${item.id}-${idx}`}
                                                                                className="flex justify-between items-center p-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                                                                                onMouseEnter={(e) => handleMouseEnterItem(e, item.id, item.type)}
                                                                                onMouseLeave={() => setHoveredItemId(null)}
                                                                            >
                                                                                <span className="truncate font-mono text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
                                                                                    {item.type === 'STAGE' && <div className="p-0.5 bg-purple-100 text-purple-600 rounded"><Layers size={8} /></div>}
                                                                                    {item.type === 'OTHER' && <div className="p-0.5 bg-zinc-100 text-zinc-600 rounded"><Receipt size={8} /></div>}
                                                                                    {item.type === 'CUSTOM_INSTALLATION_ITEM' && <div className="p-0.5 bg-blue-100 text-blue-600 rounded"><Package size={8} /></div>}
                                                                                    {item.originalDescription}
                                                                                    {val > 0 && <span className="ml-2 text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1 py-0.5 rounded">{val.toFixed(2)} {curr}</span>}
                                                                                </span>
                                                                                <button onClick={() => removeItemFromVariant(variant.id, item.id, item.type)} className="text-zinc-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"><X size={12} /></button>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
