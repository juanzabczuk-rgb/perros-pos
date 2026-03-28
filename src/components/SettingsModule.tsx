import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc 
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
  Settings, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

export const SettingsModule = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const { printerSettings, setPrinterSettings, ticketSettings, setTicketSettings, shiftTolerance, setShiftTolerance } = useApp();
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [ticketLogoPreview, setTicketLogoPreview] = useState<string | null>(ticketSettings.logo || null);

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

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto noscrollbar">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight">Ajustes</h1>
          <p className="text-stone-500 font-medium">Configuración global del sistema y sucursales</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-stone-100">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Store size={24} className="text-brand-red" />
              Sucursales
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-stone-100 h-fit sticky top-8">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Settings size={24} className="text-brand-red" />
            Información del Negocio
          </h3>
          <form className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Nombre de la Empresa</label>
              <input defaultValue="Panchería Pro" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-bold" />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase mb-2">CUIT / Identificación Fiscal</label>
              <input defaultValue="20-12345678-9" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-bold" />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Email de Contacto</label>
              <input defaultValue="admin@pancheriapro.com" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-bold" />
            </div>
            <div className="pt-4">
              <button className="w-full py-4 bg-brand-red text-white font-bold rounded-2xl shadow-lg shadow-brand-red/20 hover:bg-brand-red/90 transition-all">
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
                  <input name="name" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-bold" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Ubicación</label>
                  <input name="location" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Apertura</label>
                    <input name="opening_time" type="time" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-bold" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Cierre</label>
                    <input name="closing_time" type="time" className="w-full px-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-bold" />
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
