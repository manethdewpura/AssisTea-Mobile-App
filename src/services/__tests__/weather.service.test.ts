// Mock dependencies BEFORE imports
jest.mock('@react-native-community/netinfo', () => ({
    fetch: jest.fn(),
    addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('../../common/constants', () => ({
    WEATHER_API_CONFIG: {
        BASE_URL: 'https://api.openweathermap.org/data/2.5',
        API_KEY: 'test-api-key-123',
        DEFAULT_LAT: 6.308746,
        DEFAULT_LON: 80.418792,
        UNITS: 'metric',
        FETCH_INTERVAL: 3600000,
    },
    WEATHER_ENDPOINTS: {
        CURRENT: '/weather',
        FORECAST: '/forecast',
    },
}));

jest.mock('../../utils', () => ({
    ensureNetworkConnection: jest.fn(),
    handleFirebaseError: jest.fn((error: any) => error),
    logError: jest.fn(),
}));

// Mock global fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

import { weatherService } from '../weather.service';
import { ensureNetworkConnection } from '../../utils';
import { NetworkError } from '../../utils/network.util';

// --- Test Fixtures ---

const mockCurrentWeather = {
    coord: { lon: 80.4188, lat: 6.3087 },
    weather: [{ id: 804, main: 'Clouds', description: 'overcast clouds', icon: '04n' }],
    base: 'stations',
    main: {
        temp: 24.22, feels_like: 24.84, temp_min: 24.22, temp_max: 24.22,
        pressure: 1011, humidity: 82, sea_level: 1011, grnd_level: 987,
    },
    visibility: 10000,
    wind: { speed: 0.87, deg: 239, gust: 0.45 },
    clouds: { all: 100 },
    dt: 1772629587,
    sys: { country: 'LK', sunrise: 1772585391, sunset: 1772628645 },
    timezone: 19800,
    id: 1238367,
    name: 'Kumbalwella',
    cod: 200,
};

const mockForecast = {
    cod: '200',
    message: 0,
    cnt: 1,
    list: [
        {
            dt: 1772636400,
            main: {
                temp: 24.53, feels_like: 25.18, temp_min: 23.6, temp_max: 24.53,
                pressure: 1011, sea_level: 1011, grnd_level: 988, humidity: 82, temp_kf: 0.93,
            },
            weather: [{ id: 500, main: 'Rain', description: 'light rain', icon: '10n' }],
            clouds: { all: 100 },
            wind: { speed: 0.55, deg: 309, gust: 0.48 },
            visibility: 10000,
            pop: 0.23,
            rain: { '3h': 0.1 },
            sys: { pod: 'n' },
            dt_txt: '2026-03-04 15:00:00',
        },
    ],
    city: {
        id: 1238367, name: 'Kumbalwella',
        coord: { lat: 6.3087, lon: 80.4188 },
        country: 'LK', population: 0, timezone: 19800,
        sunrise: 1772585391, sunset: 1772628645,
    },
};

// --- Tests ---

describe('weatherService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (ensureNetworkConnection as jest.Mock).mockResolvedValue(undefined);
    });

    describe('fetchCurrentWeather', () => {
        it('returns current weather data on successful API call', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue(mockCurrentWeather),
            });

            const result = await weatherService.fetchCurrentWeather({ lat: 6.3087, lon: 80.4188 });

            expect(result).toEqual(mockCurrentWeather);
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch.mock.calls[0][0]).toContain('lat=6.3087');
            expect(mockFetch.mock.calls[0][0]).toContain('lon=80.4188');
            expect(mockFetch.mock.calls[0][0]).toContain('appid=test-api-key-123');
            expect(mockFetch.mock.calls[0][0]).toContain('units=metric');
        });

        it('uses default coordinates when no location is provided', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue(mockCurrentWeather),
            });

            await weatherService.fetchCurrentWeather();

            const calledUrl = mockFetch.mock.calls[0][0];
            expect(calledUrl).toContain('lat=6.308746');
            expect(calledUrl).toContain('lon=80.418792');
        });

        it('throws NetworkError when API returns HTTP error', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
            });

            await expect(weatherService.fetchCurrentWeather()).rejects.toThrow(
                'Failed to fetch current weather: 401 Unauthorized'
            );
        });

        it('throws when network connection is unavailable', async () => {
            (ensureNetworkConnection as jest.Mock).mockRejectedValueOnce(
                new NetworkError('No internet connection available')
            );

            await expect(weatherService.fetchCurrentWeather()).rejects.toThrow(
                'No internet connection available'
            );
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('fetchWeatherForecast', () => {
        it('returns forecast data on successful API call', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue(mockForecast),
            });

            const result = await weatherService.fetchWeatherForecast({ lat: 6.3087, lon: 80.4188 });

            expect(result).toEqual(mockForecast);
            expect(mockFetch.mock.calls[0][0]).toContain('/forecast');
        });

        it('throws NetworkError when API returns HTTP error', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            });

            await expect(weatherService.fetchWeatherForecast()).rejects.toThrow(
                'Failed to fetch weather forecast: 500 Internal Server Error'
            );
        });
    });

    describe('fetchAllWeatherData', () => {
        it('fetches both current weather and forecast in parallel', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: jest.fn().mockResolvedValue(mockCurrentWeather),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: jest.fn().mockResolvedValue(mockForecast),
                });

            const result = await weatherService.fetchAllWeatherData({ lat: 6.3087, lon: 80.4188 });

            expect(result.current).toEqual(mockCurrentWeather);
            expect(result.forecast).toEqual(mockForecast);
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('throws error if any request fails', async () => {
            mockFetch
                .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' })
                .mockResolvedValueOnce({
                    ok: true,
                    json: jest.fn().mockResolvedValue(mockForecast),
                });

            await expect(
                weatherService.fetchAllWeatherData({ lat: 6.3087, lon: 80.4188 })
            ).rejects.toThrow();
        });
    });
});
