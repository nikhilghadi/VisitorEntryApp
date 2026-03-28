import { View, Text, StyleSheet } from 'react-native';
import AppLayout from '../components/layouts/AppLayout';

export default function PlaceholderScreen({ navigation, route }) {
  return (
    <AppLayout
      title={route?.name || 'Coming soon'}
      currentScreen={route?.name}
      onNavigate={(screen) => navigation.navigate(screen)}
    >
      <View style={styles.container}>
        <Text style={styles.text}>Coming soon</Text>
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 14, color: '#888780' },
});
// ```

// ---

// ### Your updated folder structure
// ```
// src/
//   ├── constants/
//   │   └── themes.js          ← new
//   ├── components/
//   │   └── layout/
//   │       ├── AppLayout.js   ← new
//   │       ├── TopNavBar.js   ← new
//   │       └── SideDrawer.js  ← new
//   ├── screens/
//   │   ├── PlaceholderScreen.js ← new
//   │   ├── auth/LoginScreen.js
//   │   ├── guard/GuardHomeScreen.js   ← updated
//   │   ├── resident/ResidentHomeScreen.js ← updated
//   │   └── admin/AdminHomeScreen.js   ← updated
//   ├── navigation/index.js    ← updated
//   ├── context/AuthContext.js
//   └── config/firebase.js