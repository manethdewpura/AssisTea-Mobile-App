# AssisTea

A React Native mobile application for comprehensive tea plantation management. AssisTea provides tools for managing irrigation and fertigation systems, monitoring weather conditions, AI-powered agronomic assistance, worker management, and real-time notifications. The app supports role-based access for administrators and tea plantation managers.

## Tech Stack

- **Framework**: React Native 0.81.1
- **Language**: TypeScript
- **State Management**: Redux Toolkit with React Redux
- **Navigation**: React Navigation (Native Stack, Bottom Tabs)
- **Backend Services**: 
  - Firebase Authentication
  - Cloud Firestore
- **Local Storage**: 
  - SQLite (react-native-sqlite-storage)
  - AsyncStorage
- **UI Components**: 
  - React Native Vector Icons (Lucide)
  - React Native Community components (DateTimePicker, Slider, NetInfo)
- **Additional Libraries**:
  - Background Fetch
  - Keychain for secure storage
  - CSV parsing (PapaParse)
  - Document picker

## Branching Strategy

This project follows Git Flow with a main branch for production releases, a develop branch for integration, and feature branches for new development. All features are developed in separate branches and merged into develop after code review, with develop being merged to main for releases.

## Setup Requirements

### Prerequisites

- **Node.js**: >= 20.0.0
- **npm** or **yarn** package manager
- **React Native development environment**:
  - For Android: Android Studio with Android SDK
  - For iOS: Xcode (macOS only) with CocoaPods

### Environment Configuration

1. Create a `.env` file in the root directory with your Firebase configuration:
   ```env
   FIREBASE_API_KEY=your_api_key
   FIREBASE_AUTH_DOMAIN=your_auth_domain
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_STORAGE_BUCKET=your_storage_bucket
   FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   FIREBASE_APP_ID=your_app_id
   WEATHER_API_KEY=your_weather_api_key
   ```

2. Install dependencies:
   ```sh
   npm install
   # OR
   yarn install
   ```

3. For iOS (macOS only), install CocoaPods dependencies:
   ```sh
   bundle install
   bundle exec pod install
   ```

## How to Run the Project

### Start Metro Bundler

First, start the Metro bundler (JavaScript build tool for React Native):

```sh
npm start
# OR
yarn start
```

### Run on Android

With Metro running, open a new terminal and run:

```sh
npm run android
# OR
yarn android
```

### Run on iOS

With Metro running, open a new terminal and run:

```sh
npm run ios
# OR
yarn ios
```

**Note**: iOS development requires macOS and Xcode. Make sure CocoaPods dependencies are installed (see Setup Requirements above).

### Additional Commands

- **Lint code**: `npm run lint` or `yarn lint`
- **Run tests**: `npm test` or `yarn test`

## Troubleshooting

If you encounter issues:

1. **Metro bundler cache issues**: Clear the cache with `npm start -- --reset-cache`
2. **Android build issues**: Clean the build with `cd android && ./gradlew clean && cd ..`
3. **iOS build issues**: Clean pods with `cd ios && pod deintegrate && pod install && cd ..`
4. **Dependency issues**: Delete `node_modules` and reinstall with `rm -rf node_modules && npm install`

For more information, refer to the [React Native Troubleshooting Guide](https://reactnative.dev/docs/troubleshooting).

## Learn More

- [React Native Documentation](https://reactnative.dev)
- [React Native Getting Started](https://reactnative.dev/docs/getting-started)
- [Firebase for React Native](https://rnfirebase.io)
