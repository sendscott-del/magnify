import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { SuggestionFAB } from '../components/ui/SuggestionFAB';
import { AppSwitcher } from '../components/AppSwitcher';
import { DemoModeBanner } from '../components/DemoModeBanner';
import { ProductIcon } from '../components/icons/ProductIcon';
import { useAuth } from '../context/AuthContext';
import { useActionCounts } from '../context/ActionCountsContext';
import { PresidencyKanbanScreen } from '../screens/main/PresidencyKanbanScreen';
import { HCKanbanScreen } from '../screens/main/HCKanbanScreen';
import { NewCallingScreen } from '../screens/main/NewCallingScreen';
import { CompletedCallingsScreen } from '../screens/main/CompletedCallingsScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import { CallingDetailScreen } from '../screens/main/CallingDetailScreen';
import { HelpScreen } from '../screens/main/HelpScreen';
import { ReleaseNotesScreen } from '../screens/main/ReleaseNotesScreen';
import { PendingAccessScreen } from '../screens/main/PendingAccessScreen';
import { SlackSettingsScreen } from '../screens/main/SlackSettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function PresidencyStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PresidencyMain" component={PresidencyKanbanScreen} />
      <Stack.Screen name="CallingDetail" component={CallingDetailScreen} />
    </Stack.Navigator>
  );
}

function HCStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HCMain" component={HCKanbanScreen} />
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

function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsMain" component={SettingsScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="ReleaseNotes" component={ReleaseNotesScreen} />
      <Stack.Screen name="PendingAccess" component={PendingAccessScreen} />
      <Stack.Screen name="SlackSettings" component={SlackSettingsScreen} />
    </Stack.Navigator>
  );
}

export function MainTabNavigator() {
  const { isPresidency, isClerk } = useAuth();
  const { t } = useLanguage();
  const { hcCount, spCount } = useActionCounts();
  const showPresidencyBoard = isPresidency || isClerk;

  return (
    <View style={{ flex: 1 }}>
    <DemoModeBanner />
    <AppSwitcher />
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray[400],
        tabBarStyle: { borderTopColor: Colors.gray[200] },
        tabBarIcon: ({ color, size, focused }) => {
          if (route.name === 'PresidencyBoard') {
            return (
              <View style={{ opacity: focused ? 1 : 0.5 }}>
                <ProductIcon kind="sp_board" size={size + 6} />
              </View>
            );
          }
          if (route.name === 'HC') {
            return (
              <View style={{ opacity: focused ? 1 : 0.5 }}>
                <ProductIcon kind="hc_board" size={size + 6} />
              </View>
            );
          }
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            New: 'add-circle',
            Completed: 'checkmark-done',
            Settings: 'settings-outline',
          };
          const iconName = icons[route.name] ?? 'ellipse';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="New"
        component={NewCallingScreen}
        options={{ tabBarLabel: t('nav.new') }}
      />
      {showPresidencyBoard && (
        <Tab.Screen
          name="PresidencyBoard"
          component={PresidencyStack}
          options={{
            tabBarLabel: t('nav.spBoard'),
            tabBarBadge: spCount > 0 ? spCount : undefined,
          }}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              e.preventDefault();
              navigation.navigate('PresidencyBoard', { screen: 'PresidencyMain' });
            },
          })}
        />
      )}
      <Tab.Screen
        name="HC"
        component={HCStack}
        options={{
          tabBarLabel: t('nav.hcBoard'),
          tabBarBadge: hcCount > 0 ? hcCount : undefined,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('HC', { screen: 'HCMain' });
          },
        })}
      />
      <Tab.Screen
        name="Completed"
        component={CompletedStack}
        options={{ tabBarLabel: t('nav.completed') }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsStack}
        options={{ tabBarLabel: t('nav.settings') }}
      />
    </Tab.Navigator>
    <SuggestionFAB />
    </View>
  );
}
