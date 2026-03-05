jest.mock('../../native/TFLiteModule', () => ({
    __esModule: true,
    default: {
        initialize: jest.fn().mockResolvedValue('ok'),
        predictEfficiency: jest.fn().mockResolvedValue(4.0),
    },
}));

jest.mock('../worker.Service', () => ({
    workerService: {
        getWorkersByPlantation: jest.fn(),
    },
}));
jest.mock('../dailyData.service', () => ({
    dailyDataService: {
        getDailyDataByPlantation: jest.fn(),
    },
}));

jest.mock('../sqlite/workerSQLite.service', () => ({
    workerSQLiteService: {
        insertOrReplaceBatch: jest.fn().mockResolvedValue(undefined),
        getAllWorkers: jest.fn(),
    },
}));
jest.mock('../sqlite/dailyDataSQLite.service', () => ({
    dailyDataSQLiteService: {
        insertOrReplaceBatch: jest.fn().mockResolvedValue(undefined),
        getByPlantation: jest.fn(),
    },
}));

jest.mock('../mlPrediction.service', () => ({
    mlPredictionService: {
        isReady: jest.fn().mockReturnValue(true),
        initialize: jest.fn().mockResolvedValue(undefined),
        predictEfficiency: jest.fn().mockResolvedValue(4.0),
        getColdStartDefault: jest.fn().mockReturnValue(3.5015),
    },
}));


import { assignmentService } from '../assignment.service';
import { mlPredictionService } from '../mlPrediction.service';
import { workerService } from '../worker.Service';
import { dailyDataService } from '../dailyData.service';
import { workerSQLiteService } from '../sqlite/workerSQLite.service';
import { dailyDataSQLiteService } from '../sqlite/dailyDataSQLite.service';
import type { AssignmentSchedule } from '../../models/MLPrediction';
import type { Worker } from '../../models/Worker';

const mockMlService = mlPredictionService as jest.Mocked<typeof mlPredictionService>;
const mockWorkerService = workerService as jest.Mocked<typeof workerService>;
const mockDailyDataService = dailyDataService as jest.Mocked<typeof dailyDataService>;
const mockWorkerSQLite = workerSQLiteService as jest.Mocked<typeof workerSQLiteService>;
const mockDailyDataSQLite = dailyDataSQLiteService as jest.Mocked<typeof dailyDataSQLiteService>;


interface TestField {
    id: string;
    name: string;
    slope: number;
    maxWorkers: number;
}

const makeWorker = (overrides: Partial<Worker> = {}): Worker => ({
    id: 'w1',
    name: 'Alice',
    workerId: 'EMP001',
    birthDate: '1990-01-01',
    age: 34,
    experience: '8',
    gender: 'Female',
    plantationId: 'plantation_1',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
});

const makeField = (overrides: Partial<TestField> = {}): TestField => ({
    id: 'f1',
    name: 'Field A',
    slope: 15,
    maxWorkers: 3,
    ...overrides,
});

const PLANTATION_ID = 'plantation_1';
const DATE = '2026-03-05';

describe('AssignmentService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Default: ML model is ready
        mockMlService.isReady.mockReturnValue(true);
        mockMlService.getColdStartDefault.mockReturnValue(3.5015);
        mockMlService.predictEfficiency.mockResolvedValue(4.0);
    });

    describe('calculateHistoricalStats (via generateAssignments)', () => {
        const worker = makeWorker();
        const field = makeField();

        it('uses cold-start defaults when the worker has no daily records', async () => {
            mockWorkerService.getWorkersByPlantation.mockResolvedValue([worker]);
            mockDailyDataService.getDailyDataByPlantation.mockResolvedValue([]);

            await assignmentService.generateAssignments(PLANTATION_ID, DATE, [field]);

            expect(mockMlService.predictEfficiency).toHaveBeenCalledWith(
                expect.objectContaining({
                    avgEfficiencyHistorical: 3.5015,
                    recentEfficiencyHistorical: 3.5015,
                    slopeSpecificEfficiencyHistorical: 3.5015,
                }),
            );
        });

        it('computes correct avgEfficiency from multiple sessions', async () => {
            // 10 kg in 2 hr → 5.0 kg/hr,  6 kg in 2 hr → 3.0 kg/hr  →  avg = 4.0
            const records = [
                { workerId: 'w1', teaPluckedKg: 10, timeSpentHours: 2, date: '2026-01-01' },
                { workerId: 'w1', teaPluckedKg: 6, timeSpentHours: 2, date: '2026-01-02' },
            ];
            mockWorkerService.getWorkersByPlantation.mockResolvedValue([worker]);
            mockDailyDataService.getDailyDataByPlantation.mockResolvedValue(records as any);

            await assignmentService.generateAssignments(PLANTATION_ID, DATE, [field]);

            expect(mockMlService.predictEfficiency).toHaveBeenCalledWith(
                expect.objectContaining({ avgEfficiencyHistorical: 4.0 }),
            );
        });

        it('recentEfficiency uses only the last 5 sessions (RECENT_N = 5)', async () => {
            // Sessions 1-5 have efficiency 2.0, session 6 (most recent) has 10.0
            // The last 5 chronologically should include session 6 → mean ≠ 2.0
            const records = Array.from({ length: 5 }, (_, i) => ({
                workerId: 'w1',
                teaPluckedKg: 2,
                timeSpentHours: 1,
                date: `2026-01-0${i + 1}`,
            }));
            records.push({
                workerId: 'w1',
                teaPluckedKg: 10,
                timeSpentHours: 1,
                date: '2026-01-10',
            });
            mockWorkerService.getWorkersByPlantation.mockResolvedValue([worker]);
            mockDailyDataService.getDailyDataByPlantation.mockResolvedValue(records as any);

            await assignmentService.generateAssignments(PLANTATION_ID, DATE, [field]);

            const call = mockMlService.predictEfficiency.mock.calls[0][0];
            // Recent 5 = sessions 2..6 → efficiencies: 2,2,2,2,10 → avg = 3.6
            expect(call.recentEfficiencyHistorical).toBeCloseTo(3.6, 1);
        });

        it('slopeSpecificEfficiency matches records within ±5° slope window', async () => {
            const records = [
                { workerId: 'w1', teaPluckedKg: 8, timeSpentHours: 1, fieldSlope: 12, date: '2026-01-01' },
                { workerId: 'w1', teaPluckedKg: 2, timeSpentHours: 1, fieldSlope: 30, date: '2026-01-02' },
            ];
            mockWorkerService.getWorkersByPlantation.mockResolvedValue([worker]);
            mockDailyDataService.getDailyDataByPlantation.mockResolvedValue(records as any);

            await assignmentService.generateAssignments(PLANTATION_ID, DATE, [field]);

            const call = mockMlService.predictEfficiency.mock.calls[0][0];
            // Only record A is in window → slopeSpecific = 8.0
            expect(call.slopeSpecificEfficiencyHistorical).toBeCloseTo(8.0, 1);
        });

        it('falls back slopeSpecificEfficiency to avgEfficiency when no slope-similar sessions exist', async () => {
            // field.slope = 15° — both records have slope 40° (outside ±5° window)
            const records = [
                { workerId: 'w1', teaPluckedKg: 6, timeSpentHours: 1, fieldSlope: 40, date: '2026-01-01' },
                { workerId: 'w1', teaPluckedKg: 4, timeSpentHours: 1, fieldSlope: 42, date: '2026-01-02' },
            ];
            mockWorkerService.getWorkersByPlantation.mockResolvedValue([worker]);
            mockDailyDataService.getDailyDataByPlantation.mockResolvedValue(records as any);

            await assignmentService.generateAssignments(PLANTATION_ID, DATE, [field]);

            const call = mockMlService.predictEfficiency.mock.calls[0][0];
            const avg = call.avgEfficiencyHistorical;
            const slopeSpecific = call.slopeSpecificEfficiencyHistorical;
            expect(slopeSpecific).toBeCloseTo(avg, 4);
        });
    });

    describe('optimizeAssignments (greedy, via generateAssignments)', () => {
        it('assigns each worker to exactly one field', async () => {
            const workers = [makeWorker({ id: 'w1', name: 'Alice' }), makeWorker({ id: 'w2', name: 'Bob' })];
            const field = makeField({ maxWorkers: 5 });

            mockWorkerService.getWorkersByPlantation.mockResolvedValue(workers);
            mockDailyDataService.getDailyDataByPlantation.mockResolvedValue([]);

            const schedule = await assignmentService.generateAssignments(
                PLANTATION_ID, DATE, [field],
            );

            const workerIds = schedule.assignments.map(a => a.workerId);
            expect(new Set(workerIds).size).toBe(workers.length);
        });

        it('never exceeds field.maxWorkers capacity', async () => {
            const workers = Array.from({ length: 5 }, (_, i) =>
                makeWorker({ id: `w${i}`, name: `Worker ${i}` }),
            );
            const field = makeField({ maxWorkers: 2 }); 

            mockWorkerService.getWorkersByPlantation.mockResolvedValue(workers);
            mockDailyDataService.getDailyDataByPlantation.mockResolvedValue([]);

            mockMlService.predictEfficiency.mockResolvedValue(4.0);

            const schedule = await assignmentService.generateAssignments(
                PLANTATION_ID, DATE, [field],
            );

            const assignedToField = schedule.assignments.filter(a => a.fieldId === field.id);
            expect(assignedToField.length).toBeLessThanOrEqual(field.maxWorkers);
        });

        it('picks the globally highest-efficiency pair first (greedy ordering)', async () => {
            const workers = [
                makeWorker({ id: 'w1', name: 'Alice' }),
                makeWorker({ id: 'w2', name: 'Bob' }),
            ];
            const fields = [
                makeField({ id: 'f1', name: 'Field A', slope: 10, maxWorkers: 1 }),
                makeField({ id: 'f2', name: 'Field B', slope: 30, maxWorkers: 1 }),
            ];

            mockWorkerService.getWorkersByPlantation.mockResolvedValue(workers);
            mockDailyDataService.getDailyDataByPlantation.mockResolvedValue([]);

            // w1+f1 → 9.0 (best global), w1+f2 → 2.0, w2+f1 → 5.0, w2+f2 → 8.0
            mockMlService.predictEfficiency
                .mockResolvedValueOnce(9.0) // w1 × f1
                .mockResolvedValueOnce(2.0) // w1 × f2
                .mockResolvedValueOnce(5.0) // w2 × f1
                .mockResolvedValueOnce(8.0); // w2 × f2

            const schedule = await assignmentService.generateAssignments(
                PLANTATION_ID, DATE, fields,
            );

            const assignmentMap = Object.fromEntries(
                schedule.assignments.map(a => [a.workerId, a.fieldId]),
            );
            // Greedy: w1→f1 (9.0), then w2→f2 (8.0 — f1 full)
            expect(assignmentMap['w1']).toBe('f1');
            expect(assignmentMap['w2']).toBe('f2');
        });

        it('leaves workers unassigned when all fields are at capacity', async () => {
            const workers = Array.from({ length: 3 }, (_, i) =>
                makeWorker({ id: `w${i}`, name: `Worker ${i}` }),
            );
            const field = makeField({ maxWorkers: 1 }); // only one slot

            mockWorkerService.getWorkersByPlantation.mockResolvedValue(workers);
            mockDailyDataService.getDailyDataByPlantation.mockResolvedValue([]);

            const schedule = await assignmentService.generateAssignments(
                PLANTATION_ID, DATE, [field],
            );

            expect(schedule.assignments.length).toBe(1);
        });
    });

    describe('generateAssignments', () => {
        it('returns a valid AssignmentSchedule with correct summary fields', async () => {
            const workers = [makeWorker({ id: 'w1' }), makeWorker({ id: 'w2' })];
            const fields = [
                makeField({ id: 'f1', maxWorkers: 1 }),
                makeField({ id: 'f2', name: 'Field B', maxWorkers: 1 }),
            ];

            mockWorkerService.getWorkersByPlantation.mockResolvedValue(workers);
            mockDailyDataService.getDailyDataByPlantation.mockResolvedValue([]);
            mockMlService.predictEfficiency
                .mockResolvedValueOnce(5.0)
                .mockResolvedValueOnce(3.0)
                .mockResolvedValueOnce(4.0)
                .mockResolvedValueOnce(6.0);

            const schedule = await assignmentService.generateAssignments(
                PLANTATION_ID, DATE, fields,
            );

            expect(schedule.date).toBe(DATE);
            expect(schedule.status).toBe('generated');
            expect(schedule.totalWorkers).toBe(schedule.assignments.length);
            expect(schedule.totalFields).toBe(
                new Set(schedule.assignments.map(a => a.fieldId)).size,
            );
            expect(schedule.averagePredictedEfficiency).toBeGreaterThan(0);
            expect(schedule.id).toMatch(/^schedule_/);
        });

        it('throws "No fields provided" when fields array is empty', async () => {
            mockWorkerService.getWorkersByPlantation.mockResolvedValue([makeWorker()]);
            mockDailyDataService.getDailyDataByPlantation.mockResolvedValue([]);

            await expect(
                assignmentService.generateAssignments(PLANTATION_ID, DATE, []),
            ).rejects.toThrow('No fields provided');
        });

        it('initializes the ML model when it is not yet ready', async () => {
            mockMlService.isReady.mockReturnValue(false);
            mockWorkerService.getWorkersByPlantation.mockResolvedValue([makeWorker()]);
            mockDailyDataService.getDailyDataByPlantation.mockResolvedValue([]);

            await assignmentService.generateAssignments(PLANTATION_ID, DATE, [makeField()]);

            expect(mockMlService.initialize).toHaveBeenCalledTimes(1);
        });

        it('falls back to SQLite when Firebase is unavailable (offline mode)', async () => {
            mockWorkerService.getWorkersByPlantation.mockRejectedValue(
                new Error('Network error'),
            );
            mockDailyDataService.getDailyDataByPlantation.mockRejectedValue(
                new Error('Network error'),
            );
            mockWorkerSQLite.getAllWorkers.mockResolvedValue([makeWorker()]);
            mockDailyDataSQLite.getByPlantation.mockResolvedValue([]);

            const schedule = await assignmentService.generateAssignments(
                PLANTATION_ID, DATE, [makeField()],
            );

            expect(mockWorkerSQLite.getAllWorkers).toHaveBeenCalledWith(PLANTATION_ID);
            expect(schedule.assignments.length).toBeGreaterThanOrEqual(0);
        });

        it('throws when both Firebase and SQLite return no workers', async () => {
            mockWorkerService.getWorkersByPlantation.mockRejectedValue(
                new Error('Network error'),
            );
            mockWorkerSQLite.getAllWorkers.mockResolvedValue([]);
            mockDailyDataSQLite.getByPlantation.mockResolvedValue([]);

            await expect(
                assignmentService.generateAssignments(PLANTATION_ID, DATE, [makeField()]),
            ).rejects.toThrow(/No workers found/);
        });
    });

    describe('getAssignmentsByField', () => {
        it('groups assignments correctly by fieldId', () => {
            const schedule: AssignmentSchedule = {
                id: 'sched_1',
                date: DATE,
                totalWorkers: 3,
                totalFields: 2,
                averagePredictedEfficiency: 4.0,
                createdAt: new Date(),
                status: 'generated',
                assignments: [
                    { workerId: 'w1', workerName: 'Alice', fieldId: 'f1', fieldName: 'Field A', predictedEfficiency: 5.0, date: DATE, status: 'pending' },
                    { workerId: 'w2', workerName: 'Bob', fieldId: 'f1', fieldName: 'Field A', predictedEfficiency: 4.5, date: DATE, status: 'pending' },
                    { workerId: 'w3', workerName: 'Carol', fieldId: 'f2', fieldName: 'Field B', predictedEfficiency: 3.8, date: DATE, status: 'pending' },
                ],
            };

            const byField = assignmentService.getAssignmentsByField(schedule);

            expect(byField.get('f1')).toHaveLength(2);
            expect(byField.get('f2')).toHaveLength(1);
            expect(byField.get('f1')!.map(a => a.workerId)).toEqual(['w1', 'w2']);
        });

        it('returns an empty map for a schedule with no assignments', () => {
            const emptySchedule: AssignmentSchedule = {
                id: 'sched_empty',
                date: DATE,
                totalWorkers: 0,
                totalFields: 0,
                averagePredictedEfficiency: 0,
                createdAt: new Date(),
                status: 'generated',
                assignments: [],
            };

            const byField = assignmentService.getAssignmentsByField(emptySchedule);

            expect(byField.size).toBe(0);
        });
    });
});
