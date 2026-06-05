import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, Timestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { Student, Activity, Category, Cluster, Vocation } from '../types';
import { ArrowLeft, Calendar, BookOpen, Clock, CheckCircle2, AlertCircle, Plus, Send, Trash2, Edit2, Download, User, Loader2, FileText, Paperclip, ExternalLink, Share2, Eye, X, Shield, Briefcase, TrendingUp, TrendingDown, Sparkles, Minus, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, VerticalAlign } from 'docx';
import { saveAs } from 'file-saver';
import { useParams, useNavigate } from 'react-router-dom';
import { uploadToGoogleDrive, GOOGLE_DRIVE_SCOPES, backupToSystemDrive } from '../lib/googleDrive';
import ImageCropper from './ImageCropper';
import MultiSelect from './MultiSelect';

declare global {
  interface Window {
    google: any;
  }
}

export default function StudentDetail() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [localStudent, setLocalStudent] = useState<Student | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [vocations, setVocations] = useState<Vocation[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('Semua');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentNotFound, setStudentNotFound] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<Activity['attachment'] | null>(null);
  const [selectedActivityForDetail, setSelectedActivityForDetail] = useState<Activity | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Effect to handle Blob URL creation and cleanup for PDF previews
  useEffect(() => {
    if (previewAttachment && previewAttachment.type === 'application/pdf') {
      try {
        // Convert base64 to Blob
        const base64Data = previewAttachment.base64.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);

        return () => {
          URL.revokeObjectURL(url);
          setPreviewUrl(null);
        };
      } catch (e) {
        console.error("Gagal membuat URL preview PDF:", e);
        setPreviewUrl(null);
      }
    } else {
      setPreviewUrl(null);
    }
  }, [previewAttachment]);
  const [newActivity, setNewActivity] = useState<{
    date: string;
    category: Activity['category'];
    classActivity: string;
    results: string;
    score: number;
    attachments: NonNullable<Activity['attachments']>;
  }>({
    date: new Date().toISOString().split('T')[0],
    category: 'Peksos',
    classActivity: '',
    results: '',
    score: 0,
    attachments: []
  });
  const [isAttachmentUploading, setIsAttachmentUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isDriveConnecting, setIsDriveConnecting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportCategories, setExportCategories] = useState<string[]>([]);
  const [exportMonth, setExportMonth] = useState<number>(new Date().getMonth());
  const [exportYear, setExportYear] = useState<number>(new Date().getFullYear());

  const handleConnectDrive = () => {
    const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      alert('VITE_GOOGLE_CLIENT_ID belum dikonfigurasi. Pastikan aplikasi memiliki Client ID dari Google Cloud Console.');
      return;
    }

    setIsDriveConnecting(true);
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_DRIVE_SCOPES,
        callback: (response: any) => {
          if (response.access_token) {
            setGoogleAccessToken(response.access_token);
            alert('Google Drive Tersambung! Berkas akan diunggah ke Drive secara otomatis.');
          }
          setIsDriveConnecting(false);
        },
        error_callback: (err: any) => {
          console.error('GApi Error:', err);
          setIsDriveConnecting(false);
        }
      });
      client.requestAccessToken();
    } catch (err) {
      console.error('Drive connection error:', err);
      setIsDriveConnecting(false);
      alert('Gagal memuat Google SDK. Coba segarkan halaman.');
    }
  };

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
          clusters: studentData.clusters || [],
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
      setError(null);
    }, (error) => {
      console.error('Activities load failed:', error);
      setError('Data tidak muncul? Tunggu proses sinkronisasi atau hubungi admin.');
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, `student activities for ${studentId}`);
    });

    return () => {
      unsubscribeStudent();
      unsubscribeActivities();
    };
  }, [studentId]);

  useEffect(() => {
    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    });
    const unsubClusters = onSnapshot(collection(db, 'clusters'), (snapshot) => {
      setClusters(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Cluster)));
    });
    const unsubVocations = onSnapshot(collection(db, 'vocations'), (snapshot) => {
      setVocations(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Vocation)));
    });
    return () => {
      unsubCategories();
      unsubClusters();
      unsubVocations();
    };
  }, []);

  const CATEGORY_OPTIONS = categories.map(c => c.name);
  const ALL_ACTIVITY_CATEGORIES = Array.from(new Set(activities.map(a => a.category)));
  const EXPORT_CATEGORY_OPTIONS = Array.from(new Set([...CATEGORY_OPTIONS, ...ALL_ACTIVITY_CATEGORIES])).filter(Boolean);
  const CLUSTER_OPTIONS = clusters.map(c => c.name);

  // Initial state for edit form should be handled after student load
  // We'll use useEffect to sync localStudent changes to editFormData
  const [editFormData, setEditFormData] = useState({
    name: '',
    vocation: '',
    clusters: [] as string[],
    enrollmentDate: '',
    photoUrl: ''
  });

  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [chartCategory, setChartCategory] = useState('Semua');
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; act: Activity; score: number } | null>(null);
  const [expandedActivityIds, setExpandedActivityIds] = useState<string[]>([]);

  const toggleActivityExpanded = (id: string) => {
    setExpandedActivityIds(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id) 
        : [...prev, id]
    );
  };

  const renderInteractiveScoreBadge = (score: number) => {
    const isAuto = !score || score <= 0;
    
    let containerClass = "";
    let label = "";
    
    if (isAuto) {
      containerClass = "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 animate-pulse";
      label = "Otomatis Mendeteksi";
    } else {
      if (score >= 9) {
        containerClass = "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400";
        label = "Sangat Mandiri";
      } else if (score >= 7) {
        containerClass = "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400";
        label = "Mandiri";
      } else if (score >= 5) {
        containerClass = "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400";
        label = "Berkembang";
      } else if (score >= 3) {
        containerClass = "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400";
        label = "Perlu Bantuan";
      } else {
        containerClass = "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400";
        label = "Bantuan Penuh";
      }
    }

    return (
      <div className="flex items-center gap-2">
        {!isAuto && (
          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg min-w-[50px] text-center shadow-sm">
            {score}
          </span>
        )}
        <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border shadow-sm ${containerClass}`}>
          {label}
        </span>
      </div>
    );
  };

  // Dynamic semantic progress scoring engine (Out of 10)
  const getProgressAnalysis = (textStr: string) => {
    const text = (textStr || "").toLowerCase();
    
    const keywords = [
      { score: 10, level: "Sangat Mandiri", color: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400 border-emerald-100", list: ["sangat baik", "sangat mandiri", "luar biasa", "tuntas", "sempurna", "sangat lancar", "tanpa bantuan", "sepenuhnya mandiri"] },
      { score: 8, level: "Mandiri / Baik", color: "bg-indigo-500", textColor: "text-indigo-600 dark:text-indigo-400 border-indigo-100", list: ["baik", "mandiri", "lancar", "meningkat", "berkembang", "berhasil", "stabil", "bisa sendiri"] },
      { score: 6, level: "Cukup / Berkembang", color: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400 border-amber-100", list: ["cukup", "sedang berkembang", "mulai mandiri", "perlu bimbingan", "dengan bimbingan", "bimbingan minimal", "mulai bisa"] },
      { score: 4, level: "Perlu Bantuan", color: "bg-orange-500", textColor: "text-orange-600 dark:text-orange-400 border-orange-100", list: ["kurang mandiri", "kurang", "belum mandiri", "butuh bantuan", "bila dibantu", "perlu dukungan", "sering dibimbing", "masih dibantu"] },
      { score: 2, level: "Bantuan Penuh", color: "bg-rose-500", textColor: "text-rose-600 dark:text-rose-400 border-rose-100", list: ["sangat kurang", "tidak bisa", "tidak mandiri", "belum berkembang", "selalu dibantu", "perlu bantuan penuh", "tergantung penuh", "tidak ada perkembangan", "bantuan penuh", "sepenuhnya dibantu"] }
    ];

    const getMetaForScore = (s: number) => {
      if (s >= 9) {
        return { level: "Sangat Mandiri", color: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400 border-emerald-100" };
      } else if (s >= 7) {
        return { level: "Mandiri / Baik", color: "bg-indigo-500", textColor: "text-indigo-600 dark:text-indigo-400 border-indigo-100" };
      } else if (s >= 5) {
        return { level: "Cukup / Berkembang", color: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400 border-amber-100" };
      } else if (s >= 3) {
        return { level: "Perlu Bantuan", color: "bg-orange-500", textColor: "text-orange-600 dark:text-orange-400 border-orange-100" };
      } else {
        return { level: "Bantuan Penuh", color: "bg-rose-500", textColor: "text-rose-600 dark:text-rose-400 border-rose-100" };
      }
    };

    // Extract all occurrences of keywords without overlapping matches
    const allKeywordsList: { keyword: string; score: number; level: string; color: string; textColor: string }[] = [];
    keywords.forEach(category => {
      category.list.forEach(kw => {
        allKeywordsList.push({
          keyword: kw,
          score: category.score,
          level: category.level,
          color: category.color,
          textColor: category.textColor
        });
      });
    });

    // Sort keywords by length in descending order to match longest phrases first
    allKeywordsList.sort((a, b) => b.keyword.length - a.keyword.length);

    let tempText = text;
    const foundMatches: { keyword: string; score: number; level: string; color: string; textColor: string; count: number }[] = [];

    allKeywordsList.forEach(item => {
      let index = tempText.indexOf(item.keyword);
      let occurrences = 0;
      while (index !== -1) {
        occurrences++;
        // Replace with space padding to maintain index alignment and prevent overlapping/double matches
        tempText = tempText.substring(0, index) + " ".repeat(item.keyword.length) + tempText.substring(index + item.keyword.length);
        index = tempText.indexOf(item.keyword);
      }
      if (occurrences > 0) {
        foundMatches.push({ ...item, count: occurrences });
      }
    });

    // If we have parsed matches, calculate weighted average score based on occurrences
    if (foundMatches.length > 0) {
      let totalWeightedScore = 0;
      let totalCount = 0;
      foundMatches.forEach(match => {
        totalWeightedScore += match.score * match.count;
        totalCount += match.count;
      });

      const weightedScore = Math.round(totalWeightedScore / totalCount);
      const meta = getMetaForScore(weightedScore);
      
      return { 
        score: weightedScore, 
        ...meta, 
        isMultiple: totalCount > 1,
        totalCount,
        matchedDetails: foundMatches.map(m => `${m.count}x "${m.keyword}"`).join(", ")
      };
    }

    // Fallback: Positive vs Negative Word Counter
    const positiveWords = ["baik", "meningkat", "bagus", "berkembang", "mandiri", "lancar", "bisa", "aktif", "semangat", "tuntas", "hebat", "kemajuan", "senang", "kooperatif", "percaya diri"];
    const negativeWords = ["belum", "kurang", "sulit", "bantuan", "bimbingan", "lupa", "susah", "perlu dibantu", "rewel", "tergantung", "stagnan", "menolak", "lambat"];
    
    let posCount = 0;
    let negCount = 0;
    positiveWords.forEach(w => { if (text.includes(w)) posCount++; });
    negativeWords.forEach(w => { if (text.includes(w)) negCount++; });

    if (posCount > 0 && negCount > 0) {
      // Mixed positive/negative keywords
      const score = 6;
      return { score, ...getMetaForScore(score), isMultiple: false, totalCount: 0, matchedDetails: "" };
    }

    if (posCount > negCount) {
      return { score: 8, ...getMetaForScore(8), isMultiple: false, totalCount: 0, matchedDetails: "" };
    } else if (negCount > posCount) {
      return { score: 4, ...getMetaForScore(4), isMultiple: false, totalCount: 0, matchedDetails: "" };
    }
    return { score: 6, ...getMetaForScore(6), isMultiple: false, totalCount: 0, matchedDetails: "" };
  };

  const analyzedActivities = activities.map(act => {
    // Check if score is manual (stored in DB) or auto-analytical
    const hasManualScore = typeof act.score === 'number' && act.score > 0;
    const manualScore = hasManualScore ? act.score : undefined;
    
    const analysis = getProgressAnalysis(act.results);
    
    let analysisLevel = analysis.level;
    let analysisColor = analysis.color;
    let analysisTextColor = analysis.textColor;
    
    // Scale any legacy 1-5 score to 1-10 if needed, or keep 1-10 scores as is
    let activeScore = manualScore !== undefined ? manualScore : analysis.score;
    if (manualScore !== undefined && manualScore <= 5) {
      // Legacy score scale adaptation: double the score to make it out of 10 if it's old and was created out of 5
      activeScore = manualScore * 2;
    }

    if (activeScore >= 9) {
      analysisLevel = "Sangat Mandiri";
      analysisColor = "bg-emerald-500";
      analysisTextColor = "text-emerald-600 dark:text-emerald-400 border-emerald-100";
    } else if (activeScore >= 7) {
      analysisLevel = "Mandiri / Baik";
      analysisColor = "bg-indigo-500";
      analysisTextColor = "text-indigo-600 dark:text-indigo-400 border-indigo-100";
    } else if (activeScore >= 5) {
      analysisLevel = "Cukup / Berkembang";
      analysisColor = "bg-amber-500";
      analysisTextColor = "text-amber-600 dark:text-amber-400 border-amber-100";
    } else if (activeScore >= 3) {
      analysisLevel = "Perlu Bantuan";
      analysisColor = "bg-orange-500";
      analysisTextColor = "text-orange-600 dark:text-orange-400 border-orange-100";
    } else {
      analysisLevel = "Bantuan Penuh";
      analysisColor = "bg-rose-500";
      analysisTextColor = "text-rose-600 dark:text-rose-400 border-rose-100";
    }

    return {
      ...act,
      score: activeScore,
      analysisLevel,
      analysisColor,
      analysisTextColor
    };
  });

  const filteredChartActivities = [...analyzedActivities]
    .filter(a => chartCategory === 'Semua' || a.category === chartCategory)
    .sort((a, b) => a.date.toDate().getTime() - a.date.toDate().getTime());

  const totalScoreVal = filteredChartActivities.reduce((sum, item) => sum + item.score, 0);
  const averageScore = filteredChartActivities.length > 0 ? totalScoreVal / filteredChartActivities.length : 0;

  let avgLevelObj = { level: 'Belum Ada Data', color: 'bg-slate-400', textColor: 'text-slate-500 dark:text-slate-400 border-slate-200' };
  if (averageScore >= 9.0) {
    avgLevelObj = { level: 'Sangat Mandiri', color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400 border-emerald-100' };
  } else if (averageScore >= 7.0) {
    avgLevelObj = { level: 'Mandiri / Baik', color: 'bg-indigo-500', textColor: 'text-indigo-600 dark:text-indigo-400 border-indigo-100' };
  } else if (averageScore >= 5.0) {
    avgLevelObj = { level: 'Cukup / Berkembang', color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400 border-amber-100' };
  } else if (averageScore >= 3.0) {
    avgLevelObj = { level: 'Perlu Bantuan', color: 'bg-orange-500', textColor: 'text-orange-600 dark:text-orange-400 border-orange-100' };
  } else if (averageScore > 0) {
    avgLevelObj = { level: 'Bantuan Penuh', color: 'bg-rose-500', textColor: 'text-rose-600 dark:text-rose-400 border-rose-100' };
  }

  let trendText = "STABIL";
  if (filteredChartActivities.length >= 2) {
    const half = Math.ceil(filteredChartActivities.length / 2);
    const firstHalf = filteredChartActivities.slice(0, half);
    const lastHalf = filteredChartActivities.slice(half);
    const firstHalfAvg = firstHalf.reduce((sum, i) => sum + i.score, 0) / firstHalf.length;
    const lastHalfAvg = lastHalf.reduce((sum, i) => sum + i.score, 0) / lastHalf.length;
    const diff = lastHalfAvg - firstHalfAvg;
    if (diff > 0.4) trendText = "MENINGKAT";
    else if (diff < -0.4) trendText = "BUTUH PERHATIAN";
  }

  const achievementsComp = filteredChartActivities
    .filter(a => a.score >= 7)
    .sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime())
    .slice(0, 3);

  const supportAreasComp = filteredChartActivities
    .filter(a => a.score <= 4)
    .sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime())
    .slice(0, 3);

  const chartHeight = 220;
  const chartWidth = 700;
  const paddingX = 45;
  const paddingY = 40;

  const points = filteredChartActivities.map((act, idx) => {
    const x = filteredChartActivities.length > 1
      ? paddingX + (idx * (chartWidth - paddingX * 2) / (filteredChartActivities.length - 1))
      : chartWidth / 2;
    const y = chartHeight - paddingY - ((act.score - 1) * (chartHeight - paddingY * 2) / 9);
    return { x, y, act, score: act.score, level: act.analysisLevel };
  });

  let linePath = "";
  let areaPath = "";
  if (points.length > 1) {
    linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`;
  }

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !newActivity.classActivity || !newActivity.results) return;

    const selectedCategoryObj = categories.find(c => c.name === newActivity.category);
    if (selectedCategoryObj?.requiresAttachment && newActivity.attachments.length === 0) {
      alert(`Penyusun '${newActivity.category}' wajib melampirkan berkas pendukung.`);
      return;
    }

    try {
      const processedAttachments: NonNullable<Activity['attachments']> = [];

      for (const att of newActivity.attachments) {
        let finalAtt = { ...att };

        // Jika Drive terhubung, unggah secara bersamaan (User's Personal Drive)
        if (googleAccessToken) {
          try {
            const driveData = await uploadToGoogleDrive(
              att.base64,
              att.name,
              att.type,
              googleAccessToken
            );
            finalAtt.driveFileId = driveData.id;
            finalAtt.driveViewLink = driveData.webViewLink;
          } catch (driveErr) {
            console.error('Personal Drive upload failed for', att.name, driveErr);
          }
        }

        // Backup Otomatis ke System Drive (akundatakomputer@gmail.com)
        try {
          const backupData = await backupToSystemDrive(
            att.base64,
            att.name,
            att.type,
            localStudent?.name || 'Unknown'
          );
          finalAtt.backupDriveId = backupData.fileId;
          finalAtt.backupDriveLink = backupData.link;
        } catch (backupErr) {
          console.error('System Drive backup failed for', att.name, backupErr);
          // Kita tidak mematikan flow jika backup gagal, agar data tetap masuk ke Firestore
        }

        processedAttachments.push(finalAtt);
      }

      await addDoc(collection(db, `students/${studentId}/activities`), {
        studentId: studentId,
        date: Timestamp.fromDate(new Date(newActivity.date)),
        category: newActivity.category,
        classActivity: newActivity.classActivity.trim(),
        results: newActivity.results.trim(),
        score: newActivity.score > 0 ? newActivity.score : getProgressAnalysis(newActivity.results).score,
        attachment: processedAttachments[0] || null,
        attachments: processedAttachments,
        createdBy: auth.currentUser?.uid,
        createdByName: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Unknown',
        createdAt: serverTimestamp()
      });
      setNewActivity({
        date: new Date().toISOString().split('T')[0],
        category: activeCategory !== 'Semua' ? activeCategory : 'Peksos',
        classActivity: '',
        results: '',
        score: 0,
        attachments: []
      });
      setShowAddModal(false);
      alert('Data aktivitas berhasil disimpan!');
    } catch (error) {
      alert('Gagal menyimpan aktivitas: ' + (error instanceof Error ? error.message : 'Unknown error'));
      handleFirestoreError(error, OperationType.WRITE, `add activity for ${studentId}`);
    }
  };

  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [activityToEdit, setActivityToEdit] = useState<Activity | null>(null);
  const [editActivityForm, setEditActivityForm] = useState<{
    date: string;
    category: Activity['category'];
    classActivity: string;
    results: string;
    score: number;
    attachments: NonNullable<Activity['attachments']>;
  }>({
    date: '',
    category: 'Peksos',
    classActivity: '',
    results: '',
    score: 0,
    attachments: []
  });
  const [showDeleteStudentModal, setShowDeleteStudentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  const handleEditPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      alert('Format file harus JPG, JPEG, atau PNG');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file maksimal 2MB untuk proses cropping');
      return;
    }

    const reader = new FileReader();
    reader.onloadstart = () => setIsPhotoUploading(true);
    reader.onload = (event) => {
      setImageToCrop(event.target?.result as string);
      setIsPhotoUploading(false);
      e.target.value = '';
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
        clusters: editFormData.clusters,
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

    const selectedCategoryObj = categories.find(c => c.name === editActivityForm.category);
    if (selectedCategoryObj?.requiresAttachment && editActivityForm.attachments.length === 0) {
      alert(`Penyusun '${editActivityForm.category}' wajib melampirkan berkas pendukung.`);
      return;
    }

    try {
      const processedAttachments: NonNullable<Activity['attachments']> = [];

      for (const att of editActivityForm.attachments) {
        let finalAtt = { ...att };

        // Jika tidak memiliki ID backup system, unggah
        if (!finalAtt.backupDriveId) {
          try {
            const backupData = await backupToSystemDrive(
              att.base64,
              att.name,
              att.type,
              localStudent?.name || 'Unknown'
            );
            finalAtt.backupDriveId = backupData.fileId;
            finalAtt.backupDriveLink = backupData.link;
          } catch (backupErr) {
            console.error('System Drive backup failed in edit for', att.name, backupErr);
          }
        }

        // Jika Drive terhubung dan tidak memiliki ID personal drive, unggah
        if (googleAccessToken && !finalAtt.driveFileId) {
          try {
            const driveData = await uploadToGoogleDrive(
              att.base64,
              att.name,
              att.type,
              googleAccessToken
            );
            finalAtt.driveFileId = driveData.id;
            finalAtt.driveViewLink = driveData.webViewLink;
          } catch (driveErr) {
            console.error('Personal Drive upload failed in edit for', att.name, driveErr);
          }
        }

        processedAttachments.push(finalAtt);
      }

      await updateDoc(doc(db, `students/${localStudent.id}/activities`, activityToEdit.id), {
        date: Timestamp.fromDate(new Date(editActivityForm.date)),
        category: editActivityForm.category,
        classActivity: editActivityForm.classActivity.trim(),
        results: editActivityForm.results.trim(),
        score: editActivityForm.score > 0 ? editActivityForm.score : getProgressAnalysis(editActivityForm.results).score,
        attachment: processedAttachments[0] || null,
        attachments: processedAttachments,
        updatedAt: serverTimestamp()
      });
      setActivityToEdit(null);
      alert('Data aktivitas berhasil diperbarui!');
    } catch (error) {
      alert('Gagal memperbarui aktivitas: ' + (error instanceof Error ? error.message : 'Unknown error'));
      handleFirestoreError(error, OperationType.UPDATE, `activity ${activityToEdit.id}`);
    }
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handleActivityFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validExtensions = ['.docx', '.pdf', '.xlsx', '.xls', '.jpeg', '.jpg', '.png'];
    setIsAttachmentUploading(true);
    setFileError(null);

    try {
      const newAttachments: NonNullable<Activity['attachments']> = [];
      const errorsList: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name.toLowerCase();
        const isValid = validExtensions.some(ext => fileName.endsWith(ext));

        if (!isValid) {
          errorsList.push(`'${file.name}': format tidak didukung (gunakan PDF, DOCX, Excel, PNG, JPG).`);
          continue;
        }

        if (file.size > 500 * 1024) {
          errorsList.push(`'${file.name}': ukuran ${(file.size / 1024).toFixed(0)}KB melebihi batas 500KB.`);
          continue;
        }

        const base64 = await readFileAsDataURL(file);
        newAttachments.push({
          name: file.name,
          type: file.type,
          base64: base64
        });
      }

      if (errorsList.length > 0) {
        setFileError(errorsList.join(' | '));
      }

      if (newAttachments.length > 0) {
        if (isEdit) {
          setEditActivityForm(prev => ({
            ...prev,
            attachments: [...prev.attachments, ...newAttachments]
          }));
        } else {
          setNewActivity(prev => ({
            ...prev,
            attachments: [...prev.attachments, ...newAttachments]
          }));
        }
      }
    } catch (err) {
      console.error("Gagal membaca berkas:", err);
      setFileError("Terjadi kesalahan saat mengunggah berkas.");
    } finally {
      setIsAttachmentUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (index: number, isEdit: boolean = false) => {
    if (isEdit) {
      setEditActivityForm(prev => ({
        ...prev,
        attachments: prev.attachments.filter((_, idx) => idx !== index)
      }));
    } else {
      setNewActivity(prev => ({
        ...prev,
        attachments: prev.attachments.filter((_, idx) => idx !== index)
      }));
    }
  };

  const downloadAttachment = (attachment: Activity['attachment']) => {
    if (!attachment) return;
    const link = document.createElement('a');
    link.href = attachment.base64;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openEditActivityModal = (activity: Activity) => {
    setFileError(null);
    setActivityToEdit(activity);
    
    let initialScore = typeof activity.score === 'number' && activity.score > 0 ? activity.score : getProgressAnalysis(activity.results).score;
    if (initialScore > 0 && initialScore <= 5) {
      initialScore = initialScore * 2;
    }

    setEditActivityForm({
      date: activity.date?.toDate().toISOString().split('T')[0] || '',
      category: activity.category || 'Peksos',
      classActivity: activity.classActivity,
      results: activity.results,
      score: initialScore,
      attachments: activity.attachments || (activity.attachment ? [activity.attachment] : [])
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
      const { writeBatch, getDocs, collection, query, where } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      // Delete student
      batch.delete(doc(db, 'students', localStudent.id));
      
      // Delete related activities
      const activitiesSnapshot = await getDocs(collection(db, `students/${localStudent.id}/activities`));
      activitiesSnapshot.docs.forEach((activityDoc) => {
        batch.delete(activityDoc.ref);
      });

      // Fallback: Delete related activities in root collection (legacy data)
      const rootActivitiesSnapshot = await getDocs(query(collection(db, 'activities'), where('studentId', '==', localStudent.id)));
      rootActivitiesSnapshot.docs.forEach((activityDoc) => {
        batch.delete(activityDoc.ref);
      });
      
      await batch.commit();
      setShowDeleteStudentModal(false);
      alert('Penerima manfaat dan laporan terkait berhasil dihapus.');
      navigate('/penerima-manfaat');
    } catch (error) {
      console.error('Delete student failed:', error);
      alert('Gagal menghapus data. Silakan coba lagi.');
      handleFirestoreError(error, OperationType.DELETE, `student ${localStudent.id}`);
    }
  };

  const handleExportPDF = () => {
    if (!localStudent) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    let pagesAdded = 0;

    exportCategories.forEach((category) => {
      // Filter activities for this specific category and time period
      const filteredForPDF = activities.filter(a => {
        const date = a.date?.toDate();
        if (!date) return false;
        const matchMonth = date.getMonth() === exportMonth;
        const matchYear = date.getFullYear() === exportYear;
        const matchCategory = a.category === category;
        return matchMonth && matchYear && matchCategory;
      });

      // If no data for this category, skip it to avoid empty pages
      if (filteredForPDF.length === 0) return;

      // Add a new page if this is not the first category with data
      if (pagesAdded > 0) {
        doc.addPage();
      }
      pagesAdded++;

      // Header - Centered as per screenshot
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      const title1 = 'HASIL KEGIATAN PROSES REHABILITASI SOSIAL';
      const title2 = 'PENERIMA MANFAAT RESIDENSIAL';
      const title3 = 'SENTRA " MAHATMIYA " BALI';
      
      doc.text(title1, (pageWidth - doc.getTextWidth(title1)) / 2, 20);
      doc.text(title2, (pageWidth - doc.getTextWidth(title2)) / 2, 27);
      doc.text(title3, (pageWidth - doc.getTextWidth(title3)) / 2, 34);

      // Metadata Section
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const startMetaY = 50;
      const lineSpacing = 8;
      const columnOffset = 40;

      doc.text('Bulan', 14, startMetaY);
      doc.text(':', columnOffset, startMetaY);
      doc.text(monthNames[exportMonth], columnOffset + 3, startMetaY);
      
      doc.text('Kegiatan', 14, startMetaY + lineSpacing);
      doc.text(':', columnOffset, startMetaY + lineSpacing);
      // Show the student's vocation (class activity) instead of category name
      doc.text(localStudent.vocation || category, columnOffset + 3, startMetaY + lineSpacing);
      
      doc.text('Petugas', 14, startMetaY + (lineSpacing * 2));
      doc.text(':', columnOffset, startMetaY + (lineSpacing * 2));
      doc.text(category, columnOffset + 3, startMetaY + (lineSpacing * 2));
      
      let instructorsLineCount = 1;

      const tableData = filteredForPDF.map((activity, index) => [
        (index + 1).toString(),
        activity.date?.toDate().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        activity.classActivity,
        activity.results
      ]);

      autoTable(doc, {
        startY: startMetaY + (lineSpacing * Math.max(2 + instructorsLineCount, 3)) + 5,
        head: [['NO', 'TANGGAL', 'MATERI', 'HASIL YANG DICAPAI']],
        body: tableData,
        theme: 'grid',
        headStyles: { 
          fillColor: [255, 255, 255], 
          textColor: [0, 0, 0], 
          fontStyle: 'bold',
          fontSize: 10,
          halign: 'center',
          lineWidth: 0.1,
          lineColor: [0, 0, 0]
        },
        styles: { 
          fontSize: 9, 
          cellPadding: 4,
          valign: 'middle',
          textColor: [0, 0, 0],
          lineWidth: 0.1,
          lineColor: [0, 0, 0]
        },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' },
          1: { cellWidth: 35, halign: 'center' },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 'auto' }
        },
        margin: { left: 14, right: 14 }
      });
    });

    if (pagesAdded === 0) {
      alert('Tidak ada data laporan untuk kombinasi bulan, tahun, dan kategori yang dipilih.');
      return;
    }

    doc.save(`Hasil_Kegiatan_${localStudent.name.replace(/\s+/g, '_')}_${monthNames[exportMonth]}.pdf`);
  };

  const handleExportWord = async () => {
    if (!localStudent) return;
    
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const sections = [];

    for (const category of exportCategories) {
      const filteredActivities = activities.filter(a => {
        const date = a.date?.toDate();
        if (!date) return false;
        return date.getMonth() === exportMonth && 
               date.getFullYear() === exportYear && 
               a.category === category;
      });

      if (filteredActivities.length === 0) continue;

      // Group activities by category for the Word doc
      const tableRows = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: "NO", alignment: AlignmentType.CENTER, children: [new TextRun({ bold: true, size: 20 })] })], verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ children: [new Paragraph({ text: "TANGGAL", alignment: AlignmentType.CENTER, children: [new TextRun({ bold: true, size: 20 })] })], verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ children: [new Paragraph({ text: "MATERI", alignment: AlignmentType.CENTER, children: [new TextRun({ bold: true, size: 20 })] })], verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ children: [new Paragraph({ text: "HASIL YANG DICAPAI", alignment: AlignmentType.CENTER, children: [new TextRun({ bold: true, size: 20 })] })], verticalAlign: VerticalAlign.CENTER }),
          ],
        }),
      ];

      filteredActivities.forEach((activity, index) => {
        tableRows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: (index + 1).toString(), alignment: AlignmentType.CENTER, children: [new TextRun({ size: 18 })] })], verticalAlign: VerticalAlign.CENTER }),
              new TableCell({ children: [new Paragraph({ text: activity.date?.toDate().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }), alignment: AlignmentType.CENTER, children: [new TextRun({ size: 18 })] })], verticalAlign: VerticalAlign.CENTER }),
              new TableCell({ children: [new Paragraph({ text: activity.classActivity, children: [new TextRun({ size: 18 })] })], verticalAlign: VerticalAlign.CENTER }),
              new TableCell({ children: [new Paragraph({ text: activity.results, children: [new TextRun({ size: 18 })] })], verticalAlign: VerticalAlign.CENTER }),
            ],
          })
        );
      });

      sections.push({
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "HASIL KEGIATAN PROSES REHABILITASI SOSIAL",
                bold: true,
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "PENERIMA MANFAAT RESIDENSIAL",
                bold: true,
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'SENTRA " MAHATMIYA " BALI',
                bold: true,
                size: 24,
              }),
            ],
            spacing: { after: 400 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0 },
              bottom: { style: BorderStyle.NONE, size: 0 },
              left: { style: BorderStyle.NONE, size: 0 },
              right: { style: BorderStyle.NONE, size: 0 },
              insideHorizontal: { style: BorderStyle.NONE, size: 0 },
              insideVertical: { style: BorderStyle.NONE, size: 0 },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Bulan", size: 21 })] })], width: { size: 20, type: WidthType.PERCENTAGE } }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ": " + monthNames[exportMonth], size: 21 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Kegiatan", size: 21 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ": " + (localStudent.vocation || category), size: 21 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Petugas", size: 21 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ": " + category, size: 21 })] })] }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: "", spacing: { before: 200 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
          new Paragraph({ text: "", spacing: { before: 400 }, pageBreakBefore: true }),
        ],
      });
    }

    if (sections.length === 0) {
      alert('Tidak ada data laporan untuk kombinasi bulan, tahun, dan kategori yang dipilih.');
      return;
    }

    // Remove the last page break logic by filtering or handling properly if needed
    // In docx, pageBreakBefore applies to the element. 
    // Let's refine sections to only have one sections object with multiple paragraphs if we want everything in one file but split by pages.
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: sections.flatMap(s => s.children)
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Hasil_Kegiatan_${localStudent.name.replace(/\s+/g, '_')}_${monthNames[exportMonth]}.docx`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Menghubungkan ke Data Perkembangan PM...</p>
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
          className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 dark:shadow-none"
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
          className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Kembali ke Daftar
        </button>
        {error && (
          <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 px-4 py-2 rounded-xl flex items-center gap-2 text-rose-600 animate-pulse">
            <AlertCircle size={14} />
            <span className="text-[8px] font-black uppercase tracking-widest">{error}</span>
          </div>
        )}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800"
          >
            <Edit2 size={16} />
            Edit Profile
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteStudentModal(true)}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-rose-400 dark:text-rose-500 hover:text-rose-600 transition-all px-4 py-2 rounded-xl"
          >
            <Trash2 size={16} />
            Hapus Penerima Manfaat
          </button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Profile Card */}
        <div className="lg:col-span-12 bg-indigo-600 dark:bg-indigo-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl flex flex-col md:flex-row md:items-center gap-10 min-h-[300px]">
          <div className="absolute top-[-30px] right-[-30px] w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse" />
          
          {/* Profile Photo */}
          <div 
            onClick={() => { if (localStudent?.photoUrl) setShowPhotoModal(true); }}
            className={`relative z-10 w-48 h-48 rounded-[2.5rem] bg-indigo-500/30 dark:bg-black/20 border-4 border-white/20 overflow-hidden flex-shrink-0 shadow-2xl flex items-center justify-center transition-all duration-300 ${localStudent?.photoUrl ? 'cursor-pointer hover:scale-[1.03] active:scale-[0.98] group' : ''}`}
          >
            {localStudent?.photoUrl ? (
              <>
                <img src={localStudent.photoUrl} alt={localStudent.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-indigo-950/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                    <Eye size={22} className="text-white" />
                  </div>
                </div>
              </>
            ) : (
              <User size={80} className="text-white/20" strokeWidth={1} />
            )}
          </div>

          <div className="relative z-10 flex-1">
            <span className="text-[10px] font-black text-indigo-200 dark:text-indigo-300 uppercase tracking-[0.3em] mb-2 block">BIODATA PENERIMA MANFAAT</span>
            <h2 className="text-5xl font-black tracking-tighter uppercase mb-2 break-words">{localStudent.name}</h2>
            {localStudent.vocation && (
              <p className="text-sm font-black text-indigo-100 dark:text-indigo-200 uppercase tracking-widest mb-4">
                Vokasional: {localStudent.vocation}
              </p>
            )}
            {localStudent.clusters && localStudent.clusters.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {localStudent.clusters.map(cluster => (
                  <span key={cluster} className="px-3 py-1 bg-white/20 backdrop-blur-md text-white rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20 ring-1 ring-white/10">
                    {cluster}
                  </span>
                ))}
              </div>
            )}
            <p className="text-lg font-medium text-indigo-100 dark:text-indigo-200 opacity-80 mb-6">
              Masuk: {localStudent.enrollmentDate?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            
            <div className="flex gap-12 border-t border-white/10 dark:border-white/5 pt-8">
              <div className="space-y-1">
                <p className="text-[9px] text-indigo-200 dark:text-indigo-300 uppercase font-black tracking-widest opacity-60">Total Laporan</p>
                <p className="text-3xl font-black">{activities.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Development Analytics & Interactive Chart Node */}
        <div className="lg:col-span-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[3rem] p-10 flex flex-col shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3">
                <div className="w-2 h-8 bg-indigo-600 rounded-full animate-pulse" />
                Matrik & Grafik Perkembangan
              </h3>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                Visualisasi integratif kemajuan Penerima Manfaat berdasarkan histori laporan
              </p>
            </div>

            {/* Filter Kategori untuk Grafik */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700/60 overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => setChartCategory('Semua')}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap ${
                  chartCategory === 'Semua'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                Semua Penyusun
              </button>
              {Array.from(new Set(activities.map(a => a.category))).filter(Boolean).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setChartCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap ${
                    chartCategory === cat
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border-4 border-dashed border-slate-50 dark:border-slate-800/50 rounded-[2.5rem]">
              <Sparkles className="text-slate-300 dark:text-slate-600 mb-4 animate-pulse" size={48} />
              <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Memerlukan Laporan Pertama</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mt-2 px-6 leading-relaxed font-medium">
                Grafik & matrik perkembangan akan terbuat otomatis setelah Anda menginput laporan aktivitas harian.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Analytics cards & stats - col-span-4 */}
              <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
                
                {/* 1. Average Rating Badge Card */}
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 p-6 rounded-3xl flex items-center justify-between">
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">RATA-RATA KEMANDIRIAN</span>
                    <h4 className="text-2xl font-black text-slate-800 dark:text-white leading-none">
                      {averageScore.toFixed(1)} <span className="text-xs text-slate-400 font-bold">/ 10.0</span>
                    </h4>
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${avgLevelObj.textColor} ${avgLevelObj.color === 'bg-emerald-500' ? 'border-emerald-100 bg-emerald-50/50 dark:bg-emerald-950/10' : avgLevelObj.color === 'bg-indigo-500' ? 'border-indigo-100 bg-indigo-50/50 dark:bg-indigo-950/10' : avgLevelObj.color === 'bg-amber-500' ? 'border-amber-100 bg-amber-50/50 dark:bg-amber-950/10' : 'border-rose-100 bg-rose-50/50 dark:bg-rose-950/10'} mt-2 inline-block`}>
                      {avgLevelObj.level}
                    </span>
                  </div>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${avgLevelObj.color === 'bg-emerald-500' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500' : avgLevelObj.color === 'bg-indigo-500' ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500' : avgLevelObj.color === 'bg-amber-500' ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-500' : 'bg-rose-50 dark:bg-rose-950/20 text-rose-500'}`}>
                    <Sparkles size={24} />
                  </div>
                </div>

                {/* 2. Trend Badge Card */}
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 p-6 rounded-3xl flex items-center justify-between">
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">KECENDERUNGAN TREN</span>
                    <h4 className="text-xl font-black text-slate-800 dark:text-white uppercase leading-none">
                      {trendText === "MENINGKAT" ? (
                        <span className="text-emerald-500 flex items-center gap-1">MENINGKAT</span>
                      ) : trendText === "BUTUH PERHATIAN" ? (
                        <span className="text-rose-500 flex items-center gap-1">BUTUH PERHATIAN</span>
                      ) : (
                        <span className="text-amber-500 flex items-center gap-1">STABIL KONSISTEN</span>
                      )}
                    </h4>
                    <span className="text-[8px] text-slate-400 font-bold block">
                      Perbandingan performa moving average harian
                    </span>
                  </div>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-100 dark:bg-slate-800`}>
                    {trendText === "MENINGKAT" ? (
                      <TrendingUp className="text-emerald-500" size={24} />
                    ) : trendText === "BUTUH PERHATIAN" ? (
                      <TrendingDown className="text-rose-500" size={24} />
                    ) : (
                      <Minus className="text-amber-500" size={24} strokeWidth={3} />
                    )}
                  </div>
                </div>

                {/* 3. Consistency Index */}
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 p-6 rounded-3xl flex items-center justify-between">
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">GRAFIK AKTIF</span>
                    <h4 className="text-xl font-black text-slate-800 dark:text-white leading-none uppercase line-clamp-1">
                      {chartCategory === 'Semua' ? 'Semua Penyusun' : chartCategory}
                    </h4>
                    <span className="text-[8px] text-slate-400 font-bold block">
                      {filteredChartActivities.length} Laporan terpetakan
                    </span>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center text-indigo-500 font-black text-lg">
                    {filteredChartActivities.length}
                  </div>
                </div>

              </div>

              {/* Middle Column: Interactive SVG Chart - col-span-8 */}
              <div className="lg:col-span-8 bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between">
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">TRAJEKTORI PERKEMBANGAN PM</h4>
                  
                  {filteredChartActivities.length === 0 ? (
                    <div className="flex items-center justify-center h-[200px] border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                      <p className="text-[10px] font-black uppercase text-slate-300 dark:text-slate-700 tracking-widest">Tidak ada data untuk filter "{chartCategory}"</p>
                    </div>
                  ) : (
                    <div className="relative w-full overflow-hidden">
                      {/* Responsive SVG Chart */}
                      <svg 
                        viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                        className="w-full h-auto drop-shadow-sm select-none"
                      >
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#4338ca" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#4338ca" stopOpacity="0" />
                          </linearGradient>
                        </defs>

                        {/* Grid Lines */}
                        {[2, 4, 6, 8, 10].map((level) => {
                          const yGrid = chartHeight - paddingY - ((level - 1) * (chartHeight - paddingY * 2) / 9);
                          return (
                            <g key={level}>
                              <text
                                x={paddingX - 8}
                                y={yGrid + 3}
                                textAnchor="end"
                                className="fill-slate-400 dark:fill-slate-500 font-mono font-black text-[9px]"
                              >
                                {level}
                              </text>
                              <line 
                                x1={paddingX} 
                                y1={yGrid} 
                                x2={chartWidth - paddingX} 
                                y2={yGrid} 
                                className="stroke-slate-200 dark:stroke-slate-800/50" 
                                strokeWidth={1}
                                strokeDasharray="4 4"
                              />
                            </g>
                          );
                        })}

                        {/* Area Fill beneath curves */}
                        {points.length > 1 && (
                          <path 
                            d={areaPath} 
                            fill="url(#areaGrad)" 
                            className="transition-all duration-500 ease-in-out"
                          />
                        )}

                        {/* Main Trend Line path */}
                        {points.length > 1 && (
                          <path 
                            d={linePath} 
                            fill="none" 
                            className="stroke-indigo-600 dark:stroke-indigo-400 transition-all duration-500 ease-in-out" 
                            strokeWidth={3} 
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}

                        {/* Interactive Data Nodes */}
                        {points.map((pt, idx) => (
                          <g key={pt.act.id}>
                            {/* Larger hover circle tracker */}
                            <circle 
                              cx={pt.x} 
                              cy={pt.y} 
                              r={15} 
                              fill="transparent" 
                              className="cursor-pointer"
                              onMouseEnter={() => setHoveredPoint(pt)}
                              onMouseLeave={() => setHoveredPoint(null)}
                              onClick={() => setSelectedActivityForDetail(pt.act)}
                            />
                            {/* Inner visual dot */}
                            <circle 
                              cx={pt.x} 
                              cy={pt.y} 
                              r={hoveredPoint?.act.id === pt.act.id ? 7 : 4} 
                              className={`transition-all duration-200 cursor-pointer ${
                                pt.score >= 9 ? 'fill-emerald-500' :
                                pt.score >= 7 ? 'fill-indigo-500' :
                                pt.score >= 5 ? 'fill-amber-500' :
                                pt.score >= 3 ? 'fill-orange-500' : 'fill-rose-500'
                              } ${
                                hoveredPoint?.act.id === pt.act.id 
                                  ? 'stroke-white dark:stroke-slate-900 stroke-[3px] scale-125' 
                                  : 'stroke-white/80 dark:stroke-slate-950/80 stroke-2'
                              }`} 
                              onMouseEnter={() => setHoveredPoint(pt)}
                              onMouseLeave={() => setHoveredPoint(null)}
                              onClick={() => setSelectedActivityForDetail(pt.act)}
                            />
                          </g>
                        ))}
                      </svg>

                      {/* Floating Interactive Tooltip */}
                      <AnimatePresence>
                        {hoveredPoint && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="absolute z-10 bg-slate-950 text-white rounded-2xl p-4 shadow-xl max-w-xs border border-white/10 pointer-events-none"
                            style={{
                              left: `${Math.min(78, Math.max(3, (hoveredPoint.x / chartWidth) * 100))}%`,
                              top: `${Math.min(52, Math.max(2, (hoveredPoint.y / chartHeight) * 100 - 32))}%`
                            }}
                          >
                            <span className="text-[8px] font-black uppercase text-indigo-300 tracking-wider block mb-1">
                              {hoveredPoint.act.category} &bull; {hoveredPoint.act.date.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </span>
                            <p className="text-[10px] font-black uppercase tracking-widest line-clamp-1">{hoveredPoint.act.classActivity}</p>
                            <p className="text-[9px] text-slate-300 line-clamp-2 mt-1 italic font-medium">"{hoveredPoint.act.results}"</p>
                            <div className="flex justify-between items-center mt-2.5 border-t border-white/10 pt-1.5 gap-4">
                              <span className="text-[8px] font-black uppercase text-slate-400">SKOR & STATUS:</span>
                              <span className="text-[8px] font-black uppercase text-indigo-300 font-mono">{hoveredPoint.score}/10 &bull; {hoveredPoint.level}</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                  {/* Chart Legend */}
                  <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-4 text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-4">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Sangat Mandiri</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500" /> Mandiri / Baik</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /> Sedang Berkembang</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-500" /> Perlu Bantuan</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500" /> Bantuan Penuh</div>
                  </div>
                </div>
              </div>

              {/* Bottom Row/Section: Semantic Highlight Areas Grid - spans 12 */}
              <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6 mt-2 border-t border-slate-100 dark:border-slate-800/60 pt-6">
                
                {/* 1. Achievements (Capaian Terbaik) */}
                <div className="bg-emerald-50/20 dark:bg-emerald-950/5 border border-emerald-100/40 dark:border-emerald-500/10 rounded-3xl p-6.5">
                  <h5 className="text-[10px] font-black tracking-widest text-emerald-600 dark:text-emerald-400 uppercase flex items-center gap-2 mb-4">
                    <CheckCircle2 size={16} />
                    CAPAIAN TERBAIK & PERKEMBANGAN POSITIF
                  </h5>

                  <div className="space-y-3.5">
                    {achievementsComp.length === 0 ? (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest italic font-bold">Belum tercatat capaian memuaskan khusus di rentang laporan ini.</p>
                    ) : (
                      achievementsComp.map((ach, idx) => {
                        const isExpanded = expandedActivityIds.includes(ach.id);
                        const isLongText = ach.results && ach.results.length > 150;
                        const displayText = isExpanded ? ach.results : (isLongText ? `${ach.results.slice(0, 150)}...` : ach.results);
                        return (
                          <div key={idx} className="flex gap-3 items-start">
                            <span className="w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide leading-none">{ach.classActivity}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic font-medium leading-relaxed">
                                "{displayText}"
                              </p>
                              {isLongText && (
                                <button
                                  type="button"
                                  onClick={() => toggleActivityExpanded(ach.id)}
                                  className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 mt-1.5 hover:underline focus:outline-none cursor-pointer flex items-center gap-1"
                                >
                                  {isExpanded ? 'Sembunyikan' : 'Selengkapnya'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 2. Focus/Practice Goals (Fokus Latihan / Butuh Perhatian) */}
                <div className="bg-rose-50/20 dark:bg-rose-950/5 border border-rose-100/40 dark:border-rose-500/10 rounded-3xl p-6.5">
                  <h5 className="text-[10px] font-black tracking-widest text-rose-600 dark:text-rose-400 uppercase flex items-center gap-2 mb-4">
                    <AlertTriangle size={16} />
                    FOKUS LATIHAN & DUKUNGAN LANJUTAN
                  </h5>

                  <div className="space-y-3.5">
                    {supportAreasComp.length === 0 ? (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest italic font-bold">Penerima manfaat menunjukkan kemandirian menyeluruh yang stabil!</p>
                    ) : (
                      supportAreasComp.map((sup, idx) => {
                        const isExpanded = expandedActivityIds.includes(sup.id);
                        const isLongText = sup.results && sup.results.length > 150;
                        const displayText = isExpanded ? sup.results : (isLongText ? `${sup.results.slice(0, 150)}...` : sup.results);
                        return (
                          <div key={idx} className="flex gap-3 items-start">
                            <span className="w-5 h-5 rounded-md bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide leading-none">{sup.classActivity}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic font-medium leading-relaxed">
                                "{displayText}"
                              </p>
                              {isLongText && (
                                <button
                                  type="button"
                                  onClick={() => toggleActivityExpanded(sup.id)}
                                  className="text-[9px] font-black uppercase text-rose-600 dark:text-rose-400 mt-1.5 hover:underline focus:outline-none cursor-pointer flex items-center gap-1"
                                >
                                  {isExpanded ? 'Sembunyikan' : 'Selengkapnya'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}
        </div>
        <div className="lg:col-span-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[3rem] p-10 flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3 shrink-0">
              <div className="w-2 h-8 bg-indigo-600 rounded-full" />
              RIWAYAT PENERIMA MANFAAT
            </h3>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setFileError(null); setShowAddModal(true); }}
                className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest px-6 py-2.5 rounded-full bg-slate-900 dark:bg-indigo-600 text-white hover:bg-slate-800 dark:hover:bg-indigo-500 transition-all shadow-lg shadow-slate-200 dark:shadow-none shrink-0"
              >
                <Plus size={14} />
                Input Laporan
              </button>

              <button
                onClick={handleConnectDrive}
                disabled={isDriveConnecting}
                className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all ${
                  googleAccessToken 
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20' 
                    : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20'
                }`}
              >
                <Share2 size={14} className={isDriveConnecting ? 'animate-spin' : ''} />
                {googleAccessToken ? 'Drive Aktif' : 'Hubungkan Drive'}
              </button>

              {activities.length > 0 && (
                <button 
                  onClick={() => {
                    const uniqueActivityCategories = Array.from(new Set(activities.map(a => a.category)));
                    const defaultExportCategories = Array.from(new Set([...uniqueActivityCategories, ...CATEGORY_OPTIONS])).filter(Boolean);
                    
                    setExportCategories(defaultExportCategories);
                    
                    if (activities.length > 0) {
                      // activities is sorted by date asc (line 145)
                      const latest = activities[activities.length - 1];
                      const latestDate = latest.date?.toDate();
                      if (latestDate) {
                        setExportMonth(latestDate.getMonth());
                        setExportYear(latestDate.getFullYear());
                      }
                    }
                    setShowExportModal(true);
                  }}
                  className="flex items-center gap-2 text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors shrink-0"
                >
                  <Download size={14} />
                  Export
                </button>
              )}
            </div>
          </div>

          {/* Category Tabs below Header */}
          <div className="flex items-center gap-3 overflow-x-auto pb-6 no-scrollbar border-b border-slate-50 dark:border-slate-800 mb-8">
            {['Semua', ...CATEGORY_OPTIONS].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-2 ${
                  activeCategory === cat 
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none' 
                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-indigo-100 dark:hover:border-indigo-900 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-4 pb-4 border-b-2 border-slate-50 dark:border-slate-800 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-6">
              <div className="col-span-1">Tanggal</div>
              {activeCategory === 'Semua' ? (
                <>
                  <div className="col-span-2">Penyusun</div>
                  <div className="col-span-2">Laporan</div>
                </>
              ) : (
                <div className="col-span-4">Laporan</div>
              )}
              <div className="col-span-3">Hasil Kegiatan</div>
              <div className="col-span-2">Penginput</div>
              <div className="col-span-1 text-center font-black">Berkas</div>
              <div className="col-span-1 text-center">Aksi</div>
            </div>

            <div className="max-h-[500px] overflow-y-auto overflow-x-hidden space-y-2 pr-2 custom-scrollbar">
              {loading ? (
                <div className="text-center py-20 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Memuat data...</div>
              ) : activities.length === 0 ? (
                <div className="text-center py-20 text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest italic">Belum ada data aktivitas terdaftar</div>
              ) : (
                activities
                  .filter(a => activeCategory === 'Semua' || a.category === activeCategory)
                  .map((activity, idx) => (
                    <motion.div 
                      key={activity.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => setSelectedActivityForDetail(activity)}
                      className="grid grid-cols-12 gap-4 py-5 px-6 border border-slate-50 dark:border-slate-800 rounded-2xl items-start hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group cursor-pointer"
                    >
                      <div className="col-span-1 text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors pt-1">
                        {activity.date?.toDate().toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }).toUpperCase()}
                        <div className="text-[8px] opacity-60 dark:text-slate-500">{activity.date?.toDate().getFullYear()}</div>
                      </div>
                      {activeCategory === 'Semua' ? (
                        <>
                          <div className="col-span-2">
                            <span className="text-[8px] font-black px-2 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg uppercase tracking-widest block md:inline-block truncate max-w-full" title={activity.category}>
                              {activity.category || 'Peksos'}
                            </span>
                          </div>
                          <div className="col-span-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100/50 dark:border-slate-800/50 min-w-0">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium line-clamp-2 break-words">{activity.classActivity}</p>
                          </div>
                        </>
                      ) : (
                        <div className="col-span-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100/50 dark:border-slate-800/50 min-w-0">
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium line-clamp-2 break-words">{activity.classActivity}</p>
                        </div>
                      )}
                      <div className="col-span-3 bg-indigo-50/50 dark:bg-indigo-500/5 p-3 rounded-xl border border-indigo-100/50 dark:border-indigo-500/10 min-w-0">
                        <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold italic line-clamp-2 break-words">{activity.results}</p>
                      </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 overflow-hidden shrink-0">
                        <User size={10} />
                      </div>
                      <div className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase truncate">
                        {activity.createdByName || '-'}
                      </div>
                    </div>
                    <div className="col-span-1 flex items-center justify-center gap-2">
                       {activity.attachment ? (
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                          <button 
                            onClick={() => setPreviewAttachment(activity.attachment!)}
                            className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-lg transition-all"
                            title={`Preview: ${activity.attachment.name}`}
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => downloadAttachment(activity.attachment)}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-lg transition-all"
                            title={`Unduh: ${activity.attachment.name}`}
                          >
                            <Download size={14} />
                          </button>
                          {activity.attachment.driveViewLink && (
                            <a 
                              href={activity.attachment.driveViewLink} 
                              target="_blank" 
                              rel="noreferrer"
                              className="p-1.5 text-emerald-500 dark:text-emerald-400 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-lg transition-all"
                              title="Buka di Google Drive"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-700">-</span>
                      )}
                    </div>
                    <div className="col-span-1 text-center flex items-center justify-center gap-1">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditActivityModal(activity);
                        }}
                        className="p-2 text-slate-300 dark:text-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivityToDelete(activity);
                        }}
                        className="p-2 text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
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

      </div>
      {/* Modals Section */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExportModal(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" 
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] shadow-2xl p-10 overflow-hidden border border-slate-200 dark:border-white/10"
            >
              <h2 className="text-2xl font-black mb-2 tracking-tight uppercase flex items-center gap-3 text-slate-800 dark:text-white">
                <Download className="text-indigo-500" />
                Export Laporan
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">Pilih bulan dan kategori laporan yang ingin diexport</p>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] block mb-2">Bulan</label>
                    <select
                      value={exportMonth}
                      onChange={e => setExportMonth(parseInt(e.target.value))}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 uppercase tracking-widest appearance-none"
                    >
                      {[
                        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                      ].map((m, i) => (
                        <option key={i} value={i} className="bg-white dark:bg-slate-900">{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] block mb-2">Tahun</label>
                    <select
                      value={exportYear}
                      onChange={e => setExportYear(parseInt(e.target.value))}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 uppercase tracking-widest appearance-none"
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <option key={y} value={y} className="bg-white dark:bg-slate-900">{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <MultiSelect
                    label="Pilih Kategori Laporan"
                    options={EXPORT_CATEGORY_OPTIONS}
                    selected={exportCategories}
                    onChange={(selected) => setExportCategories(selected)}
                    placeholder="Semua Kategori..."
                  />
                  <div className="flex gap-2 mt-4">
                    <button 
                      onClick={() => setExportCategories(EXPORT_CATEGORY_OPTIONS)}
                      className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-300">|</span>
                    <button 
                      onClick={() => setExportCategories([])}
                      className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:underline"
                    >
                      Hapus Pilihan
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Ringkasan</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Total Kategori Terpilih:</span>
                    <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{exportCategories.length}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Laporan di Bulan Ini:</span>
                    <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                      {activities.filter(a => {
                        const date = a.date?.toDate();
                        return date && 
                          date.getMonth() === exportMonth && 
                          date.getFullYear() === exportYear && 
                          exportCategories.includes(a.category);
                      }).length}
                    </span>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowExportModal(false)}
                    className="flex-1 py-4 border border-slate-200 dark:border-white/10 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all font-mono"
                  >
                    Batal
                  </button>
                  <div className="flex-[2] flex gap-2">
                    <button
                      disabled={exportCategories.length === 0 || activities.filter(a => {
                        const date = a.date?.toDate();
                        return date && 
                          date.getMonth() === exportMonth && 
                          date.getFullYear() === exportYear && 
                          exportCategories.includes(a.category);
                      }).length === 0}
                      onClick={() => {
                        handleExportPDF();
                        setShowExportModal(false);
                      }}
                      className="flex-1 py-4 bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-400 transition-all shadow-xl shadow-indigo-500/20 flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:shadow-none"
                    >
                      <span>PDF</span>
                      <FileText size={14} />
                    </button>
                    <button
                      disabled={exportCategories.length === 0 || activities.filter(a => {
                        const date = a.date?.toDate();
                        return date && 
                          date.getMonth() === exportMonth && 
                          date.getFullYear() === exportYear && 
                          exportCategories.includes(a.category);
                      }).length === 0}
                      onClick={() => {
                        handleExportWord();
                        setShowExportModal(false);
                      }}
                      className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20 flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:shadow-none"
                    >
                      <span>WORD</span>
                      <BookOpen size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {/* Activity Detail Modal */}
        {selectedActivityForDetail && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedActivityForDetail(null)}
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
                  <div className="bg-indigo-50 dark:bg-indigo-500/20 p-4 rounded-3xl">
                    <FileText className="text-indigo-600 dark:text-indigo-400" size={32} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight break-words">Detail Kegiatan</h3>
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                      {selectedActivityForDetail.date?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedActivityForDetail(null)}
                  className="p-3 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-2xl transition-all"
                >
                  <X size={28} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-10 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="min-w-0">
                  <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] block mb-3 underline decoration-indigo-500/30 underline-offset-4">Laporan Kegiatan</label>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-all">
                    {selectedActivityForDetail.classActivity}
                  </p>
                </div>
                
                <div className="bg-indigo-50 dark:bg-indigo-500/5 rounded-[2.5rem] p-8 border border-indigo-100 dark:border-indigo-500/10 min-w-0">
                  <label className="text-[9px] uppercase font-black text-indigo-600 dark:text-indigo-400 tracking-[0.2em] block mb-3">Hasil / Insight Kegiatan</label>
                  <p className="text-sm font-black italic text-indigo-700 dark:text-indigo-300 leading-relaxed whitespace-pre-wrap break-all">
                    {selectedActivityForDetail.results}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-800 pt-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <User size={18} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Diinput Oleh</p>
                      <p className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase">{selectedActivityForDetail.createdByName || '-'}</p>
                    </div>
                  </div>
                  {(() => {
                    const detailAttachments = selectedActivityForDetail.attachments || (selectedActivityForDetail.attachment ? [selectedActivityForDetail.attachment] : []);
                    if (detailAttachments.length === 0) return null;
                    return (
                      <div className="flex flex-col gap-2 max-w-full">
                        <p className="text-[8px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Berkas Lampiran ({detailAttachments.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {detailAttachments.map((att, idx) => (
                            <button 
                              key={idx}
                              onClick={() => {
                                setPreviewAttachment(att);
                                setSelectedActivityForDetail(null);
                              }}
                              className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all max-w-[200px] truncate"
                              title={att.name}
                            >
                              <Paperclip size={14} className="shrink-0" />
                              <span className="truncate">{att.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {imageToCrop && (
          <ImageCropper
            image={imageToCrop}
            onCropComplete={(croppedImage) => {
              setEditFormData(prev => ({ ...prev, photoUrl: croppedImage }));
              setImageToCrop(null);
            }}
            onCancel={() => setImageToCrop(null)}
            aspect={1}
          />
        )}
        {/* Add Activity Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" 
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-xl rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-white/10"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 dark:bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
              
              {/* Header: Fixed */}
              <div className="px-10 pt-8 pb-4 flex justify-between items-center bg-white dark:bg-slate-900 z-10 shrink-0">
                <h2 className="text-2xl font-black tracking-tight uppercase flex items-center gap-3 text-slate-800 dark:text-white">
                  <Plus className="text-indigo-500 shrink-0" />
                  Input Laporan
                </h2>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-all"
                  type="button"
                >
                  <X size={20} />
                </button>
              </div>
              
              {/* Form Content: Scrollable */}
              <form onSubmit={handleAddActivity} className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-10 pb-2 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] block mb-2">Tanggal</label>
                      <input
                        type="date"
                        required
                        value={newActivity.date}
                        onChange={e => setNewActivity({...newActivity, date: e.target.value})}
                        className="w-full px-4 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500/50 dark:focus:border-indigo-500/50 focus:bg-white dark:focus:bg-white/10 transition-all uppercase tracking-widest"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] block mb-2">Penyusun</label>
                      <select
                        value={newActivity.category}
                        onChange={e => setNewActivity({...newActivity, category: e.target.value as any})}
                        className="w-full px-4 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500/50 dark:focus:border-indigo-500/50 focus:bg-white dark:focus:bg-white/10 transition-all uppercase tracking-widest appearance-none"
                      >
                        {CATEGORY_OPTIONS.map(cat => (
                          <option key={cat} value={cat} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] block mb-2">Laporan</label>
                    <textarea
                      required
                      rows={3}
                      value={newActivity.classActivity}
                      onChange={e => setNewActivity({...newActivity, classActivity: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-medium text-slate-700 dark:text-white resize-y min-h-[100px] outline-none focus:border-indigo-500/50 dark:focus:border-indigo-500/50 focus:bg-white dark:focus:bg-white/10 transition-all font-sans"
                      placeholder="Apa laporan kegiatan hari ini?"
                    />
                  </div>
                  
                  <div>
                    <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] block mb-2">Hasil Kegiatan</label>
                    <textarea
                      required
                      rows={3}
                      value={newActivity.results}
                      onChange={e => setNewActivity({...newActivity, results: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-medium text-slate-700 dark:text-white resize-y min-h-[100px] outline-none focus:border-indigo-500/50 dark:focus:border-indigo-500/50 focus:bg-white dark:focus:bg-white/10 transition-all font-sans"
                      placeholder="Bagaimana hasil kegiatannya?"
                    />
                  </div>

                  {/* Skor Manual & Rekomendasi Pintar */}
                  <div className="bg-slate-50 dark:bg-white/5 p-5 rounded-2xl border border-slate-100 dark:border-white/10 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] block mb-0.5">Skor Perkembangan (1 - 10)</label>
                        <p className="text-[8px] text-slate-400/80 font-bold uppercase">Skor pencapaian kemandirian Penerima Manfaat</p>
                      </div>
                      {renderInteractiveScoreBadge(newActivity.score)}
                    </div>

                    {/* Radio Button Selector for 1-10 scores */}
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(num => {
                        const isSelected = newActivity.score === num;
                        return (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setNewActivity({...newActivity, score: num})}
                            className={`py-2 text-xs font-black rounded-xl transition-all border cursor-pointer select-none text-center ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none'
                                : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {num}
                          </button>
                        );
                      })}
                    </div>

                    {/* AI Smart Recommendation Badge */}
                    {newActivity.results.trim().length > 4 && (() => {
                      const rec = getProgressAnalysis(newActivity.results);
                      const isApplied = newActivity.score === rec.score;
                      return (
                        <div className="flex flex-col gap-2 p-3 bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100/30 dark:border-indigo-500/10 rounded-xl">
                          <div className="flex items-center justify-between gap-3 w-full">
                            <div className="flex items-center gap-2">
                              <Sparkles size={14} className="text-indigo-500 shrink-0" />
                              <div className="text-[10px] text-slate-600 dark:text-slate-300 font-bold leading-none">
                                Rekomendasi Pintar (AI): <span className="text-indigo-600 dark:text-indigo-400 font-black font-mono">{rec.score}</span> <span className="text-[9px] font-bold text-slate-400">[{rec.level}]</span>
                              </div>
                            </div>
                            {!isApplied ? (
                              <button
                                type="button"
                                onClick={() => setNewActivity({...newActivity, score: rec.score})}
                                className="px-2.5 py-1 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 hover:dark:bg-indigo-600 text-[8px] font-black uppercase text-white rounded-md tracking-wider transition-all cursor-pointer"
                              >
                                Terapkan
                              </button>
                            ) : (
                              <span className="text-[8px] font-black uppercase text-emerald-500 tracking-wider flex items-center gap-1">✓ Diterapkan</span>
                            )}
                          </div>
                          {rec.isMultiple && rec.matchedDetails && (
                            <div className="text-[9px] text-slate-500 dark:text-slate-400 border-t border-indigo-100/30 dark:border-indigo-500/10 pt-2 font-medium italic">
                              Rata-rata dari beberapa keterangan mandiri terpilih: {rec.matchedDetails}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                    <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] block mb-2 font-mono flex justify-between">
                      <span>Berkas Pendukung {categories.find(c => c.name === newActivity.category)?.requiresAttachment ? '(Wajib)' : '(Opsional)'}</span>
                      {newActivity.attachments.length > 0 && <span className="text-emerald-400 font-bold">{newActivity.attachments.length} Berkas Terpilih</span>}
                    </label>
                    
                    {fileError && (
                      <div className="mb-4 p-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl flex items-start gap-2.5 text-rose-600 dark:text-rose-400">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="text-[10px] font-medium leading-relaxed flex-1">
                          {fileError}
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setFileError(null)} 
                          className="text-[10px] uppercase font-bold tracking-widest text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 shrink-0"
                        >
                          Tutup
                        </button>
                      </div>
                    )}

                    <div className="relative group/upload mb-3">
                      <div className={`w-full px-5 py-4 border-2 border-dashed rounded-2xl transition-all flex items-center gap-4 ${newActivity.attachments.length > 0 ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 group-hover/upload:border-indigo-500/30'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${newActivity.attachments.length > 0 ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-400'}`}>
                          {isAttachmentUploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className={`text-[10px] font-black uppercase tracking-widest truncate ${newActivity.attachments.length > 0 ? 'text-indigo-600 dark:text-indigo-200' : 'text-slate-400 dark:text-slate-500'}`}>
                            {newActivity.attachments.length > 0 ? `${newActivity.attachments.length} Berkas Terlampir` : categories.find(c => c.name === newActivity.category)?.requiresAttachment ? 'Pilih Berkas (Wajib)' : 'Pilih Berkas (Opsional)'}
                          </p>
                          <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">PDF, DOCX, Excel, Images (JPEG, JPG, PNG) | Max 500KB per file</p>
                        </div>
                      </div>
                      <input
                        type="file"
                        multiple
                        required={categories.find(c => c.name === newActivity.category)?.requiresAttachment && newActivity.attachments.length === 0}
                        accept=".pdf,.docx,.xlsx,.xls,.jpeg,.jpg,.png"
                        onChange={(e) => handleActivityFileChange(e)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>

                    {/* List of uploaded files with delete option */}
                    {newActivity.attachments.length > 0 && (
                      <div className="flex flex-col gap-1.5 mb-4 max-h-[150px] overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-white/5 p-3 rounded-2xl border border-slate-100 dark:border-white/5">
                        {newActivity.attachments.map((att, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-3 bg-white dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span className="text-slate-400 shrink-0"><Paperclip size={12} /></span>
                              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-200 truncate">{att.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(idx, false)}
                              className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 rounded-lg transition-all shrink-0"
                              title="Hapus berkas"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer: Fixed */}
                <div className="px-10 py-6 border-t border-slate-50 dark:border-slate-800/20 shrink-0 bg-slate-50/50 dark:bg-slate-900/50 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-4 bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-400 transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-3 active:scale-95"
                  >
                    Kirim Data
                    <Send size={14} />
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

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
              className="relative bg-white dark:bg-slate-900 w-full max-w-xl rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-transparent dark:border-white/10"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 dark:bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

              {/* Header: Fixed */}
              <div className="px-10 pt-8 pb-4 flex justify-between items-center bg-white dark:bg-slate-900 z-10 shrink-0 border-b border-slate-50 dark:border-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                    <Edit2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Edit Kegiatan</h3>
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Ubah riwayat belajar ini</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActivityToEdit(null)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-all"
                  type="button"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form Content: Scrollable */}
              <form onSubmit={handleEditActivity} className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-10 py-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Tanggal Kegiatan</label>
                      <input
                        type="date"
                        required
                        value={editActivityForm.date}
                        onChange={e => setEditActivityForm({...editActivityForm, date: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-500/10 outline-none text-xs font-bold uppercase tracking-widest text-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Penyusun Laporan</label>
                      <select
                        value={editActivityForm.category}
                        onChange={e => setEditActivityForm({...editActivityForm, category: e.target.value as any})}
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-500/10 outline-none text-xs font-bold uppercase tracking-widest text-slate-800 dark:text-white"
                      >
                        {CATEGORY_OPTIONS.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Laporan</label>
                    <textarea
                      required
                      rows={3}
                      value={editActivityForm.classActivity}
                      onChange={e => setEditActivityForm({...editActivityForm, classActivity: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-700 dark:text-slate-200 resize-y min-h-[100px] outline-none focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-500/10 transition-all font-sans"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Hasil Kegiatan</label>
                    <textarea
                      required
                      rows={3}
                      value={editActivityForm.results}
                      onChange={e => setEditActivityForm({...editActivityForm, results: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-700 dark:text-slate-200 resize-y min-h-[100px] outline-none focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-500/10 transition-all font-sans"
                    />
                  </div>

                  {/* Skor Manual & Rekomendasi Pintar */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5">Skor Perkembangan (1 - 10)</label>
                        <p className="text-[8px] text-slate-400/80 font-bold uppercase">Skor pencapaian kemandirian Penerima Manfaat</p>
                      </div>
                      {renderInteractiveScoreBadge(editActivityForm.score)}
                    </div>

                    {/* Radio Button Selector for 1-10 scores */}
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(num => {
                        const isSelected = editActivityForm.score === num;
                        return (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setEditActivityForm({...editActivityForm, score: num})}
                            className={`py-2 text-xs font-black rounded-xl transition-all border cursor-pointer select-none text-center ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {num}
                          </button>
                        );
                      })}
                    </div>

                    {/* AI Smart Recommendation Badge */}
                    {editActivityForm.results.trim().length > 4 && (() => {
                      const rec = getProgressAnalysis(editActivityForm.results);
                      const isApplied = editActivityForm.score === rec.score;
                      return (
                        <div className="flex flex-col gap-2 p-3 bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100/30 dark:border-indigo-500/10 rounded-xl">
                          <div className="flex items-center justify-between gap-3 w-full">
                            <div className="flex items-center gap-2">
                              <Sparkles size={14} className="text-indigo-500 shrink-0" />
                              <div className="text-[10px] text-slate-600 dark:text-slate-300 font-bold leading-none">
                                Rekomendasi Pintar (AI): <span className="text-indigo-600 dark:text-indigo-400 font-black font-mono">{rec.score}</span> <span className="text-[9px] font-bold text-slate-400">[{rec.level}]</span>
                              </div>
                            </div>
                            {!isApplied ? (
                              <button
                                type="button"
                                onClick={() => setEditActivityForm({...editActivityForm, score: rec.score})}
                                className="px-2.5 py-1 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 hover:dark:bg-indigo-600 text-[8px] font-black uppercase text-white rounded-md tracking-wider transition-all cursor-pointer"
                              >
                                Terapkan
                              </button>
                            ) : (
                              <span className="text-[8px] font-black uppercase text-emerald-500 tracking-wider flex items-center gap-1">✓ Diterapkan</span>
                            )}
                          </div>
                          {rec.isMultiple && rec.matchedDetails && (
                            <div className="text-[9px] text-slate-500 dark:text-slate-400 border-t border-indigo-100/30 dark:border-indigo-500/10 pt-2 font-medium italic">
                              Rata-rata dari beberapa keterangan mandiri terpilih: {rec.matchedDetails}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block flex justify-between">
                      <span>Update Berkas Pendukung {categories.find(c => c.name === editActivityForm.category)?.requiresAttachment ? '(Wajib)' : '(Opsional)'}</span>
                      {editActivityForm.attachments.length > 0 && <span className="text-indigo-400 font-bold">{editActivityForm.attachments.length} Berkas Terpilih</span>}
                    </label>

                    {fileError && (
                      <div className="mb-4 p-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl flex items-start gap-2.5 text-rose-600 dark:text-rose-400">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="text-[10px] font-medium leading-relaxed flex-1">
                          {fileError}
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setFileError(null)} 
                          className="text-[10px] uppercase font-bold tracking-widest text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 shrink-0"
                        >
                          Tutup
                        </button>
                      </div>
                    )}

                    <div className="relative group/editupload mb-3">
                      <div className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                          {isAttachmentUploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 truncate">
                            {editActivityForm.attachments.length > 0 ? `${editActivityForm.attachments.length} Berkas Terlampir` : categories.find(c => c.name === editActivityForm.category)?.requiresAttachment ? 'Pilih Berkas (Wajib)' : 'Pilih Berkas (Opsional)'}
                          </p>
                          <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">PDF, DOCX, Excel, Images (JPEG, JPG, PNG) | Max 500KB per file</p>
                        </div>
                      </div>
                      <input
                        type="file"
                        multiple
                        required={categories.find(c => c.name === editActivityForm.category)?.requiresAttachment && editActivityForm.attachments.length === 0}
                        accept=".pdf,.docx,.xlsx,.xls,.jpeg,.jpg,.png"
                        onChange={(e) => handleActivityFileChange(e, true)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>

                    {/* List of uploaded files with delete option in Edit */}
                    {editActivityForm.attachments.length > 0 && (
                      <div className="flex flex-col gap-1.5 mb-4 max-h-[150px] overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700">
                        {editActivityForm.attachments.map((att, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span className="text-slate-400 shrink-0"><Paperclip size={12} /></span>
                              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-200 truncate">{att.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(idx, true)}
                              className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 rounded-lg transition-all shrink-0"
                              title="Hapus berkas"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Footer: Fixed */}
                <div className="px-10 py-6 border-t border-slate-50 dark:border-slate-800/20 shrink-0 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col gap-3">
                  <button
                    type="submit"
                    className="w-full py-4 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none"
                  >
                    Simpan Perubahan
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityToEdit(null)}
                    className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
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
              className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center border border-transparent dark:border-white/10"
            >
              <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Hapus Catatan?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Hapus catatan kegiatan ini?
              </p>
              <div className="grid grid-cols-2 gap-3 mt-8">
                <button
                  onClick={() => setActivityToDelete(null)}
                  className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-y-auto custom-scrollbar">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 border border-transparent dark:border-white/10 my-8"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                  <Edit2 size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Edit Profile</h3>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Ubah Data Penerima Manfaat</p>
                </div>
              </div>

              <form onSubmit={handleEditStudent} className="space-y-5">
                <div className="flex flex-col items-center">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Foto Profil</label>
                  <div className="relative group/photo">
                    <div className="w-24 h-24 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden transition-all group-hover/photo:border-indigo-300 shadow-sm">
                      {editFormData.photoUrl ? (
                        <img src={editFormData.photoUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="text-slate-300 dark:text-slate-600 flex flex-col items-center gap-1">
                          <Plus size={24} />
                          <span className="text-[8px] font-black uppercase">Upload</span>
                        </div>
                      )}
                      {isPhotoUploading && (
                        <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center">
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
                        className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg dark:shadow-none hover:bg-rose-600 transition-all scale-0 group-hover/photo:scale-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={e => setEditFormData({...editFormData, name: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-500/10 outline-none text-xs font-bold uppercase tracking-widest text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Pilih Vokasional</label>
                  <select
                    value={editFormData.vocation}
                    onChange={e => setEditFormData({...editFormData, vocation: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-500/10 outline-none text-xs font-bold uppercase tracking-widest text-slate-800 dark:text-white"
                  >
                    <option value="">Pilih Vokasional...</option>
                    {vocations.map(v => (
                      <option key={v.id} value={v.name}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <MultiSelect
                    label="Klaster (Bisa Pilih Lebih Dari Satu)"
                    options={CLUSTER_OPTIONS}
                    selected={editFormData.clusters}
                    onChange={(selected) => setEditFormData({ ...editFormData, clusters: selected })}
                    placeholder="Pilih Klaster..."
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Tanggal Masuk</label>
                  <input
                    type="date"
                    required
                    value={editFormData.enrollmentDate}
                    onChange={e => setEditFormData({...editFormData, enrollmentDate: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-500/10 outline-none text-xs font-bold uppercase tracking-widest text-slate-800 dark:text-white"
                  />
                </div>
                
                <div className="flex flex-col gap-3 pt-4">
                  <button
                    type="submit"
                    className="w-full py-4 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none"
                  >
                    Simpan Perubahan
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
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
              className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center border border-transparent dark:border-white/10"
            >
              <div className="w-20 h-20 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3">
                <AlertCircle size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Hapus Penerima Manfaat?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
                Anda akan menghapus data <strong>{localStudent.name}</strong> secara permanen. Seluruh riwayat belajar akan terhapus.
              </p>
              <div className="flex flex-col gap-3 mt-8">
                <button
                  onClick={confirmDeleteStudent}
                  className="w-full py-4 bg-rose-600 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-rose-700 transition-all shadow-xl shadow-rose-100 dark:shadow-none"
                >
                  Konfirmasi Hapus Data
                </button>
                <button
                  onClick={() => setShowDeleteStudentModal(false)}
                  className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-slate-200 dark:hover:bg-slate-700 transition-all font-mono"
                >
                  Batalkan Tindakan
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {/* Profile Photo Lightbox Modal */}
        {showPhotoModal && localStudent?.photoUrl && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPhotoModal(false)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" 
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[85vh] z-10 flex flex-col items-center"
            >
              <button
                onClick={() => setShowPhotoModal(false)}
                className="absolute -top-16 right-0 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md border border-white/10 transition-all hover:scale-105"
                title="Tutup"
              >
                <X size={24} />
              </button>
              
              <img 
                src={localStudent.photoUrl} 
                alt={localStudent.name} 
                className="max-w-full max-h-[75vh] object-contain rounded-3xl shadow-2xl border-4 border-white/10"
                referrerPolicy="no-referrer"
              />
              
              <div className="mt-4 px-6 py-3 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl text-center">
                <p className="text-white text-sm font-black uppercase tracking-widest">{localStudent.name}</p>
                {localStudent.vocation && (
                  <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mt-0.5">{localStudent.vocation}</p>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Preview Attachment Modal */}
        {previewAttachment && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewAttachment(null)}
              className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-5xl h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-transparent dark:border-white/10"
            >
              {/* Modal Header */}
              <div className="px-8 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 z-10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight truncate max-w-[200px] md:max-w-md">
                      {previewAttachment.name}
                    </h3>
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Preview Berkas</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {previewUrl && (
                    <button
                      onClick={() => window.open(previewUrl, '_blank')}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                      <ExternalLink size={14} />
                      Buka di Tab Baru
                    </button>
                  )}
                  <button
                    onClick={() => downloadAttachment(previewAttachment)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
                  >
                    <Download size={14} />
                    Unduh
                  </button>
                  <button
                    onClick={() => setPreviewAttachment(null)}
                    className="p-2 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-4 md:p-8 flex items-center justify-center">
                {previewAttachment.type.startsWith('image/') ? (
                  previewAttachment.base64 ? (
                    <img 
                      src={previewAttachment.base64} 
                      alt={previewAttachment.name} 
                      className="max-w-full max-h-full object-contain rounded-xl shadow-lg shadow-slate-200 dark:shadow-none"
                      referrerPolicy="no-referrer"
                    />
                  ) : null
                ) : previewAttachment.type === 'application/pdf' ? (
                  previewUrl ? (
                    <div className="w-full h-full flex flex-col gap-4">
                      <div className="flex-1 relative">
                        <iframe 
                          src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`} 
                          title={previewAttachment.name}
                          className="w-full h-full rounded-xl border-none shadow-sm shadow-slate-200 dark:shadow-none bg-white"
                        />
                        {/* Overlay message for blocked frames */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-white/0 group">
                           {/* Invisible overlay that might show a message if needed */}
                        </div>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 p-4 rounded-2xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg flex items-center justify-center shrink-0">
                            <AlertCircle size={18} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-amber-800 dark:text-white uppercase tracking-tight">Muncul pesan "Blocked by Google"?</p>
                            <p className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">Klik tombol "Buka di Tab Baru" di pojok kanan atas untuk melihat dokumen dengan aman.</p>
                          </div>
                        </div>
                        <button
                          onClick={() => window.open(previewUrl, '_blank')}
                          className="px-4 py-2 bg-amber-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all"
                        >
                          Buka Sekarang
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="animate-spin text-indigo-500" size={32} />
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Menyiapkan Preview...</p>
                    </div>
                  )
                ) : (
                  <div className="text-center p-12 bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-white/5 max-w-sm">
                    <div className="w-20 h-20 bg-amber-50 dark:bg-amber-500/10 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <AlertCircle size={40} />
                    </div>
                    <h4 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2">Preview Tidak Tersedia</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-8">
                      Mohon maaf, format berkas ini (<strong>{previewAttachment.name.split('.').pop()?.toUpperCase()}</strong>) tidak dapat ditampilkan langsung di browser. Silakan unduh berkas untuk melihat isinya.
                    </p>
                    <button
                      onClick={() => downloadAttachment(previewAttachment)}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all"
                    >
                      Klik Untuk Unduh
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
