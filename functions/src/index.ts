const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// 🔥 Crée un utilisateur côté serveur (sécurisé)
exports.adminCreateUser = functions.https.onCall(async (data, context) => {
  // Vérifie que l’appelant est un admin
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Non autorisé");
  }
  const callerUID = context.auth.uid;
  const callerDoc = await admin.firestore().collection("users").doc(callerUID).get();
  if (!callerDoc.exists || callerDoc.data().role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Accès réservé aux admins");
  }

  // Création du compte
  const { email, password, role } = data;
  const userRecord = await admin.auth().createUser({ email, password });

  // Ajout dans Firestore
  await admin.firestore().collection("users").doc(userRecord.uid).set({
    uid: userRecord.uid,
    email,
    role,
    active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { message: "Utilisateur créé", uid: userRecord.uid };
});
