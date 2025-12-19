
/**
 * Utility for safe date handling without timezone shifts.
 */

export const toISODateString = (date: Date | string | null | undefined): string => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    // Returns YYYY-MM-DD in local time
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const toEuropeanDateString = (date: Date | string | null | undefined): string => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    // Returns DD.MM.YYYY in local time
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
};

export const parseEuropeanDate = (str: string): Date | null => {
    if (!str) return null;
    const parts = str.split(/[./-]/);
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);

    // If year is 2 digits, assume 20xx
    const fullYear = year < 100 ? 2000 + year : year;

    const d = new Date(fullYear, month, day);
    return isNaN(d.getTime()) ? null : d;
};

export const formatDisplayDate = (date: Date | string | null | undefined): string => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric' });
};
