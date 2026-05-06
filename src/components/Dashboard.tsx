import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, collectionGroup } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, BarChart3, ChevronRight, Clock, User, AlertCircle, X, FileText, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { Activity, Student } from '../types';

function StatCard({ title, value, icon, color, delay, textColor = "text-slate-800" }: { title: string, value: string | number, icon: React.ReactNode, color: string, delay: number, textColor?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      className={`${color} p-8 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between h-48 group border border-black/5 dark:border-white/5`}
    >
      <div className="flex justify-between items-start">
        <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div className="w-2 h-2 rounded-full bg-white/40 group-hover:bg-white animate-pulse" />
      </div>
      <div>
        <p className={`text-[10px] font-black uppercase tracking-[0.2em] opacity-70 ${textColor} dark:text-white/70`}>{title}</p>
        <p className={`text-4xl font-black ${textColor} dark:text-white mt-1`}>{value}</p>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalActivities: 0,
  });
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [studentsMap, setStudentsMap] = useState<Record<string, Student>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen to students for stats and lookup
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setStats(prev => ({ ...prev, totalStudents: snap.size }));
      const map: Record<string, Student> = {};
      snap.docs.forEach(doc => {
        map[doc.id] = { id: doc.id, ...doc.data() } as Student;
      });
      setStudentsMap(map);
    }, (error) => {
      console.error('Dashboard students sync failed:', error);
      setError('Gagal memuat data siswa. Pastikan koneksi stabil.');
    });

    // Listen to total activities count
    const unsubTotalActivities = onSnapshot(collectionGroup(db, 'activities'), (snap) => {
      setStats(prev => ({ ...prev, totalActivities: snap.size }));
    }, (error) => {
      console.error('Dashboard total activities sync failed:', error);
      // Seringkali gagal karena index collectionGroup belum ada
      setError('Index database sedang disiapkan atau bermasalah.');
    });

    // Listen to recent activities across all students
    const qActivities = query(
      collectionGroup(db, 'activities'),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubActivities = onSnapshot(qActivities, (snap) => {
      const activities = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Activity[];
      setRecentActivities(activities);
      setError(null);
    }, (error) => {
      console.error('Dashboard activities sync failed:', error);
      setError('Gagal memuat riwayat terbaru (membutuhkan index).');
    });

    return () => {
      unsubStudents();
      unsubTotalActivities();
      unsubActivities();
    };
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div className="flex items-center gap-6">
          <div className="w-1.5 h-12 bg-indigo-600 rounded-full" />
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight uppercase leading-none mb-2">
              DASHBOARD SISTEM
            </h1>
          </div>
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 p-4 rounded-2xl flex items-center gap-3 text-rose-600"
        >
          <AlertCircle size={18} />
          <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard 
          title="TOTAL PENERIMA MANFAAT" 
          value={stats.totalStudents} 
          icon={<Users className="text-white" size={24} />} 
          color="bg-indigo-600"
          textColor="text-white"
          delay={0}
        />
        <StatCard 
          title="JUMLAH KEGIATAN PENERIMA MANFAAT VOKASIONAL" 
          value={stats.totalActivities} 
          icon={<Clock className="text-white" size={24} />} 
          color="bg-emerald-500"
          textColor="text-white"
          delay={0.1}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Activities List */}
        <div className="lg:col-span-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[3rem] p-10 flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3">
              <div className="w-2 h-8 bg-emerald-500 rounded-full" />
              Kegiatan PM Terbaru
            </h3>
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full">REALTIME UPDATE</span>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-4 pb-4 border-b-2 border-slate-50 dark:border-slate-800 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-6 mr-2">
              <div className="col-span-1">Tanggal</div>
              <div className="col-span-2">Penerima Manfaat</div>
              <div className="col-span-2">Penyusun</div>
              <div className="col-span-2">Laporan</div>
              <div className="col-span-3">Hasil / Insight</div>
              <div className="col-span-2">Penginput</div>
            </div>

            <div className="space-y-3 max-h-[460px] overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {recentActivities.map((activity, idx) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => setSelectedActivity(activity)}
                      className="grid grid-cols-12 gap-4 py-6 px-6 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded-[2rem] items-start transition-all group cursor-pointer"
                    >
                      <div className="col-span-1 text-[10px] font-black text-slate-400 dark:text-slate-500 pt-1">
                        {activity.date?.toDate().toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }).toUpperCase()}
                        <div className="text-[8px] opacity-60">{activity.date?.toDate().getFullYear()}</div>
                      </div>
                      <div className="col-span-2 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 overflow-hidden shrink-0">
                          {studentsMap[activity.studentId]?.photoUrl ? (
                            <img 
                              src={studentsMap[activity.studentId].photoUrl} 
                              alt={studentsMap[activity.studentId].name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <User size={14} />
                          )}
                        </div>
                        <div className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase truncate">
                          {studentsMap[activity.studentId]?.name || 'Unknown Student'}
                        </div>
                      </div>
                      <div className="col-span-2">
                         <span className="text-[8px] font-black px-2 py-1 bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400 rounded-lg uppercase tracking-widest border border-indigo-50 dark:border-indigo-900/50 block md:inline-block truncate max-w-full" title={activity.category}>
                           {activity.category || 'Peksos'}
                         </span>
                      </div>
                      <div className="col-span-2 bg-slate-50 dark:bg-slate-900/30 p-3 rounded-xl border border-slate-100/50 dark:border-slate-800/50 min-w-0">
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium line-clamp-2 break-words">
                          {activity.classActivity}
                        </p>
                      </div>
                      <div className="col-span-3 bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded-xl border border-indigo-100/50 dark:border-indigo-500/20 min-w-0">
                        <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 italic line-clamp-2 break-words">
                          {activity.results}
                        </p>
                      </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 overflow-hidden shrink-0">
                        <User size={10} />
                      </div>
                      <div className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase truncate">
                        {activity.createdByName || '-'}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {recentActivities.length === 0 && (
                <div className="py-20 text-center">
                  <div className="inline-flex p-6 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-700 mb-4 border border-dashed border-slate-200 dark:border-slate-700">
                    <Clock size={32} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Belum ada kegiatan PM tercatat.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="lg:col-span-12 bg-indigo-600 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl flex flex-col md:flex-row items-center justify-between group">
          <div className="absolute top-[-40px] right-[-40px] w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex-1">
            <h3 className="text-3xl font-black leading-tight mb-2 tracking-tight uppercase">UPDATE AKTIFITAS PENERIMA MANFAAT</h3>
            <p className="text-sm font-medium text-indigo-100/80 leading-relaxed max-w-2xl">
              Klik menu Penerima Manfaat untuk mengelola data individu, menambah kegiatan baru, atau menghapus riwayat kegiatan Penerima Manfaat yang tidak diperlukan.
            </p>
          </div>
          
          <div className="relative z-10 mt-8 md:mt-0">
            <Link 
              to="/penerima-manfaat"
              className="inline-flex items-center gap-3 bg-white text-indigo-600 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all cursor-pointer shadow-xl"
            >
              Lihat Daftar PM
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {selectedActivity && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedActivity(null)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10"
            >
              {/* Modal Header */}
              <div className="px-10 py-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 overflow-hidden shrink-0 border-2 border-white dark:border-slate-800 shadow-sm">
                    {studentsMap[selectedActivity.studentId]?.photoUrl ? (
                      <img 
                        src={studentsMap[selectedActivity.studentId].photoUrl} 
                        alt={studentsMap[selectedActivity.studentId].name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User size={20} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight line-clamp-1">
                      {studentsMap[selectedActivity.studentId]?.name || 'Penerima Manfaat'}
                    </h3>
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                      {selectedActivity.date?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedActivity(null)}
                  className="p-3 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-2xl transition-all"
                >
                  <X size={28} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-10 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center gap-3">
                   <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                   <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em]">DIKIRIM OLEH {selectedActivity.category?.toUpperCase() || 'Peksos'}</span>
                </div>

                <div className="min-w-0">
                  <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] block mb-3 underline decoration-indigo-500/30 underline-offset-4">Laporan Kegiatan</label>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-all">
                    {selectedActivity.classActivity}
                  </p>
                </div>
                
                <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-[2.5rem] p-8 border border-indigo-100 dark:border-indigo-500/20 min-w-0">
                  <label className="text-[9px] uppercase font-black text-indigo-600 dark:text-indigo-400 tracking-[0.2em] block mb-3">Hasil / Insight Kegiatan</label>
                  <p className="text-sm font-bold italic text-indigo-700 dark:text-indigo-300 leading-relaxed whitespace-pre-wrap break-all">
                    {selectedActivity.results}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-800 pt-8 opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <User size={14} />
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Diinput Oleh</p>
                      <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase">{selectedActivity.createdByName || '-'}</p>
                    </div>
                  </div>
                  {selectedActivity.attachment && (
                    <div className="flex items-center gap-2 text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-mono">
                      <Paperclip size={14} />
                      Lampiran Tersedia
                    </div>
                  )}
                </div>
              </div>
              
              <div className="px-10 py-6 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                <Link 
                  to={`/profile/${selectedActivity.studentId}`}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-3"
                >
                  Buka Profil Lengkap
                  <ChevronRight size={14} />
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
