
import {
  Bell, Moon, Sun, MoreVertical,
  Eye, EyeOff, ShieldCheck, RefreshCw, AlertTriangle, UserCheck, Menu, Loader2
} from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';
import { useAuth } from '../hooks/useAuth';
import { useState } from 'react';

/** Map role to a human-readable clearance label. */
function clearanceFromRole(role: string): string {
  switch (role) {
    case 'IT_ADMIN': return 'Level 5 (Administrative)';
    case 'MANAGER': return 'Level 4 (Operational)';
    default: return 'Level 3 (Standard)';
  }
}


export default function UserProfile() {
  const { theme, toggleTheme } = useThemeContext();
  const { toggleSidebar } = useSidebar();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex-1 min-w-0 bg-page h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#4f8ef7]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 min-w-0 bg-page h-screen flex items-center justify-center">
        <p className="text-muted text-sm">Not authenticated.</p>
      </div>
    );
  }

  /* ---- Derive display values from real user data ---- */
  const displayName = user.username;
  const displayEmail = user.email;
  const displayRole = user.role;
  const displayDept = user.department ?? 'Unassigned';
  const displayClearance = clearanceFromRole(user.role);
  const displayCreated = user.created_at ? new Date(user.created_at).toLocaleDateString() : '—';
  const displayLastLogin = user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never';
  const displayVpnKey = user.vpn_public_key ? 'Configured' : 'Not configured';
  const vpnActive = !!user.vpn_public_key;

  /* Trust score: 100 minus failed_logins penalty, clamped 0-100 */
  const trustScore = Math.max(0, 100 - (user.failed_logins ?? 0) * 10);

  /* Recent activity derived from real account events */
  const recentActivity = [
    ...(user.last_login_at ? [{
      id: 'last-login',
      action: 'Successful authentication',
      time: new Date(user.last_login_at).toLocaleDateString(),
      type: 'success' as const,
    }] : []),
    ...(user.created_at ? [{
      id: 'account-created',
      action: 'Account provisioned',
      time: new Date(user.created_at).toLocaleDateString(),
      type: 'info' as const,
    }] : []),
    ...((user.failed_logins ?? 0) > 0 ? [{
      id: 'failed-logins',
      action: `${user.failed_logins} failed login attempt(s) recorded`,
      time: 'Recent',
      type: 'warning' as const,
    }] : []),
  ];
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
                <span className="text-4xl font-bold text-white uppercase">{displayName.substring(0, 2)}</span>
              </div>
              <div className={`absolute bottom-1 right-1 w-6 h-6 ${user.is_active ? 'bg-green-500' : 'bg-slate-400'} border-4 border-card rounded-full`}></div>
            </div>

            <h2 className="text-xl font-bold text-primary mb-1">{displayName}</h2>
            <p className="text-xs font-mono text-muted mb-4">{displayEmail}</p>

            <span className="px-4 py-1.5 bg-[#4f8ef7]/10 text-[#4f8ef7] border border-[#4f8ef7]/20 rounded-full text-[10px] font-bold tracking-widest uppercase mb-8">
              {displayRole}
            </span>

            <div className="w-full h-px bg-border my-6"></div>

            <div className="w-full space-y-6 text-left">
              <div>
                <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Department</h4>
                <p className="text-sm font-semibold text-primary uppercase">{displayDept}</p>
              </div>
              <div>
                <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Security Clearance</h4>
                <p className="text-sm font-semibold text-primary">{displayClearance}</p>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Status</h4>
                  <p className={`text-sm font-mono font-medium ${user.is_active ? 'text-emerald-500' : 'text-red-500'}`}>
                    {user.is_active ? 'Active' : 'Suspended'}
                  </p>
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
                      type={showCurrent ? "text" : "password"}
                      placeholder="Enter your current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full bg-page border border-border rounded-lg px-4 py-3 text-sm text-primary font-mono focus:outline-none focus:border-[#4f8ef7]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
                    >
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button> </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2">New Password</label>
                    <div className="relative">
                      <input
                        type={showNew ? "text" : "password"}
                        placeholder="Enter your new password"
                        value={newPassword}
                        autoComplete="new-password"
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-page border border-border rounded-lg px-4 py-3 text-sm text-primary font-mono focus:outline-none focus:border-[#4f8ef7]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-primary" >
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirm ? "text" : "password"}
                        placeholder="Confirm your New Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"

                        className="w-full bg-page border border-border rounded-lg px-4 py-3 text-sm text-primary font-mono focus:outline-none focus:border-[#4f8ef7]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-primary" >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2 w-full">
                  <button onClick={async () => {
                    try {
                      if (!currentPassword || !newPassword) {
                        alert('Current and new passwords are required.');
                        return;
                      }
                      if (newPassword !== confirmPassword) {
                        alert('New password and confirmation do not match.');
                        return;
                      }
                      const { changePassword } = await import('../api/auth');
                      await changePassword({
                        old_password: currentPassword,
                        new_password: newPassword,
                      })
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      alert('Password changed successfully');
                    } catch (err: any) {
                      alert('Failed to change password: ' + err.message);
                    }
                  }}

                    className="bg-[#4f8ef7] hover:bg-[#3b7ae5] text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-md shadow-[#4f8ef7]/20 transition-all active:scale-95">
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
                  <p className="text-xs font-mono font-bold text-[#4f8ef7]">{displayCreated}</p>
                </div>
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm transition-colors">
                  <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">Last Login Detected</h4>
                  <p className="text-xs font-mono font-medium text-primary mb-1">{displayLastLogin}</p>
                  <p className="text-[10px] font-mono text-muted flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> IP: Hidden (Secured)</p>
                </div>
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm transition-colors flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest">VPN Key Status</h4>
                    <span className={`w-1.5 h-1.5 rounded-full ${vpnActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-400'}`}></span>
                  </div>
                  <div>
                    <p className="text-xs font-mono font-medium text-primary mb-1">{displayVpnKey}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${vpnActive ? 'text-emerald-500' : 'text-muted'}`}>
                      {vpnActive ? 'Active & Valid' : 'Not Provisioned'}
                    </p>
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
                  {recentActivity.length === 0 && (
                    <p className="text-xs text-muted">No recent activity recorded.</p>
                  )}
                  {recentActivity.map((activity) => (
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
                  <h2 className="text-xl font-bold text-primary mb-2">Trust Score: {trustScore}%</h2>
                  <p className="text-xs text-muted leading-relaxed max-w-[260px] mb-6">
                    {trustScore >= 80
                      ? 'Your account follows all enterprise security guidelines and is currently in high standing.'
                      : trustScore >= 50
                        ? 'Your account has some security concerns. Please review recent activity.'
                        : 'Your account has significant security flags. Contact your administrator.'}
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

