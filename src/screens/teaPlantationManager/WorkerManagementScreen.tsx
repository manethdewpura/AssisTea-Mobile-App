import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector, useThemedAlert } from '../../hooks';
import CustomAlert from '../../components/molecule/CustomAlert';
import { selectAuth, selectTheme } from '../../store/selectors';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TeaPlantationStackParamList } from '../../navigation/TeaPlantationNavigator';
import { workerService } from '../../services';
import { handleFirebaseError, logError } from '../../utils';
import { checkNetworkConnection } from '../../utils/network.util';
import type { Worker } from '../../models/Worker';

type Props = NativeStackScreenProps<
  TeaPlantationStackParamList,
  'WorkerManagement'
>;

const WorkerManagementScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useAppSelector(selectTheme);
  const { userProfile } = useAppSelector(selectAuth);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [filteredWorkers, setFilteredWorkers] = useState<Worker[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const { showAlert, hideAlert, alertState } = useThemedAlert();

  useFocusEffect(
    useCallback(() => {
      loadWorkers();
    }, [userProfile?.plantationId])
  );

  const loadWorkers = async () => {
    if (!userProfile?.plantationId) {
      showAlert('Error', 'Plantation information not found', undefined, 'high');
      return;
    }

    try {
      setLoading(true);
      const fetchedWorkers = await workerService.getWorkersByPlantation(
        userProfile.plantationId
      );
      setWorkers(fetchedWorkers);
      setFilteredWorkers(fetchedWorkers);
    } catch (error: any) {
      const appError = handleFirebaseError(error);
      logError(appError, 'WorkerManagementScreen - LoadWorkers');
      showAlert('Error', appError.userMessage, undefined, 'high');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchText(text);
    const filtered = workers.filter(
      worker =>
        worker.name.toLowerCase().includes(text.toLowerCase()) ||
        worker.workerId.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredWorkers(filtered);
  };

  const handleViewWorker = (workerId: string) => {
    navigation.navigate('WorkerDetails', { workerId });
  };

  const handleEditWorker = (workerId: string) => {
    navigation.navigate('WorkerDetails', { workerId, editMode: true });
  };

  const handleDeleteWorker = (workerId: string, workerName: string) => {
    showAlert(
      'Delete Worker',
      `Are you sure you want to delete ${workerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { isConnected } = await checkNetworkConnection();
              // Optimistically remove from UI immediately
              setWorkers(prev => prev.filter(w => w.id !== workerId));
              setFilteredWorkers(prev => prev.filter(w => w.id !== workerId));
              if (!isConnected) {
                workerService.deleteWorker(workerId).catch((error: any) => {
                  logError(handleFirebaseError(error), 'WorkerManagementScreen - DeleteWorker (offline sync)');
                });
                showAlert('Deleted Locally', 'Worker removed on this device. Changes will sync automatically when you\'re back online.', undefined, 'low');
              } else {
                await workerService.deleteWorker(workerId);
                showAlert('Success', 'Worker deleted successfully', undefined, 'low');
              }
            } catch (error: any) {
              const appError = handleFirebaseError(error);
              logError(appError, 'WorkerManagementScreen - DeleteWorker');
              showAlert('Error', appError.userMessage, undefined, 'high');
            }
          },
        },
      ],
      'high'
    );
  };

  const handleAddWorker = () => {
    navigation.navigate('AddWorker');
  };

  const renderWorkerCard = ({ item }: { item: Worker }) => (
    <TouchableOpacity
      style={[
        styles.workerCard,
        { backgroundColor: colors.cardBackground || '#fff', borderColor: colors.border },
      ]}
      onPress={() => handleViewWorker(item.id)}
    >
      <View style={styles.workerInfo}>
        <Text style={[styles.workerName, { color: colors.text }]}>
          {item.name}
        </Text>
        <Text style={[styles.workerId, { color: colors.textSecondary }]}>
          ID: {item.workerId}
        </Text>
      </View>

      <View style={styles.workerActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditWorker(item.id)}
        >
          <Lucide name="pencil" size={20} color="#F4B124" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteWorker(item.id, item.name)}
        >
          <Lucide name="trash-2" size={20} color="#f44336" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.searchInputRow, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Lucide name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search workers..."
            placeholderTextColor={colors.textSecondary}
            value={searchText}
            onChangeText={handleSearch}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Lucide name="x" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Workers List */}
      <View style={styles.listContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7cb342" />
          </View>
        ) : filteredWorkers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.text }]}>
              {workers.length === 0
                ? 'No workers yet. Add your first worker!'
                : 'No workers found'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredWorkers}
            renderItem={renderWorkerCard}
            keyExtractor={item => item.id}
            scrollEnabled={true}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      {/* Add Worker Button */}
      <View style={[styles.addButtonContainer, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddWorker}
          activeOpacity={0.7}
        >
          <Text style={styles.addButtonPlus}>＋</Text>
          <Text style={styles.addButtonText}>Add New Worker</Text>
        </TouchableOpacity>
      </View>
      <CustomAlert visible={alertState.visible} title={alertState.title} message={alertState.message} buttons={alertState.buttons} onDismiss={hideAlert} severity={alertState.severity} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#7cb342',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  notificationButton: {
    padding: 8,
  },
  notificationIcon: {
    fontSize: 20,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  listContent: {
    paddingBottom: 90,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  workerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  workerInfo: {
    flex: 1,
  },
  workerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  workerId: {
    fontSize: 13,
    color: '#999',
  },
  workerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionIcon: {
    fontSize: 18,
  },
  viewIcon: {
    fontSize: 20,
    color: '#F4B124',
  },
  deleteIcon: {
    fontSize: 20,
    color: '#f44336',
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
});

export default WorkerManagementScreen;
