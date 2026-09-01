import 'react-native-gesture-handler';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { DemoModeProvider } from './context/DemoModeContext';
import { ActionCountsProvider } from './context/ActionCountsContext';
import { DashboardProvider } from './context/DashboardContext';
import { AppNavigator } from './navigation/AppNavigator';
import { configureForegroundNotifications } from './lib/nativePush';

// Show native notifications as banners when the app is foregrounded
// (no-op on web and on binaries without expo-notifications).
configureForegroundNotifications();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LanguageProvider>
          <AuthProvider>
            <DemoModeProvider>
              <ActionCountsProvider>
                <DashboardProvider>
                  <AppNavigator />
                </DashboardProvider>
              </ActionCountsProvider>
            </DemoModeProvider>
          </AuthProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
