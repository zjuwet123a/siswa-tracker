import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Student, Activity, UnderstandingStatus } from '../types';
import { ArrowLeft, Calendar, BookOpen, Clock, CheckCircle2, AlertCircle, Plus, Send, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StudentDetailProps {
  student: Student;
  onBack: () => void;
}

export default function StudentDetail({ student, onBack }: StudentDetailProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [newActivity, setNewActivity] = useState({
    date: new Date().toISOString().split('T')[0],
    subject: '',
    summary: '',
    status: 'Paham' as UnderstandingStatus
  });

  useEffect(() => {
    const q = query(
      collection(db, `students/${student.id}/activities`),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Activity[];
      setActivities(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `student activities for ${student.id}`);
    });

    return () => unsubscribe();
  }, [student.id]);

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivity.subject || !newActivity.summary) return;

    try {
      await addDoc(collection(db, `students/${student.id}/activities`), {
        studentId: student.id,
        date: Timestamp.fromDate(new Date(newActivity.date)),
        subject: newActivity.subject.trim(),
        summary: newActivity.summary,
        status: newActivity.status,
        createdAt: serverTimestamp()
      });
      setNewActivity({
        date: new Date().toISOString().split('T')[0],
        subject: '',
        summary: '',
        status: 'Paham'
      });
      alert('Data aktivitas berhasil disimpan!');
    } catch (error) {
      alert('Gagal menyimpan aktivitas: ' + (error instanceof Error ? error.message : 'Unknown error'));
      handleFirestoreError(error, OperationType.WRITE, `add activity for ${student.id}`);
    }
  };

  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [showDeleteStudentModal, setShowDeleteStudentModal] = useState(false);

  const confirmDeleteActivity = async () => {
    if (!activityToDelete) return;

    try {
      await deleteDoc(doc(db, `students/${student.id}/activities`, activityToDelete.id));
      setActivityToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `activity ${activityToDelete.id}`);
    }
  };

  const confirmDeleteStudent = async () => {
    try {
      await deleteDoc(doc(db, 'students', student.id));
      setShowDeleteStudentModal(false);
      onBack();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `student ${student.id}`);
    }
  };

  const pahamCount = activities.filter(a => a.status === 'Paham').length;
  const reviewCount = activities.filter(a => a.status === 'Butuh Review').length;
  const pahamPercentage = activities.length > 0 ? Math.round((pahamCount / activities.length) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Kembali ke Daftar
        </button>
        <button
          type="button"
          onClick={() => setShowDeleteStudentModal(true)}
          className="relative z-20 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-rose-400 hover:text-rose-600 transition-all px-4 py-2 rounded-xl"
        >
          <Trash2 size={16} />
          Hapus Siswa
        </button>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Profile Card */}
        <div className="lg:col-span-8 bg-indigo-600 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl flex flex-col justify-between min-h-[300px]">
          <div className="absolute top-[-30px] right-[-30px] w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="relative z-10">
            <span className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.3em] mb-2 block">Viewing Profile</span>
            <h2 className="text-5xl font-black tracking-tighter uppercase mb-2">{student.name}</h2>
            <p className="text-lg font-medium text-indigo-100 opacity-80">
              Masuk: {student.enrollmentDate?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          
          <div className="relative z-10 flex gap-12 mt-10 border-t border-white/10 pt-8">
            <div className="space-y-1">
              <p className="text-[9px] text-indigo-200 uppercase font-black tracking-widest opacity-60">Total Sesi</p>
              <p className="text-3xl font-black">{activities.length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] text-indigo-200 uppercase font-black tracking-widest opacity-60">Pemahaman</p>
              <p className="text-3xl font-black">{pahamPercentage}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] text-indigo-200 uppercase font-black tracking-widest opacity-60">Status</p>
              <p className="text-3xl font-black italic">{pahamPercentage > 80 ? 'EXCELLENT' : 'ACTIVE'}</p>
            </div>
          </div>
        </div>

        {/* Status Indicator Card */}
        <div className={`lg:col-span-4 rounded-[3rem] p-10 flex flex-col items-center justify-center text-center shadow-xl transition-colors duration-500 ${pahamPercentage > 50 ? 'bg-emerald-500' : 'bg-amber-500'} text-white group`}>
          <div className="w-24 h-24 rounded-full border-4 border-white/30 flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform">
            <span className="text-2xl font-black italic tracking-tighter uppercase">{pahamPercentage > 50 ? 'Paham' : 'Review'}</span>
          </div>
          <p className="text-[10px] uppercase font-black tracking-[0.3em] opacity-80 mb-2">Current Academic Vibe</p>
          <p className="text-xl font-bold leading-tight">
            {pahamPercentage > 80 ? 'Highly Productive Session' : 'Consistent Learning Path'}
          </p>
        </div>

        {/* History Table Card */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-[3rem] p-10 flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
              <div className="w-2 h-8 bg-indigo-600 rounded-full" />
              Riwayat Belajar Siswa
            </h3>
            <button className="text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-4 py-2 rounded-full hover:bg-indigo-100 transition-colors">Export Report</button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-4 pb-4 border-b-2 border-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">
              <div className="col-span-2">Tanggal</div>
              <div className="col-span-3">Pelajaran</div>
              <div className="col-span-4">Materi Summary</div>
              <div className="col-span-3 text-right">Status</div>
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {loading ? (
                <div className="text-center py-20 text-[10px] font-black text-slate-400 uppercase tracking-widest">Syncing with Cloud...</div>
              ) : activities.length === 0 ? (
                <div className="text-center py-20 text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Belum ada data aktivitas terdaftar</div>
              ) : (
                activities.map((activity, idx) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="grid grid-cols-12 gap-4 py-5 px-4 border border-slate-50 rounded-2xl items-center hover:bg-slate-50 transition-all group"
                  >
                    <div className="col-span-2 text-xs font-black text-slate-400 group-hover:text-indigo-600 transition-colors">
                      {activity.date?.toDate().toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }).toUpperCase()}
                    </div>
                    <div className="col-span-3 text-sm font-black text-slate-800 uppercase tracking-tight">{activity.subject}</div>
                    <div className="col-span-4 text-[11px] text-slate-500 font-medium truncate">{activity.summary}</div>
                    <div className="col-span-3 text-right flex items-center justify-end gap-3">
                      <span className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm ${
                        activity.status === 'Paham' 
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                          : 'bg-amber-100 text-amber-700 border border-amber-200'
                      }`}>
                        {activity.status}
                      </span>
                      <button 
                        type="button"
                        onClick={() => setActivityToDelete(activity)}
                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Daily Input Form Card */}
        <div className="lg:col-span-4 bg-slate-900 rounded-[3rem] p-10 text-white flex flex-col shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl" />
          
          <h2 className="text-2xl font-black mb-8 tracking-tight uppercase flex items-center gap-3">
            <Plus className="text-indigo-500" />
            Input Harian
          </h2>
          
          <form onSubmit={handleAddActivity} className="space-y-6 flex-1 flex flex-col">
            <div>
              <label className="text-[9px] uppercase font-black text-slate-500 tracking-[0.2em] block mb-2">Nama Pelajaran</label>
              <input
                type="text"
                required
                value={newActivity.subject}
                onChange={e => setNewActivity({...newActivity, subject: e.target.value})}
                className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-[11px] font-bold text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all uppercase tracking-widest"
                placeholder="MISAL: KIMIA ORGANIK"
              />
            </div>
            
            <div>
              <label className="text-[9px] uppercase font-black text-slate-500 tracking-[0.2em] block mb-2">Ringkasan Materi</label>
              <textarea
                required
                rows={5}
                value={newActivity.summary}
                onChange={e => setNewActivity({...newActivity, summary: e.target.value})}
                className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-[11px] font-medium text-white resize-none outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all"
                placeholder="Apa yang dipelajari hari ini?"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[9px] uppercase font-black text-slate-500 tracking-[0.2em] block mb-2">Status Pemahaman</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewActivity({...newActivity, status: 'Paham'})}
                    className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                      newActivity.status === 'Paham' 
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                        : 'border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    PAHAM
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewActivity({...newActivity, status: 'Butuh Review'})}
                    className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                      newActivity.status === 'Butuh Review' 
                        ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20' 
                        : 'border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    REVIEW
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-5 bg-indigo-500 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.3em] hover:bg-indigo-400 transition-all shadow-xl shadow-indigo-500/20 mt-auto flex items-center justify-center gap-3 active:scale-95"
            >
              Kirim Data
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
      {/* Modals Section */}
      <AnimatePresence>
        {/* Delete Activity Modal */}
        {activityToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActivityToDelete(null)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Hapus Catatan?</h3>
              <p className="text-sm text-slate-500 mt-2 italic px-4">
                "{activityToDelete.subject}"
              </p>
              <div className="grid grid-cols-2 gap-3 mt-8">
                <button
                  onClick={() => setActivityToDelete(null)}
                  className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDeleteActivity}
                  className="px-6 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-rose-700 transition-all"
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Student Modal */}
        {showDeleteStudentModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteStudentModal(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center"
            >
              <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3">
                <AlertCircle size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Hapus Siswa?</h3>
              <p className="text-sm text-slate-500 mt-3">
                Anda akan menghapus data <strong>{student.name}</strong> secara permanen. Seluruh riwayat belajar akan terhapus.
              </p>
              <div className="flex flex-col gap-3 mt-8">
                <button
                  onClick={confirmDeleteStudent}
                  className="w-full py-4 bg-rose-600 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-rose-700 transition-all shadow-xl shadow-rose-100"
                >
                  Konfirmasi Hapus Data
                </button>
                <button
                  onClick={() => setShowDeleteStudentModal(false)}
                  className="w-full py-4 bg-slate-100 text-slate-500 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-slate-200 transition-all font-mono"
                >
                  Batalkan Tindakan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
