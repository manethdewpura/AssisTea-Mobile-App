export interface DailyData {
  id: string;
  workerId: string;
  plantationId: string;
  date: string; // ISO date string (YYYY-MM-DD)
  teaPluckedKg: number;
  timeSpentHours: number;
  fieldArea: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateDailyDataInput {
  workerId: string;
  date: string;
  teaPluckedKg: number;
  timeSpentHours: number;
  fieldArea: string;
}

export interface ExcelDailyDataRow {
  workerId: string;
  date: string;
  teaPluckedKg: number | string;
  timeSpentHours: number | string;
  fieldArea: string;
}

export interface CSVDailyDataRow {
  workerId: string;
  teaPluckedKg: number | string;
  timeSpentHours: number | string;
  fieldArea: string;
}

export interface CSVValidationError {
  row: number;
  field: string;
  value: any;
  message: string;
}
