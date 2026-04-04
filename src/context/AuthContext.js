import { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {
  GoogleAuthProvider,
  signInWithCredential,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import * as Notifications from 'expo-notifications';

const AuthContext = createContext({});

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  offlineAccess: true,
  scopes: ['profile', 'email'],
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await loadUserProfile(firebaseUser);
      } else {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);


  const saveFcmToken = async (userDocId) => {
    try {
      // request permission
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permission denied');
        return;
      }

      // get FCM token
      const tokenData = await Notifications.getDevicePushTokenAsync();


      const fcmToken = tokenData.data;
      
      if (fcmToken) {
        console.log('FCM token returned and saved:', fcmToken);
        return fcmToken;
      }
    } catch (e) {
      console.log('Save FCM token error:', e);
    }
  };

  // full sign out from both Firebase and Google
  // so user can pick a different account next time
  const fullSignOut = async () => {
    try {
      await signOut(auth);
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
    } catch (e) {
      console.log('Full sign out error:', e);
    }
    setUser(null);
    setUserProfile(null);
    setLoading(false);
    setAuthLoading(false);
  };

  const loadUserProfile = async (firebaseUser) => {
    try {
      const email = firebaseUser.email;

      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        await fullSignOut();
        Alert.alert(
          'Access denied',
          'Your Google account is not registered with any society. Please contact your society admin or sign in with a different account.',
          [{ text: 'OK' }]
        );
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const profile = { id: userDoc.id, ...userDoc.data() };

      // convert Firestore Reference fields to plain strings
      if (profile.society_id?.id) profile.society_id = profile.society_id.id;
      if (profile.flat_id?.id) profile.flat_id = profile.flat_id.id;

      if (!profile.is_active) {
        await fullSignOut();
        Alert.alert(
          'Account deactivated',
          'Your account has been deactivated. Please contact your society admin.',
          [{ text: 'OK' }]
        );
        return;
      }

      // if resident — fetch flat number in same login flow
      if (profile.role === 'resident' && profile.flat_id) {
        try {
          console.log('fetching flat id',profile.flat_id)
          const flatDoc = await getDoc(doc(db, 'flats', profile.flat_id));
          if (flatDoc.exists()) {
            profile.flat_number = flatDoc.data().flat_number;
            profile.flat = flatDoc.data();
          }
          
        } catch (e) {
          console.log('Could not fetch flat details:', e);
          // non-critical — app still works without flat_number
        }
      }
      try {
        const societyDoc = await getDoc(doc(db, 'societies', profile.society_id));
        console.log('fetching society id',profile.society_id. societyDoc)
        if (societyDoc.exists()) {
          profile.society = societyDoc.data();
        }else{
          throw new Error('Society document does not exist');
        }
      } catch (e) {
        //Critical error — society details are needed for app to function
        console.log('Could not fetch society details:', e);
        await fullSignOut();
        Alert.alert(
          'Error',
          'Unable to load your society details. Please try again later.',
          [{ text: 'OK' }]
        );
        return;
      }
      const fcmToken = await saveFcmToken(userDoc.id);

      // update uid and timestamp on first login
      await updateDoc(doc(db, 'users', userDoc.id), {
        uid: firebaseUser.uid,
        fcm_token: fcmToken || null,
        updated_at: serverTimestamp(),
      });

      setUser(firebaseUser);
      setUserProfile(profile);
      setLoading(false);
      setAuthLoading(false);
    } catch (error) {
      console.log('Load profile error:', error);
      await fullSignOut();
      Alert.alert('Error', 'Unable to load your profile. Please try again.');
    }
  };

  const signInWithGoogle = async () => {
    try {
      setAuthLoading(true);

      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken || userInfo.idToken;

      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);

      // loadUserProfile triggers automatically via onAuthStateChanged

    } catch (error) {
      setAuthLoading(false);

      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      } else if (error.code === statusCodes.IN_PROGRESS) {
        Alert.alert('Please wait', 'Sign in is already in progress.');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert(
          'Google Play required',
          'Google Play Services is not available on this device.'
        );
      } else {
        console.log('Google sign in error:', error);
        Alert.alert('Sign in failed', 'Unable to sign in with Google. Please try again.');
      }
    }
  };

  const logout = async () => {
    try {
      await fullSignOut();
    } catch (error) {
      console.log('Logout error:', error);
      Alert.alert('Error', 'Unable to sign out. Please try again.');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        authLoading,
        signInWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
// ```

// ---

// ### Two things to do in Firestore

// **1 — Add email field to your test user document**

// Go to **Firestore → users → your test document** and make sure the `email` field exists with the exact Gmail address you're signing in with:
// ```
// email: "yourname@gmail.com"   ← must match exactly, case sensitive
// ```

// **2 — Add a Firestore index**

// Since we're now querying by email, Firestore needs an index. Go to **Firestore → Indexes → Add Index**:
// ```
// Collection  → users
// Field 1     → email      (Ascending)
// Field 2     → is_active  (Ascending)
// Query scope → Collection