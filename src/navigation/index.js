import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/auth/LoginScreen';
import GuardHomeScreen from '../screens/guard/GuardHomeScreen';
import ResidentHomeScreen from '../screens/resident/ResidentHomeScreen';
import AdminHomeScreen from '../screens/admin/AdminHomeScreen';
import NewVisitorScreen from '../screens/guard/NewVisitorScreen';
// placeholder screens — we will build these next
import PlaceholderScreen from '../screens/PlaceholderScreen';
import VisitorDetailScreen from '../screens/shared/VisitorDetailScreen';
import TodaysVisitsScreen from '../screens/guard/TodaysVisitsScreen';
const Stack = createStackNavigator();

function GuardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GuardHome" component={GuardHomeScreen} />
      <Stack.Screen name="NewVisitor" component={NewVisitorScreen} />
      <Stack.Screen name="TodaysVisits" component={TodaysVisitsScreen} />
      <Stack.Screen name="VisitorDetail" component={VisitorDetailScreen} />
    </Stack.Navigator>
  );
}

function ResidentStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ResidentHome" component={ResidentHomeScreen} />
      <Stack.Screen name="VisitorDetail" component={VisitorDetailScreen} />
      <Stack.Screen name="PastVisits" component={PlaceholderScreen} />
      <Stack.Screen name="FamilyMembers" component={PlaceholderScreen} />
    </Stack.Navigator>
  );
}

function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminHome" component={AdminHomeScreen} />
      <Stack.Screen name="ManageGuards" component={PlaceholderScreen} />
      <Stack.Screen name="ManageResidents" component={PlaceholderScreen} />
      <Stack.Screen name="ManageFlats" component={PlaceholderScreen} />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1D9E75" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : userProfile?.role === 'guard' ? (
          <Stack.Screen name="GuardStack" component={GuardStack} />
        ) : userProfile?.role === 'resident' ? (
          <Stack.Screen name="ResidentStack" component={ResidentStack} />
        ) : (
          <Stack.Screen name="AdminStack" component={AdminStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}