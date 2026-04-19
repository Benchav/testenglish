import fs from 'fs';
import admin from 'firebase-admin';

const serviceAccount = JSON.parse(fs.readFileSync('./firebasekey.json', 'utf-8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function fix() {
    try {
        const email = "lucimar132803@gmail.com";
        const user = await auth.getUserByEmail(email);
        console.log("Encontrado UID real del usuario:", user.uid);

        await db.collection('usuarios').doc(user.uid).set({
            email: email,
            rol: 'docente',
            nombre: 'Profesor Principal',
            createdAt: new Date().toISOString()
        }, { merge: true });

        console.log("Rol actualizado a DOCENTE correctamente en Firestore.");
        
        // Limpiar el doc basura temporal si existe
        await db.collection('usuarios').doc("docente_temporal_uid").delete().catch(()=>console.log("ok"));

        process.exit(0);
    } catch (e) {
        console.error("Error:", e.message);
        process.exit(1);
    }
}
fix();
