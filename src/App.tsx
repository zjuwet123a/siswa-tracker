import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import StudentList from './components/StudentList';
import StudentDetail from './components/StudentDetail';
import Login from './components/Login';
import AdminPanel from './components/AdminPanel';
import { Loader2 } from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './lib/firebase';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved === 'dark' || (!saved && window.matchMedia('(pre-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Sync user document to ensure they appear in the system user list
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
            const role = currentUser.email === 'akundatakantor@gmail.com' ? 'admin' : 'operator';
            await setDoc(userDocRef, {
              email: currentUser.email,
              displayName: currentUser.displayName || (currentUser.email === 'akundatakantor@gmail.com' ? 'Super Admin' : 'User'),
              role: role,
              createdAt: serverTimestamp()
            });
            setIsAdmin(role === 'admin');
          } else {
            setIsAdmin(userDoc.data().role === 'admin' || currentUser.email === 'akundatakantor@gmail.com');
          }
        } catch (e) {
          console.error("Error syncing user:", e);
          setIsAdmin(currentUser.email === 'akundatakantor@gmail.com');
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4 transition-colors duration-300">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Memuat Sistem...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Layout isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/penerima-manfaat" element={<StudentList />} />
          <Route path="/profile/:studentId" element={<StudentDetail />} />
          {isAdmin && <Route path="/admin" element={<AdminPanel />} />}
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
