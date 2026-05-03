import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Switch,
    Platform,
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
import { Worker } from '../../models/Worker';
import { useAppSelector, useThemedAlert } from '../../hooks';
import { selectAuth, selectTheme } from '../../store/selectors';
import CustomAlert from '../../components/molecule/CustomAlert';
import { generatePDF } from 'react-native-html-to-pdf';
import { saveDocuments } from '@react-native-documents/picker';

import { buildScheduleHTML } from '../../utils/schedulePdfTemplate.util';

/** Stable file:// URI for Android ContentResolver (avoids double scheme, normalizes path). */
function pdfFilePathToSourceUri(filePath: string): string {
    const trimmed = filePath.trim();
    if (trimmed.startsWith('file://')) {
        return trimmed;
    }
    return `file://${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

type Props = NativeStackScreenProps<TeaPlantationStackParamList, 'AssignmentGeneration'>;

const AssignmentGenerationScreen: React.FC<Props> = ({ navigation }) => {
    const { colors } = useAppSelector(selectTheme);
    const { userProfile } = useAppSelector(selectAuth);
    const [loading, setLoading] = useState(false);
    const [schedule, setSchedule] = useState<AssignmentSchedule | null>(null);
    const { showAlert, hideAlert, alertState } = useThemedAlert();

    // ── Availability state (local only — resets each session, never persisted) ──
    const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
    const [workersLoading, setWorkersLoading] = useState(false);
    const [absentWorkerIds, setAbsentWorkerIds] = useState<Set<string>>(new Set());

    // PDF download state
    const [downloadingPDF, setDownloadingPDF] = useState(false);

    useEffect(() => { loadWorkers(); }, [userProfile?.plantationId]);

    const loadWorkers = async () => {
        if (!userProfile?.plantationId) return;
        setWorkersLoading(true);
        try {
            const firebaseWorkers = await workerService.getWorkersByPlantation(userProfile.plantationId);
            await workerSQLiteService.insertOrReplaceBatch(firebaseWorkers);
            setAllWorkers(firebaseWorkers.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (firebaseError) {
            try {
                const local = await workerSQLiteService.getAllWorkers(userProfile.plantationId);
                setAllWorkers(local.sort((a, b) => a.name.localeCompare(b.name)));
            } catch (localError) {
                console.error('[loadWorkers] SQLite fallback also failed:', localError);
            }
        } finally {
            setWorkersLoading(false);
        }
    };

    const toggleWorkerAvailability = (workerId: string, isAvailable: boolean) => {
        setAbsentWorkerIds(prev => {
            const next = new Set(prev);
            if (isAvailable) next.delete(workerId);
            else next.add(workerId);
            return next;
        });
    };

    const handleGenerateSchedule = async () => {
        if (!userProfile?.plantationId) {
            showAlert('Error', 'No plantation ID found', undefined, 'high');
            return;
        }

        const availableCount = allWorkers.length - absentWorkerIds.size;
        if (allWorkers.length > 0 && availableCount === 0) {
            showAlert('No Available Workers', 'All workers are marked absent. Please mark at least one worker as available.', undefined, 'high');
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
            } catch (err) {
            }

            // 2. Load fields from SQLite (offline-first)
            await unifiedFieldService.pullFromFirebase(userProfile.plantationId);
            const fields = await unifiedFieldService.getFields(userProfile.plantationId);

            if (fields.length === 0) {
                showAlert(
                    'No Fields Configured',
                    'Please add fields before generating assignments.',
                    [
                        {
                            text: 'Add Fields Now',
                            onPress: () => navigation.navigate('FieldManagement'),
                        },
                        { text: 'Cancel', style: 'cancel' },
                    ],
                    'medium'
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

            // Use local date (not UTC) to avoid off-by-one errors in timezones ahead of UTC (e.g. UTC+5:30)
            const nowLocal = new Date();
            const today = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;

            // 3. Generate assignments (ML runs offline!)
            // Pass absent worker IDs — service filters them before ML processing.
            const generatedSchedule = await assignmentService.generateAssignments(
                userProfile.plantationId,
                today,
                fieldData,
                Array.from(absentWorkerIds)
            );

            setSchedule(generatedSchedule);

            // 4. Save to SQLite first (offline-safe), then fire-and-forget to Firebase
            try {
                await unifiedScheduleService.saveSchedule({
                    plantationId: userProfile.plantationId,
                    date: today,
                    totalWorkers: generatedSchedule.totalWorkers,
                    totalFields: generatedSchedule.totalFields,
                    averageEfficiency: generatedSchedule.averagePredictedEfficiency,
                    assignments: generatedSchedule.assignments,
                });
            } catch (saveError) {
                console.error('❌ [AssignmentGeneration] Failed to save schedule:', saveError);
            }

            showAlert(
                'Success!',
                `Generated and saved ${generatedSchedule.assignments.length} assignments with average efficiency ${generatedSchedule.averagePredictedEfficiency.toFixed(2)} kg/hour`,
                undefined,
                'low'
            );
        } catch (error) {
            console.error('Assignment generation error:', error);
            showAlert('Error', `Failed to generate schedule: ${error}`, undefined, 'high');
        } finally {
            setLoading(false);
        }
    };

    const groupByField = () => {
        if (!schedule) return new Map();
        return assignmentService.getAssignmentsByField(schedule);
    };

    const fieldGroups = groupByField();

    const handleDownloadSchedule = async () => {
        if (!schedule) return;
        const baseName = `AssisTea_Schedule_${schedule.date.replace(/-/g, '')}`;
        try {
            setDownloadingPDF(true);
            const html = buildScheduleHTML(schedule, fieldGroups);
            let result: Awaited<ReturnType<typeof generatePDF>>;
            try {
                result = await generatePDF({
                    html,
                    fileName: baseName,
                    directory: 'Downloads',
                    width: 595,
                    height: 842,
                });
            } catch (pdfErr: unknown) {
                const msg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
                console.error('[PDF] react-native-html-to-pdf failed:', pdfErr);
                throw new Error(
                    `Could not build PDF (WebView / print step). ${msg}\n\n` +
                        'If this only happens on release builds, check logcat tag HtmlToPdf.',
                );
            }

            if (!result.filePath) {
                throw new Error('PDF file path was not returned.');
            }

            const sourceUri =
                Platform.OS === 'android' ? pdfFilePathToSourceUri(result.filePath) : result.filePath;

            try {
                const [saved] = await saveDocuments({
                    sourceUris: [sourceUri],
                    mimeType: 'application/pdf',
                    fileName: `${baseName}.pdf`,
                });
                if (saved.error) {
                    throw new Error(saved.error);
                }
                const savedName = saved.name ?? 'AssisTea_Schedule.pdf';
                showAlert(
                    '📄 Schedule Saved!',
                    `Your schedule has been saved as:\n\n${savedName}`,
                    [{ text: 'OK', style: 'default' }],
                    'low',
                );
            } catch (saveErr: unknown) {
                const msg = saveErr instanceof Error ? saveErr.message : String(saveErr);
                console.error('[PDF] saveDocuments failed:', saveErr);
                throw new Error(
                    `PDF was created but could not run Save As / copy to your chosen location. ${msg}`,
                );
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[PDF] Schedule download failed:', err);
            showAlert(
                'PDF Error',
                message || 'Could not generate the PDF. Please try again.',
                undefined,
                'high',
            );
        } finally {
            setDownloadingPDF(false);
        }
    };

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

                {/* Today's Workforce — Availability Toggles */}
                <View style={[styles.workforceCard, { backgroundColor: colors.cardBackground || '#fff', borderColor: colors.border }]}>
                    <View style={styles.workforceHeader}>
                        <Text style={[styles.workforceTitle, { color: colors.text }]}>👷 Today's Workforce</Text>
                        <View style={styles.wfBadgeRow}>
                            <View style={styles.wfBadgeAvail}>
                                <Text style={styles.wfBadgeAvailText}>✅ {allWorkers.length - absentWorkerIds.size} available</Text>
                            </View>
                            {absentWorkerIds.size > 0 && (
                                <View style={styles.wfBadgeAbsent}>
                                    <Text style={styles.wfBadgeAbsentText}>❌ {absentWorkerIds.size} absent</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {workersLoading ? (
                        <ActivityIndicator color="#7cb342" style={{ marginVertical: 12 }} />
                    ) : allWorkers.length === 0 ? (
                        <Text style={[styles.wfEmpty, { color: colors.textSecondary }]}>
                            No workers found. Add workers first.
                        </Text>
                    ) : (
                        allWorkers.map((worker, index) => {
                            const isAvailable = !absentWorkerIds.has(worker.id);
                            return (
                                <View
                                    key={worker.id}
                                    style={[
                                        styles.wfRow,
                                        { borderBottomColor: colors.border },
                                        index === allWorkers.length - 1 && { borderBottomWidth: 0 },
                                    ]}
                                >
                                    <View style={styles.wfWorkerInfo}>
                                        <Text style={[styles.wfWorkerName, { color: isAvailable ? colors.text : colors.textSecondary }]}>
                                            {worker.name}
                                        </Text>
                                        <Text style={[styles.wfWorkerStatus, { color: isAvailable ? '#7cb342' : '#f44336' }]}>
                                            {isAvailable ? 'Available' : 'Absent today'}
                                        </Text>
                                    </View>
                                    <Switch
                                        value={isAvailable}
                                        onValueChange={(val) => toggleWorkerAvailability(worker.id, val)}
                                        trackColor={{ false: '#f44336', true: '#7cb342' }}
                                        thumbColor="#fff"
                                    />
                                </View>
                            );
                        })
                    )}
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

                        {/* Download Schedule Button */}
                        <TouchableOpacity
                            style={[styles.downloadButton, downloadingPDF && styles.buttonDisabled]}
                            onPress={handleDownloadSchedule}
                            disabled={downloadingPDF}
                        >
                            {downloadingPDF ? (
                                <>
                                    <ActivityIndicator color="#2d5016" size="small" style={{ marginRight: 8 }} />
                                    <Text style={styles.downloadButtonText}>Generating PDF...</Text>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.downloadButtonIcon}>📅</Text>
                                    <Text style={styles.downloadButtonText}>Download Schedule as PDF</Text>
                                </>
                            )}
                        </TouchableOpacity>
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
            <CustomAlert visible={alertState.visible} title={alertState.title} message={alertState.message} buttons={alertState.buttons} onDismiss={hideAlert} severity={alertState.severity} />
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

    workforceCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    workforceHeader: { marginBottom: 12 },
    workforceTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
    wfBadgeRow: { flexDirection: 'row', gap: 8 },
    wfBadgeAvail: { backgroundColor: '#e8f5e9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    wfBadgeAvailText: { fontSize: 12, color: '#2e7d32', fontWeight: '600' },
    wfBadgeAbsent: { backgroundColor: '#ffebee', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    wfBadgeAbsentText: { fontSize: 12, color: '#c62828', fontWeight: '600' },
    wfEmpty: { fontSize: 13, textAlign: 'center', paddingVertical: 12 },
    wfRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    wfWorkerInfo: { flex: 1 },
    wfWorkerName: { fontSize: 14, fontWeight: '600' },
    wfWorkerStatus: { fontSize: 12, marginTop: 2 },

    downloadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#2d5016',
        borderRadius: 10,
        paddingVertical: 14,
        marginTop: 8,
        marginBottom: 8,
        backgroundColor: 'transparent',
    },
    downloadButtonIcon: { fontSize: 18, marginRight: 8 },
    downloadButtonText: { color: '#2d5016', fontSize: 15, fontWeight: '700' },
});

export default AssignmentGenerationScreen;
