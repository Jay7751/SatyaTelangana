// Importing all necessary React Native components
import React from 'react';
import {
  View,                    // Container component
  Text,                    // Text display component
  TouchableOpacity,        // Touchable button component
  StyleSheet,              // Styling system
  StatusBar,               // Device status bar controller
  Platform,                // Platform detection (iOS/Android)
  Dimensions               // Device dimension getter
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';  // Safe area handling

// Get device screen dimensions for responsive design calculations
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ProfileScreen component - displays user profile information and logout option
export default function ProfileScreen({ user, userProfile, onLogout }) {
  return (
    <SafeAreaView style={styles.container}>
      {/* Set status bar to dark content for light background */}
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      {/* Main profile card container */}
      <View style={styles.profileCard}>
        {/* User avatar with first letter of name */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {userProfile?.name?.charAt(0)?.toUpperCase() || '👤'}
          </Text>
        </View>
        
        {/* User's full name */}
        <Text style={styles.profileName}>{userProfile?.name || 'User'}</Text>
        
        {/* User role badge */}
        <View style={styles.roleBadge}>
          <Text style={styles.profileRole}>
            {userProfile?.role?.toUpperCase() || 'USER'}
          </Text>
        </View>
        
        {/* User's email address */}
        <Text style={styles.profileEmail}>
          {userProfile?.email || user?.email}
        </Text>
        
        {/* Profile statistics row */}
        <View style={styles.profileStats}>
          {/* Role icon display */}
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {userProfile?.role === 'journalist' ? '✍️' : 
               userProfile?.role === 'admin' ? '👨‍💼' : '📖'}
            </Text>
            <Text style={styles.statLabel}>Role</Text>
          </View>
          
          {/* Account creation year */}
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {new Date(userProfile?.created_at || Date.now()).getFullYear()}
            </Text>
            <Text style={styles.statLabel}>Since</Text>
          </View>
        </View>
        
        {/* Logout button */}
        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// RESPONSIVE STYLESHEET USING RATIOS FOR ALL SCREEN SIZES
const styles = StyleSheet.create({
  // Main container - centers profile card on screen
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',              // Light gray background
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SCREEN_WIDTH * 0.05,  // 5% horizontal padding
  },
  // Profile card with shadow and rounded corners
  profileCard: {
    backgroundColor: '#FFFFFF',              // White background
    borderRadius: SCREEN_WIDTH * 0.04,      // 5% of screen width for border radius
    padding: SCREEN_WIDTH * 0.05,           // 8% of screen width for padding
    alignItems: 'center',
    shadowColor: '#000',                     // Black shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,                           // Android shadow
    minWidth: SCREEN_WIDTH * 0.8,           // Minimum 80% of screen width
    maxWidth: SCREEN_WIDTH * 0.95,          // Maximum 95% of screen width
  },
  // Circular avatar container
  avatar: {
    width: SCREEN_WIDTH * 0.225 ,            // 22.5% of screen width
    height: SCREEN_WIDTH * 0.225,           // Keep it square (same as width)
    borderRadius: SCREEN_WIDTH * 0.1125,    // Half of width for perfect circle
    backgroundColor: '#3B82F6',             // Blue background
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.01,    // 2.5% of screen height margin
    shadowColor: '#3B82F6',                 // Blue shadow to match background
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,                           // Android shadow
  },
  // Avatar text (first letter of name)
  avatarText: {
    fontSize: SCREEN_WIDTH * 0.09,          // 9% of screen width (responsive)
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // User's name text
  profileName: {
    fontSize: SCREEN_WIDTH * 0.05,          // 5% of screen width (responsive)
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: SCREEN_HEIGHT * 0.01,     // 1% of screen height margin
    textAlign: 'center',
  },
  // Role badge container
  roleBadge: {
    backgroundColor: '#F3F4F6',             // Light gray background
    paddingHorizontal: SCREEN_WIDTH * 0.04, // 4% of screen width padding
    paddingVertical: SCREEN_HEIGHT * 0.01,  // 1% of screen height padding
    borderRadius: 20,
    marginBottom: SCREEN_HEIGHT * 0.015,    // 1.5% of screen height margin
  },
  // Role text inside badge
  profileRole: {
    fontSize: SCREEN_WIDTH * 0.03,         // 3.5% of screen width (responsive)
    fontWeight: '700',
    color: '#6B7280',
  },
  // User's email text
  profileEmail: {
    fontSize: SCREEN_WIDTH * 0.035,          // 3.5% of screen width (responsive)
    color: '#4B5563',
    marginBottom: SCREEN_HEIGHT * 0.01,     // 1% of screen height margin
    textAlign: 'center',
  },
  // Container for profile statistics
  profileStats: {
    flexDirection: 'row',
    marginBottom: SCREEN_HEIGHT * 0.01,     // 4% of screen height margin
    gap: SCREEN_WIDTH * 0.1,                // 10% of screen width gap between items
  },
  // Individual statistic item
  statItem: {
    alignItems: 'center',
  },
  // Statistic number/icon
  statNumber: {
    fontSize: SCREEN_WIDTH * 0.05,          // 6% of screen width (responsive)
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: SCREEN_HEIGHT * 0.005,    // 0.5% of screen height margin
  },
  // Statistic label
  statLabel: {
    fontSize: SCREEN_WIDTH * 0.03,          // 3% of screen width (responsive)
    color: '#6B7280',
    fontWeight: '500',
  },
  // Logout button styling
  logoutButton: {
    backgroundColor: '#DC2626',             // Red background
    paddingHorizontal: SCREEN_WIDTH * 0.04, // 8% of screen width padding
    paddingVertical: SCREEN_HEIGHT * 0.017,  // 2% of screen height padding
    borderRadius: SCREEN_WIDTH * 0.04,      // 4% of screen width border radius
    shadowColor: '#DC2626',                 // Red shadow to match background
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,                           // Android shadow
  },
  // Logout button text
  logoutText: {
    color: '#FFFFFF',
    fontSize: SCREEN_WIDTH * 0.035,          // 4% of screen width (responsive)
    fontWeight: '700',
  },
});
