import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useAppSelector } from '../../hooks/redux.hooks';
import { useThemedAlert } from '../../hooks/useThemedAlert';
import { selectAuth, selectTheme } from '../../store/selectors';
import { fieldService } from '../../services/field.service';
import { Field, CreateFieldInput } from '../../models/Field';
import { checkNetworkConnection } from '../../utils/network.util';
import { handleFirebaseError, logError } from '../../utils';
import Slider from '@react-native-community/slider';
import CustomAlert from '../../components/molecule/CustomAlert';

export default function FieldManagementScreen() {
    const { userProfile } = useAppSelector(selectAuth);
    const { colors } = useAppSelector(selectTheme);
    const [fields, setFields] = useState<Field[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingField, setEditingField] = useState<Field | null>(null);

    // Form state
    const [fieldName, setFieldName] = useState('');
    const [slope, setSlope] = useState(45);
    const [maxWorkers, setMaxWorkers] = useState(5);

    const [saving, setSaving] = useState(false);
    const { showAlert, hideAlert, alertState } = useThemedAlert();

    // Load fields on mount
    useEffect(() => {
        loadFields();
    }, []);

    const loadFields = async () => {
        if (!userProfile?.plantationId) {
            return;
        }

        try {
            setLoading(true);
            const fetchedFields = await fieldService.getFieldsByPlantation(userProfile.plantationId);
            setFields(fetchedFields);
        } catch (error) {
            console.error('Error loading fields:', error);
            showAlert('Error', 'Failed to load fields', undefined, 'high');
        } finally {
            setLoading(false);
        }
    };

    const openAddModal = () => {
        setEditingField(null);
        setFieldName('');
        setSlope(45);
        setMaxWorkers(5);

        setModalVisible(true);
    };

    const openEditModal = (field: Field) => {
        setEditingField(field);
        setFieldName(field.name);
        setSlope(field.slope);
        setMaxWorkers(field.maxWorkers);

        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!userProfile?.plantationId) {
            showAlert('Error', 'User profile not found', undefined, 'high');
            return;
        }

        if (!fieldName.trim()) {
            showAlert('Error', 'Please enter a field name', undefined, 'low');
            return;
        }

        if (slope < 5 || slope > 70) {
            showAlert('Error', 'Slope must be between 5° and 70°', undefined, 'low');
            return;
        }

        if (maxWorkers < 1 || maxWorkers > 20) {
            showAlert('Error', 'Max workers must be between 1 and 20', undefined, 'low');
            return;
        }

        try {
            setSaving(true);
            const { isConnected } = await checkNetworkConnection();

            const fieldData: CreateFieldInput = {
                name: fieldName.trim(),
                slope,
                maxWorkers,
            };

            if (!isConnected) {
                if (editingField) {
                    fieldService.updateField(editingField.id, fieldData).catch((err: any) => {
                        logError(handleFirebaseError(err), 'FieldManagementScreen - UpdateField (offline sync)');
                    });
                    // Optimistically update local list
                    setFields(prev => prev.map(f =>
                        f.id === editingField.id ? { ...f, ...fieldData } : f
                    ));
                    showAlert('Saved Locally', 'Field updated on this device. Changes will sync when you\'re back online.', undefined, 'low');
                } else {
                    fieldService.createField(userProfile.plantationId, fieldData).catch((err: any) => {
                        logError(handleFirebaseError(err), 'FieldManagementScreen - CreateField (offline sync)');
                    });
                    showAlert('Saved Locally', 'Field added on this device. Changes will sync when you\'re back online.', undefined, 'low');
                }
                setModalVisible(false);
                loadFields();
            } else {
                if (editingField) {
                    await fieldService.updateField(editingField.id, fieldData);
                    showAlert('Success', 'Field updated successfully', undefined, 'low');
                } else {
                    await fieldService.createField(userProfile.plantationId, fieldData);
                    showAlert('Success', 'Field created successfully', undefined, 'low');
                }
                setModalVisible(false);
                loadFields();
            }
        } catch (error: any) {
            const appError = handleFirebaseError(error);
            logError(appError, 'FieldManagementScreen - SaveField');
            showAlert('Error', appError.userMessage, undefined, 'high');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (field: Field) => {
        showAlert(
            'Delete Field',
            `Are you sure you want to delete "${field.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { isConnected } = await checkNetworkConnection();
                            if (!isConnected) {
                                // Optimistically remove from UI while offline; backend delete will sync later
                                setFields(prev => prev.filter(f => f.id !== field.id));
                                fieldService.deleteField(field.id).catch((err: any) => {
                                    logError(handleFirebaseError(err), 'FieldManagementScreen - DeleteField (offline sync)');
                                });
                                showAlert('Deleted Locally', 'Field removed on this device. Changes will sync when you\'re back online.', undefined, 'low');
                            } else {
                                // When online, only update UI after successful backend deletion
                                await fieldService.deleteField(field.id);
                                setFields(prev => prev.filter(f => f.id !== field.id));
                                showAlert('Success', 'Field deleted successfully', undefined, 'low');
                            }
                        } catch (error: any) {
                            const appError = handleFirebaseError(error);
                            logError(appError, 'FieldManagementScreen - DeleteField');
                            showAlert('Error', appError.userMessage, undefined, 'high');
                        }
                    },
                },
            ],
            'high'
        );
    };

    const renderFieldItem = ({ item }: { item: Field }) => (
        <View style={[styles.fieldCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.fieldHeader}>
                <Text style={[styles.fieldName, { color: colors.text }]}>{item.name}</Text>
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => openEditModal(item)}
                    >
                        <Lucide name="pencil" size={18} color="#F4B124" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDelete(item)}
                    >
                        <Lucide name="trash-2" size={18} color="#f44336" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.fieldDetails}>
                <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Slope:</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{item.slope}°</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Max Workers:</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{item.maxWorkers}</Text>
                </View>
                {item.location && (
                    <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Location:</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{item.location}</Text>
                    </View>
                )}
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color="#73AB2E" />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading fields...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Fields List */}
            {fields.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No fields configured</Text>
                    <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                        Add fields to start generating assignments
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={fields}
                    renderItem={renderFieldItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContainer}
                />
            )}

            {/* Add Field Button */}
            <View style={[styles.addButtonContainer, { borderTopColor: colors.border }]}>
                <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
                    <Text style={styles.addButtonPlus}>＋</Text>
                    <Text style={styles.addButtonText}>Add New Field</Text>
                </TouchableOpacity>
            </View>

            {/* Add/Edit Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>
                            {editingField ? 'Edit Field' : 'Add New Field'}
                        </Text>

                        {/* Field Name */}
                        <Text style={[styles.inputLabel, { color: colors.text }]}>Field Name *</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                            value={fieldName}
                            onChangeText={setFieldName}
                            placeholder="e.g., Field A, Upper Valley"
                            placeholderTextColor={colors.textSecondary}
                        />

                        {/* Slope Slider */}
                        <Text style={[styles.inputLabel, { color: colors.text }]}>Slope: {slope}°</Text>
                        <Slider
                            style={styles.slider}
                            minimumValue={5}
                            maximumValue={70}
                            step={1}
                            value={slope}
                            onValueChange={setSlope}
                            minimumTrackTintColor="#73AB2E"
                            maximumTrackTintColor={colors.border}
                        />
                        <View style={styles.sliderLabels}>
                            <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>5° (Gentle)</Text>
                            <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>70° (Very Steep)</Text>
                        </View>

                        {/* Max Workers */}
                        <Text style={[styles.inputLabel, { color: colors.text }]}>Maximum Workers *</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                            value={maxWorkers.toString()}
                            onChangeText={text => setMaxWorkers(parseInt(text) || 1)}
                            placeholder="e.g., 5"
                            keyboardType="numeric"
                            placeholderTextColor={colors.textSecondary}
                        />

                        {/* Buttons */}
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setModalVisible(false)}
                                disabled={saving}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                                onPress={handleSave}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#F4B124" />
                                ) : (
                                    <Text style={styles.saveButtonText}>
                                        ✓ {editingField ? 'Update' : 'Save'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            <CustomAlert visible={alertState.visible} title={alertState.title} message={alertState.message} buttons={alertState.buttons} onDismiss={hideAlert} severity={alertState.severity} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    addButtonContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        alignItems: 'flex-end',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1.5,
        borderColor: '#73AB2E',
        backgroundColor: 'transparent',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    addButtonPlus: {
        color: '#73AB2E',
        fontWeight: '700',
        fontSize: 15,
        lineHeight: 17,
    },
    addButtonText: {
        color: '#73AB2E',
        fontSize: 14,
        fontWeight: '700',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        textAlign: 'center',
    },
    listContainer: {
        padding: 16,
        paddingBottom: 24,
    },
    fieldCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
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
    },
    fieldName: {
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
    },
    editButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    editButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    deleteButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    deleteButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    fieldDetails: {
        gap: 8,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    detailLabel: {
        fontSize: 14,
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        borderRadius: 16,
        padding: 24,
        width: '90%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        marginTop: 12,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 15,
    },
    slider: {
        width: '100%',
        height: 40,
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: -8,
    },
    sliderLabel: {
        fontSize: 12,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 24,
        alignItems: 'center',
    },
    cancelButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#73AB2E',
        backgroundColor: 'transparent',
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#73AB2E',
    },
    saveButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#F4B124',
        backgroundColor: 'transparent',
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#F4B124',
    },
});
