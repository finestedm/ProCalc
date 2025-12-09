
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { OtherCostItem, Currency, VariantItemType, SheetRow } from '../types';
import { Receipt, Plus, Trash2, ChevronDown, Calculator, Grid3X3, Eraser, Check, X, ArrowRight, ArrowDown as ArrowDownIcon, RefreshCw, Copy, Clipboard, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { convert, formatCurrency } from '../services/calculationService';
import { SmartInput } from './SmartInput';
import { EmptyState } from './EmptyState';

interface Props {
  costs: OtherCostItem[];
  scratchpad: any[]; 
  onChange: (costs: OtherCostItem[]) => void;
  onScratchpadChange: (rows: any[]) => void;
  exchangeRate: number;
  offerCurrency: Currency;
  isPickingMode?: boolean;
  onPick?: (item: { id: string, type: VariantItemType, label: string }, origin?: {x: number, y: number}) => void;
  totalPalletSpots?: number; // New prop for IBL calculation
}

// --- HELPER FUNCTIONS ---

const getColumnLabel = (index: number): string => {
    let label = "";
    let i = index;
    while (i >= 0) {
        label = String.fromCharCode((i % 26) + 65) + label;
        i = Math.floor(i / 26) - 1;
    }
    return label;
};

const getColIndex = (label: string): number => {
    let result = 0;
    for (let i = 0; i < label.length; i++) {
        result *= 26;
        result += label.charCodeAt(i) - 64;
    }
    return result - 1;
};

interface CellCoords { row: number; col: number }

const getCoordsFromRef = (ref: string): CellCoords | null => {
    const match = ref.toUpperCase().match(/^([A-Z]+)([0-9]+)$/);
    if (!match) return null;
    return {
        col: getColIndex(match[1]),
        row: parseInt(match[2]) - 1
    };
};

const getRefFromCoords = (coords: CellCoords): string => {
    return `${getColumnLabel(coords.col)}${coords.row + 1}`;
};

const getRangeRef = (start: CellCoords, end: CellCoords): string => {
    if (start.row === end.row && start.col === end.col) return getRefFromCoords(start);
    return `${getRefFromCoords(start)}:${getRefFromCoords(end)}`;
};

// --- FORMULA ENGINE ---

const evaluateFormula = (formula: string, rows: SheetRow[], cols: string[]): string | number => {
    if (!formula.startsWith('=')) return isNaN(Number(formula)) ? formula : Number(formula);

    let expression = formula.substring(1).toUpperCase();

    // Helper to get value safely
    const getValue = (c: number, r: number): number => {
        if (r < 0 || r >= rows.length || c < 0 || c >= cols.length) return 0;
        const colId = cols[c];
        const cell = rows[r].cells[colId];
        if (!cell) return 0;
        const val = cell.result !== undefined ? cell.result : cell.value;
        return isNaN(Number(val)) ? 0 : Number(val);
    };

    // 1. Handle Ranges (SUM(A1:B2))
    expression = expression.replace(/SUM\(([A-Z0-9:]+)\)/g, (match, range) => {
        const parts = range.split(':');
        if (parts.length !== 2) return match;
        const start = getCoordsFromRef(parts[0]);
        const end = getCoordsFromRef(parts[1]);
        if (!start || !end) return "0";

        let sum = 0;
        const rStart = Math.min(start.row, end.row);
        const rEnd = Math.max(start.row, end.row);
        const cStart = Math.min(start.col, end.col);
        const cEnd = Math.max(start.col, end.col);

        for (let r = rStart; r <= rEnd; r++) {
            for (let c = cStart; c <= cEnd; c++) {
                sum += getValue(c, r);
            }
        }
        return sum.toString();
    });

    // 2. Handle Individual Cell References (A1)
    expression = expression.replace(/([A-Z]+)([0-9]+)/g, (match, colStr, rowStr) => {
        const colIdx = getColIndex(colStr);
        const rowIdx = parseInt(rowStr) - 1;
        if (colIdx >= 0 && colIdx < cols.length) {
            return getValue(colIdx, rowIdx).toString();
        }
        return match;
    });

    try {
        const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
        if (!sanitized) return 0;
        // eslint-disable-next-line no-new-func
        const result = new Function(`return (${sanitized})`)();
        return isFinite(result) ? result : "Err";
    } catch (e) {
        return "Err";
    }
};

const adjustFormula = (formula: string, rowOffset: number, colOffset: number): string => {
    if (!formula.startsWith('=')) return formula;
    
    return formula.replace(/([A-Z]+)([0-9]+)/g, (match, colStr, rowStr) => {
        const oldCol = getColIndex(colStr);
        const oldRow = parseInt(rowStr) - 1;
        
        const newCol = oldCol + colOffset;
        const newRow = oldRow + rowOffset;

        if (newCol < 0 || newRow < 0) return "#REF!";
        
        return getRefFromCoords({ col: newCol, row: newRow });
    });
};

export const OtherCostsSection: React.FC<Props> = ({ 
    costs, onChange, exchangeRate, offerCurrency,
    isPickingMode, onPick,
    totalPalletSpots = 0
}) => {
  const [isOpen, setIsOpen] = useState(false); 
  const [activeCostIdForEditing, setActiveCostIdForEditing] = useState<string | null>(null);
  const [isSheetVisible, setIsSheetVisible] = useState(false);

  // IBL State
  const [iblCount, setIblCount] = useState(1);
  const [iblRate, setIblRate] = useState(660); // Default flat rate per inspection

  // Update IBL Rate based on pallet spots threshold
  useEffect(() => {
      if (totalPalletSpots >= 1000) {
          setIblRate(750);
      } else {
          setIblRate(660);
      }
  }, [totalPalletSpots]);

  // --- SHEET STATE ---
  const [columns, setColumns] = useState<string[]>(['A', 'B', 'C', 'D']);
  const [sheetRows, setSheetRows] = useState<SheetRow[]>([
      { id: '1', cells: {} },
      { id: '2', cells: {} },
      { id: '3', cells: {} },
      { id: '4', cells: {} },
      { id: '5', cells: {} }
  ]);

  // Selection State
  const [selectionStart, setSelectionStart] = useState<CellCoords | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<CellCoords | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editingCell, setEditingCell] = useState<CellCoords | null>(null);
  
  // Ref Selection Mode (picking cells while editing formula)
  const [refSelectionBase, setRefSelectionBase] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null); 

  // Internal Clipboard
  const clipboardRef = useRef<{
      data: { val: string, rOff: number, cOff: number }[],
      sourceRows: number,
      sourceCols: number,
      originR: number,
      originC: number
  } | null>(null);

  // Focus management
  useEffect(() => {
      // Only force focus to input if we are NOT in picking mode
      // If we are in picking mode (refSelectionBase set), focus might be on grid to receive keys
      if (editingCell && inputRef.current && refSelectionBase === null) {
          inputRef.current.focus();
      } else if (!editingCell && isSheetVisible && gridContainerRef.current) {
          // Return focus to grid when not editing so keys work
          gridContainerRef.current.focus();
      }
  }, [editingCell, isSheetVisible]);

  useEffect(() => {
      if (sheetRows.length === 0) addRow();
  }, []);

  const handlePick = (e: React.MouseEvent, c: OtherCostItem) => {
      if (isPickingMode && onPick) {
          onPick({
              id: c.id,
              type: 'OTHER',
              label: `[Inne] ${c.description}`
          }, { x: e.clientX, y: e.clientY });
      }
  };

  const addCost = () => {
    onChange([...costs, {
      id: Math.random().toString(36).substr(2, 9),
      description: '',
      price: 0,
      currency: Currency.PLN
    }]);
  };

  const removeCost = (index: number) => {
    onChange(costs.filter((_, i) => i !== index));
  };

  const updateCost = (index: number, field: keyof OtherCostItem, value: any) => {
    const updated = [...costs];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleAddIblCost = () => {
      if (totalPalletSpots <= 0) return;
      // Logic: Rate per inspection * Number of inspections
      const calculatedValue = iblRate * iblCount;
      onChange([...costs, {
          id: Math.random().toString(36).substr(2, 9),
          description: `Przegląd IBL (${totalPalletSpots} m.p. - ${iblCount}x)`,
          price: calculatedValue,
          currency: Currency.PLN
      }]);
  };

  // --- SHEET ACTIONS ---

  const addColumn = () => setColumns(prev => [...prev, getColumnLabel(prev.length)]);
  const addRow = () => setSheetRows(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), cells: {} }]);

  const updateCell = (rowIdx: number, colId: string, rawValue: string) => {
      const newRows = [...sheetRows];
      const currentRow = { ...newRows[rowIdx] };
      currentRow.cells = { 
          ...currentRow.cells, 
          [colId]: { value: rawValue, result: rawValue } 
      };
      newRows[rowIdx] = currentRow;
      recalcAll(newRows);
  };

  const recalcAll = (rows: SheetRow[]) => {
      const calcRows = rows.map(r => ({ ...r })); 
      for(let pass=0; pass<3; pass++) {
          calcRows.forEach((r, rIdx) => {
              columns.forEach((c, cIdx) => {
                  const cell = r.cells[c];
                  if (cell && typeof cell.value === 'string' && cell.value.startsWith('=')) {
                      cell.result = evaluateFormula(cell.value, calcRows, columns);
                  } else if (cell) {
                      cell.result = cell.value;
                  }
              });
          });
      }
      setSheetRows(calcRows);
  };

  // --- SELECTION & MOUSE HANDLING ---

  const handleMouseDown = (r: number, c: number, e: React.MouseEvent) => {
      // 1. If currently editing, handle "click-to-add-reference"
      if (editingCell) {
          const currentVal = sheetRows[editingCell.row].cells[columns[editingCell.col]]?.value || '';
          
          if (currentVal.startsWith('=')) {
              e.preventDefault();
              
              setRefSelectionBase(currentVal); 
              
              const targetRef = getRefFromCoords({ row: r, col: c });
              updateCell(editingCell.row, columns[editingCell.col], currentVal + targetRef);
              
              // Set selection to the target so we see what we picked
              setSelectionStart({ row: r, col: c });
              setSelectionEnd({ row: r, col: c });
              
              setIsDragging(true); // Allow dragging to expand range
              
              // Keep focus on input (or return to it) handled by useEffect
              return;
          }
          
          // If not a formula, commit and switch selection
          setEditingCell(null);
          setRefSelectionBase(null);
      }

      setSelectionStart({ row: r, col: c });
      setSelectionEnd({ row: r, col: c });
      setIsDragging(true);
      setRefSelectionBase(null);
      
      setTimeout(() => gridContainerRef.current?.focus(), 0);
  };

  const handleMouseEnter = (r: number, c: number) => {
      if (isDragging) {
          if (editingCell && refSelectionBase !== null) {
              // We are dragging a range for the formula
              // Current selectionStart is the anchor
              if (selectionStart) {
                  setSelectionEnd({ row: r, col: c });
                  const rangeStr = getRangeRef(selectionStart, { row: r, col: c });
                  updateCell(editingCell.row, columns[editingCell.col], refSelectionBase + rangeStr);
              }
          } else if (selectionStart) {
              // Normal selection drag
              setSelectionEnd({ row: r, col: c });
          }
      }
  };

  const handleMouseUp = () => {
      setIsDragging(false);
      // If we were picking a ref, we keep editingCell active
      if (editingCell && refSelectionBase === null) {
          setTimeout(() => inputRef.current?.focus(), 0);
      }
  };

  const handleDoubleClick = (r: number, c: number) => {
      setEditingCell({ row: r, col: c });
      setRefSelectionBase(null);
  };

  // --- KEYBOARD NAVIGATION & EDITING ---

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      const val = e.currentTarget.value;
      const isFormula = val.startsWith('=');

      // 1. Formula Navigation (Start Picking)
      if (isFormula && e.key.startsWith('Arrow')) {
          e.preventDefault();
          // Start reference selection mode
          setRefSelectionBase(val);
          
          // Determine start position for navigation (current selection or edit cell)
          const start = selectionEnd || editingCell;
          if (start) {
              let { row, col } = start;
              if (e.key === 'ArrowUp') row = Math.max(0, row - 1);
              if (e.key === 'ArrowDown') row = Math.min(sheetRows.length - 1, row + 1);
              if (e.key === 'ArrowLeft') col = Math.max(0, col - 1);
              if (e.key === 'ArrowRight') col = Math.min(columns.length - 1, col + 1);
              
              setSelectionStart({ row, col });
              setSelectionEnd({ row, col });
              
              const ref = getRefFromCoords({ row, col });
              if (editingCell) updateCell(editingCell.row, columns[editingCell.col], val + ref);
              
              // Move focus to grid to handle subsequent navigation
              // Use timeout to let state update
              setTimeout(() => gridContainerRef.current?.focus(), 0);
          }
          return;
      }

      // 2. Normal Navigation (Commit & Move)
      if (!isFormula && e.key.startsWith('Arrow')) {
          e.preventDefault();
          
          if (editingCell) {
              let { row, col } = editingCell;
              if (e.key === 'ArrowUp') row = Math.max(0, row - 1);
              if (e.key === 'ArrowDown') row = Math.min(sheetRows.length - 1, row + 1);
              if (e.key === 'ArrowLeft') col = Math.max(0, col - 1);
              if (e.key === 'ArrowRight') col = Math.min(columns.length - 1, col + 1);
              
              setEditingCell(null);
              setRefSelectionBase(null);
              
              setSelectionStart({ row, col });
              setSelectionEnd({ row, col });
              
              gridContainerRef.current?.focus();
          }
          return;
      }

      // Enter Key - Commit and move down
      if (e.key === 'Enter') {
          e.preventDefault();
          if (editingCell) {
              let { row, col } = editingCell;
              row = Math.min(sheetRows.length - 1, row + 1);
              
              setEditingCell(null);
              setRefSelectionBase(null);
              setSelectionStart({ row, col });
              setSelectionEnd({ row, col });
              
              gridContainerRef.current?.focus();
          }
      }
  };

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
      // If in Ref Selection Mode (editingCell active + focus on grid)
      if (editingCell && refSelectionBase !== null) {
          if (e.key === 'Enter') {
              e.preventDefault();
              setEditingCell(null);
              setRefSelectionBase(null);
              gridContainerRef.current?.focus();
              return;
          }
          
          // Operators -> Commit ref, append operator, return focus to input
          // Or any other printable key
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !e.key.startsWith('Arrow')) {
              e.preventDefault();
              const currentVal = sheetRows[editingCell.row].cells[columns[editingCell.col]]?.value || '';
              updateCell(editingCell.row, columns[editingCell.col], currentVal + e.key);
              setRefSelectionBase(null);
              inputRef.current?.focus();
              return;
          }

          if (e.key.startsWith('Arrow')) {
              e.preventDefault();
              if (!selectionEnd) return;
              let { row, col } = selectionEnd;
              
              if (e.key === 'ArrowUp') row = Math.max(0, row - 1);
              if (e.key === 'ArrowDown') row = Math.min(sheetRows.length - 1, row + 1);
              if (e.key === 'ArrowLeft') col = Math.max(0, col - 1);
              if (e.key === 'ArrowRight') col = Math.min(columns.length - 1, col + 1);

              // If Shift is held, expand range from selectionStart
              // If not, reset start to new pos
              if (e.shiftKey) {
                  setSelectionEnd({ row, col });
                  if (selectionStart) {
                      const rangeStr = getRangeRef(selectionStart, { row, col });
                      updateCell(editingCell.row, columns[editingCell.col], refSelectionBase + rangeStr);
                  }
              } else {
                  setSelectionStart({ row, col });
                  setSelectionEnd({ row, col });
                  const ref = getRefFromCoords({ row, col });
                  updateCell(editingCell.row, columns[editingCell.col], refSelectionBase + ref);
              }
              return;
          }
      }

      // Normal Navigation (Not editing)
      if (!editingCell) {
          // 1. Navigation
          if (e.key.startsWith('Arrow')) {
              e.preventDefault();
              if (!selectionStart) {
                  setSelectionStart({row: 0, col: 0});
                  setSelectionEnd({row: 0, col: 0});
                  return;
              }
              let { row, col } = selectionStart; // Move pivot
              
              // Handle range extension if Shift is held
              if (e.shiftKey && selectionEnd) {
                  let endRow = selectionEnd.row;
                  let endCol = selectionEnd.col;
                  
                  if (e.key === 'ArrowUp') endRow = Math.max(0, endRow - 1);
                  if (e.key === 'ArrowDown') endRow = Math.min(sheetRows.length - 1, endRow + 1);
                  if (e.key === 'ArrowLeft') endCol = Math.max(0, endCol - 1);
                  if (e.key === 'ArrowRight') endCol = Math.min(columns.length - 1, endCol + 1);
                  
                  setSelectionEnd({ row: endRow, col: endCol });
                  return;
              }

              if (e.key === 'ArrowUp') row = Math.max(0, row - 1);
              if (e.key === 'ArrowDown') row = Math.min(sheetRows.length - 1, row + 1);
              if (e.key === 'ArrowLeft') col = Math.max(0, col - 1);
              if (e.key === 'ArrowRight') col = Math.min(columns.length - 1, col + 1);
              
              setSelectionStart({ row, col });
              setSelectionEnd({ row, col });
              return;
          }

          // 2. Enter Edit Mode (Enter)
          if (e.key === 'Enter' && selectionStart) {
              e.preventDefault();
              setEditingCell(selectionStart);
              setRefSelectionBase(null);
              return;
          }

          // 3. Delete/Backspace (Clear)
          if ((e.key === 'Delete' || e.key === 'Backspace') && selectionStart && selectionEnd) {
              e.preventDefault();
              const newRows = [...sheetRows];
              const rMin = Math.min(selectionStart.row, selectionEnd.row);
              const rMax = Math.max(selectionStart.row, selectionEnd.row);
              const cMin = Math.min(selectionStart.col, selectionEnd.col);
              const cMax = Math.max(selectionStart.col, selectionEnd.col);

              for(let r=rMin; r<=rMax; r++) {
                  for(let c=cMin; c<=cMax; c++) {
                      const colId = columns[c];
                      if(newRows[r].cells[colId]) {
                          newRows[r].cells[colId] = { value: '', result: '' };
                      }
                  }
              }
              recalcAll(newRows);
              return;
          }

          // 4. COPY (Ctrl+C)
          if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectionStart && selectionEnd) {
              const rMin = Math.min(selectionStart.row, selectionEnd.row);
              const rMax = Math.max(selectionStart.row, selectionEnd.row);
              const cMin = Math.min(selectionStart.col, selectionEnd.col);
              const cMax = Math.max(selectionStart.col, selectionEnd.col);

              const data = [];
              for (let r = rMin; r <= rMax; r++) {
                  for (let c = cMin; c <= cMax; c++) {
                      const val = sheetRows[r].cells[columns[c]]?.value || '';
                      data.push({ val, rOff: r - rMin, cOff: c - cMin });
                  }
              }
              clipboardRef.current = {
                  data,
                  sourceRows: rMax - rMin + 1,
                  sourceCols: cMax - cMin + 1,
                  originR: rMin,
                  originC: cMin
              };
              return;
          }

          // 5. PASTE (Ctrl+V)
          if ((e.ctrlKey || e.metaKey) && e.key === 'v' && selectionStart && clipboardRef.current) {
              e.preventDefault();
              const { data, sourceRows, sourceCols, originR, originC } = clipboardRef.current;
              const targetR = selectionStart.row;
              const targetC = selectionStart.col;
              const rowDelta = targetR - originR;
              const colDelta = targetC - originC;

              const newRows = [...sheetRows];
              let changed = false;

              data.forEach(item => {
                  const destR = targetR + item.rOff;
                  const destC = targetC + item.cOff;
                  if (destR < newRows.length && destC < columns.length) {
                      const newVal = adjustFormula(item.val, rowDelta, colDelta);
                      const colId = columns[destC];
                      if (!newRows[destR].cells) newRows[destR].cells = {};
                      newRows[destR].cells[colId] = { value: newVal, result: newVal };
                      changed = true;
                  }
              });

              if (changed) {
                  recalcAll(newRows);
                  setSelectionEnd({ row: targetR + sourceRows - 1, col: targetC + sourceCols - 1 });
              }
              return;
          }

          // 6. INSTANT TYPING (Type-over)
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && selectionStart) {
              e.preventDefault();
              setEditingCell(selectionStart);
              setRefSelectionBase(null);
              updateCell(selectionStart.row, columns[selectionStart.col], e.key);
          }
      }
  };


  const handleCreateCostFromSelection = () => {
      if (!selectionStart) return;
      const row = sheetRows[selectionStart.row];
      const colId = columns[selectionStart.col];
      const cell = row?.cells[colId];
      if (!cell) return;

      const val = parseFloat(String(cell.result));
      if (isNaN(val)) {
          alert("Wybrana komórka nie zawiera liczby.");
          return;
      }

      if (activeCostIdForEditing) {
          const index = costs.findIndex(c => c.id === activeCostIdForEditing);
          if (index >= 0) {
              const updated = [...costs];
              updated[index] = {
                  ...updated[index],
                  price: val,
                  attachedSheet: { 
                      columns, 
                      rows: sheetRows, 
                      selectedCell: { rowId: row.id, colId } 
                  }
              };
              onChange(updated);
          }
          setActiveCostIdForEditing(null);
      } else {
          const newCost: OtherCostItem = {
              id: Math.random().toString(36).substr(2, 9),
              description: `Wynik z arkusza (${colId}${selectionStart.row + 1})`,
              price: val,
              currency: Currency.PLN,
              attachedSheet: { 
                  columns, 
                  rows: sheetRows, 
                  selectedCell: { rowId: row.id, colId } 
                }
          };
          onChange([...costs, newCost]);
      }
      setIsSheetVisible(false);
      resetSheet();
  };

  const editCostSheet = (cost: OtherCostItem) => {
      if (!cost.attachedSheet) return;
      setColumns(cost.attachedSheet.columns);
      setSheetRows(cost.attachedSheet.rows);
      setActiveCostIdForEditing(cost.id);
      setIsSheetVisible(true);
      if (!isOpen) setIsOpen(true);
      
      // Restore selection
      const legacySel = cost.attachedSheet.selectedCell;
      if (legacySel) {
          const r = cost.attachedSheet.rows.findIndex(r => r.id === legacySel.rowId);
          const c = cost.attachedSheet.columns.indexOf(legacySel.colId);
          if (r >= 0 && c >= 0) {
              setSelectionStart({ row: r, col: c });
              setSelectionEnd({ row: r, col: c });
          }
      }
      
      // Auto-focus the grid after opening
      setTimeout(() => gridContainerRef.current?.focus(), 100);
  };

  const resetSheet = () => {
      if (!activeCostIdForEditing) {
          setColumns(['A', 'B', 'C', 'D']);
          setSheetRows([{ id: '1', cells: {} }, { id: '2', cells: {} }, { id: '3', cells: {} }, { id: '4', cells: {} }, { id: '5', cells: {} }]);
          setSelectionStart(null);
          setSelectionEnd(null);
          setEditingCell(null);
          setRefSelectionBase(null);
      }
  };

  const cancelEdit = () => {
      setActiveCostIdForEditing(null);
      setIsSheetVisible(false);
      resetSheet();
  };

  const otherTotal = costs.reduce((total, c) => {
      return total + convert(c.price, c.currency, offerCurrency, exchangeRate);
  }, 0);

  const pickingClass = isPickingMode 
      ? "hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:ring-1 hover:ring-inset hover:ring-amber-400 cursor-crosshair hover:animate-pulse-border"
      : "hover:bg-violet-50/20 dark:hover:bg-violet-900/10";

  // --- SELECTION VISUALS ---
  const getSelectionStyles = (r: number, c: number) => {
      if (!selectionStart || !selectionEnd) return '';
      
      const rMin = Math.min(selectionStart.row, selectionEnd.row);
      const rMax = Math.max(selectionStart.row, selectionEnd.row);
      const cMin = Math.min(selectionStart.col, selectionEnd.col);
      const cMax = Math.max(selectionStart.col, selectionEnd.col);

      if (r < rMin || r > rMax || c < cMin || c > cMax) return '';

      let classes = 'bg-blue-100/30 dark:bg-blue-900/30 ';
      if (r === rMin) classes += 'border-t-2 border-t-blue-500 ';
      if (r === rMax) classes += 'border-b-2 border-b-blue-500 ';
      if (c === cMin) classes += 'border-l-2 border-l-blue-500 ';
      if (c === cMax) classes += 'border-r-2 border-r-blue-500 ';
      return classes;
  };

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-sm border border-zinc-200 dark:border-zinc-800 mb-6 overflow-hidden transition-colors relative z-0">
      <div 
          className="p-4 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
            <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-sm text-amber-600 dark:text-amber-500">
                <Receipt size={20} />
            </div>
            <div>
                <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 font-mono uppercase tracking-tight">Inne Koszty</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Delegacje, hotele, ubezpieczenia</p>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
             <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block leading-none mb-1">Suma</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 text-lg">
                    {formatCurrency(otherTotal, offerCurrency)}
                </span>
             </div>
             <button className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-transform duration-300" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <ChevronDown size={20}/>
            </button>
        </div>
      </div>

      <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
            <div className="border-t border-transparent p-4 pt-0">
                
                {/* ACTIONS HEADER */}
                <div className="flex justify-end gap-2 mb-2 pt-2">
                    {!isSheetVisible && (
                        <>
                            <button onClick={() => { setIsSheetVisible(true); resetSheet(); setTimeout(() => gridContainerRef.current?.focus(), 100); }} className="text-[10px] font-bold text-green-700 dark:text-green-300 hover:text-black bg-green-50 dark:bg-green-900/20 hover:bg-green-100 border border-green-200 dark:border-green-800 px-3 py-1.5 rounded-sm flex items-center gap-1 transition-colors">
                                <Grid3X3 size={12} /> Arkusz Kalkulacyjny
                            </button>
                            <button onClick={addCost} className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 hover:text-black bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 px-3 py-1.5 rounded-sm flex items-center gap-1 transition-colors">
                                <Plus size={12} /> Prosty Koszt
                            </button>
                        </>
                    )}
                </div>

                {/* SPREADSHEET EDITOR */}
                {isSheetVisible && (
                    <div className="mb-6 border-2 border-green-500/30 rounded-md overflow-hidden bg-white dark:bg-zinc-900 shadow-lg relative animate-slideUp">
                        {activeCostIdForEditing && (
                            <div className="absolute top-0 left-0 right-0 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs font-bold px-3 py-1 flex justify-between items-center z-20">
                                <span>Tryb Edycji Kosztu</span>
                                <button onClick={cancelEdit} className="hover:text-red-500"><X size={14}/></button>
                            </div>
                        )}
                        
                        <div className="p-2 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-300 dark:border-zinc-700 flex justify-between items-center pt-8">
                            <div className="flex gap-2">
                                <button onClick={addColumn} className="text-[10px] bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 px-2 py-1 rounded hover:bg-zinc-50 flex items-center gap-1">
                                    <ArrowRight size={10}/> Kolumna
                                </button>
                                <button onClick={addRow} className="text-[10px] bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 px-2 py-1 rounded hover:bg-zinc-50 flex items-center gap-1">
                                    <ArrowDownIcon size={10}/> Wiersz
                                </button>
                                <button onClick={resetSheet} className="text-[10px] text-red-500 hover:text-red-700 px-2 py-1 flex items-center gap-1">
                                    <Eraser size={10}/> Reset
                                </button>
                            </div>
                            <div>
                                {selectionStart ? (
                                    <button 
                                        onClick={handleCreateCostFromSelection}
                                        className="text-xs bg-green-600 text-white px-4 py-1.5 rounded font-bold shadow hover:bg-green-700 flex items-center gap-2"
                                    >
                                        <Check size={14}/> {activeCostIdForEditing ? 'Aktualizuj' : 'Wybierz komórkę'}
                                    </button>
                                ) : (
                                    <span className="text-[10px] text-zinc-400">Zaznacz wynik...</span>
                                )}
                            </div>
                        </div>

                        {/* GRID AREA */}
                        <div 
                            ref={gridContainerRef}
                            className="overflow-x-auto bg-zinc-200 dark:bg-zinc-950 p-[1px] max-h-[400px] select-none outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400/50"
                            onMouseUp={handleMouseUp}
                            tabIndex={0}
                            onKeyDown={handleGridKeyDown}
                        >
                            <table className="w-full border-collapse table-fixed min-w-[600px]">
                                <thead>
                                    <tr>
                                        <th className="w-8 bg-zinc-100 dark:bg-zinc-800 border-r border-b border-zinc-300 dark:border-zinc-700"></th>
                                        {columns.map((col, i) => {
                                            const isColSelected = selectionStart && selectionEnd && 
                                                i >= Math.min(selectionStart.col, selectionEnd.col) &&
                                                i <= Math.max(selectionStart.col, selectionEnd.col);
                                            return (
                                                <th key={col} className={`w-24 border-r border-b border-zinc-300 dark:border-zinc-700 text-center text-xs font-bold py-1 ${isColSelected ? 'bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                                                    {col}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sheetRows.map((row, rowIdx) => (
                                        <tr key={row.id}>
                                            {/* Row Header */}
                                            <td className={`border-r border-b border-zinc-300 dark:border-zinc-700 text-center text-xs font-bold ${
                                                selectionStart && selectionEnd && rowIdx >= Math.min(selectionStart.row, selectionEnd.row) && rowIdx <= Math.max(selectionStart.row, selectionEnd.row)
                                                ? 'bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-white'
                                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                                            }`}>
                                                {rowIdx + 1}
                                            </td>
                                            
                                            {columns.map((col, colIdx) => {
                                                const cell = row.cells[col];
                                                const isEditing = editingCell?.row === rowIdx && editingCell?.col === colIdx;
                                                const selectionStyle = getSelectionStyles(rowIdx, colIdx);
                                                
                                                return (
                                                    <td 
                                                        key={`${row.id}-${col}`} 
                                                        className={`border-r border-b border-zinc-300 dark:border-zinc-700 p-0 relative h-8 bg-white dark:bg-zinc-900 ${selectionStyle}`}
                                                        onMouseDown={(e) => handleMouseDown(rowIdx, colIdx, e)}
                                                        onMouseEnter={() => handleMouseEnter(rowIdx, colIdx)}
                                                        onDoubleClick={() => handleDoubleClick(rowIdx, colIdx)}
                                                    >
                                                        {isEditing ? (
                                                            <input 
                                                                ref={inputRef}
                                                                type="text"
                                                                className="absolute inset-0 w-full h-full px-2 text-xs outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono z-50 shadow-md ring-2 ring-green-500"
                                                                value={cell?.value || ''}
                                                                onChange={(e) => updateCell(rowIdx, col, e.target.value)}
                                                                onKeyDown={handleInputKeyDown}
                                                                onBlur={() => {
                                                                    if (refSelectionBase === null) setEditingCell(null);
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full px-2 flex items-center justify-end text-xs text-zinc-800 dark:text-zinc-200 overflow-hidden cursor-cell">
                                                                {cell?.result}
                                                            </div>
                                                        )}
                                                        
                                                        {/* Corner Handle (Visual) */}
                                                        {selectionEnd && selectionEnd.row === rowIdx && selectionEnd.col === colIdx && !isEditing && (
                                                            <div className="absolute right-[-4px] bottom-[-4px] w-2 h-2 bg-blue-500 border border-white z-20 cursor-crosshair"></div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-[9px] text-zinc-400 flex justify-between">
                            <div className="flex gap-4">
                                <span className="flex items-center gap-1"><Clipboard size={10}/> Ctrl+C / Ctrl+V</span>
                                <span>Pisanie nadpisuje. Funkcje: =SUM(A1:B2), =A1*B2 (Strzałki wybierają cel)</span>
                            </div>
                            <button onClick={() => setIsSheetVisible(false)} className="hover:text-red-500">Zamknij</button>
                        </div>
                    </div>
                )}

                {/* COSTS LIST */}
                <div className="overflow-x-auto min-h-[150px] border border-zinc-100 dark:border-zinc-800 mb-6 flex flex-col">
                    {costs.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center bg-zinc-50/30 dark:bg-zinc-900/30 py-8">
                            <EmptyState 
                                icon={Receipt}
                                title="Brak Innych Kosztów"
                                description="Brak dodatkowych kosztów (hotele, delegacje itp.)."
                                action={{
                                    label: "Dodaj koszt",
                                    onClick: addCost,
                                    icon: Plus
                                }}
                            />
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr>
                                    <th className="p-2 bg-zinc-100/50 dark:bg-zinc-800 text-zinc-500 font-bold uppercase text-[10px] w-10 text-center">#</th>
                                    <th className="p-2 bg-zinc-100/50 dark:bg-zinc-800 text-zinc-500 font-bold uppercase text-[10px] text-left">Opis kosztu</th>
                                    <th className="p-2 bg-zinc-100/50 dark:bg-zinc-800 text-zinc-500 font-bold uppercase text-[10px] text-right w-32">Wartość</th>
                                    <th className="p-2 bg-zinc-100/50 dark:bg-zinc-800 text-zinc-500 font-bold uppercase text-[10px] w-24 text-center">Waluta</th>
                                    <th className="p-2 bg-zinc-100/50 dark:bg-zinc-800 text-zinc-500 font-bold uppercase text-[10px] w-16"></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-zinc-950">
                                {costs.map((cost, idx) => (
                                    <tr 
                                        key={cost.id} 
                                        className={`${pickingClass} transition-colors`}
                                        onClick={(e) => handlePick(e, cost)}
                                    >
                                        <td className="p-2 border-b border-zinc-50 dark:border-zinc-800/50 text-xs text-center text-zinc-400">{idx + 1}</td>
                                        <td className="p-2 border-b border-zinc-50 dark:border-zinc-800/50 text-xs">
                                            <input 
                                                type="text" 
                                                placeholder="np. Hotel, Paliwo" 
                                                className="w-full bg-transparent border-none outline-none font-medium" 
                                                value={cost.description} 
                                                onChange={(e) => updateCost(idx, 'description', e.target.value)} 
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </td>
                                        <td className="p-2 border-b border-zinc-50 dark:border-zinc-800/50 text-xs relative group">
                                            {cost.attachedSheet ? (
                                                <div className="flex items-center justify-end gap-2 h-full">
                                                    <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 cursor-default" title="Wartość z arkusza">{cost.price.toFixed(2)}</span>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); editCostSheet(cost); }}
                                                        className="p-1 text-green-600 bg-green-50 dark:bg-green-900/20 rounded hover:bg-green-100 transition-colors"
                                                        title="Edytuj Obliczenia (Arkusz)"
                                                    >
                                                        <Calculator size={14}/>
                                                    </button>
                                                </div>
                                            ) : (
                                                <SmartInput 
                                                    className="w-full text-right bg-transparent border-none outline-none font-mono font-bold focus:bg-zinc-100 dark:focus:bg-zinc-800 rounded p-1" 
                                                    value={cost.price} 
                                                    onChange={(val) => updateCost(idx, 'price', val)} 
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            )}
                                        </td>
                                        <td className="p-2 border-b border-zinc-50 dark:border-zinc-800/50 text-xs">
                                            <select 
                                                className="w-full bg-transparent border-none outline-none text-center cursor-pointer" 
                                                value={cost.currency} 
                                                onChange={(e) => updateCost(idx, 'currency', e.target.value)} 
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <option value={Currency.PLN}>PLN</option>
                                                <option value={Currency.EUR}>EUR</option>
                                            </select>
                                        </td>
                                        <td className="p-2 border-b border-zinc-50 dark:border-zinc-800/50 text-xs text-center">
                                            <button onClick={(e) => { e.stopPropagation(); removeCost(idx); }} className="p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                                <Trash2 size={12}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* IBL CALCULATOR */}
                <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 p-4 rounded-sm mb-4">
                    <div className="flex items-center gap-2 mb-3 text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                        <ClipboardCheck size={14} className="text-amber-500"/> Kalkulator Przeglądów IBL
                    </div>
                    
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-zinc-400 font-bold uppercase mb-1">Miejsca Paletowe</span>
                            <div className={`h-8 px-3 flex items-center bg-zinc-200 dark:bg-zinc-800 rounded-sm font-mono text-xs font-bold ${totalPalletSpots === 0 ? 'text-red-500 border border-red-300' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                {totalPalletSpots}
                            </div>
                        </div>

                        <div className="flex flex-col w-32">
                            <label className="text-[10px] text-zinc-400 font-bold uppercase mb-1">Liczba Przeglądów</label>
                            <input 
                                type="number" 
                                min="1" 
                                className="h-8 w-full p-2 text-xs border border-zinc-300 dark:border-zinc-600 rounded-sm bg-white dark:bg-zinc-800 focus:border-amber-400 outline-none text-center font-bold"
                                value={iblCount}
                                onChange={(e) => setIblCount(Math.max(1, parseInt(e.target.value) || 1))}
                            />
                        </div>

                        <div className="flex flex-col w-32">
                            <label className="text-[10px] text-zinc-400 font-bold uppercase mb-1">Stawka za przegląd</label>
                            <div className="relative">
                                <SmartInput 
                                    className="h-8 w-full p-2 text-xs border border-zinc-300 dark:border-zinc-600 rounded-sm bg-white dark:bg-zinc-800 focus:border-amber-400 outline-none text-right font-bold pr-8"
                                    value={iblRate}
                                    onChange={setIblRate}
                                />
                                <span className="absolute right-2 top-2 text-[10px] text-zinc-400 font-bold">PLN</span>
                            </div>
                        </div>

                        <div className="flex-1 text-right">
                            <div className="text-[10px] text-zinc-400 font-bold uppercase mb-1">Razem</div>
                            <div className="font-mono text-xl font-bold text-zinc-800 dark:text-white">
                                {formatCurrency(iblRate * iblCount, 'PLN')}
                            </div>
                        </div>

                        <button 
                            onClick={handleAddIblCost}
                            disabled={totalPalletSpots <= 0}
                            className="h-8 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-sm flex items-center gap-2 transition-colors shadow-sm"
                        >
                            <Plus size={14}/> Dodaj Koszt IBL
                        </button>
                    </div>
                    {totalPalletSpots === 0 && (
                        <div className="mt-2 text-[10px] text-red-500 flex items-center gap-1 font-bold animate-pulse">
                            <AlertTriangle size={12}/> Uzupełnij liczbę miejsc paletowych w sekcji Montaż!
                        </div>
                    )}
                </div>

            </div>
        </div>
      </div>
    </div>
  );
};
