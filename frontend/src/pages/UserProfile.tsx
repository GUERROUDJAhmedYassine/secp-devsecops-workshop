
import { 
  Search, Bell, Moon, Sun, MoreVertical, 
  Eye, EyeOff, ShieldCheck, RefreshCw, AlertTriangle, UserCheck, Menu
} from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';
import { userProfileData } from '../mocks/profile.mock';

export default function UserProfile() {
  const { theme, toggleTheme } = useThemeContext();
  const { toggleSidebar } = useSidebar();

  return (
    <div className="flex-1 min-w-0 bg-page h-screen flex flex-col transition-colors duration-200">
      {/* Top Header */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-border bg-page sticky top-0 z-10 transition-colors">
        <div className="flex items-center gap-3 sm:gap-6">
          <button onClick={toggleSidebar} className="md:hidden p-2 -ml-2 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-base sm:text-lg font-bold text-primary hidden sm:block">Security Operations</h1>
        </div>
        <div className="flex items-center gap-1 sm:gap-3">
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search operations..."
              className="pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-primary focus:outline-none focus:border-[#4f8ef7] w-64 transition-all placeholder:text-muted"
            />
          </div>
          <button className="p-2.5 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors"><Bell className="w-4 h-4" /></button>
          <button onClick={toggleTheme} className="p-2.5 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button className="p-2.5 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors"><MoreVertical className="w-4 h-4" /></button>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Column - User Info Card */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-8 flex flex-col items-center text-center transition-colors">
            <div className="relative mb-6">
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#4f8ef7] to-indigo-600 flex items-center justify-center shadow-lg border-4 border-page">
                {/* Fallback initials if image not present, but mockup has avatar */}
                <span className="text-4xl font-bold text-white">AB</span>
              </div>
              <div className="absolute bottom-1 right-1 w-6 h-6 bg-green-500 border-4 border-card rounded-full"></div>
            </div>
            
            <h2 className="text-xl font-bold text-primary mb-1">{userProfileData.name}</h2>
            <p className="text-xs font-mono text-muted mb-4">{userProfileData.email}</p>
            
            <span className="px-4 py-1.5 bg-[#4f8ef7]/10 text-[#4f8ef7] border border-[#4f8ef7]/20 rounded-full text-[10px] font-bold tracking-widest uppercase mb-8">
              {userProfileData.role}
            </span>

            <div className="w-full h-px bg-border my-6"></div>

            <div className="w-full space-y-6 text-left">
              <div>
                <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Department</h4>
                <p className="text-sm font-semibold text-primary">{userProfileData.department}</p>
              </div>
              <div>
                <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Security Clearance</h4>
                <p className="text-sm font-semibold text-primary">{userProfileData.clearance}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Joined</h4>
                  <p className="text-sm font-mono font-medium text-primary">{userProfileData.joined}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Contract End</h4>
                  <p className="text-sm font-mono font-medium text-primary">{userProfileData.contractEnd}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Settings and Status */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            
            {/* Password Management */}
            <div className="bg-card border border-border rounded-xl shadow-sm p-8 transition-colors">
              <h3 className="text-sm font-bold text-primary mb-6">Security: Authentication Management</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Current Password</label>
                  <div className="relative">
                    <input 
                      type="password" 
                      value="••••••••••••••"
                      readOnly
                      className="w-full bg-page border border-border rounded-lg px-4 py-3 text-sm text-primary font-mono focus:outline-none focus:border-[#4f8ef7]" 
                    />
                    <button className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-primary"><Eye className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2">New Password</label>
                    <div className="relative">
                      <input 
                        type="password" 
                        placeholder="••••••••••••"
                        className="w-full bg-page border border-border rounded-lg px-4 py-3 text-sm text-primary font-mono focus:outline-none focus:border-[#4f8ef7]" 
                      />
                      <button className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-primary"><EyeOff className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Confirm New Password</label>
                    <div className="relative">
                      <input 
                        type="password" 
                        placeholder="••••••••••••"
                        className="w-full bg-page border border-border rounded-lg px-4 py-3 text-sm text-primary font-mono focus:outline-none focus:border-[#4f8ef7]" 
                      />
                      <button className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-primary"><EyeOff className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button className="bg-[#4f8ef7] hover:bg-[#3b7ae5] text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-md shadow-[#4f8ef7]/20 transition-all active:scale-95">
                    Update Security Credentials
                  </button>
                </div>
              </div>
            </div>

            {/* Account Information & Integrity */}
            <div>
              <h3 className="text-sm font-bold text-primary mb-4">Account Information & Integrity</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm transition-colors">
                  <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">Account Created</h4>
                  <p className="text-xs font-mono font-bold text-[#4f8ef7]">{userProfileData.accountCreated}</p>
                </div>
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm transition-colors">
                  <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">Last Login Detected</h4>
                  <p className="text-xs font-mono font-medium text-primary mb-1">{userProfileData.lastLogin}</p>
                  <p className="text-[10px] font-mono text-muted flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> IP: {userProfileData.lastLoginIp}</p>
                </div>
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm transition-colors flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest">VPN Key Status</h4>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                  </div>
                  <div>
                    <p className="text-xs font-mono font-medium text-primary mb-1">{userProfileData.vpnKey}</p>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Active & Valid</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row - Activity & Trust Score */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Recent Activity */}
              <div className="bg-card border border-border rounded-xl shadow-sm p-6 lg:p-8 transition-colors">
                <h3 className="text-sm font-bold text-primary mb-6">Recent Security Activity</h3>
                <div className="space-y-6">
                  {userProfileData.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5">
                          {activity.type === 'info' && <RefreshCw className="w-4 h-4 text-[#4f8ef7]" />}
                          {activity.type === 'success' && <UserCheck className="w-4 h-4 text-emerald-500" />}
                          {activity.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                        </div>
                        <span className="text-sm font-semibold text-primary">{activity.action}</span>
                      </div>
                      <span className="text-[10px] font-bold text-muted uppercase tracking-widest mt-1">
                        {activity.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trust Score Widgets */}
              <div className="bg-card border border-border rounded-xl shadow-sm p-8 flex flex-col items-center justify-center text-center transition-colors relative overflow-hidden group">
                {/* Background glow effect */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#4f8ef7]/5 rounded-full blur-3xl group-hover:bg-[#4f8ef7]/10 transition-colors duration-500"></div>
                
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-14 h-14 bg-[#4f8ef7]/10 border border-[#4f8ef7]/20 rounded-2xl flex items-center justify-center text-[#4f8ef7] mb-4 shadow-sm">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <h2 className="text-xl font-bold text-primary mb-2">Trust Score: {userProfileData.trustScore}%</h2>
                  <p className="text-xs text-muted leading-relaxed max-w-[260px] mb-6">
                    Your account follows all enterprise security guidelines and is currently in high standing.
                  </p>
                  <button className="px-5 py-2 border border-border hover:border-[#4f8ef7] hover:text-[#4f8ef7] text-primary rounded-lg text-xs font-bold transition-colors">
                    View Compliance Report
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
