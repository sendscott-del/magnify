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
import { useIsDesktopWeb } from '../lib/useDeviceWidth';
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
import { HighCouncilScreen } from '../screens/main/HighCouncilScreen';
import { DashboardScreen } from '../screens/main/DashboardScreen';
import { DashboardDrillScreen } from '../screens/main/DashboardDrillScreen';
import { StandardWorkScreen } from '../screens/main/StandardWorkScreen';
import { ReviewQueueScreen } from '../screens/main/ReviewQueueScreen';
import { MetricsHistoryScreen } from '../screens/main/MetricsHistoryScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardMain" component={DashboardScreen} />
      <Stack.Screen name="DashboardDrill" component={DashboardDrillScreen} />
      <Stack.Screen name="StandardWork" component={StandardWorkScreen} />
      <Stack.Screen name="ReviewQueue" component={ReviewQueueScreen} />
      <Stack.Screen name="MetricsHistory" component={MetricsHistoryScreen} />
    </Stack.Navigator>
  );
}

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

function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsMain" component={SettingsScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="ReleaseNotes" component={ReleaseNotesScreen} />
      <Stack.Screen name="PendingAccess" component={PendingAccessScreen} />
      <Stack.Screen name="SlackSettings" component={SlackSettingsScreen} />
      <Stack.Screen name="HighCouncil" component={HighCouncilScreen} />
      {/* Completed lost its own tab when Dashboard became tab one — six bottom
          tabs is one too many. It lives under Settings on phone; the desktop
          sidebar still lists it directly, where there's room. */}
      <Stack.Screen name="CompletedList" component={CompletedCallingsScreen} />
      <Stack.Screen name="CallingDetail" component={CallingDetailScreen} />
    </Stack.Navigator>
  );
}

export function MainTabNavigator() {
  const { isPresidency, isClerk } = useAuth();
  const { t } = useLanguage();
  const { hcCount, spCount } = useActionCounts();
  const showPresidencyBoard = isPresidency || isClerk;
  // Belt-and-suspenders: AppNavigator's AuthedRoot already routes desktop web
  // through WebShell, but in the rare cross-render case (a hot resize during a
  // navigation transition), the tab bar would briefly flash. Hide it directly
  // when isDesktopWeb so there's no double-shell.
  const isDesktopWeb = useIsDesktopWeb();

  return (
    <View style={{ flex: 1 }}>
    <DemoModeBanner />
    <AppSwitcher />
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray[400],
        tabBarStyle: isDesktopWeb
          ? { display: 'none' }
          : { borderTopColor: Colors.gray[200] },
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
            Dashboard: focused ? 'grid' : 'grid-outline',
            New: 'add-circle',
            Completed: 'checkmark-done',
            Settings: 'settings-outline',
          };
          const iconName = icons[route.name] ?? 'ellipse';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      {/* Dashboard is tab one and the app's home — it answers "what's blocked
          on me" before any board does. */}
      <Tab.Screen
        name="Dashboard"
        component={DashboardStack}
        options={{ tabBarLabel: t('nav.dashboard') }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('Dashboard', { screen: 'DashboardMain' });
          },
        })}
      />
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
        name="Settings"
        component={SettingsStack}
        options={{ tabBarLabel: t('nav.settings') }}
      />
    </Tab.Navigator>
    <SuggestionFAB />
    </View>
  );
}
