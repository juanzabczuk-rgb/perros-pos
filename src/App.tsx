import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppProvider, useApp } from './context/AppContext';
import { authService } from './services/authService';
import { auth } from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { Menu } from 'lucide-react';
import { VentasModule } from './components/VentasModule';
import { InventoryModule } from './components/InventoryModule';
import { CustomersModule } from './components/CustomersModule';
import { DashboardModule } from './components/DashboardModule';
import { StaffModule } from './components/StaffModule';
import { SettingsModule } from './components/SettingsModule';
import { ShiftModal } from './components/ShiftModal';
import { OperatorSelector } from './components/OperatorSelector';

const App = () => {
  const [activeTab, setActiveTab] = useState('ventas');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, isAuthReady, activeOperator, isFirstUser } = useApp();

  if (!isAuthReady) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-stone-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-brand-red border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    if (auth.currentUser && isFirstUser) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-stone-900 text-white p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <h2 className="text-xl font-bold mb-4">Configurando cuenta de propietario...</h2>
            <button 
              onClick={async () => {
                if (auth.currentUser) {
                  await authService.createInitialUser(auth.currentUser);
                }
              }}
              className="px-6 py-3 bg-brand-yellow text-stone-900 font-bold rounded-xl"
            >
              Confirmar Creación de Cuenta
            </button>
          </motion.div>
        </div>
      );
    }

    return (
      <LoginScreen 
        isFirstUser={isFirstUser} 
        onEmailPasswordLogin={async (email, pass) => {
          await authService.loginWithEmail(email, pass);
        }}
        onRegister={async (email, pass) => {
          await authService.registerWithEmail(email, pass);
          // The AppContext will detect the new auth state and update isFirstUser
          // If it's the first user, the block above will handle it.
        }}
      />
    );
  }

  if (!activeOperator) {
    return <OperatorSelector />;
  }

  const renderModule = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardModule />;
      case 'ventas': return <VentasModule />;
      case 'inventory': return <InventoryModule />;
      case 'customers': return <CustomersModule />;
      case 'staff': return <StaffModule />;
      case 'settings': return <SettingsModule />;
      default: return <VentasModule />;
    }
  };

  return (
    <div className="flex h-screen bg-stone-200 font-sans text-stone-900 overflow-hidden items-center justify-center p-0 sm:p-2 md:p-4">
      <div className="w-full max-w-[1280px] h-full max-h-[800px] bg-stone-100 flex overflow-hidden shadow-2xl sm:rounded-[32px] relative border border-stone-300/50">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
        />
        <main className="flex-1 relative overflow-hidden flex flex-col">
          {/* Top Bar for Mobile/Tablet */}
          <header className="lg:hidden h-16 bg-white border-b border-stone-200 flex items-center px-6 shrink-0">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-600 hover:bg-stone-200 transition-colors shadow-sm"
            >
              <Menu size={24} />
            </button>
            <div className="ml-4">
              <h1 className="text-xs font-black uppercase tracking-widest text-stone-900">
                {activeTab === 'ventas' ? 'Punto de Venta' : 
                 activeTab === 'inventory' ? 'Stock de Productos' :
                 activeTab === 'customers' ? 'Gestión de Clientes' :
                 activeTab === 'dashboard' ? 'Estadísticas y Reportes' :
                 activeTab === 'staff' ? 'Gestión de Personal' : 'Ajustes'}
              </h1>
            </div>
          </header>

          <div className="flex-1 relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <ErrorBoundary>
                  {renderModule()}
                </ErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
        <ShiftModal />
      </div>
    </div>
  );
};

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  );
}
