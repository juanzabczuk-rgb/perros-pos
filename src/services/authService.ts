import { 
  onAuthStateChanged, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import bcrypt from 'bcryptjs';
import { auth, db } from '../firebase';
import { User } from '../types';

export const authService = {
  loginWithGoogle: async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  },

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
      createdAt: serverTimestamp() as any
    };
    
    await setDoc(doc(db, 'empleados', firebaseUser.uid), userData);
    return { id: firebaseUser.uid, ...userData } as User;
  },

  verifyPin: async (userId: string, pin: string): Promise<boolean> => {
    const userDoc = await getDoc(doc(db, 'empleados', userId));
    if (userDoc.exists()) {
      const data = userDoc.data();
      if (!data.pin) return true; // Si no tiene PIN, entra directo
      return await bcrypt.compare(pin, data.pin);
    }
    return false;
  }
};
