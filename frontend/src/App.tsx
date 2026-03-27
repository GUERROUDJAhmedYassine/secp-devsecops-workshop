import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard.tsx';
import FileManager from './pages/FileManager.tsx';
import Webmail from './pages/Webmail.tsx';
import Messaging from './pages/Messaging.tsx';
import UserProfile from './pages/UserProfile.tsx';
import Login from './pages/Login.tsx';
import { useTheme } from './hooks/useTheme';
import { ThemeContext } from './context/ThemeContext';
import { SidebarProvider } from './context/SidebarContext';

import AdminGuard from './components/guards/AdminGuard';
import LiveMonitor from './pages/admin/LiveMonitor';
import AlertFeed from './pages/admin/AlertFeed';
import UserManagement from './pages/admin/UserManagement';
import UserProfileForensics from './pages/admin/UserProfileForensics';
import BaselineViewer from './pages/admin/BaselineViewer';
import EventLog from './pages/admin/EventLog';

function AuthenticatedLayout() {
  return (
    <div className="flex h-screen bg-page text-primary font-mono overflow-hidden transition-colors duration-200 selection:bg-[#4f8ef7]/30 relative">
      <Sidebar />
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/webmail" element={<Webmail />} />
        <Route path="/messaging" element={<Messaging />} />
        <Route path="/files" element={<FileManager />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/settings" element={<Placeholder title="Settings" />} />

        {/* Admin Routes */}
        <Route path="/admin/monitor" element={<AdminGuard><LiveMonitor /></AdminGuard>} />
        <Route path="/admin/alerts" element={<AdminGuard><AlertFeed /></AdminGuard>} />
        <Route path="/admin/events" element={<AdminGuard><EventLog /></AdminGuard>} />
        <Route path="/admin/users" element={<AdminGuard><UserManagement /></AdminGuard>} />
        <Route path="/admin/users/:id" element={<AdminGuard><UserProfileForensics /></AdminGuard>} />
        <Route path="/admin/baselines" element={<AdminGuard><BaselineViewer /></AdminGuard>} />
      </Routes>
    </div>
  );
}

function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <BrowserRouter>
        <SidebarProvider>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/*" element={<AuthenticatedLayout />} />
          </Routes>
        </SidebarProvider>
      </BrowserRouter>
    </ThemeContext.Provider>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex-1 min-w-0 bg-page h-screen flex flex-col items-center justify-center transition-colors duration-200">
      <h1 className="text-3xl font-bold text-primary mb-4">{title}</h1>
      <p className="text-muted text-lg font-medium">— Coming Soon —</p>
    </div>
  );
}

export default App;
