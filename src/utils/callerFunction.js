import{  Linking, Alert} from 'react-native';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
export const handleCall = async (item, role = 'guard') => {
    try {
      // extract flat ID from visit document
      const flatId = item.flat_id?.id || item.flat_id;
      if (!flatId) {
        Alert.alert('Error', 'Flat information not found.');
        return;
      }
      let ownersSnap;
      let phone = null;
      let name = null;
      // find the flat owner — is_owner true for this flat
      if (role === 'resident') {
        // console.log("DATA 0", role,item.guard_id?.id || item.guard_id, doc(db, 'users', item.guard_id?.id || item.guard_id))

        const guardId = item.guard_id?.id || item.guard_id;

        if (!guardId) {
          Alert.alert('Error', 'Guard information not found.');
          return;
        }

        // getDoc returns a single DocumentSnapshot — not a QuerySnapshot
        const guardDoc = await getDoc(doc(db, 'users', guardId));

        if (!guardDoc.exists()) {
          Alert.alert('Not found', 'Guard record not found.');
          return;
        }

        phone = guardDoc.data().phone_number;
        name = guardDoc.data().name;
      }else{
        ownersSnap = await getDocs(query(
          collection(db, 'users'),
          where('flat_id', '==', flatId),
          where('is_owner', '==', true),
          where('is_active', '==', true),
        ));
        if (ownersSnap.empty) {
          Alert.alert(
            'No owner found',
            'No active flat owner registered for this flat.'
          );
          return;
        }
        // console.log("DATA 1", ownersSnap)
        const owner = ownersSnap.docs[0].data();
        phone = owner.phone_number;
        name = owner.name;
      }

      // console.log("DATA", phone)
      if (!phone) {
        Alert.alert(
          'No phone number',
          `${name} does not have a phone number registered.`
        );
        return;
      }

      await Linking.openURL(`tel:${phone}`);

    } catch (e) {
      console.log('Call owner error:', e);
      Alert.alert('Error', 'Could not initiate call. Please try again.');
    }
  };