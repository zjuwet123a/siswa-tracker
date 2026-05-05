import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BookOpen, Users, CheckCircle, Clock, BarChart3, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

function StatCard({ title, value, icon, color, delay, textColor = "text-slate-800" }: { title: string, value: string | number, icon: React.ReactNode, color: string, delay: number, textColor?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      className={`${color} p-8 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between h-48 group border border-black/5`}
    >
      <div className="flex justify-between items-start">
        <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div className="w-2 h-2 rounded-full bg-white/40 group-hover:bg-white animate-pulse" />
      </div>
      <div>
        <p className={`text-[10px] font-black uppercase tracking-[0.2em] opacity-70 ${textColor}`}>{title}</p>
        <p className={`text-4xl font-black ${textColor} mt-1`}>{value}</p>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
  });

  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setStats({ totalStudents: snap.size });
    }, (error) => {
      console.error('Dashboard listener failed:', error);
    });
    return () => unsubStudents();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Ringkasan Sistem</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Live Node Status: Active</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Siswa" 
          value={stats.totalStudents} 
          icon={<Users className="text-white" size={24} />} 
          color="bg-indigo-600"
          textColor="text-white"
          delay={0}
        />
        <StatCard 
          title="Sesi Belajar" 
          value="4.2k" 
          icon={<BookOpen className="text-white" size={24} />} 
          color="bg-emerald-500"
          textColor="text-white"
          delay={0.1}
        />
        <StatCard 
          title="Paham Rate" 
          value="84%" 
          icon={<CheckCircle className="text-slate-800" size={24} />} 
          color="bg-amber-400"
          textColor="text-slate-900"
          delay={0.2}
        />
        <StatCard 
          title="Growth" 
          value="+12%" 
          icon={<BarChart3 className="text-white" size={24} />} 
          color="bg-slate-900"
          textColor="text-white"
          delay={0.3}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[500px]">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-[3rem] p-10 flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
              <div className="w-2 h-8 bg-indigo-600 rounded-full" />
              Performa Belajar Mingguan
            </h3>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50 px-3 py-1 rounded-full">Report: v2.4</span>
          </div>
          <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200 group hover:bg-slate-100/50 transition-colors">
            <div className="text-center">
              <div className="inline-flex p-4 rounded-3xl bg-white shadow-sm mb-4 text-slate-300">
                <BarChart3 size={40} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest max-w-[200px] mx-auto leading-relaxed">Grafik analytics akan muncul secara otomatis saat data telah terakumulasi.</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 bg-indigo-600 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl flex flex-col justify-between group">
          <div className="absolute top-[-40px] right-[-40px] w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700" />
          <div className="absolute bottom-[-20px] left-[-20px] w-32 h-32 bg-white/5 rounded-full blur-2xl" />
          
          <div className="relative z-10 flex-1">
            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em] mb-6 block">Quick Action</span>
            <h3 className="text-3xl font-black leading-tight mb-4 tracking-tight uppercase">Update <br/>Record Siswa</h3>
            <p className="text-sm font-medium text-indigo-100/80 leading-relaxed max-w-[200px]">
              Pantau dan catat setiap progres belajar siswa secara langsung melalui portal Firebase.
            </p>
          </div>
          
          <div className="relative z-10 pt-8">
            <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white hover:text-indigo-600 transition-all cursor-pointer">
              Go To Directory
              <ChevronRight size={14} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
