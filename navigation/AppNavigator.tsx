import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { PendingApprovalScreen } from '../screens/auth/PendingApprovalScreen';
import { MainTabNavigator } from './MainTabNavigator';
import { IdleTimeoutGuard } from '../components/IdleTimeoutGuard';
import { Colors } from '../constants/theme';

const Stack = createNativeStackNavigator();

const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? '';

const linking = APP_URL ? ({
  prefixes: [APP_URL],
  config: {
    screens: {
      Main: {
        screens: {
          HC: {
            screens: {
              HCMain: '',
              CallingDetail: 'calling/:callingId',
            },
          },
        },
      },
    },
  },
} as any) : undefined;

const NAV_STATE_KEY = 'magnify_nav_state';

function saveNavState(state: any) {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(NAV_STATE_KEY, JSON.stringify(state));
    }
  } catch {}
}

function loadNavState(): any {
  try {
    if (Platform.OS === 'web') {
      const s = localStorage.getItem(NAV_STATE_KEY);
      return s ? JSON.parse(s) : undefined;
    }
  } catch {}
  return undefined;
}

export function AppNavigator() {
  const { session, profile, loading } = useAuth();
  const [navReady, setNavReady] = useState(false);
  const [initialState, setInitialState] = useState<any>(undefined);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const saved = loadNavState();
      if (saved) setInitialState(saved);
    }
    setNavReady(true);
  }, []);

  if (loading || !navReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const isAuthenticated = !!session && profile?.status === 'approved';

  return (
    <NavigationContainer
      linking={linking}
      initialState={isAuthenticated ? initialState : undefined}
      onStateChange={saveNavState}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : profile?.status !== 'approved' ? (
          <Stack.Screen name="Pending" component={PendingApprovalScreen} />
        ) : (
          <Stack.Screen name="Main">
            {() => (
              <IdleTimeoutGuard>
                <MainTabNavigator />
              </IdleTimeoutGuard>
            )}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
