import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();


// ✅ Fonction pour créer un utilisateur dans Auth + Firestore
export const adminCreateUser = functions.https.onCall(async (data, context) => {
  // Vérifie que l'appelant est connecté
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Vous devez être connecté");
  }

  // Vérifie le rôle de l'appelant
  const callerDoc = await admin.firestore().collection("users").doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data().role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Accès réservé aux administrateurs");
  }

  const { email, password, role } = data;
  if (!email || !password || !role) {
    throw new functions.https.HttpsError("invalid-argument", "Email, mot de passe et rôle sont requis");
  }

  try {
    // Création du compte dans Firebase Auth
    const userRecord = await admin.auth().createUser({ email, password });

    // Enregistrement dans Firestore
    await admin.firestore().collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      role,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { message: `✅ Utilisateur ${email} créé avec succès`, uid: userRecord.uid };
  } catch (error: any) {
    console.error("Erreur lors de la création :", error);
    // Masquer les détails internes de l'erreur au client
    if (error.code === 'auth/email-already-exists') {
        throw new functions.https.HttpsError('already-exists', 'Cette adresse email est déjà utilisée.');
    }
    throw new functions.https.HttpsError("internal", "Une erreur interne est survenue lors de la création de l'utilisateur.");
  }
});