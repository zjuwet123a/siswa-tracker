import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import StudentList from './components/StudentList';
import StudentDetail from './components/StudentDetail';
import Login from './components/Login';
import AdminPanel from './components/AdminPanel';
import { Loader2 } from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, updateDoc } from 'firebase/firestore';
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
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Sync user document to ensure they appear in the system user list
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          const userData = {
            email: currentUser.email,
            displayName: currentUser.displayName || (currentUser.email === 'akundatakantor@gmail.com' ? 'Super Admin' : 'User'),
            lastActive: serverTimestamp(),
            updatedAt: serverTimestamp()
          };

          if (!userDoc.exists()) {
            const role = currentUser.email === 'akundatakantor@gmail.com' || currentUser.email === 'admin@pm.com' ? 'admin' : 'operator';
            await setDoc(userDocRef, {
              ...userData,
              role: role,
              createdAt: serverTimestamp(),
              forceLogout: false
            });
            setIsAdmin(role === 'admin');
          } else {
            // Merge existing role to prevent overwriting it unless it's the super admin
            const existingRole = userDoc.data().role || 'operator';
            const finalRole = currentUser.email === 'akundatakantor@gmail.com' ? 'admin' : existingRole;
            
            await updateDoc(userDocRef, {
              ...userData,
              role: finalRole
            });
            setIsAdmin(finalRole === 'admin');
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

  // Listen for force logout
  useEffect(() => {
    if (!user) return;

    // Activity tracking
    let lastUpdate = 0;
    const updateActivity = async () => {
      const now = Date.now();
      // Only update once every 3 minutes to save database writes (enough for "Online" status check which is 5 mins)
      if (now - lastUpdate > 3 * 60 * 1000) {
        lastUpdate = now;
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            lastActive: serverTimestamp()
          });
        } catch (e) {
          console.error("Error updating activity:", e);
        }
      }
    };

    // Trigger initial activity update
    updateActivity();

    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') updateActivity();
    });

    const unsubUser = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
      const data = snapshot.data();
      if (data?.forceLogout === true) {
        try {
          // Reset the flag first so they can log back in later
          await updateDoc(doc(db, 'users', user.uid), {
            forceLogout: false
          });
          // Sign out
          await signOut(auth);
        } catch (error) {
          console.error("Error during force logout:", error);
          await signOut(auth);
        }
      }
    });

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      unsubUser();
    };
  }, [user]);

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
