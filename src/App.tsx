import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import bcrypt from 'bcryptjs';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  UserCircle, 
  Settings, 
  LogOut, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  ChevronRight,
  Clock,
  TrendingUp,
  Store,
  Edit,
  Save,
  X,
  PlusCircle,
  MinusCircle,
  Tag,
  Check,
  ArrowRightLeft,
  MessageCircle,
  RotateCcw,
  Menu,
  History,
  QrCode,
  Printer,
  Camera,
  Utensils,
  Lock
} from 'lucide-react';
import { User, Product, Customer, CartItem, Sale, RolePermission, Branch, Shift, CashMovement, ProductComponent, PrinterSettings, TicketSettings } from './types';
import { calcularTotal } from './utils/ventas';
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
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification
} from 'firebase/auth';
import { db, auth } from './firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

// --- Error Boundary ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode, fallback?: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode, fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 text-center bg-white rounded-3xl border border-stone-100 shadow-sm">
          <h2 className="text-xl font-black text-stone-900 uppercase tracking-tight mb-2">Algo salió mal</h2>
          <p className="text-stone-500 text-sm mb-4">Ocurrió un error al cargar esta sección.</p>
          <button 
            onClick={() => this.setState({ hasError: false })}
            className="bg-brand-red text-white px-6 py-2 rounded-xl font-bold text-sm shadow-lg shadow-brand-red/20"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Context ---
interface AppContextType {
  user: User | null;
  setUser: (u: User | null) => void;
  allUsers: User[];
  branch: any | null;
  setBranch: (b: any | null) => void;
  shift: any | null;
  setShift: (s: any | null) => void;
  onOpenCloseShift: () => void;
  printerSettings: PrinterSettings;
  setPrinterSettings: (s: PrinterSettings) => void;
  ticketSettings: TicketSettings;
  setTicketSettings: (s: TicketSettings) => void;
  shiftTolerance: number;
  setShiftTolerance: (t: number) => void;
  activeOperator: User | null;
  setActiveOperator: (u: User | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

// --- Components ---

const LoginScreen = ({ onGoogleLogin, onEmailPasswordLogin, onRegister, isFirstUser }: { 
  onGoogleLogin: () => void,
  onEmailPasswordLogin: (email: string, pass: string) => Promise<void>,
  onRegister: (email: string, pass: string) => Promise<void>,
  isFirstUser: boolean 
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'initial' | 'verify'>(isFirstUser ? 'register' : 'initial');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if user is logged in but not verified
  useEffect(() => {
    const user = auth.currentUser;
    if (user && !user.emailVerified && user.providerData[0]?.providerId === 'password') {
      setMode('verify');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        await onRegister(email, password);
        setMode('verify');
      } else {
        await onEmailPasswordLogin(email, password);
        const user = auth.currentUser;
        if (user && !user.emailVerified) {
          setMode('verify');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error en la autenticación');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (auth.currentUser) {
      try {
        setLoading(true);
        await sendEmailVerification(auth.currentUser);
        alert('Correo de verificación reenviado.');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-900 text-white p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-stone-800 p-8 rounded-[40px] shadow-2xl border border-stone-700"
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-brand-yellow rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand-yellow/20 rotate-3">
            <Utensils size={40} className="text-stone-900" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter">Panchería POS</h1>
          <p className="text-stone-400 text-sm mt-2 font-medium">
            {mode === 'verify' ? 'Verifique su correo' : isFirstUser ? 'Configurar cuenta de propietario' : mode === 'register' ? 'Crear nueva cuenta' : 'Inicie sesión para continuar'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-900/30 rounded-2xl text-red-400 text-xs font-bold text-center">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {mode === 'verify' ? (
            <div className="text-center space-y-6">
              <div className="p-4 bg-stone-900/50 rounded-2xl border border-stone-700">
                <p className="text-stone-300 text-sm leading-relaxed">
                  Hemos enviado un enlace de verificación a su correo. Por favor, haga clic en el enlace para activar su cuenta.
                </p>
              </div>
              <button 
                onClick={handleResendVerification}
                disabled={loading}
                className="w-full py-4 bg-brand-yellow text-stone-900 font-black rounded-2xl shadow-lg hover:bg-yellow-400 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Reenviar Correo'}
              </button>
              <button 
                onClick={() => {
                  auth.signOut();
                  setMode('initial');
                }}
                className="w-full py-4 bg-stone-700 text-white font-bold rounded-2xl hover:bg-stone-600 transition-all text-xs uppercase tracking-widest"
              >
                Volver al Inicio
              </button>
            </div>
          ) : mode === 'initial' ? (
            <>
              <button 
                onClick={onGoogleLogin}
                className="w-full py-4 bg-white text-stone-900 font-black rounded-2xl shadow-lg hover:bg-stone-100 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continuar con Google
              </button>
              
              <button 
                onClick={() => setMode('login')}
                className="w-full py-4 bg-stone-700 text-white font-bold rounded-2xl hover:bg-stone-600 transition-all text-xs uppercase tracking-widest"
              >
                Ingresar con Email
              </button>

              <button 
                onClick={() => setMode('register')}
                className="w-full py-4 bg-stone-800 text-stone-400 font-bold rounded-2xl hover:bg-stone-700 transition-all text-xs uppercase tracking-widest border border-stone-700"
              >
                Registrarse
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 ml-1">Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-5 py-4 bg-stone-900/50 rounded-2xl border border-stone-700 focus:ring-2 focus:ring-brand-yellow focus:border-transparent transition-all outline-none"
                  placeholder="admin@pancheria.com"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 ml-1">Contraseña</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-5 py-4 bg-stone-900/50 rounded-2xl border border-stone-700 focus:ring-2 focus:ring-brand-yellow focus:border-transparent transition-all outline-none"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-brand-yellow text-stone-900 font-black rounded-2xl shadow-lg hover:bg-yellow-400 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Procesando...' : mode === 'register' ? 'Registrarse' : 'Iniciar Sesión'}
              </button>
              <button 
                type="button"
                onClick={() => setMode('initial')}
                className="w-full mt-2 text-xs font-bold text-stone-500 hover:text-stone-300"
              >
                Volver
              </button>
            </form>
          )}
          
          {isFirstUser && (
            <p className="text-[10px] text-stone-500 text-center mt-4 px-4">
              Al ser el primer usuario, se le asignará el rol de <strong>Propietario</strong> automáticamente.
            </p>
          )}
        </div>

        <p className="mt-8 text-center text-[10px] text-stone-500 uppercase font-black tracking-widest">
          Sistema de Gestión Interna
        </p>
      </motion.div>
    </div>
  );
};

const Sidebar = ({ activeTab, setActiveTab, user, onLogout, onOpenCloseShift, hasShift, isOpen, onClose, rolePermissions }: { 
  activeTab: string, 
  setActiveTab: (t: string) => void, 
  user: User,
  onLogout: () => void,
  onOpenCloseShift: () => void,
  hasShift: boolean,
  isOpen: boolean,
  onClose: () => void,
  rolePermissions: RolePermission[]
}) => {
  const { activeOperator, setActiveOperator } = useApp();
  const userPermissions = rolePermissions.find(rp => rp.id === user.role)?.modules || (user.role === 'owner' ? ['pos', 'inventory', 'customers', 'stats', 'staff', 'settings'] : []);
  
  const menuItems = [
    { id: 'ventas', label: 'Ventas', icon: ShoppingCart },
    { id: 'inventory', label: 'Stock', icon: Package },
    { id: 'customers', label: 'Clientes', icon: Users },
    { id: 'stats', label: 'Estadísticas', icon: LayoutDashboard },
    { id: 'staff', label: 'Personal', icon: UserCircle },
    { id: 'settings', label: 'Ajustes', icon: Settings },
  ].filter(item => userPermissions.includes(item.id === 'ventas' ? 'pos' : item.id));

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 z-50 w-56 bg-stone-900 text-stone-400 flex flex-col border-r border-stone-800 transition-transform duration-300 lg:relative lg:translate-x-0 sidebar-container ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-yellow rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-brand-yellow/20">
              <Utensils size={24} className="text-stone-900" />
            </div>
            <div>
              <h2 className="text-white font-bold leading-tight">Panchería POS</h2>
              <p className="text-xs text-stone-500">{user.branch_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-stone-500 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-4">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-brand-red text-white font-semibold shadow-lg shadow-brand-red/20' 
                  : 'hover:bg-stone-800 hover:text-white'
              }`}
            >
              <item.icon size={22} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-stone-800 space-y-2">
          <button 
            onClick={() => {
              onOpenCloseShift();
              onClose();
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              hasShift 
                ? 'hover:bg-brand-yellow/10 text-brand-yellow' 
                : 'bg-brand-yellow text-stone-900 font-bold shadow-lg shadow-brand-yellow/20'
            }`}
          >
            <Clock size={22} />
            <span>{hasShift ? 'Cerrar Turno' : 'Abrir Turno'}</span>
          </button>
          <div className="flex items-center gap-3 mb-4 px-2 pt-2">
            <div className="w-8 h-8 bg-stone-700 rounded-full flex items-center justify-center text-xs font-bold text-white">
              {activeOperator?.name?.charAt(0) || '?'}
            </div>
            <div className="text-xs flex-1">
              <p className="text-white font-medium">{activeOperator?.name}</p>
              <p className="text-stone-500 capitalize">{activeOperator?.role}</p>
            </div>
            <button 
              onClick={() => setActiveOperator(null)}
              className="p-2 text-stone-500 hover:text-white transition-colors"
              title="Cambiar Usuario"
            >
              <ArrowRightLeft size={16} />
            </button>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 hover:text-red-500 transition-all"
          >
            <LogOut size={22} />
            <span>Cerrar Sesión Maestra</span>
          </button>
        </div>
      </div>
    </>
  );
};

// --- Ventas Module ---

const VentasModule = () => {
  const { user, shift, ticketSettings, printerSettings, setPrinterSettings, onOpenCloseShift } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentType, setPaymentType] = useState('Efectivo');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [showCaja, setShowCaja] = useState(false);
  const [showRefundConfirm, setShowRefundConfirm] = useState<any | null>(null);
  const [inventoryBranchId, setInventoryBranchId] = useState(user?.branch_id || '');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [showMovementModal, setShowMovementModal] = useState<'income' | 'expense' | null>(null);
  const [selectingForProduct, setSelectingForProduct] = useState<{ product: Product, componentIndex: number, selections: { [key: string]: string } } | null>(null);
  const [confirmingRefund, setConfirmingRefund] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<any | null>(null);
  const [searchHistory, setSearchHistory] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerType, setCustomerType] = useState<'final' | 'client'>('final');
  const [showUserSwitch, setShowUserSwitch] = useState(false);
  const [selectedSwitchUser, setSelectedSwitchUser] = useState<User | null>(null);
  const [pinInput, setPinInput] = useState('');
  const { allUsers, setUser: setGlobalUser } = useApp();


  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    let d: Date;
    if (date.toDate) {
      d = date.toDate();
    } else if (date.seconds) {
      d = new Date(date.seconds * 1000);
    } else {
      d = new Date(date);
    }
    
    if (isNaN(d.getTime())) return 'Fecha Inválida';
    
    return d.toLocaleString('es-AR', { 
      timeZone: 'America/Argentina/Buenos_Aires',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'customers'));

    return () => {
      unsubProducts();
      unsubCustomers();
    };
  }, []);

  useEffect(() => {
    if (user?.branch_id) {
      // Remove orderBy from query to avoid composite index requirement
      const q = query(
        collection(db, 'sales'),
        where('branch_id', '==', user.branch_id),
        limit(100)
      );
      const unsubHistory = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        // Sort in memory
        docs.sort((a, b) => {
          const dateA = a.created_at?.seconds || 0;
          const dateB = b.created_at?.seconds || 0;
          return dateB - dateA;
        });
        setSalesHistory(docs.slice(0, 50));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'sales'));
      return () => unsubHistory();
    }
  }, [user?.branch_id]);

  useEffect(() => {
    if (shift?.id) {
      // Remove orderBy from query to avoid composite index requirement
      const q = query(
        collection(db, 'cash_movements'),
        where('shift_id', '==', shift.id)
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashMovement));
        // Sort in memory
        docs.sort((a, b) => {
          const dateA = (a.created_at as any)?.seconds || 0;
          const dateB = (b.created_at as any)?.seconds || 0;
          return dateB - dateA;
        });
        setMovements(docs);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'cash_movements'));
      return () => unsub();
    }
  }, [shift?.id]);

  const handleRefund = async (saleId: string) => {
    try {
      await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, 'sales', saleId);
        const saleSnap = await transaction.get(saleRef);
        if (!saleSnap.exists()) throw new Error("Venta no encontrada");
        
        const saleData = saleSnap.data();
        if (saleData.status === 'refunded') throw new Error("Venta ya reembolsada");

        // Use items from the sale document if available, otherwise fallback to subcollection (for old sales)
        let items = saleData.items || [];
        if (items.length === 0) {
          const itemsSnap = await getDocs(collection(db, `sales/${saleId}/items`));
          items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        if (items.length === 0) throw new Error("No se encontraron artículos en la venta");

        // Collect all refs needed for reads
        const productRefs = items.map((item: any) => doc(db, 'products', item.product_id));
        const productSnaps = await Promise.all(productRefs.map((ref: any) => transaction.get(ref)));
        
        const stockRefs: { ref: DocumentReference, qty: number }[] = [];

        for (let i = 0; i < items.length; i++) {
          const item: any = items[i];
          const product = productSnaps[i].data();

          if (product?.is_composite && product.components) {
            for (const comp of product.components) {
              let targetId = comp.id;
              if (comp.type === 'category' && item.selections && item.selections[comp.id]) {
                targetId = item.selections[comp.id];
              }
              stockRefs.push({ 
                ref: doc(db, 'branches', saleData.branch_id, 'stock', targetId),
                qty: comp.quantity * item.quantity
              });
            }
          } else {
            stockRefs.push({ 
              ref: doc(db, 'branches', saleData.branch_id, 'stock', item.product_id),
              qty: item.quantity
            });
          }
        }

        // Transactional reads for stock
        const stockSnaps = await Promise.all(stockRefs.map(s => transaction.get(s.ref)));
        
        let customerSnap = null;
        let customerRef = null;
        if (saleData.customer_id) {
          customerRef = doc(db, 'customers', saleData.customer_id);
          customerSnap = await transaction.get(customerRef);
        }

        // NOW DO ALL WRITES
        transaction.update(saleRef, { status: 'refunded' });

        for (let i = 0; i < stockRefs.length; i++) {
          const s = stockRefs[i];
          const snap = stockSnaps[i];
          const currentQty = snap.exists() ? (snap.data() as any).quantity : 0;
          transaction.set(s.ref, { 
            quantity: currentQty + s.qty,
            lastUpdated: serverTimestamp()
          }, { merge: true });
        }

        if (customerRef && customerSnap?.exists()) {
          const pointsToSubtract = Math.floor(saleData.total / 100);
          transaction.update(customerRef, { 
            points: Math.max(0, customerSnap.data().points - pointsToSubtract) 
          });
        }
      });
      setConfirmingRefund(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `sales/${saleId}`);
      setConfirmingRefund(null);
    }
  };

  const handleCheckout = async () => {
    if (!user || !shift) return;
    
    try {
      const saleId = doc(collection(db, 'sales')).id;
      const saleRef = doc(db, 'sales', saleId);
      
      await runTransaction(db, async (transaction) => {
        // Collect all stock refs needed
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

        // Transactional reads
        const stockSnaps = await Promise.all(stockRefs.map(s => transaction.get(s.ref)));
        
        let customerSnap = null;
        let customerRef = null;
        if (selectedCustomer) {
          customerRef = doc(db, 'customers', selectedCustomer.id);
          customerSnap = await transaction.get(customerRef);
        }

        // NOW DO ALL WRITES
        transaction.set(saleRef, {
          branch_id: user.branch_id,
          user_id: user.id,
          user_name: user.name,
          customer_id: selectedCustomer?.id || null,
          shift_id: shift.id,
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

      setCart([]);
      setShowCheckout(false);
      setSelectedCustomer(null);
      setShowPrintModal({ id: saleId, total, items: cart.map(item => ({ ...item })), created_at: new Date() });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'sales');
      alert('Error al procesar la venta');
    }
  };

  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift || !showMovementModal) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const amount = parseFloat(formData.get('amount') as string);
    const description = formData.get('description') as string;

    try {
      await addDoc(collection(db, 'cash_movements'), {
        shift_id: shift.id,
        type: showMovementModal,
        amount,
        description,
        created_at: serverTimestamp()
      });
      setShowMovementModal(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'cash_movements');
    }
  };

  const availableProducts = products.filter(p => p.category !== 'INSUMOS');
  const filteredProducts = availableProducts.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  // Top 12 logic: for now just first 12 if no search, otherwise filtered
  const displayProducts = search ? filteredProducts : availableProducts.slice(0, 12);

  const getCartItemKey = (item: CartItem | Product, selections?: { [key: string]: string }) => {
    const s = selections || (item as CartItem).selections || {};
    return `${item.id}-${JSON.stringify(s)}`;
  };

  const addToCart = (product: Product, selections?: { [key: string]: string }) => {
    // Check if it has category components that need selection
    if (product.is_composite && product.components && !selections) {
      const firstCategoryCompIndex = product.components.findIndex(c => c.type === 'category');
      if (firstCategoryCompIndex !== -1) {
        setSelectingForProduct({ product, componentIndex: firstCategoryCompIndex, selections: {} });
        return;
      }
    }

    const itemKey = getCartItemKey(product, selections);

    setCart(prev => {
      const existing = prev.find(item => getCartItemKey(item) === itemKey);
      if (existing) {
        return prev.map(item => 
          getCartItemKey(item) === itemKey
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { ...product, quantity: 1, selections }];
    });
  };

  const handleSelection = (selectedProductId: string) => {
    if (!selectingForProduct) return;
    
    const { product, componentIndex, selections } = selectingForProduct;
    const component = product.components![componentIndex];
    const newSelections = { ...selections, [component.id]: selectedProductId };
    
    // Find next category component
    const nextCategoryCompIndex = product.components!.findIndex((c, i) => i > componentIndex && c.type === 'category');
    
    if (nextCategoryCompIndex !== -1) {
      setSelectingForProduct({ product, componentIndex: nextCategoryCompIndex, selections: newSelections });
    } else {
      addToCart(product, newSelections);
      setSelectingForProduct(null);
    }
  };

  const removeFromCart = (itemKey: string) => {
    setCart(prev => prev.filter(item => getCartItemKey(item) !== itemKey));
  };

  const updateQuantity = (itemKey: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (getCartItemKey(item) === itemKey) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const subtotal = calcularTotal(cart);
  const total = subtotal;

  // Caja Summary Calculations
  const shiftSales = salesHistory.filter(s => s.shift_id === shift?.id && s.status !== 'refunded');
  const cashSales = shiftSales.filter(s => s.payment_type === 'Efectivo').reduce((acc, s) => acc + s.total, 0);
  const cardSales = shiftSales.filter(s => s.payment_type === 'Tarjeta').reduce((acc, s) => acc + s.total, 0);
  const qrSales = shiftSales.filter(s => s.payment_type === 'Transferencia').reduce((acc, s) => acc + s.total, 0);
  
  const totalIncome = movements.filter(m => m.type === 'income').reduce((acc, m) => acc + m.amount, 0);
  const totalExpense = movements.filter(m => m.type === 'expense').reduce((acc, m) => acc + m.amount, 0);
  const refundsCash = salesHistory.filter(s => s.shift_id === shift?.id && s.status === 'refunded' && s.payment_type === 'Efectivo').reduce((acc, s) => acc + s.total, 0);
  const totalRefunds = salesHistory.filter(s => s.shift_id === shift?.id && s.status === 'refunded').reduce((acc, s) => acc + s.total, 0);
  
  const theoreticalCash = (shift?.initial_cash || 0) + cashSales + totalIncome - totalExpense - refundsCash;
  const netSales = shiftSales.reduce((acc, s) => acc + s.total, 0);
  const grossSales = netSales + totalRefunds;

  const filteredHistory = salesHistory.filter(sale => {
    const searchLower = searchHistory.toLowerCase();
    return (
      sale.id.toLowerCase().includes(searchLower) ||
      (sale.customer_name || '').toLowerCase().includes(searchLower) ||
      (sale.user_name || '').toLowerCase().includes(searchLower) ||
      sale.total.toString().includes(searchLower) ||
      sale.payment_type.toLowerCase().includes(searchLower)
    );
  });

  const handleSwitchUser = (u: User) => {
    if (!u.pin) {
      setGlobalUser(u);
      setShowUserSwitch(false);
      return;
    }
    setSelectedSwitchUser(u);
    setPinInput('');
  };

  const verifyPin = async () => {
    if (selectedSwitchUser) {
      console.log('Verifying PIN for switch user:', selectedSwitchUser.name);
      console.log('Stored PIN hash:', selectedSwitchUser.pin);
      console.log('Entered PIN:', pinInput);
      try {
        const isMatch = await bcrypt.compare(pinInput, selectedSwitchUser.pin || '');
        console.log('PIN Match result:', isMatch);
        if (isMatch) {
          setGlobalUser(selectedSwitchUser);
          setShowUserSwitch(false);
          setSelectedSwitchUser(null);
          setPinInput('');
        } else {
          alert('PIN incorrecto');
          setPinInput('');
        }
      } catch (error) {
        console.error("Error verifying PIN:", error);
        alert("Error al verificar el PIN");
        setPinInput('');
      }
    }
  };

  return (
    <div className="flex h-full bg-stone-100 overflow-hidden tablet-landscape-pos">
      {/* User Switch Modal */}
      <AnimatePresence>
        {showUserSwitch && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden p-8"
            >
              {!selectedSwitchUser ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-black text-stone-900">Cambiar Usuario</h2>
                    <button onClick={() => setShowUserSwitch(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                      <X size={24} className="text-stone-400" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {allUsers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleSwitchUser(u)}
                        className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${
                          user?.id === u.id ? 'border-brand-red bg-red-50' : 'border-stone-100 hover:border-stone-200'
                        }`}
                      >
                        <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-400 font-bold text-lg">
                          {u.name.charAt(0)}
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-stone-900 text-sm">{u.name}</p>
                          <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{u.role}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={() => setSelectedSwitchUser(null)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                      <ChevronRight size={24} className="text-stone-400 rotate-180" />
                    </button>
                    <h2 className="text-2xl font-black text-stone-900">Ingresar PIN</h2>
                    <div className="w-10" />
                  </div>
                  <p className="text-stone-500 font-bold">Hola, {selectedSwitchUser.name}</p>
                  
                  <div className="flex justify-center gap-3">
                    {[0, 1, 2, 3, 4, 5].map(i => (
                      <div 
                        key={i} 
                        className={`w-4 h-4 rounded-full border-2 ${
                          pinInput.length > i ? 'bg-brand-red border-brand-red' : 'border-stone-200'
                        }`} 
                      />
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                      <button
                        key={num}
                        onClick={() => pinInput.length < 6 && setPinInput(prev => prev + num)}
                        className="w-16 h-16 rounded-2xl bg-stone-50 hover:bg-stone-100 font-black text-xl text-stone-700 transition-all active:scale-90"
                      >
                        {num}
                      </button>
                    ))}
                    <button onClick={() => setPinInput('')} className="w-16 h-16 rounded-2xl bg-stone-50 hover:bg-stone-100 font-black text-xs text-stone-400 uppercase">Cerrar</button>
                    <button
                      onClick={() => pinInput.length < 6 && setPinInput(prev => prev + '0')}
                      className="w-16 h-16 rounded-2xl bg-stone-50 hover:bg-stone-100 font-black text-xl text-stone-700 transition-all active:scale-90"
                    >
                      0
                    </button>
                    <button onClick={() => setPinInput(prev => prev.slice(0, -1))} className="w-16 h-16 rounded-2xl bg-stone-50 hover:bg-stone-100 font-black text-stone-400 flex items-center justify-center">
                      <RotateCcw size={20} />
                    </button>
                  </div>

                  <button
                    onClick={verifyPin}
                    disabled={pinInput.length < 4}
                    className="w-full py-4 bg-brand-red text-white font-black rounded-2xl shadow-lg shadow-brand-red/20 disabled:opacity-50 disabled:shadow-none transition-all mt-4"
                  >
                    Confirmar
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Selection Modal for Composite Products */}
      <AnimatePresence>
        {selectingForProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-stone-50">
                <div>
                  <h2 className="text-2xl font-black text-stone-900">Seleccionar {selectingForProduct.product.components![selectingForProduct.componentIndex].id}</h2>
                  <p className="text-stone-500 font-bold">Para: {selectingForProduct.product.name}</p>
                </div>
                <button 
                  onClick={() => setSelectingForProduct(null)}
                  className="p-3 hover:bg-white rounded-2xl transition-colors text-stone-400"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 grid grid-cols-2 gap-4 noscrollbar">
                {products
                  .filter(p => p.category === selectingForProduct.product.components![selectingForProduct.componentIndex].id && !p.is_composite)
                  .map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelection(p.id)}
                      className="p-6 bg-stone-50 rounded-3xl border-2 border-transparent hover:border-brand-red hover:bg-white transition-all text-left group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                          ) : (
                            <Package size={24} className="text-stone-300" />
                          )}
                        </div>
                        <div>
                          <p className="font-black text-stone-900">{p.name}</p>
                          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">{p.sku}</p>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Products Area */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight">Ventas</h1>
            <button 
              onClick={() => setShowUserSwitch(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-stone-100 shadow-sm hover:bg-stone-50 transition-all"
            >
              <div className="w-6 h-6 bg-stone-100 rounded-lg flex items-center justify-center text-stone-400 font-bold text-[10px]">
                {user?.name.charAt(0)}
              </div>
              <span className="text-xs font-bold text-stone-600">{user?.name}</span>
              <ArrowRightLeft size={14} className="text-stone-400" />
            </button>
          </div>
          <div className="flex items-center bg-white p-1 rounded-2xl border border-stone-100 shadow-sm">
            <button 
              onClick={() => { setShowCaja(false); setShowHistory(false); }}
              className={`px-3 py-1.5 rounded-xl font-black text-[9px] transition-all uppercase tracking-widest ${
                !showHistory && !showCaja ? 'bg-brand-red text-white shadow-lg shadow-brand-red/20' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              Productos
            </button>
            <button 
              onClick={() => { setShowCaja(true); setShowHistory(false); }}
              className={`px-3 py-1.5 rounded-xl font-black text-[9px] flex items-center gap-2 transition-all uppercase tracking-widest ${
                showCaja ? 'bg-brand-red text-white shadow-lg shadow-brand-red/20' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              <Banknote size={12} />
              Caja
            </button>
            <button 
              onClick={() => { setShowHistory(true); setShowCaja(false); }}
              className={`px-3 py-1.5 rounded-xl font-black text-[9px] flex items-center gap-2 transition-all uppercase tracking-widest ${
                showHistory ? 'bg-brand-red text-white shadow-lg shadow-brand-red/20' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              <History size={12} />
              Recibos
            </button>
          </div>
        </div>

        {!showHistory && !showCaja && (
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar producto..." 
                className="w-full pl-9 pr-4 py-2.5 bg-white rounded-xl border-none shadow-sm focus:ring-2 focus:ring-brand-red transition-all text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        {showHistory && (
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar recibo (ID, Cliente, Vendedor)..." 
                className="w-full pl-9 pr-4 py-2.5 bg-white rounded-xl border-none shadow-sm focus:ring-2 focus:ring-brand-red transition-all text-sm"
                value={searchHistory}
                onChange={e => setSearchHistory(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto noscrollbar pb-4">
          {showCaja ? (
            <div className="max-w-2xl mx-auto bg-white rounded-[40px] shadow-sm border border-stone-100 overflow-hidden">
              <div className="p-8 space-y-8">
                <div>
                  <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <div className="w-1 h-1 bg-brand-red rounded-full" />
                    Información de Turno
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-stone-500 font-bold">Nombre vendedor</span>
                      <span className="font-black text-stone-900">{shift?.user_name || user?.name}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-stone-500 font-bold">Apertura de turno</span>
                      <span className="font-black text-stone-900">{shift ? new Date(shift.start_time).toLocaleString() : '-'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <div className="w-1 h-1 bg-brand-red rounded-full" />
                    EFECTIVO
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-stone-500 font-bold">Fondo anterior</span>
                      <span className="font-black text-stone-900">${shift?.initial_cash || 0}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-stone-500 font-bold">Cobro en efectivo</span>
                      <span className="font-black text-green-600">+${cashSales}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-stone-500 font-bold">Reembolsos en efectivo</span>
                      <span className="font-black text-red-600">-${refundsCash}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-stone-500 font-bold">Ingresos/egresos</span>
                      <span className={`font-black ${totalIncome - totalExpense >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {totalIncome - totalExpense >= 0 ? '+' : ''}${totalIncome - totalExpense}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-stone-100 flex justify-between items-center text-base">
                      <span className="text-stone-900 font-black uppercase tracking-tighter">Efectivo teórico en caja</span>
                      <span className="font-black text-brand-red text-xl">${theoreticalCash}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-stone-500 font-bold">Cantidad de efectivo real</span>
                      <span className="font-black text-stone-900">${shift?.real_cash || 'Pendiente'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-stone-500 font-bold">Descuadre</span>
                      <span className={`font-black ${shift?.real_cash ? (shift.real_cash - theoreticalCash >= 0 ? 'text-green-600' : 'text-red-600') : 'text-stone-400'}`}>
                        {shift?.real_cash ? `${shift.real_cash - theoreticalCash >= 0 ? '+' : ''}${shift.real_cash - theoreticalCash}` : 'Pendiente'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <div className="w-1 h-1 bg-brand-red rounded-full" />
                    RESUMEN DE VENTA
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-stone-500 font-bold">Ventas brutas</span>
                      <span className="font-black text-stone-900">${grossSales}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-stone-500 font-bold">Reembolsos</span>
                      <span className="font-black text-red-600">-${totalRefunds}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-stone-500 font-bold">Descuentos</span>
                      <span className="font-black text-stone-900">$0</span>
                    </div>
                    <div className="pt-3 border-t border-stone-100 flex justify-between items-center text-base">
                      <span className="text-stone-900 font-black uppercase tracking-tighter">VENTAS NETAS</span>
                      <span className="font-black text-stone-900 text-xl">${netSales}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pl-4">
                      <span className="text-stone-400 font-bold">Efectivo</span>
                      <span className="font-black text-stone-600">${cashSales}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pl-4">
                      <span className="text-stone-400 font-bold">Por tarjeta</span>
                      <span className="font-black text-stone-600">${cardSales}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pl-4">
                      <span className="text-stone-400 font-bold">Por QR</span>
                      <span className="font-black text-stone-600">${qrSales}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-stone-500 font-bold">Impuestos</span>
                      <span className="font-black text-stone-900">$0</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setShowMovementModal('income')}
                    className="flex-1 py-3 bg-green-500 text-white font-black rounded-xl shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                  >
                    <PlusCircle size={16} />
                    Ingreso
                  </button>
                  <button 
                    onClick={() => setShowMovementModal('expense')}
                    className="flex-1 py-3 bg-red-500 text-white font-black rounded-xl shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                  >
                    <MinusCircle size={16} />
                    Egreso
                  </button>
                  <button 
                    onClick={onOpenCloseShift}
                    className="flex-1 py-3 bg-stone-900 text-white font-black rounded-xl shadow-lg shadow-stone-900/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                  >
                    <LogOut size={16} />
                    Cerrar Turno
                  </button>
                </div>
              </div>
            </div>
          ) : showHistory ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black uppercase tracking-wider">RECIBOS (Ventas)</h2>
              </div>
              
              <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-stone-50 text-stone-400 text-[8px] uppercase tracking-[0.1em] font-black">
                        <th className="px-3 py-2">Ticket</th>
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Total</th>
                        <th className="px-3 py-2">Pago</th>
                        <th className="px-3 py-2">Vendedor</th>
                        <th className="px-3 py-2">Estado</th>
                        <th className="px-3 py-2 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {filteredHistory.map(sale => (
                        <tr key={sale.id} className={`hover:bg-stone-50/50 transition-colors ${sale.status === 'refunded' ? 'opacity-60' : ''}`}>
                          <td className="px-3 py-2">
                            <span className="font-bold text-stone-800 text-[10px]">#{sale.id.slice(-6)}</span>
                          </td>
                          <td className="px-3 py-2 text-[10px] text-stone-500">
                            {formatDate(sale.created_at)}
                          </td>
                          <td className="px-3 py-2 font-black text-stone-900 text-xs">
                            ${sale.total}
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-[9px] font-bold text-stone-500 uppercase">{sale.payment_type}</span>
                          </td>
          <td className="px-3 py-2">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-stone-100 rounded-full flex items-center justify-center text-[7px] font-bold text-stone-600">
                {sale.user_name.charAt(0)}
              </div>
              <span className="text-[9px] text-stone-500">{sale.user_name}</span>
            </div>
          </td>
                          <td className="px-3 py-2">
                            <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${
                              sale.status === 'refunded' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                            }`}>
                              {sale.status === 'refunded' ? 'REEMBOLSADO' : 'COMPLETADO'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {sale.status !== 'refunded' && (
                              <div className="flex items-center justify-end gap-1">
                                <button 
                                  onClick={() => setShowRefundConfirm(sale)}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                  title="Reembolsar"
                                >
                                  <RotateCcw size={12} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
              {displayProducts.map(product => (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white p-2 rounded-xl shadow-sm hover:shadow-md transition-all text-left flex flex-col h-full border border-stone-200/50"
                >
                  <div className="w-full aspect-square bg-stone-100 rounded-lg mb-1.5 flex items-center justify-center overflow-hidden">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Package size={16} className="text-stone-300" />
                    )}
                  </div>
                  <h3 className="font-bold text-stone-800 text-[10px] line-clamp-1 mb-0.5 leading-tight">{product.name}</h3>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-xs font-black text-brand-red">${product.price}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Refund Confirmation Modal */}
      <AnimatePresence>
        {showRefundConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRefundConfirm(null)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl p-8 text-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <RotateCcw size={40} className="text-red-600" />
              </div>
              <h2 className="text-2xl font-black text-stone-900 mb-2">¿Confirmar Reembolso?</h2>
              <p className="text-stone-500 mb-8">
                Se anulará el ticket <span className="font-bold text-stone-900">#{showRefundConfirm.id.slice(-6)}</span> por un total de <span className="font-bold text-stone-900">${showRefundConfirm.total}</span>. Los productos volverán al stock.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowRefundConfirm(null)}
                  className="flex-1 py-4 font-bold text-stone-500 hover:bg-stone-100 rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    handleRefund(showRefundConfirm.id);
                    setShowRefundConfirm(null);
                  }}
                  className="flex-[2] py-4 bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all"
                >
                  Confirmar Reembolso
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cart Area */}
      {!showHistory && !showCaja && (
        <div className="w-80 bg-white border-l border-stone-200 flex flex-col shadow-2xl cart-container">
          <div className="p-4 border-b border-stone-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-black flex items-center gap-2 uppercase tracking-wider">
                <ShoppingCart size={20} className="text-brand-red" />
                Ticket
              </h2>
              <span className="bg-stone-100 px-2 py-0.5 rounded-full text-[10px] font-black text-stone-500">
                {cart.length} ITEMS
              </span>
            </div>
            
            <div className="space-y-2">
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setCustomerType('final');
                    setSelectedCustomer(null);
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    customerType === 'final' ? 'bg-brand-red text-white' : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  Consumidor Final
                </button>
                <button 
                  onClick={() => setCustomerType('client')}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    customerType === 'client' ? 'bg-brand-red text-white' : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  Cliente
                </button>
              </div>

              {customerType === 'client' && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
                  <input 
                    type="text"
                    placeholder="Buscar por nombre o DNI..."
                    className="w-full pl-9 pr-4 py-2 bg-stone-50 rounded-xl border-none text-xs focus:ring-2 focus:ring-brand-red font-bold"
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                  />
                  {customerSearch && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-stone-100 rounded-xl shadow-xl z-10 max-h-40 overflow-y-auto mt-1 noscrollbar">
                      {customers
                        .filter(c => 
                          `${c.first_name} ${c.last_name}`.toLowerCase().includes(customerSearch.toLowerCase()) ||
                          (c.dni || '').includes(customerSearch)
                        )
                        .map(c => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSelectedCustomer(c);
                              setCustomerSearch('');
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-stone-50 text-xs font-bold border-b border-stone-50 last:border-none"
                          >
                            <p className="text-stone-800">{c.first_name} {c.last_name}</p>
                            <p className="text-[10px] text-stone-400">DNI: {c.dni || 'N/A'}</p>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {selectedCustomer && (
                <div className="flex items-center justify-between bg-brand-yellow/10 p-2 rounded-xl border border-brand-yellow/20">
                  <div className="flex items-center gap-2">
                    <UserCircle size={14} className="text-brand-red" />
                    <span className="text-[10px] font-black text-stone-800 uppercase">{selectedCustomer.first_name} {selectedCustomer.last_name}</span>
                  </div>
                  <button onClick={() => setSelectedCustomer(null)} className="text-stone-400 hover:text-brand-red">
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 noscrollbar">
            <AnimatePresence>
              {cart.map(item => {
                const itemKey = getCartItemKey(item);
                return (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    key={itemKey}
                    className="flex items-center gap-3 group"
                  >
                    <div className="flex-1">
                      <h4 className="font-bold text-stone-800 text-xs line-clamp-1">{item.name}</h4>
                      {item.selections && Object.entries(item.selections).length > 0 && (
                        <p className="text-[8px] text-brand-red font-bold uppercase tracking-tighter">
                          {Object.values(item.selections).map(id => products.find(p => p.id === id)?.name).join(' + ')}
                        </p>
                      )}
                      <p className="text-[10px] text-stone-400">${item.price} c/u</p>
                    </div>
                    <div className="flex items-center bg-stone-100 rounded-lg p-0.5">
                      <button onClick={() => updateQuantity(itemKey, -1)} className="p-1 hover:text-brand-red"><Minus size={12} /></button>
                      <span className="w-6 text-center text-xs font-black">{item.quantity}</span>
                      <button onClick={() => updateQuantity(itemKey, 1)} className="p-1 hover:text-brand-red"><Plus size={12} /></button>
                    </div>
                    <div className="text-right min-w-[50px]">
                      <p className="font-black text-stone-800 text-xs">${item.price * item.quantity}</p>
                    </div>
                    <button onClick={() => removeFromCart(itemKey)} className="text-stone-300 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-stone-300 py-10">
                <ShoppingCart size={32} className="mb-2 opacity-20" />
                <p className="text-[10px] font-bold uppercase tracking-widest">Carrito Vacío</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-stone-50 border-t border-stone-200 space-y-3">
            <div className="flex justify-between text-stone-500 text-xs font-bold">
              <span>Subtotal</span>
              <span>${subtotal}</span>
            </div>
            <div className="flex justify-between text-xl font-black text-stone-900">
              <span>Total</span>
              <span>${total}</span>
            </div>
            <button
              disabled={cart.length === 0}
              onClick={() => setShowCheckout(true)}
              className="w-full bg-brand-red hover:bg-red-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-black py-3.5 rounded-xl shadow-lg shadow-brand-red/20 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest"
            >
              Pagar
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      <AnimatePresence>
        {showMovementModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMovementModal(null)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl p-8">
              <h2 className="text-2xl font-black mb-6">{showMovementModal === 'income' ? 'Ingreso de Dinero' : 'Egreso de Dinero'}</h2>
              <form onSubmit={handleAddMovement} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Monto</label>
                  <input name="amount" type="number" step="0.01" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Descripción</label>
                  <textarea name="description" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red resize-none h-24" required />
                </div>
                <div className="flex gap-4 mt-8">
                  <button type="button" onClick={() => setShowMovementModal(null)} className="flex-1 py-4 font-bold text-stone-500 hover:bg-stone-100 rounded-2xl">Cancelar</button>
                  <button type="submit" className={`flex-[2] py-4 text-white font-bold rounded-2xl shadow-lg ${showMovementModal === 'income' ? 'bg-green-500 shadow-green-500/20' : 'bg-red-500 shadow-red-500/20'}`}>
                    Confirmar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Checkout Modal */}
      <AnimatePresence>
        {showCheckout && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCheckout(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <h2 className="text-2xl font-black mb-6">Método de Pago</h2>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  {[
                    { id: 'Efectivo', icon: Banknote, color: 'bg-green-100 text-green-600' },
                    { id: 'Tarjeta', icon: CreditCard, color: 'bg-blue-100 text-blue-600' },
                    { id: 'QR', icon: QrCode, color: 'bg-purple-100 text-purple-600' },
                  ].map(method => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentType(method.id)}
                      className={`flex flex-col items-center gap-3 p-6 rounded-3xl border-2 transition-all ${
                        paymentType === method.id ? 'border-brand-red bg-red-50' : 'border-stone-100 hover:border-stone-200'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${method.color}`}>
                        <method.icon size={24} />
                      </div>
                      <span className="font-bold text-sm">{method.id}</span>
                    </button>
                  ))}
                </div>

                <div className="bg-stone-50 p-6 rounded-3xl mb-8">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-stone-500">Monto a cobrar</span>
                    <span className="text-3xl font-black text-stone-900">${total}</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowCheckout(false)}
                    className="flex-1 py-4 font-bold text-stone-500 hover:bg-stone-100 rounded-2xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleCheckout}
                    className="flex-[2] py-4 bg-brand-red hover:bg-red-700 text-white font-bold rounded-2xl shadow-lg shadow-brand-red/20 transition-all"
                  >
                    Confirmar Pago
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print Modal */}
      <AnimatePresence>
        {showPrintModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-10 text-center">
                <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                  <Check size={48} strokeWidth={3} />
                </div>
                <h2 className="text-4xl font-black mb-2 text-stone-900">¡Venta Exitosa!</h2>
                <p className="text-stone-500 mb-8 text-lg font-bold">Ticket #{showPrintModal.id.slice(-6).toUpperCase()}</p>
                
                <div className="flex flex-col gap-4">
                  <button
                    onClick={() => {
                      alert(`Imprimiendo Ticket y Comanda...`);
                      setShowPrintModal(null);
                    }}
                    className="w-full py-5 bg-stone-900 text-white font-black rounded-2xl shadow-xl hover:bg-stone-800 transition-all uppercase tracking-widest text-sm"
                  >
                    IMPRIMIR Y FINALIZAR
                  </button>
                  <button
                    onClick={() => setShowPrintModal(null)}
                    className="w-full py-5 bg-stone-100 text-stone-500 font-black rounded-2xl hover:bg-stone-200 transition-all uppercase tracking-widest text-sm"
                  >
                    FINALIZAR
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ShiftSummaryModal = ({ summary, onClose }: { summary: any, onClose: () => void }) => {
  const { ticketSettings } = useApp();

  useEffect(() => {
    if (ticketSettings.printShiftClosing) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 print:p-0">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm print:hidden" 
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        exit={{ scale: 0.9, opacity: 0 }} 
        className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:max-w-none print:w-full"
      >
        <div className="p-8 print:p-4 max-h-[90vh] overflow-y-auto noscrollbar">
          <div className="flex justify-between items-start mb-8 print:mb-4">
            <div>
              <h2 className="text-3xl font-black text-stone-900 mb-1">Resumen de Cierre</h2>
              <p className="text-stone-500 font-medium">Turno finalizado con éxito</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="bg-brand-yellow px-4 py-2 rounded-2xl font-black text-stone-900 print:hidden">
                #{summary.shift_id.slice(-6).toUpperCase()}
              </div>
              <button 
                onClick={handlePrint}
                className="p-3 bg-stone-100 text-stone-900 rounded-xl hover:bg-stone-200 transition-all print:hidden"
              >
                <Printer size={20} />
              </button>
            </div>
          </div>

          <div className="space-y-8 print:space-y-4">
            <div>
              <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <div className="w-1 h-1 bg-brand-red rounded-full" />
                Información de Turno
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 font-bold">Nombre vendedor</span>
                  <span className="font-black text-stone-900">{summary.user_name}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 font-bold">Apertura de turno</span>
                  <span className="font-black text-stone-900">{new Date(summary.start_time).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 font-bold">Cierre de turno</span>
                  <span className="font-black text-stone-900">{new Date(summary.end_time).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <div className="w-1 h-1 bg-brand-red rounded-full" />
                EFECTIVO
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 font-bold">Fondo anterior</span>
                  <span className="font-black text-stone-900">${summary.initial_cash}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 font-bold">Cobro en efectivo</span>
                  <span className="font-black text-green-600">+${summary.cash_sales}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 font-bold">Reembolsos en efectivo</span>
                  <span className="font-black text-red-600">-${summary.refunds_cash}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 font-bold">Ingresos/egresos</span>
                  <span className={`font-black ${summary.movements_net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summary.movements_net >= 0 ? '+' : ''}${summary.movements_net}
                  </span>
                </div>
                <div className="pt-3 border-t border-stone-100 flex justify-between items-center text-base">
                  <span className="text-stone-900 font-black uppercase tracking-tighter">Efectivo teórico en caja</span>
                  <span className="font-black text-brand-red text-xl">${summary.theoretical_cash}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 font-bold">Cantidad de efectivo real</span>
                  <span className="font-black text-stone-900">${summary.real_cash}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 font-bold">Descuadre</span>
                  <span className={`font-black ${summary.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summary.difference >= 0 ? '+' : ''}${summary.difference}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <div className="w-1 h-1 bg-brand-red rounded-full" />
                RESUMEN DE VENTA
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 font-bold">Ventas brutas</span>
                  <span className="font-black text-stone-900">${summary.gross_sales}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 font-bold">Reembolsos</span>
                  <span className="font-black text-red-600">-${summary.total_refunds}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 font-bold">Descuentos</span>
                  <span className="font-black text-stone-900">${summary.discounts}</span>
                </div>
                <div className="pt-3 border-t border-stone-100 flex justify-between items-center text-base">
                  <span className="text-stone-900 font-black uppercase tracking-tighter">VENTAS NETAS</span>
                  <span className="font-black text-stone-900 text-xl">${summary.net_sales}</span>
                </div>
                <div className="flex justify-between items-center text-sm pl-4">
                  <span className="text-stone-400 font-bold">Efectivo</span>
                  <span className="font-black text-stone-600">${summary.cash_sales}</span>
                </div>
                <div className="flex justify-between items-center text-sm pl-4">
                  <span className="text-stone-400 font-bold">Por tarjeta</span>
                  <span className="font-black text-stone-600">${summary.card_sales}</span>
                </div>
                <div className="flex justify-between items-center text-sm pl-4">
                  <span className="text-stone-400 font-bold">Por QR</span>
                  <span className="font-black text-stone-600">${summary.qr_sales}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 font-bold">Impuestos</span>
                  <span className="font-black text-stone-900">${summary.taxes}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 print:hidden">
            <button 
              onClick={onClose}
              className="w-full py-4 bg-stone-900 text-white font-black rounded-2xl shadow-lg shadow-stone-900/20 uppercase tracking-widest"
            >
              Cerrar y Salir
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const Inventory = () => {
  const { user } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState(user?.branch_id || '');
  const [editing, setEditing] = useState<Product | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [isComposite, setIsComposite] = useState(false);
  const [selectedComponents, setSelectedComponents] = useState<ProductComponent[]>([]);
  const [adjustingStock, setAdjustingStock] = useState<any | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [showCategories, setShowCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const cats = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      setCategories(cats);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'categories'));

    return () => unsubCategories();
  }, []);

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));

    return () => unsubProducts();
  }, []);

  useEffect(() => {
    const unsubBranches = onSnapshot(collection(db, 'branches'), (snapshot) => {
      setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'branches'));

    return () => unsubBranches();
  }, []);

  useEffect(() => {
    if (selectedBranchId) {
      const q = query(collection(db, 'branches', selectedBranchId, 'stock'));
      const unsubStock = onSnapshot(q, (snapshot) => {
        setStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => handleFirestoreError(err, OperationType.LIST, `branches/${selectedBranchId}/stock`));
      return () => unsubStock();
    }
  }, [selectedBranchId]);

  useEffect(() => {
    if (editing) {
      setIsComposite(!!editing.is_composite);
      if (editing.components) {
        setSelectedComponents(editing.components);
      } else {
        setSelectedComponents([]);
      }
    } else {
      setIsComposite(false);
      setSelectedComponents([]);
      setImagePreview(null);
    }
  }, [editing, showAdd]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data: any = Object.fromEntries(formData.entries());
    
    data.is_composite = isComposite;
    data.components = isComposite ? selectedComponents : [];
    data.cost = parseFloat(data.cost);
    data.price = parseFloat(data.price);
    if (imagePreview) {
      data.image_url = imagePreview;
    }

    try {
      let productId = editing?.id;
      if (editing) {
        await updateDoc(doc(db, 'products', editing.id), data);
      } else {
        const docRef = await addDoc(collection(db, 'products'), data);
        productId = docRef.id;
        
        // Initialize stock if provided
        const initialStock = parseFloat(data.initial_stock || '0');
        if (user?.branch_id && initialStock > 0 && !isComposite) {
          await setDoc(doc(db, 'branches', user.branch_id, 'stock', productId), {
            quantity: initialStock,
            lastUpdated: serverTimestamp()
          });
        }
      }
      setEditing(null);
      setShowAdd(false);
      setImagePreview(null);
    } catch (err) {
      handleFirestoreError(err, editing ? OperationType.UPDATE : OperationType.CREATE, 'products');
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const quantity = parseFloat(formData.get('quantity') as string);

    try {
      const stockRef = doc(db, 'branches', selectedBranchId, 'stock', adjustingStock.id);
      await setDoc(stockRef, {
        quantity,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      setAdjustingStock(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `branches/${selectedBranchId}/stock/${adjustingStock.id}`);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      if (editingCategory) {
        await updateDoc(doc(db, 'categories', editingCategory.id), { name: newCategoryName.trim() });
      } else {
        await addDoc(collection(db, 'categories'), { name: newCategoryName.trim() });
      }
      setNewCategoryName('');
      setEditingCategory(null);
    } catch (err) {
      handleFirestoreError(err, editingCategory ? OperationType.UPDATE : OperationType.CREATE, 'categories');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta categoría?')) return;
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'categories');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      // Also delete stock in current branch if exists
      if (user?.branch_id) {
        await deleteDoc(doc(db, 'branches', user.branch_id, 'stock', id));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${id}`);
    }
  };

  const addComponent = () => {
    setSelectedComponents([...selectedComponents, { id: '', quantity: 1, type: 'product' }]);
  };

  const removeComponent = (index: number) => {
    setSelectedComponents(selectedComponents.filter((_, i) => i !== index));
  };

  const updateComponent = (index: number, field: keyof ProductComponent, value: any) => {
    const newComps = [...selectedComponents];
    newComps[index] = { ...newComps[index], [field]: value };
    setSelectedComponents(newComps);
  };

  const calculatedCost = isComposite 
    ? selectedComponents.reduce((acc, comp) => {
        if (comp.type === 'category') return acc; // Categories don't have a fixed cost
        const product = products.find(p => p.id === comp.id);
        return acc + (product?.cost || 0) * comp.quantity;
      }, 0)
    : 0;


  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 h-full overflow-y-auto noscrollbar">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-stone-900 uppercase tracking-tight">Inventario</h1>
          <p className="text-xs lg:text-sm text-stone-500 font-medium">Gestión de productos y existencias por sucursal</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-stone-200 shadow-sm">
            <Store size={16} className="text-stone-400" />
            <select 
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent border-none focus:ring-0 font-bold text-stone-700 text-xs"
            >
              <option value="">Seleccionar Sucursal</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={() => setShowCategories(true)}
            className="bg-white text-stone-600 px-4 py-2 rounded-xl border border-stone-200 font-bold flex items-center gap-2 hover:bg-stone-50 transition-all text-sm"
          >
            <Tag size={18} />
            Categorías
          </button>
          <button 
            onClick={() => setShowAdd(true)}
            className="bg-brand-red text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-brand-red/20 text-sm"
          >
            <PlusCircle size={18} />
            Nuevo Producto
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stone-50 text-stone-400 text-[8px] uppercase tracking-[0.1em] font-black">
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2">Costo</th>
                <th className="px-3 py-2">Precio</th>
                <th className="px-3 py-2">Stock</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {products.map(p => {
                const currentStock = stock.find(s => s.id === p.id)?.quantity || 0;
                return (
                  <tr key={p.id} className="hover:bg-stone-50/50 transition-colors border-b border-stone-100 last:border-none">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-stone-100 rounded-lg flex items-center justify-center shrink-0">
                          <Package size={12} className="text-stone-400" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-stone-800 text-[10px]">{p.name}</span>
                          {p.is_composite ? (
                            <span className="text-[7px] uppercase tracking-wider font-black text-brand-red bg-brand-red/10 px-1 py-0.5 rounded-full w-fit">Compuesto</span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-stone-500 font-mono text-[9px]">{p.sku}</td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded-full text-[8px] font-black uppercase tracking-wider">
                        {p.category}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-stone-800 text-[10px]">${p.cost}</td>
                    <td className="px-3 py-2 font-black text-brand-red text-[10px]">${p.price}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-black text-[10px] ${currentStock <= 5 ? 'text-red-500' : 'text-stone-800'}`}>
                          {currentStock}
                        </span>
                        {!p.is_composite && (
                          <button 
                            onClick={() => setAdjustingStock({ id: p.id, name: p.name, current: currentStock })}
                            className="p-1 text-stone-300 hover:text-stone-600 transition-colors"
                          >
                            <PlusCircle size={10} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => setEditing(p)} className="p-1.5 text-stone-400 hover:text-brand-red transition-colors">
                          <Edit size={12} />
                        </button>
                        <button onClick={() => handleDeleteProduct(p.id)} className="p-1.5 text-stone-400 hover:text-red-500 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {(showAdd || editing) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setEditing(null); setShowAdd(false); }} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] sm:max-h-[90vh] flex flex-col">
              <form onSubmit={handleSave} className="flex flex-col h-full">
                <div className="p-4 overflow-y-auto noscrollbar flex-1">
                  <h2 className="text-lg font-black mb-3">{editing ? 'Editar' : 'Nuevo'} Producto</h2>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[9px] font-bold text-stone-400 uppercase mb-0.5">Nombre</label>
                      <input name="name" defaultValue={editing?.name} className="w-full px-3 py-1.5 bg-stone-50 rounded-xl border-none focus:ring-2 focus:ring-brand-red text-xs" required />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-[9px] font-bold text-stone-400 uppercase mb-0.5">Imagen del Producto</label>
                      <div className="flex gap-2 items-center">
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          className="w-10 h-10 bg-stone-50 rounded-lg border-2 border-dashed border-stone-200 flex flex-col items-center justify-center cursor-pointer hover:bg-stone-100 transition-colors overflow-hidden relative group shrink-0"
                        >
                          {imagePreview || editing?.image_url ? (
                            <>
                              <img 
                                src={imagePreview || editing?.image_url} 
                                alt="Preview" 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Camera size={12} className="text-white" />
                              </div>
                            </>
                          ) : (
                            <>
                              <Camera size={12} className="text-stone-300" />
                            </>
                          )}
                        </div>
                        <div className="flex-1">
                          <input 
                            type="file" 
                            ref={fileInputRef}
                            onChange={handleImageChange}
                            accept="image/*"
                            className="hidden"
                          />
                          <p className="text-[7px] text-stone-400 leading-tight">
                            Subir imagen cuadrada.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-3">
                      <label className="block text-[9px] font-bold text-stone-400 uppercase mb-0.5">Descripción</label>
                      <textarea name="description" defaultValue={editing?.description} className="w-full px-3 py-1.5 bg-stone-50 rounded-xl border-none focus:ring-2 focus:ring-brand-red resize-none h-10 text-xs" />
                    </div>
                    
                    <div>
                      <label className="block text-[9px] font-bold text-stone-400 uppercase mb-0.5">SKU</label>
                      <input name="sku" defaultValue={editing?.sku} className="w-full px-3 py-1.5 bg-stone-50 rounded-xl border-none focus:ring-2 focus:ring-brand-red text-xs" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-stone-400 uppercase mb-0.5">Categoría</label>
                      <select name="category" defaultValue={editing?.category} className="w-full px-3 py-1.5 bg-stone-50 rounded-xl border-none focus:ring-2 focus:ring-brand-red text-xs" required>
                        <option value="">Seleccionar...</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-stone-400 uppercase mb-0.5">Costo</label>
                      <div className="relative">
                        <input 
                          name="cost" 
                          type="number" 
                          step="0.01" 
                          defaultValue={editing?.cost || (isComposite ? calculatedCost : 0)} 
                          key={isComposite ? calculatedCost : 'manual'}
                          className="w-full px-3 py-1.5 bg-stone-50 rounded-xl border-none focus:ring-2 focus:ring-brand-red text-xs" 
                        />
                        {isComposite && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[7px] font-black text-brand-red bg-brand-red/10 px-1 py-0.5 rounded-md">
                            CALC
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-stone-400 uppercase mb-0.5">Precio de Venta</label>
                      <input name="price" type="number" step="0.01" defaultValue={editing?.price} className="w-full px-3 py-1.5 bg-stone-50 rounded-xl border-none focus:ring-2 focus:ring-brand-red text-xs" required />
                    </div>

                    {!editing && !isComposite && (
                      <div>
                        <label className="block text-[9px] font-bold text-stone-400 uppercase mb-0.5">Stock Inicial</label>
                        <input name="initial_stock" type="number" step="0.01" defaultValue="0" className="w-full px-3 py-1.5 bg-stone-50 rounded-xl border-none focus:ring-2 focus:ring-brand-red text-xs" />
                      </div>
                    )}

                    <div className="col-span-3 flex items-center gap-2 p-2 bg-stone-50 rounded-xl">
                      <input 
                        type="checkbox" 
                        id="isComposite" 
                        checked={isComposite} 
                        onChange={(e) => setIsComposite(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-stone-300 text-brand-red focus:ring-brand-red"
                      />
                      <label htmlFor="isComposite" className="text-[10px] font-bold text-stone-700">Es producto compuesto (Combo/Receta)</label>
                    </div>

                    {isComposite && (
                      <div className="col-span-3 space-y-2 bg-stone-50 p-3 rounded-2xl border border-stone-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-brand-red rounded-md flex items-center justify-center">
                              <Package size={10} className="text-white" />
                            </div>
                            <h4 className="text-[9px] font-black text-stone-800 uppercase tracking-widest">Receta / Insumos</h4>
                          </div>
                          <button 
                            type="button" 
                            onClick={addComponent}
                            className="text-[9px] font-bold text-brand-red flex items-center gap-1 bg-white px-2 py-1 rounded-lg shadow-sm border border-stone-100 hover:bg-stone-50 transition-all"
                          >
                            <Plus size={10} /> Agregar
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {selectedComponents.map((comp, index) => (
                            <div key={index} className="flex gap-2 items-center bg-white p-1.5 rounded-xl shadow-sm border border-stone-100">
                              <select 
                                value={comp.type} 
                                onChange={(e) => updateComponent(index, 'type', e.target.value)}
                                className="w-16 bg-stone-50 border-none text-[8px] font-bold rounded-lg focus:ring-0"
                              >
                                <option value="product">Prod</option>
                                <option value="category">Cat</option>
                              </select>
                              
                              {comp.type === 'product' ? (
                                <select 
                                  value={comp.id} 
                                  onChange={(e) => updateComponent(index, 'id', e.target.value)}
                                  className="flex-1 bg-transparent border-none text-[9px] font-bold focus:ring-0"
                                >
                                  <option value="">Sel...</option>
                                  {products.filter(p => !p.is_composite).map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                              ) : (
                                <select 
                                  value={comp.id} 
                                  onChange={(e) => updateComponent(index, 'id', e.target.value)}
                                  className="flex-1 bg-transparent border-none text-[9px] font-bold focus:ring-0"
                                >
                                  <option value="">Cat...</option>
                                  {categories.map(cat => (
                                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                                  ))}
                                </select>
                              )}

                              <input 
                                type="number" 
                                value={comp.quantity} 
                                onChange={(e) => updateComponent(index, 'quantity', parseFloat(e.target.value))}
                                className="w-10 bg-stone-50 border-none text-[9px] font-bold rounded-lg focus:ring-0 text-center"
                                placeholder="Cant"
                              />
                              
                              <button 
                                type="button" 
                                onClick={() => removeComponent(index)}
                                className="p-1 text-stone-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                        {selectedComponents.length === 0 && (
                          <div className="py-2 text-center border-2 border-dashed border-stone-200 rounded-xl">
                            <p className="text-[8px] font-bold text-stone-400 uppercase">Sin insumos</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-4 bg-stone-50 border-t border-stone-100 flex gap-2">
                  <button type="button" onClick={() => { setEditing(null); setShowAdd(false); setImagePreview(null); }} className="flex-1 py-2 font-bold text-stone-500 hover:bg-stone-100 rounded-xl transition-colors text-xs">Cancelar</button>
                  <button type="submit" className="flex-[2] py-2 bg-brand-red text-white font-black rounded-xl shadow-lg shadow-brand-red/20 flex items-center justify-center gap-2 hover:bg-brand-red/90 transition-colors text-xs">
                    <Save size={16} />
                    Guardar Producto
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {adjustingStock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAdjustingStock(null)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm bg-white rounded-[40px] shadow-2xl overflow-hidden">
              <form onSubmit={handleAdjustStock} className="p-8">
                <h2 className="text-2xl font-black mb-6">Ajustar Stock</h2>
                <p className="text-stone-500 mb-6">{adjustingStock.name}</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Nueva Cantidad</label>
                    <input name="quantity" type="number" step="0.01" defaultValue={adjustingStock.current} className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red" required />
                  </div>
                </div>
                <div className="flex gap-4 mt-8">
                  <button type="button" onClick={() => setAdjustingStock(null)} className="flex-1 py-4 font-bold text-stone-500 hover:bg-stone-100 rounded-2xl">Cancelar</button>
                  <button type="submit" className="flex-[2] py-4 bg-brand-red text-white font-bold rounded-2xl shadow-lg shadow-brand-red/20">Guardar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCategories && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCategories(false)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden">
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black">Categorías</h2>
                  <button onClick={() => setShowCategories(false)} className="p-2 text-stone-400 hover:text-stone-600 transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSaveCategory} className="flex gap-2 mb-6">
                  <input 
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nueva categoría..."
                    className="flex-1 px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red"
                  />
                  <button type="submit" className="bg-brand-red text-white p-3 rounded-2xl shadow-lg shadow-brand-red/20">
                    {editingCategory ? <Check size={20} /> : <Plus size={20} />}
                  </button>
                </form>

                <div className="space-y-2 max-h-[400px] overflow-y-auto noscrollbar">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl group">
                      <span className="font-bold text-stone-800">{cat.name}</span>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setEditingCategory(cat); setNewCategoryName(cat.name); }}
                          className="p-2 text-stone-400 hover:text-brand-red transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Customers Module ---

const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'customers'));
    return () => unsub();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());

    try {
      await addDoc(collection(db, 'customers'), { ...data, points: 0 });
      setShowAdd(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'customers');
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 h-full overflow-y-auto noscrollbar">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-stone-900 uppercase tracking-tight">Clientes</h1>
          <p className="text-xs lg:text-sm text-stone-500 font-medium">Base de datos y fidelización</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-brand-red text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-brand-red/20 text-sm"
        >
          <PlusCircle size={18} />
          Nuevo Cliente
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-100">
                <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Cliente</th>
                <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">DNI</th>
                <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Puntos</th>
                <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Teléfono</th>
                <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {customers.map(c => (
                <motion.tr
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={c.id}
                  className="hover:bg-stone-50/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-stone-100 rounded-lg flex items-center justify-center text-stone-400 shrink-0">
                        <UserCircle size={18} />
                      </div>
                      <span className="font-bold text-stone-800 text-sm">{c.first_name} {c.last_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-stone-500">
                    {c.dni || 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-brand-yellow/20 text-brand-red px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                      {c.points} Puntos
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-stone-500">
                    {c.phone || 'Sin tel.'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 bg-stone-50 hover:bg-stone-100 rounded-xl text-stone-600 transition-all">
                        <Edit size={14} />
                      </button>
                      <a 
                        href={`https://wa.me/${c.phone}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-2 bg-green-50 hover:bg-green-100 rounded-xl text-green-600 transition-all"
                      >
                        <MessageCircle size={14} />
                      </a>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdd(false)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden">
              <form onSubmit={handleAdd} className="p-8">
                <h2 className="text-2xl font-black mb-6">Nuevo Cliente</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Nombre</label>
                    <input name="first_name" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Apellido</label>
                    <input name="last_name" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-2">DNI</label>
                    <input name="dni" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Teléfono</label>
                    <input name="phone" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red" />
                  </div>
                </div>
                <div className="flex gap-4 mt-8">
                  <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-4 font-bold text-stone-500 hover:bg-stone-100 rounded-2xl">Cancelar</button>
                  <button type="submit" className="flex-[2] py-4 bg-brand-red text-white font-bold rounded-2xl shadow-lg shadow-brand-red/20">Crear Cliente</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Dashboard Module ---

const Dashboard = () => {
  const [stats, setStats] = useState<any>(null);
  const [activeReport, setActiveReport] = useState('summary');
  const { user } = useApp();

  useEffect(() => {
    if (!user?.branch_id) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'sales'),
      where('created_at', '>=', Timestamp.fromDate(today))
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      const sales = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(s => s.branch_id === user.branch_id);
        
      const todaySales = sales.reduce((acc, s) => acc + (s.status === 'completed' ? s.total : 0), 0);
      
      // Fetch items for each sale to get product stats
      const productsMap: any = {};
      const employeeMap: any = {};
      const paymentMap: any = {};
      let totalDiscounts = 0;
      let totalTaxes = 0;

      for (const sale of sales) {
        if (sale.status !== 'completed') continue;

        // Payments
        paymentMap[sale.payment_type] = (paymentMap[sale.payment_type] || 0) + sale.total;
        // Discounts/Taxes
        totalDiscounts += (sale.discount || 0);
        totalTaxes += (sale.tax || 0);
        // Employees
        if (sale.seller_name) {
          employeeMap[sale.seller_name] = (employeeMap[sale.seller_name] || 0) + sale.total;
        }

        // Items subcollection
        const itemsSnap = await getDocs(collection(db, `sales/${sale.id}/items`));
        itemsSnap.docs.forEach(itemDoc => {
          const item = itemDoc.data();
          productsMap[item.name] = (productsMap[item.name] || 0) + item.quantity;
        });
      }

      const topProducts = Object.entries(productsMap)
        .map(([name, sold]: any) => ({ name, sold }))
        .sort((a: any, b: any) => b.sold - a.sold)
        .slice(0, 12);

      setStats({
        todaySales,
        todayCount: sales.length,
        topProducts,
        salesByEmployee: Object.entries(employeeMap).map(([name, total]) => ({ name, total })),
        salesByPayment: Object.entries(paymentMap).map(([type, total]) => ({ type, total })),
        totalDiscounts,
        totalTaxes,
        rawSales: sales
      });
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sales'));

    return () => unsub();
  }, [user?.branch_id]);

  if (!stats) return (
    <div className="p-8 flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-red"></div>
    </div>
  );

  const reports = [
    { id: 'summary', label: 'Resumen de Venta', icon: LayoutDashboard },
    { id: 'top_sales', label: 'Top 12 de Ventas', icon: TrendingUp },
    { id: 'by_product', label: 'Venta por Artículo', icon: Package },
    { id: 'by_employee', label: 'Venta por Empleado', icon: UserCircle },
    { id: 'receipts', label: 'Recibos', icon: History },
    { id: 'by_payment', label: 'Ventas por Tipo de Pago', icon: Banknote },
    { id: 'discounts', label: 'Descuentos', icon: Tag },
    { id: 'taxes', label: 'Impuesto', icon: CreditCard },
    { id: 'cash', label: 'Caja', icon: Store },
  ];

  return (
    <div className="flex h-full bg-stone-50 overflow-hidden">
      {/* Reports Sidebar */}
      <div className="w-64 bg-white border-r border-stone-200 flex flex-col">
        <div className="p-6 border-b border-stone-100">
          <h2 className="text-xl font-black text-stone-900 uppercase tracking-tight">Estadísticas</h2>
          <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest mt-1">Reportes del Negocio</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1 noscrollbar">
          {reports.map(report => (
            <button
              key={report.id}
              onClick={() => setActiveReport(report.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold ${
                activeReport === report.id 
                  ? 'bg-brand-red text-white shadow-lg shadow-brand-red/20' 
                  : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'
              }`}
            >
              <report.icon size={18} />
              <span>{report.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Report Content */}
      <div className="flex-1 overflow-y-auto p-8 noscrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeReport}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-4xl mx-auto"
          >
            {activeReport === 'summary' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-8">
                  <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight">Resumen de Venta</h1>
                  <div className="flex gap-2">
                    <button className="bg-white px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-600">Hoy</button>
                    <button className="bg-white px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-600">7 días</button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-[32px] border border-stone-100 shadow-sm">
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Ventas Totales</p>
                    <h3 className="text-3xl font-black text-stone-900">${stats.todaySales || 0}</h3>
                    <div className="mt-4 flex items-center gap-2 text-green-500 text-xs font-bold">
                      <TrendingUp size={14} />
                      <span>+12% vs ayer</span>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-[32px] border border-stone-100 shadow-sm">
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Transacciones</p>
                    <h3 className="text-3xl font-black text-stone-900">{stats.todayCount || 0}</h3>
                    <div className="mt-4 flex items-center gap-2 text-blue-500 text-xs font-bold">
                      <ShoppingCart size={14} />
                      <span>Prom. $850</span>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-[32px] border border-stone-100 shadow-sm">
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Clientes Nuevos</p>
                    <h3 className="text-3xl font-black text-stone-900">4</h3>
                    <div className="mt-4 flex items-center gap-2 text-purple-500 text-xs font-bold">
                      <Users size={14} />
                      <span>+2 hoy</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeReport === 'top_sales' && (
              <div className="space-y-6">
                <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight mb-8">Top 12 de Ventas</h1>
                <div className="bg-white rounded-[32px] border border-stone-100 shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-100">
                        <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Ranking</th>
                        <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Producto</th>
                        <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Ventas</th>
                        <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest text-right">Total (Est.)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {(stats.topProducts || []).map((p: any, i: number) => (
                        <tr key={p.name} className="hover:bg-stone-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${
                              i < 3 ? 'bg-brand-yellow text-stone-900' : 'bg-stone-100 text-stone-400'
                            }`}>
                              {i + 1}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-stone-800 text-sm">{p.name}</td>
                          <td className="px-6 py-4 text-xs font-bold text-stone-500">{p.sold} unidades</td>
                          <td className="px-6 py-4 text-right font-black text-stone-900">
                            ${(p.total || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {(stats.topProducts || []).length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-stone-400 font-bold">Sin datos de ventas hoy</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeReport === 'by_employee' && (
              <div className="space-y-6">
                <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight mb-8">Venta por Empleado</h1>
                <div className="grid grid-cols-1 gap-4">
                  {(stats.salesByEmployee || []).map((e: any) => (
                    <div key={e.name} className="bg-white p-6 rounded-[32px] border border-stone-100 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-400">
                          <UserCircle size={24} />
                        </div>
                        <div>
                          <h3 className="font-black text-stone-900 uppercase tracking-tight">{e.name}</h3>
                          <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">Vendedor</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Total Vendido</p>
                        <h3 className="text-2xl font-black text-stone-900">${e.total}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeReport === 'by_payment' && (
              <div className="space-y-6">
                <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight mb-8">Ventas por Tipo de Pago</h1>
                <div className="grid grid-cols-1 gap-4">
                  {(stats.salesByPayment || []).map((p: any) => (
                    <div key={p.type} className="bg-white p-6 rounded-[32px] border border-stone-100 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-400">
                          {p.type === 'Efectivo' ? <Banknote size={24} /> : <CreditCard size={24} />}
                        </div>
                        <div>
                          <h3 className="font-black text-stone-900 uppercase tracking-tight">{p.type}</h3>
                          <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">Método de Pago</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Total Recaudado</p>
                        <h3 className="text-2xl font-black text-stone-900">${p.total}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeReport === 'cash' && (
              <div className="space-y-6">
                <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight mb-8">Caja</h1>
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm">
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Efectivo en Caja</p>
                    <h3 className="text-4xl font-black text-stone-900">
                      ${(stats.salesByPayment || []).find((p: any) => p.type === 'Efectivo')?.total || 0}
                    </h3>
                    <div className="mt-6 pt-6 border-t border-stone-50 flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-500">Fondo Inicial: $5.000</span>
                      <span className="text-xs font-bold text-green-500">Ventas: +${(stats.salesByPayment || []).find((p: any) => p.type === 'Efectivo')?.total || 0}</span>
                    </div>
                  </div>
                  <div className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm">
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Otros Medios</p>
                    <h3 className="text-4xl font-black text-stone-900">
                      ${(stats.salesByPayment || []).filter((p: any) => p.type !== 'Efectivo').reduce((acc: number, p: any) => acc + p.total, 0)}
                    </h3>
                    <div className="mt-6 pt-6 border-t border-stone-50 flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-500">Tarjetas/Transferencias</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {['by_product', 'receipts', 'discounts', 'taxes'].includes(activeReport) && (
              <div className="flex flex-col items-center justify-center py-20 text-stone-300">
                <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                  <LayoutDashboard size={40} />
                </div>
                <h2 className="text-xl font-black text-stone-400 uppercase tracking-widest">Reporte en Desarrollo</h2>
                <p className="text-sm font-medium mt-2">Estamos procesando los datos para esta sección.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

// --- Staff Module ---

const Staff = ({ rolePermissions }: { rolePermissions: RolePermission[] }) => {
  const { user } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userShifts, setUserShifts] = useState<any[]>([]);
  const [showShifts, setShowShifts] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  
  // Shift History Filters
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) return;

    const unsubUsers = onSnapshot(collection(db, 'empleados'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'empleados'));

    const unsubBranches = onSnapshot(collection(db, 'branches'), (snapshot) => {
      setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'branches'));

    return () => {
      unsubUsers();
      unsubBranches();
    };
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    const pin = formData.get('pin') as string;

    console.log('Saving user. PIN provided:', !!pin, 'Length:', pin?.length);

    try {
      const branchName = branches.find(b => b.id === data.branch_id)?.name || 'Sucursal';
      const email = data.email as string;
      const userId = email || `pin_${Date.now()}`;
      
      if (editingUser) {
        const updateData: any = {
          name: data.name,
          role: data.role,
          branch_id: data.branch_id,
          branch_name: branchName
        };
        
        if (email) updateData.email = email;
        
        // Only update PIN if a new one was entered
        if (pin && pin.length >= 4) {
          console.log('Hashing new PIN for update...');
          updateData.pin = await bcrypt.hash(pin, 10);
        }
        
        console.log('Updating user doc:', editingUser.id, updateData);
        await updateDoc(doc(db, 'empleados', editingUser.id), updateData);
        setEditingUser(null);
      } else {
        let hashedPin = '';
        if (pin && pin.length >= 4) {
          console.log('Hashing new PIN for create...');
          hashedPin = await bcrypt.hash(pin, 10);
        }
        
        const newUser: any = {
          ...data,
          id: userId,
          pin: hashedPin,
          branch_name: branchName
        };
        if (!email) delete newUser.email;

        console.log('Creating new user doc:', userId, newUser);
        await setDoc(doc(db, 'empleados', userId), newUser);
      }
      setShowAdd(false);
    } catch (err) {
      console.error('Error saving user:', err);
      handleFirestoreError(err, editingUser ? OperationType.UPDATE : OperationType.CREATE, 'empleados');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar a este empleado?')) return;
    try {
      await deleteDoc(doc(db, 'empleados', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${id}`);
    }
  };

  const handleUpdateRolePermissions = async (roleId: string, modules: string[]) => {
    try {
      await setDoc(doc(db, 'role_permissions', roleId), { modules }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `role_permissions/${roleId}`);
    }
  };

  const handleViewShifts = async (user: User) => {
    setSelectedUser(user);
    // Remove orderBy from query to avoid composite index requirement
    const q = query(collection(db, 'shifts'), where('user_id', '==', user.id));
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    // Sort in memory
    docs.sort((a, b) => {
      const dateA = a.start_time?.seconds || 0;
      const dateB = b.start_time?.seconds || 0;
      return dateB - dateA;
    });
    setUserShifts(docs);
    setShowShifts(true);
  };

  const filteredShifts = (userShifts || []).filter(s => {
    if (!s.start_time) return false;
    try {
      const date = s.start_time.toDate ? s.start_time.toDate() : new Date(s.start_time);
      const start = date.toISOString().split('T')[0];
      return start >= startDate && start <= endDate;
    } catch (e) {
      console.error("Error parsing shift date:", e);
      return false;
    }
  });

  const totalHours = filteredShifts.reduce((acc, s) => {
    if (!s.end_time || !s.start_time) return acc;
    try {
      const startDateObj = s.start_time.toDate ? s.start_time.toDate() : new Date(s.start_time);
      const endDateObj = s.end_time.toDate ? s.end_time.toDate() : new Date(s.end_time);
      const diff = endDateObj.getTime() - startDateObj.getTime();
      return acc + (diff / (1000 * 60 * 60));
    } catch (e) {
      console.error("Error calculating shift hours:", e);
      return acc;
    }
  }, 0);

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto noscrollbar">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-stone-900">Personal</h1>
          <p className="text-stone-500">Gestión de empleados y accesos</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowRoles(true)}
            className="bg-white text-stone-600 border border-stone-200 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-stone-50 transition-colors"
          >
            <Settings size={20} />
            Roles y Permisos
          </button>
          <button 
            onClick={() => { setEditingUser(null); setShowAdd(true); }}
            className="bg-brand-red text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-brand-red/20"
          >
            <PlusCircle size={20} />
            Nuevo Empleado
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {users.map(u => (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            key={u.id}
            className="bg-white p-6 rounded-[32px] shadow-sm border border-stone-100"
          >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-400 font-bold text-xl">
                  {u.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-stone-800">{u.name}</h3>
                  <p className="text-xs text-stone-400">{u.email}</p>
                </div>
                <div className="ml-auto">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    u.role === 'owner' ? 'bg-purple-100 text-purple-600' : 
                    u.role === 'admin' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                  }`}>
                    {u.role}
                  </span>
                </div>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-400">Sucursal</span>
                  <span className="font-bold text-stone-700">{u.branch_name}</span>
                </div>
              </div>

            <div className="flex gap-2">
              <button 
                onClick={() => { setEditingUser(u); setShowAdd(true); }}
                className="flex-1 py-2 bg-stone-50 hover:bg-stone-100 rounded-xl text-xs font-bold text-stone-600 transition-all"
              >
                Editar Perfil
              </button>
              <button 
                onClick={() => handleViewShifts(u)}
                className="flex-1 py-2 bg-stone-50 hover:bg-stone-100 rounded-xl text-xs font-bold text-stone-600 transition-all"
              >
                Ver Turnos
              </button>
              <button 
                onClick={() => handleDeleteUser(u.id)}
                className="p-2 bg-stone-50 hover:bg-red-50 text-stone-400 hover:text-red-500 rounded-xl transition-all"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {(showAdd || editingUser) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowAdd(false); setEditingUser(null); }} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden">
              <form onSubmit={handleAdd} className="p-8">
                <h2 className="text-2xl font-black mb-6">{editingUser ? 'Editar' : 'Nuevo'} Empleado</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Nombre Completo</label>
                    <input name="name" defaultValue={editingUser?.name} className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Email (Opcional para PIN)</label>
                    <input name="email" type="email" defaultValue={editingUser?.email} readOnly={!!editingUser} className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red disabled:opacity-50" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Rol</label>
                      <select name="role" defaultValue={editingUser?.role} className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red">
                        <option value="seller">Vendedor</option>
                        <option value="admin">Administrador</option>
                        <option value="owner">Dueño</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-400 uppercase mb-2">PIN (4-6 dígitos)</label>
                      <input name="pin" type="password" maxLength={6} pattern="\d*" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red" placeholder={editingUser ? "Dejar vacío para no cambiar" : "1234"} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Sucursal</label>
                    <select name="branch_id" defaultValue={editingUser?.branch_id} className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red">
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-4 mt-8">
                  <button type="button" onClick={() => { setShowAdd(false); setEditingUser(null); }} className="flex-1 py-4 font-bold text-stone-500 hover:bg-stone-100 rounded-2xl">Cancelar</button>
                  <button type="submit" className="flex-[2] py-4 bg-brand-red text-white font-bold rounded-2xl shadow-lg shadow-brand-red/20">
                    {editingUser ? 'Guardar Cambios' : 'Crear Empleado'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showRoles && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRoles(false)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-stone-900">Roles y Permisos</h2>
                  <p className="text-stone-500 text-sm">Configura qué módulos puede ver cada rol</p>
                </div>
                <button onClick={() => setShowRoles(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X size={24} className="text-stone-400" />
                </button>
              </div>
              <div className="p-8 overflow-y-auto noscrollbar space-y-8">
                {['owner', 'admin', 'seller'].map(roleId => {
                  const currentPerms = rolePermissions.find(rp => rp.id === roleId)?.modules || [];
                  const modules = [
                    { id: 'pos', label: 'Caja' },
                    { id: 'inventory', label: 'Stock' },
                    { id: 'customers', label: 'Clientes' },
                    { id: 'stats', label: 'Estadísticas' },
                    { id: 'staff', label: 'Personal' },
                    { id: 'settings', label: 'Ajustes' }
                  ];
                  
                  return (
                    <div key={roleId} className="space-y-4">
                      <h3 className="text-lg font-black text-stone-800 uppercase tracking-wider flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${roleId === 'owner' ? 'bg-purple-500' : roleId === 'admin' ? 'bg-blue-500' : 'bg-green-500'}`} />
                        {roleId}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {modules.map(mod => {
                          const isChecked = currentPerms.includes(mod.id);
                          return (
                            <button
                              key={mod.id}
                              onClick={() => {
                                const newPerms = isChecked 
                                  ? currentPerms.filter(p => p !== mod.id)
                                  : [...currentPerms, mod.id];
                                handleUpdateRolePermissions(roleId, newPerms);
                              }}
                              className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                                isChecked ? 'border-brand-red bg-red-50 text-brand-red' : 'border-stone-100 text-stone-400 grayscale'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${isChecked ? 'bg-brand-red border-brand-red' : 'border-stone-300'}`}>
                                {isChecked && <Check size={14} className="text-white" />}
                              </div>
                              <span className="font-bold text-sm">{mod.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}

        {showShifts && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowShifts(false)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                <div>
                  <h2 className="text-2xl font-black text-stone-900">Turnos de {selectedUser.name}</h2>
                  <p className="text-stone-500">Historial de entradas, salidas y horas trabajadas</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-stone-200 shadow-sm">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-stone-400 uppercase">Desde</span>
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none p-0 text-sm font-bold focus:ring-0" />
                    </div>
                    <div className="w-px h-8 bg-stone-100 mx-2" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-stone-400 uppercase">Hasta</span>
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none p-0 text-sm font-bold focus:ring-0" />
                    </div>
                  </div>
                  <div className="bg-brand-yellow px-6 py-2 rounded-2xl shadow-lg shadow-brand-yellow/20">
                    <p className="text-[10px] font-black text-stone-900 uppercase">Total Horas</p>
                    <p className="text-xl font-black text-stone-900">{totalHours.toFixed(1)}h</p>
                  </div>
                  <button onClick={() => setShowShifts(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                    <X size={24} className="text-stone-400" />
                  </button>
                </div>
              </div>
              
              <div className="p-8 overflow-y-auto noscrollbar flex-1">
                <div className="space-y-4">
                  {filteredShifts.length === 0 ? (
                    <div className="text-center py-12 text-stone-400 font-medium">No hay turnos en este periodo</div>
                  ) : (
                    filteredShifts.map(s => {
                      const actualStart = new Date(s.start_time);
                      const actualEnd = s.end_time ? new Date(s.end_time) : null;
                      const duration = actualEnd ? (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60) : 0;
                      
                      return (
                        <div key={s.id} className="bg-stone-50 rounded-3xl p-6 border border-stone-100">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                              <p className="text-[10px] font-black text-stone-400 uppercase mb-1">Fecha</p>
                              <p className="font-bold text-stone-800">{actualStart.toLocaleDateString()}</p>
                            </div>
                            <div className="flex gap-8">
                              <div>
                                <p className="text-[10px] font-black text-stone-400 uppercase mb-1">Entrada</p>
                                <p className="font-bold text-stone-800">{actualStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-stone-400 uppercase mb-1">Salida</p>
                                <p className="font-bold text-stone-800">{actualEnd ? actualEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'En curso'}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-black text-stone-400 uppercase mb-1">Duración</p>
                              <p className="text-lg font-black text-brand-red">{duration.toFixed(1)}h</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Settings Module ---

const SettingsModule = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const { printerSettings, setPrinterSettings, ticketSettings, setTicketSettings, shiftTolerance, setShiftTolerance } = useApp();
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [ticketLogoPreview, setTicketLogoPreview] = useState<string | null>(ticketSettings.logo || null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setTicketLogoPreview(base64);
        setTicketSettings({ ...ticketSettings, logo: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'branches'), (snapshot) => {
      setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'branches'));
    return () => unsub();
  }, []);

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());

    try {
      await addDoc(collection(db, 'branches'), data);
      setShowAddBranch(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'branches');
    }
  };

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto noscrollbar">
      <div>
        <h1 className="text-3xl font-black text-stone-900">Ajustes</h1>
        <p className="text-stone-500">Configuración del sistema y sucursales</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-stone-100">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Store size={24} className="text-brand-red" />
              Sucursales
            </h3>
            <div className="space-y-4">
              {branches.map(b => (
                <div key={b.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl">
                  <div>
                    <p className="font-bold text-stone-800">{b.name}</p>
                    <p className="text-xs text-stone-400">{b.location || 'Sin ubicación'}</p>
                  </div>
                  <button className="p-2 text-stone-400 hover:text-brand-red transition-colors">
                    <Edit size={18} />
                  </button>
                </div>
              ))}
              <button 
                onClick={() => setShowAddBranch(true)}
                className="w-full py-4 border-2 border-dashed border-stone-200 rounded-2xl text-stone-400 font-bold hover:border-brand-red hover:text-brand-red transition-all flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Agregar Sucursal
              </button>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-stone-100">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Users size={24} className="text-brand-red" />
              Sistema de Fidelización
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-stone-600">Puntos por cada $100</span>
                <input type="number" defaultValue={10} className="w-20 px-3 py-2 bg-stone-50 rounded-xl border-none text-right font-bold" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-600">Valor de cada punto</span>
                <input type="number" defaultValue={1} className="w-20 px-3 py-2 bg-stone-50 rounded-xl border-none text-right font-bold" />
              </div>
              <button className="w-full py-4 bg-stone-900 text-white font-bold rounded-2xl">
                Guardar Cambios
              </button>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-stone-100">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Printer size={24} className="text-brand-red" />
              Configuración de Impresora
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Nombre de Impresora</label>
                <input 
                  value={printerSettings.name}
                  onChange={(e) => setPrinterSettings({ ...printerSettings, name: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Dirección IP</label>
                <input 
                  value={printerSettings.ip}
                  onChange={(e) => setPrinterSettings({ ...printerSettings, ip: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Ancho de Papel</label>
                <div className="flex gap-2">
                  {['58mm', '80mm'].map(width => (
                    <button
                      key={width}
                      onClick={() => setPrinterSettings({ ...printerSettings, paperWidth: width as any })}
                      className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all ${
                        printerSettings.paperWidth === width 
                          ? 'bg-brand-red text-white shadow-md' 
                          : 'bg-stone-50 text-stone-500 hover:bg-stone-100'
                      }`}
                    >
                      {width}
                    </button>
                  ))}
                </div>
              </div>
              <button 
                onClick={() => alert('Imprimiendo ticket de prueba...')}
                className="w-full py-4 border-2 border-brand-red text-brand-red font-bold rounded-2xl hover:bg-brand-red hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <Printer size={20} />
                Ticket de Prueba
              </button>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-stone-100">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Save size={24} className="text-brand-red" />
              Configuración del Ticket
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Logo del Ticket</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200 flex items-center justify-center overflow-hidden">
                    {ticketLogoPreview ? (
                      <img src={ticketLogoPreview} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <Camera size={24} className="text-stone-300" />
                    )}
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleLogoChange}
                    className="hidden" 
                    id="ticket-logo-upload" 
                  />
                  <label 
                    htmlFor="ticket-logo-upload"
                    className="px-4 py-2 bg-stone-100 text-stone-600 rounded-xl font-bold text-xs cursor-pointer hover:bg-stone-200 transition-all"
                  >
                    Subir Imagen
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Encabezado de Ticket</label>
                <textarea 
                  value={ticketSettings.header}
                  onChange={(e) => setTicketSettings({ ...ticketSettings, header: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red resize-none h-20 text-sm"
                  placeholder="Ej: ¡Gracias por su compra!"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Pie de Ticket</label>
                <textarea 
                  value={ticketSettings.footer}
                  onChange={(e) => setTicketSettings({ ...ticketSettings, footer: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red resize-none h-20 text-sm"
                  placeholder="Ej: Vuelva pronto"
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl">
                <div>
                  <p className="font-bold text-stone-800">Impresión de Ticket</p>
                  <p className="text-[10px] text-stone-400">Imprimir ticket para el cliente</p>
                </div>
                <button 
                  onClick={() => setTicketSettings({ ...ticketSettings, printTicket: !ticketSettings.printTicket })}
                  className={`w-12 h-6 rounded-full transition-all relative ${ticketSettings.printTicket ? 'bg-brand-red' : 'bg-stone-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${ticketSettings.printTicket ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl">
                <div>
                  <p className="font-bold text-stone-800">Impresión de Comandas</p>
                  <p className="text-[10px] text-stone-400">Imprimir comanda para cocina/mostrador</p>
                </div>
                <button 
                  onClick={() => setTicketSettings({ ...ticketSettings, printComanda: !ticketSettings.printComanda })}
                  className={`w-12 h-6 rounded-full transition-all relative ${ticketSettings.printComanda ? 'bg-brand-red' : 'bg-stone-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${ticketSettings.printComanda ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl">
                <div>
                  <p className="font-bold text-stone-800">Impresión de Cierre de Caja</p>
                  <p className="text-[10px] text-stone-400">Imprimir resumen detallado al cerrar el turno</p>
                </div>
                <button 
                  onClick={() => setTicketSettings({ ...ticketSettings, printShiftClosing: !ticketSettings.printShiftClosing })}
                  className={`w-12 h-6 rounded-full transition-all relative ${ticketSettings.printShiftClosing ? 'bg-brand-red' : 'bg-stone-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${ticketSettings.printShiftClosing ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-stone-100">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Clock size={24} className="text-brand-red" />
              Configuración de Turnos
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Margen de Tolerancia (minutos)</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="0" 
                    max="60" 
                    step="5"
                    value={shiftTolerance}
                    onChange={(e) => setShiftTolerance(parseInt(e.target.value))}
                    className="flex-1 accent-brand-red"
                  />
                  <span className="font-bold text-stone-700 w-12 text-right">{shiftTolerance}m</span>
                </div>
                <p className="text-[10px] text-stone-400 mt-2 italic">
                  * Margen permitido para la apertura y cierre de turnos respecto al horario programado.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-stone-100">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Settings size={24} className="text-brand-red" />
            Información del Negocio
          </h3>
          <form className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Nombre de la Empresa</label>
              <input defaultValue="Panchería Pro" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase mb-2">CUIT / Identificación Fiscal</label>
              <input defaultValue="20-12345678-9" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red" />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Email de Contacto</label>
              <input defaultValue="admin@pancheriapro.com" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red" />
            </div>
            <div className="pt-4">
              <button className="w-full py-4 bg-brand-red text-white font-bold rounded-2xl shadow-lg shadow-brand-red/20">
                Actualizar Información
              </button>
            </div>
          </form>
        </div>
      </div>

      <AnimatePresence>
        {showAddBranch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddBranch(false)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl p-8">
              <h2 className="text-2xl font-black mb-6">Nueva Sucursal</h2>
              <form onSubmit={handleAddBranch} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Nombre</label>
                  <input name="name" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Ubicación</label>
                  <input name="location" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Apertura</label>
                    <input name="opening_time" type="time" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Cierre</label>
                    <input name="closing_time" type="time" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red" />
                  </div>
                </div>
                <div className="flex gap-4 mt-8">
                  <button type="button" onClick={() => setShowAddBranch(false)} className="flex-1 py-4 font-bold text-stone-500 hover:bg-stone-100 rounded-2xl">Cancelar</button>
                  <button type="submit" className="flex-[2] py-4 bg-brand-red text-white font-bold rounded-2xl shadow-lg shadow-brand-red/20">Crear Sucursal</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [branch, setBranch] = useState<any | null>(null);
  const [shift, setShift] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState('ventas');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinAction, setPinAction] = useState<{ type: 'open' | 'close', data: any } | null>(null);
  const [pinError, setPinError] = useState(false);
  const [showShiftSummary, setShowShiftSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeOperator, setActiveOperator] = useState<User | null>(null);
  const [showOperatorModal, setShowOperatorModal] = useState(false);
  const [operatorPinInput, setOperatorPinInput] = useState('');
  const [operatorPinError, setOperatorPinError] = useState(false);
  const [selectedUserForPin, setSelectedUserForPin] = useState<User | null>(null);
  const [isFirstUser, setIsFirstUser] = useState(false);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);

  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>(() => {
    const saved = localStorage.getItem('printerSettings');
    return saved ? JSON.parse(saved) : { name: 'Impresora Térmica', ip: '192.168.1.100', paperWidth: '80mm' };
  });

  const [ticketSettings, setTicketSettings] = useState<TicketSettings>(() => {
    const saved = localStorage.getItem('ticketSettings');
    return saved ? JSON.parse(saved) : { 
      header: '¡Gracias por su compra!', 
      footer: 'Vuelva pronto',
      printTicket: true,
      printComanda: true,
      printShiftClosing: true
    };
  });

  useEffect(() => {
    localStorage.setItem('ticketSettings', JSON.stringify(ticketSettings));
  }, [ticketSettings]);

  useEffect(() => {
    localStorage.setItem('printerSettings', JSON.stringify(printerSettings));
  }, [printerSettings]);

  const [shiftTolerance, setShiftTolerance] = useState(() => {
    return parseInt(localStorage.getItem('shiftTolerance') || '10');
  });

  useEffect(() => {
    localStorage.setItem('shiftTolerance', shiftTolerance.toString());
  }, [shiftTolerance]);

  useEffect(() => {
    if (user) {
      const unsub = onSnapshot(collection(db, 'empleados'), (snap) => {
        setAllUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'empleados'));
      return () => unsub();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const unsub = onSnapshot(collection(db, 'role_permissions'), (snap) => {
        setRolePermissions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RolePermission)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'role_permissions'));
      return () => unsub();
    }
  }, [user]);

  useEffect(() => {
    const checkFirstUser = async () => {
      console.log('Checking if first user...');
      try {
        // Use a simple query that should be allowed by the rules
        const allUsersSnap = await getDocs(query(collection(db, 'empleados'), limit(1)));
        console.log('First user check result (empty):', allUsersSnap.empty);
        setIsFirstUser(allUsersSnap.empty);
      } catch (err) {
        console.warn('First user check failed (expected if not auth):', err);
        setIsFirstUser(false);
      }
    };
    checkFirstUser();
  }, []);

  useEffect(() => {
    if (user?.branch_id) {
      const unsubBranch = onSnapshot(doc(db, 'branches', user.branch_id), (snap) => {
        if (snap.exists()) setBranch({ id: snap.id, ...snap.data() });
      }, (err) => handleFirestoreError(err, OperationType.GET, `branches/${user.branch_id}`));
      return () => unsubBranch();
    }
  }, [user?.branch_id]);

  useEffect(() => {
    if (user?.branch_id) {
      const q = query(collection(db, 'empleados'), where('branch_id', '==', user.branch_id));
      const unsub = onSnapshot(q, (snap) => {
        setAllUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'empleados'));
      return () => unsub();
    }
  }, [user?.branch_id]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        console.log('Firebase user authenticated:', firebaseUser.email);
        
        // Check email verification
        if (!firebaseUser.emailVerified && firebaseUser.providerData[0]?.providerId === 'password') {
          console.log('Email not verified');
          // We don't sign out immediately to allow them to see the message or resend
          // But we don't set the user state yet
          setLoading(false);
          return;
        }

        try {
          let userDocSnap = await getDoc(doc(db, 'empleados', firebaseUser.uid));
          console.log('User doc snapshot exists (uid):', userDocSnap.exists());
          
          // Migration logic: if not found by uid, try by email
          if (!userDocSnap.exists()) {
            const emailDocSnap = await getDoc(doc(db, 'empleados', firebaseUser.email));
            if (emailDocSnap.exists()) {
              console.log('Found user by email, migrating to uid...');
              const data = emailDocSnap.data();
              await setDoc(doc(db, 'empleados', firebaseUser.uid), data);
              await deleteDoc(doc(db, 'empleados', firebaseUser.email));
              userDocSnap = await getDoc(doc(db, 'empleados', firebaseUser.uid));
            }
          }

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as User;
            userData.id = userDocSnap.id;
            
            // Get branch name
            const branchSnap = await getDoc(doc(db, 'branches', userData.branch_id));
            if (branchSnap.exists()) {
              userData.branch_name = branchSnap.data().name;
            }
            
            setUser(userData);
            setActiveOperator(userData);
          } else {
            console.log('User document does not exist yet. Checking if first user...');
            // Check if it's the first user (owner)
            const allUsersSnap = await getDocs(query(collection(db, 'empleados'), limit(1)));
            console.log('All users snap empty:', allUsersSnap.empty);
            
            if (allUsersSnap.empty || firebaseUser.email === 'juanzabczuk@gmail.com') {
              console.log('Setting up as first user/owner');
              const hashedPin = await bcrypt.hash('1234', 10);
              const setupUser: User = {
                id: firebaseUser.uid,
                name: firebaseUser.displayName || 'Administrador',
                email: firebaseUser.email,
                role: 'owner',
                branch_id: 'default',
                branch_name: 'Sucursal Inicial',
                pin: hashedPin
              };
              setUser(setupUser);
              setActiveOperator(setupUser);
              // Save it to firestore if it's the first user
              if (allUsersSnap.empty) {
                console.log('Saving initial owner document...');
                await setDoc(doc(db, 'empleados', firebaseUser.uid), setupUser);
                await setDoc(doc(db, 'branches', 'default'), {
                  name: 'Sucursal Inicial',
                  created_at: serverTimestamp()
                }, { merge: true });
              }
            } else {
              console.log('User not authorized');
              setUser(null);
              alert('Usuario no autorizado. Contacte al administrador para que le asigne un rol.');
              await auth.signOut();
            }
          }
        } catch (err: any) {
          console.error('Auth error detail:', err);
          if (err.code === 'permission-denied') {
            console.error('Permission denied during auth check.');
          }
        }
      } else {
        console.log('No firebase user');
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user?.id) {
      const q = query(
        collection(db, 'shifts'), 
        where('user_id', '==', user.id), 
        where('end_time', '==', null),
        limit(1)
      );
      const unsubShift = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          setShift({ id: snap.docs[0].id, ...snap.docs[0].data() });
        } else {
          setShift(null);
        }
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'shifts'));
      return () => unsubShift();
    }
  }, [user?.id]);

  useEffect(() => {
    if (user && !shift && !loading && !showShiftSummary) {
      setShowShiftModal(true);
    }
  }, [user, shift, loading, showShiftSummary]);

  const isWithinTolerance = (targetTimeStr: string | undefined) => {
    if (!targetTimeStr) return true;
    const now = new Date();
    const [targetH, targetM] = targetTimeStr.split(':').map(Number);
    const target = new Date();
    target.setHours(targetH, targetM, 0, 0);
    
    const diffMs = Math.abs(now.getTime() - target.getTime());
    const diffMin = diffMs / (1000 * 60);
    return diffMin <= shiftTolerance;
  };

  const performOpenShift = async (initialCash: number, notes: string) => {
    if (!user || !activeOperator) return;
    try {
      await addDoc(collection(db, 'shifts'), {
        user_id: activeOperator.id,
        user_name: activeOperator.name,
        branch_id: user.branch_id,
        start_time: serverTimestamp(),
        end_time: null,
        initial_cash: initialCash,
        expected_cash: initialCash,
        notes: notes,
        status: 'open'
      });
      setShowShiftModal(false);
      setPinAction(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shifts');
    }
  };

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    const formData = new FormData(e.target as HTMLFormElement);
    const initialCash = parseFloat(formData.get('initial_cash') as string);
    const notes = (formData.get('notes') as string) || '';

    // If operator has a PIN, we must verify it
    if (activeOperator?.pin && !pinAction) {
      setPinAction({ type: 'open', data: { initialCash, notes } });
      setPinInput('');
      setPinError(false);
      setShowPinModal(true);
      return;
    }

    // Check tolerance if branch has opening time
    const branchSnap = await getDoc(doc(db, 'branches', user.branch_id));
    const branchData = branchSnap.data() as Branch;
    
    if (branchData?.opening_time && !isWithinTolerance(branchData.opening_time)) {
      if (!confirm(`Estás abriendo el turno fuera del margen de tolerancia (${shiftTolerance}m). ¿Deseas continuar?`)) {
        return;
      }
    }

    await performOpenShift(initialCash, notes);
  };

  const performCloseShift = async (realCash: number, notes: string) => {
    if (!shift || !user) return;
    try {
      // Fetch all sales and movements for this shift to generate summary
      const salesSnap = await getDocs(query(collection(db, 'sales'), where('shift_id', '==', shift.id)));
      const movementsSnap = await getDocs(query(collection(db, 'cash_movements'), where('shift_id', '==', shift.id)));

      const sales = salesSnap.docs.map(doc => doc.data());
      const movements = movementsSnap.docs.map(doc => doc.data());

      const completedSales = sales.filter(s => s.status !== 'refunded');
      const cashSales = completedSales.filter(s => s.payment_type === 'Efectivo').reduce((acc, s) => acc + s.total, 0);
      const cardSales = completedSales.filter(s => s.payment_type === 'Tarjeta').reduce((acc, s) => acc + s.total, 0);
      const qrSales = completedSales.filter(s => s.payment_type === 'Transferencia' || s.payment_type === 'QR').reduce((acc, s) => acc + s.total, 0);
      const netSales = completedSales.reduce((acc, s) => acc + s.total, 0);
      
      const totalRefunds = sales.filter(s => s.status === 'refunded').reduce((acc, s) => acc + s.total, 0);
      const refundsCash = sales.filter(s => s.status === 'refunded' && s.payment_type === 'Efectivo').reduce((acc, s) => acc + s.total, 0);
      const grossSales = netSales + totalRefunds;
      
      const totalIncome = movements.filter(m => m.type === 'income').reduce((acc, m) => acc + m.amount, 0);
      const totalExpense = movements.filter(m => m.type === 'expense').reduce((acc, m) => acc + m.amount, 0);
      
      const theoreticalCash = shift.initial_cash + cashSales + totalIncome - totalExpense - refundsCash;
      const endTime = new Date().toISOString();

      const summary = {
        shift_id: shift.id,
        user_name: activeOperator?.name || user.name,
        start_time: shift.start_time,
        end_time: endTime,
        initial_cash: shift.initial_cash,
        cash_sales: cashSales,
        card_sales: cardSales,
        qr_sales: qrSales,
        net_sales: netSales,
        gross_sales: grossSales,
        total_refunds: totalRefunds,
        refunds_cash: refundsCash,
        total_income: totalIncome,
        total_expense: totalExpense,
        movements_net: totalIncome - totalExpense,
        theoretical_cash: theoreticalCash,
        real_cash: realCash,
        difference: realCash - theoreticalCash,
        taxes: 0,
        discounts: 0
      };

      await updateDoc(doc(db, 'shifts', shift.id), {
        end_time: serverTimestamp(),
        real_cash: realCash,
        expected_cash: theoreticalCash,
        status: 'closed',
        notes: notes
      });

      setShowShiftModal(false);
      setShowShiftSummary(summary);
      setPinAction(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shifts/${shift.id}`);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift || !user) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const realCash = parseFloat(formData.get('real_cash') as string);
    const notes = (formData.get('notes') as string) || '';

    // If operator has a PIN, we must verify it
    if (activeOperator?.pin && !pinAction) {
      setPinAction({ type: 'close', data: { realCash, notes } });
      setPinInput('');
      setPinError(false);
      setShowPinModal(true);
      return;
    }

    // Check tolerance if branch has closing time
    const branchSnap = await getDoc(doc(db, 'branches', user.branch_id));
    const branchData = branchSnap.data() as Branch;
    
    if (branchData?.closing_time && !isWithinTolerance(branchData.closing_time)) {
      if (!confirm(`Estás cerrando el turno fuera del margen de tolerancia (${shiftTolerance}m). ¿Deseas continuar?`)) {
        return;
      }
    }

    await performCloseShift(realCash, notes);
  };

  const verifyPin = async () => {
    if (!activeOperator || !activeOperator.pin || !pinAction) {
      console.log('verifyPin aborted:', { activeOperator: !!activeOperator, hasPin: !!activeOperator?.pin, pinAction: !!pinAction });
      return;
    }
    
    console.log('Verifying shift PIN for operator:', activeOperator.name);
    console.log('Stored PIN hash:', activeOperator.pin);
    console.log('Entered PIN:', pinInput);

    try {
      const isMatch = await bcrypt.compare(pinInput, activeOperator.pin);
      console.log('PIN Match result:', isMatch);
      
      if (isMatch) {
        setShowPinModal(false);
        if (pinAction.type === 'open') {
          await performOpenShift(pinAction.data.initialCash, pinAction.data.notes);
        } else if (pinAction.type === 'close') {
          await performCloseShift(pinAction.data.realCash, pinAction.data.notes);
        }
      } else {
        setPinError(true);
        setPinInput('');
      }
    } catch (err) {
      console.error('Error verifying PIN:', err);
      setPinError(true);
    }
  };

  const verifyOperatorPin = async () => {
    if (!selectedUserForPin) return;
    
    console.log('Verifying operator PIN for:', selectedUserForPin.name);
    console.log('Stored PIN hash:', selectedUserForPin.pin);
    console.log('Entered PIN:', operatorPinInput);

    try {
      const isMatch = await bcrypt.compare(operatorPinInput, selectedUserForPin.pin || '');
      console.log('PIN Match result:', isMatch);
      if (isMatch) {
        setActiveOperator(selectedUserForPin);
        setSelectedUserForPin(null);
        setOperatorPinInput('');
        setOperatorPinError(false);
      } else {
        setOperatorPinError(true);
        setOperatorPinInput('');
      }
    } catch (err) {
      console.error('Error verifying operator PIN:', err);
      setOperatorPinError(true);
    }
  };

  useEffect(() => {
    const preload = async () => {
      if (!user || user.role !== 'owner') return;
      
      try {
        const productsSnap = await getDocs(query(collection(db, 'products'), limit(1)));
        if (!productsSnap.empty) return;

        console.log('Preloading articles...');
        
        // 1. Create Categories
        const categories = ['INSUMOS', 'PANCHOS', 'BEBIDAS'];
        for (const cat of categories) {
          const catQuery = query(collection(db, 'categories'), where('name', '==', cat));
          const catSnap = await getDocs(catQuery);
          if (catSnap.empty) {
            await addDoc(collection(db, 'categories'), { name: cat });
          }
        }

        // 2. Create Simple Products
        const simpleProducts = [
          { name: 'PAN CHICO', category: 'INSUMOS', sku: 'PAN-CH', cost: 100, price: 0, is_composite: false },
          { name: 'PAN GRANDE', category: 'INSUMOS', sku: 'PAN-GR', cost: 150, price: 0, is_composite: false },
          { name: 'SALCHICHA CHICA', category: 'INSUMOS', sku: 'SAL-CH', cost: 120, price: 0, is_composite: false },
          { name: 'SALCHICHA GRANDE', category: 'INSUMOS', sku: 'SAL-GR', cost: 180, price: 0, is_composite: false },
          { name: 'LATA COCA', category: 'BEBIDAS', sku: 'COCA-LATA', cost: 400, price: 1200, is_composite: false },
          { name: 'LATA COCA S/AZUCAR', category: 'BEBIDAS', sku: 'COCA-ZERO', cost: 400, price: 1200, is_composite: false },
          { name: 'LATA FANTA', category: 'BEBIDAS', sku: 'FANTA-LATA', cost: 400, price: 1200, is_composite: false },
          { name: 'LATA SPRITE', category: 'BEBIDAS', sku: 'SPRITE-LATA', cost: 400, price: 1200, is_composite: false },
          { name: 'AGUA', category: 'BEBIDAS', sku: 'AGUA-500', cost: 300, price: 1000, is_composite: false },
          { name: 'AGUA C/GAS', category: 'BEBIDAS', sku: 'AGUA-GAS', cost: 300, price: 1000, is_composite: false },
          { name: 'CERVEZA SANTA FE', category: 'BEBIDAS', sku: 'CERV-SF', cost: 600, price: 1800, is_composite: false },
        ];

        const productIds: { [sku: string]: string } = {};
        for (const p of simpleProducts) {
          const pRef = await addDoc(collection(db, 'products'), p);
          productIds[p.sku] = pRef.id;
          
          if (user.branch_id) {
            await setDoc(doc(db, 'branches', user.branch_id, 'stock', pRef.id), {
              quantity: 100,
              lastUpdated: serverTimestamp()
            });
          }
        }

        // 3. Create Composite Products
        const compositeProducts = [
          { 
            name: 'SUPER PANCHO', 
            category: 'PANCHOS', 
            sku: 'SUP-PAN', 
            cost: 330, 
            price: 800, 
            is_composite: true, 
            components: [
              { id: productIds['PAN-GR'], quantity: 1, type: 'product' },
              { id: productIds['SAL-GR'], quantity: 1, type: 'product' }
            ]
          },
          { 
            name: 'PERRITO', 
            category: 'PANCHOS', 
            sku: 'PERRITO', 
            cost: 220, 
            price: 600, 
            is_composite: true, 
            components: [
              { id: productIds['PAN-CH'], quantity: 1, type: 'product' },
              { id: productIds['SAL-CH'], quantity: 1, type: 'product' }
            ]
          },
          { 
            name: 'PROMO 1/2 dia', 
            category: 'PANCHOS', 
            sku: 'PROMO-12', 
            cost: 730, 
            price: 2500, 
            is_composite: true, 
            components: [
              { id: productIds['PAN-GR'], quantity: 1, type: 'product' },
              { id: productIds['SAL-GR'], quantity: 1, type: 'product' },
              { id: 'BEBIDAS', quantity: 1, type: 'category' }
            ]
          }
        ];

        for (const p of compositeProducts) {
          await addDoc(collection(db, 'products'), p);
        }
      } catch (err) {
        console.error('Error preloading articles:', err);
      }
    };

    preload();
  }, [user]);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Google login error:', err);
      if (err.code === 'auth/unauthorized-domain') {
        alert('Este dominio no está autorizado para el inicio de sesión con Google. Por favor, añádalo en la consola de Firebase.');
      } else {
        alert('Error al iniciar sesión con Google: ' + err.message);
      }
    }
  };

  const handleEmailPasswordLogin = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      console.error('Email login error:', err);
      throw err;
    }
  };

  const handleRegister = async (email: string, pass: string) => {
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, pass);
      await sendEmailVerification(userCred.user);
      
      // Create initial document with 'vendedor' role by default
      // This will be overwritten by 'owner' if it's the first user in onAuthStateChanged
      const hashedPin = await bcrypt.hash('1234', 10);
      await setDoc(doc(db, 'empleados', userCred.user.uid), {
        name: email.split('@')[0],
        email: email,
        role: 'seller',
        branch_id: 'default',
        pin: hashedPin,
        created_at: serverTimestamp()
      });

      alert('Se ha enviado un correo de verificación. Por favor, revise su bandeja de entrada.');
    } catch (err: any) {
      console.error('Registration error:', err);
      throw err;
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    setUser(null);
  };

  if (loading) return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-yellow"></div>
    </div>
  );

  if (!user) {
    return (
      <LoginScreen 
        onGoogleLogin={handleGoogleLogin} 
        onEmailPasswordLogin={handleEmailPasswordLogin}
        onRegister={handleRegister}
        isFirstUser={isFirstUser} 
      />
    );
  }

  return (
    <AppContext.Provider value={{ 
      user, setUser, 
      allUsers,
      branch, setBranch, 
      shift, setShift, 
      onOpenCloseShift: () => setShowShiftModal(true),
      printerSettings, setPrinterSettings,
      ticketSettings, setTicketSettings,
      shiftTolerance, setShiftTolerance,
      activeOperator, setActiveOperator
    }}>
      <div className="flex h-screen bg-stone-200 font-sans text-stone-900 overflow-hidden items-center justify-center p-0 sm:p-2 md:p-4">
        <div className="w-full max-w-[800px] landscape:max-w-[1280px] h-full landscape:max-h-[800px] bg-stone-100 flex overflow-hidden shadow-2xl sm:rounded-[32px] relative border border-stone-300/50">
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            user={user} 
            onLogout={handleLogout}
            onOpenCloseShift={() => setShowShiftModal(true)}
            hasShift={!!shift}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            rolePermissions={rolePermissions}
          />
        
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-16 bg-white border-b border-stone-200 flex items-center justify-between px-6 lg:hidden">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-stone-500">
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-yellow rounded-lg flex items-center justify-center">
                <Store size={18} className="text-stone-900" />
              </div>
              <span className="font-bold">Panchería POS</span>
            </div>
            <div className="w-10" />
          </header>

          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div 
                key={activeTab} 
                initial={{ opacity: 0, x: 10 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -10 }} 
                className="h-full"
              >
                {activeTab === 'ventas' && <VentasModule />}
                {activeTab === 'inventory' && (
                  <ErrorBoundary>
                    <Inventory />
                  </ErrorBoundary>
                )}
                {activeTab === 'customers' && (
                  <ErrorBoundary>
                    <Customers />
                  </ErrorBoundary>
                )}
                {activeTab === 'stats' && (
                  <ErrorBoundary>
                    <Dashboard />
                  </ErrorBoundary>
                )}
                {activeTab === 'staff' && (
                  <ErrorBoundary>
                    <Staff rolePermissions={rolePermissions} />
                  </ErrorBoundary>
                )}
                {activeTab === 'settings' && (
                  <ErrorBoundary>
                    <SettingsModule />
                  </ErrorBoundary>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Shift Summary Modal */}
        <AnimatePresence>
          {showShiftSummary && (
            <ShiftSummaryModal 
              summary={showShiftSummary} 
              onClose={() => {
                setShowShiftSummary(null);
                handleLogout();
              }} 
            />
          )}
        </AnimatePresence>

        {/* Shift Modal */}
        <AnimatePresence>
          {showShiftModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowShiftModal(false)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden">
                <form onSubmit={shift ? handleCloseShift : handleOpenShift} className="p-8">
                  <h2 className="text-2xl font-black mb-6">{shift ? 'Cerrar Turno' : 'Abrir Turno'}</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-400 uppercase mb-2">
                        {shift ? 'Efectivo Real en Caja' : 'Efectivo Inicial en Caja'}
                      </label>
                      <input 
                        name={shift ? 'real_cash' : 'initial_cash'} 
                        type="number" 
                        step="0.01" 
                        className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red" 
                        required 
                      />
                    </div>
                    {shift && (
                      <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                        <p className="text-xs text-stone-400 uppercase font-bold mb-1">Efectivo Esperado</p>
                        <p className="text-xl font-black text-stone-900">${shift.expected_cash}</p>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Notas</label>
                      <textarea name="notes" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red resize-none h-24" />
                    </div>
                  </div>
                  <div className="flex gap-4 mt-8">
                    <button type="button" onClick={() => setShowShiftModal(false)} className="flex-1 py-4 font-bold text-stone-500 hover:bg-stone-100 rounded-2xl">Cancelar</button>
                    <button type="submit" className="flex-[2] py-4 bg-brand-yellow text-stone-900 font-bold rounded-2xl shadow-lg shadow-brand-yellow/20">
                      {shift ? 'Cerrar Turno' : 'Abrir Turno'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* Operator Selector Modal */}
        <AnimatePresence>
          {(!activeOperator && user) && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900">
              <div className="w-full max-w-4xl">
                <div className="text-center mb-12">
                  <h1 className="text-4xl font-black text-white mb-4 uppercase tracking-tighter">Panchería POS</h1>
                  <p className="text-stone-400 font-bold uppercase tracking-widest text-sm">Selecciona tu usuario para operar</p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {(allUsers || []).map(u => (
                    <motion.button
                      key={u.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (!u.pin) {
                          setActiveOperator(u);
                        } else {
                          setSelectedUserForPin(u);
                        }
                      }}
                      className="aspect-square bg-stone-800 rounded-[40px] flex flex-col items-center justify-center p-6 transition-colors hover:bg-brand-red group"
                    >
                      <div className="w-20 h-20 bg-stone-700 rounded-full flex items-center justify-center mb-4 group-hover:bg-white/20">
                        <UserCircle className="w-12 h-12 text-stone-400 group-hover:text-white" />
                      </div>
                      <span className="text-white font-black uppercase tracking-tight text-center">{u.name}</span>
                      <span className="text-stone-500 text-xs font-bold uppercase mt-1 group-hover:text-white/60">{u.role}</span>
                    </motion.button>
                  ))}
                </div>

                <div className="mt-12 text-center">
                  <button onClick={handleLogout} className="text-stone-500 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors">Cerrar Sesión Maestra</button>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Operator PIN Modal */}
        <AnimatePresence>
          {selectedUserForPin && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedUserForPin(null)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-xs bg-white rounded-[40px] shadow-2xl p-8 text-center">
                <div className="w-16 h-16 bg-brand-red/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Lock className="w-8 h-8 text-brand-red" />
                </div>
                <h2 className="text-2xl font-black mb-1 uppercase tracking-tighter">Hola, {selectedUserForPin.name}</h2>
                <p className="text-stone-500 text-sm mb-6 font-bold uppercase tracking-widest">Ingresa tu PIN</p>
                
                <input 
                  type="password" 
                  value={operatorPinInput}
                  onChange={(e) => {
                    setOperatorPinInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setOperatorPinError(false);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && verifyOperatorPin()}
                  className={`w-full text-center text-3xl tracking-[1em] font-black py-4 bg-stone-50 rounded-2xl border-2 transition-all ${operatorPinError ? 'border-brand-red bg-brand-red/5' : 'border-transparent focus:border-brand-red'}`}
                  placeholder="••••"
                  autoFocus
                />
                
                {operatorPinError && (
                  <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-brand-red text-xs font-bold uppercase tracking-wider mt-4">PIN Incorrecto</motion.p>
                )}

                <div className="grid grid-cols-2 gap-3 mt-8">
                  <button onClick={() => setSelectedUserForPin(null)} className="py-4 font-bold text-stone-500 hover:bg-stone-100 rounded-2xl transition-colors uppercase text-xs">Atrás</button>
                  <button onClick={verifyOperatorPin} disabled={operatorPinInput.length < 4} className="py-4 bg-brand-red text-white font-bold rounded-2xl shadow-lg shadow-brand-red/20 disabled:opacity-50 transition-all uppercase text-xs">Entrar</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* PIN Verification Modal */}
        <AnimatePresence>
          {showPinModal && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPinModal(false)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-xs bg-white rounded-[40px] shadow-2xl overflow-hidden">
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-brand-red/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Lock className="w-8 h-8 text-brand-red" />
                  </div>
                  <h2 className="text-2xl font-black mb-2">Verificar PIN</h2>
                  <p className="text-stone-500 text-sm mb-6">Ingresa tu código de seguridad para confirmar {pinAction?.type === 'open' ? 'la apertura' : 'el cierre'} de turno.</p>
                  
                  <div className="space-y-4">
                    <input 
                      type="password" 
                      value={pinInput}
                      onChange={(e) => {
                        setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                        setPinError(false);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && verifyPin()}
                      className={`w-full text-center text-3xl tracking-[1em] font-black py-4 bg-stone-50 rounded-2xl border-2 transition-all ${pinError ? 'border-brand-red bg-brand-red/5' : 'border-transparent focus:border-brand-red'}`}
                      placeholder="••••"
                      autoFocus
                    />
                    
                    {pinError && (
                      <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-brand-red text-xs font-bold uppercase tracking-wider">PIN Incorrecto</motion.p>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-4">
                      <button onClick={() => setShowPinModal(false)} className="py-4 font-bold text-stone-500 hover:bg-stone-100 rounded-2xl transition-colors">Cancelar</button>
                      <button onClick={verifyPin} disabled={pinInput.length < 4} className="py-4 bg-brand-red text-white font-bold rounded-2xl shadow-lg shadow-brand-red/20 disabled:opacity-50 transition-all">Verificar</button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </AppContext.Provider>
  );
}
