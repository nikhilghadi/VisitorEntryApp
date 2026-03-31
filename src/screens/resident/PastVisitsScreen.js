import { useState, useEffect, useCallback } from 'react';
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
  getDocs,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import AppLayout from '../../components/layouts/AppLayout';

const TABS = ['All', 'Pending', 'Approved', 'Exited', 'Rejected'];

const STATUS_CONFIG = {
  pending:  { label: 'Awaiting approval', bg: '#FAEEDA', text: '#854F0B', dot: '#BA7517' },
  approved: { label: 'Approved',          bg: '#EAF3DE', text: '#3B6D11', dot: '#639922' },
  active:   { label: 'Inside',            bg: '#E1F5EE', text: '#085041', dot: '#1D9E75' },
  exited:   { label: 'Exited',            bg: '#F1EFE8', text: '#5F5E5A', dot: '#888780' },
  rejected: { label: 'Rejected',          bg: '#FCEBEB', text: '#791F1F', dot: '#E24B4A' },
};

// generate last 6 months as dropdown options
const generateMonthOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      year: d.getFullYear(),
      month: d.getMonth(), // 0-indexed
    });
  }
  return options;
};

const MONTH_OPTIONS = generateMonthOptions();

export default function PastVisitsScreen({ navigation }) {
  const { userProfile } = useAuth();

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('All');

  // raw data fetched from Firestore for selected month
  const [monthData, setMonthData] = useState([]);
  const [loading, setLoading] = useState(true);

  const flatId = userProfile?.flat_id;
  const selectedMonth = MONTH_OPTIONS[selectedMonthIndex];

  // fetch whenever selected month changes
  useEffect(() => {
    fetchMonthData();
  }, [selectedMonthIndex]);

  const fetchMonthData = async () => {
    if (!flatId) return;

    try {
      setLoading(true);
      setActiveTab('All'); // reset tab on month change

      const { year, month } = MONTH_OPTIONS[selectedMonthIndex];

      // first and last moment of selected month
      const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
      const monthEnd = new Date(year, month + 1, 1, 0, 0, 0, 0); // exclusive

      const visitsQuery = query(
        collection(db, 'visits'),
        where('flat_id', '==', doc(db, 'flats', flatId)),
        where('created_at', '>=', Timestamp.fromDate(monthStart)),
        where('created_at', '<', Timestamp.fromDate(monthEnd))
      );

      const snap = await getDocs(visitsQuery);

      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        in_time: d.data().in_time?.toDate?.() || null,
        exit_time: d.data().exit_time?.toDate?.() || null,
        created_at: d.data().created_at?.toDate?.() || null,
      }));

      // sort newest first
      list.sort((a, b) => (b.in_time || 0) - (a.in_time || 0));
      setMonthData(list);
    } catch (error) {
      console.log('Fetch past visits error:', error);
    } finally {
      setLoading(false);
    }
  };

  // tab filtering happens in memory — no extra Firestore call
  const filteredData = useCallback(() => {
    if (activeTab === 'All') return monthData;
    if (activeTab === 'Approved') {
      return monthData.filter(
        (v) => v.status === 'approved' || v.status === 'active'
      );
    }
    return monthData.filter((v) => v.status === activeTab.toLowerCase());
  }, [monthData, activeTab]);

  // counts always from full month data regardless of active tab
  const counts = {
    all: monthData.length,
    pending: monthData.filter((v) => v.status === 'pending').length,
    approved: monthData.filter(
      (v) => v.status === 'approved' || v.status === 'active'
    ).length,
    exited: monthData.filter((v) => v.status === 'exited').length,
    rejected: monthData.filter((v) => v.status === 'rejected').length,
  };

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short',
    });
  };

  const renderCard = ({ item }) => {
    const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate('VisitorDetail', {
            visitId: item.id,
            approvalRequired: item.status === 'pending',
          })
        }
      >
        <View style={[styles.colorBar, { backgroundColor: config.dot }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.visitorName} numberOfLines={1}>
              {item.visitor_name}
            </Text>
            <View style={styles.cardMeta}>
              <Text style={styles.dateText}>{formatDate(item.in_time)}</Text>
              <Text style={styles.timeText}>{formatTime(item.in_time)}</Text>
            </View>
          </View>

          <Text style={styles.reasonText} numberOfLines={1}>
            {item.reason_for_visit}
          </Text>

          <View style={styles.cardBottom}>
            <View style={[styles.statusPill, { backgroundColor: config.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: config.dot }]} />
              <Text style={[styles.statusText, { color: config.text }]}>
                {config.label}
              </Text>
            </View>
            {item.exit_time && (
              <Text style={styles.exitText}>
                Out {formatTime(item.exit_time)}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={styles.emptyTitle}>No visits found</Text>
      <Text style={styles.emptySubText}>
        {activeTab === 'All'
          ? `No visits in ${selectedMonth.label}`
          : `No ${activeTab.toLowerCase()} visits in ${selectedMonth.label}`}
      </Text>
    </View>
  );

  const data = filteredData();

  return (
    <AppLayout
      title="Past visits"
      currentScreen="PastVisits"
      onNavigate={(screen) => navigation.navigate(screen)}
    >
      <View style={styles.container}>

        {/* month selector */}
        <View style={styles.monthSection}>
          <TouchableOpacity
            style={styles.monthButton}
            onPress={() => setMonthDropdownOpen(!monthDropdownOpen)}
            activeOpacity={0.5}
          >
            <Text style={styles.monthButtonText}>{selectedMonth.label}</Text>
            <Text style={styles.monthButtonArrow}>
              {monthDropdownOpen ? '▴' : '▾'}
            </Text>
          </TouchableOpacity>

          {monthDropdownOpen && (
            <View style={styles.monthDropdown}>
              {MONTH_OPTIONS.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.monthOption,
                    index === selectedMonthIndex && styles.monthOptionActive,
                    index < MONTH_OPTIONS.length - 1 && styles.monthOptionBorder,
                  ]}
                  onPress={() => {
                    setSelectedMonthIndex(index);
                    setMonthDropdownOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.monthOptionText,
                    index === selectedMonthIndex && styles.monthOptionTextActive,
                  ]}>
                    {option.label}
                  </Text>
                  {index === selectedMonthIndex && (
                    <Text style={styles.monthOptionCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* stats bar */}
        <View style={styles.statsRow}>
          <StatCard label="Total"    value={counts.all}      color="#444441" />
          <StatCard label="Pending"  value={counts.pending}  color="#BA7517" />
          <StatCard label="Inside"   value={counts.approved} color="#1D9E75" />
          <StatCard label="Exited"   value={counts.exited}   color="#5F5E5A" />
          <StatCard label="Rejected" value={counts.rejected} color="#A32D2D" />
        </View>

        {/* filter tabs */}
        <View style={styles.tabsWrapper}>
          <FlatList
            data={TABS}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsRow}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.tab, activeTab === item && styles.tabActive]}
                onPress={() => setActiveTab(item)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === item && styles.tabTextActive,
                ]}>
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* results count */}
        {!loading && (
          <Text style={styles.resultsCount}>
            {data.length} visit{data.length !== 1 ? 's' : ''}
            {activeTab !== 'All' ? ` · ${activeTab}` : ''}
          </Text>
        )}

        {/* list */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#D85A30" />
            <Text style={styles.loadingText}>Loading {selectedMonth.label}...</Text>
          </View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={renderCard}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={[
              styles.listContent,
              data.length === 0 && styles.listContentEmpty,
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

  // month selector
  monthSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    zIndex: 0,
  },
  monthButton: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C2C2A',
  },
  monthButtonArrow: {
    fontSize: 12,
    color: '#888780',
  },
  monthDropdown: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    marginTop: 6,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  monthOption: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthOptionBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1EFE8',
  },
  monthOptionActive: {
    backgroundColor: '#FAECE7',
  },
  monthOptionText: {
    fontSize: 14,
    color: '#2C2C2A',
  },
  monthOptionTextActive: {
    color: '#993C1D',
    fontWeight: '600',
  },
  monthOptionCheck: {
    fontSize: 14,
    color: '#D85A30',
    fontWeight: '700',
  },

  // stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 6,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    gap: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    color: '#888780',
    fontWeight: '500',
  },

  // tabs
  tabsWrapper: {
    paddingTop: 12,
  },
  tabsRow: {
    paddingHorizontal: 16,
    gap: 6,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
  },
  tabActive: {
    backgroundColor: '#D85A30',
    borderColor: '#D85A30',
  },
  tabText: {
    fontSize: 12,
    color: '#888780',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },

  // results count
  resultsCount: {
    fontSize: 12,
    color: '#888780',
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },

  // list
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#888780',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    gap: 8,
    paddingBottom: 32,
  },
  listContentEmpty: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#444441',
  },
  emptySubText: {
    fontSize: 13,
    color: '#888780',
    textAlign: 'center',
    lineHeight: 20,
  },

  // cards
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
    padding: 12,
    gap: 4,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  visitorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C2C2A',
    flex: 1,
  },
  cardMeta: {
    alignItems: 'flex-end',
    gap: 1,
    flexShrink: 0,
    marginLeft: 8,
  },
  dateText: {
    fontSize: 11,
    color: '#888780',
  },
  timeText: {
    fontSize: 12,
    color: '#888780',
    fontWeight: '500',
  },
  reasonText: {
    fontSize: 12,
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
    paddingHorizontal: 9,
    paddingVertical: 3,
    gap: 4,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  exitText: {
    fontSize: 10,
    color: '#B4B2A9',
  },
});