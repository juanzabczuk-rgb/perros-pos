import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc
} from 'firebase/firestore';
import { 
  Store, 
  Plus, 
  Edit, 
  Users, 
  Printer, 
  Save, 
  Camera, 
  Clock, 
  MapPin, 
  Phone, 
  X,
  CreditCard,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Branch, Tax } from '../types';

export const SettingsModule = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const { user, printerSettings, setPrinterSettings, ticketSettings, setTicketSettings, shiftTolerance, setShiftTolerance } = useApp();
  const [activeSection, setActiveSection] = useState('branches');
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const [showAddTax, setShowAddTax] = useState(false);
  const [editingTax, setEditingTax] = useState<Tax | null>(null);
  const [deletingTax, setDeletingTax] = useState<Tax | null>(null);
  const [ticketLogoPreview, setTicketLogoPreview] = useState<string | null>(ticketSettings.logo || null);

  useEffect(() => {
    if (!user) return () => {};
    const unsubBranches = onSnapshot(collection(db, 'branches'), (snapshot) => {
      setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
    }, (err) => {
      if (err.code === 'permission-denied') return;
      handleFirestoreError(err, OperationType.LIST, 'branches');
    });

    const unsubTaxes = onSnapshot(collection(db, 'taxes'), (snapshot) => {
      setTaxes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tax)));
    }, (err) => {
      if (err.code === 'permission-denied') return;
      handleFirestoreError(err, OperationType.LIST, 'taxes');
    });

    return () => {
      unsubBranches();
      unsubTaxes();
    };
  }, [user]);

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    try {
      if (editingBranch) {
        await updateDoc(doc(db, 'branches', editingBranch.id), data);
      } else {
        await addDoc(collection(db, 'branches'), data);
      }
      toast.success('Sucursal guardada');
      setShowAddBranch(false);
      setEditingBranch(null);
    } catch (err) {
      handleFirestoreError(err, editingBranch ? OperationType.UPDATE : OperationType.CREATE, 'branches');
    }
  };

  const handleDeleteBranch = async () => {
    if (!deletingBranch) return;
    try {
      await deleteDoc(doc(db, 'branches', deletingBranch.id));
      toast.success('Sucursal eliminada');
      setDeletingBranch(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `branches/${deletingBranch.id}`);
    }
  };

  const handleSaveTax = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      name: formData.get('name') as string,
      rate: parseFloat(formData.get('rate') as string),
      enabled: editingTax ? editingTax.enabled : true
    };
    try {
      if (editingTax) {
        await updateDoc(doc(db, 'taxes', editingTax.id), data);
      } else {
        await addDoc(collection(db, 'taxes'), data);
      }
      toast.success('Impuesto guardado');
      setShowAddTax(false);
      setEditingTax(null);
    } catch (err) {
      handleFirestoreError(err, editingTax ? OperationType.UPDATE : OperationType.CREATE, 'taxes');
    }
  };

  const handleDeleteTax = async () => {
    if (!deletingTax) return;
    try {
      await deleteDoc(doc(db, 'taxes', deletingTax.id));
      toast.success('Impuesto eliminado');
      setDeletingTax(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `taxes/${deletingTax.id}`);
    }
  };

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

  const toggleTaxStatus = async (tax: Tax) => {
    try {
      await updateDoc(doc(db, 'taxes', tax.id), {
        enabled: !tax.enabled
      });
      toast.success(`Impuesto ${!tax.enabled ? 'activado' : 'desactivado'}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `taxes/${tax.id}`);
    }
  };

  const handleSaveSettings = async (section: string, data: Record<string, unknown>) => {
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        [section]: data
      }, { merge: true });
      toast.success('Configuración guardada');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `settings/global/${section}`);
    }
  };

  const sections = [
    { id: 'branches', label: 'Sucursales', icon: Store },
    { id: 'taxes', label: 'Impuestos', icon: CreditCard },
    { id: 'loyalty', label: 'Fidelización', icon: Users },
    { id: 'printer', label: 'Impresora', icon: Printer },
    { id: 'ticket', label: 'Ticket', icon: Save },
    { id: 'shifts', label: 'Turnos', icon: Clock },
  ];

  return (
    <div className="flex h-full bg-stone-50 overflow-hidden">
      {/* Settings Sidebar */}
      <div className="w-64 bg-white border-r border-stone-200 flex flex-col">
        <div className="p-6 border-b border-stone-200">
          <h2 className="text-xl font-black text-stone-900 uppercase tracking-tight">Ajustes</h2>
          <p className="text-xs text-stone-400 font-bold mt-1">AJUSTES GLOBALES</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1 noscrollbar">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-black transition-all ${
                activeSection === section.id
                  ? 'bg-stone-900 text-white shadow-lg shadow-stone-900/20'
                  : 'text-stone-500 hover:bg-stone-50'
              }`}
            >
              <section.icon size={18} />
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-8 noscrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeSection === 'branches' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight">Sucursales</h1>
                    <p className="text-stone-500 font-medium">Gestión de puntos de venta y locales</p>
                  </div>
                  <button 
                    onClick={() => setShowAddBranch(true)}
                    className="bg-brand-red text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-brand-red/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Plus size={20} />
                    Agregar Sucursal
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {branches.map(b => (
                    <div key={b.id} className="bg-white p-8 rounded-[40px] border border-stone-200 shadow-sm group hover:shadow-md transition-all">
                      <div className="flex items-start justify-between mb-6">
                        <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center text-stone-400 group-hover:bg-stone-900 group-hover:text-white transition-all">
                          <Store size={24} />
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { setEditingBranch(b); setShowAddBranch(true); }}
                            className="p-2 text-stone-400 hover:text-brand-red hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Edit size={18} />
                          </button>
                          <button 
                            onClick={() => setDeletingBranch(b)}
                            className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                      <h3 className="text-xl font-black text-stone-900 uppercase tracking-tight mb-2">{b.name}</h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-stone-500 text-sm font-medium">
                          <MapPin size={14} className="text-stone-300" />
                          {b.location || 'Sin ubicación'}
                        </div>
                        {b.phone && (
                          <div className="flex items-center gap-2 text-stone-500 text-sm font-medium">
                            <Phone size={14} className="text-stone-300" />
                            {b.phone}
                          </div>
                        )}
                        {b.cuit && (
                          <div className="flex items-center gap-2 text-stone-500 text-sm font-medium">
                            <CreditCard size={14} className="text-stone-300" />
                            CUIT: {b.cuit}
                          </div>
                        )}
                        {b.email && (
                          <div className="flex items-center gap-2 text-stone-500 text-sm font-medium">
                            <Mail size={14} className="text-stone-300" />
                            {b.email}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {branches.length === 0 && (
                    <div className="col-span-full py-20 bg-white rounded-[40px] border-2 border-dashed border-stone-100 flex flex-col items-center justify-center text-stone-300">
                      <Store size={48} className="mb-4" />
                      <p className="font-black uppercase tracking-widest">No hay sucursales configuradas</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'taxes' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight">Impuestos</h1>
                    <p className="text-stone-500 font-medium">Configuración de tasas impositivas</p>
                  </div>
                  <button 
                    onClick={() => setShowAddTax(true)}
                    className="bg-brand-red text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-brand-red/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Plus size={20} />
                    Agregar Impuesto
                  </button>
                </div>

                <div className="bg-white rounded-[40px] border border-stone-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-stone-50 text-stone-500 text-[10px] uppercase tracking-[0.15em] font-black border-b border-stone-200">
                        <th className="px-8 py-6">Nombre</th>
                        <th className="px-8 py-6">Tasa (%)</th>
                        <th className="px-8 py-6">Estado</th>
                        <th className="px-8 py-6 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {taxes.map(tax => (
                        <tr key={tax.id} className="hover:bg-stone-50/50 transition-colors group">
                          <td className="px-8 py-6 font-black text-stone-900 uppercase tracking-widest text-xs">{tax.name}</td>
                          <td className="px-8 py-6 font-black text-stone-900">{tax.rate}%</td>
                          <td className="px-8 py-6">
                            <button 
                              onClick={() => toggleTaxStatus(tax)}
                              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                                tax.enabled 
                                  ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                                  : 'bg-stone-100 text-stone-400 hover:bg-stone-200'
                              }`}
                            >
                              {tax.enabled ? 'Activo' : 'Inactivo'}
                            </button>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => { setEditingTax(tax); setShowAddTax(true); }}
                                className="p-2 text-stone-400 hover:text-brand-red hover:bg-red-50 rounded-xl transition-all"
                              >
                                <Edit size={18} />
                              </button>
                              <button 
                                onClick={() => setDeletingTax(tax)}
                                className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                              >
                                <X size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {taxes.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-8 py-20 text-center text-stone-300">
                            <CreditCard size={48} className="mx-auto mb-4" />
                            <p className="font-black uppercase tracking-widest">No hay impuestos configurados</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeSection === 'loyalty' && (
              <div className="max-w-2xl space-y-8">
                <div>
                  <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight">Fidelización</h1>
                  <p className="text-stone-500 font-medium">Configuración del sistema de puntos y premios</p>
                </div>

                <div className="bg-white p-8 rounded-[40px] border border-stone-200 shadow-sm space-y-8">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <div className="w-1 h-1 bg-brand-red rounded-full" />
                        Puntos por cada $100
                      </label>
                      <input type="number" defaultValue={10} className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-black text-xl" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <div className="w-1 h-1 bg-brand-red rounded-full" />
                        Valor de cada punto
                      </label>
                      <input type="number" defaultValue={1} className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-black text-xl" />
                    </div>
                  </div>
                  <button className="w-full py-5 bg-stone-900 text-white font-black rounded-2xl shadow-xl shadow-stone-900/20 hover:bg-stone-800 transition-all uppercase tracking-widest text-sm">
                    Guardar Configuración
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'printer' && (
              <div className="max-w-2xl space-y-8">
                <div>
                  <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight">Impresora</h1>
                  <p className="text-stone-500 font-medium">Configuración de hardware de impresión térmica</p>
                </div>

                <div className="bg-white p-8 rounded-[40px] border border-stone-200 shadow-sm space-y-8">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Nombre de Impresora</label>
                      <input 
                        value={printerSettings.name || ''}
                        onChange={(e) => setPrinterSettings({ ...printerSettings, name: e.target.value })}
                        className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-bold" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Dirección IP / Puerto</label>
                      <input 
                        value={printerSettings.ip || ''}
                        onChange={(e) => setPrinterSettings({ ...printerSettings, ip: e.target.value })}
                        className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-bold" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Ancho de Papel</label>
                      <div className="flex gap-3">
                        {['58mm', '80mm'].map(width => (
                          <button
                            key={width}
                            onClick={() => setPrinterSettings({ ...printerSettings, paperWidth: width as '58mm' | '80mm' })}
                            className={`flex-1 py-4 rounded-2xl font-black text-xs transition-all uppercase tracking-widest ${
                              printerSettings.paperWidth === width 
                                ? 'bg-stone-900 text-white shadow-lg shadow-stone-900/20' 
                                : 'bg-stone-50 text-stone-500 hover:bg-stone-100'
                            }`}
                          >
                            {width}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => handleSaveSettings('printer', printerSettings)}
                      className="flex-1 py-5 bg-stone-900 text-white font-black rounded-2xl shadow-xl shadow-stone-900/20 hover:bg-stone-800 transition-all uppercase tracking-widest text-sm"
                    >
                      Guardar Configuración
                    </button>
                    <button 
                      onClick={() => alert('Imprimiendo ticket de prueba...')}
                      className="flex-1 py-5 border-2 border-brand-red text-brand-red font-black rounded-2xl hover:bg-brand-red hover:text-white transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                    >
                      <Printer size={20} />
                      Ticket de Prueba
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'ticket' && (
              <div className="max-w-2xl space-y-8">
                <div>
                  <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight">Ticket</h1>
                  <p className="text-stone-500 font-medium">Personalización del comprobante de venta</p>
                </div>

                <div className="bg-white p-8 rounded-[40px] border border-stone-200 shadow-sm space-y-8">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-4">Logo del Ticket</label>
                      <div className="flex items-center gap-6">
                        <div className="w-32 h-32 bg-stone-50 rounded-[32px] border-2 border-dashed border-stone-200 flex items-center justify-center overflow-hidden relative group">
                          {ticketLogoPreview ? (
                            <>
                              <img src={ticketLogoPreview} alt="Logo" className="w-full h-full object-contain p-4" />
                              <div className="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Camera className="text-white" size={24} />
                              </div>
                            </>
                          ) : (
                            <Camera size={32} className="text-stone-300" />
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleLogoChange}
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-stone-500 mb-2">Recomendado: 200x200px (Blanco y Negro)</p>
                          <button className="text-brand-red font-black text-[10px] uppercase tracking-widest hover:underline">Eliminar Logo</button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Encabezado de Ticket</label>
                      <textarea 
                        value={ticketSettings.header}
                        onChange={(e) => setTicketSettings({ ...ticketSettings, header: e.target.value })}
                        className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red resize-none h-24 text-sm font-medium"
                        placeholder="Ej: ¡Gracias por su compra!"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Pie de Ticket</label>
                      <textarea 
                        value={ticketSettings.footer}
                        onChange={(e) => setTicketSettings({ ...ticketSettings, footer: e.target.value })}
                        className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red resize-none h-24 text-sm font-medium"
                        placeholder="Ej: Vuelva pronto"
                      />
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-6 bg-stone-50 rounded-3xl border border-stone-200">
                        <div>
                          <p className="font-black text-stone-900 uppercase tracking-tight text-sm">Impresión de Ticket</p>
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Copia para el cliente</p>
                        </div>
                        <button 
                          onClick={() => setTicketSettings({ ...ticketSettings, printTicket: !ticketSettings.printTicket })}
                          className={`w-14 h-8 rounded-full p-1 transition-all ${ticketSettings.printTicket ? 'bg-brand-red' : 'bg-stone-200'}`}
                        >
                          <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-all ${ticketSettings.printTicket ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between p-6 bg-stone-50 rounded-3xl border border-stone-200">
                        <div>
                          <p className="font-black text-stone-900 uppercase tracking-tight text-sm">Impresión de Comandas</p>
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Copia para cocina</p>
                        </div>
                        <button 
                          onClick={() => setTicketSettings({ ...ticketSettings, printComanda: !ticketSettings.printComanda })}
                          className={`w-14 h-8 rounded-full p-1 transition-all ${ticketSettings.printComanda ? 'bg-brand-red' : 'bg-stone-200'}`}
                        >
                          <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-all ${ticketSettings.printComanda ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleSaveSettings('ticket', ticketSettings)}
                      className="w-full py-5 bg-stone-900 text-white font-black rounded-2xl shadow-xl shadow-stone-900/20 hover:bg-stone-800 transition-all uppercase tracking-widest text-sm"
                    >
                      Guardar Configuración de Ticket
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'shifts' && (
              <div className="max-w-2xl space-y-8">
                <div>
                  <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight">Turnos</h1>
                  <p className="text-stone-500 font-medium">Configuración de horarios y tolerancias</p>
                </div>

                <div className="bg-white p-8 rounded-[40px] border border-stone-200 shadow-sm space-y-8">
                  <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                      <div className="w-1 h-1 bg-brand-red rounded-full" />
                      Margen de Tolerancia (minutos)
                    </label>
                    <div className="flex items-center gap-6">
                      <input 
                        type="range" 
                        min="0" 
                        max="60" 
                        step="5"
                        value={shiftTolerance}
                        onChange={(e) => setShiftTolerance(parseInt(e.target.value))}
                        className="flex-1 accent-stone-900"
                      />
                      <span className="font-black text-stone-900 text-2xl w-16 text-right">{shiftTolerance}m</span>
                    </div>
                    <p className="text-[10px] text-stone-400 mt-4 font-bold uppercase tracking-widest leading-relaxed mb-8">
                      * Tiempo permitido para la apertura y cierre de turnos respecto al horario programado sin generar alertas.
                    </p>
                    <button 
                      onClick={() => handleSaveSettings('shiftTolerance', shiftTolerance)}
                      className="w-full py-5 bg-stone-900 text-white font-black rounded-2xl shadow-xl shadow-stone-900/20 hover:bg-stone-800 transition-all uppercase tracking-widest text-sm"
                    >
                      Guardar Tolerancia
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {(showAddBranch || editingBranch) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowAddBranch(false); setEditingBranch(null); }} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl p-8 border border-stone-200">
              <h2 className="text-2xl font-black text-stone-900 mb-6 uppercase tracking-tight">{editingBranch ? 'Editar Sucursal' : 'Nueva Sucursal'}</h2>
              <form onSubmit={handleSaveBranch} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Nombre</label>
                  <input name="name" defaultValue={editingBranch?.name} className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-black" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Ubicación</label>
                  <input name="location" defaultValue={editingBranch?.location} className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-black" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Teléfono</label>
                  <input name="phone" defaultValue={editingBranch?.phone} className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-black" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">CUIT</label>
                  <input name="cuit" defaultValue={editingBranch?.cuit} className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-black" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Email</label>
                  <input name="email" type="email" defaultValue={editingBranch?.email} className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-black" />
                </div>
                <div className="flex gap-4 mt-8">
                  <button type="button" onClick={() => { setShowAddBranch(false); setEditingBranch(null); }} className="flex-1 py-4 font-black text-stone-500 hover:bg-stone-50 rounded-2xl transition-all uppercase tracking-widest text-xs">Cancelar</button>
                  <button type="submit" className="flex-[2] py-4 bg-stone-900 text-white font-black rounded-2xl shadow-xl shadow-stone-900/20 hover:bg-stone-800 transition-all uppercase tracking-widest text-xs">
                    {editingBranch ? 'Guardar Cambios' : 'Crear Sucursal'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {deletingBranch && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeletingBranch(null)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl p-8 border border-stone-200">
              <div className="w-16 h-16 bg-red-100 rounded-3xl flex items-center justify-center text-red-600 mb-6">
                <X size={32} />
              </div>
              <h2 className="text-2xl font-black text-stone-900 mb-2 uppercase tracking-tight">¿Eliminar Sucursal?</h2>
              <p className="text-stone-500 font-medium mb-8">
                Esta acción eliminará permanentemente la sucursal <span className="text-stone-900 font-black">{deletingBranch.name}</span>. Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-4">
                <button onClick={() => setDeletingBranch(null)} className="flex-1 py-4 font-black text-stone-500 hover:bg-stone-50 rounded-2xl transition-all uppercase tracking-widest text-xs">Cancelar</button>
                <button onClick={handleDeleteBranch} className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-600/20 hover:bg-red-700 transition-all uppercase tracking-widest text-xs">Eliminar</button>
              </div>
            </motion.div>
          </div>
        )}

        {(showAddTax || editingTax) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowAddTax(false); setEditingTax(null); }} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl p-8 border border-stone-200">
              <h2 className="text-2xl font-black text-stone-900 mb-6 uppercase tracking-tight">{editingTax ? 'Editar Impuesto' : 'Nuevo Impuesto'}</h2>
              <form onSubmit={handleSaveTax} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Nombre</label>
                  <input name="name" defaultValue={editingTax?.name} placeholder="Ej: IVA" className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-black" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Tasa (%)</label>
                  <input name="rate" type="number" step="0.01" defaultValue={editingTax?.rate} placeholder="Ej: 21" className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-black" required />
                </div>
                <div className="flex gap-4 mt-8">
                  <button type="button" onClick={() => { setShowAddTax(false); setEditingTax(null); }} className="flex-1 py-4 font-black text-stone-500 hover:bg-stone-50 rounded-2xl transition-all uppercase tracking-widest text-xs">Cancelar</button>
                  <button type="submit" className="flex-[2] py-4 bg-stone-900 text-white font-black rounded-2xl shadow-xl shadow-stone-900/20 hover:bg-stone-800 transition-all uppercase tracking-widest text-xs">
                    {editingTax ? 'Guardar Cambios' : 'Crear Impuesto'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {deletingTax && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeletingTax(null)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl p-8 border border-stone-200">
              <div className="w-16 h-16 bg-red-100 rounded-3xl flex items-center justify-center text-red-600 mb-6">
                <X size={32} />
              </div>
              <h2 className="text-2xl font-black text-stone-900 mb-2 uppercase tracking-tight">¿Eliminar Impuesto?</h2>
              <p className="text-stone-500 font-medium mb-8">
                Esta acción eliminará permanentemente el impuesto <span className="text-stone-900 font-black">{deletingTax.name}</span>. Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-4">
                <button onClick={() => setDeletingTax(null)} className="flex-1 py-4 font-black text-stone-500 hover:bg-stone-50 rounded-2xl transition-all uppercase tracking-widest text-xs">Cancelar</button>
                <button onClick={handleDeleteTax} className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-600/20 hover:bg-red-700 transition-all uppercase tracking-widest text-xs">Eliminar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
