import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import AdminAlertPopup from './components/AdminAlertPopup';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard.tsx';
import FileManager from './pages/FileManager.tsx';
import Webmail from './pages/Webmail.tsx';
import Messaging from './pages/Messaging.tsx';
import UserProfile from './pages/UserProfile.tsx';
import Login from './pages/Login.tsx';
import { useTheme } from './hooks/useTheme';
import { ThemeContext } from './context/ThemeContext';
import { SidebarProvider } from './context/SidebarContext';

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
      <AdminAlertPopup />
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/webmail" element={<Webmail />} />
        <Route path="/messaging" element={<Messaging />} />
        <Route path="/files" element={<FileManager />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/settings" element={<Placeholder title="Settings" />} />

        {/* Admin Routes – ProtectedRoute with requireAdmin */}
        <Route element={<ProtectedRoute requireAdmin />}>
          <Route path="/admin/monitor" element={<LiveMonitor />} />
          <Route path="/admin/alerts" element={<AlertFeed />} />
          <Route path="/admin/events" element={<EventLog />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/users/:id" element={<UserProfileForensics />} />
          <Route path="/admin/baselines" element={<BaselineViewer />} />
        </Route>
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
            {/* All authenticated routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/*" element={<AuthenticatedLayout />} />
            </Route>
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
