import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, AppState, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCoachColor, getContrastText } from './src/utils/coachColors';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts, Syne_800ExtraBold } from '@expo-google-fonts/syne';
import { DMMono_400Regular } from '@expo-google-fonts/dm-mono';
import * as Notifications from 'expo-notifications';
import { supabase } from './src/lib/supabase';
import { scheduleDailyReminders, getScheduledCount, remindersWereEnabled, registerAndSavePushToken } from './src/services/notifications';
import { drainOfflineQueue } from './src/services/syncQueue';
import LoginScreen from './src/screens/LoginScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import CoachScreen from './src/screens/CoachScreen';
import CheckInScreen from './src/screens/CheckInScreen';
import GoalsScreen from './src/screens/GoalsScreen';
import StatsScreen from './src/screens/StatsScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import SocialScreen from './src/screens/SocialScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import MonkModeScreen from './src/screens/MonkModeScreen';
import GlobalHeader from './src/components/GlobalHeader';
import WelcomeScreen from './src/screens/WelcomeScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import { AccessibilityProvider } from './src/context/AccessibilityContext';
import { UserProvider, useUser } from './src/context/UserContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const linking = {
  prefixes: ['monkai://'],
  config: {
    screens: {
      Welcome: 'welcome',
      Login:   'login',
      App: {
        screens: {
          Coach:   'coach',
          CheckIn: 'checkin',
          Goals:   'goals',
          Stats:   'stats',
          Social:  'social',
        },
      },
      Profile:  'profile',
      MonkMode: 'monkmode',
      Review:   'review',
    },
  },
};

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ iconName, focused, color }: { iconName: IoniconsName; focused: boolean; color: string }) {
  return (
    <View style={[tabStyles.iconWrap, focused && { backgroundColor: color + '1F' }]}>
      <Ionicons name={iconName} size={19} color={color} />
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconWrap: {
    width: 44, height: 28, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
});

function AppTabs() {
  const { today: todayCtx, profile } = useUser();
  const pendingHabits = Math.max(0, todayCtx.habitsTotal - todayCtx.habitsDone);
  const badgeColor = getCoachColor(profile?.personality);
  const badgeText  = getContrastText(badgeColor);

  useEffect(() => {
    Notifications.setBadgeCountAsync(pendingHabits).catch(() => {});
  }, [pendingHabits]);

  useEffect(() => {
    // Reschedule if user had reminders enabled but iOS cleared them (e.g. after app update)
    Promise.all([getScheduledCount(), remindersWereEnabled()]).then(async ([count, wasEnabled]) => {
      if (count === 0 && wasEnabled) scheduleDailyReminders().catch(() => {});
    }).catch(() => {});
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') drainOfflineQueue().catch(() => {});
    });
    return () => appStateSub.remove();
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0a0a0a',
          borderTopColor: '#1a1a1a',
          height: 80,
          paddingBottom: 18,
          paddingTop: 8,
        },
        tabBarActiveTintColor: badgeColor,
        tabBarInactiveTintColor: '#666666',
        tabBarLabelStyle: {
          fontSize: 10,
          letterSpacing: 1,
          fontFamily: 'DMMono_400Regular',
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Coach" component={CoachScreen}
        options={{
          tabBarLabel: 'COACH',
          tabBarTestID: 'tab-coach',
          tabBarAccessibilityLabel: 'Coach',
          tabBarIcon: ({ focused, color }) => <TabIcon iconName={focused ? 'sparkles' : 'sparkles-outline'} focused={focused} color={color} />,
        }}
      />
      <Tab.Screen
        name="CheckIn" component={CheckInScreen}
        options={{
          tabBarLabel: 'CHECK-IN',
          tabBarTestID: 'tab-checkin',
          tabBarAccessibilityLabel: 'Check In',
          tabBarIcon: ({ focused, color }) => <TabIcon iconName={focused ? 'checkbox' : 'checkbox-outline'} focused={focused} color={color} />,
          tabBarBadge: pendingHabits > 0 ? pendingHabits : undefined,
          tabBarBadgeStyle: { backgroundColor: badgeColor, color: badgeText, fontSize: 10, fontWeight: '700', minWidth: 16 },
        }}
      />
      <Tab.Screen
        name="Goals" component={GoalsScreen}
        options={{
          tabBarLabel: 'GOALS',
          tabBarTestID: 'tab-goals',
          tabBarAccessibilityLabel: 'Goals',
          tabBarIcon: ({ focused, color }) => <TabIcon iconName={focused ? 'flag' : 'flag-outline'} focused={focused} color={color} />,
        }}
      />
      <Tab.Screen
        name="Stats" component={StatsScreen}
        options={{
          tabBarLabel: 'STATS',
          tabBarTestID: 'tab-stats',
          tabBarAccessibilityLabel: 'Stats',
          tabBarIcon: ({ focused, color }) => <TabIcon iconName={focused ? 'bar-chart' : 'bar-chart-outline'} focused={focused} color={color} />,
        }}
      />
      <Tab.Screen
        name="Social" component={SocialScreen}
        options={{
          tabBarLabel: 'SOCIAL',
          tabBarTestID: 'tab-social',
          tabBarAccessibilityLabel: 'Social',
          tabBarIcon: ({ focused, color }) => <TabIcon iconName={focused ? 'people' : 'people-outline'} focused={focused} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  const [fontsLoaded] = useFonts({ Syne_800ExtraBold, DMMono_400Regular });

  // Handle deep links when app is already open (foreground/background)
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      const nav = navigationRef.current;
      if (!nav || !session) return;
      // Strip scheme, query params, and fragments; take only the path segment
      const raw = url.replace('monkai://', '').split('?')[0].split('#')[0].toLowerCase();
      const tabScreenMap: Record<string, string> = {
        checkin: 'CheckIn', coach: 'Coach', goals: 'Goals', stats: 'Stats', social: 'Social',
      };
      const tabScreen = tabScreenMap[raw];
      if (tabScreen) nav.navigate('App', { screen: tabScreen });
      else if (raw === 'review') nav.navigate('Review');
      else if (raw === 'profile') nav.navigate('Profile');
      else if (raw === 'monkmode') nav.navigate('MonkMode');
      // Unknown paths silently dropped
    });
    return () => sub.remove();
  }, [session]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const nav = navigationRef.current;
      if (!nav) return;
      const data = response.notification.request.content.data as any;
      const id   = response.notification.request.identifier;
      if (data?.url) {
        const path = data.url.replace('monkai://', '').toLowerCase();
        const tabScreenMap: Record<string, string> = {
          checkin: 'CheckIn', coach: 'Coach', goals: 'Goals', stats: 'Stats', social: 'Social',
        };
        const tabScreen = tabScreenMap[path];
        if (tabScreen) nav.navigate('App', { screen: tabScreen });
        else if (path === 'review') nav.navigate('Review');
        else if (path === 'profile') nav.navigate('Profile');
        else if (path === 'monkmode') nav.navigate('MonkMode');
      } else if (id === 'morning-checkin' || id === 'evening-checkin') {
        nav.navigate('App', { screen: 'CheckIn' });
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) await checkOnboarding(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        await checkOnboarding(session.user.id);
        void registerAndSavePushToken(session.user.id);
      } else {
        setOnboardingDone(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const checkOnboarding = async (userId: string) => {
    // Ensure row exists — trigger may have missed if migrations applied after signup
    await supabase.from('users').upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });
    const { data } = await supabase
      .from('users')
      .select('onboarding_done')
      .eq('id', userId)
      .single();
    setOnboardingDone(data?.onboarding_done === true);
  };

  if (!fontsLoaded || loading || (session && onboardingDone === null)) return <View style={{ flex: 1, backgroundColor: '#0a0a0a' }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AccessibilityProvider>
      <UserProvider>
      <SafeAreaProvider>
        <ErrorBoundary>
        <NavigationContainer ref={navigationRef} linking={linking}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!session ? (
              <>
                <Stack.Screen name="Welcome" component={WelcomeScreen} />
                <Stack.Screen name="Login"   component={LoginScreen} />
              </>
            ) : onboardingDone === false ? (
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            ) : null}
            {session && (
              <Stack.Group>
                <Stack.Screen name="App"      component={AppTabs} options={{ headerShown: true, header: () => <GlobalHeader /> }} />
                <Stack.Screen name="Profile"  component={ProfileScreen}  options={{ presentation: 'modal' }} />
                <Stack.Screen name="MonkMode" component={MonkModeScreen} options={{ presentation: 'modal', headerShown: false }} />
                <Stack.Screen name="Review"   component={ReviewScreen}   options={{ presentation: 'modal', headerShown: false }} />
              </Stack.Group>
            )}
          </Stack.Navigator>
        </NavigationContainer>
        </ErrorBoundary>
      </SafeAreaProvider>
      </UserProvider>
      </AccessibilityProvider>
    </GestureHandlerRootView>
  );
}
