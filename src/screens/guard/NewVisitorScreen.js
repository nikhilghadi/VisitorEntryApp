import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, getDocs, query, where, serverTimestamp, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { getRefId } from '../../utils/firestoreHelpers';

export default function NewVisitorScreen({ navigation }) {
  const { user, userProfile } = useAuth();

  const [visitorName, setVisitorName] = useState('');
  const [selectedFlat, setSelectedFlat] = useState(null);
  const [selectedReason, setSelectedReason] = useState(null);
  const [comment, setComment] = useState('');
  const [photo, setPhoto] = useState(null);
  const [flats, setFlats] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [flatDropdownOpen, setFlatDropdownOpen] = useState(false);
  const [reasonDropdownOpen, setReasonDropdownOpen] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchFormData();
  }, []);

  const fetchFormData = async () => {
    try {
      setLoadingData(true);
      const societyId = userProfile?.society_id;

      // fetch flats for this society
      const flatsQuery = query(
        collection(db, 'flats'),
        where('society_id', '==', doc(db, 'societies', societyId))
      );
      const flatsSnap = await getDocs(flatsQuery);
      const flatsList = flatsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      // sort flat numbers alphabetically
      flatsList.sort((a, b) => a.flat_number.localeCompare(b.flat_number));
      setFlats(flatsList);

      // fetch visit reasons for this society

      const reasonsQuery = query(
        collection(db, 'visit_reasons'),
        where('society_id', '==', doc(db, 'societies', societyId))
      );
      console.log('Fetching reasons with query', reasonsQuery, societyId)
      const reasonsSnap = await getDocs(reasonsQuery);
      console.log('Reasons snap', reasonsSnap)
      if (!reasonsSnap.empty) {
        const reasonsData = reasonsSnap.docs[0].data();
      
        setReasons(reasonsData.reasons || []);
      }
    } catch (error) {
      console.log('Fetch form data error:', error);
      Alert.alert('Error', 'Unable to load form data. Please try again.');
    } finally {
      setLoadingData(false);
    }
  };

  const takePhoto = async () => {
    // request camera permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera permission required',
        'Please allow camera access to capture visitor photo.',
        [{ text: 'OK' }]
      );
      return;
    }

    // open camera only — no gallery option
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
    });

    if (!result.canceled && result.assets?.[0]) {
      setPhoto(result.assets[0]);
      // clear photo error if any
      setErrors((prev) => ({ ...prev, photo: null }));
    }
  };

  const retakePhoto = () => {
    setPhoto(null);
    takePhoto();
  };

  const validate = () => {
    const newErrors = {};
    if (!visitorName.trim()) newErrors.name = 'Visitor name is required';
    if (!selectedFlat) newErrors.flat = 'Please select a flat';
    if (!selectedReason) newErrors.reason = 'Please select a reason';
    if (!photo) newErrors.photo = 'Visitor photo is mandatory';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadPhoto = async (photoUri) => {
    const societyId = userProfile?.society_id;
    const flatId = userProfile?.flat_id;
    const timestamp = Date.now();
    const fileName = `visitor_${timestamp}.jpg`;
    const storagePath = `visitors/${societyId}/${flatId}/${fileName}`;

    const response = await fetch(photoUri);
    const blob = await response.blob();

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setSubmitting(true);

      const societyId = userProfile?.society_id;
      const guardDocId = userProfile?.id;

      // upload photo to Firebase Storage
      const imageUrl = await uploadPhoto(photo.uri);

      // check if flat requires approval
      const approvalRequired = selectedFlat?.approval_required || false;
      const initialStatus = approvalRequired ? 'pending' : 'approved';

      // write visitor document to Firestore
      await addDoc(collection(db, 'visitors'), {
        name: visitorName.trim(),
        reason_for_visit: selectedReason,
        comment: comment.trim(),
        image_url: imageUrl,
        flat_id: doc(db, 'flats', selectedFlat.id),
        society_id: doc(db, 'societies', societyId),
        guard_id: doc(db, 'users', guardDocId),
        in_time: serverTimestamp(),
        exit_time: null,
        status: initialStatus,
        is_flagged: false,
        within_geofence: true,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      Alert.alert(
        'Visitor registered',
        approvalRequired
          ? 'Entry created. Waiting for resident approval.'
          : 'Visitor registered successfully.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.log('Submit error:', error);
      Alert.alert('Error', 'Failed to register visitor. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1D9E75" />
        <Text style={styles.loadingText}>Loading form...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>

        {/* header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New visitor</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* visitor name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Visitor name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.textInput, errors.name && styles.inputError]}
              placeholder="Enter full name"
              placeholderTextColor="#B4B2A9"
              value={visitorName}
              onChangeText={(t) => {
                setVisitorName(t);
                if (errors.name) setErrors((p) => ({ ...p, name: null }));
              }}
              autoCapitalize="words"
              returnKeyType="done"
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          {/* flat dropdown */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Flat number <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.dropdown, errors.flat && styles.inputError]}
              onPress={() => setFlatDropdownOpen(true)}
              activeOpacity={0.8}
            >
              <Text style={selectedFlat ? styles.dropdownSelected : styles.dropdownPlaceholder}>
                {selectedFlat ? selectedFlat.flat_number : 'Select flat'}
              </Text>
              <Text style={styles.dropdownArrow}>▾</Text>
            </TouchableOpacity>
            {errors.flat && <Text style={styles.errorText}>{errors.flat}</Text>}
          </View>

          {/* reason dropdown */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Reason for visit <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.dropdown, errors.reason && styles.inputError]}
              onPress={() => setReasonDropdownOpen(true)}
              activeOpacity={0.8}
            >
              <Text style={selectedReason ? styles.dropdownSelected : styles.dropdownPlaceholder}>
                {selectedReason || 'Select reason'}
              </Text>
              <Text style={styles.dropdownArrow}>▾</Text>
            </TouchableOpacity>
            {errors.reason && <Text style={styles.errorText}>{errors.reason}</Text>}
          </View>

          {/* photo capture */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Visitor photo <Text style={styles.required}>*</Text>
            </Text>

            {!photo ? (
              <TouchableOpacity
                style={[styles.photoBox, errors.photo && styles.photoBoxError]}
                onPress={takePhoto}
                activeOpacity={0.8}
              >
                <View style={styles.cameraIconBox}>
                  <Text style={styles.cameraIcon}>📷</Text>
                </View>
                <Text style={styles.photoBoxText}>Tap to capture photo</Text>
                <Text style={styles.photoBoxSubText}>Camera only — no gallery upload</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.photoPreviewBox}>
                <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={retakePhoto}
                  activeOpacity={0.8}
                >
                  <Text style={styles.retakeText}>Retake photo</Text>
                </TouchableOpacity>
              </View>
            )}

            {errors.photo && <Text style={styles.errorText}>{errors.photo}</Text>}
          </View>

          {/* comment */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Comment <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Any additional notes..."
              placeholderTextColor="#B4B2A9"
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* submit */}
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <View style={styles.submitRow}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.submitButtonText}>Registering visitor...</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>Register visitor</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* flat picker modal */}
        <DropdownModal
          visible={flatDropdownOpen}
          onClose={() => setFlatDropdownOpen(false)}
          title="Select flat"
          items={flats.map((f) => ({ label: f.flat_number, value: f }))}
          onSelect={(item) => {
            setSelectedFlat(item.value);
            if (errors.flat) setErrors((p) => ({ ...p, flat: null }));
            setFlatDropdownOpen(false);
          }}
          selectedLabel={selectedFlat?.flat_number}
        />

        {/* reason picker modal */}
        <DropdownModal
          visible={reasonDropdownOpen}
          onClose={() => setReasonDropdownOpen(false)}
          title="Select reason"
          items={reasons.map((r) => ({ label: r, value: r }))}
          onSelect={(item) => {
            setSelectedReason(item.value);
            if (errors.reason) setErrors((p) => ({ ...p, reason: null }));
            setReasonDropdownOpen(false);
          }}
          selectedLabel={selectedReason}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

// reusable dropdown modal component
function DropdownModal({ visible, onClose, title, items, onSelect, selectedLabel }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={modalStyles.backdrop} onPress={onClose} activeOpacity={1}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <Text style={modalStyles.title}>{title}</Text>
          <FlatList
            data={items}
            keyExtractor={(item) => item.label}
            renderItem={({ item }) => {
              const isSelected = item.label === selectedLabel;
              return (
                <TouchableOpacity
                  style={[modalStyles.item, isSelected && modalStyles.itemSelected]}
                  onPress={() => onSelect(item)}
                  activeOpacity={0.7}
                >
                  <Text style={[modalStyles.itemText, isSelected && modalStyles.itemTextSelected]}>
                    {item.label}
                  </Text>
                  {isSelected && <Text style={modalStyles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={modalStyles.separator} />}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1EFE8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1EFE8',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#888780',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1D9E75',
    paddingTop: Platform.OS === 'android' ? 48 : 56,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 60,
  },
  backText: {
    color: '#E1F5EE',
    fontSize: 14,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 8,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#444441',
    marginBottom: 8,
  },
  required: {
    color: '#E24B4A',
  },
  optional: {
    color: '#B4B2A9',
    fontWeight: '400',
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#2C2C2A',
  },
  textArea: {
    minHeight: 88,
    paddingTop: 13,
  },
  inputError: {
    borderColor: '#E24B4A',
    borderWidth: 1,
  },
  errorText: {
    fontSize: 12,
    color: '#E24B4A',
    marginTop: 5,
    marginLeft: 2,
  },
  dropdown: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownSelected: {
    fontSize: 15,
    color: '#2C2C2A',
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: '#B4B2A9',
  },
  dropdownArrow: {
    fontSize: 14,
    color: '#888780',
  },
  photoBox: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D3D1C7',
    borderStyle: 'dashed',
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  photoBoxError: {
    borderColor: '#E24B4A',
  },
  cameraIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E1F5EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cameraIcon: {
    fontSize: 24,
  },
  photoBoxText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1D9E75',
  },
  photoBoxSubText: {
    fontSize: 12,
    color: '#B4B2A9',
  },
  photoPreviewBox: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  photoPreview: {
    width: '100%',
    height: 280,
    resizeMode: 'cover',
  },
  retakeButton: {
    padding: 14,
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#D3D1C7',
  },
  retakeText: {
    fontSize: 14,
    color: '#1D9E75',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#1D9E75',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#D3D1C7',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2A',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1EFE8',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  itemSelected: {
    backgroundColor: '#E1F5EE',
  },
  itemText: {
    fontSize: 15,
    color: '#2C2C2A',
  },
  itemTextSelected: {
    color: '#0F6E56',
    fontWeight: '500',
  },
  checkmark: {
    fontSize: 14,
    color: '#1D9E75',
    fontWeight: '700',
  },
  separator: {
    height: 0.5,
    backgroundColor: '#F1EFE8',
    marginHorizontal: 20,
  },
});