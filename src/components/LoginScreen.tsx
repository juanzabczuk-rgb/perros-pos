import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Utensils } from 'lucide-react';
import { auth } from '../firebase';
import { sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';

interface LoginScreenProps {
  onGoogleLogin: () => void;
  onEmailPasswordLogin: (email: string, pass: string) => Promise<void>;
  onRegister: (email: string, pass: string) => Promise<void>;
  isFirstUser: boolean;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ 
  onGoogleLogin, 
  onEmailPasswordLogin, 
  onRegister, 
  isFirstUser 
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'initial' | 'verify'>(isFirstUser ? 'register' : 'initial');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const user = auth.currentUser;
    if (user && !user.emailVerified && user.providerData[0]?.providerId === 'password') {
      setMode('verify');
    }
  }, []);

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Por favor, ingrese su email para restablecer la contraseña.');
      return;
    }
    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email);
      alert('Se ha enviado un correo para restablecer su contraseña.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        await onRegister(email, password);
        setMode('verify');
      } else {
        await onEmailPasswordLogin(email, password);
        const user = auth.currentUser;
        if (user && !user.emailVerified) {
          setMode('verify');
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/invalid-credential') {
        setError('Email o contraseña incorrectos. Por favor, verifica tus datos.');
      } else if (err.code === 'auth/user-not-found') {
        setError('No se encontró una cuenta con este email.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Contraseña incorrecta.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este email ya está registrado.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña es muy débil.');
      } else {
        setError(err.message || 'Error en la autenticación');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (auth.currentUser) {
      try {
        setLoading(true);
        await sendEmailVerification(auth.currentUser);
        alert('Correo de verificación reenviado.');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-900 text-white p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-stone-800 p-8 rounded-[40px] shadow-2xl border border-stone-700"
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-brand-yellow rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand-yellow/20 rotate-3">
            <Utensils size={40} className="text-stone-900" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter">Panchería POS</h1>
          <p className="text-stone-400 text-sm mt-2 font-medium">
            {mode === 'verify' ? 'Verifique su correo' : isFirstUser ? 'Configurar cuenta de propietario' : mode === 'register' ? 'Crear nueva cuenta' : 'Inicie sesión para continuar'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-900/30 rounded-2xl text-red-400 text-xs font-bold text-center">
            {error}
            {error.includes('incorrectos') && (
              <p className="mt-1 text-[10px] opacity-70 font-medium">
                Si acaba de registrarse, asegúrese de haber verificado su email.
              </p>
            )}
          </div>
        )}

        <div className="space-y-4">
          {mode === 'verify' ? (
            <div className="text-center space-y-6">
              <div className="p-4 bg-stone-900/50 rounded-2xl border border-stone-700">
                <p className="text-stone-300 text-sm leading-relaxed">
                  Hemos enviado un enlace de verificación a su correo. Por favor, haga clic en el enlace para activar su cuenta.
                </p>
              </div>
              <button 
                onClick={handleResendVerification}
                disabled={loading}
                className="w-full py-4 bg-brand-yellow text-stone-900 font-black rounded-2xl shadow-lg hover:bg-yellow-400 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Reenviar Correo'}
              </button>
              <button 
                onClick={() => {
                  auth.signOut();
                  setMode('initial');
                }}
                className="w-full py-4 bg-stone-700 text-white font-bold rounded-2xl hover:bg-stone-600 transition-all text-xs uppercase tracking-widest"
              >
                Volver al Inicio
              </button>
            </div>
          ) : mode === 'initial' ? (
            <>
              <button 
                onClick={onGoogleLogin}
                className="w-full py-4 bg-white text-stone-900 font-black rounded-2xl shadow-lg hover:bg-stone-100 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continuar con Google
              </button>
              
              <button 
                onClick={() => setMode('login')}
                className="w-full py-4 bg-stone-700 text-white font-bold rounded-2xl hover:bg-stone-600 transition-all text-xs uppercase tracking-widest"
              >
                Ingresar con Email
              </button>

              <button 
                onClick={() => setMode('register')}
                className="w-full py-4 bg-stone-800 text-stone-400 font-bold rounded-2xl hover:bg-stone-700 transition-all text-xs uppercase tracking-widest border border-stone-700"
              >
                Registrarse
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 ml-1">Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-5 py-4 bg-stone-900/50 rounded-2xl border border-stone-700 focus:ring-2 focus:ring-brand-yellow focus:border-transparent transition-all outline-none"
                  placeholder="admin@pancheria.com"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 ml-1">Contraseña</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-5 py-4 bg-stone-900/50 rounded-2xl border border-stone-700 focus:ring-2 focus:ring-brand-yellow focus:border-transparent transition-all outline-none"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-brand-yellow text-stone-900 font-black rounded-2xl shadow-lg hover:bg-yellow-400 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Procesando...' : mode === 'register' ? 'Registrarse' : 'Iniciar Sesión'}
              </button>
              
              {mode === 'login' && (
                <button 
                  type="button"
                  onClick={handleForgotPassword}
                  className="w-full text-[10px] font-bold text-stone-500 hover:text-stone-300 uppercase tracking-widest"
                >
                  ¿Olvidó su contraseña?
                </button>
              )}

              <button 
                type="button"
                onClick={() => setMode('initial')}
                className="w-full mt-2 text-xs font-bold text-stone-500 hover:text-stone-300"
              >
                Volver
              </button>
            </form>
          )}
          
          {isFirstUser && (
            <p className="text-[10px] text-stone-500 text-center mt-4 px-4">
              Al ser el primer usuario, se le asignará el rol de <strong>Propietario</strong> automáticamente.
            </p>
          )}
        </div>

        <p className="mt-8 text-center text-[10px] text-stone-500 uppercase font-black tracking-widest">
          Sistema de Gestión Interna
        </p>
      </motion.div>
    </div>
  );
};

export default LoginScreen;
