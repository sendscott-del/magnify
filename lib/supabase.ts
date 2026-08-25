import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Must be true on web so Supabase can pick up the recovery token from the URL
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Native only: tie the token auto-refresh ticker to the app's lifecycle, as
// supabase-js's React Native setup requires.
//
// Left unwired, the 30-second ticker keeps "running" while the app is
// backgrounded — iOS suspends the timer and then fires it the moment the app
// comes back, so a refresh lands during the resume, at the same time the
// focused screen is re-querying. Starting it on `active` and stopping it on
// background makes the refresh a deliberate step on resume rather than a race
// with one. Web needs none of this: supabase-js drives refresh off the
// browser's own visibility events.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
