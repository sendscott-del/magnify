import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { PendingApprovalScreen } from '../screens/auth/PendingApprovalScreen';
import { MainTabNavigator } from './MainTabNavigator';
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

export function AppNavigator() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : profile?.status !== 'approved' ? (
          <Stack.Screen name="Pending" component={PendingApprovalScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
