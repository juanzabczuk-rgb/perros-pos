import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, PrinterSettings, TicketSettings, RolePermission, Branch, Shift } from '../types';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

export interface AppContextType {
  user: User | null;
  setUser: (_u: User | null) => void;
  allUsers: User[];
  branch: Branch | null;
  setBranch: (_b: Branch | null) => void;
  shift: Shift | null;
  setShift: (_s: Shift | null) => void;
  onOpenCloseShift: () => void;
  printerSettings: PrinterSettings;
  setPrinterSettings: (_s: PrinterSettings) => void;
  ticketSettings: TicketSettings;
  setTicketSettings: (_s: TicketSettings) => void;
  shiftTolerance: number;
  setShiftTolerance: (_t: number) => void;
  activeOperator: User | null;
  setActiveOperator: (_u: User | null) => void;
  isAuthReady: boolean;
  rolePermissions: RolePermission[];
  isFirstUser: boolean;
  showShiftModal: boolean;
  setShowShiftModal: (_s: boolean) => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [shift, setShift] = useState<Shift | null>(null);
  const [activeOperator, setActiveOperator] = useState<User | null>(null);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [isFirstUser, setIsFirstUser] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);

  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>({
    name: 'Impresora Térmica',
    address: '',
    type: 'network',
    paperWidth: '80mm'
  });

  const [ticketSettings, setTicketSettings] = useState<TicketSettings>({
    header: 'PANCHERIA PRO',
    footer: '¡Gracias por su compra!',
    showLogo: true,
    showAddress: true,
    showPhone: true,
    printTicket: true,
    printComanda: true,
    printShiftClosing: true
  });

  const [shiftTolerance, setShiftTolerance] = useState(5);

  useEffect(() => {
    if (!auth.currentUser) return () => {};

    const unsub = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.printer) setPrinterSettings(data.printer);
        if (data.ticket) setTicketSettings(data.ticket);
        if (data.shiftTolerance !== undefined) setShiftTolerance(data.shiftTolerance);
      }
    }, (err) => {
      if (err.code !== 'permission-denied') {
        handleFirestoreError(err, OperationType.GET, 'settings/global');
      }
    });
    return () => unsub();
  }, [auth.currentUser]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'empleados', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser({ id: userDoc.id, ...userDoc.data() } as User);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `empleados/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
        setActiveOperator(null);
      }
      setIsAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return () => {};

    if (auth.currentUser) {
      const unsub = onSnapshot(collection(db, 'empleados'), (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
        setIsFirstUser(snapshot.empty);
      }, (err) => {
        if (err.code !== 'permission-denied') {
          handleFirestoreError(err, OperationType.LIST, 'empleados');
        }
      });
      return () => unsub();
    } else {
      // If not logged in, we can't check isFirstUser with current rules.
      // We'll assume false and let the user click "Register" manually if needed.
      setAllUsers([]);
      setIsFirstUser(false);
      return () => {};
    }
  }, [isAuthReady, auth.currentUser]);

  useEffect(() => {
    if (!auth.currentUser) {
      setRolePermissions([]);
      return () => {};
    }

    const unsub = onSnapshot(collection(db, 'role_permissions'), (snapshot) => {
      setRolePermissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RolePermission)));
    }, (err) => {
      if (err.code !== 'permission-denied') {
        handleFirestoreError(err, OperationType.LIST, 'role_permissions');
      }
    });
    return () => unsub();
  }, [auth.currentUser]);

  useEffect(() => {
    if (user?.branch_id) {
      const unsub = onSnapshot(doc(db, 'branches', user.branch_id), (doc) => {
        if (doc.exists()) {
          setBranch({ id: doc.id, ...doc.data() } as Branch);
        }
      }, (err) => {
        if (err.code === 'permission-denied') return;
        handleFirestoreError(err, OperationType.GET, `branches/${user.branch_id}`);
      });
      return () => unsub();
    }
    return () => {};
  }, [user?.branch_id]);

  useEffect(() => {
    const currentBranchId = activeOperator?.branch_id || user?.branch_id;
    if (currentBranchId) {
      const q = query(
        collection(db, 'shifts'), 
        where('branch_id', '==', currentBranchId), 
        where('status', '==', 'open')
      );
      const unsub = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          setShift({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Shift);
        } else {
          setShift(null);
        }
      }, (err) => {
        if (err.code === 'permission-denied') return;
        handleFirestoreError(err, OperationType.LIST, 'shifts');
      });
      return () => unsub();
    }
    return () => {};
  }, [user?.branch_id, activeOperator?.branch_id]);

  useEffect(() => {
    const currentUser = activeOperator || user;
    if (currentUser && !shift && !showShiftModal && isAuthReady) {
      setShowShiftModal(true);
    }
  }, [user, activeOperator, shift, showShiftModal, isAuthReady]);

  const onOpenCloseShift = () => {
    setShowShiftModal(true);
  };

  return (
    <AppContext.Provider value={{
      user, setUser,
      allUsers,
      branch, setBranch,
      shift, setShift,
      onOpenCloseShift,
      printerSettings, setPrinterSettings,
      ticketSettings, setTicketSettings,
      shiftTolerance, setShiftTolerance,
      activeOperator, setActiveOperator,
      isAuthReady,
      rolePermissions,
      isFirstUser,
      showShiftModal, setShowShiftModal
    }}>
      {children}
    </AppContext.Provider>
  );
};
