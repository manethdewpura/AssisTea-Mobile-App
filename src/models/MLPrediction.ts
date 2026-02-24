// ML Prediction Types — 7-Feature Generalizable Model
// No Field ID, no Quality — model predicts from universal physical properties only

export interface MLInput {
    age: number;
    gender: 'Male' | 'Female';
    yearsOfExperience: number;
    fieldSlope: number;                         // degrees
    avgEfficiencyHistorical: number;            // kg/hr — worker's all-time average
    recentEfficiencyHistorical: number;         // kg/hr — last 5 sessions average
    slopeSpecificEfficiencyHistorical: number;  // kg/hr — avg on similar slopes (±5°)
}

export interface MLPredictionResult {
    workerId: string;
    workerName: string;
    fieldId: string;
    fieldName: string;
    predictedEfficiency: number; 
    confidence: number; 
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
    global_avg_efficiency: number;
}

export interface WorkerHistoricalStats {
    avgEfficiency: number;          
    recentEfficiency: number;   
    slopeSpecificEfficiency: number; 
}
