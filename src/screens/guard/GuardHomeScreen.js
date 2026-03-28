import { View, Text, StyleSheet } from 'react-native';
import AppLayout from '../../components/layouts/AppLayout';
export default function GuardHomeScreen({ navigation }) {
  const handleNavigate = (screen) => {
    navigation.navigate(screen);
  };

  return (
    <AppLayout
      title="RegEntry"
      currentScreen="GuardHome"
      onNavigate={handleNavigate}
    >
      <View style={styles.container}>
        <Text style={styles.placeholder}>Guard home — visitor list coming next</Text>
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    fontSize: 14,
    color: '#888780',
  },
});