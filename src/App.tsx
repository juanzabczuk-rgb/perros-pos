import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppProvider, useApp } from './context/AppContext';
import { authService } from './services/authService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
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
    return (
      <LoginScreen 
        isFirstUser={isFirstUser} 
        onGoogleLogin={async () => {
          const firebaseUser = await authService.loginWithGoogle();
          if (isFirstUser && firebaseUser) {
            await authService.createInitialUser(firebaseUser);
          }
        }}
        onEmailPasswordLogin={async (email, pass) => {
          await authService.loginWithEmail(email, pass);
        }}
        onRegister={async (email, pass) => {
          const firebaseUser = await authService.registerWithEmail(email, pass);
          if (isFirstUser && firebaseUser) {
            await authService.createInitialUser(firebaseUser);
          }
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
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 relative overflow-hidden">
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
        </main>
        <ShiftModal />
      </div>
    </div>
  );
};

export default function AppWrapper() {
  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}
