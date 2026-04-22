// REVERTED NewsCard.js - Traditional horizontal engagement buttons, smaller image area
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Dimensions,
  Alert, Linking, Animated, Platform, ActivityIndicator, StatusBar,
  PanResponder, Share
} from 'react-native';
import { supabase } from '../supabase';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons'; 
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Octicons from '@expo/vector-icons/Octicons';
import SimpleLineIcons from '@expo/vector-icons/SimpleLineIcons';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// UPDATED: Reduced image area by 2 parts, increased summary area by 2 parts
const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const USABLE_HEIGHT = SCREEN_HEIGHT - STATUS_BAR_HEIGHT;
const CARD_WIDTH = SCREEN_WIDTH;
const CARD_HEIGHT = SCREEN_HEIGHT;

// UPDATED: Reduced image ratio from previous version
const IMAGE_HEIGHT = USABLE_HEIGHT * 0.41; // Reduced (was 0.4-0.55 before)
const CONTENT_HEIGHT = USABLE_HEIGHT * 0.59; // Increased (was 0.45-0.6 before)

const NewsCard = React.memo(({ 
  article, user, userProfile, onEngagement, index, connectionStatus 
}) => {
  // All existing state variables remain the same
  const [userEngagements, setUserEngagements] = useState({
    liked: false, disliked: false, bookmarked: false
  });
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [engaging, setEngaging] = useState(false);
  
  const viewShotRef = useRef();

  // All existing functions remain exactly the same
useEffect(() => {
  setImageLoading(true);
  setImageError(false);
  setHasTrackedView(false);

  fadeAnim.setValue(0);
  slideAnim.setValue(50);

  Animated.parallel([
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }),
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }),
  ]).start();

}, [article?.id]);

  const loadUserEngagements = useCallback(async () => {
    if (!user || !article?.id) return;
    
    try {
      const [engagementsResult, reactionsResult] = await Promise.all([
        supabase
          .from('engagements')
          .select('type')
          .eq('user_id', user.id)
          .eq('article_id', article.id),
        supabase
          .from('reactions')
          .select('type')
          .eq('user_id', user.id)
          .eq('article_id', article.id)
      ]);

      const allEngagements = [...(engagementsResult.data || []), ...(reactionsResult.data || [])];
      const userInteractions = allEngagements.reduce((acc, item) => {
        if (item.type) acc[`${item.type}d`] = true;const userInteractions = allEngagements.reduce((acc, item) => {
        if (item.type === 'like') acc.liked = true;
        if (item.type === 'dislike') acc.disliked = true;
        if (item.type === 'bookmark') acc.bookmarked = true;
        return acc;
      }, {
        liked: false,
        disliked: false,
        bookmarked: false
      });
        return acc;
      }, {});
      
      setUserEngagements(userInteractions);
    } catch (error) {
      console.error('Failed to load engagements:', error);
    }
  }, [user, article?.id]);

  const incrementCount = useCallback(async (columnName) => {
    if (!article?.id || connectionStatus !== 'online') return;
    
    try {
      const { error } = await supabase.rpc('increment_article_counter', {
        p_article_id: article.id,
        p_column_name: columnName
      });
      if (error) console.error('Counter increment failed:', error);
    } catch (error) {
      console.error('Counter increment error:', error);
    }
  }, [article?.id, connectionStatus]);

  const handleEngagement = useCallback(async (type) => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to interact with articles');
      return;
    }
    
    if (engaging || connectionStatus !== 'online') return;
    
    setEngaging(true);
    
    try {
      const stateKey =
        type === 'bookmark'
          ? 'bookmarked'
          : type === 'like'
          ? 'liked'
          : 'disliked';

      const isCurrentlyEngaged = userEngagements[stateKey];
      
      const newEngagements = { ...userEngagements };
      if (type === 'like') {
        newEngagements.liked = !isCurrentlyEngaged;
        newEngagements.disliked = false;
      } else if (type === 'dislike') {
        newEngagements.disliked = !isCurrentlyEngaged;
        newEngagements.liked = false;
      } else if (type === 'bookmark') {
        newEngagements.bookmarked = !isCurrentlyEngaged;
      }
      
      setUserEngagements(newEngagements);

      if (isCurrentlyEngaged) {
        await Promise.all([
          supabase.from('engagements').delete()
            .eq('user_id', user.id)
            .eq('article_id', article.id)
            .eq('type', type),
          ['like', 'dislike'].includes(type) ? 
            supabase.from('reactions').delete()
              .eq('user_id', user.id)
              .eq('article_id', article.id)
              .eq('type', type) : null
        ].filter(Boolean));
      } else {
        if (type === 'like' && userEngagements.disliked) {
          await Promise.all([
            supabase.from('engagements').delete()
              .eq('user_id', user.id)
              .eq('article_id', article.id)
              .eq('type', 'dislike'),
            supabase.from('reactions').delete()
              .eq('user_id', user.id)
              .eq('article_id', article.id)
              .eq('type', 'dislike')
          ]);
        } else if (type === 'dislike' && userEngagements.liked) {
          await Promise.all([
            supabase.from('engagements').delete()
              .eq('user_id', user.id)
              .eq('article_id', article.id)
              .eq('type', 'like'),
            supabase.from('reactions').delete()
              .eq('user_id', user.id)
              .eq('article_id', article.id)
              .eq('type', 'like')
          ]);
        }

        const engagementData = {
          user_id: user.id,
          article_id: article.id,
          type: type,
          created_at: new Date().toISOString(),
        };

        await Promise.all([
          supabase.from('engagements').insert(engagementData),
          ['like', 'dislike'].includes(type) ? 
            supabase.from('reactions').insert(engagementData) : null
        ].filter(Boolean));
      }

      if (onEngagement) onEngagement(article.id, type, !isCurrentlyEngaged);
      
    } catch (error) {
      console.error('Engagement error:', error);
      loadUserEngagements();
      Alert.alert('Connection Error', 'Unable to update. Please try again.');
    } finally {
      setEngaging(false);
    }
  }, [user, userEngagements, article?.id, onEngagement, connectionStatus, engaging, loadUserEngagements]);

  const openSource = useCallback(async () => {
    const sourceUrl = article?.sourcelink || article?.sourceurl;
    if (!sourceUrl) return;
    
    try {
      if (!hasTrackedView) {
        setHasTrackedView(true);
        await incrementCount('views_count');
        if (onEngagement) onEngagement(article.id, 'view', true);
      }
      
      const canOpenUrl = await Linking.canOpenURL(sourceUrl);
      if (canOpenUrl) {
        await Linking.openURL(sourceUrl);
      } else {
        Alert.alert('Invalid Link', 'Unable to open this source URL');
      }
    } catch (error) {
      console.error('Failed to open source:', error);
      Alert.alert('Error', 'Could not open source link');
    }
  }, [article?.sourcelink, article?.sourceurl, article?.id, hasTrackedView, incrementCount, onEngagement]);

const handleShare = useCallback(async () => {
  if (connectionStatus !== 'online') {
    Alert.alert('Offline', 'Sharing requires an internet connection');
    return;
  }

  const appStoreLink = 'https://play.google.com/store/apps/details?id=com.satyatelangana.news';
  const shareText = `${article?.headline}\n\nBreaking News!\nDownload Satya Telangana News App: ${appStoreLink}`;

  try {
    const imageUri = await captureRef(viewShotRef, {
      format: 'png',
      quality: 0.9,
      result: 'tmpfile'
    });

    const fileUri = imageUri.startsWith('file://') ? imageUri : `file://${imageUri}`;
    const appStoreLink = 'https://play.google.com/store/apps/details?id=com.satyatelangana.news';
    const shareText = `${article?.headline}\n\nBreaking News!\nDownload Satya Telangana News App: ${appStoreLink}`;

    const isAvailable = await Sharing.isAvailableAsync();

    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'image/png',
        dialogTitle: 'Share News Article',
        UTI: 'public.png',
        message: shareText
      });

      await Clipboard.setStringAsync(shareText);
      Alert.alert('Article Shared!', 'Screenshot shared successfully. Text copied to clipboard!');
    } else {
      await Share.share({
        title: 'Satya Telangana News',
        message: shareText,
        url: fileUri,
      });
    }

    await incrementCount('shares_count');
    if (onEngagement) onEngagement(article.id, 'share', true);

    await FileSystem.deleteAsync(imageUri, { idempotent: true });

  } catch (error) {
      console.error('Share error:', error);

      if (error?.code !== 'cancelled') {
        try {
          await Share.share({ title: 'Satya Telangana News', message: `${article?.headline}\n\nDownload Satya Telangana News App: https://play.google.com/store/apps/details?id=com.satyatelangana.news` });
          await incrementCount('shares_count');
          if (onEngagement) onEngagement(article.id, 'share', true);
          Alert.alert('Shared Successfully', 'Article text shared!');
        } catch (fallbackError) {
          console.error('All share methods failed:', fallbackError);
          Alert.alert('Share Failed', 'Could not share article. Please try again.');
        }
      }
    }
  }, [article, connectionStatus, incrementCount, onEngagement]);


  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        return isHorizontal && Math.abs(gestureState.dx) > 20;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50 || gestureState.vx < -0.3) {
          openSource();
        }
      },
    })
  ).current;

  const getImageUrl = useCallback(() => {
    const imageSource = article?.imageurl || article?.imagepath;
    if (!imageSource) return null;
    
    if (imageSource.startsWith('http')) {
      return imageSource;
    }
    
    try {
      const { data } = supabase.storage
        .from('article-images')
        .getPublicUrl(imageSource);
      return data?.publicUrl;
    } catch (error) {
      console.error('Image URL generation failed:', error);
      return null;
    }
  }, [article?.imageurl, article?.imagepath]);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoading(false);
  }, []);

  const handleImageLoad = useCallback(() => {
    setImageLoading(false);
    setImageError(false);
  }, []);

  if (!article) {
    return (
      <View style={styles.errorCard}>
        <Text style={styles.errorText}>Article not available</Text>
      </View>
    );
  }

  const imageUrl = getImageUrl();

  return (
    <Animated.View style={[styles.cardContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      <View ref={viewShotRef} style={styles.card} collapsable={false}>
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={() => {}}
          {...panResponder.panHandlers}
          style={styles.cardTouchable}
        >
          
          {/* REVERTED: Smaller image section (35% of usable screen) */}
          <View style={styles.imageSection}>
            {imageUrl && !imageError ? (
              <View style={styles.imageContainer}>
                <Image
                  key={article?.id}
                  source={{ uri: imageUrl }}
                  style={styles.newsImage}
                  resizeMode="cover"
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                />
                {imageLoading && (
                  <View style={styles.imageLoader}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  </View>
                )}
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>
                    {article.category?.toUpperCase() || 'NEWS'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.fallbackImageContainer}>
                <View style={styles.fallbackIcon}>
                  <Text style={styles.fallbackIconText}>📰</Text>
                </View>
                <Text style={styles.fallbackText}>Satya Telangana</Text>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>
                    {article.category?.toUpperCase() || 'NEWS'}
                  </Text>
                </View>
              </View>
            )}
          </View>
          
          {/* REVERTED: Larger content section (65% of usable screen) with traditional layout */}
          <View style={styles.contentSection}>

            {/* TOP DATE / AUTHOR */}
            <View style={styles.metaRow}>
              <Text style={styles.authorText}>
                {article.author_name || article.journalist_name || 'journalist'}
              </Text>

              <Text style={styles.dateText}>
                {new Date(article.created_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </View>

            {/* HEADLINE */}
            <Text style={styles.headline} numberOfLines={3}>
              {article.headline}
            </Text>

            {/* SUMMARY */}
            <Text style={styles.summary} numberOfLines={12}>
              {article.summary}
            </Text>

            {/* BOTTOM ENGAGEMENT ROW */}
            <View style={styles.engagementRow}>

              <TouchableOpacity
                onPress={() => handleEngagement('like')}
                style={[styles.engageBtn, userEngagements.liked && styles.engageBtnActive]}
                disabled={engaging}
              >
                <SimpleLineIcons name="like" size={22} color="grey" />
                <Text style={styles.engageCount}>
                  {article.likes_count || 0}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleEngagement('dislike')}
                style={[styles.engageBtn, userEngagements.disliked && styles.engageBtnActive]}
                disabled={engaging}
              >
                <SimpleLineIcons name="dislike" size={22} color="grey" />
                <Text style={styles.engageCount}>
                  {article.dislikes_count || 0}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleShare}
                style={styles.engageBtn}
              >
                <MaterialCommunityIcons
                  name="share-outline"
                  size={22}
                  color="grey"
                />
                <Text style={styles.engageCount}>
                  {article.shares_count || 0}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleEngagement('bookmark')}
                style={[
                  styles.engageBtn,
                  userEngagements.bookmarked && styles.engageBtnActive
                ]}
              >
                <Octicons
                  name={userEngagements.bookmarked ? 'bookmark-fill' : 'bookmark'}
                  size={22}
                  color={userEngagements.bookmarked ? '#2196F3' : '#666'}
                />
              </TouchableOpacity>

            </View>

          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

// REVERTED STYLES: Traditional horizontal layout with smaller image, larger summary
const styles = StyleSheet.create({
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    overflow: 'hidden',
  },
  card: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    flexDirection: 'column',
    paddingTop: 0,
  },
  cardTouchable: {
    flex: 1,
  },
  
  // REVERTED: Smaller image section (35% of usable screen)
  imageSection: {
    width: '100%',
    height: IMAGE_HEIGHT,
    position: 'relative',
    backgroundColor: '#1a1a1a',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  newsImage: {
    width: '100%',
    height: '100%',
  },
  imageLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  fallbackImageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  fallbackIcon: {
    width: SCREEN_WIDTH * 0.15,
    height: SCREEN_WIDTH * 0.15,
    borderRadius: SCREEN_WIDTH * 0.075,
    backgroundColor: '#404040',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.015,
  },
  fallbackIconText: {
    fontSize: SCREEN_WIDTH * 0.06,
    color: '#ffffff',
  },
  fallbackText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#ffffff',
    fontWeight: '600',
  },
  categoryBadge: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.015,
    left: SCREEN_WIDTH * 0.03,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: SCREEN_WIDTH * 0.025,
    paddingVertical: SCREEN_HEIGHT * 0.006,
    borderRadius: SCREEN_WIDTH * 0.03,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: SCREEN_WIDTH * 0.025,
    fontWeight: '700',
  },
  
  // REVERTED: Larger content section (65% of usable screen)
  contentSection: {
    width: '100%',
    height: CONTENT_HEIGHT,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    paddingVertical: SCREEN_HEIGHT * 0.02,
    //flexDirection: 'column',
  },
  
  // REVERTED: Traditional horizontal engagement row
  engagementRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.015,
    paddingHorizontal: SCREEN_WIDTH * 0.01,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  
  // REVERTED: Traditional horizontal engagement buttons
  engageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SCREEN_WIDTH * 0.025,
    paddingVertical: SCREEN_HEIGHT * 0.008,
    borderRadius: SCREEN_WIDTH * 0.04,
    backgroundColor: 'rgb(255, 255, 255)',
    borderWidth: 1,
    borderColor: 'rgb(255, 255, 255)',
    minWidth: SCREEN_WIDTH * 0.1,
  },
  engageBtnActive: {
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#2196f3',
  },
  engageIcon: {
    fontSize: SCREEN_WIDTH * 0.035,
    marginRight: SCREEN_WIDTH * 0.01,
  },
  engageIconActive: {
    transform: [{ scale: 1.1 }],
  },
  engageCount: {
    fontSize: SCREEN_WIDTH * 0.025,
    fontWeight: '600',
    color: '#666666',
    minWidth: SCREEN_WIDTH * 0.035,
    textAlign: 'center',
  },
  engageCountActive: {
    color: '#2196f3',
  },
  
  // Enhanced headline with 16px font
  headline: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    lineHeight: 20,
    marginBottom: SCREEN_HEIGHT * 0.012,
    letterSpacing: -0.2,
  },
  
  // Enhanced summary with 14px font and more space
  summary: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
    flex: 1, // Takes up remaining space
    marginBottom: SCREEN_HEIGHT * 0.012,
  },
  
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  authorText: {
    fontSize: SCREEN_WIDTH * 0.028,
    color: '#666666',
    fontWeight: '600',
  },
  dateText: {
    fontSize: SCREEN_WIDTH * 0.028,
    color: '#999999',
    fontWeight: '500',
  },
  swipeHint: {
    fontSize: SCREEN_WIDTH * 0.025,
    color: '#999999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: SCREEN_HEIGHT * 0.008,
  },
  
  errorCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  errorText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#ffffff',
    fontWeight: '600',
  },
});

export default NewsCard;
