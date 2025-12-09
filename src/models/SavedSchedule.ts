import { WorkerAssignment } from './MLPrediction';

export interface SavedSchedule {
    id: string;
    plantationId: string;
    date: string;              // YYYY-MM-DD format
    totalWorkers: number;
    totalFields: number;
    averageEfficiency: number;
    assignments: WorkerAssignment[];
    createdAt: Date;
    updatedAt: Date;
    status: 'active' | 'archived';
}

export interface CreateScheduleInput {
    plantationId: string;
    date: string;
    totalWorkers: number;
    totalFields: number;
    averageEfficiency: number;
    assignments: WorkerAssignment[];
}
