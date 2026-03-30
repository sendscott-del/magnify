import React from 'react';
import { Image } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';

const TAB_ICONS = {
  SP: require('../assets/icon_sp_board.png'),
  HC: require('../assets/icon_hc_board.png'),
};
import { useAuth } from '../context/AuthContext';
import { PresidencyKanbanScreen } from '../screens/main/PresidencyKanbanScreen';
import { HCKanbanScreen } from '../screens/main/HCKanbanScreen';
import { NewCallingScreen } from '../screens/main/NewCallingScreen';
import { CompletedCallingsScreen } from '../screens/main/CompletedCallingsScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import { CallingDetailScreen } from '../screens/main/CallingDetailScreen';
import { HCAdminScreen } from '../screens/main/HCAdminScreen';
import { SPAdminScreen } from '../screens/main/SPAdminScreen';
import { HelpScreen } from '../screens/main/HelpScreen';
import { ReleaseNotesScreen } from '../screens/main/ReleaseNotesScreen';
import { PermissionsTableScreen } from '../screens/main/PermissionsTableScreen';
import { UserRolesScreen } from '../screens/main/UserRolesScreen';

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
      <Stack.Screen name="HCAdmin" component={HCAdminScreen} />
      <Stack.Screen name="SPAdmin" component={SPAdminScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="ReleaseNotes" component={ReleaseNotesScreen} />
      <Stack.Screen name="Permissions" component={PermissionsTableScreen} />
      <Stack.Screen name="UserRoles" component={UserRolesScreen} />
    </Stack.Navigator>
  );
}

export function MainTabNavigator() {
  const { isPresidency, isClerk } = useAuth();
  const { t } = useLanguage();
  const showPresidencyBoard = isPresidency || isClerk;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray[400],
        tabBarStyle: { borderTopColor: Colors.gray[200] },
        tabBarIcon: ({ color, size, focused }) => {
          if (route.name === 'PresidencyBoard') {
            return <Image source={TAB_ICONS.SP} style={{ width: size + 6, height: size + 6, opacity: focused ? 1 : 0.5, borderRadius: 5 }} />;
          }
          if (route.name === 'HC') {
            return <Image source={TAB_ICONS.HC} style={{ width: size + 6, height: size + 6, opacity: focused ? 1 : 0.5, borderRadius: 5 }} />;
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
          options={{ tabBarLabel: t('nav.spBoard') }}
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
        options={{ tabBarLabel: t('nav.hcBoard') }}
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
  );
}
