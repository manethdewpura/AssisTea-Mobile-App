import { NativeModules } from 'react-native';

const { TFLiteModule } = NativeModules;

interface TFLiteModuleInterface {
    initialize(): Promise<string>;
    predictEfficiency(
        age: number,
        gender: string,
        yearsOfExperience: number,
        fieldSlope: number,
        quality: string,
        field: string
    ): Promise<number>;
}

export default TFLiteModule as TFLiteModuleInterface;
