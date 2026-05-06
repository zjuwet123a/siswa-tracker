import React from 'react';
import { LayoutDashboard, Users, BookOpen, GraduationCap, LogOut, User, Lock, Key, X, AlertCircle, CheckCircle2, UserPlus, Mail, Sun, Moon, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, createUserWithEmailAndPassword, getAuth, updateProfile } from 'firebase/auth';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';

interface LayoutProps {
  children: React.ReactNode;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
}

export default function Layout({ children, isDarkMode, setIsDarkMode }: LayoutProps) {
  const location = useLocation();
  const activeTab = location.pathname.startsWith('/dashboard') ? 'dashboard' : 
                    location.pathname.startsWith('/penerima-manfaat') || location.pathname.startsWith('/profile') ? 'students' : 
                    location.pathname.startsWith('/admin') ? 'admin' : 'dashboard';

  const user = auth.currentUser;
  const [isAdmin, setIsAdmin] = React.useState(user?.email === 'akundatakantor@gmail.com');
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const [websiteSettings, setWebsiteSettings] = React.useState<{ logoUrl?: string }>({});

  React.useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'website'), (snapshot) => {
      if (snapshot.exists()) {
        setWebsiteSettings(snapshot.data());
      }
    });
  }, []);
  const [showPasswordModal, setShowPasswordModal] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [passwordLoading, setPasswordLoading] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = React.useState(false);

  // Auto Logout Logic
  const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

  React.useEffect(() => {
    if (user) {
      if (user.email === 'akundatakantor@gmail.com') {
        setIsAdmin(true);
      } else {
        getDoc(doc(db, 'users', user.uid)).then(docSnap => {
          if (docSnap.exists() && docSnap.data().role === 'admin') {
            setIsAdmin(true);
          }
        });
      }
    }
  }, [user]);

  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout();
      }, INACTIVITY_TIMEOUT);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Initialize timer
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi password tidak cocok.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Password minimal 6 karakter.');
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);

    try {
      const user = auth.currentUser;
      if (user && user.email) {
        // Firebase often requires re-authentication for sensitive ops
        try {
          const credential = EmailAuthProvider.credential(user.email, currentPassword);
          await reauthenticateWithCredential(user, credential);
        } catch (reauthErr: any) {
          if (reauthErr.code === 'auth/wrong-password') {
            throw new Error('Password lama salah.');
          }
          throw reauthErr;
        }
        
        await updatePassword(user, newPassword);
        setPasswordSuccess(true);
        setTimeout(() => {
          setShowPasswordModal(false);
          setPasswordSuccess(false);
          setNewPassword('');
          setConfirmPassword('');
          setCurrentPassword('');
          setIsProfileOpen(false);
        }, 2000);
      }
    } catch (error: any) {
      console.error('Password change error:', error);
      setPasswordError(error.message || 'Gagal mengubah password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col p-4 md:p-8 transition-colors duration-300">
      {/* Header */}
      <header className="max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between items-center mb-8 gap-6 pt-4">
        <div className="flex items-center gap-4">
          {websiteSettings.logoUrl ? (
            <div className="w-14 h-14 rounded-2xl shadow-xl overflow-hidden bg-white dark:bg-slate-800 flex items-center justify-center p-1">
              <img src={websiteSettings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-none rotate-3">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-slate-800 dark:text-slate-100 uppercase leading-none">
              DATA PERKEMBANGAN PM
            </h1>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-6">
          <nav className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-full shadow-sm">
            <Link
              to="/dashboard"
              className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100/50 dark:shadow-none'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              Dashboard
            </Link>
            <Link
              to="/penerima-manfaat"
              className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'students'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100/50 dark:shadow-none'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              Daftar PM
            </Link>
          </nav>
 
          <div className="flex items-center gap-4 pl-6 border-l border-slate-200 dark:border-slate-800 relative">
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-4 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-2xl transition-all"
            >
              <div className="flex flex-col items-end hidden md:flex">
                <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  {user?.displayName || user?.email?.split('@')[0] || 'Admin'}
                </span>
                <span className="text-[8px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.2em]">Online</span>
              </div>
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-10 h-10 rounded-xl shadow-md border-2 border-white dark:border-slate-900 ring-1 ring-slate-100 dark:ring-slate-800" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-10 h-10 bg-indigo-50 dark:bg-slate-800 rounded-xl flex items-center justify-center border-2 border-white dark:border-slate-900 ring-1 ring-slate-100 dark:ring-slate-800">
                  <div className="w-full h-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase text-center">
                    {(user?.displayName?.[0] || user?.email?.[0] || 'A')}
                  </div>
                </div>
              )}
            </button>

            <AnimatePresence>
              {isProfileOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsProfileOpen(false)} 
                  />
                    <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl shadow-slate-200/50 dark:shadow-none z-50 overflow-hidden"
                  >
                    <div className="p-3 border-b border-slate-50 dark:border-slate-800 flex flex-col items-center gap-2 bg-slate-50/50 dark:bg-slate-800/50">
                       <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase text-center">
                        {user?.email}
                       </span>
                    </div>
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        setShowPasswordModal(true);
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-800"
                    >
                      <Lock size={14} className="text-indigo-600 dark:text-indigo-400" />
                      Ubah Password
                    </button>
                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setIsProfileOpen(false)}
                        className="w-full px-4 py-3 flex items-center gap-3 text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-800"
                      >
                        <Shield size={14} className="text-rose-600 dark:text-rose-400" />
                        Admin Panel
                      </Link>
                    )}
                    
                    <button
                      onClick={() => setIsDarkMode(!isDarkMode)}
                      className="w-full px-4 py-3 flex items-center gap-3 text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-800"
                    >
                      {isDarkMode ? (
                        <>
                          <Sun size={14} className="text-amber-500" />
                          Mode Terang
                        </>
                      ) : (
                        <>
                          <Moon size={14} className="text-indigo-600" />
                          Mode Gelap
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-3 flex items-center gap-3 text-[10px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                    >
                      <LogOut size={14} />
                      Logout
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !passwordLoading && setShowPasswordModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity:0, scale: 0.9, y: 20 }}
              animate={{ opacity:1, scale: 1, y: 0 }}
              exit={{ opacity:0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] p-10 shadow-2xl overflow-hidden"
            >
              <button 
                onClick={() => setShowPasswordModal(false)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={20} className="text-slate-400" />
              </button>

              <div className="flex flex-col items-center mb-8">
                <div className="p-4 bg-indigo-50 dark:bg-slate-800 rounded-2xl text-indigo-600 dark:text-indigo-400 mb-4 rotate-3">
                  <Key size={28} />
                </div>
                <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Ganti Kata Sandi</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Keamanan Akun PM</p>
              </div>

              {passwordSuccess ? (
                <div className="py-8 flex flex-col items-center gap-4 text-center">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight">Berhasil!</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Kata sandi Anda telah diperbarui.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Password Lama</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                      <input
                        type="password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium dark:text-white focus:bg-white dark:focus:bg-slate-700 focus:border-indigo-600 outline-none transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Password Baru</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium dark:text-white focus:bg-white dark:focus:bg-slate-700 focus:border-indigo-600 outline-none transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Konfirmasi Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium dark:text-white focus:bg-white dark:focus:bg-slate-700 focus:border-indigo-600 outline-none transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {passwordError && (
                    <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl text-rose-500">
                      <AlertCircle size={14} />
                      <span className="text-[9px] font-black uppercase tracking-widest">{passwordError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="w-full bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl py-4 font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 dark:hover:bg-indigo-500 disabled:opacity-50 transition-all mt-4"
                  >
                    {passwordLoading ? 'Memproses...' : 'Simpan Perubahan'}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
