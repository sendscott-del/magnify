import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { PresidencyKanbanScreen } from '../screens/main/PresidencyKanbanScreen';
import { HCKanbanScreen } from '../screens/main/HCKanbanScreen';
import { NewCallingScreen } from '../screens/main/NewCallingScreen';
import { CompletedCallingsScreen } from '../screens/main/CompletedCallingsScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import { CallingDetailScreen } from '../screens/main/CallingDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function PresidencyStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PresidencyBoard" component={PresidencyKanbanScreen} />
      <Stack.Screen name="CallingDetail" component={CallingDetailScreen} />
    </Stack.Navigator>
  );
}

function HCStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HCBoard" component={HCKanbanScreen} />
      <Stack.Screen name="CallingDetail" component={CallingDetailScreen} />
    </Stack.Navigator>
  );
}

function CompletedStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CompletedList" component={CompletedCallingsScreen} />
      <Stack.Screen name="CallingDetail" component={CallingDetailScreen} />
    </Stack.Navigator>
  );
}

export function MainTabNavigator() {
  const { isPresidency, isClerk } = useAuth();
  const showPresidencyBoard = isPresidency || isClerk;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray[400],
        tabBarStyle: { borderTopColor: Colors.gray[200] },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Presidency: 'podium',
            HC: 'git-branch-outline',
            New: 'add-circle',
            Completed: 'checkmark-done',
            Settings: 'settings-outline',
          };
          const iconName = icons[route.name] ?? 'ellipse';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      {showPresidencyBoard && (
        <Tab.Screen
          name="Presidency"
          component={PresidencyStack}
          options={{ tabBarLabel: 'SP Board' }}
        />
      )}
      <Tab.Screen
        name="HC"
        component={HCStack}
        options={{ tabBarLabel: 'HC Board' }}
      />
      <Tab.Screen
        name="New"
        component={NewCallingScreen}
        options={{ tabBarLabel: 'New' }}
      />
      <Tab.Screen
        name="Completed"
        component={CompletedStack}
        options={{ tabBarLabel: 'Completed' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Settings' }}
      />
    </Tab.Navigator>
  );
}
