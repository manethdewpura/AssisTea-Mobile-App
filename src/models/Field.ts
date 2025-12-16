export interface Field {
    id: string;
    name: string;           // e.g., "Field A", "Upper Valley"
    slope: number;          // degrees (5-25)
    maxWorkers: number;     // capacity (3-10)
    location?: string;      // optional description
    plantationId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateFieldInput {
    name: string;
    slope: number;
    maxWorkers: number;
    location?: string;
}
