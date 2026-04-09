import { mlPredictionService } from './mlPrediction.service';
import { workerService } from './worker.Service';
import { workerSQLiteService } from './sqlite/workerSQLite.service';
import { dailyDataService } from './dailyData.service';
import { dailyDataSQLiteService } from './sqlite/dailyDataSQLite.service';
import { MLInput, WorkerAssignment, AssignmentSchedule, WorkerHistoricalStats } from '../models/MLPrediction';
import { Worker } from '../models/Worker';
import { checkNetworkConnection } from '../utils/network.util';

const SLOPE_WINDOW = 5.0; // ±degrees around target slope for slope-specific efficiency lookup
const RECENT_N = 5;       // number of most recent work sessions for calculating recent efficiency trends

interface Field {
    id: string;
    name: string;
    slope: number;
    maxWorkers: number;
}

interface DailyRecord {
    workerId: string;
    teaPluckedKg: number;
    timeSpentHours: number;
    fieldSlope?: number;
    fieldArea?: string;  // field name used for slope lookup
    date?: string;       // ISO date string used for chronological sort
}

class AssignmentService {

    /**
     * Calculate historical stats for a worker from an in-memory list of records.
     * All computation is local — no network calls.
     */
    private calculateHistoricalStats(
        workerId: string,
        fieldSlope: number,
        allRecords: DailyRecord[]
    ): WorkerHistoricalStats {
        const defaultVal = mlPredictionService.getColdStartDefault();

        const workerRecords = allRecords
            .filter(r => r.workerId === workerId && r.timeSpentHours > 0)
            .sort((a, b) => {
                // Sort chronologically so slice(-N) always gives the most recent sessions
                const dateA = a.date ?? '';
                const dateB = b.date ?? '';
                return dateA < dateB ? -1 : dateA > dateB ? 1 : 0;
            });

        if (workerRecords.length === 0) {
            return { avgEfficiency: defaultVal, recentEfficiency: defaultVal, slopeSpecificEfficiency: defaultVal };
        }

        const efficiencies = workerRecords.map(r => ({
            efficiency: r.teaPluckedKg / r.timeSpentHours,
            slope: r.fieldSlope ?? fieldSlope,
        }));

        const avgEfficiency =
            efficiencies.reduce((sum, r) => sum + r.efficiency, 0) / efficiencies.length;

        const recent = efficiencies.slice(-RECENT_N);
        const recentEfficiency =
            recent.reduce((sum, r) => sum + r.efficiency, 0) / recent.length;

        const similarSlope = efficiencies.filter(r => Math.abs(r.slope - fieldSlope) <= SLOPE_WINDOW);
        const slopeSpecificEfficiency =
            similarSlope.length > 0
                ? similarSlope.reduce((sum, r) => sum + r.efficiency, 0) / similarSlope.length
                : avgEfficiency;

        return { avgEfficiency, recentEfficiency, slopeSpecificEfficiency };
    }

    /**
     * Fetch workers and daily data — online or offline.
     *
     * Online path:  Firebase → cache to SQLite → return data
     * Offline path: SQLite → return cached data
     *
     * The schedule generation algorithm is identical in both cases.
     */
    private async fetchDataForSchedule(
        plantationId: string
    ): Promise<{ workers: Worker[]; dailyRecords: DailyRecord[] }> {

        let workers: Worker[] = [];
        let dailyRecords: DailyRecord[] = [];
        let fetchedOnline = false;
        let usedSQLiteCache = false;

        // Detect network status explicitly instead of relying on Firebase
        // to throw when offline. Firestore often serves from its own cache
        // without errors, which would skip our SQLite fallback.
        let isConnected = true;
        try {
            const result = await checkNetworkConnection();
            isConnected = !!result?.isConnected;
        } catch (netErr) {
            console.warn('⚠️ Could not determine network status, assuming online:', netErr);
        }

        if (isConnected) {
            // ── Online (or unknown) path — try Firebase first ────────────────
            try {
                const [firebaseWorkers, firebaseDailyData] = await Promise.all([
                    workerService.getWorkersByPlantation(plantationId),
                    dailyDataService.getDailyDataByPlantation(plantationId),
                ]);

                workers = firebaseWorkers;
                dailyRecords = firebaseDailyData as DailyRecord[];
                fetchedOnline = true;

                // Cache to SQLite in background so next offline attempt works
                Promise.all([
                    dailyDataSQLiteService.insertOrReplaceBatch(dailyRecords as any),
                    workerSQLiteService.insertOrReplaceBatch(firebaseWorkers),
                ]).catch(err => console.warn('⚠️ Background SQLite cache failed:', err));

                console.log(`🌐 Online: ${workers.length} workers, ${dailyRecords.length} daily records`);
            } catch (error) {
                // API failed even though we think we're online — fall back to SQLite cache.
                console.warn('Failed to fetch from Firebase, falling back to SQLite:', error);
                console.log('📴 Using SQLite cache due to Firebase error...');

                const [sqliteWorkers, sqliteDailyData] = await Promise.all([
                    workerSQLiteService.getAllWorkers(plantationId),
                    dailyDataSQLiteService.getByPlantation(plantationId),
                ]);

                workers = sqliteWorkers;
                dailyRecords = sqliteDailyData;
                usedSQLiteCache = true;

                console.log(`📦 SQLite (fallback): ${workers.length} workers, ${dailyRecords.length} daily records`);
            }
        } else {
            // ── Explicit offline path — go straight to SQLite ────────────────
            console.log('📴 Device offline — reading from SQLite cache...');
            const [sqliteWorkers, sqliteDailyData] = await Promise.all([
                workerSQLiteService.getAllWorkers(plantationId),
                dailyDataSQLiteService.getByPlantation(plantationId),
            ]);

            workers = sqliteWorkers;
            dailyRecords = sqliteDailyData;
            usedSQLiteCache = true;

            console.log(`📦 SQLite (offline): ${workers.length} workers, ${dailyRecords.length} daily records`);
        }

        if (workers.length === 0) {
            if (!fetchedOnline && usedSQLiteCache) {
                // We are offline or using cache, but have no local data.
                throw new Error(
                    'No workers found — please connect to the internet at least once so data can be cached for offline use',
                );
            }

            // Online but plantation truly has no workers.
            throw new Error('No workers found for this plantation');
        }

        return { workers, dailyRecords };
    }

    /**
     * Generate optimized worker-to-field assignments.
     * Works online (Firebase) or offline (SQLite cache). ML inference always on-device.
     */
    async generateAssignments(
        plantationId: string,
        date: string,
        fields: Field[],
        excludedWorkerIds?: string[]   // IDs of workers marked absent for today
    ): Promise<AssignmentSchedule> {
        try {
            if (!mlPredictionService.isReady()) {
                await mlPredictionService.initialize();
            }

            if (fields.length === 0) throw new Error('No fields provided');

            // Single entry point — handles both online and offline transparently
            const { workers, dailyRecords } = await this.fetchDataForSchedule(plantationId);

            // Filter out absent workers — pure in-memory, no DB or network calls.
            // The ML model and all downstream logic are completely unchanged.
            const availableWorkers = (excludedWorkerIds && excludedWorkerIds.length > 0)
                ? workers.filter(w => !excludedWorkerIds.includes(w.id))
                : workers;

            if (availableWorkers.length === 0) {
                throw new Error('No available workers for today. Please mark at least one worker as available.');
            }


            // Build field name/ID → slope lookup from the fields already provided.
            // This is pure in-memory work — no extra network calls.
            const fieldSlopeMap = new Map<string, number>();
            fields.forEach(f => {
                fieldSlopeMap.set(f.name, f.slope);
                // Also map by field.id — daily records from Firestore store the field
                // reference as the field name, while SQLite cache may store the field ID.
                // Both keys map to the same slope value, ensuring lookup works in either case.
                fieldSlopeMap.set(f.id, f.slope);
            });

            // Annotate each daily record with the real slope it was worked on,
            // so slopeSpecificEfficiency uses accurate historical slope data.
            const annotatedRecords: DailyRecord[] = dailyRecords.map(r => {
                const resolvedSlope = r.fieldArea ? fieldSlopeMap.get(r.fieldArea) : undefined;
                return resolvedSlope !== undefined
                    ? { ...r, fieldSlope: resolvedSlope }
                    : r; // no match → fieldSlope stays undefined → falls back to target slope
            });

            console.log(`🗺️ Slope map built for ${fields.length} fields. Annotated ${annotatedRecords.filter(r => r.fieldSlope !== undefined).length}/${annotatedRecords.length} records with real slopes.`);

            // Build all worker × field ML inputs from in-memory data
            const combinations: Array<{ worker: Worker; field: Field; input: MLInput }> = [];

            for (const worker of availableWorkers) {
                for (const field of fields) {
                    const stats = this.calculateHistoricalStats(worker.id, field.slope, annotatedRecords);

                    const gender: MLInput['gender'] =
                        worker.gender === 'Male' || worker.gender === 'Female'
                            ? worker.gender
                            : 'Male'; // fallback for 'Other' — not in model training set

                    combinations.push({
                        worker,
                        field,
                        input: {
                            age: worker.age,
                            gender,
                            yearsOfExperience: parseInt(worker.experience) || 0,
                            fieldSlope: field.slope,
                            avgEfficiencyHistorical: stats.avgEfficiency,
                            recentEfficiencyHistorical: stats.recentEfficiency,
                            slopeSpecificEfficiencyHistorical: stats.slopeSpecificEfficiency,
                        },
                    });
                }
            }

            console.log(`📊 Running ${combinations.length} parallel predictions...`);

            // All predictions in parallel — fully on-device, no network
            const predictions = await Promise.all(
                combinations.map(c => mlPredictionService.predictEfficiency(c.input))
            );

            const results = combinations.map((combo, i) => ({
                workerId: combo.worker.id,
                workerName: combo.worker.name,
                fieldId: combo.field.id,
                fieldName: combo.field.name,
                predictedEfficiency: predictions[i],
                worker: combo.worker,
                field: combo.field,
            }));

            results.sort((a, b) => b.predictedEfficiency - a.predictedEfficiency);

            const assignments = this.optimizeAssignments(results, fields);

            const avgEfficiency = assignments.length > 0
                ? assignments.reduce((sum, a) => sum + a.predictedEfficiency, 0) / assignments.length
                : 0;

            const schedule: AssignmentSchedule = {
                id: `schedule_${Date.now()}`,
                date,
                assignments,
                totalWorkers: assignments.length,
                totalFields: new Set(assignments.map(a => a.fieldId)).size,
                averagePredictedEfficiency: avgEfficiency,
                createdAt: new Date(),
                status: 'generated',
            };

            console.log(`✅ ${assignments.length} assignments | avg ${avgEfficiency.toFixed(2)} kg/hr`);

            return schedule;
        } catch (error) {
            console.error('❌ Error generating assignments:', error);
            throw error;
        }
    }

    /**
     * Global Greedy optimizer: considers ALL worker×field predictions at once and
     * always picks the globally best unassigned (worker, field) pair that still
     * has field capacity. Substantially better than round-robin — correctly places
     * workers with the highest slope affinity on their best field regardless of
     * field processing order. Scales well to 100+ workers.
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

        // Track how many workers are assigned to each field
        const fieldWorkerCount = new Map<string, number>();
        const fieldCapacity = new Map<string, number>();
        fields.forEach(f => {
            fieldWorkerCount.set(f.id, 0);
            fieldCapacity.set(f.id, f.maxWorkers);
        });

        // results is already sorted globally by predictedEfficiency descending.
        // One linear pass: assign the best valid (worker, field) pair each time.
        for (const result of results) {
            if (assignedWorkers.has(result.workerId)) continue;

            const capacity = fieldCapacity.get(result.fieldId);
            if (capacity === undefined) {
                console.warn(`optimizeAssignments: result references unknown fieldId "${result.fieldId}".`);
                continue;
            }
            const used = fieldWorkerCount.get(result.fieldId) ?? 0;
            if (used >= capacity) continue; // field is full — skip this pair

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
            fieldWorkerCount.set(result.fieldId, used + 1);
        }

        return assignments;
    }

    getAssignmentsByField(schedule: AssignmentSchedule): Map<string, WorkerAssignment[]> {
        const byField = new Map<string, WorkerAssignment[]>();
        schedule.assignments.forEach(a => {
            const existing = byField.get(a.fieldId) || [];
            existing.push(a);
            byField.set(a.fieldId, existing);
        });
        return byField;
    }
}

export const assignmentService = new AssignmentService();
