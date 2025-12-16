import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useAppSelector } from '../../hooks';
import { selectWeather, selectTheme } from '../../store/selectors';
import { Lucide } from '@react-native-vector-icons/lucide';

interface WeatherScreenProps {
  onBackPress?: () => void;
}

const WeatherScreen: React.FC<WeatherScreenProps> = ({ onBackPress }) => {
  const { current, forecast, isFetching, error, lastUpdated, isBackendConnected } =
    useAppSelector(selectWeather);
  const { colors } = useAppSelector(selectTheme);

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getWeatherIcon = (iconCode: string): string => {
    return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  };

  if (isFetching && !current) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading weather data...
          </Text>
        </View>
      </View>
    );
  }

  if (error && !current) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            {error}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {onBackPress && (
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            onPress={onBackPress}
            style={styles.backButton}
          >
            <Lucide name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Weather Forecast
          </Text>
          <View style={styles.backButton} />
        </View>
      )}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Connection Status */}
        <View
          style={[
            styles.statusBar,
            {
              backgroundColor: isBackendConnected
                ? colors.success
                : colors.warning,
            },
          ]}
        >
          <Text style={styles.statusText}>
            {isBackendConnected
              ? '✓ Backend Connected - Data Syncing'
              : '⚠ Backend Disconnected - Local Mode'}
          </Text>
        </View>

        {/* Current Weather */}
        {current && (
          <View
            style={[
              styles.currentWeatherCard,
              { backgroundColor: colors.cardBackground, borderColor: colors.border },
            ]}
          >
            <View style={styles.currentWeatherHeader}>
              <View>
                <Text style={[styles.locationText, { color: colors.text }]}>
                  {current.name}
                </Text>
                <Text
                  style={[styles.coordinatesText, { color: colors.textSecondary }]}
                >
                  {current.coord.lat.toFixed(4)}, {current.coord.lon.toFixed(4)}
                </Text>
              </View>
              {current.weather[0] && (
                <View style={styles.weatherIconContainer}>
                  <Text style={styles.weatherIcon}>
                    {current.weather[0].icon && (
                      <Text>🌤️</Text>
                    )}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.currentWeatherMain}>
              <Text style={[styles.temperatureText, { color: colors.text }]}>
                {Math.round(current.main.temp)}°
              </Text>
              <Text
                style={[styles.feelsLikeText, { color: colors.textSecondary }]}
              >
                Feels like {Math.round(current.main.feels_like)}°
              </Text>
              {current.weather[0] && (
                <Text
                  style={[styles.descriptionText, { color: colors.textSecondary }]}
                >
                  {current.weather[0].description.charAt(0).toUpperCase() +
                    current.weather[0].description.slice(1)}
                </Text>
              )}
            </View>

            <View style={styles.weatherDetails}>
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  Humidity
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {current.main.humidity}%
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  Pressure
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {current.main.pressure} hPa
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  Wind Speed
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {current.wind.speed} m/s
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  Visibility
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {(current.visibility / 1000).toFixed(1)} km
                </Text>
              </View>
            </View>

            <View style={styles.sunTimes}>
              <View style={styles.sunTimeItem}>
                <Text style={[styles.sunTimeLabel, { color: colors.textSecondary }]}>
                  Sunrise
                </Text>
                <Text style={[styles.sunTimeValue, { color: colors.text }]}>
                  {formatTime(current.sys.sunrise)}
                </Text>
              </View>
              <View style={styles.sunTimeItem}>
                <Text style={[styles.sunTimeLabel, { color: colors.textSecondary }]}>
                  Sunset
                </Text>
                <Text style={[styles.sunTimeValue, { color: colors.text }]}>
                  {formatTime(current.sys.sunset)}
                </Text>
              </View>
            </View>

            {lastUpdated && (
              <Text
                style={[styles.lastUpdatedText, { color: colors.textSecondary }]}
              >
                Last updated: {new Date(lastUpdated).toLocaleString()}
              </Text>
            )}
          </View>
        )}

        {/* Forecast */}
        {forecast && forecast.list && (
          <View
            style={[
              styles.forecastCard,
              { backgroundColor: colors.cardBackground, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.forecastTitle, { color: colors.text }]}>
              Daily Forecast
            </Text>
            {forecast.list.slice(0, 5).map((item, index) => (
              <View
                key={index}
                style={[
                  styles.forecastItem,
                  index < forecast.list.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <View style={styles.forecastItemLeft}>
                  <Text style={[styles.forecastDate, { color: colors.text }]}>
                    {formatDateTime(item.dt_txt)}
                  </Text>
                  {item.weather[0] && (
                    <Text
                      style={[
                        styles.forecastDescription,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {item.weather[0].description.charAt(0).toUpperCase() +
                        item.weather[0].description.slice(1)}
                    </Text>
                  )}
                </View>
                <View style={styles.forecastItemRight}>
                  <Text style={[styles.forecastTemp, { color: colors.text }]}>
                    {Math.round(item.main.temp)}°
                  </Text>
                  <Text
                    style={[
                      styles.forecastTempRange,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {Math.round(item.main.temp_min)}° / {Math.round(item.main.temp_max)}°
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {error && (
          <View
            style={[
              styles.errorCard,
              { backgroundColor: colors.error, opacity: 0.1 },
            ]}
          >
            <Text style={[styles.errorText, { color: colors.error }]}>
              {error}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorCard: {
    margin: 15,
    padding: 15,
    borderRadius: 10,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  statusBar: {
    padding: 10,
    alignItems: 'center',
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  currentWeatherCard: {
    margin: 15,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentWeatherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  locationText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  coordinatesText: {
    fontSize: 12,
    marginTop: 4,
  },
  weatherIconContainer: {
    alignItems: 'center',
  },
  weatherIcon: {
    fontSize: 48,
  },
  currentWeatherMain: {
    alignItems: 'center',
    marginVertical: 20,
  },
  temperatureText: {
    fontSize: 64,
    fontWeight: 'bold',
  },
  feelsLikeText: {
    fontSize: 16,
    marginTop: 5,
  },
  descriptionText: {
    fontSize: 18,
    marginTop: 5,
    textTransform: 'capitalize',
  },
  weatherDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  detailItem: {
    width: '48%',
    marginBottom: 15,
  },
  detailLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  sunTimes: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  sunTimeItem: {
    alignItems: 'center',
  },
  sunTimeLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  sunTimeValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  lastUpdatedText: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 15,
    fontStyle: 'italic',
  },
  forecastCard: {
    margin: 15,
    marginTop: 0,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  forecastTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  forecastItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  forecastItemLeft: {
    flex: 1,
  },
  forecastItemRight: {
    alignItems: 'flex-end',
  },
  forecastDate: {
    fontSize: 14,
    fontWeight: '600',
  },
  forecastDescription: {
    fontSize: 12,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  forecastTemp: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  forecastTempRange: {
    fontSize: 12,
    marginTop: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
});

export default WeatherScreen;

