
import React, { useState, useEffect } from 'react';

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    value: number | undefined | null;
    onChange: (val: number) => void;
    allowNegative?: boolean;
    decimalScale?: number;
}

export const SmartInput: React.FC<Props> = ({ 
    value, 
    onChange, 
    allowNegative = false, 
    decimalScale,
    onBlur, 
    onKeyDown, 
    className, 
    ...props 
}) => {
    const [localValue, setLocalValue] = useState<string>('');
    const [isFocused, setIsFocused] = useState(false);

    const calculate = (str: string): number | null => {
        let input = str.trim();
        if (!input) return 0;
        
        // Normalize decimal separator: replace comma with dot
        input = input.replace(/,/g, '.');

        try {
            if (input.startsWith('=')) {
                // Security: Only allow digits and math operators
                const expr = input.substring(1).replace(/[^0-9+\-*/().]/g, '');
                // eslint-disable-next-line no-new-func
                const res = new Function(`return (${expr})`)();
                return isFinite(res) ? res : null;
            } else {
                const num = parseFloat(input);
                return isNaN(num) ? null : num;
            }
        } catch {
            return null;
        }
    };

    // Sync with parent value
    useEffect(() => {
        const propValue = value !== undefined && value !== null ? value.toString() : '';
        
        // Logic: 
        // 1. If not focused, always sync with parent.
        // 2. If focused, check if parent value differs from what we currently have locally (parsed).
        //    This happens on Undo/Redo or external updates. We avoid overwriting if the values match conceptually 
        //    (e.g. parent has 1, local has "1." -> don't overwrite).
        
        if (!isFocused) {
            setLocalValue(propValue);
        } else {
            const currentParsed = calculate(localValue);
            // If parent value is different from our current valid number, it implies an external force change (Undo)
            // Note: We use loose equality or epsilon if floats, but exact match is fine for state restoration
            if (currentParsed !== value && value !== undefined && value !== null) {
                 setLocalValue(propValue);
            }
        }
    }, [value, isFocused]); // localValue excluded to prevent loop, logic handles it via closure or stable ref pattern if needed, but here simple dep is safer if we trust prop update frequency

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        const result = calculate(localValue);
        
        if (result !== null) {
            let finalVal = result;
            if (!allowNegative && finalVal < 0) finalVal = 0;
            
            if (decimalScale !== undefined) {
                const factor = Math.pow(10, decimalScale);
                finalVal = Math.round(finalVal * factor) / factor;
            }

            onChange(finalVal);
            setLocalValue(finalVal.toString());
        } else {
            // Revert to original on error
            setLocalValue(value !== undefined && value !== null ? value.toString() : '');
        }
        
        if (onBlur) onBlur(e);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        // Select all on focus for easier overwriting
        e.currentTarget.select();
    };

    const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
        if (onKeyDown) onKeyDown(e);
    };

    return (
        <input
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onFocus={handleFocus}
            onKeyDown={handleKeyDownInternal}
            className={className}
            autoComplete="off"
            {...props}
        />
    );
};
