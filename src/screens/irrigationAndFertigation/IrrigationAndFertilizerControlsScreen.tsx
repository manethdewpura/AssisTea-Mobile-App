import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useAppSelector } from '../../hooks';
import { selectTheme } from '../../store/selectors';
import ScreenHeader from '../../components/molecule/ScreenHeader';

interface IrrigationAndFertilizerControlsScreenProps {
  onBackPress?: () => void;
}

const IrrigationAndFertilizerControlsScreen: React.FC<IrrigationAndFertilizerControlsScreenProps> = ({
  onBackPress,
}) => {
  const { colors } = useAppSelector(selectTheme);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      {/* Header */}
      <ScreenHeader title="Irrigation & Fertilizer Controls" onBackPress={onBackPress} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Irrigation Controls
          </Text>
          <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
            Manage and control your irrigation systems
          </Text>
          
          <View style={styles.placeholderContainer}>
            <Lucide name="droplet" size={64} color={colors.textSecondary} />
            <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
              Irrigation controls will be available here
            </Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Fertilizer Controls
          </Text>
          <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
            Manage and control fertilizer applications
          </Text>
          
          <View style={styles.placeholderContainer}>
            <Lucide name="leaf" size={64} color={colors.textSecondary} />
            <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
              Fertilizer controls will be available here
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  placeholderText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
});

export default IrrigationAndFertilizerControlsScreen;

