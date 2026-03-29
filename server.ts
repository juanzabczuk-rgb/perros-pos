import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import admin from "firebase-admin";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
let db: admin.firestore.Firestore;

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  let firebaseConfig: any = {};
  
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

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
          databaseId: firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
            ? firebaseConfig.firestoreDatabaseId 
            : undefined
        });
      } catch (e) {
        console.error("Error parsing FIREBASE_SERVICE_ACCOUNT env var:", e);
        admin.initializeApp({
          projectId: firebaseConfig.projectId
        });
      }
    } else {
      admin.initializeApp({
        projectId: firebaseConfig.projectId
      });
    }
  }
  
  // Use the database ID from config if available
  const databaseId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
    ? firebaseConfig.firestoreDatabaseId 
    : undefined;

  // @ts-expect-error - databaseId is supported in newer versions of firebase-admin
  db = databaseId ? admin.firestore(databaseId) : admin.firestore();
  
  console.log(`Firebase Admin initialized.`);
  console.log(`Project ID: ${admin.app().options.projectId}`);
  console.log(`Database ID: ${databaseId || '(default)'}`);
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
  // Don't exit immediately, allow server to start so health checks pass
}

async function startServer() {
  const app = express();
  const PORT = 3000;

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
      const storedPinHash = operatorData?.pin;

      if (!storedPinHash) {
        return res.status(400).json({ error: "El operador no tiene PIN configurado" });
      }

      const isMatch = await bcrypt.compare(pin, storedPinHash);

      if (isMatch) {
        // Return success and operator data (excluding sensitive info)
        const { pin: _, ...safeData } = operatorData;
        return res.json({ success: true, operator: { id: operatorDoc.id, ...safeData } });
      } else {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
