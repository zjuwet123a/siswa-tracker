import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, Timestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Student, Activity } from '../types';
import { ArrowLeft, Calendar, BookOpen, Clock, CheckCircle2, AlertCircle, Plus, Send, Trash2, Edit2, Download, User, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useParams, useNavigate } from 'react-router-dom';

export default function StudentDetail() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [localStudent, setLocalStudent] = useState<Student | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentNotFound, setStudentNotFound] = useState(false);
  const [newActivity, setNewActivity] = useState({
    date: new Date().toISOString().split('T')[0],
    classActivity: '',
    results: ''
  });

  useEffect(() => {
    if (!studentId) return;

    // Listen to student document for real-time updates (name, vocation, etc)
    const unsubscribeStudent = onSnapshot(doc(db, 'students', studentId), (snapshot) => {
      if (snapshot.exists()) {
        const studentData = { id: snapshot.id, ...snapshot.data() } as Student;
        setLocalStudent(studentData);
        setEditFormData({
          name: studentData.name,
          vocation: studentData.vocation || '',
          enrollmentDate: studentData.enrollmentDate?.toDate().toISOString().split('T')[0] || '',
          photoUrl: studentData.photoUrl || ''
        });
        setStudentNotFound(false);
      } else {
        setStudentNotFound(true);
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `student ${studentId}`);
    });

    const q = query(
      collection(db, `students/${studentId}/activities`),
      orderBy('date', 'asc'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribeActivities = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Activity[];
      setActivities(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `student activities for ${studentId}`);
    });

    return () => {
      unsubscribeStudent();
      unsubscribeActivities();
    };
  }, [studentId]);

  // Initial state for edit form should be handled after student load
  // We'll use useEffect to sync localStudent changes to editFormData
  const [editFormData, setEditFormData] = useState({
    name: '',
    vocation: '',
    enrollmentDate: '',
    photoUrl: ''
  });

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !newActivity.classActivity || !newActivity.results) return;

    try {
      await addDoc(collection(db, `students/${studentId}/activities`), {
        studentId: studentId,
        date: Timestamp.fromDate(new Date(newActivity.date)),
        classActivity: newActivity.classActivity.trim(),
        results: newActivity.results.trim(),
        createdAt: serverTimestamp()
      });
      setNewActivity({
        date: new Date().toISOString().split('T')[0],
        classActivity: '',
        results: ''
      });
      alert('Data aktivitas berhasil disimpan!');
    } catch (error) {
      alert('Gagal menyimpan aktivitas: ' + (error instanceof Error ? error.message : 'Unknown error'));
      handleFirestoreError(error, OperationType.WRITE, `add activity for ${studentId}`);
    }
  };

  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [activityToEdit, setActivityToEdit] = useState<Activity | null>(null);
  const [editActivityForm, setEditActivityForm] = useState({
    date: '',
    classActivity: '',
    results: ''
  });
  const [showDeleteStudentModal, setShowDeleteStudentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);

  const handleEditPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      alert('Format file harus JPG, JPEG, atau PNG');
      return;
    }

    if (file.size > 500 * 1024) {
      alert('Ukuran file maksimal 500KB');
      return;
    }

    const reader = new FileReader();
    reader.onloadstart = () => setIsPhotoUploading(true);
    reader.onload = (event) => {
      setEditFormData(prev => ({ ...prev, photoUrl: event.target?.result as string }));
      setIsPhotoUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localStudent || !editFormData.name.trim()) return;

    try {
      await updateDoc(doc(db, 'students', localStudent.id), {
        name: editFormData.name.trim(),
        vocation: editFormData.vocation.trim(),
        enrollmentDate: Timestamp.fromDate(new Date(editFormData.enrollmentDate)),
        photoUrl: editFormData.photoUrl || null,
        updatedAt: serverTimestamp()
      });
      setShowEditModal(false);
      alert('Data berhasil diperbarui!');
    } catch (error) {
      alert('Gagal memperbarui data: ' + (error instanceof Error ? error.message : 'Unknown error'));
      handleFirestoreError(error, OperationType.UPDATE, `student ${localStudent.id}`);
    }
  };

  const handleEditActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localStudent || !activityToEdit || !editActivityForm.classActivity || !editActivityForm.results) return;

    try {
      await updateDoc(doc(db, `students/${localStudent.id}/activities`, activityToEdit.id), {
        date: Timestamp.fromDate(new Date(editActivityForm.date)),
        classActivity: editActivityForm.classActivity.trim(),
        results: editActivityForm.results.trim(),
        updatedAt: serverTimestamp()
      });
      setActivityToEdit(null);
      alert('Data aktivitas berhasil diperbarui!');
    } catch (error) {
      alert('Gagal memperbarui aktivitas: ' + (error instanceof Error ? error.message : 'Unknown error'));
      handleFirestoreError(error, OperationType.UPDATE, `activity ${activityToEdit.id}`);
    }
  };

  const openEditActivityModal = (activity: Activity) => {
    setActivityToEdit(activity);
    setEditActivityForm({
      date: activity.date?.toDate().toISOString().split('T')[0] || '',
      classActivity: activity.classActivity,
      results: activity.results
    });
  };

  const confirmDeleteActivity = async () => {
    if (!activityToDelete || !localStudent) return;

    try {
      await deleteDoc(doc(db, `students/${localStudent.id}/activities`, activityToDelete.id));
      setActivityToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `activity ${activityToDelete.id}`);
    }
  };

  const confirmDeleteStudent = async () => {
    if (!localStudent) return;
    try {
      await deleteDoc(doc(db, 'students', localStudent.id));
      setShowDeleteStudentModal(false);
      navigate('/penerima-manfaat');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `student ${localStudent.id}`);
    }
  };

  const handleExportPDF = () => {
    if (!localStudent) return;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text('LAPORAN KEGIATAN', 14, 22);
    doc.setFontSize(14);
    doc.text('PENERIMA MANFAAT', 14, 30);
    
    // Line separator
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(14, 35, 196, 35);

    // Profile Info
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('NAMA LENGKAP:', 14, 45);
    doc.text('VOKASIONAL:', 14, 52);
    doc.text('TANGGAL MASUK:', 14, 59);
    doc.text('TOTAL SESI:', 14, 66);
    
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFont('helvetica', 'bold');
    doc.text(localStudent.name.toUpperCase(), 50, 45);
    doc.text((localStudent.vocation || '-').toUpperCase(), 50, 52);
    doc.text(localStudent.enrollmentDate?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase() || '-', 50, 59);
    doc.text(activities.length.toString(), 50, 66);
    
    // Table
    const tableData = activities.map(activity => [
      activity.date?.toDate().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
      activity.classActivity,
      activity.results
    ]);

    autoTable(doc, {
      startY: 75,
      head: [['TANGGAL', 'KEGIATAN KELAS', 'HASIL KEGIATAN']],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [79, 70, 229], // indigo-600
        textColor: [255, 255, 255], 
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center'
      },
      styles: { 
        fontSize: 8, 
        cellPadding: 5,
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 30, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 'auto' }
      },
      margin: { top: 75 }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `Dicetak pada: ${new Date().toLocaleString('id-ID')}`,
        14,
        doc.internal.pageSize.height - 10
      );
      doc.text(
        `Halaman ${i} dari ${pageCount}`,
        doc.internal.pageSize.width - 40,
        doc.internal.pageSize.height - 10
      );
    }

    doc.save(`Laporan_${localStudent.name.replace(/\s+/g, '_')}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Menghubungkan ke Arsip Digital...</p>
      </div>
    );
  }

  if (studentNotFound || !localStudent) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-6">
        <div className="w-24 h-24 bg-slate-100 rounded-[2rem] flex items-center justify-center text-slate-300">
          <AlertCircle size={48} />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-slate-800 uppercase">PM Tidak Ditemukan</h2>
          <p className="text-slate-400 mt-2">Data yang Anda cari tidak tersedia atau telah dihapus.</p>
        </div>
        <button
          onClick={() => navigate('/penerima-manfaat')}
          className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100"
        >
          <ArrowLeft size={16} />
          Kembali ke Daftar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/penerima-manfaat')}
          className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Kembali ke Daftar
        </button>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 hover:text-indigo-700 transition-all px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-100"
          >
            <Edit2 size={16} />
            Edit Profile
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteStudentModal(true)}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-rose-400 hover:text-rose-600 transition-all px-4 py-2 rounded-xl"
          >
            <Trash2 size={16} />
            Hapus Penerima Manfaat
          </button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Profile Card */}
        <div className="lg:col-span-12 bg-indigo-600 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl flex flex-col md:flex-row md:items-center gap-10 min-h-[300px]">
          <div className="absolute top-[-30px] right-[-30px] w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse" />
          
          {/* Profile Photo */}
          <div className="relative z-10 w-48 h-48 rounded-[2.5rem] bg-indigo-500/30 border-4 border-white/20 overflow-hidden flex-shrink-0 shadow-2xl flex items-center justify-center">
            {localStudent.photoUrl ? (
              <img src={localStudent.photoUrl} alt={localStudent.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <User size={80} className="text-white/20" strokeWidth={1} />
            )}
          </div>

          <div className="relative z-10 flex-1">
            <span className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.3em] mb-2 block">BIODATA PENERIMA MANFAAT</span>
            <h2 className="text-5xl font-black tracking-tighter uppercase mb-2">{localStudent.name}</h2>
            {localStudent.vocation && (
              <p className="text-sm font-black text-indigo-100 uppercase tracking-widest mb-4">
                Vokasional: {localStudent.vocation}
              </p>
            )}
            <p className="text-lg font-medium text-indigo-100 opacity-80 mb-6">
              Masuk: {localStudent.enrollmentDate?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            
            <div className="flex gap-12 border-t border-white/10 pt-8">
              <div className="space-y-1">
                <p className="text-[9px] text-indigo-200 uppercase font-black tracking-widest opacity-60">Total Sesi Belajar</p>
                <p className="text-3xl font-black">{activities.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* History Table Card */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-[3rem] p-10 flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
              <div className="w-2 h-8 bg-indigo-600 rounded-full" />
              Riwayat Belajar PM
            </h3>
            {activities.length > 0 && (
              <button 
                onClick={handleExportPDF}
                className="flex items-center gap-2 text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-4 py-2 rounded-full hover:bg-indigo-100 transition-colors"
              >
                <Download size={14} />
                Export Report
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-4 pb-4 border-b-2 border-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">
              <div className="col-span-3">Tanggal Kegiatan</div>
              <div className="col-span-4">Kegiatan Kelas</div>
              <div className="col-span-4">Hasil Kegiatan</div>
              <div className="col-span-1 text-right">Aksi</div>
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {loading ? (
                <div className="text-center py-20 text-[10px] font-black text-slate-400 uppercase tracking-widest">Memuat data...</div>
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
                    <div className="col-span-3 text-xs font-black text-slate-800 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">
                      {activity.date?.toDate().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}
                    </div>
                    <div className="col-span-4 text-[11px] text-slate-500 font-medium">{activity.classActivity}</div>
                    <div className="col-span-4 text-[11px] text-indigo-600 font-bold italic">{activity.results}</div>
                    <div className="col-span-1 text-right flex items-center justify-end gap-1">
                      <button 
                        type="button"
                        onClick={() => openEditActivityModal(activity)}
                        className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      >
                        <Edit2 size={14} />
                      </button>
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
              <label className="text-[9px] uppercase font-black text-slate-500 tracking-[0.2em] block mb-2">Tanggal Kegiatan</label>
              <input
                type="date"
                required
                value={newActivity.date}
                onChange={e => setNewActivity({...newActivity, date: e.target.value})}
                className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-[11px] font-bold text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all uppercase tracking-widest"
              />
            </div>
            
            <div>
              <label className="text-[9px] uppercase font-black text-slate-500 tracking-[0.2em] block mb-2">Kegiatan Kelas</label>
              <textarea
                required
                rows={3}
                value={newActivity.classActivity}
                onChange={e => setNewActivity({...newActivity, classActivity: e.target.value})}
                className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-[11px] font-medium text-white resize-none outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all font-sans"
                placeholder="Apa kegiatan di kelas hari ini?"
              />
            </div>
            
            <div>
              <label className="text-[9px] uppercase font-black text-slate-500 tracking-[0.2em] block mb-2">Hasil Kegiatan</label>
              <textarea
                required
                rows={3}
                value={newActivity.results}
                onChange={e => setNewActivity({...newActivity, results: e.target.value})}
                className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-[11px] font-medium text-white resize-none outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all font-sans"
                placeholder="Bagaimana hasil kegiatannya?"
              />
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
        {/* Edit Activity Modal */}
        {activityToEdit && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActivityToEdit(null)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Edit2 size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Edit Kegiatan</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Ubah riwayat belajar ini</p>
                </div>
              </div>

              <form onSubmit={handleEditActivity} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tanggal Kegiatan</label>
                  <input
                    type="date"
                    required
                    value={editActivityForm.date}
                    onChange={e => setEditActivityForm({...editActivityForm, date: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 outline-none text-xs font-bold uppercase tracking-widest"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Kegiatan Kelas</label>
                  <textarea
                    required
                    rows={3}
                    value={editActivityForm.classActivity}
                    onChange={e => setEditActivityForm({...editActivityForm, classActivity: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 resize-none outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-sans"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Hasil Kegiatan</label>
                  <textarea
                    required
                    rows={3}
                    value={editActivityForm.results}
                    onChange={e => setEditActivityForm({...editActivityForm, results: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 resize-none outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-sans"
                  />
                </div>
                
                <div className="flex flex-col gap-3 pt-4">
                  <button
                    type="submit"
                    className="w-full py-4 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                  >
                    Simpan Perubahan
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityToEdit(null)}
                    className="w-full py-4 bg-slate-100 text-slate-500 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-slate-200 transition-all"
                  >
                    Batalkan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

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
              <p className="text-sm text-slate-500 mt-2">
                Hapus catatan kegiatan ini?
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

        {/* Edit Student Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Edit2 size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Edit Profile</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Ubah Data Penerima Manfaat</p>
                </div>
              </div>

              <form onSubmit={handleEditStudent} className="space-y-5">
                <div className="flex flex-col items-center">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Foto Profil</label>
                  <div className="relative group/photo">
                    <div className="w-24 h-24 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-all group-hover/photo:border-indigo-300 shadow-sm">
                      {editFormData.photoUrl ? (
                        <img src={editFormData.photoUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="text-slate-300 flex flex-col items-center gap-1">
                          <Plus size={24} />
                          <span className="text-[8px] font-black uppercase">Upload</span>
                        </div>
                      )}
                      {isPhotoUploading && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/jpg"
                      onChange={handleEditPhotoChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    {editFormData.photoUrl && (
                      <button
                        type="button"
                        onClick={() => setEditFormData({...editFormData, photoUrl: ''})}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-rose-600 transition-all scale-0 group-hover/photo:scale-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={e => setEditFormData({...editFormData, name: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 outline-none text-xs font-bold uppercase tracking-widest"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Vokasional</label>
                  <input
                    type="text"
                    value={editFormData.vocation}
                    onChange={e => setEditFormData({...editFormData, vocation: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 outline-none text-xs font-bold uppercase tracking-widest"
                    placeholder="Contoh: Menjahit, Tata Boga"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tanggal Masuk</label>
                  <input
                    type="date"
                    required
                    value={editFormData.enrollmentDate}
                    onChange={e => setEditFormData({...editFormData, enrollmentDate: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 outline-none text-xs font-bold uppercase tracking-widest"
                  />
                </div>
                
                <div className="flex flex-col gap-3 pt-4">
                  <button
                    type="submit"
                    className="w-full py-4 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                  >
                    Simpan Perubahan
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="w-full py-4 bg-slate-100 text-slate-500 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-slate-200 transition-all"
                  >
                    Batalkan
                  </button>
                </div>
              </form>
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
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Hapus Penerima Manfaat?</h3>
              <p className="text-sm text-slate-500 mt-3">
                Anda akan menghapus data <strong>{localStudent.name}</strong> secara permanen. Seluruh riwayat belajar akan terhapus.
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
