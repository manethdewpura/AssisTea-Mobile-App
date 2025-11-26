import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useAppSelector } from '../../hooks';
import { selectTheme } from '../../store/selectors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TeaPlantationStackParamList } from '../../navigation/TeaPlantationNavigator';

type Props = NativeStackScreenProps<
  TeaPlantationStackParamList,
  'ViewLatestSchedule'
>;

interface ScheduleAssignment {
  id: string;
  workerName: string;
  workerId: string;
  fieldArea: string;
  slope: string;
}

// Mock schedule data
const MOCK_SCHEDULE: ScheduleAssignment[] = [
  { id: '1', workerName: 'K.Perera', workerId: 'T-001', fieldArea: 'Field 2', slope: 'Slope 1' },
  { id: '2', workerName: 'K.Perera', workerId: 'T-001', fieldArea: 'Field 2', slope: 'Slope 1' },
  { id: '3', workerName: 'K.Perera', workerId: 'T-001', fieldArea: 'Field 2', slope: 'Slope 1' },
  { id: '4', workerName: 'K.Perera', workerId: 'T-001', fieldArea: 'Field 2', slope: 'Slope 1' },
  { id: '5', workerName: 'K.Perera', workerId: 'T-001', fieldArea: 'Field 2', slope: 'Slope 1' },
];

const ViewLatestScheduleScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useAppSelector(selectTheme);
  const [filterType, setFilterType] = useState<'worker' | 'area'>('worker');

  const renderScheduleCard = ({ item }: { item: ScheduleAssignment }) => (
    <View
      style={[
        styles.scheduleCard,
        { backgroundColor: colors.cardBackground || '#fff' },
      ]}
    >
      <View style={styles.workerSection}>
        <Text style={[styles.workerName, { color: colors.text }]}>
          {item.workerName}
        </Text>
        <Text style={[styles.workerId, { color: colors.textSecondary }]}>
          ID: {item.workerId}
        </Text>
      </View>

      <View style={styles.arrow}>
        <Text style={styles.arrowIcon}>→</Text>
      </View>

      <View style={styles.assignmentSection}>
        <View style={styles.fieldBadge}>
          <Text style={styles.fieldText}>{item.fieldArea}</Text>
        </View>
        <View style={styles.slopeBadge}>
          <Text style={styles.slopeText}>{item.slope}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AssisTea</Text>
        <TouchableOpacity style={styles.notificationButton}>
          <Text style={styles.notificationIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Green Section */}
      <View style={styles.greenSection} />

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View
          style={[
            styles.scheduleCard,
            styles.headerCard,
            { backgroundColor: colors.cardBackground || '#fff' },
          ]}
        >
          <View style={styles.dateSection}>
            <Text style={styles.calendarIcon}>📅</Text>
            <Text style={[styles.dateText, { color: colors.text }]}>
              Schedule for 19-10-2025
            </Text>
          </View>
        </View>

        {/* Filter Section */}
        <TouchableOpacity
          style={[
            styles.filterBox,
            { backgroundColor: colors.cardBackground || '#fff' },
          ]}
          onPress={() =>
            setFilterType(filterType === 'worker' ? 'area' : 'worker')
          }
        >
          <Text style={styles.filterIcon}>🔽</Text>
          <Text style={[styles.filterText, { color: colors.text }]}>
            {filterType === 'worker' ? 'Worker Wise' : 'Area Wise'}
          </Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>

        {/* Schedule List */}
        <FlatList
          data={MOCK_SCHEDULE}
          renderItem={renderScheduleCard}
          keyExtractor={item => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.listContent}
        />
      </ScrollView>
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
  menuButton: {
    padding: 8,
  },
  menuIcon: {
    fontSize: 24,
    color: '#fff',
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
  greenSection: {
    height: 80,
    backgroundColor: '#2d5016',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerCard: {
    marginTop: 0,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scheduleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dateSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  filterBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  filterText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
  },
  listContent: {
    paddingBottom: 20,
  },
  workerSection: {
    flex: 1,
  },
  workerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  workerId: {
    fontSize: 12,
    color: '#999',
  },
  arrow: {
    marginHorizontal: 12,
  },
  arrowIcon: {
    fontSize: 24,
    color: '#d32f2f',
    fontWeight: 'bold',
  },
  assignmentSection: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  fieldBadge: {
    backgroundColor: '#1b5e20',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  fieldText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  slopeBadge: {
    backgroundColor: '#c8e6c9',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  slopeText: {
    color: '#2e7d32',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default ViewLatestScheduleScreen;
