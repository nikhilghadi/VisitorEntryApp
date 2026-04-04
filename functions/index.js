const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Trigger: New Visit Created
 */
exports.onNewVisitCreated = onDocumentCreated(
  {
    document: 'visits/{visitId}',
    region: 'asia-south1',
  },
  async (event) => {
    try {
      const snap = event.data;
      if (!snap) return;

      const visit = snap.data();
      const visitId = event.params.visitId;

      const flatRef = visit.flat_id;
      const flatId = flatRef?.id || flatRef;

      if (!flatId) {
        //console.log('No flat_id on visit — skipping notification');
        return;
      }

      // Get flat details
      const flatDoc = await db.collection('flats').doc(flatId).get();
      const flatNumber = flatDoc.exists
        ? flatDoc.data().flat_number
        : 'your flat';

      // Fetch residents
      const residentsSnap = await db
        .collection('users')
        .where('flat_id', '==', flatId)
        .where('role', '==', 'resident')
        .where('is_active', '==', true)
        .get();

      if (residentsSnap.empty) {
        //console.log(`No active residents for flat ${flatId}`);
        return;
      }

      // Collect tokens
      const tokenDocs = [];
      residentsSnap.forEach((doc) => {
        const token = doc.data().fcm_token;
        //console.log(`Resident ${doc.id}  ${doc.data().name} token:`, token);
        if (token && token !== '' && token !== 'null') {
          tokenDocs.push({ docId: doc.id, token });
        }
      });
      //console.log(tokenDocs)
      if (tokenDocs.length === 0) {
        //console.log('No FCM tokens found');
        return;
      }

      // Notification payload
      const visitorName = visit.visitor_name || 'Someone';
      const reason = visit.reason_for_visit || 'Visit';
      const requiresApproval = visit.status === 'pending';

      const notification = {
        title: requiresApproval
          ? `Visitor at ${flatNumber} — Approval needed`
          : `Visitor arrived at ${flatNumber}`,
        body: requiresApproval
          ? `${visitorName} is at the gate for ${reason}. Tap to approve or reject.`
          : `${visitorName} has arrived for ${reason}.`,
      };

      const data = {
        visitId,
        flatId,
        visitorName,
        requiresApproval: requiresApproval ? 'true' : 'false',
        type: 'new_visit',
      };

      // Send notifications
      const sendPromises = tokenDocs.map(({ docId, token }) =>
        messaging
          .send({
            token,
            notification,
            data,
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
                channelId: 'visits',
                clickAction: 'FLUTTER_NOTIFICATION_CLICK',
              },
            },
          })
          .then(() => ({ docId, success: true }))
          .catch((error) => ({ docId, success: false, error }))
      );

      const results = await Promise.all(sendPromises);

      // Cleanup stale tokens
      const updates = results
        .filter((r) => !r.success)
        .map((r) => {
          const code = r.error?.code || '';
          const isStale =
            code.includes('registration-token-not-registered') ||
            code.includes('invalid-registration-token') ||
            code.includes('invalid-argument');

          if (isStale) {
            return db.collection('users').doc(r.docId).update({
              fcm_token: '',
              updated_at: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
          return null;
        })
        .filter(Boolean);

      if (updates.length) await Promise.all(updates);

      //console.log(`Sent ${results.filter((r) => r.success).length}/${tokenDocs.length}`);
    } catch (error) {
      console.error('onNewVisitCreated error:', error);
    }
  }
);

/**
 * Trigger: Visit Status Changed
 */
exports.onVisitStatusChanged = onDocumentUpdated(
  {
    document: 'visits/{visitId}',
    region: 'asia-south1',
  },
  async (event) => {
    try {
      const before = event.data.before.data();
      const after = event.data.after.data();

      if (!before || !after) return;

      // Only pending → approved/rejected
      if (before.status === after.status) return;
      if (before.status !== 'pending') return;
      if (!['approved', 'rejected'].includes(after.status)) return;

      const visitId = event.params.visitId;

      const guardRef = after.guard_id;
      const guardId = guardRef?.id || guardRef;

      if (!guardId) return;

      const guardDoc = await db.collection('users').doc(guardId).get();
      if (!guardDoc.exists) return;

      const token = guardDoc.data().fcm_token;
      if (!token || token === '' || token === 'null') return;

      const visitorName = after.visitor_name || 'Visitor';
      const isApproved = after.status === 'approved';

      await messaging.send({
        token,
        notification: {
          title: isApproved ? 'Entry approved' : 'Entry rejected',
          body: isApproved
            ? `${visitorName}'s entry has been approved. Allow them in.`
            : `${visitorName}'s entry has been rejected.`,
        },
        data: {
          visitId,
          status: after.status,
          type: 'visit_status_update',
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'visits',
          },
        },
      });

      //console.log(`Guard notified for visit ${visitId}`);
    } catch (error) {
      console.error('onVisitStatusChanged error:', error);
    }
  }
);