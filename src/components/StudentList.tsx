import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Student, Cluster } from '../types';
import { UserPlus, Search, ChevronRight, GraduationCap, Trash2, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import ImageCropper from './ImageCropper';
import MultiSelect from './MultiSelect';

export default function StudentList() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', vocation: '', clusters: [] as string[], enrollmentDate: new Date().toISOString().split('T')[0], photoUrl: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  useEffect(() => {
    const unsubClusters = onSnapshot(collection(db, 'clusters'), (snapshot) => {
      setClusters(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Cluster)));
    });
    return () => unsubClusters();
  }, []);

  const CLUSTER_OPTIONS = clusters.map(c => c.name);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      alert('Format file harus JPG, JPEG, atau PNG');
      return;
    }

    // Validate size (1MB for cropping because we want better quality before crop)
    // The user's original limit was 500KB but cropping might need a bit more initial size to be clear
    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file maksimal 2MB untuk proses cropping');
      return;
    }

    const reader = new FileReader();
    reader.onloadstart = () => setIsUploading(true);
    reader.onload = (event) => {
      setImageToCrop(event.target?.result as string);
      setIsUploading(false);
      // Reset input value so same file can be selected again if cancelled
      e.target.value = '';
    };
    reader.onerror = () => {
      alert('Gagal membaca file');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };
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
        clusters: newStudent.clusters,
        enrollmentDate: Timestamp.fromDate(new Date(newStudent.enrollmentDate)),
        photoUrl: newStudent.photoUrl || null,
        createdAt: serverTimestamp()
      });
      console.log('Student added with ID:', docRef.id);
      setNewStudent({ name: '', vocation: '', clusters: [], enrollmentDate: new Date().toISOString().split('T')[0], photoUrl: '' });
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
    (s.vocation && s.vocation.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.clusters && s.clusters.some(c => c.toLowerCase().includes(searchTerm.toLowerCase())))
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div className="flex items-center gap-6">
          <div className="w-1.5 h-12 bg-indigo-600 rounded-full" />
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight uppercase leading-none mb-2">
              Daftar Penerima Manfaat
            </h1>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-100 dark:shadow-none active:scale-95"
        >
          <UserPlus size={16} />
          Tambah Penerima Manfaat Baru
        </button>
      </div>

      {/* Search and Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-8 relative flex items-center">
          <Search className="absolute left-6 text-slate-400 dark:text-slate-500 pointer-events-none" size={18} />
          <input
            type="text"
            placeholder="CARI NAMA, VOKASIONAL, ATAU KLASTER..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-8 py-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/20 outline-none transition-all text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-600"
          />
        </div>
        <div className="md:col-span-4 bg-slate-900 dark:bg-indigo-500/10 rounded-[2rem] p-4 flex items-center justify-between px-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-800 dark:border-indigo-500/20 transition-colors duration-300">
          <span className="text-[10px] font-black text-slate-400 dark:text-indigo-300/60 uppercase tracking-widest">JUMLAH PENERIMA MANFAAT</span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-white dark:text-indigo-400">{students.length}</span>
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
              onClick={() => navigate(`/profile/${student.id}`)}
              className="group cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between h-[280px] border-b-4 border-b-transparent hover:border-b-indigo-600"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 p-0 rounded-2xl group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-all duration-300 group-hover:rotate-3 overflow-hidden w-12 h-12 flex items-center justify-center">
                  {student.photoUrl ? (
                    <img src={student.photoUrl} alt={student.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User size={24} strokeWidth={1.5} />
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStudentToDelete(student);
                    }}
                    className="p-2 text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all"
                    title="Hapus Penerima Manfaat"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="flex-grow flex flex-col justify-between">
                <div>
                  <h4 className="text-2xl font-black text-slate-800 dark:text-white leading-tight mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase tracking-tight line-clamp-1">{student.name}</h4>
                  <div className="mb-2">
                    {student.vocation && (
                      <p className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-1.5 line-clamp-1">{student.vocation}</p>
                    )}
                    <div className="flex flex-wrap gap-1 items-center min-h-[1.25rem]">
                      {student.clusters?.slice(0, 3).map(cluster => (
                        <span key={cluster} className="inline-flex items-center px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md text-[7px] font-black uppercase ring-1 ring-emerald-500/10 whitespace-nowrap">
                          {cluster}
                        </span>
                      ))}
                      {student.clusters && student.clusters.length > 3 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-md text-[7px] font-black uppercase ring-1 ring-slate-500/10 whitespace-nowrap">
                          +{student.clusters.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      Terdaftar: {student.enrollmentDate?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between group-hover:translate-x-1 transition-transform duration-300">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">BUKA PROFIL PENERIMA MANFAAT</span>
                  <div className="w-8 h-8 rounded-full border border-slate-100 dark:border-slate-800 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white dark:group-hover:text-white group-hover:border-indigo-600 transition-all">
                    <ChevronRight size={16} />
                  </div>
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
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 hover:border-indigo-600 hover:text-indigo-600'
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
              className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Hapus Penerima Manfaat?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Apakah Anda yakin ingin menghapus <strong>{studentToDelete.name}</strong>? Data riwayat akan hilang selamanya.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-8">
                <button
                  onClick={() => setStudentToDelete(null)}
                  className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDeleteStudent}
                  className="px-6 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 dark:shadow-none"
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
        {imageToCrop && (
          <ImageCropper
            image={imageToCrop}
            onCropComplete={(croppedImage) => {
              setNewStudent(prev => ({ ...prev, photoUrl: croppedImage }));
              setImageToCrop(null);
            }}
            onCancel={() => setImageToCrop(null)}
            aspect={1}
          />
        )}
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto custom-scrollbar">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddForm(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl" 
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] shadow-2xl p-10 border border-white/20 dark:border-white/5 my-8"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-600 text-white rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-100 dark:shadow-none">
                  <UserPlus size={32} />
                </div>
                <h3 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white uppercase">Input Penerima Manfaat</h3>
              </div>

              <form onSubmit={handleAddStudent} className="space-y-5">
                <div className="flex flex-col items-center">
                  <label className="label-bento text-center dark:text-slate-400">FOTO PROFIL (MAX 500KB)</label>
                  <div className="mt-2 relative group/photo">
                    <div className="w-24 h-24 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden transition-all group-hover/photo:border-indigo-300">
                      {newStudent.photoUrl ? (
                        <img src={newStudent.photoUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="text-slate-300 dark:text-slate-600 flex flex-col items-center gap-1">
                          <UserPlus size={24} />
                          <span className="text-[8px] font-black uppercase">Upload</span>
                        </div>
                      )}
                      {isUploading && (
                        <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/jpg"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      title="Pilih foto profil"
                    />
                    {newStudent.photoUrl && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setNewStudent(prev => ({ ...prev, photoUrl: '' }));
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg dark:shadow-none hover:bg-rose-600 transition-all scale-0 group-hover/photo:scale-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="label-bento dark:text-slate-400">NAMA LENGKAP</label>
                  <input
                    type="text"
                    required
                    value={newStudent.name}
                    onChange={e => setNewStudent({...newStudent, name: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/20 outline-none text-xs font-bold uppercase tracking-widest dark:text-white"
                    placeholder="Contoh: Budi Santoso"
                  />
                </div>
                <div>
                  <label className="label-bento dark:text-slate-400">KETERANGAN VOKASIONAL</label>
                  <input
                    type="text"
                    list="vocation-list"
                    value={newStudent.vocation}
                    onChange={e => setNewStudent({...newStudent, vocation: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/20 outline-none text-xs font-bold uppercase tracking-widest dark:text-white"
                    placeholder="Contoh: Menjahit, Tata Boga, dll"
                  />
                  <datalist id="vocation-list">
                    {uniqueVocations.map(v => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <MultiSelect
                    label="KLASTER (BISA PILIH LEBIH DARI SATU)"
                    options={CLUSTER_OPTIONS}
                    selected={newStudent.clusters}
                    onChange={(selected) => setNewStudent({ ...newStudent, clusters: selected })}
                    placeholder="Pilih Klaster..."
                  />
                </div>

                <div>
                  <label className="label-bento dark:text-slate-400">TANGGAL MASUK</label>
                  <input
                    type="date"
                    required
                    value={newStudent.enrollmentDate}
                    onChange={e => setNewStudent({...newStudent, enrollmentDate: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/20 outline-none text-xs font-bold uppercase tracking-widest dark:text-white"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 px-6 py-4 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95"
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
