import { MLInput } from '../models/MLPrediction';
import TFLiteModule from '../native/TFLiteModule';

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
     * Predict efficiency using the REAL trained TFLite model
     */
    async predictEfficiency(input: MLInput): Promise<number> {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            // Call native module with REAL trained model
            const efficiency = await TFLiteModule.predictEfficiency(
                input.age,
                input.gender,
                input.yearsOfExperience,
                input.fieldSlope,
                input.quality,
                input.field
            );

            return efficiency;
        } catch (error) {
            console.error('❌ Error predicting efficiency:', error);
            throw error;
        }
    }

    /**
     * Batch prediction
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
     * Check if ready
     */
    isReady(): boolean {
        return this.isInitialized;
    }

    // Dummy methods for compatibility
    getFieldMappings() { return {}; }
    getQualityMappings() { return {}; }
}

export const mlPredictionService = new MLPredictionService();
