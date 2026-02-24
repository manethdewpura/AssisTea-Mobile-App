import { MLInput } from '../models/MLPrediction';
import TFLiteModule from '../native/TFLiteModule';

// Global default efficiency used when a worker has no history yet
// This matches the global_avg_efficiency from label_mappings.json
const COLD_START_DEFAULT = 3.5015;

class MLPredictionService {
    private isInitialized: boolean = false;

    /**
     * Initialize the TFLite model
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            console.log('ML Model already initialized');
            return;
        }

        try {
            const result = await TFLiteModule.initialize();
            console.log('✅', result);
            this.isInitialized = true;
        } catch (error) {
            console.error('❌ Error initializing ML model:', error);
            throw error;
        }
    }

    /**
     * Predict efficiency using the trained TFLite model.
     * Sends 7 generalizable features — no Field ID, no Quality.
     */
    async predictEfficiency(input: MLInput): Promise<number> {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            const efficiency = await TFLiteModule.predictEfficiency(
                input.age,
                input.gender,
                input.yearsOfExperience,
                input.fieldSlope,
                input.avgEfficiencyHistorical,
                input.recentEfficiencyHistorical,
                input.slopeSpecificEfficiencyHistorical
            );

            return efficiency;
        } catch (error) {
            console.error('❌ Error predicting efficiency:', error);
            throw error;
        }
    }

    /**
     * Batch prediction — predicts efficiency for multiple worker-field inputs
     */
    async predictBatch(inputs: MLInput[]): Promise<number[]> {
        const predictions: number[] = [];
        for (const input of inputs) {
            const prediction = await this.predictEfficiency(input);
            predictions.push(prediction);
        }
        return predictions;
    }

    /**
     * Check if model is ready
     */
    isReady(): boolean {
        return this.isInitialized;
    }

    /**
     * Returns the cold-start default efficiency value.
     * Used when a worker has no historical data yet.
     */
    getColdStartDefault(): number {
        return COLD_START_DEFAULT;
    }
}

export const mlPredictionService = new MLPredictionService();
