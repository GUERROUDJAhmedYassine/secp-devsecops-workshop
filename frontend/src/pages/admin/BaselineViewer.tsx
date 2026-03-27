import { useState } from 'react';
import { Search, Bell, Moon, Sun, MoreVertical, AlertTriangle, ChevronDown } from 'lucide-react';
import { useThemeContext } from '../../context/ThemeContext';

export default function BaselineViewer() {
  const { theme, toggleTheme } = useThemeContext();
  const [searchTerm, setSearchTerm] = useState('');

  const auditTrail = [
    { time: '2023-10-24 22:14:05', tag: 'AUTH_SUCC', color: 'text-blue-500', detail: 'User Fatima Khaldi initiated remote session from 45.33.22.11' },
    { time: '2023-10-24 22:15:12', tag: 'FILE_ACCESS', color: 'text-orange-500', detail: 'Accessed non-standard directory: /etc/secure_vault/keys/' },
    { time: '2023-10-24 22:18:44', tag: 'SEC_ALERT', color: 'text-red-500', detail: 'Confidence score drop detected: 92% -> 28% (Deviation: Location/Time)' },
  ];

  const filteredAudit = auditTrail.filter(item => 
    item.detail.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.tag.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-page text-primary transition-colors duration-200">
      
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card transition-colors duration-200 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold tracking-wide text-blue-500">Baseline Viewer</h1>
          <span className="text-muted">/</span>
          <button className="flex items-center gap-1.5 px-2 py-1 bg-page/50 border border-border/50 rounded-md text-xs font-medium hover:bg-page transition-colors">
            User: Fatima Khaldi
            <ChevronDown size={14} className="text-muted" />
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative w-64 hidden md:block">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={14} className="text-muted" />
            </div>
            <input
              type="text"
              placeholder="Search parameters..."
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
        
        {/* Warning Banner */}
        <div className="bg-amber-500/10 border-l-[3px] border-amber-500 p-4 rounded-r-lg flex items-center justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-amber-600 dark:text-amber-500 tracking-wide">Confidence Level Critical</span>
              <span className="text-xs text-amber-600/80 dark:text-amber-500/80">
                Current baseline confidence for Fatima Khaldi has dropped to 28%. Anomalous behavior detected outside 7-day norms.
              </span>
            </div>
          </div>
          <button className="text-[10px] font-bold tracking-widest uppercase text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors">
            RE-VERIFY
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-card border border-border px-5 py-4 rounded-lg flex flex-col items-center justify-center shadow-sm">
            <span className="text-[9px] uppercase tracking-wider font-bold text-muted mb-4 self-start">Confidence Ring</span>
            <div className="w-24 h-24 rounded-full border-[6px] border-orange-500 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tracking-tight">28%</span>
              <span className="text-[8px] tracking-wider uppercase text-muted font-bold">Confidence</span>
            </div>
          </div>
          
          <div className="bg-card border border-border px-5 py-4 rounded-lg flex flex-col justify-between shadow-sm">
            <span className="text-[9px] uppercase tracking-wider font-bold text-muted">Average Session</span>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-bold font-mono tracking-tight">04:12:05</span>
              <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                <TrendingIcon type="down" /> - 15% from baseline
              </span>
            </div>
          </div>

          <div className="bg-card border border-border px-5 py-4 rounded-lg flex flex-col justify-between shadow-sm">
            <span className="text-[9px] uppercase tracking-wider font-bold text-muted">Data Egress</span>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-bold tracking-tight">1.42 GB</span>
              <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1">
                — Within expected range
              </span>
            </div>
          </div>

          <div className="bg-card border border-border px-5 py-4 rounded-lg flex flex-col justify-between shadow-sm">
            <span className="text-[9px] uppercase tracking-wider font-bold text-muted">Auth Attempts</span>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-bold tracking-tight">14</span>
              <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                <AlertTriangle size={10} /> 6 failed today
              </span>
            </div>
          </div>

          <div className="bg-card border border-border px-5 py-4 rounded-lg flex flex-col justify-between shadow-sm">
            <span className="text-[9px] uppercase tracking-wider font-bold text-muted">App Usage</span>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-bold tracking-tight">92%</span>
              <span className="text-[10px] font-bold text-muted flex items-center gap-1">
                Standard load
              </span>
            </div>
          </div>
        </div>

        {/* Middle Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Known IPs */}
          <div className="bg-card border border-border px-6 py-5 rounded-lg shadow-sm flex flex-col">
            <span className="text-[10px] font-bold tracking-wider uppercase text-primary mb-4">Baseline: Known IPs</span>
            <div className="flex flex-wrap gap-2 mb-8 mt-2">
              {['192.168.1.105', '10.0.4.12', '172.16.254.1', '100.0.115.45', '192.168.1.106', '8.8.8.8'].map(ip => (
                <span key={ip} className="px-2.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-bold rounded">
                  {ip}
                </span>
              ))}
            </div>
            
            <div className="border border-border/50 rounded-lg p-4 bg-page/50 flex flex-col gap-2 mt-auto">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted">New IP Detected</span>
                <span className="px-1.5 py-0.5 bg-red-500/10 text-red-500 text-[8px] font-bold uppercase rounded border border-red-500/20">Critical</span>
              </div>
              <span className="font-mono text-xs font-bold text-red-500">45.33.22.11 (Tokyo, JP)</span>
            </div>
          </div>

          {/* Trend Chart Mock */}
          <div className="lg:col-span-2 bg-card border border-border px-6 py-5 rounded-lg shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6 text-primary">
              <span className="text-[10px] font-bold tracking-wider uppercase">Confidence Trend (7 Days)</span>
              <div className="flex items-center gap-4 text-[9px] font-bold tracking-wider uppercase text-muted">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 block"></span> Expected</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500 block"></span> Actual</span>
              </div>
            </div>
            
            <div className="flex-1 flex items-end gap-2 sm:gap-4 h-48 mt-2">
              {/* Mock Bar Chart */}
              {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day, i) => {
                // Determine heights for blue (expected) and orange (actual)
                const expectedHeight = i === 1 ? '60%' : i === 2 ? '65%' : '55%';
                const actualHeight = i > 3 ? (i === 4 ? '35%' : i === 5 ? '25%' : '15%') : expectedHeight;
                const isOrange = i > 3;
                
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="w-full flex items-end justify-center h-[90%] gap-1">
                      {isOrange ? (
                        <>
                          <div className="w-1/2 bg-blue-500/20 dark:bg-blue-500/20 rounded-sm transition-all" style={{ height: expectedHeight }}></div>
                          <div className="w-1/2 bg-orange-500 rounded-sm group-hover:bg-orange-400 transition-all shadow-[0_0_10px_rgba(249,115,22,0.3)]" style={{ height: actualHeight }}></div>
                        </>
                      ) : (
                        <div className="w-3/4 bg-blue-500 rounded-sm group-hover:bg-blue-400 transition-all" style={{ height: actualHeight }}></div>
                      )}
                    </div>
                    <span className="text-[9px] font-bold text-muted uppercase tracking-wider">{day}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Audit Trail */}
        <div className="bg-card border border-border px-6 py-5 rounded-lg shadow-sm flex flex-col">
          <span className="text-[10px] font-bold tracking-wider uppercase text-primary mb-4">Anomaly Audit Trail</span>
          <div className="flex flex-col">
            <div className="border-b border-border/50 pb-2 mb-2 flex">
              <span className="w-40 text-[9px] font-bold text-muted uppercase tracking-wider">Timestamp</span>
              <span className="w-32 text-[9px] font-bold text-muted uppercase tracking-wider">Action</span>
              <span className="flex-1 text-[9px] font-bold text-muted uppercase tracking-wider">Detail</span>
            </div>
            {filteredAudit.map((item, i) => (
              <div key={i} className="py-2.5 flex items-start sm:items-center text-xs group hover:bg-page/50 -mx-2 px-2 rounded-md transition-colors border-b border-border/30 last:border-0">
                <span className="w-40 font-mono text-muted group-hover:text-primary transition-colors">{item.time}</span>
                <span className={`w-32 font-mono font-bold ${item.color}`}>{item.tag}</span>
                <span className="flex-1 font-medium">{item.detail}</span>
              </div>
            ))}
            {filteredAudit.length === 0 && (
              <div className="py-8 text-center text-muted text-xs">No audit events match your search.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponents
function TrendingIcon({ type }: { type: 'up' | 'down' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {type === 'up' ? (
        <>
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </>
      ) : (
        <>
          <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
          <polyline points="16 17 22 17 22 11" />
        </>
      )}
    </svg>
  );
}
