import { useState } from 'react';
import { Search, Bell, MoreVertical, Moon, Sun, MinusSquare, PlusSquare, Menu } from 'lucide-react';
import { mockAlerts, mockEvents } from '../../mock/mockAuth';
import { useThemeContext } from '../../context/ThemeContext';
import { useSidebar } from '../../context/SidebarContext';

export default function AlertFeed() {
  const [activeTab, setActiveTab] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const { theme, toggleTheme } = useThemeContext();
  const { toggleSidebar } = useSidebar();
  const filteredAlerts = mockAlerts.filter(a => {
    const matchesTab = activeTab === 'All' || a.status.toLowerCase() === activeTab.toLowerCase();
    const matchesSearch = a.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.severity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.username.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-page text-primary transition-colors duration-200">

      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card transition-colors duration-200 shrink-0">
        <button onClick={toggleSidebar} className="md:hidden p-2 -ml-2 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors">
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold tracking-tight">Alert Feed</h1>
          <nav className="hidden sm:flex items-center gap-1">
            {['All', 'Open', 'Investigating', 'Closed'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === tab
                    ? 'bg-blue-500/10 text-blue-500'
                    : 'text-muted hover:text-primary hover:bg-page/50'
                  }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative w-64 hidden md:block">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={14} className="text-muted" />
            </div>
            <input
              type="text"
              placeholder="Search alerts..."
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

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6 flex flex-col gap-4">

        {/* Alerts List */}
        <div className="flex flex-col gap-4">
          {filteredAlerts.map(alert => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
          {filteredAlerts.length === 0 && (
            <div className="p-8 text-center text-muted border border-border/50 border-dashed rounded-lg">
              No alerts found for this filter.
            </div>
          )}
        </div>

        {/* Bottom KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-auto pt-6">
          <StatCard title="ACTIVE ALERTS" value="42" sub="+12% from yesterday" />
          <StatCard title="MEAN TIME TO RESOLVE" value="14m" sub="-4m improvement" positive />
          <StatCard title="BLOCKED IPS" value="1,284" sub="Real-time sync active" />
          <div className="p-5 border border-border rounded-lg bg-card shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold tracking-wider uppercase text-muted">SYSTEM HEALTH</span>
            <div className="flex flex-col mt-2">
              <span className="text-2xl font-bold tracking-tight text-emerald-500">Stable</span>
              <span className="text-[10px] text-muted font-medium mt-1">All services nominal</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponents

function AlertCard({ alert }: { alert: any }) {
  const [expanded, setExpanded] = useState(alert.id === 'a1'); // Default expand first one

  // Find related events
  const relatedEvents = mockEvents.filter(e => alert.evidence.includes(e.id));

  return (
    <div className="border border-border rounded-lg bg-card shadow-sm overflow-hidden flex flex-col transition-colors">
      <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        {/* Left Side: Severity & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <SeverityBadge level={alert.severity} />
          <div className="flex flex-col">
            <span className="font-semibold text-sm tracking-wide">{formatTitle(alert.alert_type)}</span>
            <span className="text-[11px] text-muted">User: {alert.username} | Target: {alert.description.substring(0, 30)}...</span>
          </div>
        </div>

        {/* Right Side: Meta & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex flex-col text-right">
            <span className="text-[9px] uppercase tracking-wider text-muted font-bold">Timestamp</span>
            <span className="text-xs font-mono">{alert.created_at}</span>
          </div>
          <div className="flex flex-col text-right w-24">
            <span className="text-[9px] uppercase tracking-wider text-muted font-bold">Status</span>
            <span className="text-xs font-semibold capitalize flex items-center justify-end gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${alert.status === 'OPEN' ? 'bg-blue-500' :
                  alert.status === 'INVESTIGATING' ? 'bg-amber-500' : 'bg-green-500'
                }`}></span>
              {alert.status.toLowerCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors">
              Suspend
            </button>
            <button className="px-4 py-1.5 border border-border hover:bg-page text-primary text-xs font-medium rounded transition-colors">
              {alert.status === 'CLOSED' ? 'Details' : 'Close'}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Evidence Section */}
      {relatedEvents.length > 0 && (
        <div className="border-t border-border/50 bg-page/30">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-muted hover:text-primary transition-colors focus:outline-none"
          >
            {expanded ? <MinusSquare size={14} /> : <PlusSquare size={14} />}
            <span className="tracking-wide uppercase text-[10px]">Evidence Logs (Last {relatedEvents.length} Events)</span>
          </button>

          {expanded && (
            <div className="px-5 pb-5">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/30 text-[9px] uppercase tracking-wider text-muted">
                    <th className="py-2.5 font-semibold">Event ID</th>
                    <th className="py-2.5 font-semibold">Type</th>
                    <th className="py-2.5 font-semibold">Source IP</th>
                    <th className="py-2.5 font-semibold">Severity</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-muted">
                  {relatedEvents.map(evt => (
                    <tr key={evt.id} className="border-b border-border/10 hover:bg-page/50 transition-colors">
                      <td className="py-2.5 text-blue-500">EVT-{evt.id.toString().padStart(4, '0')}</td>
                      <td className="py-2.5">{evt.event_type}</td>
                      <td className="py-2.5">{evt.source_ip}</td>
                      <td className="py-2.5">
                        <span className={evt.severity === 'HIGH' ? 'text-red-400' : 'text-orange-400'}>
                          {evt.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, sub, positive }: { title: string, value: string, sub: string, positive?: boolean }) {
  return (
    <div className="p-5 border border-border rounded-lg bg-card shadow-sm flex flex-col justify-between">
      <span className="text-[10px] font-bold tracking-wider uppercase text-muted">{title}</span>
      <div className="flex flex-col mt-2">
        <span className="text-2xl font-bold tracking-tight">{value}</span>
        <span className={`text-[10px] font-bold tracking-wide mt-1 ${positive ? 'text-emerald-500' : 'text-muted'}`}>
          {sub}
        </span>
      </div>
    </div>
  );
}

function SeverityBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    'CRITICAL': 'text-red-600 bg-red-500/10 border-red-500/20 dark:text-red-400',
    'HIGH': 'text-orange-600 bg-orange-500/10 border-orange-500/20 dark:text-orange-400',
    'MEDIUM': 'text-blue-600 bg-blue-500/10 border-blue-500/20 dark:text-blue-400',
    'LOW': 'text-slate-600 bg-slate-500/10 border-slate-500/20 dark:text-slate-400',
    'INFO': 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400',
  };

  const defaultColor = 'text-slate-500 bg-slate-500/10 border-slate-500/20';

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase border ${colors[level] || defaultColor}`}>
      {level}
    </span>
  );
}

function formatTitle(str: string) {
  return str.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ') + ' Detected';
}
