jest.mock('../../native/TFLiteModule', () => ({
    __esModule: true,
    default: {
        initialize: jest.fn(),
        predictEfficiency: jest.fn(),
    },
}));

import TFLiteModule from '../../native/TFLiteModule';
import { mlPredictionService } from '../mlPrediction.service';
import type { MLInput } from '../../models/MLPrediction';

const mockTFLite = TFLiteModule as {
    initialize: jest.Mock;
    predictEfficiency: jest.Mock;
};

const sampleInput: MLInput = {
    age: 35,
    gender: 'Female',
    yearsOfExperience: 8,
    fieldSlope: 15,
    avgEfficiencyHistorical: 4.2,
    recentEfficiencyHistorical: 4.5,
    slopeSpecificEfficiencyHistorical: 4.1,
};

function resetService() {
    (mlPredictionService as any).isInitialized = false;
}

describe('MLPredictionService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetService();
    });

    describe('isReady', () => {
        it('returns false before initialization', () => {
            expect(mlPredictionService.isReady()).toBe(false);
        });

        it('returns true after successful initialization', async () => {
            mockTFLite.initialize.mockResolvedValueOnce('Model loaded');
            await mlPredictionService.initialize();
            expect(mlPredictionService.isReady()).toBe(true);
        });
    });

    describe('getColdStartDefault', () => {
        it('returns 3.5015 (matches global_avg_efficiency in label_mappings.json)', () => {
            expect(mlPredictionService.getColdStartDefault()).toBeCloseTo(3.5015, 4);
        });
    });

    describe('initialize', () => {
        it('calls TFLiteModule.initialize() and marks the service as ready', async () => {
            mockTFLite.initialize.mockResolvedValueOnce('Model loaded successfully');

            await mlPredictionService.initialize();

            expect(mockTFLite.initialize).toHaveBeenCalledTimes(1);
            expect(mlPredictionService.isReady()).toBe(true);
        });

        it('is idempotent — does NOT reinitialize when already ready', async () => {
            mockTFLite.initialize.mockResolvedValueOnce('Model loaded successfully');

            await mlPredictionService.initialize(); // first call
            await mlPredictionService.initialize(); // second call 

            expect(mockTFLite.initialize).toHaveBeenCalledTimes(1);
        });

        it('throws and stays uninitialized when TFLiteModule.initialize() rejects', async () => {
            const error = new Error('Failed to load model');
            mockTFLite.initialize.mockRejectedValueOnce(error);

            await expect(mlPredictionService.initialize()).rejects.toThrow(
                'Failed to load model',
            );
            expect(mlPredictionService.isReady()).toBe(false);
        });
    });

    describe('predictEfficiency', () => {
        beforeEach(() => {
            mockTFLite.initialize.mockResolvedValue('ok');
        });

        it('calls TFLiteModule.predictEfficiency with all 7 features in the correct order', async () => {
            mockTFLite.predictEfficiency.mockResolvedValueOnce(4.8);
            await mlPredictionService.initialize();

            await mlPredictionService.predictEfficiency(sampleInput);

            expect(mockTFLite.predictEfficiency).toHaveBeenCalledWith(
                sampleInput.age,                               
                sampleInput.gender,                     
                sampleInput.yearsOfExperience,             
                sampleInput.fieldSlope,                       
                sampleInput.avgEfficiencyHistorical,           
                sampleInput.recentEfficiencyHistorical,        
                sampleInput.slopeSpecificEfficiencyHistorical, 
            );
        });

        it('returns the numeric efficiency value from the native module', async () => {
            mockTFLite.predictEfficiency.mockResolvedValueOnce(5.23);
            await mlPredictionService.initialize();

            const result = await mlPredictionService.predictEfficiency(sampleInput);

            expect(result).toBeCloseTo(5.23, 2);
        });

        it('auto-initializes the model when called before initialize()', async () => {
            mockTFLite.predictEfficiency.mockResolvedValueOnce(3.9);

            // Service is NOT initialized (reset in beforeEach)
            const result = await mlPredictionService.predictEfficiency(sampleInput);

            expect(mockTFLite.initialize).toHaveBeenCalledTimes(1);
            expect(result).toBeCloseTo(3.9, 2);
        });

        it('throws when TFLiteModule.predictEfficiency() rejects', async () => {
            await mlPredictionService.initialize();
            mockTFLite.predictEfficiency.mockRejectedValueOnce(
                new Error('Native prediction error'),
            );

            await expect(
                mlPredictionService.predictEfficiency(sampleInput),
            ).rejects.toThrow('Native prediction error');
        });
    });

    describe('predictBatch', () => {
        beforeEach(() => {
            mockTFLite.initialize.mockResolvedValue('ok');
        });

        it('calls predictEfficiency once per input and returns predictions in order', async () => {
            await mlPredictionService.initialize();

            const inputs: MLInput[] = [
                { ...sampleInput, age: 25 },
                { ...sampleInput, age: 40 },
                { ...sampleInput, age: 55 },
            ];
            mockTFLite.predictEfficiency
                .mockResolvedValueOnce(3.5)
                .mockResolvedValueOnce(4.8)
                .mockResolvedValueOnce(4.1);

            const results = await mlPredictionService.predictBatch(inputs);

            expect(mockTFLite.predictEfficiency).toHaveBeenCalledTimes(
                inputs.length,
            );
            expect(results).toHaveLength(3);
            expect(results[0]).toBeCloseTo(3.5, 2);
            expect(results[1]).toBeCloseTo(4.8, 2);
            expect(results[2]).toBeCloseTo(4.1, 2);
        });

        it('returns an empty array when given an empty input list', async () => {
            await mlPredictionService.initialize();
            const results = await mlPredictionService.predictBatch([]);
            expect(results).toEqual([]);
        });
    });
});
