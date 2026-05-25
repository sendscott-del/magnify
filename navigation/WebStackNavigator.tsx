import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
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

const Stack = createNativeStackNavigator();

/**
 * Flat stack used inside WebShell. Replaces the bottom-tab navigator on
 * desktop web: the sidebar drives navigation by calling
 * navigation.navigate('PresidencyMain') etc. Screens are registered with
 * the same names the per-section stacks use on native so deep-link configs,
 * navigation calls, and back-button behavior stay aligned across both shells.
 *
 * Initial route falls back to HC for high-councilors/SR coordinators who
 * don't see the SP board — picks the same default the tab navigator would
 * land on without us having to thread role checks through here.
 */
export function WebStackNavigator() {
  const { isPresidency, isClerk } = useAuth();
  const initial = isPresidency || isClerk ? 'PresidencyMain' : 'HCMain';
  return (
    <Stack.Navigator initialRouteName={initial} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="New" component={NewCallingScreen} />
      <Stack.Screen name="PresidencyMain" component={PresidencyKanbanScreen} />
      <Stack.Screen name="PresidencyBoard" component={PresidencyKanbanScreen} />
      <Stack.Screen name="HCMain" component={HCKanbanScreen} />
      <Stack.Screen name="HC" component={HCKanbanScreen} />
      <Stack.Screen name="CompletedList" component={CompletedCallingsScreen} />
      <Stack.Screen name="Completed" component={CompletedCallingsScreen} />
      <Stack.Screen name="SettingsMain" component={SettingsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="CallingDetail" component={CallingDetailScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="ReleaseNotes" component={ReleaseNotesScreen} />
      <Stack.Screen name="PendingAccess" component={PendingAccessScreen} />
      <Stack.Screen name="SlackSettings" component={SlackSettingsScreen} />
    </Stack.Navigator>
  );
}
