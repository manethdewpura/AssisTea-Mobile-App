import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector } from '../../hooks';
import { selectAuth, selectTheme } from '../../store/selectors';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TeaPlantationStackParamList } from '../../navigation/TeaPlantationNavigator';
import { workerService } from '../../services';
import { handleFirebaseError, logError } from '../../utils';
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

  useFocusEffect(
    useCallback(() => {
      loadWorkers();
    }, [userProfile?.plantationId])
  );

  const loadWorkers = async () => {
    if (!userProfile?.plantationId) {
      Alert.alert('Error', 'Plantation information not found');
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
      Alert.alert('Error', appError.userMessage);
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

  const handleDeleteWorker = (workerId: string, workerName: string) => {
    Alert.alert(
      'Delete Worker',
      `Are you sure you want to delete ${workerName}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await workerService.deleteWorker(workerId);
              setWorkers(workers.filter(w => w.id !== workerId));
              setFilteredWorkers(filteredWorkers.filter(w => w.id !== workerId));
              Alert.alert('Success', 'Worker deleted successfully');
            } catch (error: any) {
              const appError = handleFirebaseError(error);
              logError(appError, 'WorkerManagementScreen - DeleteWorker');
              Alert.alert('Error', appError.userMessage);
            }
          },
        },
      ]
    );
  };

  const handleAddWorker = () => {
    navigation.navigate('AddWorker');
  };

  const renderWorkerCard = ({ item }: { item: Worker }) => (
    <TouchableOpacity
      style={[
        styles.workerCard,
        { backgroundColor: colors.cardBackground || '#fff' },
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
          onPress={() => handleViewWorker(item.id)}
        >
          <Text style={styles.actionIcon}>👁️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteWorker(item.id, item.name)}
        >
          <Text style={styles.actionIcon}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search workers..."
          placeholderTextColor={colors.textSecondary}
          value={searchText}
          onChangeText={handleSearch}
        />
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
      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAddWorker}
      >
        <Text style={styles.addButtonIcon}>+</Text>
        <Text style={styles.addButtonText}>Add New Worker</Text>
      </TouchableOpacity>
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
    backgroundColor: '#2d5016',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 10,
    color: '#fff',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  listContent: {
    paddingBottom: 20,
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
  addButton: {
    position: 'absolute',
    bottom: 80,
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
});

export default WorkerManagementScreen;
