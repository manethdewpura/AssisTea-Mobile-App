import Papa from 'papaparse';
import type {
    CSVDailyDataRow,
    CSVValidationError,
    CreateDailyDataInput,
} from '../models/DailyData';

interface ParseResult {
    success: boolean;
    data?: CreateDailyDataInput[];
    errors?: CSVValidationError[];
    message?: string;
}

/**
 * Parse a date string in either ISO (2024-02-01) or Excel US format (2/1/2024 or 2/1/24).
 * Always returns YYYY-MM-DD or null if unrecognised.
 */
const parseRowDate = (raw: string): string | null => {
    if (!raw) return null;
    // Already ISO: 2024-02-01
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    // Excel US format: M/D/YYYY or M/D/YY
    const usMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (usMatch) {
        const month = usMatch[1].padStart(2, '0');
        const day = usMatch[2].padStart(2, '0');
        const year = usMatch[3].length === 2 ? `20${usMatch[3]}` : usMatch[3];
        return `${year}-${month}-${day}`;
    }
    return null; 
};

/**
 * Parse and validate CSV file content for daily data upload.
 * If a row includes a `date` column (YYYY-MM-DD), that date is used for that row.
 * Otherwise, falls back to the date selected in the UI date picker.
 * This allows uploading multi-day data in a single CSV.
 * @param fileContent - The CSV file content as string
 * @param fallbackDate - Date from the UI date picker, used when a row has no date column
 */
export const parseCSVFile = async (
    fileContent: string,
    fallbackDate: string,
): Promise<ParseResult> => {
    try {
        // Parse CSV using PapaParse
        const parseResult = Papa.parse<CSVDailyDataRow>(fileContent, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header: string) => header.trim(),
        });

        if (parseResult.errors.length > 0) {
            return {
                success: false,
                message: `CSV parsing error: ${parseResult.errors[0].message}`,
            };
        }

        const rows = parseResult.data;

        if (rows.length === 0) {
            return {
                success: false,
                message: 'CSV file is empty or contains no valid data rows',
            };
        }

        // Validate and transform data
        const validationErrors: CSVValidationError[] = [];
        const validData: CreateDailyDataInput[] = [];

        rows.forEach((row, index) => {
            const rowNumber = index + 2; // +2 because index starts at 0 and we have a header row
            const rowErrors = validateCSVRow(row, rowNumber);

            if (rowErrors.length > 0) {
                validationErrors.push(...rowErrors);
            } else {
                const rawRecord = row as any;
                const rowDate = rawRecord.date ? String(rawRecord.date).trim() : '';
                const resolvedDate = parseRowDate(rowDate) ?? fallbackDate;

                validData.push({
                    workerId: row.workerId.trim(),
                    date: resolvedDate,
                    teaPluckedKg: parseFloat(String(row.teaPluckedKg)),
                    timeSpentHours: parseFloat(String(row.timeSpentHours)),
                    fieldArea: row.fieldArea.trim(),
                });
            }
        });

        if (validationErrors.length > 0) {
            return {
                success: false,
                errors: validationErrors,
                message: `Found ${validationErrors.length} validation error(s) in CSV file`,
            };
        }

        return {
            success: true,
            data: validData,
        };
    } catch (error: any) {
        return {
            success: false,
            message: `Failed to parse CSV: ${error.message || 'Unknown error'}`,
        };
    }
};

/**
 * Validate a single CSV row
 */
const validateCSVRow = (
    row: CSVDailyDataRow,
    rowNumber: number,
): CSVValidationError[] => {
    const errors: CSVValidationError[] = [];

    // Required fields (no date field anymore)
    const requiredFields: (keyof CSVDailyDataRow)[] = [
        'workerId',
        'teaPluckedKg',
        'timeSpentHours',
        'fieldArea',
    ];

    // Check for missing required fields
    requiredFields.forEach(field => {
        if (!row[field] || String(row[field]).trim() === '') {
            errors.push({
                row: rowNumber,
                field,
                value: row[field],
                message: `Missing required field: ${field}`,
            });
        }
    });

    // If basic fields are missing, skip further validation
    if (errors.length > 0) {
        return errors;
    }

    // Validate workerId format (should not be empty after trim)
    if (row.workerId.trim().length === 0) {
        errors.push({
            row: rowNumber,
            field: 'workerId',
            value: row.workerId,
            message: 'Worker ID cannot be empty',
        });
    }

    // Validate teaPluckedKg (must be a positive number)
    const teaPlucked = parseFloat(String(row.teaPluckedKg));
    if (isNaN(teaPlucked)) {
        errors.push({
            row: rowNumber,
            field: 'teaPluckedKg',
            value: row.teaPluckedKg,
            message: 'Tea plucked must be a valid number',
        });
    } else if (teaPlucked < 0) {
        errors.push({
            row: rowNumber,
            field: 'teaPluckedKg',
            value: row.teaPluckedKg,
            message: 'Tea plucked cannot be negative',
        });
    }

    // Validate timeSpentHours (must be a positive number)
    const timeSpent = parseFloat(String(row.timeSpentHours));
    if (isNaN(timeSpent)) {
        errors.push({
            row: rowNumber,
            field: 'timeSpentHours',
            value: row.timeSpentHours,
            message: 'Time spent must be a valid number',
        });
    } else if (timeSpent < 0) {
        errors.push({
            row: rowNumber,
            field: 'timeSpentHours',
            value: row.timeSpentHours,
            message: 'Time spent cannot be negative',
        });
    } else if (timeSpent > 24) {
        errors.push({
            row: rowNumber,
            field: 'timeSpentHours',
            value: row.timeSpentHours,
            message: 'Time spent cannot exceed 24 hours',
        });
    }

    // Validate fieldArea (should not be empty)
    if (row.fieldArea.trim().length === 0) {
        errors.push({
            row: rowNumber,
            field: 'fieldArea',
            value: row.fieldArea,
            message: 'Field area cannot be empty',
        });
    }


    return errors;
};

/**
 * Format validation errors for display
 */
export const formatValidationErrors = (
    errors: CSVValidationError[],
): string => {
    if (errors.length === 0) return '';

    const maxErrorsToShow = 5;
    const errorsToShow = errors.slice(0, maxErrorsToShow);

    let message = 'CSV Validation Errors:\n\n';
    errorsToShow.forEach(error => {
        message += `Row ${error.row}: ${error.message}\n`;
    });

    if (errors.length > maxErrorsToShow) {
        message += `\n...and ${errors.length - maxErrorsToShow} more error(s)`;
    }

    return message;
};
