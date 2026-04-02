import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import AppLayout from '../../components/layouts/AppLayout';

const MAX_MEMBERS = 5;

export default function FamilyMembersScreen({ navigation }) {
  const { userProfile } = useAuth();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const isOwner = userProfile?.is_owner === true;
  const flatId = userProfile?.flat_id;
  const societyId = userProfile?.society_id;

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const membersSnap = await getDocs(query(
        collection(db, 'users'),
        where('flat_id', '==', flatId),
        where('role', '==', 'resident'),
      ));
      const list = membersSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      // owner first, then alphabetical
      list.sort((a, b) => {
        if (a.is_owner && !b.is_owner) return -1;
        if (!a.is_owner && b.is_owner) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
      setMembers(list);
    } catch (e) {
      console.log('Fetch members error:', e);
      Alert.alert('Error', 'Could not load family members.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = (member) => {
    Alert.alert(
      'Deactivate member',
      `Deactivate ${member.name}? They will lose access to the app immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', member.id), {
                is_active: false,
                updated_at: serverTimestamp(),
              });
              await fetchMembers();
              Alert.alert('Done', `${member.name} has been deactivated.`);
            } catch (e) {
              Alert.alert('Error', 'Could not deactivate member.');
            }
          },
        },
      ]
    );
  };

  const handleReactivate = (member) => {
    Alert.alert(
      'Reactivate member',
      `Reactivate ${member.name}? They will regain access to the app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reactivate',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', member.id), {
                is_active: true,
                updated_at: serverTimestamp(),
              });
              await fetchMembers();
            } catch (e) {
              Alert.alert('Error', 'Could not reactivate member.');
            }
          },
        },
      ]
    );
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const activeMemberCount = members.filter((m) => m.is_active).length;
  const canAddMore = isOwner && activeMemberCount < MAX_MEMBERS;

  const renderMember = ({ item }) => {
    const isCurrentUser = item.email === userProfile?.email;
    const isMemberOwner = item.is_owner === true;

    return (
      <View style={[styles.card, !item.is_active && styles.cardInactive]}>
        {/* avatar */}
        <View style={[
          styles.avatar,
          isMemberOwner ? styles.avatarOwner : styles.avatarMember,
          !item.is_active && styles.avatarInactive,
        ]}>
          <Text style={[
            styles.avatarInitials,
            isMemberOwner ? styles.avatarInitialsOwner : styles.avatarInitialsMember,
            !item.is_active && styles.avatarInitialsInactive,
          ]}>
            {getInitials(item.name)}
          </Text>
        </View>

        {/* info */}
        <View style={styles.memberInfo}>
          <View style={styles.nameRow}>
            <Text style={[
              styles.memberName,
              !item.is_active && styles.memberNameInactive,
            ]} numberOfLines={1}>
              {item.name}
              {isCurrentUser && (
                <Text style={styles.youLabel}> (you)</Text>
              )}
            </Text>

            {/* owner crown badge */}
            {isMemberOwner && (
              <View style={styles.ownerBadge}>
                <Text style={styles.ownerBadgeIcon}>♛</Text>
                <Text style={styles.ownerBadgeText}>Owner</Text>
              </View>
            )}
          </View>

          <Text style={styles.memberEmail} numberOfLines={1}>
            {item.email}
          </Text>

          {item.phone ? (
            <Text style={styles.memberPhone}>{item.phone}</Text>
          ) : null}

          {!item.is_active && (
            <View style={styles.inactiveTag}>
              <Text style={styles.inactiveTagText}>Deactivated</Text>
            </View>
          )}
        </View>

        {/* owner actions — cannot act on self or other owners */}
        {isOwner && !isCurrentUser && !isMemberOwner && (
          <View style={styles.actionCol}>
            {item.is_active ? (
              <TouchableOpacity
                style={styles.deactivateButton}
                onPress={() => handleDeactivate(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.deactivateButtonText}>Deactivate</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.reactivateButton}
                onPress={() => handleReactivate(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.reactivateButtonText}>Reactivate</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <AppLayout
      title="Family members"
      currentScreen="FamilyMembers"
      onNavigate={(screen) => navigation.navigate(screen)}
    >
      <View style={styles.container}>

        {/* header info */}
        <View style={styles.pageHeader}>
          <View style={styles.capacityRow}>
            <Text style={styles.capacityText}>
              {activeMemberCount} / {MAX_MEMBERS} members
            </Text>
            <View style={styles.capacityBar}>
              {Array.from({ length: MAX_MEMBERS }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.capacitySegment,
                    i < activeMemberCount && styles.capacitySegmentFilled,
                  ]}
                />
              ))}
            </View>
          </View>
          {!isOwner && (
            <Text style={styles.viewOnlyNote}>
              Only the flat owner can add or remove members
            </Text>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#D85A30" />
          </View>
        ) : (
          <FlatList
            data={members}
            keyExtractor={(item) => item.id}
            renderItem={renderMember}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>👨‍👩‍👧‍👦</Text>
                <Text style={styles.emptyTitle}>No members yet</Text>
              </View>
            }
          />
        )}

        {/* add button — only owner and under limit */}
        {isOwner && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.addButton, !canAddMore && styles.addButtonDisabled]}
              onPress={() => {
                if (!canAddMore) {
                  Alert.alert(
                    'Limit reached',
                    `Maximum ${MAX_MEMBERS} members allowed per flat.`
                  );
                  return;
                }
                setAddModalOpen(true);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.addButtonText}>
                {canAddMore
                  ? '+ Add family member'
                  : `Member limit reached (${MAX_MEMBERS}/${MAX_MEMBERS})`}
              </Text>
            </TouchableOpacity>
          </View>
        )}

      </View>

      {/* add member modal */}
      <AddMemberModal
        visible={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdded={() => {
          setAddModalOpen(false);
          fetchMembers();
        }}
        userProfile={userProfile}
        existingEmails={members.map((m) => m.email)}
      />
    </AppLayout>
  );
}

// ─── add member modal ─────────────────────────────────────────
function AddMemberModal({ visible, onClose, onAdded, userProfile, existingEmails }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName('');
    setEmail('');
    setPhone('');
    setErrors({});
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const validate = () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Name is required';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = 'Enter a valid email address';
    } else if (existingEmails.includes(email.trim().toLowerCase())) {
      newErrors.email = 'This email is already registered to this flat';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (phone.trim().length < 10) {
      newErrors.phone = 'Enter a valid 10-digit number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAdd = async () => {
    if (!validate()) return;

    Alert.alert(
      'Add family member',
      `Add ${name.trim()} to your flat? They will be able to log in using ${email.trim()}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add member',
          onPress: async () => {
            try {
              setSubmitting(true);
              await addDoc(collection(db, 'users'), {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                phone: phone.trim(),
                role: 'resident',
                is_owner: false,
                is_active: true,
                flat_id: userProfile?.flat_id,
                society_id: userProfile?.society_id,
                fcm_token: '',
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
              });
              onAdded();
              reset();
            } catch (e) {
              console.log('Add member error:', e);
              Alert.alert('Error', 'Could not add member. Please try again.');
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={modalStyles.wrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={modalStyles.backdrop}
          onPress={handleClose}
          activeOpacity={1}
        />

        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />

          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Add family member</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={modalStyles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={modalStyles.scroll}
            contentContainerStyle={modalStyles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* name */}
            <View style={modalStyles.fieldGroup}>
              <Text style={modalStyles.label}>
                Full name <Text style={modalStyles.required}>*</Text>
              </Text>
              <TextInput
                style={[modalStyles.input, errors.name && modalStyles.inputError]}
                placeholder="Enter full name"
                placeholderTextColor="#B4B2A9"
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  if (errors.name) setErrors((p) => ({ ...p, name: null }));
                }}
                autoCapitalize="words"
              />
              {errors.name && <Text style={modalStyles.errorText}>{errors.name}</Text>}
            </View>

            {/* email */}
            <View style={modalStyles.fieldGroup}>
              <Text style={modalStyles.label}>
                Gmail address <Text style={modalStyles.required}>*</Text>
              </Text>
              <TextInput
                style={[modalStyles.input, errors.email && modalStyles.inputError]}
                placeholder="name@gmail.com"
                placeholderTextColor="#B4B2A9"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (errors.email) setErrors((p) => ({ ...p, email: null }));
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {errors.email
                ? <Text style={modalStyles.errorText}>{errors.email}</Text>
                : <Text style={modalStyles.hintText}>
                    They will use this Gmail to sign in
                  </Text>
              }
            </View>

            {/* phone */}
            <View style={modalStyles.fieldGroup}>
              <Text style={modalStyles.label}>
                Phone number <Text style={modalStyles.required}>*</Text>
              </Text>
              <TextInput
                style={[modalStyles.input, errors.phone && modalStyles.inputError]}
                placeholder="10-digit number"
                placeholderTextColor="#B4B2A9"
                value={phone}
                onChangeText={(t) => {
                  setPhone(t.replace(/[^0-9]/g, ''));
                  if (errors.phone) setErrors((p) => ({ ...p, phone: null }));
                }}
                keyboardType="phone-pad"
                maxLength={10}
              />
              {errors.phone && <Text style={modalStyles.errorText}>{errors.phone}</Text>}
            </View>

            {/* info note */}
            <View style={modalStyles.infoBox}>
              <Text style={modalStyles.infoText}>
                This member will be added to flat{' '}
                <Text style={modalStyles.infoTextBold}>
                  {userProfile?.flat_number || userProfile?.flat_id}
                </Text>
                {' '}and can view all visits, approve or reject visitors, and view past visits.
              </Text>
            </View>

            {/* submit */}
            <TouchableOpacity
              style={[modalStyles.submitButton, submitting && modalStyles.submitDisabled]}
              onPress={handleAdd}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={modalStyles.submitText}>Add member</Text>
              )}
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1EFE8',
  },
  pageHeader: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#D3D1C7',
    gap: 6,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  capacityText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444441',
    flexShrink: 0,
  },
  capacityBar: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
    justifyContent: 'flex-end',
  },
  capacitySegment: {
    width: 28,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D3D1C7',
  },
  capacitySegmentFilled: {
    backgroundColor: '#D85A30',
  },
  viewOnlyNote: {
    fontSize: 12,
    color: '#888780',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
  },
  cardInactive: {
    opacity: 0.6,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarOwner: {
    backgroundColor: '#FAECE7',
    borderWidth: 2,
    borderColor: '#D85A30',
  },
  avatarMember: {
    backgroundColor: '#F1EFE8',
  },
  avatarInactive: {
    backgroundColor: '#F1EFE8',
    borderColor: '#D3D1C7',
  },
  avatarInitials: {
    fontSize: 17,
    fontWeight: '700',
  },
  avatarInitialsOwner: {
    color: '#D85A30',
  },
  avatarInitialsMember: {
    color: '#888780',
  },
  avatarInitialsInactive: {
    color: '#B4B2A9',
  },
  memberInfo: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C2C2A',
  },
  memberNameInactive: {
    color: '#888780',
  },
  youLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: '#888780',
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FAECE7',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: '#F0997B',
  },
  ownerBadgeIcon: {
    fontSize: 10,
    color: '#993C1D',
  },
  ownerBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#993C1D',
  },
  memberEmail: {
    fontSize: 12,
    color: '#888780',
  },
  memberPhone: {
    fontSize: 12,
    color: '#B4B2A9',
  },
  inactiveTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1EFE8',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 2,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
  },
  inactiveTagText: {
    fontSize: 10,
    color: '#888780',
    fontWeight: '500',
  },
  actionCol: {
    flexShrink: 0,
  },
  deactivateButton: {
    backgroundColor: '#FCEBEB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 0.5,
    borderColor: '#F09595',
  },
  deactivateButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A32D2D',
  },
  reactivateButton: {
    backgroundColor: '#EAF3DE',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 0.5,
    borderColor: '#C0DD97',
  },
  reactivateButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3B6D11',
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    fontSize: 44,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#444441',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F1EFE8',
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 0.5,
    borderTopColor: '#D3D1C7',
  },
  addButton: {
    backgroundColor: '#D85A30',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#D3D1C7',
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
});

const modalStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    height: '75%',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#D3D1C7',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1EFE8',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2A',
  },
  closeText: {
    fontSize: 16,
    color: '#888780',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 4,
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
  input: {
    backgroundColor: '#F1EFE8',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#2C2C2A',
  },
  inputError: {
    borderColor: '#E24B4A',
    borderWidth: 1,
  },
  errorText: {
    fontSize: 12,
    color: '#E24B4A',
    marginTop: 5,
  },
  hintText: {
    fontSize: 12,
    color: '#B4B2A9',
    marginTop: 5,
  },
  infoBox: {
    backgroundColor: '#FAECE7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: '#F5C4B3',
  },
  infoText: {
    fontSize: 13,
    color: '#712B13',
    lineHeight: 18,
  },
  infoTextBold: {
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#D85A30',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});