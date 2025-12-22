import React from 'react';
import { toEuropeanDateString } from '../services/dateUtils';

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
    const dateInputRef = React.useRef<HTMLInputElement>(null);

    const handleTextClick = () => {
        if (disabled || readOnly) return;
        try {
            (dateInputRef.current as any)?.showPicker();
        } catch (e) {
            // Fallback for older browsers or issues
            dateInputRef.current?.focus();
        }
    };

    return (
        <div className="relative inline-block w-full">
            <input
                type="text"
                className={className}
                value={toEuropeanDateString(value)}
                readOnly
                onClick={handleTextClick}
                placeholder={placeholder}
                disabled={disabled}
                autoComplete="off"
            />
            <input
                ref={dateInputRef}
                type="date"
                className="absolute opacity-0 pointer-events-none inset-0 w-full h-full -z-10"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                autoComplete="off"
            />
        </div>
    );
};
