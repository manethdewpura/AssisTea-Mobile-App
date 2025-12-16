import BackgroundFetch from 'react-native-background-fetch';
import { weatherService, backendService, syncQueueService, backgroundSyncService } from '../services';

/**
 * Initialize background fetch to collect weather data even when app is closed
 */
export const initBackgroundFetch = async () => {
    try {
        // Configure Background Fetch
        await BackgroundFetch.configure(
            {
                minimumFetchInterval: 180, // Fetch every 3 hours
                stopOnTerminate: false,   // Continue after app closed
                startOnBoot: true,        // Start after device reboot
                enableHeadless: true,     // Work in headless (background) mode
                requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY, // Any network connection
                requiresCharging: false,  // Don't require charging
                requiresDeviceIdle: false, // Don't require device idle
            },
            async (taskId) => {
                console.log('[BackgroundFetch] ===== Task Started =====', taskId);

                try {
                    // 1. Fetch weather data from OpenWeather API
                    const location = { lat: 6.308746, lon: 80.418792 }; // TODO: Make this dynamic from settings
                    console.log('[BackgroundFetch] Fetching weather data...');
                    const weatherData = await weatherService.fetchAllWeatherData(location);
                    console.log('[BackgroundFetch] ✓ Weather data fetched successfully');

                    // 2. Check backend connection
                    const isBackendConnected = await backendService.checkBackendConnection();

                    if (isBackendConnected) {
                        console.log('[BackgroundFetch] Backend is connected, syncing...');

                        // Sync queued data first
                        const syncedCount = await backgroundSyncService.syncQueuedData();
                        if (syncedCount > 0) {
                            console.log(`[BackgroundFetch] ✓ Synced ${syncedCount} queued items`);
                        }

                        // Sync current data to backend
                        await backendService.syncAllWeatherData(weatherData.current, weatherData.forecast);
                        console.log('[BackgroundFetch] ✓ Current data synced to backend');
                    } else {
                        console.log('[BackgroundFetch] Backend not available, queueing data...');

                        // Queue for later sync
                        await syncQueueService.addToQueue(weatherData.current, weatherData.forecast);
                        const stats = await syncQueueService.getStats();
                        console.log(`[BackgroundFetch] ✓ Data queued (Total: ${stats.total}, Unsynced: ${stats.unsynced})`);
                    }

                    console.log('[BackgroundFetch] ===== Task Completed Successfully =====');
                } catch (error) {
                    console.error('[BackgroundFetch] ✗ Error during background fetch:', error);
                }

                // IMPORTANT: Must signal task completion
                BackgroundFetch.finish(taskId);
            },
            async (taskId) => {
                // Task timeout handler
                console.warn('[BackgroundFetch] ⚠ Task timeout:', taskId);
                BackgroundFetch.finish(taskId);
            }
        );

        // Log current status
        const status = await BackgroundFetch.status();
        console.log('[BackgroundFetch] Configuration complete. Status:', status);

        // Schedule immediate task for testing (optional)
        // await BackgroundFetch.scheduleTask({
        //   taskId: 'com.assistea.weather.initial',
        //   delay: 1000, // 1 second
        //   periodic: false,
        // });
    } catch (error) {
        console.error('[BackgroundFetch] Failed to configure:', error);
    }
};

/**
 * Register headless task (runs even when app is completely closed)
 */
export const registerHeadlessTask = () => {
    BackgroundFetch.registerHeadlessTask(async (event) => {
        const { taskId } = event;
        console.log('[BackgroundFetch:Headless] Task started:', taskId);

        try {
            // Same logic as above but in headless mode
            const location = { lat: 6.308746, lon: 80.418792 };
            const weatherData = await weatherService.fetchAllWeatherData(location);

            const isBackendConnected = await backendService.checkBackendConnection();

            if (isBackendConnected) {
                await backgroundSyncService.syncQueuedData();
                await backendService.syncAllWeatherData(weatherData.current, weatherData.forecast);
            } else {
                await syncQueueService.addToQueue(weatherData.current, weatherData.forecast);
            }

            console.log('[BackgroundFetch:Headless] Task completed');
        } catch (error) {
            console.error('[BackgroundFetch:Headless] Error:', error);
        }

        BackgroundFetch.finish(taskId);
    });
};
