export const ROLE_THEMES = {
  guard: {
    primary: '#1D9E75',
    primaryLight: '#E1F5EE',
    primaryDark: '#085041',
    accent: '#5DCAA5',
    label: 'Guard',
  },
  resident: {
    primary: '#D85A30',
    primaryLight: '#FAECE7',
    primaryDark: '#712B13',
    accent: '#F0997B',
    label: 'Resident',
  },
  admin: {
    primary: '#534AB7',
    primaryLight: '#EEEDFE',
    primaryDark: '#26215C',
    accent: '#AFA9EC',
    label: 'Admin',
  },
};

export const DRAWER_MENU = {
  guard: [
    { key: 'Home', label: 'Home', screen: 'GuardHome' },
    { key: 'TodaysVisits', label: "Today's visits", screen: 'TodaysVisits' },
  ],
  resident: [
    { key: 'Home', label: 'Home', screen: 'ResidentHome' },
    { key: 'PastVisits', label: 'Past visits', screen: 'PastVisits' },
    { key: 'FamilyMembers', label: 'Family members', screen: 'FamilyMembers' },
  ],
  admin: [
    { key: 'Home', label: 'Home', screen: 'AdminHome' },
    { key: 'ManageGuards', label: 'Manage guards', screen: 'ManageGuards' },
    { key: 'ManageResidents', label: 'Manage residents', screen: 'ManageResidents' },
    { key: 'ManageFlats', label: 'Manage flats', screen: 'ManageFlats' },
  ],
};