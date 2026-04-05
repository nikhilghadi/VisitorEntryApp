import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ROLE_THEMES } from '../../constants/themes';
import FullScreenImage from './FullScreenImage';
import { handleCall } from '../../utils/callerFunction';

const STATUS_CONFIG = {
  pending:  { label: 'Awaiting approval', bg: '#FAEEDA', text: '#854F0B', dot: '#BA7517' },
  approved: { label: 'Approved',          bg: '#EAF3DE', text: '#3B6D11', dot: '#639922' },
  active:   { label: 'Inside',            bg: '#E1F5EE', text: '#085041', dot: '#1D9E75' },
  exited:   { label: 'Exited',            bg: '#F1EFE8', text: '#5F5E5A', dot: '#888780' },
  rejected: { label: 'Rejected',          bg: '#FCEBEB', text: '#791F1F', dot: '#E24B4A' },
};

export default function VisitorDetailScreen({ navigation, route }) {
  const { visitId, approvalRequired } = route.params;
  const { userProfile } = useAuth();

  const role = userProfile?.role || 'guard';
  const theme = ROLE_THEMES[role];
  const isGuard = role === 'guard';
  const isResident = role === 'resident';

  const [visitor, setVisitor] = useState(null);
  const [entryGuard, setEntryGuard] = useState(null);
  const [exitGuard, setExitGuard] = useState(null);
  const [flatInfo, setFlatInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [fullScreenPhoto, setFullScreenPhoto] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'visits', visitId),
      async (snap) => {
        if (!snap.exists()) {
          Alert.alert('Not found', 'This visitor record no longer exists.');
          navigation.goBack();
          return;
        }
        const data = {
          id: snap.id,
          ...snap.data(),
          in_time: snap.data().in_time?.toDate?.() || null,
          exit_time: snap.data().exit_time?.toDate?.() || null,
          created_at: snap.data().created_at?.toDate?.() || null,
        };
        setVisitor(data);
        await Promise.all([
          fetchGuard(data.guard_id, 'entry'),
          fetchExitGuard(data),
          fetchFlat(data.flat_id),
        ]);
        setLoading(false);
      },
      (error) => {
        //console.log('Visitor detail error:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [visitId]);

  const getDocId = (field) => {
    if (!field) return null;
    if (typeof field === 'string') return field;
    if (field?.id) return field.id;
    return null;
  };

  const fetchGuard = async (guardField, type) => {
    try {
      const guardId = getDocId(guardField);
      if (!guardId) return;
      const guardDoc = await getDoc(doc(db, 'users', guardId));
      if (guardDoc.exists()) {
        const data = { id: guardDoc.id, ...guardDoc.data() };
        if (type === 'entry') setEntryGuard(data);
        else setExitGuard(data);
      }
    } catch (e) {
      //console.log('Fetch guard error:', e);
    }
  };

  const fetchExitGuard = async (data) => {
    if (!data.exit_time) return;
    const exitGuardField = data.exit_guard_id || data.guard_id;
    await fetchGuard(exitGuardField, 'exit');
  };

  const fetchFlat = async (flatField) => {
    try {
      const flatId = getDocId(flatField);
      if (!flatId) return;
      const flatDoc = await getDoc(doc(db, 'flats', flatId));
      if (flatDoc.exists()) setFlatInfo({ id: flatDoc.id, ...flatDoc.data() });
    } catch (e) {
      //console.log('Fetch flat error:', e);
    }
  };

  // ─── guard action ─────────────────────────────────────────
  const handleMarkExit = () => {
    Alert.alert(
      'Mark as exited',
      `Confirm that ${visitor?.visitor_name} has left the building?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm exit',
          onPress: async () => {
            try {
              setActionLoading(true);
              await updateDoc(doc(db, 'visits', visitId), {
                status: 'exited',
                exit_time: serverTimestamp(),
                exit_guard_id: doc(db, 'users', userProfile?.id),
                updated_at: serverTimestamp(),
              });
            } catch (e) {
              Alert.alert('Error', 'Could not mark exit. Please try again.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // ─── resident actions ─────────────────────────────────────
  const handleApprove = () => {
    Alert.alert(
      'Approve visitor',
      `Allow ${visitor?.visitor_name} to enter?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              setActionLoading(true);
              await updateDoc(doc(db, 'visits', visitId), {
                status: 'approved',
                approved_by: doc(db, 'users', userProfile?.id),
                approved_at: serverTimestamp(),
                updated_at: serverTimestamp(),
              });
            } catch (e) {
              Alert.alert('Error', 'Could not approve. Please try again.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = () => {
    Alert.alert(
      'Reject visitor',
      `Deny entry to ${visitor?.visitor_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await updateDoc(doc(db, 'visits', visitId), {
                status: 'rejected',
                rejected_by: doc(db, 'users', userProfile?.id),
                rejected_at: serverTimestamp(),
                updated_at: serverTimestamp(),
              });
              navigation.goBack();
            } catch (e) {
              Alert.alert('Error', 'Could not reject. Please try again.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // ─── helpers ──────────────────────────────────────────────
  const formatDateTime = (date) => {
    if (!date) return '—';
    return date.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  const formatTime = (date) => {
    if (!date) return '—';
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  const getDuration = (inTime, exitTime) => {
    if (!inTime || !exitTime) return null;
    const diff = Math.floor((exitTime - inTime) / 60000);
    if (diff < 60) return `${diff} min`;
    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // ─── what buttons to show ─────────────────────────────────
  const isPending = visitor?.status === 'pending';
  const canExit = isGuard &&
    (visitor?.status === 'approved' || visitor?.status === 'active');
  const canApproveReject = isResident && approvalRequired && isPending;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading visitor details...</Text>
      </View>
    );
  }

  if (!visitor) return null;

  const config = STATUS_CONFIG[visitor.status] || STATUS_CONFIG.pending;
  const duration = getDuration(visitor.in_time, visitor.exit_time);

  return (
    <View style={styles.container}>

      {/* header — uses role theme color */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[styles.backText, { color: theme.primaryLight }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Visitor details</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* hero card */}
        <View style={styles.heroCard}>
          {visitor.visitor_image_url ? (
            <TouchableOpacity
              onPress={() => setFullScreenPhoto(true)}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: visitor.visitor_image_url }}
                style={styles.visitorPhoto}
                resizeMode="cover"
              />
              <View style={styles.tapToExpandHint}>
                <Text style={styles.tapToExpandText}>Tap to expand</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[styles.visitorPhotoPlaceholder, { backgroundColor: theme.primaryLight }]}>
              <Text style={[styles.visitorPhotoInitial, { color: theme.primary }]}>
                {visitor.visitor_name?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={styles.heroInfo}>
            <Text style={styles.visitorName}>{visitor.visitor_name}</Text>

            {/* flat number pill */}
            <View style={[styles.flatPill,{ backgroundColor: theme.primaryLight }]}>
              <Text style={styles.flatPillIcon}>🏠</Text>
              <Text style={styles.flatPillText}>
                Flat {flatInfo?.flat_number || '—'}
              </Text>
            </View>

            {/* address — only show if present */}
            {visitor.visitor_address ? (
              <View style={styles.addressRow}>
                <Text style={styles.addressIcon}>📍</Text>
                <Text style={styles.addressText} numberOfLines={2}>
                  {visitor.visitor_address}
                </Text>
              </View>
            ) : null}

            {/* status pill */}
            <View style={[styles.statusPill, { backgroundColor: config.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: config.dot }]} />
              <Text style={[styles.statusText, { color: config.text }]}>
                {config.label}
              </Text>
            </View>
          </View>
        </View>

        {/* resident: approval action card */}
        {canApproveReject && (
          <View style={styles.approvalCard}>
            <Text style={styles.approvalTitle}>Action required</Text>
            <Text style={styles.approvalSubText}>
              {visitor.name} is waiting at the gate. Please approve or reject entry.
            </Text>
            <View style={styles.approvalButtons}>
              <TouchableOpacity
                style={[styles.rejectButton, actionLoading && styles.buttonDisabled]}
                onPress={handleReject}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                {actionLoading
                  ? <ActivityIndicator size="small" color="#A32D2D" />
                  : <Text style={styles.rejectText}>Reject entry</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.approveButton, actionLoading && styles.buttonDisabled]}
                onPress={handleApprove}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                {actionLoading
                  ? <ActivityIndicator size="small" color="#ffffff" />
                  : <Text style={styles.approveText}>Approve entry</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* visit info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visit information</Text>
          <InfoRow label="Reason" value={visitor.reason_for_visit} />
          {visitor.comment ? <InfoRow label="Comment" value={visitor.comment} /> : null}
        </View>

        {/* timings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timings</Text>
          <View style={styles.timingRow}>
            <View style={styles.timingBlock}>
              <View style={[styles.timingDot, { backgroundColor: theme.primary }]} />
              <View style={styles.timingInfo}>
                <Text style={styles.timingLabel}>Entry</Text>
                <Text style={styles.timingTime}>{formatTime(visitor.in_time)}</Text>
                <Text style={styles.timingDate}>
                  {visitor.in_time?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) || '—'}
                </Text>
              </View>
            </View>
            {duration && (
              <View style={styles.durationBox}>
                <Text style={styles.durationText}>{duration}</Text>
                <Text style={styles.durationLabel}>duration</Text>
              </View>
            )}
            <View style={styles.timingBlock}>
              <View style={[styles.timingDot, {
                backgroundColor: visitor.exit_time ? '#888780' : '#D3D1C7'
              }]} />
              <View style={styles.timingInfo}>
                <Text style={styles.timingLabel}>Exit</Text>
                <Text style={[styles.timingTime, !visitor.exit_time && { color: '#B4B2A9' }]}>
                  {visitor.exit_time ? formatTime(visitor.exit_time) : 'Not yet'}
                </Text>
                <Text style={styles.timingDate}>
                  {visitor.exit_time?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) || '—'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* entry guard */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Entry registered by</Text>
          <GuardCard
            guard={entryGuard}
            time={visitor.in_time}
            formatDateTime={formatDateTime}
            actionLabel="Entry"
            color={theme.primary}
            lightColor={theme.primaryLight}
          />
        </View>

        {/* exit guard — only after exited */}
        {visitor.status === 'exited' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Exit marked by</Text>
            <GuardCard
              guard={exitGuard}
              time={visitor.exit_time}
              formatDateTime={formatDateTime}
              actionLabel="Exit"
              color="#888780"
              lightColor="#F1EFE8"
            />
          </View>
        )}

        {/* guard: mark exit button */}
        {canExit && (
          <TouchableOpacity
            style={[styles.exitButton, actionLoading && styles.buttonDisabled]}
            onPress={handleMarkExit}
            disabled={actionLoading}
            activeOpacity={0.85}
          >
            {actionLoading ? (
              <View style={styles.exitButtonRow}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.exitButtonText}>Marking exit...</Text>
              </View>
            ) : (
              <Text style={styles.exitButtonText}>Mark as exited</Text>
            )}
          </TouchableOpacity>
        )}

        { (role === 'guard' || role === 'resident') && (['approved', 'pending'].includes(visitor.status)) &&
        
          <View style={styles.callSection}>
            <View style={styles.callSectionLeft}>
              <Text style={styles.callSectionTitle}>
                {isResident ? 'Contact guard' : 'Contact flat owner'}
              </Text>
              <Text style={styles.callSectionSubtitle}>
                {isResident
                  ? 'Call the guard who registered this entry'
                  : 'Call the owner to follow up on approval'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.callButton}
              onPress={() => handleCall(visitor)}
              activeOpacity={0.8}
            >
              <Text style={styles.callButtonIcon}>📞</Text>
              <Text style={styles.callButtonText}>Call</Text>
            </TouchableOpacity>
          </View>
        }

        <View style={{ height: 40 }} />
      </ScrollView>

      <FullScreenImage
        visible={fullScreenPhoto}
        imageUrl={visitor.visitor_image_url}
        onClose={() => setFullScreenPhoto(false)}
      />
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

function GuardCard({ guard, time, formatDateTime, actionLabel, color, lightColor }) {
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };
  return (
    <View style={styles.guardCard}>
      <View style={[styles.guardAvatar, { backgroundColor: lightColor }]}>
        <Text style={[styles.guardInitials, { color }]}>{getInitials(guard?.name)}</Text>
      </View>
      <View style={styles.guardInfo}>
        <Text style={styles.guardName}>{guard?.name || 'Unknown guard'}</Text>
        <Text style={styles.guardRole}>Security guard</Text>
        <Text style={styles.guardTime}>{formatDateTime(time)}</Text>
      </View>
      <View style={[styles.guardActionPill, { backgroundColor: lightColor }]}>
        <Text style={[styles.guardActionText, { color }]}>{actionLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  flatPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  flatPillIcon: {
    fontSize: 11,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    paddingRight: 8,
  },
  addressIcon: {
    fontSize: 11,
    marginTop: 2,
  },
  addressText: {
    fontSize: 12,
    color: '#888780',
    flex: 1,
    lineHeight: 17,
  },
  callSection: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  callSectionLeft: {
    flex: 1,
    gap: 3,
  },
  callSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444441',
  },
  callSectionSubtitle: {
    fontSize: 12,
    color: '#888780',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E1F5EE',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 0.5,
    borderColor: '#9FE1CB',
  },
  callButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F6E56',
  },
  callButtonIcon: {
    fontSize: 16,
  },
  container: { flex: 1, backgroundColor: '#F1EFE8' },
  loadingContainer: {
    flex: 1, justifyContent: 'center',
    alignItems: 'center', backgroundColor: '#F1EFE8', gap: 12,
  },
  loadingText: { fontSize: 14, color: '#888780' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? 48 : 56,
    paddingBottom: 14, paddingHorizontal: 16,
  },
  backButton: { width: 60 },
  backText: { fontSize: 14, fontWeight: '500' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#ffffff', letterSpacing: 0.3 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  heroCard: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderWidth: 0.5, borderColor: '#D3D1C7',
  },
  visitorPhoto: { width: 88, height: 110, borderRadius: 10, flexShrink: 0 },
  visitorPhotoPlaceholder: {
    width: 88, height: 110, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  visitorPhotoInitial: { fontSize: 36, fontWeight: '700' },
  heroInfo: { flex: 1, gap: 6 },
  visitorName: { fontSize: 20, fontWeight: '700', color: '#2C2C2A' },
  flatLabel: { fontSize: 14, color: '#888780' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, gap: 6, marginTop: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  approvalCard: {
    backgroundColor: '#FAEEDA', borderRadius: 14, padding: 16,
    gap: 10, borderWidth: 1, borderColor: '#FAC775',
  },
  approvalTitle: { fontSize: 15, fontWeight: '700', color: '#633806' },
  approvalSubText: { fontSize: 13, color: '#854F0B', lineHeight: 18 },
  approvalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  rejectButton: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#F09595',
    backgroundColor: '#ffffff', minHeight: 44,
  },
  rejectText: { fontSize: 14, fontWeight: '600', color: '#A32D2D' },
  approveButton: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#D85A30', minHeight: 44,
  },
  approveText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  buttonDisabled: { opacity: 0.6 },
  section: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 16,
    borderWidth: 0.5, borderColor: '#D3D1C7', gap: 12,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '600', color: '#888780',
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingVertical: 4,
    borderBottomWidth: 0.5, borderBottomColor: '#F1EFE8',
  },
  infoLabel: { fontSize: 14, color: '#888780', flex: 1 },
  infoValue: { fontSize: 14, color: '#2C2C2A', fontWeight: '500', flex: 2, textAlign: 'right' },
  timingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timingBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  timingDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  timingInfo: { gap: 2 },
  timingLabel: {
    fontSize: 11, color: '#888780', fontWeight: '500',
    letterSpacing: 0.3, textTransform: 'uppercase',
  },
  timingTime: { fontSize: 16, fontWeight: '700', color: '#2C2C2A' },
  timingDate: { fontSize: 12, color: '#888780' },
  durationBox: {
    alignItems: 'center', backgroundColor: '#F1EFE8',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 8,
  },
  durationText: { fontSize: 14, fontWeight: '700', color: '#444441' },
  durationLabel: { fontSize: 10, color: '#888780', marginTop: 1 },
  guardCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  guardAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  guardInitials: { fontSize: 16, fontWeight: '700' },
  guardInfo: { flex: 1, gap: 2 },
  guardName: { fontSize: 15, fontWeight: '600', color: '#2C2C2A' },
  guardRole: { fontSize: 12, color: '#888780' },
  guardTime: { fontSize: 12, color: '#B4B2A9', marginTop: 2 },
  guardActionPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  guardActionText: { fontSize: 12, fontWeight: '600' },
  exitButton: {
    backgroundColor: '#2C2C2A', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  exitButtonRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exitButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff', letterSpacing: 0.2 },
    tapToExpandHint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingVertical: 4,
    alignItems: 'center',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  tapToExpandText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '500',
  },
});