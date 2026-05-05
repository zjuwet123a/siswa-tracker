import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { motion } from 'motion/react';
import { GraduationCap, ShieldCheck, Mail, Lock, AlertCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 6) {
      setError('Password minimal harus 6 karakter.');
      setLoading(false);
      return;
    }

    // Menangani masukan "admin" atau username lain agar valid secara format email Firebase
    const finalEmail = email.includes('@') ? email : `${email}@pm.com`;

    try {
      await signInWithEmailAndPassword(auth, finalEmail, password);
    } catch (err: any) {
      console.error('Login error:', err);
      
      // Jika user tidak ditemukan, coba auto-register untuk 'admin' (khusus kemudahan akses awal)
      if ((err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') && email === 'admin') {
        try {
          const { createUserWithEmailAndPassword } = await import('firebase/auth');
          await createUserWithEmailAndPassword(auth, finalEmail, password);
          return; // Berhasil daftar dan otomatis login
        } catch (regErr: any) {
          console.error('Auto-register error:', regErr);
          if (regErr.code === 'auth/weak-password') {
            setError('Password terlalu lemah (min. 6 karakter).');
          } else if (regErr.code === 'auth/operation-not-allowed') {
            setError('Fitur Email/Password belum aktif di Firebase.');
          } else {
            setError('Gagal masuk. Silakan hubungi admin.');
          }
        }
      } else {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          setError('Email atau Password salah.');
        } else if (err.code === 'auth/invalid-email') {
          setError('Format email tidak valid.');
        } else if (err.code === 'auth/operation-not-allowed') {
          setError('Metode login Email/Password dimatikan.');
        } else {
          setError('Gagal masuk. Silakan hubungi admin.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-50 via-slate-50 to-white">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-[3rem] shadow-2xl shadow-indigo-100/50 p-10 md:p-12 border border-slate-100 relative overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-50 rounded-full blur-3xl -ml-16 -mb-16" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-indigo-200 mb-8 rotate-3">
              <GraduationCap className="text-white w-10 h-10" strokeWidth={1.5} />
            </div>

            <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase mb-2 text-center">
              Arsip Digital <br/>
              <span className="text-indigo-600">PM PKBM</span>
            </h1>
            
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-10">
              Sistem Manajemen Penerima Manfaat
            </p>

            <form onSubmit={handleLogin} className="w-full space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email / Username</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors">
                    <Mail size={18} />
                  </div>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Masukkan email/username"
                    className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:bg-white focus:border-indigo-600 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:bg-white focus:border-indigo-600 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-rose-500 bg-rose-50 p-4 rounded-2xl border border-rose-100"
                >
                  <AlertCircle size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all mt-4"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Memproses...</span>
                  </div>
                ) : 'Masuk ke Sistem'}
              </button>
            </form>

            <div className="mt-12 pt-8 border-t border-slate-50 w-full">
              <div className="flex items-center justify-center gap-2 text-slate-300">
                <ShieldCheck size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Sistem Keamanan Terpadu</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
