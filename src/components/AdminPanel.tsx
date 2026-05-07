import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, deleteDoc, doc, serverTimestamp, setDoc, updateDoc, collectionGroup } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { Cluster, Category, UserData, Vocation } from '../types';
import { Plus, Trash2, Users, Layers, Tag, Shield, Loader2, UserPlus, Mail, Lock, CheckCircle2, AlertCircle, LogOut, Pencil, UserCog, Image as ImageIcon, GraduationCap, Upload, Crop, Settings, Briefcase, UserRound, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Cropper from 'react-easy-crop';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

type Tab = 'add_user' | 'all_users' | 'active_users' | 'beneficiaries' | 'settings';
type SettingsTab = 'website' | 'clusters' | 'categories' | 'vocations';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('add_user');
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('website');
  const isSuperAdmin = auth.currentUser?.email === 'akundatakantor@gmail.com';
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vocations, setVocations] = useState<Vocation[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Beneficiaries States
  const [beneficiarySearch, setBeneficiarySearch] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [viewingStudent, setViewingStudent] = useState<any | null>(null);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const [newItem, setNewItem] = useState('');
  const [newItemRequiresFile, setNewItemRequiresFile] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // New User States
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'operator'>('operator');
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [addUserSuccess, setAddUserSuccess] = useState(false);
  const [confirmLogoutUser, setConfirmLogoutUser] = useState<UserData | null>(null);
  const [forceLogoutProcessing, setForceLogoutProcessing] = useState(false);

  // Edit User States
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [updateUserName, setUpdateUserName] = useState('');
  const [updateUserRole, setUpdateUserRole] = useState<'admin' | 'operator'>('operator');
  const [updateUserLoading, setUpdateUserLoading] = useState(false);
  
  // Delete User States
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserData | null>(null);
  const [deleteValidationCode, setDeleteValidationCode] = useState('');
  const [userInputDeleteCode, setUserInputDeleteCode] = useState('');
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);

  // Edit Item (Cluster/Category/Vocation) States
  const [editingItem, setEditingItem] = useState<{ id: string, name: string, type: 'clusters' | 'categories' | 'vocations', requiresAttachment?: boolean, instructors?: string[] } | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, name: string, type: 'clusters' | 'categories' | 'vocations' } | null>(null);
  const [updateItemName, setUpdateItemName] = useState('');
  const [updateItemRequiresFile, setUpdateItemRequiresFile] = useState(false);
  const [updateItemInstructors, setUpdateItemInstructors] = useState<string[]>([]);
  const [newInstructorName, setNewInstructorName] = useState('');
  const [newItemInstructors, setNewItemInstructors] = useState<string[]>([]);
  const [newItemInstructorInput, setNewItemInstructorInput] = useState('');
  const [updateItemLoading, setUpdateItemLoading] = useState(false);

  // Settings States
  const [logoUrl, setLogoUrl] = useState('');
  const [saveSettingsLoading, setSaveSettingsLoading] = useState(false);
  
  // Active User Search State
  const [activeUserSearch, setActiveUserSearch] = useState('');
  
  // Image Upload & Crop States
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCropping, setIsCropping] = useState(false);

  const generateRandomCode = () => {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  };

  useEffect(() => {
    const unsubClusters = onSnapshot(collection(db, 'clusters'), (snapshot) => {
      setClusters(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Cluster)));
    });

    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    });

    const unsubVocations = onSnapshot(collection(db, 'vocations'), (snapshot) => {
      setVocations(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Vocation)));
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'website'), (snapshot) => {
      if (snapshot.exists()) {
        setLogoUrl(snapshot.data().logoUrl || '');
      }
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserData)));
    }, (error) => {
      console.error("Error fetching users:", error);
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubActivities = onSnapshot(collectionGroup(db, 'activities'), (snapshot) => {
      // We'll store all activities then filter them in the render or derived state
      setActivities(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    setLoading(false);

    return () => {
      unsubClusters();
      unsubCategories();
      unsubSettings();
      unsubUsers();
      unsubStudents();
      unsubActivities();
    };
  }, []);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSettingsLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'website'), {
        logoUrl: logoUrl.trim(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      alert('Pengaturan website berhasil diperbarui.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/website');
    } finally {
      setSaveSettingsLoading(false);
    }
  };

  const onCropComplete = (_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return '';

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return canvas.toDataURL('image/jpeg', 0.9);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation: Type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      alert('Format file tidak didukung. Gunakan JPG, JPEG, atau PNG.');
      return;
    }

    // Validation: Size (500KB)
    if (file.size > 500 * 1024) {
      alert('Ukuran file terlalu besar. Maksimal 500 KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setIsCropping(true);
    };
    reader.readAsDataURL(file);
  };

  const applyCrop = async () => {
    if (!selectedImage || !croppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(selectedImage, croppedAreaPixels);
      setLogoUrl(croppedImage);
      setIsCropping(false);
      setSelectedImage(null);
    } catch (e) {
      console.error(e);
      alert('Gagal memproses gambar.');
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;

    setIsAdding(true);
    try {
      const collName = activeSettingsTab === 'clusters' ? 'clusters' : activeSettingsTab === 'categories' ? 'categories' : 'vocations';
      const data: any = {
        name: newItem.trim()
      };
      
      if (collName === 'categories') {
        data.requiresAttachment = newItemRequiresFile;
      }
      
      if (collName === 'vocations') {
        data.instructors = newItemInstructors;
      }

      console.log(`Attempting to add to ${collName}:`, data);
      const docRef = await addDoc(collection(db, collName), data);
      console.log(`Successfully added with ID: ${docRef.id}`);
      setNewItem('');
      setNewItemRequiresFile(false);
      setNewItemInstructors([]);
      setNewItemInstructorInput('');
      alert(`${activeSettingsTab === 'clusters' ? 'Klaster' : activeSettingsTab === 'categories' ? 'Penyusun' : 'Vokasional'} berhasil ditambahkan!`);
    } catch (error) {
      console.error('Error adding item:', error);
      handleFirestoreError(error, OperationType.WRITE, activeSettingsTab);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, itemToDelete.type, itemToDelete.id));
      setItemToDelete(null);
      setEditingItem(null); // Also close edit modal if open
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${itemToDelete.type}/${itemToDelete.id}`);
    }
  };

  const handleEditItem = (id: string, name: string, type: 'clusters' | 'categories' | 'vocations', requiresAttachment?: boolean, instructors?: string[]) => {
    setEditingItem({ id, name, type, requiresAttachment, instructors });
    setUpdateItemName(name);
    setUpdateItemRequiresFile(requiresAttachment || false);
    setUpdateItemInstructors(instructors || []);
  };

  const executeUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !updateItemName.trim()) return;
    setUpdateItemLoading(true);
    try {
      const updateData: any = {
        name: updateItemName.trim()
      };
      
      if (editingItem.type === 'categories') {
        updateData.requiresAttachment = updateItemRequiresFile;
      }

      if (editingItem.type === 'vocations') {
        updateData.instructors = updateItemInstructors;
      }

      await updateDoc(doc(db, editingItem.type, editingItem.id), updateData);
      setEditingItem(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${editingItem.type}/${editingItem.id}`);
    } finally {
      setUpdateItemLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserLoading(true);
    setAddUserError(null);

    try {
      // Create a secondary Firebase app to avoid logging out current admin
      const secondaryApp = getApps().find(app => app.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary');
      const secondaryAuth = getAuth(secondaryApp);

      const finalEmail = newUserEmail.includes('@') ? newUserEmail : `${newUserEmail.trim().toLowerCase()}@pm.com`;
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, finalEmail, newUserPassword);
      
      const { user } = userCredential;
      await updateProfile(user, { displayName: newUserName });

      // Save to users collection
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        displayName: newUserName,
        role: newUserRole,
        createdAt: serverTimestamp()
      });
      
      setAddUserSuccess(true);
      setTimeout(() => {
        setAddUserSuccess(false);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserRole('operator');
      }, 2000);
    } catch (error: any) {
      console.error('Add user error:', error);
      let message = 'Gagal menambah user.';
      if (error.code === 'auth/email-already-in-use') message = 'Email/Username sudah terdaftar.';
      setAddUserError(message);
    } finally {
      setAddUserLoading(false);
    }
  };

  const handleForceLogout = async (user: UserData) => {
    setConfirmLogoutUser(user);
  };

  const handleEditUser = (user: UserData) => {
    setEditingUser(user);
    setUpdateUserName(user.displayName || '');
    setUpdateUserRole(user.role as 'admin' | 'operator');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setUpdateUserLoading(true);
    try {
      await updateDoc(doc(db, 'users', editingUser.uid), {
        displayName: updateUserName,
        role: updateUserRole,
        updatedAt: serverTimestamp()
      });
      setEditingUser(null);
      alert('Data user berhasil diperbarui.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${editingUser.uid}`);
    } finally {
      setUpdateUserLoading(false);
    }
  };

  const handleDeleteUserClick = (user: UserData) => {
    setConfirmDeleteUser(user);
    setDeleteValidationCode(generateRandomCode());
    setUserInputDeleteCode('');
  };

  const executeDeleteUser = async () => {
    if (!confirmDeleteUser) return;
    if (userInputDeleteCode !== deleteValidationCode) {
      alert('Kode validasi tidak sesuai.');
      return;
    }

    setDeleteUserLoading(true);
    try {
      await deleteDoc(doc(db, 'users', confirmDeleteUser.uid));
      setConfirmDeleteUser(null);
      alert(`User ${confirmDeleteUser.displayName || confirmDeleteUser.email} berhasil dihapus.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${confirmDeleteUser.uid}`);
    } finally {
      setDeleteUserLoading(false);
    }
  };

  const executeForceLogout = async () => {
    if (!confirmLogoutUser) return;
    
    setForceLogoutProcessing(true);
    try {
      await updateDoc(doc(db, 'users', confirmLogoutUser.uid), {
        forceLogout: true,
        lastForceLogout: serverTimestamp()
      });
      setConfirmLogoutUser(null);
      alert(`Perintah logout telah dikirim ke ${confirmLogoutUser.displayName || confirmLogoutUser.email}.`);
    } catch (error) {
      console.error("Force logout error:", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${confirmLogoutUser.uid}`);
    } finally {
      setForceLogoutProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedStudents.length === 0) return;
    
    setBulkDeleteLoading(true);
    try {
      const { writeBatch, getDocs, collection, query, where } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      for (const id of selectedStudents) {
        // Delete student
        batch.delete(doc(db, 'students', id));
        
        // Delete related activities in subcollection
        const activitiesSnapshot = await getDocs(collection(db, `students/${id}/activities`));
        activitiesSnapshot.docs.forEach((activityDoc) => {
          batch.delete(activityDoc.ref);
        });

        // Fallback: Delete related activities in root collection (legacy data)
        const rootActivitiesSnapshot = await getDocs(query(collection(db, 'activities'), where('studentId', '==', id)));
        rootActivitiesSnapshot.docs.forEach((activityDoc) => {
          batch.delete(activityDoc.ref);
        });
      }
      
      await batch.commit();
      setSelectedStudents([]);
      setShowBulkDeleteConfirm(false);
      alert('Penerima manfaat dan laporan terkait berhasil dihapus.');
    } catch (error) {
      console.error("Bulk delete error:", error);
      alert('Gagal menghapus beberapa data. Silakan coba lagi.');
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 60000); // Refresh every minute to update status labels
    return () => clearInterval(interval);
  }, []);

  const getActiveUsers = () => {
    // Show users active in the last 15 minutes
    const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
    return users.filter(u => {
      // Don't show super admin as requested
      if (u.email === 'akundatakantor@gmail.com') return false;
      
      const lastActiveTs = u.lastActive;
      let lastActiveMillis = 0;
      
      if (lastActiveTs?.toDate) {
        lastActiveMillis = lastActiveTs.toDate().getTime();
      } else if (lastActiveTs instanceof Date) {
        lastActiveMillis = lastActiveTs.getTime();
      } else if (typeof lastActiveTs === 'number') {
        lastActiveMillis = lastActiveTs;
      }
      
      const isActive = lastActiveMillis > fifteenMinutesAgo;
      if (!isActive) return false;

      // Search filter
      if (activeUserSearch.trim()) {
        const search = activeUserSearch.toLowerCase();
        return (u.displayName?.toLowerCase().includes(search) || u.email?.toLowerCase().includes(search));
      }

      return true;
    });
  };

  const getStatusInfo = (lastActiveTs: any) => {
    let lastActiveMillis = 0;
    
    if (lastActiveTs?.toDate) {
      lastActiveMillis = lastActiveTs.toDate().getTime();
    } else if (lastActiveTs instanceof Date) {
      lastActiveMillis = lastActiveTs.getTime();
    } else if (typeof lastActiveTs === 'number') {
      lastActiveMillis = lastActiveTs;
    }

    const now = Date.now();
    const diff = now - lastActiveMillis;

    if (diff < 5 * 60 * 1000) {
      return { label: 'Online', color: 'bg-emerald-500', text: 'text-emerald-500' };
    } else {
      return { label: 'Idle', color: 'bg-amber-500', text: 'text-amber-500' };
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Memuat Panel Pengaturan...</p>
      </div>
    );
  }

  const activeUsersList = getActiveUsers().sort((a, b) => {
    const timeA = a.lastActive?.toDate?.()?.getTime() || 0;
    const timeB = b.lastActive?.toDate?.()?.getTime() || 0;
    return timeB - timeA;
  });

  const sortedAllUsers = users
    .filter(u => u.email !== 'akundatakantor@gmail.com')
    .sort((a, b) => {
      const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
      const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
      return timeB - timeA;
    });

  const validActivities = activities.filter(a => students.some(s => s.id === a.studentId));

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-1.5 h-12 bg-indigo-600 rounded-full" />
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight uppercase leading-none mb-1">
              Admin Panel
            </h1>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Manajemen Sistem & Pengguna</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[3rem] overflow-hidden shadow-sm">
        <div className="flex border-b border-slate-100 dark:border-slate-800 p-2">
          <button
            onClick={() => setActiveTab('add_user')}
            className={`flex-1 flex items-center justify-center gap-3 py-4 text-[9px] font-black uppercase tracking-widest transition-all rounded-2xl ${
              activeTab === 'add_user' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <UserPlus size={14} />
            Tambah User
          </button>
          <button
            onClick={() => setActiveTab('all_users')}
            className={`flex-1 flex items-center justify-center gap-3 py-4 text-[9px] font-black uppercase tracking-widest transition-all rounded-2xl ${
              activeTab === 'all_users' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <UserCog size={14} />
            Daftar User
          </button>
          <button
            onClick={() => setActiveTab('active_users')}
            className={`flex-1 flex items-center justify-center gap-3 py-4 text-[9px] font-black uppercase tracking-widest transition-all rounded-2xl ${
              activeTab === 'active_users' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Users size={14} />
            User Aktif
          </button>
          <button
            onClick={() => setActiveTab('beneficiaries')}
            className={`flex-1 flex items-center justify-center gap-3 py-4 text-[9px] font-black uppercase tracking-widest transition-all rounded-2xl ${
              activeTab === 'beneficiaries' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <GraduationCap size={14} />
            Penerima Manfaat
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 flex items-center justify-center gap-3 py-4 text-[9px] font-black uppercase tracking-widest transition-all rounded-2xl ${
              activeTab === 'settings' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Settings size={14} />
            Pengaturan
          </button>
        </div>

        <div className="p-8 md:p-12">
          {activeTab === 'add_user' ? (
            <div className="max-w-xl mx-auto space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <UserPlus className="text-indigo-600" size={20} />
                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Tambah User Baru</h3>
              </div>
              
              {addUserSuccess ? (
                <div className="py-8 flex flex-col items-center gap-4 text-center bg-emerald-50 dark:bg-emerald-500/10 rounded-[2rem] border border-emerald-100 dark:border-emerald-500/20">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                  <div>
                    <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-tight">Berhasil!</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">User baru telah didaftarkan.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAddUser} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nama Lengkap</label>
                    <div className="relative">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                      <input
                        type="text"
                        required
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium dark:text-white focus:bg-white dark:focus:bg-slate-700 focus:border-indigo-600 outline-none transition-all"
                        placeholder="Nama Lengkap"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Username / Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                      <input
                        type="text"
                        required
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium dark:text-white focus:bg-white dark:focus:bg-slate-700 focus:border-indigo-600 outline-none transition-all"
                        placeholder="contoh: user123 atau email@domain.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Password Baru</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                      <input
                        type="password"
                        required
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium dark:text-white focus:bg-white dark:focus:bg-slate-700 focus:border-indigo-600 outline-none transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {isSuperAdmin && (
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Peran Akses</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setNewUserRole('operator')}
                          className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                            newUserRole === 'operator' 
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400' 
                              : 'bg-slate-50 border-slate-100 text-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500'
                          }`}
                        >
                          Operator
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewUserRole('admin')}
                          className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                            newUserRole === 'admin' 
                              ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-400' 
                              : 'bg-slate-50 border-slate-100 text-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500'
                          }`}
                        >
                          <Shield size={12} className="inline mr-2" />
                          Admin
                        </button>
                      </div>
                    </div>
                  )}

                  {!isSuperAdmin && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">PERAN AKSES: OPERATOR (Default)</p>
                    </div>
                  )}

                  {addUserError && (
                    <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl text-rose-500">
                      <AlertCircle size={14} />
                      <span className="text-[9px] font-black uppercase tracking-widest">{addUserError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={addUserLoading}
                    className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 disabled:opacity-50 transition-all mt-4"
                  >
                    {addUserLoading ? 'Memproses...' : 'Daftarkan User Baru'}
                  </button>
                </form>
              )}
            </div>
          ) : activeTab === 'all_users' ? (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <UserCog className="text-indigo-600" size={20} />
                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Manajemen Daftar User</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr>
                      <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Pengguna</th>
                      <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Email</th>
                      <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Peran</th>
                      <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAllUsers.map((u, idx) => (
                      <motion.tr 
                        key={u.uid}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="bg-slate-50 dark:bg-slate-800/50 group"
                      >
                        <td className="px-6 py-4 rounded-l-2xl">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-[10px] uppercase">
                              {u.displayName?.[0] || u.email?.[0]}
                            </div>
                            <span className="text-[11px] font-black text-slate-700 dark:text-white uppercase">{u.displayName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[150px] block">{u.email}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                            u.role === 'admin' 
                              ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-400' 
                              : 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 rounded-r-2xl text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditUser(u)}
                              className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all"
                              title="Edit Pengguna"
                            >
                              <Pencil size={14} />
                            </button>
                            {isSuperAdmin && (
                              <button
                                onClick={() => handleDeleteUserClick(u)}
                                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                                title="Hapus Pengguna"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === 'active_users' ? (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <Users className="text-indigo-600" size={20} />
                  <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Daftar Pengguna Aktif</h3>
                </div>
                
                <div className="relative flex-1 max-w-xs">
                  <Plus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 rotate-45" size={16} />
                  <input
                    type="text"
                    placeholder="CARI PENGGUNA AKTIF..."
                    value={activeUserSearch}
                    onChange={(e) => setActiveUserSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-white focus:bg-white outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
                {activeUsersList.length === 0 ? (
                  <div className="py-12 flex flex-col items-center gap-4 text-center bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-700">
                    <Users className="w-12 h-12 text-slate-300" />
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tidak Ada Pengguna Aktif Saat Ini</p>
                    </div>
                  </div>
                ) : (
                  activeUsersList.map((u, idx) => {
                    const status = getStatusInfo(u.lastActive);
                    return (
                      <motion.div 
                        key={u.uid}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl group hover:border-indigo-600/30 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-sm uppercase shadow-sm">
                              {u.displayName?.[0] || u.email?.[0]}
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                              <div className={`w-2.5 h-2.5 rounded-full ${status.color} ${status.label === 'Online' ? 'animate-pulse' : ''}`} />
                            </div>
                          </div>
                          <div>
                            <p className="text-[12px] font-black text-slate-800 dark:text-white uppercase tracking-tight">{u.displayName}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none outline-none">{u.email}</p>
                              <span className="w-1 h-1 rounded-full bg-slate-300" />
                              <p className={`text-[8px] font-bold uppercase ${status.text}`}>{status.label}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                              u.role === 'admin' 
                                ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-400' 
                                : 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400'
                            }`}>
                              {u.role}
                            </span>
                            {isSuperAdmin && (
                              <button
                                onClick={() => handleForceLogout(u)}
                                title="Paksa Logout"
                                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                              >
                                <LogOut size={14} />
                              </button>
                            )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
            <div className="flex items-center justify-center gap-2 mt-8 opacity-50">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">DATA AKAN DI UPDATE SECARA OTOMATIS SETIAP 1 MENIT</p>
            </div>
          </div>
          ) : activeTab === 'beneficiaries' ? (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <GraduationCap className="text-indigo-600" size={20} />
                  <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Daftar Penerima Manfaat</h3>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Plus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 rotate-45" size={16} />
                    <input
                      type="text"
                      placeholder="CARI NAMA PM..."
                      value={beneficiarySearch}
                      onChange={(e) => setBeneficiarySearch(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-white focus:bg-white outline-none transition-all"
                    />
                  </div>
                  
                  {selectedStudents.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowBulkDeleteConfirm(true)}
                      disabled={bulkDeleteLoading}
                      className="bg-rose-500 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 shadow-lg shadow-rose-100 dark:shadow-none transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {bulkDeleteLoading ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      Hapus ({selectedStudents.length})
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr>
                      <th className="px-6 py-4 text-left w-12">
                        <input 
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          checked={
                            students.filter(s => s.name?.toLowerCase().includes(beneficiarySearch.toLowerCase())).length > 0 &&
                            students.filter(s => s.name?.toLowerCase().includes(beneficiarySearch.toLowerCase())).every(s => selectedStudents.includes(s.id))
                          }
                          onChange={(e) => {
                            const filteredIds = students
                              .filter(s => s.name?.toLowerCase().includes(beneficiarySearch.toLowerCase()))
                              .map(s => s.id);
                            
                            if (e.target.checked) {
                              setSelectedStudents(Array.from(new Set([...selectedStudents, ...filteredIds])));
                            } else {
                              setSelectedStudents(selectedStudents.filter(id => !filteredIds.includes(id)));
                            }
                          }}
                        />
                      </th>
                      <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Penerima Manfaat</th>
                      <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Vokasional</th>
                      <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students
                      .filter(s => s.name?.toLowerCase().includes(beneficiarySearch.toLowerCase()))
                      .map((s, idx) => (
                      <motion.tr 
                        key={s.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="bg-slate-50 dark:bg-slate-800/50 group hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-default"
                      >
                        <td className="px-6 py-4 rounded-l-2xl">
                          <input 
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            checked={selectedStudents.includes(s.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudents([...selectedStudents, s.id]);
                              } else {
                                setSelectedStudents(selectedStudents.filter(id => id !== s.id));
                              }
                            }}
                          />
                        </td>
                        <td className="px-6 py-4" onClick={() => setViewingStudent(s)}>
                          <div className="flex items-center gap-3">
                            {s.photoUrl ? (
                              <img src={s.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-[10px] uppercase">
                                {s.name?.[0]}
                              </div>
                            )}
                            <span className="text-[11px] font-black text-slate-700 dark:text-white uppercase leading-none">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4" onClick={() => setViewingStudent(s)}>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{s.vocation || '-'}</span>
                        </td>
                        <td className="px-6 py-4 rounded-r-2xl text-right">
                          <button
                            onClick={() => setViewingStudent(s)}
                            className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                          >
                            Lihat Laporan
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Student Reports Modal */}
              <AnimatePresence>
                {viewingStudent && (
                  <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setViewingStudent(null)}
                      className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
                    />
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.9, opacity: 0, y: 20 }}
                      className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 flex flex-col h-[80vh]"
                    >
                      <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
                        <div>
                          <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">{viewingStudent.name}</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Daftar Laporan Terdaftar</p>
                        </div>
                        <button 
                          onClick={() => setViewingStudent(null)}
                          className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-slate-600"
                        >
                          <Plus className="rotate-45" size={20} />
                        </button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                        {validActivities
                          .filter(a => a.studentId === viewingStudent.id)
                          .sort((a, b) => (b.date?.toDate?.()?.getTime() || 0) - (a.date?.toDate?.()?.getTime() || 0))
                          .map((a, i) => (
                          <div key={a.id} className="p-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-3xl space-y-3">
                            <div className="flex justify-between items-start">
                              <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-white dark:bg-slate-900 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-500/20">
                                {a.date?.toDate?.()?.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                              </span>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{a.category}</span>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Materi:</p>
                              <p className="text-[11px] font-bold text-slate-800 dark:text-white leading-tight">{a.classActivity}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Hasil:</p>
                              <p className="text-[11px] font-bold text-slate-800 dark:text-white leading-tight">{a.results}</p>
                            </div>
                          </div>
                        ))}
                        {validActivities.filter(a => a.studentId === viewingStudent.id).length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center gap-4 text-center opacity-50 py-12">
                            <Briefcase className="w-12 h-12 text-slate-300" />
                            <p className="text-[10px] font-bold uppercase tracking-widest">Belum ada laporan</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Bulk Delete Students Confirmation Modal */}
              <AnimatePresence>
                {showBulkDeleteConfirm && (
                  <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => !bulkDeleteLoading && setShowBulkDeleteConfirm(false)}
                      className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
                    />
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.9, opacity: 0, y: 20 }}
                      className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[3rem] shadow-2xl p-10 overflow-hidden border border-slate-200 dark:border-white/10"
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/30 text-rose-500 rounded-3xl flex items-center justify-center mb-6">
                          <Trash2 size={40} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2">Hapus Penerima Manfaat?</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8 leading-relaxed">
                          Anda akan menghapus <span className="text-slate-800 dark:text-slate-200">{selectedStudents.length}</span> penerima manfaat. Semua data laporan terkait juga akan dihapus secara permanen.
                        </p>
                        <div className="grid grid-cols-1 w-full gap-3">
                          <button
                            onClick={handleBulkDelete}
                            disabled={bulkDeleteLoading}
                            className="w-full py-5 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-rose-600 transition-all shadow-xl shadow-rose-500/20 disabled:opacity-50"
                          >
                            {bulkDeleteLoading ? 'Menghapus...' : 'Ya, Hapus Semua'}
                          </button>
                          <button
                            onClick={() => setShowBulkDeleteConfirm(false)}
                            disabled={bulkDeleteLoading}
                            className="w-full py-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all font-black text-[10px] uppercase tracking-widest disabled:opacity-50"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          ) : activeTab === 'settings' ? (
            <div className="space-y-8">
              <div className="flex gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 w-fit mx-auto">
                <button
                  onClick={() => setActiveSettingsTab('website')}
                  className={`px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    activeSettingsTab === 'website'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <ImageIcon size={14} className="inline mr-2" />
                  Website
                </button>
                <button
                  onClick={() => setActiveSettingsTab('vocations')}
                  className={`px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    activeSettingsTab === 'vocations'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Briefcase size={14} className="inline mr-2" />
                  Vokasional
                </button>
                <button
                  onClick={() => setActiveSettingsTab('clusters')}
                  className={`px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    activeSettingsTab === 'clusters'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Layers size={14} className="inline mr-2" />
                  Klaster
                </button>
                <button
                  onClick={() => setActiveSettingsTab('categories')}
                  className={`px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    activeSettingsTab === 'categories'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Tag size={14} className="inline mr-2" />
                  Penyusun
                </button>
              </div>

              {activeSettingsTab === 'website' ? (
                <div className="max-w-xl mx-auto space-y-8">
                  <div className="flex items-center gap-3 mb-4">
                    <ImageIcon className="text-indigo-600" size={20} />
                    <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Pengaturan Website</h3>
                  </div>

                  <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-100 dark:border-slate-700">
                    <form onSubmit={handleUpdateSettings} className="space-y-6">
                      <div className="space-y-4 flex flex-col items-center mb-6">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pratinjau Logo Saat Ini</p>
                        <div className="w-24 h-24 rounded-3xl bg-white dark:bg-slate-900 shadow-xl flex items-center justify-center p-2 border border-slate-100 dark:border-slate-800">
                          {logoUrl ? (
                            <img src={logoUrl} alt="Preview" className="w-full h-full object-contain" />
                          ) : (
                            <GraduationCap className="w-12 h-12 text-indigo-600" />
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Upload Logo</label>
                        <div className="flex items-center gap-4">
                          <label className="flex-1 cursor-pointer group">
                            <div className="w-full h-32 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[2rem] flex flex-col items-center justify-center gap-2 group-hover:border-indigo-500 group-hover:bg-indigo-50/50 dark:group-hover:bg-indigo-500/5 transition-all">
                              <Upload className="text-slate-400 group-hover:text-indigo-600 transition-colors" size={24} />
                              <span className="text-[10px] font-black text-slate-400 group-hover:text-indigo-600 uppercase tracking-widest">Pilih Gambar</span>
                              <input type="file" accept="image/png, image/jpeg, image/jpg" onChange={handleFileChange} className="hidden" />
                            </div>
                          </label>
                          
                          {logoUrl && (
                            <button
                              type="button"
                              onClick={() => setLogoUrl('')}
                              className="p-4 bg-rose-50 dark:bg-rose-500/10 text-rose-600 rounded-2xl hover:bg-rose-100 transition-all border border-rose-100 dark:border-rose-900/30"
                            >
                              <Trash2 size={20} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Atau Gunakan URL Gambar</label>
                        <div className="relative">
                          <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <input
                            type="url"
                            value={logoUrl}
                            onChange={(e) => setLogoUrl(e.target.value)}
                            placeholder="https://example.com/logo.png"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium dark:text-white focus:border-indigo-600 outline-none transition-all"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={saveSettingsLoading}
                        className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                      >
                        {saveSettingsLoading ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          'Simpan Pengaturan'
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto space-y-6">
                  <form onSubmit={handleAddItem} className="space-y-4">
                    <div className="relative flex items-center">
                      <Plus className="absolute left-6 text-indigo-600" size={18} />
                      <input
                        type="text"
                        placeholder={`TAMBAHKAN ${activeSettingsTab === 'clusters' ? 'KLASTER' : activeSettingsTab === 'categories' ? 'PENYUSUN' : 'VOKASIONAL'} BARU...`}
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        className="w-full pl-16 pr-32 py-5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[2rem] focus:bg-white focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/10 outline-none transition-all text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-white"
                      />
                      <button
                        type="submit"
                        disabled={isAdding || !newItem.trim()}
                        className="absolute right-3 bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all"
                      >
                        {isAdding ? 'Loading...' : 'Tambah'}
                      </button>
                    </div>
                    
                    {activeSettingsTab === 'vocations' && (
                      <div className="space-y-4 p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-3xl">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nama-nama Instruktur</label>
                          <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest">{newItemInstructors.length} Terdaftar</span>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-4">
                          {newItemInstructors.map((name, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/30 rounded-xl text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase whitespace-nowrap">
                              {name}
                              <button 
                                type="button" 
                                onClick={() => setNewItemInstructors(newItemInstructors.filter((_, idx) => idx !== i))}
                                className="text-rose-400 hover:text-rose-600 transition-colors"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                          {newItemInstructors.length === 0 && (
                            <p className="text-[9px] font-bold text-slate-400 italic">Belum ada instruktur ditambahkan</p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                            <input
                              type="text"
                              value={newItemInstructorInput}
                              onChange={(e) => setNewItemInstructorInput(e.target.value)}
                              placeholder="Tambah Nama Instruktur..."
                              className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl py-3.5 pl-12 pr-4 text-[10px] font-black uppercase outline-none focus:border-indigo-600 transition-all shadow-sm"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (newItemInstructorInput.trim()) {
                                    setNewItemInstructors([...newItemInstructors, newItemInstructorInput.trim()]);
                                    setNewItemInstructorInput('');
                                  }
                                }
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (newItemInstructorInput.trim()) {
                                setNewItemInstructors([...newItemInstructors, newItemInstructorInput.trim()]);
                                setNewItemInstructorInput('');
                              }
                            }}
                            className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 p-3.5 rounded-2xl hover:bg-indigo-100 transition-all border border-indigo-100 dark:border-indigo-900/30"
                          >
                            <Plus size={20} />
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {activeSettingsTab === 'categories' && (
                      <div className="flex justify-center p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl">
                        <label className="flex items-center gap-4 cursor-pointer group">
                          <div className="relative flex items-center">
                            <input 
                              type="checkbox" 
                              className="peer h-6 w-6 cursor-pointer appearance-none rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 transition-all checked:bg-indigo-600 checked:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                              checked={newItemRequiresFile} 
                              onChange={(e) => setNewItemRequiresFile(e.target.checked)} 
                            />
                            <CheckCircle2 size={14} className="absolute left-1.5 opacity-0 peer-checked:opacity-100 text-white transition-opacity pointer-events-none" />
                          </div>
                          <div className="flex flex-col">
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300">Set Wajib Upload (Penyusun Baru)</p>
                            <p className="text-[8px] font-bold uppercase text-slate-400 dark:text-slate-500">Opsional: Centang jika penyusun baru ini wajib melampirkan berkas</p>
                          </div>
                        </label>
                      </div>
                    )}
                  </form>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[400px] content-start overflow-y-auto pr-4 custom-scrollbar">
                    <AnimatePresence mode="popLayout">
                      {(activeSettingsTab === 'clusters' ? clusters : activeSettingsTab === 'categories' ? categories : vocations).map((item, idx) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: idx * 0.05 }}
                          className="flex items-center justify-between p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl group hover:border-indigo-600/30 transition-all shadow-sm"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-black">
                              {idx + 1}
                            </div>
                            <div>
                              <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight block leading-tight">{item.name}</span>
                              {activeSettingsTab === 'categories' && (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${
                                    (item as Category).requiresAttachment 
                                      ? 'bg-rose-50 text-rose-500 dark:bg-rose-900/30 dark:text-rose-400' 
                                      : 'bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-500'
                                  }`}>
                                    {(item as Category).requiresAttachment ? 'WAJIB UPLOAD BERKAS' : 'OPSIONAL UPLOAD'}
                                  </span>
                                </div>
                              )}
                              {activeSettingsTab === 'vocations' && (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[7px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                    {(item as Vocation).instructors?.length || 0} INSTRUKTUR
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEditItem(
                                item.id, 
                                item.name, 
                                activeSettingsTab === 'clusters' ? 'clusters' : activeSettingsTab === 'categories' ? 'categories' : 'vocations', 
                                (item as Category).requiresAttachment,
                                (item as Vocation).instructors
                              )}
                              className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setItemToDelete({ 
                                id: item.id, 
                                name: item.name, 
                                type: activeSettingsTab === 'clusters' ? 'clusters' : activeSettingsTab === 'categories' ? 'categories' : 'vocations' 
                              })}
                              className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          ) : (
              <div className="space-y-6">
                <form onSubmit={handleAddItem} className="space-y-4">
                  <div className="relative flex items-center">
                    <Plus className="absolute left-6 text-indigo-600" size={18} />
                    <input
                      type="text"
                      placeholder={`TAMBAHKAN ${activeTab === 'clusters' ? 'KLASTER' : 'JENIS PENYUSUN'} BARU...`}
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      className="w-full pl-16 pr-32 py-5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[2rem] focus:bg-white focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/10 outline-none transition-all text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={isAdding || !newItem.trim()}
                      className="absolute right-3 bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all"
                    >
                      {isAdding ? 'Loading...' : 'Tambah'}
                    </button>
                  </div>
                  
                  {activeTab === 'categories' && (
                    <div className="flex justify-center p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl">
                      <label className="flex items-center gap-4 cursor-pointer group">
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            className="peer h-6 w-6 cursor-pointer appearance-none rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 transition-all checked:bg-indigo-600 checked:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                            checked={newItemRequiresFile} 
                            onChange={(e) => setNewItemRequiresFile(e.target.checked)} 
                          />
                          <CheckCircle2 size={14} className="absolute left-1.5 opacity-0 peer-checked:opacity-100 text-white transition-opacity pointer-events-none" />
                        </div>
                        <div className="flex flex-col">
                          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300">Set Wajib Upload (Penyusun Baru)</p>
                          <p className="text-[8px] font-bold uppercase text-slate-400 dark:text-slate-500">Opsional: Centang jika penyusun baru ini wajib melampirkan berkas</p>
                        </div>
                      </label>
                    </div>
                  )}
                </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[400px] content-start overflow-y-auto pr-4 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {(activeTab === 'clusters' ? clusters : categories).map((item, idx) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center justify-between p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl group hover:border-indigo-600/30 transition-all shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-black">
                          {idx + 1}
                        </div>
                        <div>
                          <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight block leading-tight">{item.name}</span>
                          {activeTab === 'categories' && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${
                                (item as Category).requiresAttachment 
                                  ? 'bg-rose-50 text-rose-500 dark:bg-rose-900/30 dark:text-rose-400' 
                                  : 'bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-500'
                              }`}>
                                {(item as Category).requiresAttachment ? 'WAJIB UPLOAD BERKAS' : 'OPSIONAL UPLOAD'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditItem(item.id, item.name, activeTab === 'clusters' ? 'clusters' : 'categories', (item as Category).requiresAttachment)}
                          className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setItemToDelete({ 
                            id: item.id, 
                            name: item.name, 
                            type: activeTab === 'clusters' ? 'clusters' : 'categories' 
                          })}
                          className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </div>

        {/* Item Delete Confirmation Modal */}
        {itemToDelete && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setItemToDelete(null)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 overflow-hidden border border-slate-200 dark:border-white/10"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/30 text-rose-500 rounded-3xl flex items-center justify-center mb-6">
                  <Trash2 size={40} />
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2">Hapus {itemToDelete.type === 'clusters' ? 'Klaster' : itemToDelete.type === 'categories' ? 'Penyusun' : 'Vokasional'}?</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8 leading-relaxed">
                  Apakah Anda yakin ingin menghapus <span className="text-slate-800 dark:text-slate-200">{itemToDelete.name}</span>? Tindakan ini tidak dapat dibatalkan.
                </p>
                <div className="grid grid-cols-1 w-full gap-3">
                  <button
                    onClick={handleDeleteItem}
                    className="w-full py-5 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-rose-600 transition-all shadow-xl shadow-rose-500/20"
                  >
                    Ya, Hapus Sekarang
                  </button>
                  <button
                    onClick={() => setItemToDelete(null)}
                    className="w-full py-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all font-black text-[10px] uppercase tracking-widest"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

      {/* Image Crop Modal */}
      <AnimatePresence>
        {isCropping && selectedImage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col h-[80vh]"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 z-10">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-2xl">
                    <Crop size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Sesuaikan Logo</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Geser dan perbesar sesuai kebutuhan</p>
                  </div>
                </div>
                <button
                  onClick={() => { setIsCropping(false); setSelectedImage(null); }}
                  className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                >
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <div className="relative flex-1 bg-slate-100 dark:bg-slate-950">
                <Cropper
                  image={selectedImage}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>

              <div className="p-8 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-6 z-10">
                <div className="flex items-center gap-6">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Zoom</span>
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => { setIsCropping(false); setSelectedImage(null); }}
                    className="py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all border border-slate-100 dark:border-slate-800"
                  >
                    Batal
                  </button>
                  <button
                    onClick={applyCrop}
                    className="py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 dark:shadow-none transition-all flex items-center justify-center gap-2"
                  >
                    Terapkan Potongan
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Item Modal */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !updateItemLoading && setEditingItem(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 p-8 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                    <Pencil size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Edit {editingItem.type === 'clusters' ? 'Klaster' : editingItem.type === 'categories' ? 'Penyusun' : 'Vokasional'}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Perbarui Nama Item</p>
                  </div>
                </div>

                <form onSubmit={executeUpdateItem} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama {editingItem.type === 'clusters' ? 'Klaster' : editingItem.type === 'categories' ? 'Penyusun' : 'Vokasional'}</label>
                    <input
                      type="text"
                      required
                      value={updateItemName}
                      onChange={(e) => setUpdateItemName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-4 px-6 text-sm font-medium dark:text-white focus:bg-white focus:border-indigo-600 outline-none transition-all uppercase"
                    />
                  </div>

                  {editingItem.type === 'vocations' && (
                    <div className="space-y-4 pt-2">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Daftar Instruktur</label>
                       <div className="space-y-2 max-h-40 overflow-y-auto px-1 custom-scrollbar">
                         {updateItemInstructors.map((instructor, i) => (
                           <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                             <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase">{instructor}</span>
                             <button 
                               type="button"
                               onClick={() => setUpdateItemInstructors(updateItemInstructors.filter((_, idx) => idx !== i))}
                               className="text-rose-500 hover:text-rose-600 transition-all p-1"
                             >
                               <Trash2 size={14} />
                             </button>
                           </div>
                         ))}
                         {updateItemInstructors.length === 0 && (
                           <div className="py-4 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                             <p className="text-[8px] font-bold text-slate-400 uppercase">Belum ada instruktur</p>
                           </div>
                         )}
                       </div>
                       <div className="flex gap-2">
                         <div className="relative flex-1">
                           <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                           <input
                             type="text"
                             value={newInstructorName}
                             onChange={(e) => setNewInstructorName(e.target.value)}
                             placeholder="NAMA INSTRUKTUR"
                             className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl py-3 pl-9 pr-4 text-[10px] font-black uppercase outline-none focus:border-indigo-600 transition-all shadow-inner"
                           />
                         </div>
                         <button
                           type="button"
                           onClick={() => {
                             if (newInstructorName.trim()) {
                               setUpdateItemInstructors([...updateItemInstructors, newInstructorName.trim()]);
                               setNewInstructorName('');
                             }
                           }}
                           className="px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center shadow-lg shadow-indigo-100 dark:shadow-none"
                         >
                           <Plus size={18} />
                         </button>
                       </div>
                    </div>
                  )}

                  {editingItem.type === 'categories' && (
                    <div className="flex justify-center p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-inner">
                      <label className="flex items-center gap-4 cursor-pointer group">
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            className="peer h-6 w-6 cursor-pointer appearance-none rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 transition-all checked:bg-indigo-600 checked:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                            checked={updateItemRequiresFile} 
                            onChange={(e) => setUpdateItemRequiresFile(e.target.checked)} 
                          />
                          <CheckCircle2 size={14} className="absolute left-1.5 opacity-0 peer-checked:opacity-100 text-white transition-opacity pointer-events-none" />
                        </div>
                        <div className="flex flex-col">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Ubah Kewajiban Upload Berkas</p>
                          <p className="text-[8px] font-bold uppercase text-slate-400 dark:text-slate-500">Centang jika penyusun ini wajib melampirkan berkas</p>
                        </div>
                      </label>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingItem(null)}
                      disabled={updateItemLoading}
                      className="py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all border border-slate-100 dark:border-slate-800"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={updateItemLoading || !updateItemName.trim() || (
                        updateItemName === editingItem.name && 
                        updateItemRequiresFile === editingItem.requiresAttachment &&
                        JSON.stringify(updateItemInstructors) === JSON.stringify(editingItem.instructors || [])
                      )}
                      className="py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 dark:shadow-none disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                      {updateItemLoading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        'Simpan Perubahan'
                      )}
                    </button>
                  </div>
                  
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={updateItemLoading}
                      onClick={() => setItemToDelete({
                        id: editingItem.id,
                        name: editingItem.name,
                        type: editingItem.type
                      })}
                      className="w-full py-4 text-[9px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-2xl transition-all flex items-center justify-center gap-2"
                    >
                      <Trash2 size={14} />
                      Hapus {editingItem.type === 'clusters' ? 'Klaster' : editingItem.type === 'categories' ? 'Penyusun' : 'Vokasional'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete User Confirmation Modal */}
      <AnimatePresence>
        {confirmDeleteUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !deleteUserLoading && setConfirmDeleteUser(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 p-8 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-rose-600" />
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-600">
                  <Trash2 size={32} />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Hapus Pengguna</h3>
                  <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase leading-relaxed">
                    Anda akan menghapus <span className="text-slate-800 dark:text-slate-200 font-black">{confirmDeleteUser.displayName || confirmDeleteUser.email}</span>.
                    Tindakan ini tidak dapat dibatalkan.
                  </p>
                </div>

                <div className="w-full space-y-3">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ketik kode berikut untuk konfirmasi:</p>
                    <div className="px-6 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-black text-lg tracking-[0.3em] text-slate-800 dark:text-white border-2 border-dashed border-slate-200 dark:border-slate-700 select-none">
                      {deleteValidationCode}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={userInputDeleteCode}
                    onChange={(e) => setUserInputDeleteCode(e.target.value.toUpperCase())}
                    placeholder="Masukan Kode"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-4 px-6 text-center text-sm font-black tracking-[0.2em] outline-none focus:border-rose-600 transition-all uppercase"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 w-full">
                  <button
                    onClick={() => setConfirmDeleteUser(null)}
                    disabled={deleteUserLoading}
                    className="py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all border border-slate-100 dark:border-slate-800"
                  >
                    Batal
                  </button>
                  <button
                    onClick={executeDeleteUser}
                    disabled={deleteUserLoading || userInputDeleteCode !== deleteValidationCode}
                    className="py-4 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 shadow-lg shadow-rose-100 dark:shadow-none disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {deleteUserLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Menghapus...
                      </>
                    ) : (
                      'Hapus User'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Force Logout Confirmation Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !updateUserLoading && setEditingUser(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 p-10 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                    <UserCog size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Edit Pengguna</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{editingUser.email}</p>
                  </div>
                </div>

                <form onSubmit={handleUpdateUser} className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
                    <input
                      type="text"
                      required
                      value={updateUserName}
                      onChange={(e) => setUpdateUserName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-4 px-6 text-sm font-medium dark:text-white focus:bg-white focus:border-indigo-600 outline-none transition-all"
                    />
                  </div>

                  {isSuperAdmin && editingUser.email !== 'akundatakantor@gmail.com' && (
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Peran Akses</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setUpdateUserRole('operator')}
                          className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                            updateUserRole === 'operator' 
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                              : 'bg-slate-50 border-slate-100 text-slate-400'
                          }`}
                        >
                          Operator
                        </button>
                        <button
                          type="button"
                          onClick={() => setUpdateUserRole('admin')}
                          className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                            updateUserRole === 'admin' 
                              ? 'bg-rose-50 border-rose-200 text-rose-600' 
                              : 'bg-slate-50 border-slate-100 text-slate-400'
                          }`}
                        >
                          Admin
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      disabled={updateUserLoading}
                      className="py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all border border-slate-100"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={updateUserLoading}
                      className="py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 dark:shadow-none disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                      {updateUserLoading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        'Simpan Perubahan'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmLogoutUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !forceLogoutProcessing && setConfirmLogoutUser(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 p-8 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-rose-600" />
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-600">
                  <LogOut size={32} />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Konfirmasi Logout</h3>
                  <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase leading-relaxed">
                    Apakah Anda yakin ingin memaksa <span className="text-slate-800 dark:text-slate-200">{confirmLogoutUser.displayName || confirmLogoutUser.email}</span> keluar dari aplikasi?
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full">
                  <button
                    onClick={() => setConfirmLogoutUser(null)}
                    disabled={forceLogoutProcessing}
                    className="py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all border border-slate-100 dark:border-slate-800"
                  >
                    Batal
                  </button>
                  <button
                    onClick={executeForceLogout}
                    disabled={forceLogoutProcessing}
                    className="py-4 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 shadow-lg shadow-rose-100 dark:shadow-none disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {forceLogoutProcessing ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      'Paksa Logout'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
