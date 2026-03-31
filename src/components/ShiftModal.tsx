import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Shift, ShiftSummary, Sale, CashMovement } from '../types';
import { Printer, Check } from 'lucide-react';
import { toast } from 'sonner';

export const ShiftModal = () => {
  const { shift, setShift, user, activeOperator, showShiftModal, setShowShiftModal, setActiveOperator } = useApp();
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [realCashInput, setRealCashInput] = useState('');
  const [notesInput, setNotesInput] = useState('');

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = activeOperator || user;
    if (!currentUser) return;
    
    const initialCash = parseFloat(realCashInput) || 0;
    const notes = notesInput;

    try {
      setLoading(true);
      const shiftRef = await addDoc(collection(db, 'shifts'), {
        branch_id: currentUser.branch_id,
        user_id: currentUser.id,
        user_name: currentUser.name,
        start_time: serverTimestamp(),
        initial_cash: initialCash,
        expected_cash: initialCash,
        real_cash: 0,
        status: 'open',
        notes: notes
      });
      setShift({ 
        id: shiftRef.id, 
        branch_id: currentUser.branch_id, 
        user_id: currentUser.id, 
        user_name: currentUser.name, 
        initial_cash: initialCash, 
        expected_cash: initialCash, 
        real_cash: 0, 
        status: 'open', 
        notes: notes,
        start_time: new Date()
      } as Shift);
      setShowShiftModal(false);
      toast.success('Turno abierto correctamente');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shifts');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift || !user) return;
    
    try {
      setLoading(true);
      const realCash = parseFloat(realCashInput) || 0;
      
      // Fetch sales for this shift
      const salesQuery = query(collection(db, 'sales'), where('shift_id', '==', shift.id));
      const salesSnapshot = await getDocs(salesQuery);
      const sales = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
      
      // Fetch movements for this shift
      const movementsQuery = query(collection(db, 'cash_movements'), where('shift_id', '==', shift.id));
      const movementsSnapshot = await getDocs(movementsQuery);
      const movements = movementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashMovement));
      
      const completedSales = sales.filter(s => s.status === 'completed');
      const refundedSales = sales.filter(s => s.status === 'refunded');
      
      const grossSales = completedSales.reduce((acc, s) => acc + (s.total || 0) + (s.discount || 0), 0);
      const totalRefunds = refundedSales.reduce((acc, s) => acc + (s.total || 0), 0);
      const totalDiscounts = completedSales.reduce((acc, s) => acc + (s.discount || 0), 0);
      const netSales = grossSales - totalDiscounts - totalRefunds;
      
      const cashSales = completedSales.filter(s => s.payment_type === 'Efectivo').reduce((acc, s) => acc + (s.total || 0), 0);
      const cardSales = completedSales.filter(s => s.payment_type === 'Tarjeta').reduce((acc, s) => acc + (s.total || 0), 0);
      const qrSales = completedSales.filter(s => s.payment_type === 'QR').reduce((acc, s) => acc + (s.total || 0), 0);
      const refundsCash = refundedSales.filter(s => s.payment_type === 'Efectivo').reduce((acc, s) => acc + (s.total || 0), 0);
      
      const totalIncome = movements.filter(m => m.type === 'income').reduce((acc, m) => acc + m.amount, 0);
      const totalExpense = movements.filter(m => m.type === 'expense').reduce((acc, m) => acc + m.amount, 0);
      const movementsNet = totalIncome - totalExpense;
      
      const theoreticalCash = (shift.initial_cash || 0) + cashSales - refundsCash + movementsNet;
      
      const shiftSummary: ShiftSummary = {
        shift_id: shift.id,
        user_name: shift.user_name,
        start_time: shift.start_time instanceof Date ? shift.start_time.toISOString() : (shift.start_time as { toDate?: () => Date }).toDate?.().toISOString() || new Date().toISOString(),
        end_time: new Date().toISOString(),
        initial_cash: shift.initial_cash || 0,
        cash_sales: cashSales,
        refunds_cash: refundsCash,
        movements_net: movementsNet,
        theoretical_cash: theoreticalCash,
        real_cash: realCash,
        difference: realCash - theoreticalCash,
        gross_sales: grossSales,
        total_refunds: totalRefunds,
        discounts: totalDiscounts,
        net_sales: netSales,
        card_sales: cardSales,
        qr_sales: qrSales,
        taxes: 0 // Placeholder
      };
      
      setSummary(shiftSummary);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'summary_calculation');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeClose = async () => {
    if (!shift || !summary) return;
    
    try {
      setLoading(true);
      await updateDoc(doc(db, 'shifts', shift.id), {
        end_time: serverTimestamp(),
        real_cash: summary.real_cash,
        status: 'closed',
        closing_notes: notesInput,
        summary: summary // Save summary in DB too
      });
      
      // Clear states and logout operator
      setShift(null);
      setSummary(null);
      setShowShiftModal(false);
      setActiveOperator(null);
      setRealCashInput('');
      setNotesInput('');
      toast.success('Turno cerrado correctamente');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shifts/${shift.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {showShiftModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 print:p-0">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => {
              if (!shift && !loading) return; // Prevent closing if no shift
              if (!loading && !summary) {
                setShowShiftModal(false);
              }
            }} 
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm print:hidden" 
          />
          
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            exit={{ scale: 0.9, opacity: 0 }} 
            className={`relative w-full ${summary ? 'max-w-2xl' : 'max-w-md'} bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:shadow-none print:rounded-none print:max-w-none print:w-full`}
          >
            {summary ? (
              <div className="p-8 print:p-4 overflow-y-auto noscrollbar">
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
                        <span className="font-black text-stone-900">{summary.start_time ? new Date(summary.start_time).toLocaleString() : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-stone-500 font-bold">Cierre de turno</span>
                        <span className="font-black text-stone-900">{summary.end_time ? new Date(summary.end_time).toLocaleString() : 'N/A'}</span>
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
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-12 print:hidden">
                  <button 
                    onClick={() => {
                      window.print();
                      handleFinalizeClose();
                    }}
                    disabled={loading}
                    className="w-full py-5 bg-stone-900 text-white font-black rounded-3xl shadow-xl shadow-stone-900/20 flex items-center justify-center gap-2 hover:bg-stone-800 transition-all uppercase tracking-widest text-xs"
                  >
                    <Printer size={18} />
                    Imprimir y Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={shift ? handleCalculateSummary : handleOpenShift} className="p-8">
                <h2 className="text-2xl font-black mb-6 uppercase tracking-tight">{shift ? 'Cerrar Turno' : 'Abrir Turno'}</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">
                      {shift ? 'Efectivo Real en Caja' : 'Efectivo Inicial en Caja'}
                    </label>
                    <input 
                      name="initial_cash"
                      value={realCashInput}
                      onChange={(e) => setRealCashInput(e.target.value)}
                      type="number" 
                      step="0.01" 
                      className="w-full px-4 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-bold text-lg" 
                      required 
                      placeholder="0.00"
                    />
                  </div>
                  {shift && (
                    <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                      <p className="text-[10px] text-stone-400 uppercase font-black tracking-widest mb-1">Efectivo Esperado (Teórico)</p>
                      <p className="text-2xl font-black text-stone-900">${(shift.expected_cash || 0).toLocaleString()}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">Notas</label>
                    <textarea 
                      value={notesInput}
                      onChange={(e) => setNotesInput(e.target.value)}
                      className="w-full px-4 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red resize-none h-24 font-medium" 
                      placeholder="Alguna observación..."
                    />
                  </div>
                </div>
                <div className="flex gap-4 mt-8">
                  <button 
                    type="button" 
                    onClick={() => setShowShiftModal(false)} 
                    disabled={loading}
                    className="flex-1 py-4 font-black text-stone-500 hover:bg-stone-100 rounded-2xl uppercase tracking-widest text-xs transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="flex-[2] py-4 bg-brand-yellow text-stone-900 font-black rounded-2xl shadow-lg shadow-brand-yellow/20 uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-stone-900 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        {shift ? 'Ver Resumen' : 'Abrir Turno'}
                        <Check size={18} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
