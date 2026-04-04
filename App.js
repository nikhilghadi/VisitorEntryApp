import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/index';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  useEffect(() => {
    // handle tap on notification when app is background/closed
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.visitId) {
          // navigation happens here — we'll wire this up
          // when we add deep linking in a later phase
          //console.log('Notification tapped for visit:', data.visitId);
        }
      }
    );
    return () => subscription.remove();
  }, []);

  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}