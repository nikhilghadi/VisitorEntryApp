import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import AppLayout from '../../components/layouts/AppLayout';

export default function GuardHomeScreen({ navigation }) {
  const { userProfile } = useAuth();
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!userProfile?.society_id) return;

    // real-time listener for active visitors in this society
    const visitorsQuery = query(
      collection(db, 'visits'),
      where('society_id', '==', doc(db, 'societies', userProfile.society_id)),
      where('status', 'in', ['pending', 'approved', 'active'])
    );

    const unsubscribe = onSnapshot(
      visitorsQuery,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          // convert timestamps safely
          in_time: d.data().in_time?.toDate?.() || null,
        }));
        // sort newest first
        list.sort((a, b) => (b.in_time || 0) - (a.in_time || 0));
        setVisitors(list);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.log('Visitors listener error:', error);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, [userProfile?.society_id]);

  const handleMarkExit = async (visitId) => {
    try {
      await updateDoc(doc(db, 'visits', visitId), {
        status: 'exited',
        exit_time: serverTimestamp(),
        updated_at: serverTimestamp(),
        exit_marked_by: doc(db, 'users', userProfile.id),
      });
      Alert.alert(
        'Exit marked',
        'The visitor has been marked as exited.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.log('Mark exit error:', error);
    }
  };

  const handleNavigate = (screen) => {
    navigation.navigate(screen);
  };

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'pending': return { bg: '#FAEEDA', text: '#854F0B', label: 'Pending approval' };
      case 'approved': return { bg: '#EAF3DE', text: '#3B6D11', label: 'Approved' };
      case 'active': return { bg: '#E1F5EE', text: '#085041', label: 'Inside' };
      default: return { bg: '#F1EFE8', text: '#888780', label: status };
    }
  };

  const renderVisitorCard = ({ item }) => {
    const statusStyle = getStatusStyle(item.status);
    const flatId = item.flat_id?.id || item.flat_id;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('VisitorDetail', { visitId: item.id })}
      >
        <View style={styles.cardLeft}>
          {item.visitor_image_url ? (
            <Image source={{ uri: item.visitor_image_url }} style={styles.visitorPhoto} />
          ) : (
            <View style={styles.visitorPhotoPlaceholder}>
              <Text style={styles.visitorPhotoPlaceholderText}>
                {item.visitor_name?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.cardMiddle}>
          <Text style={styles.visitorName} numberOfLines={1}>{item.visitor_name}</Text>
          <Text style={styles.visitorMeta} numberOfLines={1}>
            {item.reason_for_visit}
          </Text>
          <Text style={styles.visitorTime}>{formatTime(item.in_time)}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {statusStyle.label}
            </Text>
          </View>
        </View>

        {item.status === 'active' || item.status === 'approved' ? (
          <TouchableOpacity
            style={styles.exitButton}
            onPress={() => handleMarkExit(item.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.exitButtonText}>Mark as {'\n'}exit</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.cardRight}>
            <Text style={styles.pendingIcon}>⏳</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🏠</Text>
      <Text style={styles.emptyTitle}>No active visitors</Text>
      <Text style={styles.emptySubText}>
        Tap the button below to register a new visitor
      </Text>
    </View>
  );

  return (
    <AppLayout
      title="RegEntry"
      currentScreen="GuardHome"
      onNavigate={handleNavigate}
    >
      <View style={styles.container}>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1D9E75" />
          </View>
        ) : (
          <FlatList
            data={visitors}
            keyExtractor={(item) => item.id}
            renderItem={renderVisitorCard}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={[
              styles.listContent,
              visitors.length === 0 && styles.listContentEmpty,
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => setRefreshing(true)}
                colors={['#1D9E75']}
                tintColor="#1D9E75"
              />
            }
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              visitors.length > 0 ? (
                <Text style={styles.listHeader}>
                  Active visitors ({visitors.length})
                </Text>
              ) : null
            }
          />
        )}

        {/* new visitor button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.newVisitorButton}
            onPress={() => navigation.navigate('NewVisitor')}
            activeOpacity={0.85}
          >
            <Text style={styles.newVisitorButtonText}>+ New visitor</Text>
          </TouchableOpacity>
        </View>

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
  listContent: {
    padding: 16,
    gap: 10,
    paddingBottom: 100,
  },
  listContentEmpty: {
    flex: 1,
  },
  listHeader: {
    fontSize: 13,
    color: '#888780',
    marginBottom: 8,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    gap: 12,
  },
  cardLeft: {
    flexShrink: 0,
  },
  visitorPhoto: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#F1EFE8',
  },
  visitorPhotoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#E1F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitorPhotoPlaceholderText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1D9E75',
  },
  cardMiddle: {
    flex: 1,
    gap: 3,
  },
  visitorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C2C2A',
  },
  visitorMeta: {
    fontSize: 13,
    color: '#888780',
  },
  visitorTime: {
    fontSize: 12,
    color: '#B4B2A9',
    marginTop: 2,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  exitButton: {
    backgroundColor: '#E1F5EE',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    flexShrink: 0,
  },
  exitButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F6E56',
    textAlign: 'center',
  },
  cardRight: {
    width: 40,
    alignItems: 'center',
  },
  pendingIcon: {
    fontSize: 20,
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
    lineHeight: 20,
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
  newVisitorButton: {
    backgroundColor: '#1D9E75',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  newVisitorButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
});