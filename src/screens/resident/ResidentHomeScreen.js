import { View, Text, StyleSheet } from 'react-native';
import AppLayout from '../../components/layouts/AppLayout';

export default function ResidentHomeScreen({ navigation }) {
  const handleNavigate = (screen) => {
    navigation.navigate(screen);
  };

  return (
    <AppLayout
      title="RegEntry"
      currentScreen="ResidentHome"
      onNavigate={handleNavigate}
    >
      <View style={styles.container}>
        <Text style={styles.placeholder}>Resident home — visits coming next</Text>
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