import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc 
} from 'firebase/firestore';
import { 
  Users, 
  PlusCircle, 
  UserCircle, 
  Edit, 
  MessageCircle, 
  Trash2, 
  X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Customer } from '../types';

export const CustomersModule = () => {
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
                        rel="noopener noreferrer"
                        className="p-2 bg-green-50 hover:bg-green-100 rounded-xl text-green-600 transition-all"
                      >
                        <MessageCircle size={14} />
                      </a>
                      <button className="p-2 bg-stone-50 hover:bg-red-50 rounded-xl text-stone-400 hover:text-red-500 transition-all">
                        <Trash2 size={14} />
                      </button>
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
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black text-stone-900">Nuevo Cliente</h2>
                  <button type="button" onClick={() => setShowAdd(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                    <X size={20} className="text-stone-400" />
                  </button>
                </div>
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
