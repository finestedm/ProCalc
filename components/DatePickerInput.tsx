
import React, { useState, useEffect } from 'react';
import { toISODateString, toEuropeanDateString, parseEuropeanDate } from '../services/dateUtils';

interface Props {
    value: string; // YYYY-MM-DD
    onChange: (val: string) => void;
    className?: string;
    placeholder?: string;
    disabled?: boolean;
    readOnly?: boolean;
}

export const DatePickerInput: React.FC<Props> = ({
    value,
    onChange,
    className,
    placeholder = "DD.MM.RRRR",
    disabled,
    readOnly
}) => {
    const [localValue, setLocalValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    // Sync with parent value
    useEffect(() => {
        if (!isFocused) {
            setLocalValue(toEuropeanDateString(value));
        }
    }, [value, isFocused]);

    const handleBlur = () => {
        setIsFocused(false);
        if (readOnly || disabled) return;

        const parsed = parseEuropeanDate(localValue);
        if (parsed) {
            const iso = toISODateString(parsed);
            if (iso !== value) {
                onChange(iso);
            }
            setLocalValue(toEuropeanDateString(iso));
        } else {
            // Revert if invalid
            setLocalValue(toEuropeanDateString(value));
        }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        e.currentTarget.select();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
        if (e.key === 'Escape') {
            setLocalValue(toEuropeanDateString(value));
            e.currentTarget.blur();
        }
    };

    return (
        <input
            type="text"
            className={className}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || readOnly}
            autoComplete="off"
        />
    );
};
