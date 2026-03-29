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

export default function VisitorDetailScreen({ navigation, route }) {
  const { visitorId } = route.params;
  const { userProfile } = useAuth();

  const [visitor, setVisitor] = useState(null);
  const [entryGuard, setEntryGuard] = useState(null);
  const [exitGuard, setExitGuard] = useState(null);
  const [flatInfo, setFlatInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [markingExit, setMarkingExit] = useState(false);

  useEffect(() => {
    // real-time listener on visitor document
    const unsubscribe = onSnapshot(
      doc(db, 'visitors', visitorId),
      async (snap) => {
        if (!snap.exists()) {
          Alert.alert('Not found', 'This visitor record no longer exists.');
          navigation.goBack();
          return;
        }

        const data = { id: snap.id, ...snap.data() };

        // convert timestamps
        data.in_time = data.in_time?.toDate?.() || null;
        data.exit_time = data.exit_time?.toDate?.() || null;
        data.created_at = data.created_at?.toDate?.() || null;

        setVisitor(data);

        // fetch related documents in parallel
        await Promise.all([
          fetchGuard(data.guard_id, 'entry'),
          fetchExitGuard(data),
          fetchFlat(data.flat_id),
        ]);

        setLoading(false);
      },
      (error) => {
        console.log('Visitor detail error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [visitorId]);

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
        const guardData = { id: guardDoc.id, ...guardDoc.data() };
        if (type === 'entry') setEntryGuard(guardData);
        else setExitGuard(guardData);
      }
    } catch (e) {
      console.log('Fetch guard error:', e);
    }
  };

  // exit guard stored separately — for now same as entry guard
  // when we add exit_guard_id field this will be updated
  const fetchExitGuard = async (data) => {
    if (!data.exit_time) return;
    // reuse entry guard for now — exit guard tracking
    // will be added when we build mark exit flow properly
    const exitGuardField = data.exit_guard_id || data.guard_id;
    await fetchGuard(exitGuardField, 'exit');
  };

  const fetchFlat = async (flatField) => {
    try {
      const flatId = getDocId(flatField);
      if (!flatId) return;
      const flatDoc = await getDoc(doc(db, 'flats', flatId));
      if (flatDoc.exists()) {
        setFlatInfo({ id: flatDoc.id, ...flatDoc.data() });
      }
    } catch (e) {
      console.log('Fetch flat error:', e);
    }
  };

  const handleMarkExit = async () => {
    Alert.alert(
      'Mark as exited',
      `Confirm that ${visitor?.name} has left the building?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm exit',
          style: 'default',
          onPress: async () => {
            try {
              setMarkingExit(true);
              await updateDoc(doc(db, 'visitors', visitorId), {
                status: 'exited',
                exit_time: serverTimestamp(),
                exit_guard_id: doc(db, 'users', userProfile?.id),
                updated_at: serverTimestamp(),
              });
            } catch (error) {
              console.log('Mark exit error:', error);
              Alert.alert('Error', 'Could not mark exit. Please try again.');
            } finally {
              setMarkingExit(false);
            }
          },
        },
      ]
    );
  };

  const formatDateTime = (date) => {
    if (!date) return '—';
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatTime = (date) => {
    if (!date) return '—';
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getDuration = (inTime, exitTime) => {
    if (!inTime || !exitTime) return null;
    const diff = Math.floor((exitTime - inTime) / 1000 / 60);
    if (diff < 60) return `${diff} min`;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hrs}h ${mins}m`;
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending approval', bg: '#FAEEDA', text: '#854F0B', dot: '#BA7517' };
      case 'approved':
        return { label: 'Approved', bg: '#EAF3DE', text: '#3B6D11', dot: '#639922' };
      case 'active':
        return { label: 'Inside building', bg: '#E1F5EE', text: '#085041', dot: '#1D9E75' };
      case 'exited':
        return { label: 'Exited', bg: '#F1EFE8', text: '#5F5E5A', dot: '#888780' };
      case 'rejected':
        return { label: 'Rejected', bg: '#FCEBEB', text: '#791F1F', dot: '#E24B4A' };
      default:
        return { label: status, bg: '#F1EFE8', text: '#888780', dot: '#B4B2A9' };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1D9E75" />
        <Text style={styles.loadingText}>Loading visitor details...</Text>
      </View>
    );
  }

  if (!visitor) return null;

  const statusConfig = getStatusConfig(visitor.status);
  const canMarkExit = visitor.status === 'approved' || visitor.status === 'active';
  const duration = getDuration(visitor.in_time, visitor.exit_time);

  return (
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
        <Text style={styles.headerTitle}>Visitor details</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* visitor photo + name + status */}
        <View style={styles.heroCard}>
          {visitor.image_url ? (
            <Image
              source={{ uri: visitor.image_url }}
              style={styles.visitorPhoto}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.visitorPhotoPlaceholder}>
              <Text style={styles.visitorPhotoInitial}>
                {visitor.name?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}

          <View style={styles.heroInfo}>
            <Text style={styles.visitorName}>{visitor.name}</Text>
            <Text style={styles.flatLabel}>
              Flat {flatInfo?.flat_number || '—'}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: statusConfig.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusConfig.dot }]} />
              <Text style={[styles.statusText, { color: statusConfig.text }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
        </View>

        {/* visit info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visit information</Text>

          <InfoRow label="Reason" value={visitor.reason_for_visit} />
          {visitor.comment ? (
            <InfoRow label="Comment" value={visitor.comment} />
          ) : null}
        </View>

        {/* timing section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timings</Text>

          <View style={styles.timingRow}>
            {/* entry block */}
            <View style={styles.timingBlock}>
              <View style={[styles.timingDot, { backgroundColor: '#1D9E75' }]} />
              <View style={styles.timingInfo}>
                <Text style={styles.timingLabel}>Entry</Text>
                <Text style={styles.timingTime}>
                  {formatTime(visitor.in_time)}
                </Text>
                <Text style={styles.timingDate}>
                  {visitor.in_time
                    ? visitor.in_time.toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                      })
                    : '—'}
                </Text>
              </View>
            </View>

            {/* duration */}
            {duration && (
              <View style={styles.durationBox}>
                <Text style={styles.durationText}>{duration}</Text>
                <Text style={styles.durationLabel}>duration</Text>
              </View>
            )}

            {/* exit block */}
            <View style={styles.timingBlock}>
              <View style={[styles.timingDot, {
                backgroundColor: visitor.exit_time ? '#888780' : '#D3D1C7'
              }]} />
              <View style={styles.timingInfo}>
                <Text style={styles.timingLabel}>Exit</Text>
                <Text style={[
                  styles.timingTime,
                  !visitor.exit_time && { color: '#B4B2A9' }
                ]}>
                  {visitor.exit_time ? formatTime(visitor.exit_time) : 'Not yet'}
                </Text>
                <Text style={styles.timingDate}>
                  {visitor.exit_time
                    ? visitor.exit_time.toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                      })
                    : '—'}
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
            color="#1D9E75"
          />
        </View>

        {/* exit guard — only shown when exited */}
        {visitor.status === 'exited' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Exit marked by</Text>
            <GuardCard
              guard={exitGuard}
              time={visitor.exit_time}
              formatDateTime={formatDateTime}
              actionLabel="Exit"
              color="#888780"
            />
          </View>
        )}

        {/* mark exit button */}
        {canMarkExit && (
          <TouchableOpacity
            style={[styles.exitButton, markingExit && styles.exitButtonDisabled]}
            onPress={handleMarkExit}
            disabled={markingExit}
            activeOpacity={0.85}
          >
            {markingExit ? (
              <View style={styles.exitButtonRow}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.exitButtonText}>Marking exit...</Text>
              </View>
            ) : (
              <Text style={styles.exitButtonText}>Mark as exited</Text>
            )}
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// reusable info row
function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

// guard card component
function GuardCard({ guard, time, formatDateTime, actionLabel, color }) {
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <View style={styles.guardCard}>
      <View style={[styles.guardAvatar, { backgroundColor: color + '22' }]}>
        <Text style={[styles.guardInitials, { color }]}>
          {getInitials(guard?.name)}
        </Text>
      </View>
      <View style={styles.guardInfo}>
        <Text style={styles.guardName}>{guard?.name || 'Unknown guard'}</Text>
        <Text style={styles.guardRole}>Security guard</Text>
        <Text style={styles.guardTime}>{formatDateTime(time)}</Text>
      </View>
      <View style={[styles.guardActionPill, { backgroundColor: color + '18' }]}>
        <Text style={[styles.guardActionText, { color }]}>{actionLabel}</Text>
      </View>
    </View>
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
    padding: 16,
    gap: 12,
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
  },
  visitorPhoto: {
    width: 88,
    height: 110,
    borderRadius: 10,
    backgroundColor: '#F1EFE8',
    flexShrink: 0,
  },
  visitorPhotoPlaceholder: {
    width: 88,
    height: 110,
    borderRadius: 10,
    backgroundColor: '#E1F5EE',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  visitorPhotoInitial: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1D9E75',
  },
  heroInfo: {
    flex: 1,
    gap: 6,
  },
  visitorName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C2C2A',
    letterSpacing: 0.2,
  },
  flatLabel: {
    fontSize: 14,
    color: '#888780',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
    marginTop: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888780',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1EFE8',
  },
  infoLabel: {
    fontSize: 14,
    color: '#888780',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#2C2C2A',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  timingBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  timingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    flexShrink: 0,
  },
  timingInfo: {
    gap: 2,
  },
  timingLabel: {
    fontSize: 11,
    color: '#888780',
    fontWeight: '500',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  timingTime: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C2C2A',
  },
  timingDate: {
    fontSize: 12,
    color: '#888780',
  },
  durationBox: {
    alignItems: 'center',
    backgroundColor: '#F1EFE8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 8,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#444441',
  },
  durationLabel: {
    fontSize: 10,
    color: '#888780',
    marginTop: 1,
  },
  guardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  guardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  guardInitials: {
    fontSize: 16,
    fontWeight: '700',
  },
  guardInfo: {
    flex: 1,
    gap: 2,
  },
  guardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C2C2A',
  },
  guardRole: {
    fontSize: 12,
    color: '#888780',
  },
  guardTime: {
    fontSize: 12,
    color: '#B4B2A9',
    marginTop: 2,
  },
  guardActionPill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  guardActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  exitButton: {
    backgroundColor: '#2C2C2A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  exitButtonDisabled: {
    opacity: 0.6,
  },
  exitButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
});