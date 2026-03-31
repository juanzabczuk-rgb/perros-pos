import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { 
  Users, 
  PlusCircle, 
  Shield, 
  Mail, 
  MapPin, 
  Trash2, 
  X, 
  Clock, 
  Calendar, 
  DollarSign, 
  TrendingUp,
  UserCircle,
  Settings,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { User, Branch, Shift } from '../types';

export const StaffModule = () => {
  const { user, rolePermissions } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userShifts, setUserShifts] = useState<Shift[]>([]);
  const [showShifts, setShowShifts] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  
  // Shift History Filters
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    let unsubUsers: (() => void) | undefined;
    let unsubBranches: (() => void) | undefined;

    if (user && (user.role === 'owner' || user.role === 'admin')) {
      unsubUsers = onSnapshot(collection(db, 'empleados'), (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
      }, (err) => {
        if (err.code === 'permission-denied') return;
        handleFirestoreError(err, OperationType.LIST, 'empleados');
      });

      unsubBranches = onSnapshot(collection(db, 'branches'), (snapshot) => {
        setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
      }, (err) => {
        if (err.code === 'permission-denied') return;
        handleFirestoreError(err, OperationType.LIST, 'branches');
      });
    }

    return () => {
      unsubUsers?.();
      unsubBranches?.();
    };
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    const pin = formData.get('pin') as string;

    try {
      const branchName = branches.find(b => b.id === data.branch_id)?.name || 'Sucursal';
      const email = data.email as string;
      const userId = email || `pin_${Date.now()}`;
      
      if (editingUser) {
        const updateData: Partial<User> & { pin?: string } = {
          name: data.name as string,
          role: data.role as User['role'],
          branch_id: data.branch_id as string,
          branch_name: branchName
        };
        
        if (email) updateData.email = email;
        
        // Only update PIN if a new one was entered
        if (pin && pin.length >= 4) {
          updateData.pin = pin;
        }
        
        await updateDoc(doc(db, 'empleados', editingUser.id), updateData);
        toast.success('Empleado actualizado correctamente');
        setEditingUser(null);
      } else {
        const newUser: User & { pin: string } = {
          id: userId,
          name: data.name as string,
          role: data.role as User['role'],
          branch_id: data.branch_id as string,
          email: email,
          pin: pin || '',
          branch_name: branchName
        };
        if (!newUser.email) delete (newUser as { email?: string }).email;

        await setDoc(doc(db, 'empleados', userId), newUser);
        toast.success('Empleado creado correctamente');
      }
      setShowAdd(false);
    } catch (err) {
      console.error('Error saving user:', err);
      handleFirestoreError(err, editingUser ? OperationType.UPDATE : OperationType.CREATE, 'empleados');
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      await deleteDoc(doc(db, 'empleados', deletingUser.id));
      toast.success('Empleado eliminado');
      setDeletingUser(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `empleados/${deletingUser.id}`);
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
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shift));
    // Sort in memory
    docs.sort((a, b) => {
      const dateA = (a.start_time as { seconds?: number })?.seconds || 0;
      const dateB = (b.start_time as { seconds?: number })?.seconds || 0;
      return dateB - dateA;
    });
    setUserShifts(docs);
    setShowShifts(true);
  };

  const filteredShifts = (userShifts || []).filter(s => {
    if (!s.start_time) return false;
    try {
      const date = s.start_time.toDate ? s.start_time.toDate() : new Date(s.start_time);
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    } catch {
      return false;
    }
  });

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto noscrollbar">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight">Personal</h1>
          <p className="text-stone-500 font-medium">Gestión de empleados, roles y turnos</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowRoles(true)}
            className="bg-white text-stone-600 px-6 py-3 rounded-2xl border border-stone-200 font-black flex items-center gap-2 hover:bg-stone-50 transition-all uppercase tracking-widest text-xs"
          >
            <Shield size={18} />
            Roles y Permisos
          </button>
          <button 
            onClick={() => setShowAdd(true)}
            className="bg-brand-red text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-brand-red/20 uppercase tracking-widest text-xs"
          >
            <PlusCircle size={18} />
            Agregar Empleado
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map(u => (
          <motion.div 
            key={u.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 rounded-[40px] shadow-sm border border-stone-200 hover:shadow-xl hover:shadow-stone-200/50 transition-all group"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-stone-100 rounded-[24px] flex items-center justify-center overflow-hidden">
                  {u.photoURL ? (
                    <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Users size={24} className="text-stone-300" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-black text-stone-900">{u.name}</h3>
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                    u.role === 'owner' ? 'bg-purple-100 text-purple-600' :
                    u.role === 'admin' ? 'bg-blue-100 text-blue-600' :
                    'bg-green-100 text-green-600'
                  }`}>
                    {u.role}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-sm text-stone-500 font-medium">
                <Mail size={14} className="text-stone-300" />
                {u.email || 'Sin email (Solo PIN)'}
              </div>
              <div className="flex items-center gap-3 text-sm text-stone-500 font-medium">
                <MapPin size={14} className="text-stone-300" />
                {u.branch_name || 'Sin sucursal'}
              </div>
              <div className="flex items-center gap-3 text-sm text-stone-500 font-medium">
                <Clock size={14} className="text-stone-300" />
                PIN: <span className="text-stone-900 font-black">{u.pin || 'No configurado'}</span>
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
                onClick={() => setDeletingUser(u)}
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowAdd(false); setEditingUser(null); }} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden border border-stone-200">
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
                      <input name="pin" type="text" inputMode="numeric" maxLength={6} defaultValue={editingUser?.pin} className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red" placeholder={editingUser ? "Dejar vacío para no cambiar" : "1234"} />
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRoles(false)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-stone-200">
              <div className="p-8 border-b border-stone-200 flex items-center justify-between">
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
                  const currentPerms = (rolePermissions || []).find(rp => rp.id === roleId)?.modules || [];
                  const modules = [
                    { id: 'ventas', label: 'Ventas', icon: DollarSign },
                    { id: 'inventory', label: 'Stock', icon: Package },
                    { id: 'customers', label: 'Clientes', icon: Users },
                    { id: 'dashboard', label: 'Estadísticas', icon: TrendingUp },
                    { id: 'staff', label: 'Personal', icon: UserCircle },
                    { id: 'settings', label: 'Ajustes', icon: Settings },
                  ];

                  return (
                    <div key={roleId} className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Shield size={18} className="text-brand-red" />
                        <h3 className="text-lg font-black text-stone-900 uppercase tracking-tight">Rol: {roleId}</h3>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {modules.map(mod => {
                          const isEnabled = currentPerms.includes(mod.id);
                          return (
                            <button
                              key={mod.id}
                              onClick={() => {
                                const newModules = isEnabled 
                                  ? currentPerms.filter(m => m !== mod.id)
                                  : [...currentPerms, mod.id];
                                handleUpdateRolePermissions(roleId, newModules);
                              }}
                              className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                                isEnabled 
                                  ? 'bg-stone-900 border-stone-900 text-white shadow-lg shadow-stone-900/20' 
                                  : 'bg-white border-stone-200 text-stone-400 hover:border-stone-300'
                              }`}
                            >
                              <mod.icon size={18} />
                              <span className="text-xs font-black uppercase tracking-widest">{mod.label}</span>
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowShifts(false)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-stone-200">
              <div className="p-8 border-b border-stone-200 flex items-center justify-between bg-stone-50">
                <div>
                  <h2 className="text-2xl font-black text-stone-900">Historial de Turnos</h2>
                  <p className="text-stone-500 font-medium">Empleado: <span className="text-stone-900 font-black">{selectedUser.name}</span></p>
                </div>
                <button onClick={() => setShowShifts(false)} className="p-3 hover:bg-white rounded-2xl transition-colors text-stone-400">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 border-b border-stone-200 bg-white flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-stone-400" />
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-stone-50 border-none rounded-xl px-4 py-2 text-sm font-bold"
                  />
                  <span className="text-stone-300">al</span>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-stone-50 border-none rounded-xl px-4 py-2 text-sm font-bold"
                  />
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Total Horas</p>
                    <p className="text-lg font-black text-stone-900">
                      {filteredShifts.reduce((acc, s) => {
                        if (!s.start_time || !s.end_time) return acc;
                        const start = s.start_time.toDate ? s.start_time.toDate() : new Date(s.start_time);
                        const end = s.end_time.toDate ? s.end_time.toDate() : new Date(s.end_time);
                        return acc + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                      }, 0).toFixed(1)}h
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Total Ventas</p>
                    <p className="text-lg font-black text-brand-red">
                      ${filteredShifts.reduce((acc, s) => acc + (s.total_sales || 0), 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 noscrollbar bg-stone-50/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredShifts.length === 0 ? (
                    <div className="col-span-full py-20 text-center">
                      <Clock size={48} className="mx-auto text-stone-200 mb-4" />
                      <p className="text-stone-400 font-bold uppercase tracking-widest">No hay turnos en este período</p>
                    </div>
                  ) : (
                    filteredShifts.map((s, idx) => {
                      const start = s.start_time.toDate ? s.start_time.toDate() : new Date(s.start_time);
                      const end = s.end_time?.toDate ? s.end_time.toDate() : (s.end_time ? new Date(s.end_time) : null);
                      const actualEnd = end;
                      const duration = actualEnd ? (actualEnd.getTime() - start.getTime()) / (1000 * 60 * 60) : 0;

                      return (
                        <div key={idx} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center">
                                <Calendar size={18} className="text-stone-400" />
                              </div>
                              <div>
                                <p className="font-black text-stone-900 uppercase tracking-tight">{start.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{s.branch_name}</p>
                              </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              s.status === 'open' ? 'bg-green-100 text-green-600' : 'bg-stone-100 text-stone-500'
                            }`}>
                              {s.status === 'open' ? 'Activo' : 'Cerrado'}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-stone-50">
                            <div className="flex items-center gap-6">
                              <div>
                                <p className="text-[10px] font-black text-stone-400 uppercase mb-1">Entrada</p>
                                <p className="font-bold text-stone-800">{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
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
      <AnimatePresence>
        {deletingUser && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setDeletingUser(null)} 
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl p-8 border border-stone-200"
            >
              <div className="w-16 h-16 bg-red-100 rounded-3xl flex items-center justify-center text-red-600 mb-6">
                <Trash2 size={32} />
              </div>
              <h2 className="text-2xl font-black text-stone-900 mb-2">¿Eliminar Empleado?</h2>
              <p className="text-stone-500 font-medium mb-8">
                Esta acción eliminará permanentemente a <span className="text-stone-900 font-black">{deletingUser.name}</span> del sistema. Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setDeletingUser(null)}
                  className="flex-1 py-4 font-black text-stone-500 hover:bg-stone-50 rounded-2xl transition-all uppercase tracking-widest text-xs"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDeleteUser}
                  className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-600/20 hover:bg-red-700 transition-all uppercase tracking-widest text-xs"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
