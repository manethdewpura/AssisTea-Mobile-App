import { NativeModules } from 'react-native';

const { TFLiteModule } = NativeModules;

interface TFLiteModuleInterface {
    initialize(): Promise<string>;
    predictEfficiency(
        age: number,
        gender: string,
        yearsOfExperience: number,
        fieldSlope: number,
        avgEfficiencyHistorical: number,
        recentEfficiencyHistorical: number,
        slopeSpecificEfficiencyHistorical: number
    ): Promise<number>;
}

export default TFLiteModule as TFLiteModuleInterface;
