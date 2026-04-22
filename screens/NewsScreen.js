// Importing all necessary React Native components and dependencies
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,                    // Container component
  FlatList,                // Efficient list rendering component
  StyleSheet,              // Styling system
  RefreshControl,          // Pull-to-refresh functionality
  StatusBar,               // Device status bar controller
  Text,                    // Text display component
  Dimensions,              // Device dimension getter
  ActivityIndicator        // Loading spinner component
} from 'react-native';
import NewsCard from '../components/NewsCard';  // Custom news card component
import { supabase } from '../supabase';         // Database connection


// Get device screen dimensions for responsive design calculations
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Constants for pagination and performance optimization
const PAGE_SIZE = 10;                          // Number of articles to load per page

// NewsScreen component - displays the main news feed with infinite scroll
export default function NewsScreen({ user, userProfile, connectionStatus }) {
  // State for storing the list of articles
  const [articles, setArticles] = useState([]);
  
  // State for tracking initial loading (shows spinner)
  const [loading, setLoading] = useState(true);
  
  // State for tracking pull-to-refresh loading
  const [refreshing, setRefreshing] = useState(false);
  
  // State for tracking current page number for pagination
  const [page, setPage] = useState(0);
  
  // State for tracking if more articles are available to load
  const [hasMore, setHasMore] = useState(true);

  // Effect runs once when component mounts - loads initial articles
  useEffect(() => {
    loadInitialArticles();
  }, []);

  // Function to load the first page of articles
  const loadInitialArticles = async () => {
    setLoading(true);  // Show loading spinner
    try {
      // Query database for published articles, ordered by newest first
      const { data, error } = await supabase
        .from('articles')                           // From articles table
        .select('*')                                // Select all columns
        .in('status', ['published', 'approved'])    // Only published or approved articles
        .order('created_at', { ascending: false })  // Newest first
        .range(0, PAGE_SIZE - 1);                   // Get first page (0 to 9)

      if (error) throw error;

      setArticles(data || []);                      // Update articles state
      setPage(1);                                   // Set current page to 1
      setHasMore((data || []).length === PAGE_SIZE); // Check if more articles available
    } catch (error) {
      console.error('Error loading articles:', error);
      // On error, show empty state rather than crash
      setArticles([]);
    } finally {
      setLoading(false);  // Hide loading spinner
    }
  };

  // Function to load more articles for infinite scroll
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMoreArticles = async () => {
    if (!hasMore || loading || refreshing || loadingMore) return;

    setLoadingMore(true);

    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .in('status', ['published', 'approved'])
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setArticles(prev => {
        const merged = [...prev, ...(data || [])];

        return merged.filter(
          (item, index, self) =>
            index === self.findIndex(t => t.id === item.id)
        );
      });

      setPage(prev => prev + 1);
      setHasMore((data || []).length === PAGE_SIZE);

    } catch (error) {
      console.error('Error loading more articles:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Function to handle pull-to-refresh action
  const onRefresh = useCallback(async () => {
    setRefreshing(true);        // Show refresh indicator
    await loadInitialArticles(); // Reload first page
    setRefreshing(false);       // Hide refresh indicator
  }, []);

  // Function to handle engagement updates (likes, shares, etc.)
  const handleEngagement = (articleId, type, isEngaged) => {
    // Update the specific article's counter in local state
    setArticles(prevArticles =>
      prevArticles.map(article => {
        if (article.id === articleId) {
          // Calculate new count based on engagement type
          const countKey = `${type}s_count`;  // Convert 'like' to 'likes_count'
          return {
            ...article,
            [countKey]: isEngaged
              ? (article[countKey] || 0) + 1           // Increment if engaged
              : Math.max((article[countKey] || 0) - 1, 0) // Decrement but don't go below 0
          };
        }
        return article;  // Return unchanged article
      })
    );
  };

  // Function to render individual article item
  const renderArticle = useCallback(({ item, index }) => (
    <NewsCard
      article={item}                    // Pass article data
      user={user}                       // Pass current user
      userProfile={userProfile}         // Pass user profile
      onEngagement={handleEngagement}   // Pass engagement handler
      index={index}                     // Pass index for staggered animations
      connectionStatus={connectionStatus} // Pass connection status
    />
  ),[user, userProfile, connectionStatus, handleEngagement]);

  // Function to render loading indicator at bottom of list
  const renderFooter = () => {
    // Don't show footer if no more articles or already loading
    if (!hasMore || loading) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.footerText}>Loading more articles...</Text>
      </View>
    );
  };

  // Render loading state for initial load
  if (loading) {
    return (
      <View style={styles.centered}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading news...</Text>
      </View>
    );
  }

  // Render empty state if no articles found
  if (articles.length === 0) {
    return (
      <View style={styles.centered}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <Text style={styles.emptyIcon}>📰</Text>
        <Text style={styles.emptyTitle}>No articles available</Text>
        <Text style={styles.emptyText}>Check back later for fresh news updates!</Text>
      </View>
    );
  }

  // Render main news feed
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <FlatList
        data={articles}                           // Article data array
        renderItem={renderArticle}                // Render function for each item
        keyExtractor={(item, index) => `${item.id}-${index}`} // Unique key for each item
        
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: 0,
        }}
        // Pull to refresh configuration
        refreshControl={
          <RefreshControl
            refreshing={refreshing}               // Show refresh indicator
            onRefresh={onRefresh}                 // Refresh handler
            tintColor="#FFFFFF"                   // White color for dark background
            colors={['#3B82F6']}                 // Android refresh colors
          />
        }
        
        // Infinite scroll configuration
        onEndReachedThreshold={0.5}               // Load more when 50% from bottom
        onEndReached={loadMoreArticles}           // Load more handler
        ListFooterComponent={renderFooter}        // Footer with loading indicator
        
        // Performance optimizations
        removeClippedSubviews={true}              // Remove off-screen items from memory
        initialNumToRender={2}                    // Only render first 3 items initially
        maxToRenderPerBatch={2}                   // Render 3 items per batch
        windowSize={3}                            // Keep 5 screens worth of items in memory
        
        // Smooth scrolling configuration
        showsVerticalScrollIndicator={false}      // Hide scroll bar
        pagingEnabled={true}                      // Enable page-by-page scrolling
        snapToInterval={SCREEN_HEIGHT}            // Snap to each card
        decelerationRate="fast"                   // Quick deceleration
        snapToAlignment="start"                   // Snap to start of each item
        
        // Responsive item layout
        getItemLayout={(data, index) => ({
          length: SCREEN_HEIGHT,                  // Each item is full screen height
          offset: SCREEN_HEIGHT * index,         // Calculate offset for each item
          index,
        })}
      />
    </View>
  );
}

// RESPONSIVE STYLESHEET USING RATIOS FOR ALL SCREEN SIZES
const styles = StyleSheet.create({
  // Main container - full screen with black background
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  
  // Centered container for loading and empty states
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingHorizontal: SCREEN_WIDTH * 0.05,    // 5% horizontal padding
  },
  
  // Loading state text
  loadingText: {
    fontSize: SCREEN_WIDTH * 0.04,             // 4% of screen width (responsive)
    color: '#FFFFFF',
    marginTop: SCREEN_HEIGHT * 0.02,           // 2% of screen height margin
    fontWeight: '500',
  },
  
  // Empty state icon
  emptyIcon: {
    fontSize: SCREEN_WIDTH * 0.2,              // 20% of screen width (responsive)
    marginBottom: SCREEN_HEIGHT * 0.03,        // 3% of screen height margin
  },
  
  // Empty state title
  emptyTitle: {
    fontSize: SCREEN_WIDTH * 0.06,             // 6% of screen width (responsive)
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: SCREEN_HEIGHT * 0.015,       // 1.5% of screen height margin
    textAlign: 'center',
  },
  
  // Empty state description text
  emptyText: {
    fontSize: SCREEN_WIDTH * 0.04,             // 4% of screen width (responsive)
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: SCREEN_WIDTH * 0.06,           // 6% line height (responsive)
  },
  
  // Footer loader container
  footerLoader: {
    paddingVertical: SCREEN_HEIGHT * 0.025,    // 2.5% of screen height padding
    alignItems: 'center',
    backgroundColor: '#000',
  },
  
  // Footer loader text
  footerText: {
    fontSize: SCREEN_WIDTH * 0.035,            // 3.5% of screen width (responsive)
    color: '#9CA3AF',
    marginTop: SCREEN_HEIGHT * 0.01,           // 1% of screen height margin
    fontWeight: '500',
  },
});
