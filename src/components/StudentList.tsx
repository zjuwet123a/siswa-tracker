import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Student } from '../types';
import { UserPlus, Search, ChevronRight, GraduationCap, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StudentListProps {
  onSelectStudent: (student: Student) => void;
}

export default function StudentList({ onSelectStudent }: StudentListProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', vocation: '', enrollmentDate: new Date().toISOString().split('T')[0] });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    const q = query(collection(db, 'students'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Student[];
      setStudents(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'students');
    });

    return () => unsubscribe();
  }, []);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.enrollmentDate) return;

    try {
      console.log('Adding student...', newStudent);
      const docRef = await addDoc(collection(db, 'students'), {
        name: newStudent.name.trim(),
        vocation: newStudent.vocation.trim(),
        enrollmentDate: Timestamp.fromDate(new Date(newStudent.enrollmentDate)),
        createdAt: serverTimestamp()
      });
      console.log('Student added with ID:', docRef.id);
      setNewStudent({ name: '', vocation: '', enrollmentDate: new Date().toISOString().split('T')[0] });
      setShowAddForm(false);
      alert('Data berhasil disimpan!');
    } catch (error) {
      console.error('Add student failed:', error);
      alert('Gagal menyimpan data: ' + (error instanceof Error ? error.message : 'Unknown error'));
      handleFirestoreError(error, OperationType.WRITE, 'students');
    }
  };

  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  const confirmDeleteStudent = async () => {
    if (!studentToDelete) return;

    try {
      setLoading(true);
      await deleteDoc(doc(db, 'students', studentToDelete.id));
      setStudentToDelete(null);
    } catch (error) {
      console.error('Delete student failed:', error);
      handleFirestoreError(error, OperationType.DELETE, `student ${studentToDelete.id}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.vocation && s.vocation.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const uniqueVocations = Array.from(
    new Set(
      students
        .map(s => s.vocation?.trim())
        .filter((v): v is string => !!v && v !== '')
    )
  ).sort();

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Penerima Manfaat Terdaftar</h2>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-100 active:scale-95"
        >
          <UserPlus size={16} />
          Tambah Penerima Manfaat Baru
        </button>
      </div>

      {/* Search and Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-8 relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="CARI NAMA ATAU VOKASIONAL..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-8 py-4.5 bg-white border border-slate-200 rounded-[2rem] focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-[11px] font-black uppercase tracking-widest text-slate-600 shadow-sm"
          />
        </div>
        <div className="md:col-span-4 bg-slate-900 rounded-[2rem] p-4 flex items-center justify-between px-8 shadow-xl">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">JUMLAH PENERIMA MANFAAT</span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-white">{students.length}</span>
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">ORANG</span>
          </div>
        </div>
      </div>

      {/* Student Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-24 text-center text-slate-400 font-black uppercase tracking-widest text-[10px]">Memuat data dari database...</div>
        ) : paginatedStudents.length === 0 ? (
          <div className="col-span-full py-24 text-center text-slate-400 font-black uppercase tracking-widest text-[10px]">Tidak ada data ditemukan</div>
        ) : (
          paginatedStudents.map((student, idx) => (
            <motion.div
              key={student.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onSelectStudent(student)}
              className="group cursor-pointer bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between h-64 border-b-4 border-b-transparent hover:border-b-indigo-600"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="bg-slate-50 text-slate-400 p-3 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 group-hover:rotate-6">
                  <GraduationCap size={24} />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStudentToDelete(student);
                    }}
                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                    title="Hapus Penerima Manfaat"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div>
                <h4 className="text-2xl font-black text-slate-800 leading-tight mb-1 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{student.name}</h4>
                {student.vocation && (
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2">{student.vocation}</p>
                )}
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Terdaftar: {student.enrollmentDate?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between group-hover:translate-x-1 transition-transform duration-300">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">BUKA PROFIL PENERIMA MANFAAT</span>
                <div className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all">
                  <ChevronRight size={16} />
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i + 1}
              onClick={() => {
                setCurrentPage(i + 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`w-10 h-10 rounded-xl text-[11px] font-black transition-all ${
                currentPage === i + 1
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                  : 'bg-white border border-slate-200 text-slate-400 hover:border-indigo-600 hover:text-indigo-600'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {studentToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setStudentToDelete(null)}
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
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Hapus Penerima Manfaat?</h3>
              <p className="text-sm text-slate-500 mt-2">
                Apakah Anda yakin ingin menghapus <strong>{studentToDelete.name}</strong>? Data riwayat akan hilang selamanya.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-8">
                <button
                  onClick={() => setStudentToDelete(null)}
                  className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDeleteStudent}
                  className="px-6 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Form Modal */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddForm(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" 
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 border border-white/20"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-600 text-white rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-100">
                  <UserPlus size={32} />
                </div>
                <h3 className="text-2xl font-black tracking-tight text-slate-800 uppercase">Input Penerima Manfaat</h3>
              </div>

              <form onSubmit={handleAddStudent} className="space-y-5">
                <div>
                  <label className="label-bento">NAMA LENGKAP</label>
                  <input
                    type="text"
                    required
                    value={newStudent.name}
                    onChange={e => setNewStudent({...newStudent, name: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 outline-none text-xs font-bold uppercase tracking-widest"
                    placeholder="Contoh: Budi Santoso"
                  />
                </div>
                <div>
                  <label className="label-bento">KETERANGAN VOKASIONAL</label>
                  <input
                    type="text"
                    list="vocation-list"
                    value={newStudent.vocation}
                    onChange={e => setNewStudent({...newStudent, vocation: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 outline-none text-xs font-bold uppercase tracking-widest"
                    placeholder="Contoh: Menjahit, Tata Boga, dll"
                  />
                  <datalist id="vocation-list">
                    {uniqueVocations.map(v => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="label-bento">TANGGAL MASUK</label>
                  <input
                    type="date"
                    required
                    value={newStudent.enrollmentDate}
                    onChange={e => setNewStudent({...newStudent, enrollmentDate: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 outline-none text-xs font-bold uppercase tracking-widest"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 px-6 py-4 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                  >
                    Simpan Data
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
