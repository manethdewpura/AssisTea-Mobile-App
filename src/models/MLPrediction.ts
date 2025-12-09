// ML Prediction Types
export interface MLInput {
    age: number;
    gender: 'Male' | 'Female';
    yearsOfExperience: number;
    fieldSlope: number; // in degrees
    quality: 'High' | 'Medium' | 'Low';
    field: string; // Field ID
}

export interface MLPredictionResult {
    workerId: string;
    workerName: string;
    fieldId: string;
    fieldName: string;
    predictedEfficiency: number; // kg/hour
    confidence: number; // 0-1
}

export interface WorkerAssignment {
    workerId: string;
    workerName: string;
    fieldId: string;
    fieldName: string;
    predictedEfficiency: number;
    date: string;
    status: 'pending' | 'approved' | 'rejected';
}

export interface AssignmentSchedule {
    id: string;
    date: string;
    assignments: WorkerAssignment[];
    totalWorkers: number;
    totalFields: number;
    averagePredictedEfficiency: number;
    createdAt: Date;
    status: 'generated' | 'approved' | 'in_progress' | 'completed';
}

export interface ScalerParams {
    mean: number[];
    scale: number[];
    feature_names: string[];
}

export interface LabelMappings {
    gender_mapping: { [key: string]: number };
    field_mapping: { [key: string]: number };
    quality_mapping: { [key: string]: number };
}
