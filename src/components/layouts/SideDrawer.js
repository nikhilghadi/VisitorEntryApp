import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Image,
  ScrollView,
} from 'react-native';
import { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_THEMES, DRAWER_MENU } from '../../constants/themes';
import { getRefId } from '../../utils/firestoreHelpers';

const DRAWER_WIDTH = Dimensions.get('window').width * 0.72;

export default function SideDrawer({ isOpen, onClose, currentScreen, onNavigate }) {
  const { userProfile, user, logout } = useAuth();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const role = userProfile?.role || 'guard';
  const theme = ROLE_THEMES[role];
  const menuItems = DRAWER_MENU[role] || [];

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen]);

  const getInitials = () => {
    const name = userProfile?.name || user?.displayName || '';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  const getFlatInfo = () => {
    if (role !== 'resident') return null;
    // flat_number is now directly available from profile
    return userProfile?.flat_number || null;
  };

  if (!isOpen) return null;
  //console.log("Side Drawer user", userProfile)
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: backdropAnim },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* drawer panel */}
      <Animated.View
        style={[
          styles.drawer,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* user info header */}
        <View style={[styles.drawerHeader, { backgroundColor: theme.primary }]}>
          <View style={styles.avatarRow}>
            {user?.photoURL ? (
              <Image
                source={{ uri: user.photoURL }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: theme.primaryDark }]}>
                <Text style={styles.avatarInitials}>{getInitials()}</Text>
              </View>
            )}
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {userProfile?.name || user?.displayName || 'User'}
              </Text>
              <View style={styles.rolePill}>
                <Text style={[styles.roleText, { color: theme.primary }]}>
                  {theme.label}
                </Text>
              </View>
              {getFlatInfo() && (
                <Text style={styles.flatText}>Flat {getFlatInfo()}</Text>
              )}
            </View>
          </View>
        </View>

        {/* menu items */}
        <ScrollView style={styles.menuList} showsVerticalScrollIndicator={false}>
          {menuItems.map((item) => {
            const isActive = currentScreen === item.screen;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.menuItem,
                  isActive && { backgroundColor: theme.primaryLight },
                ]}
                onPress={() => {
                  onNavigate(item.screen);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.activeIndicator,
                    { backgroundColor: isActive ? theme.primary : 'transparent' },
                  ]}
                />
                <Text
                  style={[
                    styles.menuItemText,
                    isActive
                      ? { color: theme.primaryDark, fontWeight: '600' }
                      : { color: '#444441' },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* logout button */}
        <View style={styles.drawerFooter}>
          <View style={styles.footerDivider} />
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={logout}
            activeOpacity={0.7}
          >
            <View style={styles.logoutIconBox}>
              <Text style={styles.logoutIcon}>→</Text>
            </View>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#ffffff',
    flexDirection: 'column',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  drawerHeader: {
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.1,
  },
  rolePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  flatText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  menuList: {
    flex: 1,
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 8,
    marginVertical: 1,
    borderRadius: 10,
  },
  activeIndicator: {
    width: 3,
    height: 20,
    borderRadius: 2,
    marginRight: 14,
  },
  menuItemText: {
    fontSize: 15,
    letterSpacing: 0.1,
  },
  drawerFooter: {
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  footerDivider: {
    height: 0.5,
    backgroundColor: '#D3D1C7',
    marginBottom: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 14,
  },
  logoutIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FCEBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIcon: {
    fontSize: 14,
    color: '#A32D2D',
    fontWeight: '700',
  },
  logoutText: {
    fontSize: 15,
    color: '#A32D2D',
    fontWeight: '500',
  },
});