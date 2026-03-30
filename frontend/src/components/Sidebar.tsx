import { NavLink, useNavigate } from 'react-router-dom';
import { useDashboard } from '../hooks/useDashboard';
import { useAuth } from '../hooks/useAuth';
import { useSidebar } from '../context/SidebarContext';
import {
  Shield,
  LayoutDashboard,
  Mail,
  MessageSquare,
  FolderOpen,
  User,
  Settings,
  X,
  Activity,
  Bell,
  FileText,
  Users,
  Sliders,
  LogOut
} from 'lucide-react';

export default function Sidebar() {
  const { user, loading } = useDashboard();
  const { isAdmin, logout } = useAuth();
  const { isSidebarOpen, setSidebarOpen } = useSidebar();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Webmail', path: '/webmail', icon: Mail },
    { name: 'Messaging', path: '/messaging', icon: MessageSquare },
    { name: 'File Manager', path: '/files', icon: FolderOpen },
    { name: 'User Profile', path: '/profile', icon: User },
  ];

  const adminNavItems = [
    { name: 'Live Monitor', path: '/admin/monitor', icon: Activity, badge: null },
    { name: 'Alerts', path: '/admin/alerts', icon: Bell, badge: 4 },
    { name: 'Event Log', path: '/admin/events', icon: FileText, badge: null },
    { name: 'Users', path: '/admin/users', icon: Users, badge: null },
    { name: 'Baselines', path: '/admin/baselines', icon: Sliders, badge: null },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 md:relative md:translate-x-0 w-64 h-screen bg-[#161b27] flex flex-col flex-shrink-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Header */}
        <div className="p-6 pb-4 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 text-[#4f8ef7] mb-2">
              <Shield className="w-6 h-6" />
              <span className="font-bold text-lg tracking-wide text-[#e2e8f0]">SECP Platform</span>
            </div>
            <div className="text-[10px] text-[#8892a4] font-semibold tracking-widest uppercase ml-1">
              Enterprise Security
            </div>
          </div>
          <button className="md:hidden text-[#8892a4] hover:text-white p-1" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-bold text-[#8892a4] uppercase tracking-wider mb-2 mt-2 px-3">General</div>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-[#4f8ef7]/10 text-[#4f8ef7] font-semibold border-l-2 border-[#4f8ef7]'
                  : 'text-[#8892a4] font-medium hover:bg-white/5 hover:text-[#e2e8f0]'
              }`
            }
          >
            <item.icon className="w-4 h-4 ml-1 shrink-0" />
            <span className="flex-1">{item.name}</span>
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="text-[10px] font-bold text-[#8892a4] uppercase tracking-wider mb-2 mt-6 px-3 border-t border-[#2a3148] pt-4">SIEM</div>
            {adminNavItems.slice(0, 3).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-red-500/10 text-red-400 font-semibold border-l-2 border-red-500' /* Using red for admin nav to distinguish */
                      : 'text-[#8892a4] font-medium hover:bg-white/5 hover:text-[#e2e8f0]'
                  }`
                }
              >
                <item.icon className="w-4 h-4 ml-1 shrink-0" />
                <span className="flex-1">{item.name}</span>
                {item.badge && (
                  <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
            
            <div className="text-[10px] font-bold text-[#8892a4] uppercase tracking-wider mb-2 mt-6 px-3 border-t border-[#2a3148] pt-4">Admin</div>
            {adminNavItems.slice(3).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-[#4f8ef7]/10 text-[#4f8ef7] font-semibold border-l-2 border-[#4f8ef7]'
                      : 'text-[#8892a4] font-medium hover:bg-white/5 hover:text-[#e2e8f0]'
                  }`
                }
              >
                <item.icon className="w-4 h-4 ml-1 shrink-0" />
                <span className="flex-1">{item.name}</span>
                {item.badge && (
                  <span className="bg-[#4f8ef7]/20 text-[#4f8ef7] text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Footer Settings & User */}
      <div className="p-4 border-t border-[#2a3148]">
        <NavLink
          to="/settings"
          onClick={() => setSidebarOpen(false)}
          className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-[#8892a4] hover:bg-white/5 hover:text-[#e2e8f0] rounded-lg transition-colors mb-2"
        >
          <Settings className="w-4 h-4" />
          Settings
        </NavLink>

        <button
          onClick={async () => {
            await logout();
            navigate('/');
          }}
          className="flex items-center gap-3 px-4 py-2 w-full text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors mb-4"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>

        {!loading && user && (
          <div className="flex items-center gap-3 px-3 py-2.5 bg-white/5 border border-[#2a3148] rounded-lg shadow-sm">
            <div className="w-8 h-8 rounded-full bg-[#4f8ef7]/20 text-[#4f8ef7] flex items-center justify-center font-bold text-xs border border-[#4f8ef7]/30">
              {user.username.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[#e2e8f0] line-clamp-1">{user.username}</span>
              <span className="text-[#4f8ef7] text-[10px] tracking-wider font-bold">{user.role}</span>
            </div>
          </div>
        )}
      </div>
    </aside>
    </>
  );
}
