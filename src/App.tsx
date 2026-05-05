import { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import StudentList from './components/StudentList';
import StudentDetail from './components/StudentDetail';
import { Student } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'students'>('dashboard');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const handleTabChange = (tab: 'dashboard' | 'students') => {
    setActiveTab(tab);
    setSelectedStudent(null);
  };

  const renderContent = () => {
    if (selectedStudent) {
      return <StudentDetail student={selectedStudent} onBack={() => setSelectedStudent(null)} />;
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'students':
        return <StudentList onSelectStudent={(student) => setSelectedStudent(student)} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={handleTabChange}>
      {renderContent()}
    </Layout>
  );
}
