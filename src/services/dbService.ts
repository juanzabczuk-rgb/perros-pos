import { 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  runTransaction, 
  serverTimestamp,
  DocumentReference,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { User, Product, Customer, CartItem, Sale, Branch, Shift, CashMovement } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

// --- Shifts ---
export const openShift = async (user: User, operator: User, initialCash: number, notes: string) => {
  try {
    const docRef = await addDoc(collection(db, 'shifts'), {
      user_id: operator.id,
      user_name: operator.name,
      branch_id: user.branch_id,
      start_time: serverTimestamp(),
      end_time: null,
      initial_cash: initialCash,
      expected_cash: initialCash,
      notes: notes,
      status: 'open'
    });
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'shifts');
  }
};

export const closeShift = async (shiftId: string, realCash: number, expectedCash: number, notes: string) => {
  try {
    await updateDoc(doc(db, 'shifts', shiftId), {
      end_time: serverTimestamp(),
      real_cash: realCash,
      expected_cash: expectedCash,
      status: 'closed',
      notes: notes
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `shifts/${shiftId}`);
  }
};

// --- Sales ---
export const createSale = async (user: User, shiftId: string, cart: CartItem[], total: number, paymentType: string, customer: Customer | null) => {
  try {
    const saleId = doc(collection(db, 'sales')).id;
    const saleRef = doc(db, 'sales', saleId);
    
    await runTransaction(db, async (transaction) => {
      const stockRefs: { ref: DocumentReference, qty: number }[] = [];
      
      for (const item of cart) {
        if (item.is_composite && item.components) {
          for (const comp of item.components) {
            let targetId = comp.id;
            if (comp.type === 'category' && item.selections && item.selections[comp.id]) {
              targetId = item.selections[comp.id];
            }
            stockRefs.push({ 
              ref: doc(db, 'branches', user.branch_id, 'stock', targetId),
              qty: comp.quantity * item.quantity
            });
          }
        } else {
          stockRefs.push({ 
            ref: doc(db, 'branches', user.branch_id, 'stock', item.id),
            qty: item.quantity
          });
        }
      }

      const stockSnaps = await Promise.all(stockRefs.map(s => transaction.get(s.ref)));
      
      let customerSnap = null;
      let customerRef = null;
      if (customer) {
        customerRef = doc(db, 'customers', customer.id);
        customerSnap = await transaction.get(customerRef);
      }

      transaction.set(saleRef, {
        branch_id: user.branch_id,
        user_id: user.id,
        user_name: user.name,
        customer_id: customer?.id || null,
        shift_id: shiftId,
        total,
        discount: 0,
        payment_type: paymentType,
        status: 'completed',
        created_at: serverTimestamp(),
        items: cart.map(item => ({
          id: item.id,
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          price: item.price,
          selections: item.selections || null
        }))
      });

      for (let i = 0; i < stockRefs.length; i++) {
        const s = stockRefs[i];
        const snap = stockSnaps[i];
        const currentQty = snap.exists() ? (snap.data() as any).quantity : 0;
        transaction.set(s.ref, { 
          quantity: currentQty - s.qty,
          lastUpdated: serverTimestamp()
        }, { merge: true });
      }

      if (customerRef && customerSnap?.exists()) {
        const pointsToAdd = Math.floor(total / 100);
        transaction.update(customerRef, { 
          points: (customerSnap.data().points || 0) + pointsToAdd 
        });
      }
    });

    return saleId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'sales');
  }
};

// --- Generic Helpers ---
export const getCollection = async (collectionName: string) => {
  try {
    const snap = await getDocs(collection(db, collectionName));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, collectionName);
  }
};

export const subscribeToCollection = (collectionName: string, callback: (data: any[]) => void) => {
  const q = query(collection(db, collectionName));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (err) => handleFirestoreError(err, OperationType.LIST, collectionName));
};
