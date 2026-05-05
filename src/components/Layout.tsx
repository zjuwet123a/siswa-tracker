import React from 'react';
import { LayoutDashboard, Users, BookOpen, GraduationCap } from 'lucide-react';
import { motion } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'dashboard' | 'students';
  onTabChange: (tab: 'dashboard' | 'students') => void;
}

export default function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col p-4 md:p-8">
      {/* Header */}
      <header className="max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-indigo-600 uppercase flex items-center gap-3 justify-center md:justify-start">
            <GraduationCap className="w-8 h-8" />
            Student Activity Tracker
          </h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Firebase Instance: Edu-Tracker-v1</p>
        </div>
        
        <div className="flex items-center gap-3">
          <nav className="flex items-center bg-white border border-slate-200 p-1.5 rounded-full shadow-sm">
            <button
              onClick={() => onTabChange('dashboard')}
              className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                  : 'text-slate-400 hover:text-slate-900'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => onTabChange('students')}
              className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'students'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                  : 'text-slate-400 hover:text-slate-900'
              }`}
            >
              Siswa
            </button>
          </nav>

          <div className="hidden sm:flex px-4 py-2 bg-white border border-slate-200 rounded-full items-center gap-2 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">System Online</span>
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
