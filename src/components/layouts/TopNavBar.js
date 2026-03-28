import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
  Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { ROLE_THEMES } from '../../constants/themes';

export default function TopNavBar({ title, onMenuPress }) {
  const { userProfile, user } = useAuth();
  console.log('Top Nav ', user?.photoURL)
  const role = userProfile?.role || 'guard';
  const theme = ROLE_THEMES[role];

  const getInitials = () => {
    const name = userProfile?.name || user?.displayName || '';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <StatusBar
        backgroundColor={theme.primary}
        barStyle="light-content"
      />
      <View style={[styles.navbar, { backgroundColor: theme.primary }]}>

        {/* hamburger */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onMenuPress}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.hamburger}>
            <View style={styles.hamburgerLine} />
            <View style={[styles.hamburgerLine, { width: 16 }]} />
            <View style={styles.hamburgerLine} />
          </View>
        </TouchableOpacity>

        {/* title */}
        <Text style={styles.title} numberOfLines={1}>
          {title || 'RegEntry'}
        </Text>

        {/* profile picture */}
        <TouchableOpacity
          style={styles.iconButton}
          activeOpacity={0.7}
        >
          {user?.photoURL ? (
            <Image
              source={{ uri: user.photoURL }}
              style={styles.profileImage}
            />
          ) : (
            <View style={[styles.profileFallback, { backgroundColor: theme.primaryDark }]}>
              <Text style={styles.profileInitials}>{getInitials()}</Text>
            </View>
          )}
        </TouchableOpacity>

      </View>
    </>
  );
}

const styles = StyleSheet.create({
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 8 : 12,
    paddingBottom: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hamburger: {
    gap: 5,
    alignItems: 'flex-start',
  },
  hamburgerLine: {
    width: 22,
    height: 2,
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.3,
    marginHorizontal: 8,
  },
  profileImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  profileFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profileInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});