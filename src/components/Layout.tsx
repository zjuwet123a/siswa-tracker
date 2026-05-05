import React from 'react';
import { LayoutDashboard, Users, BookOpen, GraduationCap, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const activeTab = location.pathname.startsWith('/dashboard') ? 'dashboard' : 
                    location.pathname.startsWith('/penerima-manfaat') || location.pathname.startsWith('/profile') ? 'students' : 'dashboard';

  const user = auth.currentUser;

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col p-4 md:p-8">
      {/* Header */}
      <header className="max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between items-center mb-8 gap-6 pt-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-100 rotate-3">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-slate-800 uppercase leading-none">
              Arsip Digital
            </h1>
            <span className="text-[10px] font-black tracking-[0.4em] text-indigo-600 uppercase">PKBM PM System</span>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-6">
          <nav className="flex items-center bg-white border border-slate-200 p-1.5 rounded-full shadow-sm">
            <Link
              to="/dashboard"
              className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100/50'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Dashboard
            </Link>
            <Link
              to="/penerima-manfaat"
              className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'students'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100/50'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Daftar PM
            </Link>
          </nav>

          <div className="flex items-center gap-4 pl-6 border-l border-slate-200">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                {user?.displayName || user?.email?.split('@')[0] || 'Admin'}
              </span>
              <button 
                onClick={handleLogout}
                className="text-[9px] font-black text-rose-500 uppercase tracking-[0.2em] hover:text-rose-600 transition-colors flex items-center gap-1.5"
              >
                Logout
                <LogOut size={12} />
              </button>
            </div>
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-10 h-10 rounded-xl shadow-md border-2 border-white ring-1 ring-slate-100" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center border-2 border-white ring-1 ring-slate-100">
                <div className="w-full h-full flex items-center justify-center text-indigo-600 font-black text-xs uppercase">
                  {(user?.displayName?.[0] || user?.email?.[0] || 'A')}
                </div>
              </div>
            )}
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
    </div>
  );
}
