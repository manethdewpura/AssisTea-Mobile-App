import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
  Dimensions,
  Animated,
} from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { selectTheme, selectAuth } from '../../store/selectors';
import { logout } from '../../store/slices/auth.slice';
import { authService } from '../../services';
import ThemeSelector from './ThemeSelector';
import LogoImage from '../../common/assets/images/LogoRound.png';

interface HamburgerMenuProps {
  visible: boolean;
  onClose: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ visible, onClose }) => {
  const dispatch = useAppDispatch();
  const { colors } = useAppSelector(selectTheme);
  const { userProfile } = useAppSelector(selectAuth);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset to off-screen position first, then animate in
      slideAnim.setValue(-screenWidth * 0.85);
      fadeAnim.setValue(0);
      
      // Slide in the menu
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Show overlay instantly after menu animation completes
        fadeAnim.setValue(1);
      });
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleClose = () => {
    // Hide overlay instantly
    fadeAnim.setValue(0);
    
    // Slide out the menu
    Animated.timing(slideAnim, {
      toValue: -screenWidth * 0.85,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
      dispatch(logout());
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getRoleDisplay = () => {
    if (!userProfile) return '';
    return userProfile.role === 'admin'
      ? 'Administrator'
      : 'Tea Plantation Manager';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        {/* Menu Content */}
        <Animated.View
          style={[
            styles.menuContainer,
            {
              backgroundColor: colors.surface,
              borderRightColor: colors.border,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Lucide name="x" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Logo and User Info */}
            <View style={styles.userSection}>
              <Image source={LogoImage} style={styles.logo} />
              <Text style={[styles.userName, { color: colors.text }]}>
                {userProfile?.name || userProfile?.displayName || 'User'}
              </Text>
              <Text style={[styles.userRole, { color: colors.textSecondary }]}>
                {getRoleDisplay()}
              </Text>
              {userProfile?.email && (
                <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
                  {userProfile.email}
                </Text>
              )}
            </View>

            {/* Theme Selector */}
            <View style={[styles.section, { borderTopColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Settings
              </Text>
              <ThemeSelector />
            </View>
          </ScrollView>

          {/* Logout Button */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.logoutButton, { backgroundColor: colors.error }]}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Lucide name="log-out" size={20} color="#ffffff" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Overlay */}
        <Animated.View
          style={[
            styles.overlay,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={styles.blurOverlay} />
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleClose}
            style={styles.overlayTouchable}
          />
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  overlay: {
    flex: 1,
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  overlayTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  menuContainer: {
    width: screenWidth * 0.85,
    maxWidth: 400,
    borderRightWidth: 1,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  userSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  userEmail: {
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default HamburgerMenu;


