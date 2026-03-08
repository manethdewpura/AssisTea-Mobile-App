import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  BackHandler,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSelector } from '../../hooks';
import { selectAuth, selectTheme } from '../../store/selectors';
import { teaPlantationService } from '../../services';
import type { TeaPlantation } from '../../common/interfaces';
import type { TeaPlantationStackParamList } from '../../navigation/TeaPlantationNavigator';

interface TeaPlantationManagerScreenProps {
  onNavigateToWeather?: () => void;
}

const TeaPlantationManagerScreen: React.FC<TeaPlantationManagerScreenProps> = ({
  onNavigateToWeather,
}) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<TeaPlantationStackParamList>>();
  const { userProfile } = useAppSelector(selectAuth);
  const { colors } = useAppSelector(selectTheme);
  const [plantation, setPlantation] = useState<TeaPlantation | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPlantationData = useCallback(async () => {
    if (!userProfile?.plantationId) {
      setLoading(false);
      return;
    }

    try {
      const plantationData = await teaPlantationService.getTeaPlantation(
        userProfile.plantationId,
      );
      setPlantation(plantationData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load plantation data');
    } finally {
      setLoading(false);
    }
  }, [userProfile?.plantationId]);

  useEffect(() => {
    loadPlantationData();
  }, [loadPlantationData]);

  useEffect(() => {
    const backAction = () => false;
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );
    return () => backHandler.remove();
  }, []);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading plantation data...
        </Text>
      </View>
    );
  }

  const actionCards = [
    {
      icon: '📝',
      label: 'Enter Daily Data',
      sub: 'Add today\'s records',
      color: '#73AB2E',
      onPress: () => navigation.navigate('DailyDataEntry'),
    },
    {
      icon: '📊',
      label: 'View Daily Data',
      sub: 'Browse past records',
      color: '#73AB2E',
      onPress: () => navigation.navigate('DailyDataView'),
    },
    {
      icon: '👥',
      label: 'Manage Workers',
      sub: 'Add, edit workers',
      color: '#F4B124',
      onPress: () => navigation.navigate('WorkerManagement'),
    },
    {
      icon: '🌱',
      label: 'Manage Fields',
      sub: 'View & edit fields',
      color: '#F4B124',
      onPress: () => navigation.navigate('FieldManagement'),
    },
    {
      icon: '📅',
      label: 'Generate Schedule',
      sub: 'Auto-assign labour',
      color: '#0E401D',
      onPress: () => navigation.navigate('AssignmentGeneration'),
    },
    {
      icon: '📋',
      label: 'View Schedule',
      sub: 'See latest schedule',
      color: '#0E401D',
      onPress: () => navigation.navigate('ViewLatestSchedule'),
    },
  ];

  return (
    <View style={styles.fullContainer}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header */}
        <View style={styles.heroHeader}>
          <View style={styles.heroOverlay} />
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>TEA PLANTATION</Text>
              <Text style={styles.heroTitle}>
                {plantation ? plantation.name : 'My Dashboard'}
              </Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>🌿</Text>
            </View>
          </View>
          <Text style={styles.heroSubtitle}>
            Welcome back, {userProfile?.email?.split('@')[0] || 'Manager'}
          </Text>

          {plantation && (
            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Text style={styles.statPillValue}>{plantation.area}</Text>
                <Text style={styles.statPillLabel}>ACRES</Text>
              </View>
              <View style={styles.statPillDivider} />
              <View style={styles.statPill}>
                <Text style={styles.statPillValue}>📍</Text>
                <Text style={styles.statPillLabel}>{plantation.location}</Text>
              </View>
            </View>
          )}
        </View>

        {/* No plantation assigned */}
        {!plantation && !loading && (
          <View style={styles.sectionContainer}>
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.emptyIcon}>🌿</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Plantation Assigned</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                You haven't been assigned to any tea plantation yet. Please contact your administrator.
              </Text>
            </View>
          </View>
        )}

        {/* Action Cards Grid */}
        {plantation && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionTitleGroup}>
              <View style={styles.sectionAccent} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Quick Actions
              </Text>
            </View>

            <View style={styles.cardGrid}>
              {actionCards.map((card, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.actionCard,
                    { backgroundColor: colors.cardBackground, borderColor: colors.border },
                  ]}
                  onPress={card.onPress}
                  activeOpacity={0.8}
                >
                  <View style={[styles.actionIconContainer, { backgroundColor: card.color + '22' }]}>
                    <Text style={styles.actionIcon}>{card.icon}</Text>
                  </View>
                  <Text style={[styles.actionLabel, { color: colors.text }]}>{card.label}</Text>
                  <Text style={[styles.actionSub, { color: colors.textSecondary }]}>{card.sub}</Text>
                  <Text style={[styles.actionArrow, { color: card.color }]}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Weather Card */}
        {onNavigateToWeather && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionTitleGroup}>
              <View style={[styles.sectionAccent, styles.sectionAccentAmber]} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Weather Forecast
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.weatherCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
              onPress={onNavigateToWeather}
              activeOpacity={0.8}
            >
              <View style={styles.weatherCardInner}>
                <View style={styles.weatherIconContainer}>
                  <Text style={styles.weatherCardIcon}>🌤️</Text>
                </View>
                <View>
                  <Text style={[styles.weatherCardTitle, { color: colors.text }]}>
                    View Weather Forecast
                  </Text>
                  <Text style={[styles.weatherCardSub, { color: colors.textSecondary }]}>
                    Tap to see current forecast
                  </Text>
                </View>
              </View>
              <Text style={styles.weatherCardArrow}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
  },

  /* Hero Header */
  heroHeader: {
    backgroundColor: '#0E401D',
    paddingTop: 52,
    paddingBottom: 28,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(115, 171, 46, 0.12)',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#73AB2E',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  heroBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(115,171,46,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(115,171,46,0.4)',
  },
  heroBadgeText: {
    fontSize: 22,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 20,
  },

  /* Stats Row */
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  statPill: {
    flex: 1,
    alignItems: 'center',
  },
  statPillValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  statPillLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statPillDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 4,
  },

  /* Section */
  sectionContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionAccent: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: '#73AB2E',
  },
  sectionAccentAmber: {
    backgroundColor: '#F4B124',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  /* 2-column card grid */
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '47.5%',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    position: 'relative',
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionIcon: {
    fontSize: 22,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  actionSub: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 10,
  },
  actionArrow: {
    fontSize: 22,
    fontWeight: '300',
    position: 'absolute',
    bottom: 10,
    right: 14,
  },

  /* Empty state */
  emptyCard: {
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Weather card */
  weatherCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  weatherCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  weatherIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(244,177,36,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weatherCardIcon: {
    fontSize: 22,
  },
  weatherCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  weatherCardSub: {
    fontSize: 12,
  },
  weatherCardArrow: {
    fontSize: 28,
    color: '#F4B124',
    fontWeight: '300',
  },

  bottomSpacer: {
    height: 36,
  },
});

export default TeaPlantationManagerScreen;
