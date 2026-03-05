// Mock dependencies BEFORE imports
jest.mock('../config.service', () => ({
    configService: {
        getBackendUrl: jest.fn(),
    },
}));

jest.mock('../../utils/network.util', () => {
    class NetworkError extends Error {
        code: string;
        constructor(message: string) {
            super(message);
            this.name = 'NetworkError';
            this.code = 'NETWORK_ERROR';
        }
    }
    return { NetworkError };
});

// Mock global fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// Suppress console output in tests
jest.spyOn(console, 'warn').mockImplementation(() => { });
jest.spyOn(console, 'error').mockImplementation(() => { });
jest.spyOn(console, 'log').mockImplementation(() => { });

import { backendService } from '../backend.service';
import { configService } from '../config.service';

const MOCK_BASE_URL = 'http://192.168.1.100:8000';

describe('backendService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (configService.getBackendUrl as jest.Mock).mockResolvedValue(MOCK_BASE_URL);
        // Use fake timers for timeout/backoff tests
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('checkBackendConnection', () => {
        it('returns true when backend health check succeeds', async () => {
            mockFetch.mockResolvedValue({ ok: true });

            const promise = backendService.checkBackendConnection();
            // Flush pending promises
            jest.runAllTimers();
            const result = await promise;

            expect(result).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(
                `${MOCK_BASE_URL}/health`,
                expect.objectContaining({ method: 'GET' })
            );
        });

        it('returns false when backend URL is not configured', async () => {
            // Use real timers: getBaseUrl() throws immediately for null URL,
            // so the retry backoff resolves quickly without needing fake timer advancement.
            jest.useRealTimers();
            (configService.getBackendUrl as jest.Mock).mockResolvedValue(null);

            const result = await backendService.checkBackendConnection();

            expect(result).toBe(false);
        }, 15000); // generous timeout for 3 retry attempts

        it('retries on failure and returns false after max retries', async () => {
            mockFetch.mockRejectedValue(new Error('Connection refused'));

            const promise = backendService.checkBackendConnection();
            // Flush retries (3 attempts with exponential backoff)
            for (let i = 0; i < 10; i++) {
                jest.advanceTimersByTime(5000);
                await Promise.resolve();
                await Promise.resolve();
            }
            const result = await promise;

            expect(result).toBe(false);
            // Should have been called 3 times (max retries)
            expect(mockFetch).toHaveBeenCalledTimes(3);
        });
    });

    describe('syncAllWeatherData', () => {
        const mockCurrent = { dt: 123, main: { temp: 25 } } as any;
        const mockForecast = { list: [{ dt: 456 }] } as any;

        beforeEach(() => {
            jest.useRealTimers(); // syncAllWeatherData doesn't need fake timers
        });

        it('sends correct payload and returns sync response', async () => {
            const syncResponse = { success: true, message: 'Synced', syncedAt: Date.now() };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue(syncResponse),
            });

            const result = await backendService.syncAllWeatherData(mockCurrent, mockForecast);

            expect(result).toEqual(syncResponse);
            expect(mockFetch).toHaveBeenCalledWith(
                `${MOCK_BASE_URL}/api/weather/sync`,
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                })
            );
            // Verify the body contains correct data
            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.current).toEqual(mockCurrent);
            expect(body.forecast).toEqual(mockForecast);
            expect(body.timestamp).toBeDefined();
        });

        it('throws NetworkError with statusCode on 4xx error', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 409,
                statusText: 'Conflict',
                json: jest.fn().mockResolvedValue({ detail: 'Duplicate data' }),
            });

            try {
                await backendService.syncAllWeatherData(mockCurrent, mockForecast);
                fail('Should have thrown');
            } catch (error: any) {
                expect(error.message).toContain('409');
                expect(error.statusCode).toBe(409);
            }
        });

        it('throws NetworkError with statusCode on 5xx error', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                json: jest.fn().mockRejectedValue(new Error('no json')),
            });

            try {
                await backendService.syncAllWeatherData(mockCurrent, mockForecast);
                fail('Should have thrown');
            } catch (error: any) {
                expect(error.message).toContain('500');
                expect(error.statusCode).toBe(500);
            }
        });

        it('throws NetworkError with isNetworkFailure flag when fetch fails', async () => {
            mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));

            try {
                await backendService.syncAllWeatherData(mockCurrent, mockForecast);
                fail('Should have thrown');
            } catch (error: any) {
                expect(error.message).toContain('network unreachable');
                expect(error.isNetworkFailure).toBe(true);
            }
        });
    });

    describe('fetchMLPredictions', () => {
        beforeEach(() => {
            jest.useRealTimers();
        });

        it('returns predictions from backend', async () => {
            const mockResponse = {
                success: true,
                message: 'Predictions found',
                current: { main: { temp: 25 } },
                best_confidence: 0.92,
                predictions: [
                    { data: { main: { temp: 25 } }, confidence_score: 0.92, data_source: 'ml' },
                ],
                prediction_count: 1,
            };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue(mockResponse),
            });

            const result = await backendService.fetchMLPredictions();

            expect(result.success).toBe(true);
            expect(result.predictions).toHaveLength(1);
            expect(result.best_confidence).toBe(0.92);
            expect(mockFetch.mock.calls[0][0]).toContain('/api/weather/predictions/latest');
        });

        it('throws on HTTP error response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: jest.fn().mockResolvedValue({ message: 'No predictions found' }),
            });

            await expect(backendService.fetchMLPredictions()).rejects.toThrow(
                'No predictions found'
            );
        });
    });

    describe('syncCurrentWeather', () => {
        beforeEach(() => {
            jest.useRealTimers();
        });

        it('sends current weather data and returns response', async () => {
            const mockWeather = { dt: 123, main: { temp: 25 } } as any;
            const syncResponse = { success: true, message: 'Current weather synced' };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue(syncResponse),
            });

            const result = await backendService.syncCurrentWeather(mockWeather);

            expect(result).toEqual(syncResponse);
            expect(mockFetch.mock.calls[0][0]).toContain('/api/weather/current');
        });
    });

    describe('syncWeatherForecast', () => {
        beforeEach(() => {
            jest.useRealTimers();
        });

        it('sends forecast data and returns response', async () => {
            const mockForecastData = { list: [{ dt: 456 }] } as any;
            const syncResponse = { success: true, message: 'Forecast synced' };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue(syncResponse),
            });

            const result = await backendService.syncWeatherForecast(mockForecastData);

            expect(result).toEqual(syncResponse);
            expect(mockFetch.mock.calls[0][0]).toContain('/api/weather/forecast');
        });
    });
});
