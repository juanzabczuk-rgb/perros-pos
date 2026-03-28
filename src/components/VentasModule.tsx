import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  limit, 
  doc, 
  runTransaction, 
  getDocs, 
  serverTimestamp, 
  addDoc,
  DocumentReference
} from 'firebase/firestore';
import { 
  Search, 
  ShoppingCart, 
  X, 
  Package, 
  Banknote, 
  History, 
  PlusCircle, 
  MinusCircle, 
  LogOut, 
  RotateCcw, 
  UserCircle, 
  Minus, 
  Plus, 
  Trash2, 
  ChevronRight, 
  CreditCard, 
  QrCode, 
  Check 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import { handleFirestoreError, OperationType, calcularTotal } from '../lib/firestoreUtils';
import { Product, CartItem, Customer, Branch, CashMovement } from '../types';

export const VentasModule = () => {
  const { user, shift, ticketSettings, onOpenCloseShift } = useApp();
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
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [showMovementModal, setShowMovementModal] = useState<'income' | 'expense' | null>(null);
  const [selectingForProduct, setSelectingForProduct] = useState<{ product: Product, componentIndex: number, selections: { [key: string]: string } } | null>(null);
  const [confirmingRefund, setConfirmingRefund] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<any | null>(null);
  const [searchHistory, setSearchHistory] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerType, setCustomerType] = useState<'final' | 'client'>('final');

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
    if (!user) return;
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (err) => {
      if (err.code === 'permission-denied') return;
      handleFirestoreError(err, OperationType.LIST, 'products');
    });

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (err) => {
      if (err.code === 'permission-denied') return;
      handleFirestoreError(err, OperationType.LIST, 'customers');
    });

    return () => {
      unsubProducts();
      unsubCustomers();
    };
  }, [user]);

  useEffect(() => {
    if (!user?.branch_id) return;
    const q = query(
      collection(db, 'sales'),
      where('branch_id', '==', user.branch_id),
      limit(100)
    );
    const unsubHistory = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      docs.sort((a, b) => {
        const dateA = a.created_at?.seconds || 0;
        const dateB = b.created_at?.seconds || 0;
        return dateB - dateA;
      });
      setSalesHistory(docs.slice(0, 50));
    }, (err) => {
      if (err.code === 'permission-denied') return;
      handleFirestoreError(err, OperationType.LIST, 'sales');
    });
    return () => unsubHistory();
  }, [user?.branch_id]);

  useEffect(() => {
    if (!shift?.id) return;
    const q = query(
      collection(db, 'cash_movements'),
      where('shift_id', '==', shift.id)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashMovement));
      docs.sort((a, b) => {
        const dateA = (a.created_at as any)?.seconds || 0;
        const dateB = (b.created_at as any)?.seconds || 0;
        return dateB - dateA;
      });
      setMovements(docs);
    }, (err) => {
      if (err.code === 'permission-denied') return;
      handleFirestoreError(err, OperationType.LIST, 'cash_movements');
    });
    return () => unsub();
  }, [shift?.id]);

  const handleRefund = async (saleId: string) => {
    try {
      await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, 'sales', saleId);
        const saleSnap = await transaction.get(saleRef);
        if (!saleSnap.exists()) throw new Error("Venta no encontrada");
        
        const saleData = saleSnap.data();
        if (saleData.status === 'refunded') throw new Error("Venta ya reembolsada");

        let items = saleData.items || [];
        if (items.length === 0) {
          const itemsSnap = await getDocs(collection(db, `sales/${saleId}/items`));
          items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        if (items.length === 0) throw new Error("No se encontraron artículos en la venta");

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

        const stockSnaps = await Promise.all(stockRefs.map(s => transaction.get(s.ref)));
        
        let customerSnap = null;
        let customerRef = null;
        if (saleData.customer_id) {
          customerRef = doc(db, 'customers', saleData.customer_id);
          customerSnap = await transaction.get(customerRef);
        }

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
        if (selectedCustomer) {
          customerRef = doc(db, 'customers', selectedCustomer.id);
          customerSnap = await transaction.get(customerRef);
        }

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

  const displayProducts = search ? filteredProducts : availableProducts.slice(0, 12);

  const getCartItemKey = (item: CartItem | Product, selections?: { [key: string]: string }) => {
    const s = selections || (item as CartItem).selections || {};
    return `${item.id}-${JSON.stringify(s)}`;
  };

  const addToCart = (product: Product, selections?: { [key: string]: string }) => {
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

  return (
    <div className="flex h-full bg-stone-100 overflow-hidden tablet-landscape-pos">
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

      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight">Ventas</h1>
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
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowMovementModal('income')}
                  className="flex-1 py-4 bg-green-500 text-white font-black rounded-2xl shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <PlusCircle size={18} />
                  Ingreso
                </button>
                <button 
                  onClick={() => setShowMovementModal('expense')}
                  className="flex-1 py-4 bg-red-500 text-white font-black rounded-2xl shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <MinusCircle size={18} />
                  Egreso
                </button>
                <button 
                  onClick={onOpenCloseShift}
                  className="flex-1 py-4 bg-stone-900 text-white font-black rounded-2xl shadow-lg shadow-stone-900/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <LogOut size={18} />
                  Cerrar Turno
                </button>
              </div>

              <div className="bg-white rounded-[40px] shadow-sm border border-stone-100 overflow-hidden">
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

export const ShiftSummaryModal = ({ summary, onClose }: { summary: any, onClose: () => void }) => {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 print:p-0">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
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
              onClick={() => {
                window.print();
                onClose();
              }}
              className="w-full py-5 bg-brand-red text-white font-black rounded-2xl shadow-xl shadow-brand-red/20 uppercase tracking-widest text-lg"
            >
              IMPRIMIR Y SALIR
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
