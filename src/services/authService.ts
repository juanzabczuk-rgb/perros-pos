import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  User as FirebaseUser,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User } from '../types';

export const authService = {
  loginWithEmail: async (email: string, pass: string) => {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result.user;
  },

  registerWithEmail: async (email: string, pass: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    await sendEmailVerification(result.user);
    return result.user;
  },

  logout: async () => {
    await signOut(auth);
  },

  resetPassword: async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  },

  getUserData: async (uid: string): Promise<User | null> => {
    const userDoc = await getDoc(doc(db, 'empleados', uid));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() } as User;
    }
    return null;
  },

  createInitialUser: async (firebaseUser: FirebaseUser) => {
    const userData: Partial<User> = {
      name: firebaseUser.displayName || 'Propietario',
      email: firebaseUser.email || '',
      role: 'owner',
      branch_id: 'main',
      branch_name: 'Casa Central',
      active: true,
      createdAt: serverTimestamp() as { seconds: number; nanoseconds: number }
    };
    
    await setDoc(doc(db, 'empleados', firebaseUser.uid), userData);
    return { id: firebaseUser.uid, ...userData } as User;
  },

  verifyPin: async (userId: string, pin: string): Promise<boolean> => {
    try {
      // Consultamos directamente el documento del empleado en Firestore
      const userDoc = await getDoc(doc(db, 'empleados', userId));
      
      if (!userDoc.exists()) {
        console.error("Empleado no encontrado en Firestore");
        return false;
      }

      const userData = userDoc.data();
      const storedPin = userData?.pin;

      // Si no hay PIN configurado, permitimos el acceso (seguridad opcional)
      if (storedPin === undefined || storedPin === null || storedPin === "") {
        return true;
      }

      // Comparamos el PIN ingresado con el almacenado (como texto plano)
      // Nota: Si usas hashes (bcrypt) en la DB, esto fallará, pero para PINs simples de 4 dígitos suele ser texto plano.
      const inputPinStr = String(pin).trim();
      const storedPinStr = String(storedPin).trim();

      return inputPinStr === storedPinStr;
    } catch (error) {
      console.error("Error verificando PIN en el frontend:", error);
      return false;
    }
  }
};
