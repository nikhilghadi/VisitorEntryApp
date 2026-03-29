// safely extracts a plain string ID from either a Firestore
// Reference object or a plain string — use this everywhere
// you read reference fields from userProfile or any document
export const getRefId = (field) => {
  if (!field) return null;
  if (typeof field === 'string') return field;
  if (field?.id) return field.id; // Firestore DocumentReference
  return null;
};

// safely extracts a plain string from any field that might
// be an object — prevents "Objects not valid as React child"
export const safeString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value?.id) return value.id;
  return '';
};