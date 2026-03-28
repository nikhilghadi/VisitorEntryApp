import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import TopNavBar from './TopNavBar';
import SideDrawer from './SideDrawer';

export default function AppLayout({ title, currentScreen, onNavigate, children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <View style={styles.container}>
      <TopNavBar
        title={title}
        onMenuPress={() => setDrawerOpen(true)}
      />

      <View style={styles.content}>
        {children}
      </View>

      <SideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentScreen={currentScreen}
        onNavigate={onNavigate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1EFE8',
  },
  content: {
    flex: 1,
  },
});