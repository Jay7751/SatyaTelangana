// Importing all necessary React Native components and dependencies
import React, { useState } from 'react';
import {
  View,                    // Container component
  Text,                    // Text display component
  TextInput,               // Text input field component
  TouchableOpacity,        // Touchable button component
  Alert,                   // Alert dialog system
  StyleSheet,              // Styling system
  ScrollView,              // Scrollable container component
  StatusBar,               // Device status bar controller
  ActivityIndicator,       // Loading spinner component
  KeyboardAvoidingView,    // Keyboard handling component
  Platform,                // Platform detection (iOS/Android)
  Image,
  Dimensions               // Device dimension getter
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';  // Gradient background component
import { Ionicons } from '@expo/vector-icons'; // Icon library
import { supabase } from '../supabase';                  // Database connection

// Get device screen dimensions for responsive design calculations
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// LoginScreen component - handles user authentication (login and signup)
export default function LoginScreen({ onLogin, connectionStatus }) {
  // Form input states
  const [email, setEmail] = useState('');           // Email input value
  const [password, setPassword] = useState('');     // Password input value
  const [showPassword, setShowPassword] = useState(false); // Toggle for showing/hiding password
  const [name, setName] = useState('');             // Name input value (signup only)
  
  // UI state
  const [isSignUp, setIsSignUp] = useState(false);  // Toggle between login/signup modes
  const [submitting, setSubmitting] = useState(false); // Loading state during form submission

  // Function to handle authentication (both login and signup)
  const handleAuth = async () => {
    // Validate required fields
    if (!email || !password || (isSignUp && !name)) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    // Validate email format using simple regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    // Validate password strength
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters long');
      return;
    }

    // Check internet connection
    if (connectionStatus !== 'online') {
      Alert.alert('No Internet', 'Please check your internet connection and try again');
      return;
    }

    setSubmitting(true);  // Show loading indicator

    try {
      if (isSignUp) {
        // SIGNUP FLOW
        // Create new user account with Supabase Auth
        const { data, error } = await supabase.auth.signUp({
          email: email.toLowerCase().trim(),        // Normalize email
          password: password,
          options: {
            data: { name: name.trim() }             // Store name in user metadata
          }
        });

        if (error) throw error;

        // Create user profile in our custom users table
        if (data.user) {
          const { error: profileError } = await supabase
            .from('users')
            .insert([{
              id: data.user.id,                     // Use auth user ID
              email: email.toLowerCase().trim(),
              name: name.trim(),
              role: 'user',                         // Default role
              is_approved: true,                    // Auto-approve new users
              created_at: new Date().toISOString(),
            }]);

          // Log profile creation error but don't fail signup
          if (profileError) {
            console.error('Profile creation error:', profileError);
          }
        }

        // Show success message and switch to login mode
        Alert.alert(
          'Account Created! 🎉', 
          'Your account has been created successfully. Please check your email to verify your account, then you can sign in.',
          [{ text: 'OK', onPress: () => setIsSignUp(false) }]
        );
        
        // Clear form fields
        setEmail('');
        setPassword('');
        setName('');
        
      } else {
        // LOGIN FLOW
        // Authenticate user with email and password
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password: password,
        });

        if (error) throw error;

        // Get user profile from our custom users table
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')                              // Get all profile fields
          .eq('id', data.user.id)                   // Match auth user ID
          .single();                                // Expect single result

        if (profileError) {
          console.error('Profile fetch error:', profileError);
          // If profile doesn't exist, create one
          const newProfile = {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.name || data.user.email.split('@')[0],
            role: 'user',
            is_approved: true,
            created_at: new Date().toISOString(),
          };

          await supabase.from('users').insert([newProfile]);
          
          // Call parent component with user and new profile
          onLogin(data.user, newProfile);
        } else {
          // Check if user account is approved
          if (!profile.is_approved) {
            Alert.alert(
              'Account Pending', 
              'Your account is pending admin approval. Please contact support if you believe this is an error.'
            );
            await supabase.auth.signOut();  // Sign out unapproved user
            return;
          }

          // Call parent component with user and existing profile
          onLogin(data.user, profile);
        }
      }
    } catch (error) {
      console.error('Authentication error:', error);
      
      // Show user-friendly error messages
      let errorMessage = 'Authentication failed. Please try again.';
      
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error.message.includes('User already registered')) {
        errorMessage = 'An account with this email already exists. Please use the sign in option.';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Please check your email and click the confirmation link before signing in.';
      } else if (error.message.includes('Invalid email')) {
        errorMessage = 'Please enter a valid email address.';
      }
      
      Alert.alert('Authentication Error', errorMessage);
    } finally {
      setSubmitting(false);  // Hide loading indicator
    }
  };

  // Function to toggle between login and signup modes
  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    // Clear form when switching modes
    setEmail('');
    setPassword('');
    setName('');
  };

  return (
    <View style={styles.container}>
      {/* Set status bar to light content for dark gradient background */}
      <StatusBar barStyle="light-content" />
      
      {/* Beautiful gradient background */}
      <LinearGradient
        colors={['#408893', '#75a0c5']}         // Purple to blue gradient '#667eea', '#764ba2'
        style={styles.background}
      />
      
      {/* Scrollable content container */}
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"     // Allow tapping buttons when keyboard is open
        showsVerticalScrollIndicator={false}    // Hide scroll indicator
      >
        {/* Keyboard avoiding wrapper for iOS */}
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          {/* App header with logo and title */}
          <View style={styles.header}>
            <Image 
              source={require('../assets/favicon.png')} 
              style={styles.logo} 
              resizeMode="contain"
            />
            <Text style={styles.title}>Satya Telangana</Text>
            <Text style={styles.subtitle}>Your trusted news companion</Text>
          </View>
          
          {/* Authentication form card */}
          <View style={styles.formCard}>
            {/* Form title that changes based on mode */}
            <Text style={styles.formTitle}>
              {isSignUp ? 'Join Our Community' : 'Welcome Back'}
            </Text>
            
            {/* Name input - only shown in signup mode */}
            {isSignUp && (
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#9CA3AF"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"              // Capitalize first letter of each word
                returnKeyType="next"                // Show "next" button on keyboard
              />
            )}
            
            {/* Email input field */}
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"         // Show email keyboard
              autoCapitalize="none"               // Don't auto-capitalize
              autoCorrect={false}                 // Don't auto-correct
              returnKeyType="next"                // Show "next" button on keyboard
            />
            
            {/* Password input field */}
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password (min 6 characters)"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleAuth}
              />

              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? 'eye' : 'eye-off-outline'}
                  size={SCREEN_HEIGHT*0.028}  // Responsive icon size
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>

            {/* Submit button with loading state */}
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleAuth}
              disabled={submitting || connectionStatus !== 'online'}  // Disable when loading or offline
            >
              <LinearGradient
                colors={
                  submitting 
                    ? ['#9CA3AF', '#6B7280']   // disabled (gray)
                    : ['#C62828', '#E53935']   // richer red gradient
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitButtonGradient}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {isSignUp ? 'Create new Account' : 'Sign In'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Mode toggle button */}
            <TouchableOpacity
              onPress={toggleMode}
              style={styles.toggleButton}
              disabled={submitting}               // Disable when loading
            >
              <Text style={styles.toggleText}>
                {isSignUp 
                  ? 'Already have an account? Sign In' 
                  : "Don't have an account? Sign Up"
                }
              </Text>
            </TouchableOpacity>

            {/* Connection status indicator */}
            {connectionStatus !== 'online' && (
              <View style={styles.connectionStatus}>
                <Text style={styles.connectionStatusText}>
                  {connectionStatus === 'offline' ? '📴 Offline' : '⚠️ Connection Issues'}
                </Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </ScrollView>
    </View>
  );
}

// RESPONSIVE STYLESHEET USING RATIOS FOR ALL SCREEN SIZES
const styles = StyleSheet.create({
  // Main container
  container: {
    flex: 1,
  },
  
  // Gradient background overlay
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  
  // Scrollable content container
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SCREEN_WIDTH * 0.05,              // 5% of screen width padding
    paddingTop: SCREEN_HEIGHT * 0.08,          // 8% of screen height top padding
  },
  
  // SMALL LOGO
  logo: {
    width: SCREEN_WIDTH * 0.01,   // small size
    height: SCREEN_WIDTH * 0.01,
    marginBottom: SCREEN_HEIGHT * 0.015,
  },

  // Keyboard avoiding wrapper
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'center',
  },
  
  // App header section
  header: {
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.02,        // 5% of screen height margin
  },
  
  // App logo emoji
  logo: {
    fontSize: SCREEN_WIDTH * 0.16,             // 16% of screen width (responsive)
    marginBottom: SCREEN_HEIGHT * 0.02,        // 2% of screen height margin
  },
  
  // App title
  title: {
    fontSize: SCREEN_WIDTH * 0.08,             // 8% of screen width (responsive)
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: SCREEN_HEIGHT * 0.01,        // 1% of screen height margin
    textAlign: 'center',
  },
  
  // App subtitle
  subtitle: {
    fontSize: SCREEN_WIDTH * 0.04,             // 4% of screen width (responsive)
    color: 'rgba(255,255,255,0.9)',            // Semi-transparent white
    fontWeight: '500',
    textAlign: 'center',
  },
  
  // Form card container
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',  // Semi-transparent white
    borderRadius: SCREEN_WIDTH * 0.035,          // 6% of screen width border radius
    padding: SCREEN_WIDTH * 0.05,               // 8% of screen width padding
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,                              // Android shadow
  },
  
  // Form title
  formTitle: {
    fontSize: SCREEN_WIDTH * 0.07,             // 7% of screen width (responsive)
    fontWeight: '700',
    textAlign: 'center',
    color: '#1b1a1c',
    marginBottom: SCREEN_HEIGHT * 0.02,        // 4% of screen height margin
  },
  
  // Input field styling
  input: {
    borderWidth: 2,
    borderColor: '#E5E7EB',                    // Light gray border
    borderRadius: SCREEN_WIDTH * 0.02,         // 4% of screen width border radius
    padding: SCREEN_WIDTH * 0.02,              // 4% of screen width padding
    fontSize: SCREEN_WIDTH * 0.0325,             // 4% of screen width (responsive)
    backgroundColor: '#F9FAFB',                // Very light gray background
    marginBottom: SCREEN_HEIGHT * 0.015,       // 2.5% of screen height margin
    color: '#1F2937',
  },
  
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: SCREEN_WIDTH * 0.02,         // 4% of screen width border radius
    borderColor: '#E5E7EB',
    borderWidth: 2,
    marginBottom: SCREEN_HEIGHT * 0.015,
    paddingHorizontal: SCREEN_WIDTH * 0.02,              // 4% of screen width horizontal padding
  },

  passwordInput: {
    flex: 1,
    paddingVertical: SCREEN_HEIGHT * 0.015,     // 1.5% of screen height vertical padding
    fontSize: SCREEN_WIDTH * 0.0325,
    color: '#111827',
  },

  eyeButton: {
    paddingLeft: SCREEN_WIDTH * 0.02,              // 4% of screen width left padding
    paddingVertical: SCREEN_HEIGHT * 0.01,     // 1.5% of screen height vertical padding
  },

  eyeIcon: {
    fontSize: 15,
  },
  // Submit button container
  submitButton: {
    borderRadius: SCREEN_WIDTH * 0.02,          // 4% of screen width border radius
    overflow: 'hidden',
    marginTop: SCREEN_HEIGHT * 0.005,            // 1% of screen height margin
    shadowColor: '#c6c7ce',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,                               // Android shadow
  },
  
  // Disabled submit button styling
  submitButtonDisabled: {
    opacity: 0.7,
    shadowOpacity: 0.1,                         // Reduce shadow when disabled
  },
  
  // Submit button gradient background
  submitButtonGradient: {
    paddingVertical: SCREEN_HEIGHT * 0.015,     // 2.2% of screen height padding
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Submit button text
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: SCREEN_WIDTH * 0.04,            // 4.5% of screen width (responsive)
    fontWeight: '700',
  },
  
  // Mode toggle button
  toggleButton: {
    alignItems: 'center',
    marginTop: SCREEN_HEIGHT * 0.01,            // 3% of screen height margin
    paddingVertical: SCREEN_HEIGHT * 0.005,     // 1.5% of screen height padding
  },
  
  // Mode toggle button text
  toggleText: {
    color: '#191a1e',
    fontSize: SCREEN_WIDTH * 0.03,             // 4% of screen width (responsive)
    fontWeight: '600',
  },
  
  // Connection status indicator
  connectionStatus: {
    backgroundColor: '#FEE2E2',                // Light red background
    paddingVertical: SCREEN_HEIGHT * 0.015,    // 1.5% of screen height padding
    paddingHorizontal: SCREEN_WIDTH * 0.04,    // 4% of screen width padding
    borderRadius: SCREEN_WIDTH * 0.02,         // 2% of screen width border radius
    marginTop: SCREEN_HEIGHT * 0.02,           // 2% of screen height margin
    alignItems: 'center',
  },
  
  // Connection status text
  connectionStatusText: {
    color: '#DC2626',                          // Red text
    fontSize: SCREEN_WIDTH * 0.035,            // 3.5% of screen width (responsive)
    fontWeight: '600',
  },
});
