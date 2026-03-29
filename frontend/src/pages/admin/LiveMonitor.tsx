import { useState } from 'react';
import { Search, Bell, Moon, Sun, MoreVertical, Activity, AlertTriangle, Users, Sliders } from 'lucide-react';
import { mockAlerts, mockEvents } from '../../mock/mockAuth';
import { useThemeContext } from '../../context/ThemeContext';

export default function LiveMonitor() {
  const { theme, toggleTheme } = useThemeContext();
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-page text-primary transition-colors duration-200">

      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card transition-colors duration-200 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight">Live Monitor</h1>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            LIVE
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative w-64 hidden md:block">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={14} className="text-muted" />
            </div>
            <input
              type="text"
              placeholder="Search operations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-page border border-border rounded-md text-sm placeholder:text-muted focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <button className="text-muted hover:text-primary transition-colors p-1">
            <Bell size={18} />
          </button>
          <button onClick={toggleTheme} className="text-muted hover:text-primary transition-colors p-1">
            {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button className="text-muted hover:text-primary transition-colors p-1 hidden sm:block">
            <MoreVertical size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Scrollable Area */}
      <div className="flex-1 overflow-auto p-6">

        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 mt-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard
            title="EVENTS TODAY"
            value={mockEvents.length > 0 ? "124,802" : "0"}
            sub="12.5%"
            subType="positive"
            icon={<Activity size={16} />}
          />
          <KPICard
            title="OPEN ALERTS"
            value={mockAlerts.length.toString()}
            sub={`Critical: ${mockAlerts.filter(a => a.severity === 'CRITICAL').length}`}
            subType="negative"
            icon={<AlertTriangle size={16} />}
            alert
          />
          <KPICard
            title="ACTIVE USERS"
            value="1,104"
            sub="Across 12 regions"
            subType="neutral"
            icon={<Users size={16} />}
          />
          <KPICard
            title="DETECTION RULES"
            value="856"
            sub="Active & Validated"
            subType="neutral"
            icon={<Sliders size={16} />}
          />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Recent Security Alerts */}
          <div className="xl:col-span-2 bg-card border border-border rounded-lg shadow-sm flex flex-col min-h-[400px]">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold tracking-wide flex items-center gap-2">
                Recent Security Alerts
              </h2>
              <button className="text-[10px] uppercase tracking-wider font-bold text-blue-500 hover:text-blue-400">
                View All
              </button>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/50 text-[10px] tracking-wider text-muted uppercase">
                    <th className="px-5 py-3 font-semibold">Timestamp</th>
                    <th className="px-5 py-3 font-semibold">Event Source</th>
                    <th className="px-5 py-3 font-semibold">Severity</th>
                    <th className="px-5 py-3 font-semibold whitespace-nowrap">Identifier</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {mockAlerts.slice(0, 5).map((alert) => (
                    <tr key={alert.id} className="border-b border-border/30 hover:bg-page/50 transition-colors group">
                      <td className="px-5 py-4 font-mono text-xs text-muted group-hover:text-primary transition-colors">
                        {alert.created_at.split(' ')[1] || '00:00:00'}
                      </td>
                      <td className="px-5 py-4 font-medium">
                        {alert.description.split(' ').slice(0, 5).join(' ')}...
                      </td>
                      <td className="px-5 py-4">
                        <SeverityBadge level={alert.severity} />
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-muted">
                        {alert.user_id === "1" ? "10.8.0.10" : "192.168.1.105"}
                      </td>
                    </tr>
                  ))}
                  {/* Hardcoded rows to fill space matching the screenshot */}
                  <tr className="border-b border-border/30 hover:bg-page/50 transition-colors group">
                    <td className="px-5 py-4 font-mono text-xs text-muted group-hover:text-primary transition-colors">14:19:30.88</td>
                    <td className="px-5 py-4 font-medium">Anomalous Data Egress</td>
                    <td className="px-5 py-4"><SeverityBadge level="HIGH" /></td>
                    <td className="px-5 py-4 font-mono text-xs text-muted">NODE-EX-04</td>
                  </tr>
                  <tr className="border-b border-border/30 hover:bg-page/50 transition-colors group">
                    <td className="px-5 py-4 font-mono text-xs text-muted group-hover:text-primary transition-colors">14:15:12.44</td>
                    <td className="px-5 py-4 font-medium">Port Scan Detected (Internal)</td>
                    <td className="px-5 py-4"><SeverityBadge level="MEDIUM" /></td>
                    <td className="px-5 py-4 font-mono text-xs text-muted">10.0.4.12</td>
                  </tr>
                  <tr className="border-b border-border/30 hover:bg-page/50 transition-colors group">
                    <td className="px-5 py-4 font-mono text-xs text-muted group-hover:text-primary transition-colors">14:12:01.04</td>
                    <td className="px-5 py-4 font-medium">New Root User Provisioned</td>
                    <td className="px-5 py-4"><SeverityBadge level="CRITICAL" /></td>
                    <td className="px-5 py-4 font-mono text-xs text-muted">IAM-SEC-01</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Detection Matrix */}
          <div className="bg-card border border-border rounded-lg shadow-sm flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold tracking-wide">Live Detection Matrix</h2>
              <span className="text-[10px] uppercase tracking-wider text-muted font-bold">R1-R8 ACTIVE</span>
            </div>
            <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[500px]">
              <DetectionRule id="R1" title="Geo-Location Anomaly" desc="Logins outside registered zones" status="CRITICAL" />
              <DetectionRule id="R2" title="Brute Force Mitigation" desc="Adaptive lockout protocol" status="HIGH" />
              <DetectionRule id="R3" title="Lateral Movement Tracking" desc="Pre-hop detection" status="CRITICAL" />
              <DetectionRule id="R4" title="Encrypted Payload Scan" desc="Entropy analysis on packet body" status="MEDIUM" />
              <DetectionRule id="R5" title="Domain Seeding Check" desc="DGA detection algorithm" status="HIGH" />
              <DetectionRule id="R6" title="Memory Overflow Shield" desc="Kernel space monitoring" status="DISABLED" />
              <DetectionRule id="R7" title="Zero-Day Beaconing" desc="AI-driven traffic profiling" status="CRITICAL" />
              <DetectionRule id="R8" title="Privilege Escalation Trap" desc="Honey-pot file access tracking" status="CRITICAL" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// Subcomponents

function KPICard({ title, value, sub, subType, icon, alert }: { title: string, value: string, sub: string, subType: 'positive' | 'negative' | 'neutral', icon: React.ReactNode, alert?: boolean }) {
  return (
    <div className={`bg-card border ${alert ? 'border-red-500/30 dark:border-red-500/20 shadow-[0_0_15px_-3px_rgba(239,68,68,0.1)]' : 'border-border'} rounded-lg p-5 flex flex-col relative overflow-hidden shadow-sm`}>
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider">{title}</h3>
        <span className={`text-[#4f8ef7] ${alert ? 'text-red-500' : ''}`}>{icon}</span>
      </div>
      <div className="flex items-baseline gap-2 mt-auto">
        <span className="text-2xl font-bold tracking-tight">{value}</span>
        <span className={`text-[10px] font-bold ${subType === 'positive' ? 'text-emerald-500' : subType === 'negative' ? 'text-red-500' : 'text-muted'}`}>
          {subType === 'positive' && '+'}{sub}
        </span>
      </div>
    </div>
  );
}

function SeverityBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    'CRITICAL': 'text-red-600 bg-red-500/10 border-red-500/20 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/20',
    'HIGH': 'text-orange-600 bg-orange-500/10 border-orange-500/20 dark:text-orange-400 dark:bg-orange-500/10 dark:border-orange-500/20',
    'MEDIUM': 'text-blue-600 bg-blue-500/10 border-blue-500/20 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/20',
    'LOW': 'text-slate-600 bg-slate-500/10 border-slate-500/20 dark:text-slate-400 dark:bg-slate-500/10 dark:border-slate-500/20',
    'INFO': 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20',
  };

  const defaultColor = 'text-slate-500 bg-slate-500/10 border-slate-500/20';

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase border ${colors[level] || defaultColor}`}>
      {level}
    </span>
  );
}

function DetectionRule({ id, title, desc, status }: { id: string, title: string, desc: string, status: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-md bg-page/50 border border-border/50 hover:border-border transition-colors">
      <div className="flex items-center gap-4">
        <span className="text-xs font-mono font-bold text-blue-500/70">{id}</span>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{title}</span>
          <span className="text-[10px] text-muted">{desc}</span>
        </div>
      </div>
      <SeverityBadge level={status} />
    </div>
  );
}
