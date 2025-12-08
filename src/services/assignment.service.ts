import { mlPredictionService } from './mlPrediction.service';
import { workerService } from './worker.Service';
import { MLInput, WorkerAssignment, AssignmentSchedule } from '../models/MLPrediction';
import { Worker } from '../models/Worker';

interface Field {
    id: string;
    name: string;
    slope: number;
    maxWorkers: number;
}

class AssignmentService {
    /**
     * Generate optimized worker-to-field assignments for a specific date
     */
    async generateAssignments(
        plantationId: string,
        date: string,
        fields: Field[],
        quality: 'High' | 'Medium' | 'Low' = 'High'
    ): Promise<AssignmentSchedule> {
        try {
            // Initialize ML model if not already done
            if (!mlPredictionService.isReady()) {
                await mlPredictionService.initialize();
            }

            // Get all workers for the plantation
            const workers = await workerService.getWorkersByPlantation(plantationId);

            if (workers.length === 0) {
                throw new Error('No workers found for this plantation');
            }

            if (fields.length === 0) {
                throw new Error('No fields provided');
            }

            // Generate all possible worker-field combinations
            const combinations: Array<{
                worker: Worker;
                field: Field;
                input: MLInput;
            }> = [];

            for (const worker of workers) {
                for (const field of fields) {
                    const input: MLInput = {
                        age: worker.age,
                        gender: worker.gender as 'Male' | 'Female',
                        yearsOfExperience: parseInt(worker.experience) || 0,
                        fieldSlope: field.slope,
                        quality: quality,
                        field: field.id,
                    };

                    combinations.push({ worker, field, input });
                }
            }

            console.log(`📊 Evaluating ${combinations.length} worker-field combinations...`);

            // Predict efficiency for all combinations (batch prediction)
            const inputs = combinations.map(c => c.input);
            const predictions = await mlPredictionService.predictBatch(inputs);

            // Create prediction results with scores
            const results = combinations.map((combination, index) => ({
                workerId: combination.worker.id,
                workerName: combination.worker.name,
                fieldId: combination.field.id,
                fieldName: combination.field.name,
                predictedEfficiency: predictions[index],
                worker: combination.worker,
                field: combination.field,
            }));

            // Sort by predicted efficiency (descending)
            results.sort((a, b) => b.predictedEfficiency - a.predictedEfficiency);

            // Optimize assignments using greedy algorithm
            const assignments = this.optimizeAssignments(results, fields);

            // Calculate statistics
            const totalEfficiency = assignments.reduce((sum, a) => sum + a.predictedEfficiency, 0);
            const averageEfficiency = totalEfficiency / assignments.length;

            // Create assignment schedule
            const schedule: AssignmentSchedule = {
                id: `schedule_${Date.now()}`,
                date,
                assignments,
                totalWorkers: assignments.length,
                totalFields: new Set(assignments.map(a => a.fieldId)).size,
                averagePredictedEfficiency: averageEfficiency,
                createdAt: new Date(),
                status: 'generated',
            };

            console.log(`✅ Generated ${assignments.length} assignments`);
            console.log(`📈 Average predicted efficiency: ${averageEfficiency.toFixed(2)} kg/hour`);

            return schedule;
        } catch (error) {
            console.error('❌ Error generating assignments:', error);
            throw error;
        }
    }

    /**
     * Optimize assignments using round-robin with efficiency sorting
     * Ensures all fields get workers and workload is balanced
     */
    private optimizeAssignments(
        results: Array<{
            workerId: string;
            workerName: string;
            fieldId: string;
            fieldName: string;
            predictedEfficiency: number;
            field: Field;
        }>,
        fields: Field[]
    ): WorkerAssignment[] {
        const assignments: WorkerAssignment[] = [];
        const assignedWorkers = new Set<string>();

        // Group results by field
        const resultsByField = new Map<string, typeof results>();
        fields.forEach(field => resultsByField.set(field.id, []));

        results.forEach(result => {
            const fieldResults = resultsByField.get(result.fieldId) || [];
            fieldResults.push(result);
            resultsByField.set(result.fieldId, fieldResults);
        });

        // Sort each field's results by efficiency (descending)
        resultsByField.forEach(fieldResults => {
            fieldResults.sort((a, b) => b.predictedEfficiency - a.predictedEfficiency);
        });

        // Round-robin assignment: assign best available worker to each field in turn
        let continueAssigning = true;
        while (continueAssigning) {
            continueAssigning = false;

            for (const field of fields) {
                const fieldResults = resultsByField.get(field.id) || [];

                // Find best unassigned worker for this field
                for (const result of fieldResults) {
                    if (!assignedWorkers.has(result.workerId)) {
                        assignments.push({
                            workerId: result.workerId,
                            workerName: result.workerName,
                            fieldId: result.fieldId,
                            fieldName: result.fieldName,
                            predictedEfficiency: result.predictedEfficiency,
                            date: '',
                            status: 'pending',
                        });

                        assignedWorkers.add(result.workerId);
                        continueAssigning = true;
                        break; // Move to next field
                    }
                }
            }
        }

        return assignments;
    }

    /**
     * Get assignment statistics grouped by field
     */
    getAssignmentsByField(schedule: AssignmentSchedule): Map<string, WorkerAssignment[]> {
        const byField = new Map<string, WorkerAssignment[]>();

        schedule.assignments.forEach(assignment => {
            const existing = byField.get(assignment.fieldId) || [];
            existing.push(assignment);
            byField.set(assignment.fieldId, existing);
        });

        return byField;
    }
}

export const assignmentService = new AssignmentService();
