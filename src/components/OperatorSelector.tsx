import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { UserCircle, Lock } from 'lucide-react';
import { authService } from '../services/authService';
import { User } from '../types';
import { toast } from 'sonner';

export const OperatorSelector = () => {
  const { allUsers, setActiveOperator, setUser } = useApp();
  const [selectedUserForPin, setSelectedUserForPin] = useState<User | null>(null);
  const [operatorPinInput, setOperatorPinInput] = useState('');
  const [operatorPinError, setOperatorPinError] = useState(false);

  const verifyOperatorPin = async () => {
    if (!selectedUserForPin) return;
    
    try {
      const isValid = await authService.verifyPin(selectedUserForPin.id, operatorPinInput);
      if (isValid) {
        toast.success(`Bienvenido, ${selectedUserForPin.name}`);
        setActiveOperator(selectedUserForPin);
        setSelectedUserForPin(null);
        setOperatorPinInput('');
      } else {
        setOperatorPinError(true);
        setOperatorPinInput('');
      }
    } catch (err) {
      console.error("Error verifying PIN:", err);
      setOperatorPinError(true);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
    setActiveOperator(null);
  };

  return (
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
          <button 
            onClick={handleLogout} 
            className="text-stone-500 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors"
          >
            Cerrar Sesión Maestra
          </button>
        </div>

        {/* Operator PIN Modal */}
        <AnimatePresence>
          {selectedUserForPin && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={() => setSelectedUserForPin(null)} 
                className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                exit={{ scale: 0.9, opacity: 0 }} 
                className="relative w-full max-w-xs bg-white rounded-[40px] shadow-2xl p-8 text-center"
              >
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
                  className={`w-full text-center text-3xl tracking-[0.5em] font-black py-4 bg-stone-50 rounded-2xl border-2 transition-all ${operatorPinError ? 'border-brand-red bg-brand-red/5' : 'border-transparent focus:border-brand-red'}`}
                  placeholder="••••"
                  autoFocus
                />
                
                {operatorPinError && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="text-brand-red text-xs font-bold uppercase tracking-wider mt-4"
                  >
                    PIN Incorrecto
                  </motion.p>
                )}

                <div className="grid grid-cols-2 gap-3 mt-8">
                  <button 
                    onClick={() => setSelectedUserForPin(null)} 
                    className="py-4 font-bold text-stone-500 hover:bg-stone-100 rounded-2xl transition-colors uppercase text-xs"
                  >
                    Atrás
                  </button>
                  <button 
                    onClick={verifyOperatorPin} 
                    disabled={operatorPinInput.length < 4} 
                    className="py-4 bg-brand-red text-white font-bold rounded-2xl shadow-lg shadow-brand-red/20 disabled:opacity-50 transition-all uppercase text-xs"
                  >
                    Entrar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
