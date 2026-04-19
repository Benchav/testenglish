import fs from 'fs';
import admin from 'firebase-admin';

// Lee las credenciales de firebasekey.json
const serviceAccount = JSON.parse(fs.readFileSync('./firebasekey.json', 'utf-8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

const questions = [
    // --- Parte 1: Gauntlet Nivel 1 (1-10) ---
    {
        id: 1,
        instruction: "Elige la descripción correcta para un escritorio con equipo y planos:",
        englishText: "An architect is looking at a blueprint. On the table, there is a large amount of equipment.",
        options: [
            "There are some equipment and a pencil on the table.",
            "There is a few equipments behind the blueprint.",
            "There is some equipment and many rolls of paper.",
            "There are much rolls of paper next to the pencil."
        ],
        correctIndex: 2,
        hint: "Identify which noun in the list is uncountable and check if the verb agrees with the first item mentioned."
    },
    {
        id: 2,
        instruction: "Reglas de seguridad en un laboratorio. Completa los espacios:",
        englishText: "Researchers _____ enter the bio-hazard room without a mask, but they _____ access the data from the computer outside.",
        options: ["can't / can", "can / can", "can / can't", "can't / can't"],
        correctIndex: 0,
        hint: "Look for the contrast between a dangerous restricted action and a safe allowed action."
    },
    {
        id: 3,
        instruction: "Estructura de un rascacielos. Completa con preposiciones:",
        englishText: "There is a helipad _____ the roof. The roof is _____ the 50th floor. The 49th floor is _____ the 50th floor.",
        options: ["on / above / under", "in / over / behind", "above / under / on", "on / between / above"],
        correctIndex: 0,
        hint: "Focus on the vertical relationship: which part is the surface and which parts are higher or lower."
    },
    {
        id: 4,
        instruction: "En el aeropuerto. ¿Cuál oración usa los cuantificadores correctamente?",
        englishText: "A traveler has two suitcases and a lot of luggage.",
        options: ["There are many luggages in the taxi.", "There is many luggage and two suitcases.", "There is much luggage and two suitcases.", "There are a luggage under the seat."],
        correctIndex: 2,
        hint: "Distinguish between the countable 'suitcases' and the uncountable 'luggage'."
    },
    {
        id: 5,
        instruction: "Multitud en un concierto. Selecciona las opciones correctas:",
        englishText: "The stage is _____ the crowd. There _____ thousands of people _____ the singer and me.",
        options: ["above / are / between", "under / is / among", "between / are / in front of", "above / is / next to"],
        correctIndex: 0,
        hint: "Check the vertical position of the stage and the plural agreement for the large number of people."
    },
    {
        id: 6,
        instruction: "¿Qué oración NO tiene errores gramaticales con verbos modales?",
        englishText: "A student is writing an essay about talent.",
        options: ["She can speaks three languages fluently.", "They can't to understand the difficult math problem.", "He can play the piano, but he can't read music.", "We can singing very loudly in the shower."],
        correctIndex: 2,
        hint: "Remember the 'Modal + Base Verb' rule: no 'to', no 's', and no '-ing'."
    },
    {
        id: 7,
        instruction: "Dentro de un cobertizo (shed). Completa correctamente:",
        englishText: "Inside, _____ some furniture and _____ many tools hanging _____ the wall.",
        options: ["there is / there are / on", "there are / there is / in", "there is / there is / above", "there are / there are / under"],
        correctIndex: 0,
        hint: "Treat 'furniture' as a single mass and 'tools' as individual items."
    },
    {
        id: 8,
        instruction: "Preguntando por ingredientes. ¿Cuál es correcta?",
        englishText: "Asking about the presence of a specific ingredient in a soup.",
        options: ["Are there any salt in the soup?", "Is there much carrots in the soup?", "Is there any salt in the soup?", "Are there much salt in the soup?"],
        correctIndex: 2,
        hint: "Determine if salt is something you can count piece by piece or if it is a mass."
    },
    {
        id: 9,
        instruction: "Capacidades de la oficina. Completa la oración:",
        englishText: "We _____ print 100 pages a minute, but there _____ not enough paper _____ the printer.",
        options: ["can / is / in", "can't / are / on", "can / are / under", "can't / is / behind"],
        correctIndex: 0,
        hint: "Check the agreement for 'paper' and the logical location of paper for a printer."
    },
    {
        id: 10,
        instruction: "Reto Lógico. Leche y galletas:",
        englishText: "There _____ some milk _____ the glass. You _____ drink it because it is fresh, but there _____ any cookies _____ the plate.",
        options: ["is / in / can / aren't / on", "are / on / can't / isn't / under", "is / under / can / is / in", "are / in / can / aren't / behind"],
        correctIndex: 0,
        hint: "Look closely at the plurality of 'cookies' versus the uncountability of 'milk'."
    },
    // --- Parte 2: Gauntlet Nivel 2 (11-30) ---
    {
        id: 11,
        instruction: "Un científico categoriza elementos. Completa la oración:",
        englishText: "There _____ a collection of rare bacteria in the jar, and there _____ much research data on the screen.",
        options: ["is / is", "are / are", "is / are", "are / is"],
        correctIndex: 0,
        hint: "Focus on whether the subject is the group itself ('collection') or the individual items."
    },
    {
        id: 12,
        instruction: "Un atleta habla de sus límites. Selecciona los modales y preposiciones:",
        englishText: "I _____ run a marathon today because of my injury, but I _____ still walk _____ the park for light exercise.",
        options: ["can't / can / through", "can / can't / across", "can't / can / on", "can / can / between"],
        correctIndex: 0,
        hint: "Consider how an injury affects a difficult task versus an easy one."
    },
    {
        id: 13,
        instruction: "Organizando una biblioteca. Completa con verbo y preposiciones:",
        englishText: "There _____ several pieces of furniture in the corner. _____ the armchair, there is a lamp. _____ the lamp, there is a small shelf.",
        options: ["are / Next to / Above", "is / Under / Behind", "are / In / On", "is / Beside / Below"],
        correctIndex: 0,
        hint: "Look at the word 'pieces' to determine the verb, then visualize the furniture layout."
    },
    {
        id: 14,
        instruction: "Un chef revisa ingredientes. ¿Cuál es la forma correcta?",
        englishText: "_____ there _____ advice you can give me? There _____ too much vinegar in the pot.",
        options: ["Is / any / is", "Are / some / are", "Is / many / is", "Are / any / is"],
        correctIndex: 0,
        hint: "Treat 'advice' like 'water'—you can't have 'three advices'."
    },
    {
        id: 15,
        instruction: "Un piloto explica la cabina. Ubicaciones exactas:",
        englishText: "The radar is _____ the control panel. _____ the pilot and co-pilot, there is a central console.",
        options: ["above / Between", "under / Among", "behind / On", "across / Next to"],
        correctIndex: 0,
        hint: "Think about the space shared by exactly two people."
    },
    {
        id: 16,
        instruction: "¿Qué oración sobre capacidad física y clima es gramaticalmente perfecta?",
        englishText: "(Selecciona la opción que no tenga errores de modales ni plurales)",
        options: ["We can't to go outside because there is much snow.", "We can go outside because there aren't many snow.", "We can't go outside because there is too much snow.", "We can goes outside because there is some snows."],
        correctIndex: 2,
        hint: "Watch out for the 'to' after modal verbs and the pluralization of uncountable weather terms."
    },
    {
        id: 17,
        instruction: "En una empresa de software:",
        englishText: "There _____ some sophisticated software available, but there _____ many instructions included.",
        options: ["is / aren't", "are / isn't", "is / isn't", "are / aren't"],
        correctIndex: 0,
        hint: "Software is like information—you can't count one 'software'."
    },
    {
        id: 18,
        instruction: "Describe la escena verticalmente:",
        englishText: "A bridge goes _____ the river. _____ the bridge, there is a car. _____ the water, there are many fish.",
        options: ["over / On / Under", "across / In / Above", "through / Under / In", "over / Behind / On"],
        correctIndex: 0,
        hint: "Visualize the vertical layers: the car, the bridge, and the river."
    },
    {
        id: 19,
        instruction: "Un estudiante pregunta a un profesor por material digital:",
        englishText: "_____ there any information about the exam? I _____ find it _____ the website.",
        options: ["Is / can't / on", "Are / can / in", "Is / can't / at", "Are / can't / on"],
        correctIndex: 0,
        hint: "Check the countability of 'information' and the preposition used for the internet."
    },
    {
        id: 20,
        instruction: "En un hotel de lujo lidiando con equipaje:",
        englishText: "There _____ a large amount of luggage in the lobby. You _____ leave it _____ the reception desk.",
        options: ["is / can / at", "are / can't / in", "is / can / between", "are / can / on"],
        correctIndex: 0,
        hint: "Think about whether luggage is treated as a mass or as individual bags."
    },
    {
        id: 21,
        instruction: "En el zoológico viendo animales:",
        englishText: "_____ there many monkeys in that cage? Yes, and they _____ climb _____ the trees very quickly.",
        options: ["Are / can / up", "Is / can't / in", "Are / can / under", "Is / can / on"],
        correctIndex: 0,
        hint: "Ensure the verb matches the plural noun and the preposition matches the action."
    },
    {
        id: 22,
        instruction: "Revisa esta oración: 'There is a lot of homework, so I can't play today.'",
        englishText: "¿Cuál es la afirmación correcta sobre la oración anterior?",
        options: ["La oración está perfecta.", "Debería ser 'There are a lot of homeworks'.", "Debería ser 'I can't to play'.", "Debería ser 'There are much homework'."],
        correctIndex: 0,
        hint: "Consider if 'homework' can be pluralized like 'books'."
    },
    {
        id: 23,
        instruction: "Un guía describe la vista desde una montaña:",
        englishText: "There _____ a few clouds _____ the summit. You _____ see the view clearly if they move.",
        options: ["are / above / can", "is / on / can't", "are / under / can't", "is / above / can"],
        correctIndex: 0,
        hint: "Agreement with 'clouds' and the logic of visibility are key here."
    },
    {
        id: 24,
        instruction: "En la mesa de un restaurante:",
        englishText: "Is there _____ sugar in this coffee? No, but there _____ some packets of sugar _____ the table.",
        options: ["any / are / on", "some / is / in", "many / are / at", "any / is / on"],
        correctIndex: 0,
        hint: "Distinguish between the substance (sugar) and the container (packets)."
    },
    {
        id: 25,
        instruction: "En clase de física sobre fuerzas invisibles:",
        englishText: "Gravity _____ be seen, but there _____ many ways to measure its force.",
        options: ["can't / are", "can / is", "can't / is", "can / are"],
        correctIndex: 0,
        hint: "Think about whether you can see the force of gravity or just its effects."
    },
    {
        id: 26,
        instruction: "Un gerente de almacén reporta sobre retrasos:",
        englishText: "There _____ a lot of traffic _____ the building today. Our trucks _____ move very quickly.",
        options: ["is / around / can't", "are / between / can", "is / in / can", "are / through / can't"],
        correctIndex: 0,
        hint: "Consider how traffic affects speed and the countability of the word 'traffic'."
    },
    {
        id: 27,
        instruction: "En un viaje de senderismo cuidando la naturaleza:",
        englishText: "There _____ some trash _____ the path. We _____ pick it up to keep the forest clean.",
        options: ["is / along / can", "are / on / can't", "is / behind / can't", "are / beside / can"],
        correctIndex: 0,
        hint: "Is 'trash' like 'bottles' (countable) or like 'water' (uncountable)?"
    },
    {
        id: 28,
        instruction: "En un laboratorio de biología discutiendo hallazgos:",
        englishText: "_____ there any news about the experiment? Yes, there _____ some interesting evidence _____ the microscopic slides.",
        options: ["Is / is / on", "Are / are / in", "Is / are / on", "Are / is / at"],
        correctIndex: 0,
        hint: "Don't let the 's' in 'news' trick you into thinking it's plural."
    },
    {
        id: 29,
        instruction: "Un jugador de videojuegos está frustrado:",
        englishText: "There _____ many enemies _____ the corner. I _____ see them, so I _____ win this level!",
        options: ["are / around / can't / can't", "is / on / can / can", "are / at / can't / can", "is / behind / can / can't"],
        correctIndex: 0,
        hint: "Check the agreement for 'enemies' and follow the sequence of the player's problem."
    },
    {
        id: 30,
        instruction: "Maestría Final: Espacio y obstáculos:",
        englishText: "_____ there much space _____ the trunk of the car? No, there _____ several heavy boxes _____ the way.",
        options: ["Is / in / are / in", "Are / at / is / on", "Is / on / are / behind", "Are / in / are / in"],
        correctIndex: 0,
        hint: "Determine the countability of 'space' versus 'boxes' and the meaning of being 'in the way'."
    }
];

const TEACHER_EMAIL = "lucimar132803@gmail.com";
const TEACHER_PASS = "luci2026";

async function main() {
    console.log("Iniciando setup...");

    // 1. Crear el usuario Maestro en Firebase Authentication (si no existe)
    let userRecord;
    try {
        userRecord = await auth.getUserByEmail(TEACHER_EMAIL);
        console.log("El usuario maestro ya existe:", userRecord.uid);
    } catch (error) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/configuration-not-found') {
            try {
                userRecord = await auth.createUser({
                    email: TEACHER_EMAIL,
                    password: TEACHER_PASS,
                    displayName: "Teacher",
                });
                console.log("Usuario creado existosamente con ID:", userRecord.uid);
            } catch (createError) {
                console.error("No se pudo crear el usuario en Auth (Asegúrate de haber habilitado Authentication y el método Correo/Contraseña en la consola de Firebase):", createError.message);
                // Usaremos un UID quemado sólo para crearle el rol por ahora, 
                // cuando se registren con ese correo, tomará este rol, o si Firebase genera otro UID, hay que ajustarlo.
                userRecord = { uid: "docente_temporal_uid" }; 
            }
        } else {
            console.error("Error consultando Auth (si dice configuration-not-found, Firebase Auth no está listo):", error.message);
            userRecord = { uid: "docente_temporal_uid" };
        }
    }

    // 2. Establecer el rol del profesor en la base de datos
    await db.collection('usuarios').doc(userRecord.uid).set({
        email: TEACHER_EMAIL,
        rol: 'docente',
        nombre: 'Teacher',
        createdAt: new Date().toISOString()
    });
    console.log("Rol del maestro establecido correctamente.");

    // 3. Subir las 30 preguntas a la base de datos (borrar si existen)
    console.log("Sincronizando preguntas...");
    const batch = db.batch();
    const preguntasRef = db.collection('preguntas');
    
    // Eliminamos las preguntas viejas para no duplicar si se corre el script varias veces:
    const oldQuestions = await preguntasRef.get();
    oldQuestions.docs.forEach(doc => batch.delete(doc.ref));

    // Añadimos las preguntas asegurándonos de conservar el órden
    questions.forEach((q) => {
        // Guardamos el doc con ID 'q1', 'q2', etc para que lleguen ordenados (firestore te da hash randoms sino)
        const docRef = preguntasRef.doc(`q${q.id.toString().padStart(2, '0')}`);
        batch.set(docRef, q);
    });

    await batch.commit();
    console.log("30 Preguntas insertadas en Firestore.");

    // 4. Implementar Reglas de Seguridad Básicas
    console.log("Configurando Reglas de Seguridad en Firestore...");
    const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /preguntas/{document=**} {
      // Todo usuario autenticado (estudiantes y docente) puede leer las preguntas
      allow read: if request.auth != null;
      allow write: if false; // Nadie sobreescribe desde el cliente, solo admin SDK
    }
    match /usuarios/{userId} {
      // Profesores pueden leer. Estudiantes pueden leer su propio rol y crear su registro inicial.
      allow read: if request.auth != null && (request.auth.uid == userId || get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == 'docente');
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update, delete: if false;
    }
    match /calificaciones/{testId} {
      allow read: if request.auth != null && (request.auth.uid == resource.data.uid || get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == 'docente');
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
      allow update, delete: if request.auth != null && get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == 'docente';
    }
    // Backward compatibility for old results during testing
    match /artifacts/{document=**} {
      allow read, write: if true;
    }
  }
}`;

    try {
      const source = {
        files: [{ name: "firestore.rules", content: rules }]
      };
      const ruleset = await admin.securityRules().createRuleset({ source });
      await admin.securityRules().releaseFirestoreRuleset(ruleset.name);
      console.log("Reglas desplegadas satisfactoriamente.");
    } catch(e) {
      console.error("No se pudieron desplegar las relgas automáticamente (puede que requieras el plan Blaze o falten permisos API):", e.message);
      console.log("Por favor pega las siguientes reglas manualmente en la consola de Firebase:");
      console.log(rules);
    }

    console.log("¡Todo listo! El sistema base está provisionado.");
    process.exit(0);
}

main().catch(console.error);
