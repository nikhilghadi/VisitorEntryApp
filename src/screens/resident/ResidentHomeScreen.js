import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import AppLayout from '../../components/layouts/AppLayout';

const STATUS_CONFIG = {
  pending:  { label: 'Awaiting approval', bg: '#FAEEDA', text: '#854F0B', dot: '#BA7517' },
  approved: { label: 'Approved',          bg: '#EAF3DE', text: '#3B6D11', dot: '#639922' },
  active:   { label: 'Inside',            bg: '#E1F5EE', text: '#085041', dot: '#1D9E75' },
  exited:   { label: 'Exited',            bg: '#F1EFE8', text: '#5F5E5A', dot: '#888780' },
  rejected: { label: 'Rejected',          bg: '#FCEBEB', text: '#791F1F', dot: '#E24B4A' },
};

export default function ResidentHomeScreen({ navigation }) {
  const { userProfile } = useAuth();

  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // visitorId being actioned

  const flatId = userProfile?.flat_id;

  useEffect(() => {
    if (!flatId) return;
    fetchFlatSettings();
    const unsubscribe = subscribeToVisitors();
    return () => unsubscribe?.();
  }, [flatId]);

  const fetchFlatSettings = async () => {
    try {
      const flatDoc = await getDoc(doc(db, 'flats', flatId));
      if (flatDoc.exists()) {
        setApprovalRequired(flatDoc.data().approval_required || false);
      }
    } catch (e) {
      console.log('Fetch flat settings error:', e);
    }
  };

  const subscribeToVisitors = () => {
    // today from midnight
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const fromTimestamp = Timestamp.fromDate(todayStart);

    const visitorsQuery = query(
      collection(db, 'visits'),
      where('flat_id', '==', doc(db, 'flats', flatId)),
      where('created_at', '>=', fromTimestamp)
    );

    return onSnapshot(
      visitorsQuery,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          in_time: d.data().in_time?.toDate?.() || null,
          exit_time: d.data().exit_time?.toDate?.() || null,
          created_at: d.data().created_at?.toDate?.() || null,
        }));
        list.sort((a, b) => (b.in_time || 0) - (a.in_time || 0));
        setVisitors(list);
        setLoading(false);
      },
      (error) => {
        console.log('Residents visitors error:', error);
        setLoading(false);
      }
    );
  };

  const handleApprove = async (visitorId, visitorName) => {
    Alert.alert(
      'Approve visitor',
      `Allow ${visitorName} to enter?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              setActionLoading(visitorId);
              await updateDoc(doc(db, 'visits', visitorId), {
                status: 'approved',
                approved_by: doc(db, 'users', userProfile?.id),
                approved_at: serverTimestamp(),
                updated_at: serverTimestamp(),
              });
            } catch (e) {
              Alert.alert('Error', 'Could not approve. Please try again.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleReject = async (visitorId, visitorName) => {
    Alert.alert(
      'Reject visitor',
      `Deny entry to ${visitorName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(visitorId);
              await updateDoc(doc(db, 'visits', visitorId), {
                status: 'rejected',
                rejected_by: doc(db, 'users', userProfile?.id),
                rejected_at: serverTimestamp(),
                updated_at: serverTimestamp(),
              });
            } catch (e) {
              Alert.alert('Error', 'Could not reject. Please try again.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderCard = ({ item }) => {
    const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    console.log("resident item",item.status)
    const isPending = item.status === 'pending';
    const isActioning = actionLoading === item.id;
    const showApprovalButtons = approvalRequired && isPending;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate('VisitorDetail', {
            visitId: item.id,
            approvalRequired,
          })
        }
      >
        {/* left color bar */}
        <View style={[styles.colorBar, { backgroundColor: config.dot }]} />

        <View style={styles.cardBody}>

          {/* top row — photo + info */}
          <View style={styles.cardTop}>
            {item.visitor_image_url ? (
              <Image source={{ uri: item.visitor_image_url }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoInitial}>
                  {item.visitor_name?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}

            <View style={styles.infoBlock}>
              <View style={styles.nameRow}>
                <Text style={styles.visitorName} numberOfLines={1}>
                  {item.visitor_name}
                </Text>
                <Text style={styles.timeText}>{formatTime(item.in_time)}</Text>
              </View>

              <Text style={styles.reasonText} numberOfLines={1}>
                {item.reason_for_visit}
              </Text>

              <View style={[styles.statusPill, { backgroundColor: config.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: config.dot }]} />
                <Text style={[styles.statusText, { color: config.text }]}>
                  {config.label}
                </Text>
              </View>
            </View>
          </View>

          {/* approval buttons — only for pending + approval required */}
          {showApprovalButtons && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.rejectButton, isActioning && styles.buttonDisabled]}
                onPress={() => handleReject(item.id, item.visitor_name)}
                disabled={isActioning}
                activeOpacity={0.8}
              >
                {isActioning ? (
                  <ActivityIndicator size="small" color="#A32D2D" />
                ) : (
                  <Text style={styles.rejectButtonText}>Reject</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.approveButton, isActioning && styles.buttonDisabled]}
                onPress={() => handleApprove(item.id, item.visitor_name)}
                disabled={isActioning}
                activeOpacity={0.8}
              >
                {isActioning ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.approveButtonText}>Approve</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* exit time if exited */}
          {item.exit_time && (
            <Text style={styles.exitTimeText}>
              Exited at {formatTime(item.exit_time)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🏠</Text>
      <Text style={styles.emptyTitle}>No visitors today</Text>
      <Text style={styles.emptySubText}>
        You will receive a notification when someone visits your flat
      </Text>
    </View>
  );

  const pendingCount = visitors.filter((v) => v.status === 'pending').length;

  return (
    <AppLayout
      title="RegEntry"
      currentScreen="ResidentHome"
      onNavigate={(screen) => navigation.navigate(screen)}
    >
      <View style={styles.container}>

        {/* pending alert banner */}
        {approvalRequired && pendingCount > 0 && (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingBannerText}>
              {pendingCount} visitor{pendingCount > 1 ? 's' : ''} waiting for your approval
            </Text>
          </View>
        )}

        {/* date header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Today's visitors</Text>
          <Text style={styles.pageSubTitle}>
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#D85A30" />
          </View>
        ) : (
          <FlatList
            data={visitors}
            keyExtractor={(item) => item.id}
            renderItem={renderCard}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={[
              styles.listContent,
              visitors.length === 0 && styles.listContentEmpty,
            ]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              visitors.length > 0 ? (
                <Text style={styles.listCount}>
                  {visitors.length} visit{visitors.length > 1 ? 's' : ''}
                </Text>
              ) : null
            }
          />
        )}
      </View>
    </AppLayout>
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
  },
  pendingBanner: {
    backgroundColor: '#FAEEDA',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#FAC775',
  },
  pendingBannerText: {
    fontSize: 13,
    color: '#854F0B',
    fontWeight: '600',
    textAlign: 'center',
  },
  pageHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C2C2A',
  },
  pageSubTitle: {
    fontSize: 13,
    color: '#888780',
    marginTop: 2,
  },
  listCount: {
    fontSize: 13,
    color: '#888780',
    fontWeight: '500',
    marginBottom: 8,
  },
  listContent: {
    padding: 16,
    gap: 10,
    paddingBottom: 32,
  },
  listContentEmpty: {
    flex: 1,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    flexDirection: 'row',
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    overflow: 'hidden',
  },
  colorBar: {
    width: 4,
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    padding: 14,
    gap: 10,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  photo: {
    width: 52,
    height: 62,
    borderRadius: 8,
    backgroundColor: '#F1EFE8',
    flexShrink: 0,
  },
  photoPlaceholder: {
    width: 52,
    height: 62,
    borderRadius: 8,
    backgroundColor: '#FAECE7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  photoInitial: {
    fontSize: 22,
    fontWeight: '700',
    color: '#D85A30',
  },
  infoBlock: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  visitorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C2C2A',
    flex: 1,
  },
  timeText: {
    fontSize: 12,
    color: '#888780',
    flexShrink: 0,
    marginLeft: 8,
  },
  reasonText: {
    fontSize: 13,
    color: '#888780',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F09595',
    backgroundColor: '#FCEBEB',
    minHeight: 40,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A32D2D',
  },
  approveButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D85A30',
    minHeight: 40,
  },
  approveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  exitTimeText: {
    fontSize: 12,
    color: '#888780',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#444441',
  },
  emptySubText: {
    fontSize: 14,
    color: '#888780',
    textAlign: 'center',
    lineHeight: 22,
  },
});