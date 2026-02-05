/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Mute RN yellow box warnings in emulator
// LogBox.ignoreAllLogs(true);

AppRegistry.registerComponent(appName, () => App);
