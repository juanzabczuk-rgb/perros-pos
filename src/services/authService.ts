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
      const response = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: userId, pin })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.success;
      }
      
      // If user has no PIN in DB, we might want to allow entry (legacy check)
      if (response.status === 400) {
        const userDoc = await getDoc(doc(db, 'empleados', userId));
        if (userDoc.exists() && !userDoc.data().pin) return true;
      }
      
      return false;
    } catch (error) {
      console.error("Error verifying PIN via API:", error);
      return false;
    }
  }
};
