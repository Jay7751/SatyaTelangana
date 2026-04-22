import React, { useState, useEffect, useCallback } from 'react';
import {
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet,
  RefreshControl,
  TextInput,
  Alert,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../supabase';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AdminDashboardScreen({ user, userProfile }) {
  const [pending, setPending] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newJournalistEmail, setNewJournalistEmail] = useState('');
  const [newJournalistName, setNewJournalistName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [pendingRes, usersRes, statsRes] = await Promise.all([
        supabase.from('articles').select('*').eq('status','pending'),
        supabase.from('users').select('*'),
        supabase.rpc('dashboard_stats') // Assuming a stats function exists
      ]);
      if (pendingRes.error||usersRes.error) throw pendingRes.error||usersRes.error;
      setPending(pendingRes.data || []);
      setUsers(usersRes.data || []);
      setStats(statsRes.data || {});
    } catch (error) {
      console.error('Dashboard load error:', error);
      Alert.alert('Error','Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (userProfile.role === 'admin') loadDashboard();
  }, [userProfile]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const handleApprove = async (id) => {
    try {
      const { error } = await supabase
        .from('articles')
        .update({ status:'approved' })
        .eq('id',id);
      if (error) throw error;
      loadDashboard();
    } catch {
      Alert.alert('Error','Approval failed');
    }
  };
  const handleReject = async (id, reason) => {
    try {
      const { error } = await supabase
        .from('articles')
        .update({ status:'rejected', rejection_reason:reason })
        .eq('id',id);
      if (error) throw error;
      loadDashboard();
    } catch {
      Alert.alert('Error','Rejection failed');
    }
  };

  const createJournalist = async () => {
    if (!newJournalistEmail) {
      Alert.alert('Missing Email','Please enter an email');
      return;
    }
    setCreating(true);
    try {
      const password = Math.random().toString(36).slice(-8);
      const { error:authError } = await supabase.auth.admin.createUser({
        email:newJournalistEmail,
        password,
        user_metadata:{ name:newJournalistName||'' }
      });
      if (authError) throw authError;
      Alert.alert(
        'Journalist Created',
        `Email: ${newJournalistEmail}\nPassword: ${password}`
      );
      setNewJournalistEmail('');
      setNewJournalistName('');
      loadDashboard();
    } catch (error) {
      console.error('Create journalist error:',error);
      Alert.alert('Error','Could not create journalist');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6"/>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <StatusBar barStyle="light-content" backgroundColor="#111827"/>
      <LinearGradient colors={['#111827','#1F2937']} style={styles.header}>
        <Text style={styles.headerText}>Admin Dashboard</Text>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}><Text style={styles.statNumber}>{stats.totalUsers}</Text><Text>Users</Text></View>
          <View style={styles.statBox}><Text style={styles.statNumber}>{stats.totalArticles}</Text><Text>Articles</Text></View>
          <View style={styles.statBox}><Text style={styles.statNumber}>{stats.pendingArticles}</Text><Text>Pending</Text></View>
          <View style={styles.statBox}><Text style={styles.statNumber}>{stats.totalJournalists}</Text><Text>Journalists</Text></View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pending Articles</Text>
        {pending.map(article => (
          <View key={article.id} style={styles.articleBox}>
            <Text style={styles.articleHeadline}>{article.headline}</Text>
            <View style={styles.articleActions}>
              <TouchableOpacity onPress={() => handleApprove(article.id)} style={styles.approveBtn}>
                <Text style={styles.approveText}>✅ Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                Alert.prompt('Rejection Reason','Enter reason', reason => handleReject(article.id,reason));
              }} style={styles.rejectBtn}>
                <Text style={styles.rejectText}>❌ Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Create Journalist</Text>
        <TextInput
          style={styles.input}
          placeholder="Name (optional)"
          value={newJournalistName}
          onChangeText={setNewJournalistName}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={newJournalistEmail}
          onChangeText={setNewJournalistEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TouchableOpacity 
          style={[styles.createBtn, creating && styles.createBtnDisabled]} 
          onPress={createJournalist}
          disabled={creating}
        >
          {creating ? <ActivityIndicator color="#FFF"/> : <Text style={styles.createText}>✚ Create</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({

  // =========================
  // SCREEN LAYOUT
  // =========================

  container: {
    flex: 1,                          // Fill entire screen
    backgroundColor: '#F9FAFB',
    paddingTop: 10,
    marginBottom: SCREEN_HEIGHT*0.02,       // Light gray background
  },

  centered: {
    flex: 1,
    justifyContent: 'center',         // Center vertically
    alignItems: 'center',             // Center horizontally
    backgroundColor: '#F9FAFB',
  },


  // =========================
  // HEADER SECTION
  // =========================

  header: {
    padding: 20,
    alignItems: 'center',             // Center header content
  },

  headerText: {
    color: '#FFF',                    // White text (used on colored background)
    fontSize: 24,
    fontWeight: '700',
    marginTop: SCREEN_HEIGHT * 0.02,    // Responsive top margin
  },


  // =========================
  // SECTION CONTAINER
  // =========================

  section: {
    padding: 20,
    borderBottomWidth: 1,             // Divider line
    borderColor: '#E5E7EB',           // Light gray border
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },


  // =========================
  // STATS GRID
  // =========================

  statsGrid: {
    flexDirection: 'row',             // Horizontal layout
    flexWrap: 'wrap',                // Move to next line if needed
    justifyContent: 'space-between', // Space between boxes
  },

  statBox: {
    width: '45%',                    // Two items per row
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 2,                    // Shadow for Android
  },

  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3B82F6',                // Blue highlight for numbers
  },


  // =========================
  // ARTICLE CARD
  // =========================

  articleBox: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },

  articleHeadline: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },

  articleActions: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Space between buttons
  },


  // =========================
  // BUTTONS (APPROVE / REJECT)
  // =========================

  approveBtn: {
    backgroundColor: '#059669',      // Green (success)
    padding: 12,
    borderRadius: 8,
  },

  approveText: {
    color: '#FFF',
    fontWeight: '600',
  },

  rejectBtn: {
    backgroundColor: '#DC2626',      // Red (danger)
    padding: 12,
    borderRadius: 8,
  },

  rejectText: {
    color: '#FFF',
    fontWeight: '600',
  },


  // =========================
  // INPUT FIELD
  // =========================

  input: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },


  // =========================
  // CREATE BUTTON
  // =========================

  createBtn: {
    backgroundColor: '#000000',      // Primary blue
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },

  createBtnDisabled: {
    backgroundColor: '#9CA3AF',      // Gray when disabled
  },

  createText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },

});
