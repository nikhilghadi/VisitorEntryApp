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
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

export default function NewVisitorScreen({ navigation }) {
  const { user, userProfile } = useAuth();

  // phone lookup state
  const [phone, setPhone] = useState('');
  const [phoneLookupDone, setPhoneLookupDone] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [existingVisitor, setExistingVisitor] = useState(null); // visitor master doc

  // form fields
  const [visitorName, setVisitorName] = useState('');
  const [selectedFlat, setSelectedFlat] = useState(null);
  const [selectedReason, setSelectedReason] = useState(null);
  const [comment, setComment] = useState('');
  const [photo, setPhoto] = useState(null); // { uri, isExisting }
  const [photoStale, setPhotoStale] = useState(false);

  // dropdown data
  const [flats, setFlats] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // UI state
  const [flatDropdownOpen, setFlatDropdownOpen] = useState(false);
  const [reasonDropdownOpen, setReasonDropdownOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const phoneInputRef = useRef(null);

  useEffect(() => {
    fetchDropdownData();
  }, []);

  // ─── fetch flats and reasons ────────────────────────────────
  const fetchDropdownData = async () => {
    try {
      setLoadingData(true);
      const societyId = userProfile?.society_id;

      const [flatsSnap, reasonsSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'flats'),
          where('society_id', '==', doc(db, 'societies', societyId))
        )),
        getDocs(query(
          collection(db, 'visit_reasons'),
          where('society_id', '==', doc(db, 'societies', societyId))
        )),
      ]);

      const flatsList = flatsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.flat_number.localeCompare(b.flat_number));
      setFlats(flatsList);
      if (!reasonsSnap.empty) {
        setReasons(reasonsSnap.docs[0].data().reasons || []);
      }
    } catch (error) {
      console.log('Fetch dropdown data error:', error);
      Alert.alert('Error', 'Unable to load form data. Please try again.');
    } finally {
      setLoadingData(false);
    }
  };

  // ─── phone number lookup ────────────────────────────────────
  const handlePhoneLookup = async () => {
    if (phone.trim().length < 10) {
      setErrors({ phone: 'Enter a valid 10-digit phone number' });
      return;
    }

    try {
      setLookingUp(true);
      setErrors({});

      const visitorSnap = await getDocs(query(
        collection(db, 'visitors'),
        where('phone', '==', phone.trim())
      ));

      if (!visitorSnap.empty) {
        // returning visitor found
        const visitorDoc = visitorSnap.docs[0];
        const visitorData = { id: visitorDoc.id, ...visitorDoc.data() };

        setExistingVisitor(visitorData);
        setVisitorName(visitorData.name || '');

        // check photo staleness
        const photoTakenAt = visitorData.photo_taken_at?.toDate?.();
        const isStale = isPhotoStale(photoTakenAt);
        setPhotoStale(isStale);

        if (visitorData.image_url && !isStale) {
          // use existing photo
          setPhoto({ uri: visitorData.image_url, isExisting: true });
        } else {
          // stale or no photo — guard must retake
          setPhoto(null);
        }

        // pre-fill last visited flat if still in our flats list
        await prefillLastVisit(visitorData.id);

      } else {
        // new visitor — blank form
        setExistingVisitor(null);
        setVisitorName('');
        setSelectedFlat(null);
        setSelectedReason(null);
        setPhoto(null);
        setComment('');
        setPhotoStale(false);
      }

      setPhoneLookupDone(true);
    } catch (error) {
      console.log('Phone lookup error:', error);
      Alert.alert('Error', 'Unable to search visitor. Please try again.');
    } finally {
      setLookingUp(false);
    }
  };

  const isPhotoStale = (photoTakenAt) => {
    if (!photoTakenAt) return true;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return photoTakenAt < sixMonthsAgo;
  };

  const prefillLastVisit = async (visitorId) => {
    try {
      // find their most recent visit to pre-fill flat and reason
      const visitsSnap = await getDocs(query(
        collection(db, 'visits'),
        where('visitor_id', '==', doc(db, 'visitors', visitorId)),
        where('society_id', '==', doc(db, 'societies', userProfile?.society_id))
      ));

      if (visitsSnap.empty) return;

      // sort by created_at and pick most recent
      const sortedVisits = visitsSnap.docs
        .map((d) => ({ id: d.id, ...d.data(), created_at: d.data().created_at?.toDate?.() }))
        .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

      const lastVisit = sortedVisits[0];

      // pre-fill reason
      if (lastVisit.reason_for_visit) {
        setSelectedReason(lastVisit.reason_for_visit);
      }

      // pre-fill flat if it exists in current society flats list
      if (lastVisit.flat_id) {
        const lastFlatId = lastVisit.flat_id?.id || lastVisit.flat_id;
        const matchingFlat = flats.find((f) => f.id === lastFlatId);
        if (matchingFlat) setSelectedFlat(matchingFlat);
      }
    } catch (e) {
      console.log('Prefill last visit error:', e);
    }
  };

  const resetPhoneSearch = () => {
    setPhone('');
    setPhoneLookupDone(false);
    setExistingVisitor(null);
    setVisitorName('');
    setSelectedFlat(null);
    setSelectedReason(null);
    setPhoto(null);
    setComment('');
    setPhotoStale(false);
    setErrors({});
    setTimeout(() => phoneInputRef.current?.focus(), 100);
  };

  // ─── camera ─────────────────────────────────────────────────
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera permission required',
        'Please allow camera access to capture visitor photo.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
    });

    if (!result.canceled && result.assets?.[0]) {
      setPhoto({ uri: result.assets[0].uri, isExisting: false });
      setErrors((p) => ({ ...p, photo: null }));
    }
  };

  // ─── validation ──────────────────────────────────────────────
  const validate = () => {
    const newErrors = {};
    if (!visitorName.trim()) newErrors.name = 'Visitor name is required';
    if (!selectedFlat) newErrors.flat = 'Please select a flat';
    if (!selectedReason) newErrors.reason = 'Please select a reason';
    if (!photo) newErrors.photo = 'Visitor photo is mandatory';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─── photo upload ────────────────────────────────────────────
  const uploadPhoto = async (photoUri) => {
    const fileName = `visitor_${Date.now()}.jpg`;
    const storageRef = ref(storage, `visitors/${fileName}`);
    const response = await fetch(photoUri);
    const blob = await response.blob();
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  // ─── submit ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setSubmitting(true);

      const societyId = userProfile?.society_id;
      const guardDocId = userProfile?.id;
      let visitorId;
      let finalImageUrl;

      if (!photo.isExisting) {
        // new photo taken — upload it
        finalImageUrl = await uploadPhoto(photo.uri);
      } else {
        // reusing existing photo
        finalImageUrl = existingVisitor.image_url;
      }

      if (existingVisitor) {
        // returning visitor — update master record if new photo taken
        visitorId = existingVisitor.id;
        const updateData = { updated_at: serverTimestamp() };

        if (!photo.isExisting) {
          updateData.image_url = finalImageUrl;
          updateData.photo_taken_at = serverTimestamp();
          updateData.name = visitorName.trim(); // update name if changed
        }

        await updateDoc(doc(db, 'visitors', visitorId), updateData);
      } else {
        // new visitor — create master record
        const newVisitorRef = await addDoc(collection(db, 'visitors'), {
          name: visitorName.trim(),
          phone: phone.trim(),
          image_url: finalImageUrl,
          photo_taken_at: serverTimestamp(),
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
        visitorId = newVisitorRef.id;
      }

      // create visit transaction record
      const approvalRequired = selectedFlat?.approval_required || false;
      const initialStatus = approvalRequired ? 'pending' : 'approved';

      await addDoc(collection(db, 'visits'), {
        visitor_id: doc(db, 'visitors', visitorId),
        visitor_name: visitorName.trim(),       // denormalized
        visitor_phone: phone.trim(),            // denormalized
        visitor_image_url: finalImageUrl,       // denormalized
        flat_id: doc(db, 'flats', selectedFlat.id),
        society_id: doc(db, 'societies', societyId),
        guard_id: doc(db, 'users', guardDocId),
        exit_guard_id: null,
        reason_for_visit: selectedReason,
        comment: comment.trim(),
        in_time: serverTimestamp(),
        exit_time: null,
        status: initialStatus,
        approved_by: null,
        approved_at: null,
        rejected_by: null,
        rejected_at: null,
        within_geofence: true,
        is_flagged: false,
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

  // ─── render ──────────────────────────────────────────────────
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

          {/* ── phone number field (always visible) ── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Phone number <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.phoneRow}>
              <TextInput
                ref={phoneInputRef}
                style={[
                  styles.textInput,
                  styles.phoneInput,
                  errors.phone && styles.inputError,
                  phoneLookupDone && styles.inputLocked,
                ]}
                placeholder="Enter 10-digit number"
                placeholderTextColor="#B4B2A9"
                value={phone}
                onChangeText={(t) => {
                  setPhone(t.replace(/[^0-9]/g, ''));
                  if (errors.phone) setErrors((p) => ({ ...p, phone: null }));
                }}
                keyboardType="phone-pad"
                maxLength={10}
                editable={!phoneLookupDone}
                returnKeyType="search"
                onSubmitEditing={handlePhoneLookup}
              />
              {phoneLookupDone ? (
                <TouchableOpacity
                  style={styles.changeButton}
                  onPress={resetPhoneSearch}
                  activeOpacity={0.8}
                >
                  <Text style={styles.changeButtonText}>Change</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.searchButton, lookingUp && styles.searchButtonDisabled]}
                  onPress={handlePhoneLookup}
                  disabled={lookingUp}
                  activeOpacity={0.8}
                >
                  {lookingUp
                    ? <ActivityIndicator size="small" color="#ffffff" />
                    : <Text style={styles.searchButtonText}>Search</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
          </View>

          {/* ── returning visitor banner ── */}
          {phoneLookupDone && existingVisitor && (
            <View style={styles.returningBanner}>
              <View style={styles.returningDot} />
              <Text style={styles.returningText}>
                Returning visitor — details pre-filled
              </Text>
            </View>
          )}

          {/* ── new visitor banner ── */}
          {phoneLookupDone && !existingVisitor && (
            <View style={styles.newBanner}>
              <View style={styles.newDot} />
              <Text style={styles.newBannerText}>
                New visitor — please fill all details
              </Text>
            </View>
          )}

          {/* ── rest of form only after phone lookup ── */}
          {phoneLookupDone && (
            <>
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

              {/* photo section */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>
                  Visitor photo <Text style={styles.required}>*</Text>
                </Text>

                {/* stale photo warning */}
                {photoStale && existingVisitor && (
                  <View style={styles.staleWarning}>
                    <Text style={styles.staleWarningText}>
                      Photo is older than 6 months — please capture a new one
                    </Text>
                  </View>
                )}

                {photo ? (
                  <View style={styles.photoPreviewBox}>
                    <Image source={{ uri: photo.uri }} style={styles.photoPreview} />

                    {/* existing photo label */}
                    {photo.isExisting && (
                      <View style={styles.existingPhotoLabel}>
                        <Text style={styles.existingPhotoLabelText}>
                          Existing photo on file
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.retakeButton}
                      onPress={takePhoto}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.retakeText}>
                        {photo.isExisting ? 'Retake photo' : 'Retake photo'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
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
                )}

                {errors.photo && <Text style={styles.errorText}>{errors.photo}</Text>}
              </View>

              {/* comment */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>
                  Comment <Text style={styles.optional}>(optional)</Text>
                </Text>
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
            </>
          )}

          {/* prompt when phone not searched yet */}
          {!phoneLookupDone && (
            <View style={styles.promptBox}>
              <Text style={styles.promptIcon}>🔍</Text>
              <Text style={styles.promptText}>
                Enter visitor's phone number above and tap Search to continue
              </Text>
            </View>
          )}

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

// ─── dropdown modal ─────────────────────────────────────────
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
  container: { flex: 1, backgroundColor: '#F1EFE8' },
  loadingContainer: {
    flex: 1, justifyContent: 'center',
    alignItems: 'center', backgroundColor: '#F1EFE8', gap: 12,
  },
  loadingText: { fontSize: 14, color: '#888780' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1D9E75',
    paddingTop: Platform.OS === 'android' ? 48 : 56,
    paddingBottom: 14, paddingHorizontal: 16,
  },
  backButton: { width: 60 },
  backText: { color: '#E1F5EE', fontSize: 14, fontWeight: '500' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#ffffff', letterSpacing: 0.3 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 4 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', color: '#444441', marginBottom: 8 },
  required: { color: '#E24B4A' },
  optional: { color: '#B4B2A9', fontWeight: '400' },
  phoneRow: { flexDirection: 'row', gap: 10 },
  textInput: {
    backgroundColor: '#ffffff', borderRadius: 10,
    borderWidth: 0.5, borderColor: '#D3D1C7',
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: '#2C2C2A',
  },
  phoneInput: { flex: 1 },
  inputLocked: { backgroundColor: '#F1EFE8', color: '#888780' },
  textArea: { minHeight: 88, paddingTop: 13 },
  inputError: { borderColor: '#E24B4A', borderWidth: 1 },
  errorText: { fontSize: 12, color: '#E24B4A', marginTop: 5, marginLeft: 2 },
  searchButton: {
    backgroundColor: '#1D9E75', borderRadius: 10,
    paddingHorizontal: 20, justifyContent: 'center',
    alignItems: 'center', minWidth: 80,
  },
  searchButtonDisabled: { opacity: 0.6 },
  searchButtonText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  changeButton: {
    backgroundColor: '#F1EFE8', borderRadius: 10, borderWidth: 0.5,
    borderColor: '#D3D1C7', paddingHorizontal: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  changeButtonText: { fontSize: 14, fontWeight: '500', color: '#5F5E5A' },
  returningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EAF3DE', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 0.5, borderColor: '#C0DD97',
  },
  returningDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#639922' },
  returningText: { fontSize: 13, color: '#3B6D11', fontWeight: '500' },
  newBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#E1F5EE', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 0.5, borderColor: '#9FE1CB',
  },
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1D9E75' },
  newBannerText: { fontSize: 13, color: '#085041', fontWeight: '500' },
  staleWarning: {
    backgroundColor: '#FAEEDA', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 10, borderWidth: 0.5, borderColor: '#FAC775',
  },
  staleWarningText: { fontSize: 12, color: '#854F0B', fontWeight: '500' },
  dropdown: {
    backgroundColor: '#ffffff', borderRadius: 10,
    borderWidth: 0.5, borderColor: '#D3D1C7',
    paddingHorizontal: 14, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dropdownSelected: { fontSize: 15, color: '#2C2C2A' },
  dropdownPlaceholder: { fontSize: 15, color: '#B4B2A9' },
  dropdownArrow: { fontSize: 14, color: '#888780' },
  photoBox: {
    backgroundColor: '#ffffff', borderRadius: 10,
    borderWidth: 1, borderColor: '#D3D1C7', borderStyle: 'dashed',
    paddingVertical: 32, alignItems: 'center', gap: 8,
  },
  photoBoxError: { borderColor: '#E24B4A' },
  cameraIconBox: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#E1F5EE', alignItems: 'center',
    justifyContent: 'center', marginBottom: 4,
  },
  cameraIcon: { fontSize: 24 },
  photoBoxText: { fontSize: 15, fontWeight: '500', color: '#1D9E75' },
  photoBoxSubText: { fontSize: 12, color: '#B4B2A9' },
  photoPreviewBox: { borderRadius: 10, overflow: 'hidden', backgroundColor: '#ffffff' },
  photoPreview: { width: '100%', height: 280, resizeMode: 'cover' },
  existingPhotoLabel: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingVertical: 6, paddingHorizontal: 12,
    alignItems: 'center',
  },
  existingPhotoLabelText: { fontSize: 12, color: '#ffffff', fontWeight: '500' },
  retakeButton: {
    padding: 14, alignItems: 'center',
    borderTopWidth: 0.5, borderTopColor: '#D3D1C7',
    backgroundColor: '#ffffff',
  },
  retakeText: { fontSize: 14, color: '#1D9E75', fontWeight: '500' },
  submitButton: {
    backgroundColor: '#1D9E75', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  submitButtonDisabled: { opacity: 0.65 },
  submitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  submitButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff', letterSpacing: 0.2 },
  promptBox: {
    alignItems: 'center', paddingVertical: 48,
    paddingHorizontal: 32, gap: 12,
  },
  promptIcon: { fontSize: 40 },
  promptText: { fontSize: 14, color: '#888780', textAlign: 'center', lineHeight: 22 },
});

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#ffffff', borderTopLeftRadius: 20,
    borderTopRightRadius: 20, paddingBottom: 32, maxHeight: '70%',
  },
  handle: {
    width: 36, height: 4, backgroundColor: '#D3D1C7',
    borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  title: {
    fontSize: 16, fontWeight: '600', color: '#2C2C2A',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 0.5, borderBottomColor: '#F1EFE8',
  },
  item: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16,
  },
  itemSelected: { backgroundColor: '#E1F5EE' },
  itemText: { fontSize: 15, color: '#2C2C2A' },
  itemTextSelected: { color: '#0F6E56', fontWeight: '500' },
  checkmark: { fontSize: 14, color: '#1D9E75', fontWeight: '700' },
  separator: { height: 0.5, backgroundColor: '#F1EFE8', marginHorizontal: 20 },
});