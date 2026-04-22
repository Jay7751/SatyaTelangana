// UPDATED SubmitArticleScreen.js - Fixed Supabase image upload
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, Alert, StyleSheet,
  ScrollView, StatusBar, KeyboardAvoidingView, Platform, 
  ActivityIndicator, Dimensions, Linking
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const categories = [
  'politics', 'technology', 'sports', 'entertainment', 
  'business', 'health', 'science', 'world', 'local'
];

export default function SubmitArticleScreen({ user, userProfile }) {
  const [headline, setHeadline] = useState('');
  const [summary, setSummary] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [category, setCategory] = useState('politics');
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    requestMediaPermission();
  }, []);

  const requestMediaPermission = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to upload images for your articles.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Linking.openSettings() }
          ]
        );
      }
    } catch (error) {
      console.error('Permission request error:', error);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        exif: false,
      });

      if (!result?.canceled && result?.assets?.[0]) {
        const selectedImage = result.assets[0];
        
        if (selectedImage.fileSize && selectedImage.fileSize > 10 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Please select an image smaller than 10MB for faster upload.');
          return;
        }
        
        setImage(selectedImage);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  // FIXED: Primary upload method using blob (most reliable)
  const uploadImageBlob = async (imageUri) => {
    if (!imageUri) return null;

    try {
      console.log('Starting blob upload for:', imageUri);

      // Convert image to blob
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      console.log('Blob created, size:', blob.size, 'type:', blob.type);

      // Generate unique filename
      const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `article-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload blob to Supabase
      const { data, error } = await supabase.storage
        .from('article-images')
        .upload(fileName, blob, {
          contentType: blob.type || `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('Supabase blob upload error:', error);
        throw error;
      }

      console.log('Blob upload successful:', data);
      return data.path;

    } catch (error) {
      console.error('Blob upload error:', error);
      throw error;
    }
  };

  // FIXED: Fallback upload method using FormData
  const uploadImageFormData = async (imageUri) => {
    if (!imageUri) return null;

    try {
      console.log('Starting FormData upload for:', imageUri);

      const formData = new FormData();
      const fileExt = imageUri.split('.').pop() || 'jpg';
      const fileName = `article-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      formData.append('file', {
        uri: imageUri,
        type: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
        name: fileName,
      });

      console.log('Uploading file:', fileName);

      const { data, error } = await supabase.storage
        .from('article-images')
        .upload(fileName, formData, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('Supabase FormData upload error:', error);
        throw error;
      }

      console.log('FormData upload successful:', data);
      return data.path;

    } catch (error) {
      console.error('FormData upload error:', error);
      throw error;
    }
  };

  // Validation function
  const validateForm = () => {
    if (!headline.trim()) {
      Alert.alert('Missing Headline', 'Please enter a headline for your article');
      return false;
    }
    if (headline.trim().length < 10) {
      Alert.alert('Headline Too Short', 'Headlines should be at least 10 characters long');
      return false;
    }
    if (headline.trim().length > 200) {
      Alert.alert('Headline Too Long', 'Headlines should be less than 200 characters');
      return false;
    }
    if (!summary.trim()) {
      Alert.alert('Missing Summary', 'Please enter a summary for your article');
      return false;
    }
    if (summary.trim().length < 50) {
      Alert.alert('Summary Too Short', 'Summary should be at least 50 characters long');
      return false;
    }
    if (summary.trim().length > 1000) {
      Alert.alert('Summary Too Long', 'Summary should be less than 1000 characters');
      return false;
    }
    if (!sourceUrl.trim()) {
      Alert.alert('Missing Source URL', 'Please provide the source URL for your article');
      return false;
    }
    
    const urlRegex = /^https?:\/\/.+/;
    if (!urlRegex.test(sourceUrl.trim())) {
      Alert.alert('Invalid URL', 'Please enter a valid source URL starting with http or https');
      return false;
    }
    
    return true;
  };

  // FIXED: Complete handleSubmit with robust image upload
  const handleSubmit = async () => {
    if (userProfile?.role !== 'journalist') {
      Alert.alert('Access Denied', 'Only journalists can submit articles. Please contact an administrator if you believe this is an error.');
      return;
    }

    if (!validateForm()) return;

    setUploading(true);

    try {
      let imagePath = null;
      let imageUrl = null;

      // FIXED: Upload image with retry mechanism
      if (image) {
        console.log('Attempting image upload...');
        
        // Try blob method first (most reliable)
        try {
          imagePath = await uploadImageBlob(image.uri);
        } catch (blobError) {
          console.log('Blob upload failed, trying FormData method...');
          
          // Try FormData method as fallback
          try {
            imagePath = await uploadImageFormData(image.uri);
          } catch (formDataError) {
            console.log('Both upload methods failed');
            console.error('Blob error:', blobError);
            console.error('FormData error:', formDataError);
            
            // Ask user if they want to continue without image
            const continueWithoutImage = await new Promise((resolve) => {
              Alert.alert(
                'Image Upload Failed',
                'Unable to upload the image. Would you like to submit the article without the image?',
                [
                  { text: 'Cancel', onPress: () => resolve(false) },
                  { text: 'Continue', onPress: () => resolve(true) }
                ]
              );
            });
            
            if (!continueWithoutImage) {
              setUploading(false);
              return;
            }
            
            imagePath = null;
          }
        }

        // Generate public URL if upload was successful
        if (imagePath) {
          try {
            const { data } = supabase.storage
              .from('article-images')
              .getPublicUrl(imagePath);
            imageUrl = data.publicUrl;
            console.log('Public URL generated:', imageUrl);
          } catch (urlError) {
            console.error('Failed to generate public URL:', urlError);
            // Continue without public URL - path can still be used
          }
        }
      }

      // Prepare article data
      const articleData = {
        headline: headline.trim(),
        summary: summary.trim(),
        content: summary.trim(),
        category: category,
        imagepath: imagePath,
        imageurl: imageUrl,
        sourceurl: sourceUrl.trim(),
        sourcelink: sourceUrl.trim(),
        authorid: user.id,
        authorname: userProfile.name,
        journalistid: user.id,
        journalistname: userProfile.name,
        status: 'pending',
        isbreakingnews: false,
        likescount: 0,
        dislikescount: 0,
        sharescount: 0,
        bookmarkscount: 0,
        viewscount: 0,
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString(),
      };

      console.log('Submitting article data:', articleData);

      // FIXED: Insert article with better error handling
      const { data: insertedData, error } = await supabase
        .from('articles')
        .insert(articleData)
        .select()
        .single();

      if (error) {
        console.error('Database insert error:', error);
        throw error;
      }

      console.log('Article inserted successfully:', insertedData);

      // Success message
      Alert.alert(
        'Article Submitted!',
        imagePath 
          ? 'Your article with image has been submitted successfully and is now pending admin review. You will be notified once it is approved.'
          : 'Your article has been submitted successfully and is now pending admin review. You will be notified once it is approved.',
        [{ text: 'OK', onPress: clearForm }]
      );

    } catch (error) {
      console.error('Submit error:', error);
      
      let errorMessage = 'Failed to submit your article. Please check your internet connection and try again.';
      
      if (error.message?.includes('unauthorized')) {
        errorMessage = 'You do not have permission to submit articles. Please contact support.';
      } else if (error.message?.includes('duplicate')) {
        errorMessage = 'An article with this headline already exists. Please use a different headline.';
      } else if (error.message?.includes('network')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      }
      
      Alert.alert('Submission Failed', errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const clearForm = () => {
    setHeadline('');
    setSummary('');
    setSourceUrl('');
    setCategory('politics');
    setImage(null);
  };

  const getCategoryColor = (cat) => {
    const colors = {
      politics: '#DC2626', technology: '#2563EB', sports: '#059669',
      entertainment: '#7C3AED', business: '#EA580C', health: '#DB2777',
      science: '#0891B2', world: '#4338CA', local: '#65A30D'
    };
    return colors[cat] || '#6B7280';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E40AF" />
      
      <LinearGradient colors={['#1E40AF', '#3B82F6', '#60A5FA']} style={styles.header}>
        <Text style={styles.headerTitle}>Submit Article</Text>
        <Text style={styles.headerSubtitle}>Share news with your community</Text>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.form}>
          
          {/* IMAGE PICKER SECTION */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Article Image (Optional)</Text>
            <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
              {image ? (
                <View>
                  <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                  <View style={styles.imageOverlay}>
                    <Text style={styles.imageChangeText}>Tap to change image</Text>
                    <Text style={styles.imageInfoText}>
                      {image.fileSize ? `${(image.fileSize / (1024 * 1024)).toFixed(1)}MB` : ''} • {image.width}x{image.height}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.imagePickerPlaceholder}>
                  <Text style={styles.imagePickerIcon}>📷</Text>
                  <Text style={styles.imagePickerText}>Tap to add image</Text>
                  <Text style={styles.imageSizeHint}>Max 10MB • JPG, PNG, WebP</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* HEADLINE INPUT */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Headline *</Text>
            <TextInput
              style={styles.textInput}
              value={headline}
              onChangeText={setHeadline}
              placeholder="Enter a compelling headline..."
              placeholderTextColor="#9CA3AF"
              maxLength={200}
              multiline
              textAlignVertical="top"
              returnKeyType="next"
            />
            <Text style={styles.charCount}>{headline.length}/200</Text>
          </View>

          {/* SUMMARY INPUT */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary *</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={summary}
              onChangeText={setSummary}
              placeholder="Write a brief summary of the article..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={1000}
              textAlignVertical="top"
              returnKeyType="next"
            />
            <Text style={styles.charCount}>{summary.length}/1000</Text>
          </View>

          {/* SOURCE URL INPUT */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Source URL *</Text>
            <TextInput
              style={styles.textInput}
              value={sourceUrl}
              onChangeText={setSourceUrl}
              placeholder="https://example.com/news-article"
              placeholderTextColor="#9CA3AF"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
            />
          </View>

          {/* CATEGORY SELECTION */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryContainer}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[
                    styles.categoryChip,
                    { borderColor: getCategoryColor(cat) },
                    { backgroundColor: category === cat ? getCategoryColor(cat) : '#FFFFFF' }
                  ]}
                >
                  <Text style={[
                    styles.categoryText,
                    { color: category === cat ? '#FFFFFF' : getCategoryColor(cat) }
                  ]}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* SUBMIT BUTTON */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={uploading}
            style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
          >
            <LinearGradient
              colors={uploading ? ['#9CA3AF', '#6B7280'] : ['#059669', '#10B981']}
              style={styles.submitButtonGradient}
            >
              {uploading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator color="#FFFFFF" style={{ marginRight: 10 }} />
                  <Text style={styles.submitButtonText}>
                    {image ? 'Uploading Image & Submitting...' : 'Submitting...'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>Submit for Review</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.helpText}>
            * Required fields. Your article will be reviewed by our editorial team before publication.
            {image && ' Images are automatically optimized for faster loading.'}
          </Text>
        </KeyboardAvoidingView>
      </ScrollView>
    </View>
  );
}

// All your existing styles remain the same
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: SCREEN_HEIGHT * 0.06,
    paddingBottom: SCREEN_HEIGHT * 0.03,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  headerTitle: {
    fontSize: SCREEN_WIDTH * 0.07,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  headerSubtitle: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  form: {
    padding: SCREEN_WIDTH * 0.05,
  },
  section: {
    marginBottom: SCREEN_HEIGHT * 0.03,
  },
  sectionTitle: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '700',
    color: '#111827',
    marginBottom: SCREEN_HEIGHT * 0.015,
  },
  textInput: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: SCREEN_WIDTH * 0.04,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    paddingVertical: SCREEN_HEIGHT * 0.02,
    fontSize: SCREEN_WIDTH * 0.04,
    backgroundColor: '#FFFFFF',
    color: '#111827',
  },
  textArea: {
    height: SCREEN_HEIGHT * 0.15,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: SCREEN_WIDTH * 0.03,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: SCREEN_HEIGHT * 0.01,
  },
  imagePicker: {
    height: SCREEN_HEIGHT * 0.25,
    borderRadius: SCREEN_WIDTH * 0.04,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: SCREEN_HEIGHT * 0.01,
    alignItems: 'center',
  },
  imageChangeText: {
    color: '#FFFFFF',
    fontSize: SCREEN_WIDTH * 0.035,
    fontWeight: '600',
  },
  imageInfoText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: SCREEN_WIDTH * 0.025,
    fontWeight: '500',
    marginTop: 2,
  },
  imagePickerPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  imagePickerIcon: {
    fontSize: SCREEN_WIDTH * 0.1,
    marginBottom: SCREEN_HEIGHT * 0.015,
  },
  imagePickerText: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
    color: '#666666',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  imageSizeHint: {
    fontSize: SCREEN_WIDTH * 0.03,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  categoryContainer: {
    flexDirection: 'row',
    gap: SCREEN_WIDTH * 0.03,
    paddingHorizontal: SCREEN_WIDTH * 0.01,
  },
  categoryChip: {
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    paddingVertical: SCREEN_HEIGHT * 0.015,
    borderRadius: 25,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  categoryText: {
    fontSize: SCREEN_WIDTH * 0.035,
    fontWeight: '700',
  },
  submitButton: {
    borderRadius: SCREEN_WIDTH * 0.04,
    overflow: 'hidden',
    marginTop: SCREEN_HEIGHT * 0.025,
    marginBottom: SCREEN_HEIGHT * 0.02,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.7,
    shadowOpacity: 0.1,
  },
  submitButtonGradient: {
    paddingVertical: SCREEN_HEIGHT * 0.022,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '700',
  },
  helpText: {
    fontSize: SCREEN_WIDTH * 0.033,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: SCREEN_WIDTH * 0.05,
    marginBottom: SCREEN_HEIGHT * 0.05,
  },
});
