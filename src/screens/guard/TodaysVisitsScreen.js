import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import AppLayout from '../../components/layouts/AppLayout';

const STATUS_FILTERS = ['All', 'Pending', 'Approved', 'Exited'];

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  bg: '#FAEEDA', text: '#854F0B', dot: '#BA7517' },
  approved: { label: 'Approved', bg: '#EAF3DE', text: '#3B6D11', dot: '#639922' },
  active:   { label: 'Active',   bg: '#E1F5EE', text: '#085041', dot: '#1D9E75' },
  exited:   { label: 'Exited',   bg: '#F1EFE8', text: '#5F5E5A', dot: '#888780' },
  rejected: { label: 'Rejected', bg: '#FCEBEB', text: '#791F1F', dot: '#E24B4A' },
};

export default function TodaysVisitsScreen({ navigation }) {
  const { userProfile } = useAuth();
  const [visitors, setVisitors] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.society_id) return;

    // calculate 2 days ago timestamp
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(0, 0, 0, 0);
    const fromTimestamp = Timestamp.fromDate(twoDaysAgo);

    const visitorsQuery = query(
      collection(db, 'visits'),
      where('society_id', '==',doc(db, 'societies', userProfile.society_id)),
      where('created_at', '>=', fromTimestamp)
    );
    console.log("Vists query", fromTimestamp,  userProfile.society_id)
    const unsubscribe = onSnapshot(
      visitorsQuery,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          in_time: d.data().in_time?.toDate?.() || null,
          exit_time: d.data().exit_time?.toDate?.() || null,
          created_at: d.data().created_at?.toDate?.() || null,
        }));

        // sort by in_time descending — most recent first
        list.sort((a, b) => (b.in_time || 0) - (a.in_time || 0));
        // //console.log("All vis",list)
        setVisitors(list);
        setLoading(false);
      },
      (error) => {
        //console.log('TodaysVisits error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userProfile?.society_id]);

  // apply filter whenever visitors or activeFilter changes
  useEffect(() => {
    if (activeFilter === 'All') {
      setFiltered(visitors);
      return;
    }
    const filterKey = activeFilter.toLowerCase();
    setFiltered(
      visitors.filter((v) => {
        if (filterKey === 'approved') return v.status === 'approved' || v.status === 'active';
        return v.status === filterKey;
      })
    );
  }, [visitors, activeFilter]);

  // group visitors by date label
  const groupByDate = (list) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups = {};
    list.forEach((v) => {
      const d = v.in_time || v.created_at;
      if (!d) return;
      const date = new Date(d);
      date.setHours(0, 0, 0, 0);

      let label;
      if (date.getTime() === today.getTime()) label = 'Today';
      else if (date.getTime() === yesterday.getTime()) label = 'Yesterday';
      else label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

      if (!groups[label]) groups[label] = [];
      groups[label].push(v);
    });

    // flatten into sections for FlatList
    const sections = [];
    ['Today', 'Yesterday'].forEach((key) => {
      if (groups[key]) {
        sections.push({ type: 'header', label: key, count: groups[key].length });
        groups[key].forEach((v) => sections.push({ type: 'item', ...v }));
      }
    });
    // any other dates
    Object.entries(groups).forEach(([key, items]) => {
      if (key !== 'Today' && key !== 'Yesterday') {
        sections.push({ type: 'header', label: key, count: items.length });
        items.forEach((v) => sections.push({ type: 'item', ...v }));
      }
    });

    return sections;
  };

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getRefId = (field) => {
    if (!field) return null;
    if (typeof field === 'string') return field;
    if (field?.id) return field.id;
    return null;
  };

  const sections = groupByDate(filtered);

  const renderItem = ({ item }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.dateHeader}>
          <Text style={styles.dateHeaderText}>{item.label}</Text>
          <View style={styles.dateHeaderPill}>
            <Text style={styles.dateHeaderCount}>{item.count}</Text>
          </View>
        </View>
      );
    }

    const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('VisitorDetail', { visitId: item.id })}
      >
        {/* left color bar */}
        <View style={[styles.colorBar, { backgroundColor: config.dot }]} />

        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.visitorName} numberOfLines={1}>{item.visitor_name}</Text>
            <Text style={styles.timeText}>{formatTime(item.in_time)}</Text>
          </View>

          <Text style={styles.reasonText} numberOfLines={1}>
            {item.reason_for_visit}
          </Text>

          <View style={styles.cardBottom}>
            {/* status pill */}
            <View style={[styles.statusPill, { backgroundColor: config.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: config.dot }]} />
              <Text style={[styles.statusText, { color: config.text }]}>
                {config.label}
              </Text>
            </View>

            {/* exit time if exited */}
            {item.exit_time && (
              <Text style={styles.exitTimeText}>
                Exited {formatTime(item.exit_time)}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>No visitors found</Text>
      <Text style={styles.emptySubText}>
        {activeFilter === 'All'
          ? 'No visitor entries in the last 2 days'
          : `No ${activeFilter.toLowerCase()} visitors in the last 2 days`}
      </Text>
    </View>
  );

  const totalCounts = {
    all: visitors.length,
    pending: visitors.filter((v) => v.status === 'pending').length,
    approved: visitors.filter((v) => v.status === 'approved' || v.status === 'active').length,
    exited: visitors.filter((v) => v.status === 'exited').length,
  };

  return (
    <AppLayout
      title="Visits (last 2 days)"
      currentScreen="TodaysVisits"
      onNavigate={(screen) => navigation.navigate(screen)}
    >
      <View style={styles.container}>

        {/* summary stats */}
        <View style={styles.statsRow}>
          <StatCard label="Total" value={totalCounts.all} color="#444441" />
          <StatCard label="Pending" value={totalCounts.pending} color="#BA7517" />
          <StatCard label="Inside" value={totalCounts.approved} color="#1D9E75" />
          <StatCard label="Exited" value={totalCounts.exited} color="#888780" />
        </View>

        {/* filter tabs */}
        <View style={styles.filterRow}>
          {STATUS_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterTab,
                activeFilter === filter && styles.filterTabActive,
              ]}
              onPress={() => setActiveFilter(filter)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterTabText,
                activeFilter === filter && styles.filterTabTextActive,
              ]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1D9E75" />
          </View>
        ) : (
          <FlatList
            data={sections}
            keyExtractor={(item, index) =>
              item.type === 'header' ? `header-${item.label}` : item.id
            }
            renderItem={renderItem}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={[
              styles.listContent,
              sections.length === 0 && styles.listContentEmpty,
            ]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </AppLayout>
  );
}

function StatCard({ label, value, color }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1EFE8',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    color: '#888780',
    fontWeight: '500',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
  },
  filterTabActive: {
    backgroundColor: '#1D9E75',
    borderColor: '#1D9E75',
  },
  filterTabText: {
    fontSize: 12,
    color: '#888780',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 8,
  },
  listContentEmpty: {
    flex: 1,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingTop: 16,
  },
  dateHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444441',
  },
  dateHeaderPill: {
    backgroundColor: '#D3D1C7',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  dateHeaderCount: {
    fontSize: 11,
    color: '#5F5E5A',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
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
    gap: 4,
  },
  cardTop: {
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
    fontSize: 13,
    color: '#888780',
    fontWeight: '500',
    flexShrink: 0,
    marginLeft: 8,
  },
  reasonText: {
    fontSize: 13,
    color: '#888780',
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
    alignSelf: 'flex-start',
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
  exitTimeText: {
    fontSize: 11,
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
    lineHeight: 20,
  },
});