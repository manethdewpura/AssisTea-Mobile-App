import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useAppSelector } from '../../hooks/redux.hooks';
import { selectAuth } from '../../store/selectors';
import { fieldService } from '../../services/field.service';
import { Field, CreateFieldInput } from '../../models/Field';
import Slider from '@react-native-community/slider';

export default function FieldManagementScreen() {
    const { userProfile } = useAppSelector(selectAuth);
    const [fields, setFields] = useState<Field[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingField, setEditingField] = useState<Field | null>(null);

    // Form state
    const [fieldName, setFieldName] = useState('');
    const [slope, setSlope] = useState(15);
    const [maxWorkers, setMaxWorkers] = useState(5);
    const [location, setLocation] = useState('');
    const [saving, setSaving] = useState(false);

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
            Alert.alert('Error', 'Failed to load fields');
        } finally {
            setLoading(false);
        }
    };

    const openAddModal = () => {
        setEditingField(null);
        setFieldName('');
        setSlope(15);
        setMaxWorkers(5);
        setLocation('');
        setModalVisible(true);
    };

    const openEditModal = (field: Field) => {
        setEditingField(field);
        setFieldName(field.name);
        setSlope(field.slope);
        setMaxWorkers(field.maxWorkers);
        setLocation(field.location || '');
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!userProfile?.plantationId) {
            Alert.alert('Error', 'User profile not found');
            return;
        }

        if (!fieldName.trim()) {
            Alert.alert('Error', 'Please enter a field name');
            return;
        }

        if (slope < 5 || slope > 25) {
            Alert.alert('Error', 'Slope must be between 5° and 25°');
            return;
        }

        if (maxWorkers < 1 || maxWorkers > 20) {
            Alert.alert('Error', 'Max workers must be between 1 and 20');
            return;
        }

        try {
            setSaving(true);

            const fieldData: CreateFieldInput = {
                name: fieldName.trim(),
                slope,
                maxWorkers,
                location: location.trim() || undefined,
            };

            if (editingField) {
                // Update existing field
                await fieldService.updateField(editingField.id, fieldData);
                Alert.alert('Success', 'Field updated successfully');
            } else {
                // Create new field
                await fieldService.createField(userProfile.plantationId, fieldData);
                Alert.alert('Success', 'Field created successfully');
            }

            setModalVisible(false);
            loadFields();
        } catch (error) {
            console.error('Error saving field:', error);
            Alert.alert('Error', 'Failed to save field');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (field: Field) => {
        Alert.alert(
            'Delete Field',
            `Are you sure you want to delete "${field.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await fieldService.deleteField(field.id);
                            Alert.alert('Success', 'Field deleted successfully');
                            loadFields();
                        } catch (error) {
                            console.error('Error deleting field:', error);
                            Alert.alert('Error', 'Failed to delete field');
                        }
                    },
                },
            ]
        );
    };

    const renderFieldItem = ({ item }: { item: Field }) => (
        <View style={styles.fieldCard}>
            <View style={styles.fieldHeader}>
                <Text style={styles.fieldName}>{item.name}</Text>
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
                    <Text style={styles.detailLabel}>Slope:</Text>
                    <Text style={styles.detailValue}>{item.slope}°</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Max Workers:</Text>
                    <Text style={styles.detailValue}>{item.maxWorkers}</Text>
                </View>
                {item.location && (
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Location:</Text>
                        <Text style={styles.detailValue}>{item.location}</Text>
                    </View>
                )}
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.loadingText}>Loading fields...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Fields List */}
            {fields.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No fields configured</Text>
                    <Text style={styles.emptySubtext}>
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

            {/* Add Field Button - matching worker button style */}
            <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
                <Text style={styles.addButtonIcon}>+</Text>
                <Text style={styles.addButtonText}>Add New Field</Text>
            </TouchableOpacity>

            {/* Add/Edit Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>
                            {editingField ? 'Edit Field' : 'Add New Field'}
                        </Text>

                        {/* Field Name */}
                        <Text style={styles.inputLabel}>Field Name *</Text>
                        <TextInput
                            style={styles.input}
                            value={fieldName}
                            onChangeText={setFieldName}
                            placeholder="e.g., Field A, Upper Valley"
                            placeholderTextColor="#999"
                        />

                        {/* Slope Slider */}
                        <Text style={styles.inputLabel}>Slope: {slope}°</Text>
                        <Slider
                            style={styles.slider}
                            minimumValue={5}
                            maximumValue={25}
                            step={1}
                            value={slope}
                            onValueChange={setSlope}
                            minimumTrackTintColor="#4CAF50"
                            maximumTrackTintColor="#ddd"
                        />
                        <View style={styles.sliderLabels}>
                            <Text style={styles.sliderLabel}>5° (Easy)</Text>
                            <Text style={styles.sliderLabel}>25° (Steep)</Text>
                        </View>

                        {/* Max Workers */}
                        <Text style={styles.inputLabel}>Maximum Workers *</Text>
                        <TextInput
                            style={styles.input}
                            value={maxWorkers.toString()}
                            onChangeText={text => setMaxWorkers(parseInt(text) || 1)}
                            placeholder="e.g., 5"
                            keyboardType="numeric"
                            placeholderTextColor="#999"
                        />

                        {/* Location (Optional) */}
                        <Text style={styles.inputLabel}>Location (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            value={location}
                            onChangeText={setLocation}
                            placeholder="e.g., North section near well"
                            placeholderTextColor="#999"
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
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.saveButtonText}>
                                        {editingField ? 'Update' : 'Save'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#666',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    addButton: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        backgroundColor: '#7cb342',
        borderRadius: 25,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    addButtonIcon: {
        fontSize: 20,
        color: '#fff',
        fontWeight: 'bold',
        marginRight: 6,
    },
    addButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
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
        color: '#666',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
    listContainer: {
        padding: 16,
    },
    fieldCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
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
        color: '#333',
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
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    deleteButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    deleteButtonText: {
        color: '#fff',
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
        color: '#666',
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '90%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
        marginTop: 12,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#333',
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
        color: '#666',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 24,
    },
    cancelButton: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: '#f5f5f5',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    saveButton: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: '#fbc02d',
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});
