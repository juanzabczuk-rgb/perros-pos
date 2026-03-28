import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

export const ShiftModal = () => {
  const { shift, setShift, user, showShiftModal, setShowShiftModal } = useApp();

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const initialCash = parseFloat(formData.get('initial_cash') as string);
    const notes = formData.get('notes') as string;

    try {
      const shiftRef = await addDoc(collection(db, 'shifts'), {
        branch_id: user.branch_id,
        user_id: user.id,
        user_name: user.name,
        start_time: serverTimestamp(),
        initial_cash: initialCash,
        expected_cash: initialCash,
        real_cash: 0,
        status: 'open',
        notes: notes
      });
      setShift({ id: shiftRef.id, branch_id: user.branch_id, user_id: user.id, user_name: user.name, initial_cash: initialCash, expected_cash: initialCash, real_cash: 0, status: 'open', notes: notes } as any);
      setShowShiftModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shifts');
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const realCash = parseFloat(formData.get('real_cash') as string);
    const notes = formData.get('notes') as string;

    try {
      await updateDoc(doc(db, 'shifts', shift.id), {
        end_time: serverTimestamp(),
        real_cash: realCash,
        status: 'closed',
        closing_notes: notes
      });
      setShift(null);
      setShowShiftModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shifts/${shift.id}`);
    }
  };

  return (
    <AnimatePresence>
      {showShiftModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => setShowShiftModal(false)} 
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" 
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            exit={{ scale: 0.9, opacity: 0 }} 
            className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden"
          >
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
                  <textarea 
                    name="notes" 
                    className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red resize-none h-24" 
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button 
                  type="button" 
                  onClick={() => setShowShiftModal(false)} 
                  className="flex-1 py-4 font-bold text-stone-500 hover:bg-stone-100 rounded-2xl"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-[2] py-4 bg-brand-yellow text-stone-900 font-bold rounded-2xl shadow-lg shadow-brand-yellow/20"
                >
                  {shift ? 'Cerrar Turno' : 'Abrir Turno'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
