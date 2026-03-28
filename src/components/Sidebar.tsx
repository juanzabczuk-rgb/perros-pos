import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  UserCircle, 
  Settings, 
  X,
  Utensils,
  LogOut
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { authService } from '../services/authService';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (t: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  isOpen = false, 
  onClose = () => {} 
}) => {
  const { user, rolePermissions, setUser, setActiveOperator } = useApp();

  if (!user) return null;

  const userPermissions = rolePermissions.find(rp => rp.id === user.role)?.modules || 
    (user.role === 'owner' ? ['pos', 'inventory', 'customers', 'stats', 'staff', 'settings'] : []);
  
  const menuItems = [
    { id: 'ventas', label: 'Ventas', icon: ShoppingCart },
    { id: 'inventory', label: 'Stock', icon: Package },
    { id: 'customers', label: 'Clientes', icon: Users },
    { id: 'dashboard', label: 'Estadísticas', icon: LayoutDashboard },
    { id: 'staff', label: 'Personal', icon: UserCircle },
    { id: 'settings', label: 'Ajustes', icon: Settings },
  ].filter(item => userPermissions.includes(item.id === 'ventas' ? 'pos' : (item.id === 'dashboard' ? 'stats' : item.id)));

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
    setActiveOperator(null);
  };

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
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-stone-900 text-stone-400 flex flex-col border-r border-stone-800 transition-transform duration-300 lg:relative lg:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-yellow rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-brand-yellow/20">
              <Utensils size={28} className="text-stone-900" />
            </div>
            <div>
              <h2 className="text-white font-black leading-tight uppercase tracking-tighter">Panchería</h2>
              <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">{user.branch_name || 'Sucursal'}</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-stone-500 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-8">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                onClose();
              }}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all group ${
                activeTab === item.id 
                  ? 'bg-brand-red text-white font-black shadow-xl shadow-brand-red/20' 
                  : 'hover:bg-stone-800 hover:text-white'
              }`}
            >
              <item.icon size={24} className={activeTab === item.id ? 'text-white' : 'text-stone-500 group-hover:text-white'} />
              <span className="uppercase tracking-widest text-[10px] font-black">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-stone-800">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-stone-500 hover:bg-stone-800 hover:text-white transition-all group"
          >
            <LogOut size={24} className="group-hover:text-white" />
            <span className="uppercase tracking-widest text-[10px] font-black">Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </>
  );
};
