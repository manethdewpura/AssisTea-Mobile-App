import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TeaPlantationStackParamList } from '../../navigation/TeaPlantationNavigator';
import { assignmentService } from '../../services/assignment.service';
import { unifiedFieldService } from '../../services/unifiedField.service';
import { unifiedScheduleService } from '../../services/unifiedSchedule.service';
import { workerService } from '../../services/worker.Service';
import { workerSQLiteService } from '../../services/sqlite/workerSQLite.service';
import { AssignmentSchedule, WorkerAssignment } from '../../models/MLPrediction';
import { useAppSelector } from '../../hooks';
import { selectAuth, selectTheme } from '../../store/selectors';

type Props = NativeStackScreenProps<TeaPlantationStackParamList, 'AssignmentGeneration'>;

const AssignmentGenerationScreen: React.FC<Props> = ({ navigation }) => {
    const { colors } = useAppSelector(selectTheme);
    const { userProfile } = useAppSelector(selectAuth);
    const [loading, setLoading] = useState(false);
    const [schedule, setSchedule] = useState<AssignmentSchedule | null>(null);

    const handleGenerateSchedule = async () => {
        if (!userProfile?.plantationId) {
            Alert.alert('Error', 'No plantation ID found');
            return;
        }

        setLoading(true);
        try {
            // 1. Try to sync workers from Firebase to SQLite (background)
            try {
                const firebaseWorkers = await workerService.getWorkersByPlantation(userProfile.plantationId);
                // Do not clear all local workers to avoid losing offline-created/unsynced records.
                // Instead, insert/update Firebase workers into SQLite.
                for (const worker of firebaseWorkers) {
                    await workerSQLiteService.insertWorker(worker);
                }
                console.log(`✅ ${firebaseWorkers.length} workers synced to SQLite`);
            } catch (err) {
                console.warn('⚠️ Worker sync failed (using cached):', err);
            }

            // 2. Load fields from SQLite (offline-first)
            await unifiedFieldService.pullFromFirebase(userProfile.plantationId);
            const fields = await unifiedFieldService.getFields(userProfile.plantationId);

            if (fields.length === 0) {
                Alert.alert(
                    'No Fields Configured',
                    'Please add fields before generating assignments.',
                    [
                        {
                            text: 'Add Fields Now',
                            onPress: () => navigation.navigate('FieldManagement'),
                        },
                        { text: 'Cancel', style: 'cancel' },
                    ]
                );
                setLoading(false);
                return;
            }

            // Convert to format expected by assignment service
            const fieldData = fields.map(f => ({
                id: f.name,
                name: f.name,
                slope: f.slope,
                maxWorkers: f.maxWorkers,
            }));

            const today = new Date().toISOString().split('T')[0];

            // 3. Generate assignments (ML runs offline!)
            const generatedSchedule = await assignmentService.generateAssignments(
                userProfile.plantationId,
                today,
                fieldData
            );

            setSchedule(generatedSchedule);

            // 4. Save to SQLite (offline-capable)
            try {
                await unifiedScheduleService.saveSchedule({
                    plantationId: userProfile.plantationId,
                    date: today,
                    totalWorkers: generatedSchedule.totalWorkers,
                    totalFields: generatedSchedule.totalFields,
                    averageEfficiency: generatedSchedule.averagePredictedEfficiency,
                    assignments: generatedSchedule.assignments,
                });
                console.log('✅ Schedule saved (offline-safe)');
            } catch (saveError) {
                console.error('Failed to save schedule:', saveError);
            }

            Alert.alert(
                'Success!',
                `Generated and saved ${generatedSchedule.assignments.length} assignments with average efficiency ${generatedSchedule.averagePredictedEfficiency.toFixed(2)} kg/hour`
            );
        } catch (error) {
            console.error('Assignment generation error:', error);
            Alert.alert('Error', `Failed to generate schedule: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    const groupByField = () => {
        if (!schedule) return new Map();
        return assignmentService.getAssignmentsByField(schedule);
    };

    const fieldGroups = groupByField();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView style={styles.content}>
                {/* Info Card */}
                <View
                    style={[
                        styles.infoCard,
                        { backgroundColor: colors.cardBackground || '#e8f5e9', borderColor: colors.border },
                    ]}
                >
                    <Text style={[styles.infoTitle, { color: colors.text }]}>🤖 ML-Powered Assignments</Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        Our ML model analyzes worker experience, age, field conditions, and historical data to
                        generate optimized work assignments.
                    </Text>
                </View>

                {/* Generate Button */}
                <TouchableOpacity
                    style={[styles.generateButton, loading && styles.buttonDisabled]}
                    onPress={handleGenerateSchedule}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Text style={styles.buttonIcon}>📊</Text>
                            <Text style={styles.buttonText}>Generate Today's Schedule</Text>
                        </>
                    )}
                </TouchableOpacity>

                {/* Results */}
                {schedule && (
                    <View style={styles.resultsContainer}>
                        <Text style={[styles.resultsTitle, { color: colors.text }]}>Generated Schedule</Text>

                        {/* Stats */}
                        <View style={styles.statsContainer}>
                            <View
                                style={[
                                    styles.statBox,
                                    { backgroundColor: colors.cardBackground || '#fff', borderColor: colors.border },
                                ]}
                            >
                                <Text style={styles.statValue}>{schedule.totalWorkers}</Text>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Workers</Text>
                            </View>
                            <View
                                style={[
                                    styles.statBox,
                                    { backgroundColor: colors.cardBackground || '#fff', borderColor: colors.border },
                                ]}
                            >
                                <Text style={styles.statValue}>{schedule.totalFields}</Text>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Fields</Text>
                            </View>
                            <View
                                style={[
                                    styles.statBox,
                                    { backgroundColor: colors.cardBackground || '#fff', borderColor: colors.border },
                                ]}
                            >
                                <Text style={styles.statValue}>
                                    {schedule.averagePredictedEfficiency.toFixed(1)}
                                </Text>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avg kg/hr</Text>
                            </View>
                        </View>

                        {/* Field Groups */}
                        {Array.from(fieldGroups.entries()).map(([fieldId, assignments]) => (
                            <View
                                key={fieldId}
                                style={[
                                    styles.fieldCard,
                                    { backgroundColor: colors.cardBackground || '#fff', borderColor: colors.border },
                                ]}
                            >
                                <View style={[styles.fieldHeader, { borderBottomColor: colors.border }]}>
                                    <Text style={[styles.fieldTitle, { color: colors.text }]}>
                                        {assignments[0].fieldName}
                                    </Text>
                                    <Text style={[styles.fieldWorkerCount, { color: colors.textSecondary }]}>
                                        {assignments.length} workers
                                    </Text>
                                </View>
                                {assignments.map((assignment: WorkerAssignment, index: number) => (
                                    <View
                                        key={assignment.workerId}
                                        style={[
                                            styles.workerRow,
                                            { borderBottomColor: colors.border },
                                            index === assignments.length - 1 && styles.lastRow,
                                        ]}
                                    >
                                        <View style={styles.workerInfo}>
                                            <Text style={[styles.workerName, { color: colors.text }]}>{assignment.workerName}</Text>
                                            <Text style={[styles.efficiency, { color: colors.textSecondary }]}>
                                                Predicted: {assignment.predictedEfficiency.toFixed(2)} kg/hour
                                            </Text>
                                        </View>
                                        <View style={styles.badge}>
                                            <Text style={styles.badgeText}>
                                                {assignment.predictedEfficiency >= 5 ? '⭐' : '✓'}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        ))}
                    </View>
                )}

                {!schedule && !loading && (
                    <View style={styles.emptyState}>
                        <Lucide name="calendar" size={64} color="#ccc" />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            No schedule generated yet.{'\n'}Tap the button above to create one!
                        </Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        backgroundColor: '#7cb342',
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    content: { flex: 1, padding: 16 },
    infoCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderLeftWidth: 4,
        borderLeftColor: '#7cb342',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    infoTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
    infoText: { fontSize: 14, lineHeight: 20 },
    generateButton: {
        backgroundColor: '#fbc02d',
        borderRadius: 10,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonIcon: { fontSize: 20, marginRight: 10 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    resultsContainer: { marginBottom: 24 },
    resultsTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
    statsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
    statBox: {
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        flex: 1,
        marginHorizontal: 4,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    statValue: { fontSize: 24, fontWeight: '700', color: '#7cb342', marginBottom: 4 },
    statLabel: { fontSize: 12 },
    fieldCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    fieldHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
    },
    fieldTitle: { fontSize: 16, fontWeight: '700', color: '#1b5e20' },
    fieldWorkerCount: { fontSize: 13 },
    workerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    lastRow: { borderBottomWidth: 0 },
    workerInfo: { flex: 1 },
    workerName: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
    efficiency: { fontSize: 13 },
    badge: {
        backgroundColor: '#e8f5e9',
        borderRadius: 20,
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: { fontSize: 16 },
    emptyState: { alignItems: 'center', paddingVertical: 60 },
    emptyIcon: { fontSize: 64, marginBottom: 16 },
    emptyText: { textAlign: 'center', fontSize: 14, lineHeight: 22 },
});

export default AssignmentGenerationScreen;
