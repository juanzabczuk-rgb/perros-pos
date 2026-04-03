import express from "express";
import path from "path";
import fs from "fs";
import admin from "firebase-admin";
import bcrypt from "bcryptjs";

// Initialize Firebase Admin
let db: admin.firestore.Firestore;

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  let firebaseConfig: Record<string, unknown> = {};
  
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  // Use environment variables if available, otherwise fallback to config file
  const projectId = (process.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId) as string;
  const databaseId = (process.env.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId) as string;

  // Initialize with default credentials - most reliable in Cloud Run/Vercel
  if (!admin.apps.length) {
    console.log(`Initializing Firebase Admin...`);
    
    // If we have a service account in env, use it. Otherwise use ADC.
    const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountVar) {
      try {
        const serviceAccount = JSON.parse(serviceAccountVar);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseId: databaseId && databaseId !== '(default)' ? databaseId : undefined
        });
      } catch (e) {
        console.error("Error parsing FIREBASE_SERVICE_ACCOUNT env var:", e);
        admin.initializeApp({ projectId });
      }
    } else {
      admin.initializeApp({ projectId });
    }
  }
  
  // Use the database ID from config if available
  const finalDatabaseId = databaseId && databaseId !== '(default)' ? databaseId : undefined;

  // @ts-expect-error - databaseId is supported in newer versions of firebase-admin
  db = finalDatabaseId ? admin.firestore(finalDatabaseId) : admin.firestore();
  
  console.log(`Firebase Admin initialized.`);
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
}

const app = express();

app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// PIN Verification Endpoint
app.post("/api/auth/verify-pin", async (req, res) => {
    const { operatorId, pin } = req.body;

    if (!operatorId || !pin) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    if (!db) {
      return res.status(500).json({ error: "Base de datos no inicializada" });
    }

    try {
      const operatorDoc = await db.collection("empleados").doc(operatorId).get();
      
      if (!operatorDoc.exists) {
        return res.status(404).json({ error: "Operador no encontrado" });
      }

      const operatorData = operatorDoc.data();
      const storedPin = operatorData?.pin;

      console.log(`[AUTH] Verificando PIN para: ${operatorId}`);
      console.log(`[AUTH] Project: ${admin.app().options.projectId}`);
      
      // If no PIN is configured, allow entry (optional security)
      if (storedPin === undefined || storedPin === null || storedPin === "") {
        console.log("[AUTH] Operador sin PIN configurado.");
        return res.json({ success: true, operator: { id: operatorDoc.id, ...operatorData } });
      }

      console.log(`[AUTH] PIN almacenado encontrado (longitud: ${String(storedPin).length})`);

      // Support both bcrypt and plain text for transition
      let isMatch = false;
      const inputPinStr = String(pin).trim();
      const storedPinStr = String(storedPin).trim();

      if (storedPinStr.startsWith('$2a$') || storedPinStr.startsWith('$2b$')) {
        console.log("[AUTH] Usando comparación BCrypt");
        isMatch = await bcrypt.compare(inputPinStr, storedPinStr);
      } else {
        console.log("[AUTH] Usando comparación texto plano");
        isMatch = inputPinStr === storedPinStr;
      }

      if (isMatch) {
        console.log("[AUTH] PIN correcto.");
        // Return success and operator data (excluding sensitive info)
        const safeData = { ...operatorData };
        delete (safeData as { pin?: string }).pin;
        return res.json({ success: true, operator: { id: operatorDoc.id, ...safeData } });
      } else {
        console.log(`[AUTH] PIN incorrecto. Ingresado: ${inputPinStr.length} chars, Guardado: ${storedPinStr.length} chars`);
        return res.status(401).json({ error: "PIN incorrecto" });
      }
    } catch (error) {
      console.error("Error verifying PIN:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Failed to load Vite server:", e);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

export default app;

// Only listen if not running on Vercel
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
