import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Search, Bell, Moon, Sun, MoreVertical, ShieldCheck, Clock, Globe, Activity, ShieldAlert, Menu, Loader2, ArrowLeft } from 'lucide-react';
import { useThemeContext } from '../../context/ThemeContext';
import { getUser, suspendUser, unsuspendUser } from '../../api/admin';
import type { User } from '../../types/user.types';
import { useSidebar } from '../../context/SidebarContext';
/** Derive initials from username (e.g. "ahmed.benali" → "AB") */
function getInitials(username: string): string {
  const parts = username.split(/[.\-_\s]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return username.substring(0, 2).toUpperCase();
}

/** Map role to clearance tier label */
function clearanceTier(role: string): string {
  switch (role) {
    case 'IT_ADMIN': return 'Tier 5 (Admin)';
    case 'MANAGER': return 'Tier 4 (Operations)';
    default: return 'Tier 3 (Standard)';
  }
}

/** Compute risk score from user data */
function computeRiskScore(user: User): number {
  let score = user.risk_score ?? 0;
  // Add failed login penalty
  score += (user.failed_logins ?? 0) * 5;
  // Lock penalty
  if (user.locked_until) score += 20;
  // Inactive penalty
  if (!user.is_active) score += 15;
  return Math.min(100, score);
}

function riskLabel(score: number): { text: string; color: string } {
  if (score <= 25) return { text: 'Low', color: 'text-emerald-500' };
  if (score <= 50) return { text: 'Medium', color: 'text-amber-500' };
  if (score <= 75) return { text: 'High', color: 'text-orange-500' };
  return { text: 'Critical', color: 'text-red-500' };
}

function riskBarColor(score: number): string {
  if (score <= 25) return 'bg-emerald-500';
  if (score <= 50) return 'bg-amber-500';
  if (score <= 75) return 'bg-orange-500';
  return 'bg-red-500';
}

export default function UserProfileForensics() {
  const { theme, toggleTheme } = useThemeContext();
  const { id } = useParams<{ id: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toggleSidebar } = useSidebar();

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    getUser(id)
      .then(setUser)
      .catch((err) => setError(err.message || 'Failed to load user.'))
      .finally(() => setIsLoading(false));
  }, [id]);

  /* ---- Loading / Error states ---- */
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-page">
        <Loader2 className="w-8 h-8 animate-spin text-[#4f8ef7]" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-screen bg-page gap-4">
        <p className="text-red-500 text-sm">{error || 'User not found.'}</p>
        <Link to="/admin/users" className="text-blue-500 text-xs font-bold hover:underline flex items-center gap-1">
          <ArrowLeft size={14} /> Back to User Management
        </Link>
      </div>
    );
  }

  /* ---- Derived display values ---- */
  const riskScore = computeRiskScore(user);
  const risk = riskLabel(riskScore);
  const initials = getInitials(user.username);

  /* Build login history from real data */
  const loginHistory = [
    ...(user.last_login_at ? [{
      time: new Date(user.last_login_at).toLocaleString(),
      ip: '—',
      device: '—',
      status: 'SUCCESS' as const,
    }] : []),
    ...(user.created_at ? [{
      time: new Date(user.created_at).toLocaleString(),
      ip: '—',
      device: 'Account Created',
      status: 'SYSTEM' as const,
    }] : []),
    ...((user.failed_logins ?? 0) > 0 ? [{
      time: 'Recent',
      ip: '—',
      device: `${user.failed_logins} failed attempt(s)`,
      status: 'FAILED' as const,
    }] : []),
  ];

  const filteredHistory = loginHistory.filter(h =>
    h.ip.includes(searchTerm) || h.device.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-page text-primary transition-colors duration-200">

      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card transition-colors duration-200 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={toggleSidebar} className="md:hidden p-2 -ml-2 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <Link to="/admin/users" className="text-sm font-semibold text-muted tracking-wide hover:text-primary transition-colors">Security Operations</Link>
          <span className="text-muted">/</span>
          <h1 className="text-sm font-bold text-blue-500 tracking-wide">User Profile Forensics</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative w-64 hidden md:block">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={14} className="text-muted" />
            </div>
            <input
              type="text"
              placeholder="Search audit logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-page border border-border rounded-md text-xs placeholder:text-muted focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <button className="text-muted hover:text-primary transition-colors p-1">
            <Bell size={16} />
          </button>
          <button onClick={toggleTheme} className="text-muted hover:text-primary transition-colors p-1">
            {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button className="text-muted hover:text-primary transition-colors p-1">
            <MoreVertical size={16} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6 flex flex-col gap-6">

        {/* Top Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Identity Box */}
          <div className="bg-card border border-border p-6 rounded-lg shadow-sm flex flex-col">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-orange-200 text-orange-800 flex items-center justify-center font-bold text-xl shrink-0">
                {initials}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base">{user.username}</span>
                <span className="text-xs text-muted">{user.email}</span>
                <div className="flex gap-2 mt-1 -ml-1">
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-widest uppercase scale-90 origin-left ${user.role === 'IT_ADMIN' ? 'text-red-500 bg-red-500/10 border border-red-500/20' :
                    user.role === 'MANAGER' ? 'text-amber-500 bg-amber-500/10 border border-amber-500/20' :
                      'text-blue-500 bg-blue-500/10 border border-blue-500/20'
                    }`}>{user.role}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-widest uppercase scale-90 origin-left ${user.is_active
                    ? 'text-emerald-500 bg-emerald-500/10 border border-emerald-500/20'
                    : 'text-red-500 bg-red-500/10 border border-red-500/20'
                    }`}>{user.is_active ? 'ACTIVE' : 'SUSPENDED'}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 mb-6 text-sm border-b border-border pb-6">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Security Risk Score</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${risk.color}`}>{risk.text}</span>
              </div>
              <div className="flex items-end gap-1 mb-2">
                <span className={`text-3xl font-bold tracking-tight leading-none ${risk.color}`}>{riskScore}</span>
                <span className="text-xs text-muted font-bold pb-1">/100</span>
              </div>
              <div className="w-full h-1 bg-page rounded-full overflow-hidden mb-2">
                <div className={`h-full rounded-full transition-all duration-500 ${riskBarColor(riskScore)}`} style={{ width: `${riskScore}%` }}></div>
              </div>
              <p className="text-[10px] text-muted leading-tight">
                {riskScore <= 25
                  ? 'Baseline interaction matches established profile patterns.'
                  : riskScore <= 50
                    ? 'Minor deviations from baseline detected. Monitor activity.'
                    : 'Significant anomalies detected. Investigation recommended.'}
              </p>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted mb-1">Account Information</span>
              <div className="flex justify-between items-center text-muted">
                <span className="font-medium">Account ID</span>
                <span className="font-mono text-primary">{user.id.substring(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between items-center text-muted">
                <span className="font-medium">Vault Level</span>
                <span className="font-medium text-primary">{clearanceTier(user.role)}</span>
              </div>
              <div className="flex justify-between items-center text-muted">
                <span className="font-medium">Department</span>
                <span className="font-medium text-primary">{user.department ?? 'Unassigned'}</span>
              </div>
              <div className="flex justify-between items-center text-muted">
                <span className="font-medium">Created</span>
                <span className="font-mono text-primary">{user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</span>
              </div>
              <div className="flex justify-between items-center text-muted">
                <span className="font-medium">Last Login</span>
                <span className="font-mono text-primary">{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-border">
              {user.is_active ? (
                <button
                  onClick={async () => {
                    try {
                      await suspendUser(user.id);
                      setUser(prev => prev ? { ...prev, is_active: false } : null);
                    } catch (e: any) {
                      alert('Failed to suspend user: ' + e.message);
                    }
                  }}
                  className="w-full py-2 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Suspend Account
                </button>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      await unsuspendUser(user.id);
                      setUser(prev => prev ? { ...prev, is_active: true } : null);
                    } catch (e: any) {
                      alert('Failed to unsuspend user: ' + e.message);
                    }
                  }}
                  className="w-full py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Unsuspend Account
                </button>
              )}
            </div>
          </div>

          <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card border border-border p-4 rounded-lg shadow-sm flex flex-col justify-between">
                <span className="text-[9px] uppercase tracking-wider font-bold text-muted mb-2">Failed Auth</span>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold tracking-tight">{user.failed_logins ?? 0}</span>
                  <span className={`text-[10px] font-medium mb-1 ${(user.failed_logins ?? 0) > 0 ? 'text-red-500 font-bold' : 'text-muted'}`}>
                    {(user.failed_logins ?? 0) > 0 ? 'Flagged' : 'None'}
                  </span>
                </div>
              </div>
              <div className="bg-card border border-border p-4 rounded-lg shadow-sm flex flex-col justify-between">
                <span className="text-[9px] uppercase tracking-wider font-bold text-muted mb-2">Account Status</span>
                <div className="flex items-end gap-2">
                  <span className={`text-2xl font-bold tracking-tight ${user.is_active ? 'text-emerald-500' : 'text-red-500'}`}>
                    {user.is_active ? '✓' : '✗'}
                  </span>
                  <span className={`text-[10px] font-bold mb-1 ${user.is_active ? 'text-emerald-500' : 'text-red-500'}`}>
                    {user.is_active ? 'Active' : 'Suspended'}
                  </span>
                </div>
              </div>
              <div className="bg-card border border-border p-4 rounded-lg shadow-sm flex flex-col justify-between">
                <span className="text-[9px] uppercase tracking-wider font-bold text-muted mb-2">Lock Status</span>
                <div className="flex items-end gap-2">
                  <span className={`text-2xl font-bold tracking-tight ${user.locked_until ? 'text-amber-500' : ''}`}>
                    {user.locked_until ? '🔒' : '🔓'}
                  </span>
                  <span className={`text-[10px] font-medium mb-1 ${user.locked_until ? 'text-amber-500' : 'text-muted'}`}>
                    {user.locked_until ? `Until ${new Date(user.locked_until).toLocaleString()}` : 'Unlocked'}
                  </span>
                </div>
              </div>
              <div className="bg-card border border-border p-4 rounded-lg shadow-sm flex flex-col justify-between">
                <span className="text-[9px] uppercase tracking-wider font-bold text-muted mb-2">VPN Key</span>
                <div className="flex items-end gap-2">
                  <span className={`text-2xl font-bold tracking-tight ${user.vpn_public_key ? 'text-emerald-500' : 'text-muted'}`}>
                    {user.vpn_public_key ? '🔑' : '—'}
                  </span>
                  <span className={`text-[10px] font-medium mb-1 ${user.vpn_public_key ? 'text-emerald-500' : 'text-muted'}`}>
                    {user.vpn_public_key ? 'Provisioned' : 'None'}
                  </span>
                </div>
              </div>
            </div>

            {/* Login History */}
            <div className="bg-card border border-border p-6 rounded-lg shadow-sm flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary">Recent Login History</h3>
                <button className="text-[10px] font-bold uppercase tracking-wider text-blue-500 hover:text-blue-400">View Full Audit</button>
              </div>

              <div className="flex flex-col text-xs flex-1">
                <div className="grid grid-cols-4 py-2 border-b border-border/50 font-bold uppercase tracking-wider text-muted text-[9px]">
                  <span>Timestamp</span>
                  <span>IP Address</span>
                  <span>Device/OS</span>
                  <span className="text-right">Status</span>
                </div>
                {filteredHistory.length === 0 && (
                  <div className="py-6 text-center text-muted text-xs">No login history available.</div>
                )}
                {filteredHistory.map((item, i) => (
                  <div key={i} className="grid grid-cols-4 py-3 border-b border-border/30 last:border-0 hover:bg-page/50 transition-colors group px-1 -mx-1 rounded">
                    <span className="font-mono text-muted group-hover:text-primary transition-colors">{item.time}</span>
                    <span className="font-mono">{item.ip}</span>
                    <span className="text-muted">{item.device}</span>
                    <span className={`font-bold tracking-wider text-[10px] text-right ${item.status === 'SUCCESS' ? 'text-emerald-500' :
                      item.status === 'FAILED' ? 'text-red-500' :
                        'text-blue-500'
                      }`}>{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Sensitive Asset Downloads */}
          <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary mb-4">Sensitive Asset Downloads</h3>

            <div className="grid grid-cols-12 py-2 border-b border-border/50 font-bold uppercase tracking-wider text-muted text-[9px]">
              <span className="col-span-5">Asset Name</span>
              <span className="col-span-2">Size</span>
              <span className="col-span-3">Classification</span>
              <span className="col-span-2 text-right text-transparent">Action</span>
            </div>

            <div className="flex flex-col text-xs pt-1">
              <div className="py-6 text-center text-muted col-span-12">
                No file activity data available for this user.
              </div>
            </div>
          </div>

          {/* Anomaly Detection */}
          <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary mb-4">Anomaly Detection</h3>

            <div className="flex flex-col gap-3">
              {(user.failed_logins ?? 0) === 0 && user.is_active && !user.locked_until ? (
                <div className="flex items-start gap-4 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <ShieldCheck className="text-emerald-500 mt-0.5 shrink-0" size={18} />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold tracking-tight text-emerald-600 dark:text-emerald-400">No Anomalies Detected</span>
                    <span className="text-xs text-muted">User activity aligns with established behavioral baseline.</span>
                  </div>
                </div>
              ) : (
                <>
                  {(user.failed_logins ?? 0) > 0 && (
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                      <ShieldAlert className="text-red-500 mt-0.5 shrink-0" size={18} />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold tracking-tight text-red-600 dark:text-red-400">Failed Authentication Attempts</span>
                        <span className="text-xs text-muted">{user.failed_logins} failed login attempt(s) recorded on this account.</span>
                      </div>
                    </div>
                  )}
                  {user.locked_until && (
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <Clock className="text-amber-500 mt-0.5 shrink-0" size={18} />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold tracking-tight text-amber-600 dark:text-amber-400">Account Locked</span>
                        <span className="text-xs text-muted">Locked until {new Date(user.locked_until).toLocaleString()} due to excessive failed attempts.</span>
                      </div>
                    </div>
                  )}
                  {!user.is_active && (
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                      <ShieldAlert className="text-red-500 mt-0.5 shrink-0" size={18} />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold tracking-tight text-red-600 dark:text-red-400">Account Suspended</span>
                        <span className="text-xs text-muted">This account has been administratively suspended.</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Banner - VPN */}
        <div className="bg-card border border-border p-6 rounded-lg shadow-sm flex flex-col relative overflow-hidden">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary">VPN Tunnel Status</h3>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold tracking-widest border ${user.vpn_public_key
              ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10'
              : 'text-muted border-border bg-page/50'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${user.vpn_public_key ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
              {user.vpn_public_key ? 'KEY PROVISIONED' : 'NO VPN KEY'}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-page/50 border border-border/50">
              <Globe className="text-blue-500" size={20} />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted mb-0.5">VPN Key</span>
                <span className="font-mono text-sm font-bold truncate max-w-[180px]">
                  {user.vpn_public_key ? `${user.vpn_public_key.substring(0, 16)}...` : 'Not configured'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-page/50 border border-border/50">
              <Activity className="text-blue-500" size={20} />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted mb-0.5">Last Login</span>
                <span className="font-mono text-sm font-bold">
                  {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-page/50 border border-border/50">
              <ShieldAlert className="text-blue-500" size={20} />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted mb-0.5">Encryption</span>
                <span className="font-mono text-sm font-bold">{user.vpn_public_key ? 'AES-256-GCM' : 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
