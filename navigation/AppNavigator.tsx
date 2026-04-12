import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';
import { PendingApprovalScreen } from '../screens/auth/PendingApprovalScreen';
import { MainTabNavigator } from './MainTabNavigator';
import { IdleTimeoutGuard } from '../components/IdleTimeoutGuard';
import { Colors } from '../constants/theme';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef<any>();

const NAV_STATE_KEY = 'magnify_nav_state';
const PENDING_LINK_KEY = 'magnify_pending_link';

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
  const { session, profile, loading, isRecovery, clearRecovery } = useAuth();
  const [navReady, setNavReady] = useState(false);
  const latestNavState = useRef<any>(undefined);
  const pendingLinkHandled = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Capture any calling deep link from the URL before React Navigation processes it.
      // This ensures the link works whether the user is already logged in or needs to log in first.
      try {
        const path = window.location.pathname;
        const match = path.match(/^\/calling\/(.+)$/);
        if (match) {
          localStorage.setItem(PENDING_LINK_KEY, match[1]);
          window.history.replaceState(null, '', '/');
        }
      } catch {}
      const saved = loadNavState();
      if (saved) latestNavState.current = saved;
    }
    setNavReady(true);
  }, []);

  const isAuthenticated = !!session && profile?.status === 'approved';

  // Once authenticated and the navigator is ready, navigate to any pending deep link
  useEffect(() => {
    if (!isAuthenticated || !navReady || pendingLinkHandled.current) return;
    if (Platform.OS !== 'web') return;
    try {
      const callingId = localStorage.getItem(PENDING_LINK_KEY);
      if (!callingId) return;
      pendingLinkHandled.current = true;
      localStorage.removeItem(PENDING_LINK_KEY);
      const tryNavigate = (attempts = 0) => {
        if (navigationRef.isReady()) {
          navigationRef.navigate('Main' as never, {
            screen: 'HC',
            params: { screen: 'CallingDetail', params: { callingId } },
          } as never);
        } else if (attempts < 10) {
          setTimeout(() => tryNavigate(attempts + 1), 100);
        }
      };
      setTimeout(() => tryNavigate(), 100);
    } catch {}
  }, [isAuthenticated, navReady]);

  if (loading || !navReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      initialState={isAuthenticated ? latestNavState.current : undefined}
      onStateChange={(state) => {
        latestNavState.current = state;
        saveNavState(state);
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isRecovery ? (
          <Stack.Screen name="ResetPassword">
            {() => <ResetPasswordScreen onComplete={clearRecovery} />}
          </Stack.Screen>
        ) : !session ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
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
