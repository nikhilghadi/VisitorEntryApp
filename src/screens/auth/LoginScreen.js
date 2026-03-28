import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen() {
  const { signInWithGoogle, authLoading } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* top section - branding */}
      <View style={styles.topSection}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>RE</Text>
          </View>
        </View>
        <Text style={styles.appName}>RegEntry</Text>
        <Text style={styles.tagline}>Society visitor management</Text>
      </View>

      {/* middle section - illustration placeholder */}
      <View style={styles.middleSection}>
        <View style={styles.illustrationBox}>
          <Text style={styles.illustrationIcon}>🏢</Text>
          <Text style={styles.illustrationText}>
            Secure, simple visitor{'\n'}management for your society
          </Text>
        </View>
      </View>

      {/* bottom section - sign in */}
      <View style={styles.bottomSection}>
        <Text style={styles.signInLabel}>Sign in to continue</Text>

        <TouchableOpacity
          style={[styles.googleButton, authLoading && styles.googleButtonDisabled]}
          onPress={signInWithGoogle}
          disabled={authLoading}
          activeOpacity={0.85}
        >
          {authLoading ? (
            <ActivityIndicator size="small" color="#444441" />
          ) : (
            <>
              <View style={styles.googleIconContainer}>
                <Text style={styles.googleIconText}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>Sign in with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.helpText}>
          Only registered society members can sign in.{'\n'}
          Contact your admin if you need access.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topSection: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#E1F5EE',
    letterSpacing: 1,
  },
  appName: {
    fontSize: 28,
    fontWeight: '600',
    color: '#2C2C2A',
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14,
    color: '#888780',
  },
  middleSection: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  illustrationBox: {
    alignItems: 'center',
    backgroundColor: '#E1F5EE',
    borderRadius: 20,
    padding: 32,
    width: '100%',
  },
  illustrationIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  illustrationText: {
    fontSize: 15,
    color: '#085041',
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomSection: {
    flex: 2,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInLabel: {
    fontSize: 13,
    color: '#888780',
    marginBottom: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#D3D1C7',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    minHeight: 52,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  googleIconText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2C2C2A',
  },
  helpText: {
    marginTop: 20,
    fontSize: 12,
    color: '#B4B2A9',
    textAlign: 'center',
    lineHeight: 18,
  },
});