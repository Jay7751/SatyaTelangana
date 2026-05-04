// UPDATED App.js - With proper SafeAreaProvider setup for NewsCard compatibility
import React, { useState, useEffect, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  View, Text, StyleSheet, StatusBar, AppState, Alert, 
  Platform, Animated, Dimensions
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context'; // IMPORTANT: Safe area provider
import LoginScreen from './screens/LoginScreen';
import NewsScreen from './screens/NewsScreen';
import SubmitArticleScreen from './screens/SubmitArticleScreen';
import AdminDashboardScreen from './screens/AdminDashboardScreen';
import ProfileScreen from './screens/ProfileScreen';
import { supabase } from './supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const Tab = createBottomTabNavigator();

export default function App() {
  // All existing state variables
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('online');
  const [fadeAnim] = useState(new Animated.Value(0));
  const [showNav, setShowNav] = useState(true);

  // All existing useEffect and initialization functions remain the same
  useEffect(() => {
    initializeApp();
    setupAuthListener();
    setupAppStateListener();
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const initializeApp = async () => {
    try {
      await checkInitialSession();
    } catch (error) {
      console.error('App initialization failed:', error);
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const checkInitialSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      if (session?.user) {
        setUser(session.user);
        await loadUserProfile(session.user.id);
        setConnectionStatus('online');
      }
    } catch (error) {
      console.error('Session check failed:', error);
      setConnectionStatus('offline');
    }
  };

  const setupAuthListener = () => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          console.log('Auth event:', event);
          
          if (session?.user) {
            setUser(session.user);
            await loadUserProfile(session.user.id);
          } else {
            setUser(null);
            setUserProfile(null);
          }
          
          setConnectionStatus('online');
        } catch (error) {
          console.error('Auth state change error:', error);
          setConnectionStatus('error');
        }
      }
    );

    return () => subscription.unsubscribe();
  };

  const setupAppStateListener = () => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active' && user) {
        loadUserProfile(user.id);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  };

  const loadUserProfile = async (userId, retryCount = 3) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        setUserProfile(data);
        return data;
      }

      if (error?.code === 'PGRST116') {
        return await createUserProfile(userId);
      }

      throw error;
    } catch (error) {
      console.error('Profile loading failed:', error);
      
      if (retryCount > 0) {
        console.log(`Retrying profile load... (${retryCount} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return loadUserProfile(userId, retryCount - 1);
      }

      setConnectionStatus('error');
      return null;
    }
  };

  const createUserProfile = async (userId) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      const profileData = {
        id: userId,
        email: authUser?.email || `user-${userId}@example.com`,
        name: authUser?.user_metadata?.name || 
              authUser?.email?.split('@')[0] || 
              'User',
        role: 'user',
        is_approved: true,
      };

      const { data: profile, error } = await supabase
        .from('users')
        .insert([profileData])
        .select()
        .single();

      if (error) throw error;

      setUserProfile(profile);
      return profile;
    } catch (error) {
      console.error('Profile creation failed:', error);
      Alert.alert(
        'Profile Setup',
        'There was an issue setting up your profile. Please try again.',
        [{ text: 'OK', onPress: () => handleLogout() }]
      );
      return null;
    }
  };

  const handleLogin = useCallback((authUser, profile) => {
    setUser(authUser);
    setUserProfile(profile);
    setConnectionStatus('online');
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const renderConnectionStatus = () => {
    if (connectionStatus === 'offline') {
      return (
        <View style={styles.connectionBar}>
          <Text style={styles.connectionText}>
            🔴 Offline - Some features may be limited
          </Text>
        </View>
      );
    }

    if (connectionStatus === 'error') {
      return (
        <View style={[styles.connectionBar, styles.errorBar]}>
          <Text style={styles.connectionText}>
            ⚠️ Connection issues - Retrying...
          </Text>
        </View>
      );
    }

    return null;
  };

  // Loading screen with SafeAreaProvider
  if (loading) {
    return (
      <SafeAreaProvider>
        <Animated.View style={[styles.loadingContainer, { opacity: fadeAnim }]}>
          <View style={styles.loadingContent}>
            <Text style={styles.loadingIcon}>📰</Text>
            <Text style={styles.loadingTitle}>Satya Telangana</Text>
            <Text style={styles.loadingSubtitle}>Loading your news experience...</Text>
          </View>
        </Animated.View>
      </SafeAreaProvider>
    );
  }

  // Login screen with SafeAreaProvider
  if (!user) {
    return (
      <SafeAreaProvider>
        <LoginScreen 
          onLogin={handleLogin} 
          connectionStatus={connectionStatus} 
        />
      </SafeAreaProvider>
    );
  }

  // MAIN APP: Wrapped with SafeAreaProvider for proper NewsCard layout
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {renderConnectionStatus()}
        <Tab.Navigator
          screenOptions={{
            tabBarStyle: [
              styles.tabBar,
              { display: showNav ? 'flex' : 'none' }
            ],
            tabBarActiveTintColor: '#60A5FA',
            tabBarInactiveTintColor: '#9CA3AF',
            tabBarLabelStyle: styles.tabBarLabel,
            headerShown: false,
            tabBarHideOnKeyboard: true,
          }}
        >
          {/* NEWS TAB - Always visible */}
          <Tab.Screen
            name="News"
            options={{
              tabBarIcon: ({ focused, color }) => (
                <View style={styles.tabBarIcon}>
                  <Text style={[
                    styles.tabIcon, 
                    { color }, 
                    focused && styles.tabIconActive
                  ]}>
                    📰
                  </Text>
                </View>
              ),
            }}
          >
            {() => (
              <NewsScreen 
                user={user}
                userProfile={userProfile}
                connectionStatus={connectionStatus}
                toggleNav={() => setShowNav(prev => !prev)}
                onEngagement={(articleId, type, value) => {
                  console.log(`Engagement: ${type} on article ${articleId}: ${value}`);
                }}
              />
            )}
          </Tab.Screen>

          {/* SUBMIT TAB - Only for journalists */}
          {userProfile?.role === 'journalist' && (
            <Tab.Screen
              name="Submit"
              options={{
                tabBarIcon: ({ focused, color }) => (
                  <View style={styles.tabBarIcon}>
                    <Text style={[
                      styles.tabIcon, 
                      { color }, 
                      focused && styles.tabIconActive
                    ]}>
                      ✍️
                    </Text>
                  </View>
                ),
              }}
            >
              {() => (
                <SubmitArticleScreen 
                  user={user}
                  userProfile={userProfile}
                />
              )}
            </Tab.Screen>
          )}

          {/* ADMIN TAB - Only for administrators */}
          {userProfile?.role === 'admin' && (
            <Tab.Screen
              name="Admin"
              options={{
                tabBarIcon: ({ focused, color }) => (
                  <View style={styles.tabBarIcon}>
                    <Text style={[
                      styles.tabIcon, 
                      { color }, 
                      focused && styles.tabIconActive
                    ]}>
                      👨‍💼
                    </Text>
                  </View>
                ),
              }}
            >
              {() => (
                <AdminDashboardScreen 
                  user={user}
                  userProfile={userProfile}
                />
              )}
            </Tab.Screen>
          )}

          {/* PROFILE TAB - Always visible */}
          <Tab.Screen
            name="Profile"
            options={{
              tabBarIcon: ({ focused, color }) => (
                <View style={styles.tabBarIcon}>
                  <Text style={[
                    styles.tabIcon, 
                    { color }, 
                    focused && styles.tabIconActive
                  ]}>
                    👤
                  </Text>
                </View>
              ),
            }}
          >
            {() => (
              <ProfileScreen 
                user={user}
                userProfile={userProfile}
                onLogout={handleLogout}
              />
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// RESPONSIVE STYLESHEET
const styles = StyleSheet.create({
  // Loading screen container
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Loading content wrapper
  loadingContent: {
    alignItems: 'center',
  },
  
  // Loading screen app icon
  loadingIcon: {
    fontSize: SCREEN_WIDTH * 0.2,
    marginBottom: SCREEN_HEIGHT * 0.025,
  },
  
  // Loading screen title
  loadingTitle: {
    fontSize: SCREEN_WIDTH * 0.08,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  
  // Loading screen subtitle
  loadingSubtitle: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  
  // Connection status bar
  connectionBar: {
    backgroundColor: '#F59E0B',
    paddingVertical: SCREEN_HEIGHT * 0.01,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
  },
  
  // Error connection bar
  errorBar: {
    backgroundColor: '#EF4444',
  },
  
  // Connection status text
  connectionText: {
    color: '#FFFFFF',
    fontSize: SCREEN_WIDTH * 0.035,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Bottom tab bar styling
  tabBar: {
    backgroundColor: '#1F2937',
    borderTopColor: '#374151',
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? SCREEN_HEIGHT * 0.025 : SCREEN_HEIGHT * 0.01,
    marginBottom: SCREEN_HEIGHT * 0.001,
    height: Platform.OS === 'ios' ? SCREEN_HEIGHT * 0.11 : SCREEN_HEIGHT * 0.09,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  
  // Tab bar label styling
  tabBarLabel: {
    fontSize: SCREEN_WIDTH * 0.025,
    fontWeight: '600',
  },
  
  // Tab bar icon container styling
  tabBarIcon: {
    marginBottom: SCREEN_HEIGHT * 0.005,
  },
  
  // Individual tab icon styling
  tabIcon: {
    fontSize: SCREEN_WIDTH * 0.04,
  },
  
  // Active tab icon styling
  tabIconActive: {
    transform: [{ scale: 1.1 }],
  },
});
