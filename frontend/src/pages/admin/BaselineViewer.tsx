import { useState, useEffect } from 'react';
import { Search, Moon, Sun, MoreVertical, AlertTriangle, Menu } from 'lucide-react';
import { useThemeContext } from '../../context/ThemeContext';
import { useSidebar } from '../../context/SidebarContext';
import { useSiem } from '../../hooks/useSiem';
import { getEvents } from '../../api/siem';
import type { SiemEvent } from '../../types/siem.types';
import NotificationDropdown from '../../components/NotificationDropdown';

export default function BaselineViewer() {
  const { theme, toggleTheme } = useThemeContext();
  const [searchTerm, setSearchTerm] = useState('');
  const { toggleSidebar } = useSidebar();
  
  const { baselines, loading: baselinesLoading } = useSiem();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userEvents, setUserEvents] = useState<SiemEvent[]>([]);
  
  useEffect(() => {
    if (baselines.length > 0 && !selectedUserId) {
      setSelectedUserId(baselines[0].user_id);
    }
  }, [baselines, selectedUserId]);

  useEffect(() => {
    if (selectedUserId) {
      getEvents({ user_id: selectedUserId, per_page: 50 })
        .then(res => setUserEvents(res.events))
        .catch(console.error);
    }
  }, [selectedUserId]);

  const activeBaseline = baselines.find(b => b.user_id === selectedUserId);

  const filteredAudit = userEvents.filter(item =>
    item.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.source_ip && item.source_ip.includes(searchTerm))
  );

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-page text-primary transition-colors duration-200">

      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card transition-colors duration-200 shrink-0">
        <button onClick={toggleSidebar} className="md:hidden p-2 -ml-2 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors">
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold tracking-wide text-blue-500">Baseline Viewer</h1>
          <span className="text-muted">/</span>
          <select 
            className="flex items-center gap-1.5 px-2 py-1 bg-page/50 border border-border/50 rounded-md text-xs font-medium hover:bg-page transition-colors outline-none"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            {baselinesLoading ? (
               <option value="">Loading...</option>
            ) : baselines.length === 0 ? (
               <option value="">No baselines</option>
            ) : baselines.map(b => (
               <option key={b.user_id} value={b.user_id}>User: {b.username || b.user_id}</option>
            ))}
          </select>
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
          <NotificationDropdown />
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
        {activeBaseline && activeBaseline.confidence < 0.5 && (
          <div className="bg-amber-500/10 border-l-[3px] border-amber-500 p-4 rounded-r-lg flex items-center justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-amber-600 dark:text-amber-500 tracking-wide">Confidence Level Low</span>
                <span className="text-xs text-amber-600/80 dark:text-amber-500/80">
                  Current baseline confidence for {activeBaseline.username || activeBaseline.user_id} is {(activeBaseline.confidence * 100).toFixed(0)}%. Anomalous behavior detected outside normal bounds.
                </span>
              </div>
            </div>
            <button className="text-[10px] font-bold tracking-widest uppercase text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors">
              RE-VERIFY
            </button>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-card border border-border px-5 py-4 rounded-lg flex flex-col items-center justify-center shadow-sm">
            <span className="text-[9px] uppercase tracking-wider font-bold text-muted mb-4 self-start">Confidence Ring</span>
            <div className={`w-24 h-24 rounded-full border-[6px] flex flex-col items-center justify-center ${(activeBaseline?.confidence ?? 0) < 0.5 ? 'border-orange-500' : 'border-blue-500'}`}>
              <span className="text-2xl font-bold tracking-tight">{activeBaseline ? (activeBaseline.confidence * 100).toFixed(0) : 0}%</span>
              <span className="text-[8px] tracking-wider uppercase text-muted font-bold">Confidence</span>
            </div>
          </div>

          <div className="bg-card border border-border px-5 py-4 rounded-lg flex flex-col justify-between shadow-sm">
            <span className="text-[9px] uppercase tracking-wider font-bold text-muted">Avg Login Hour</span>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-bold font-mono tracking-tight">{activeBaseline ? Math.round(activeBaseline.avg_login_hour).toString().padStart(2, '0') + ':00' : '--:--'}</span>
              <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1">
                 Estimated daily start time
              </span>
            </div>
          </div>

          <div className="bg-card border border-border px-5 py-4 rounded-lg flex flex-col justify-between shadow-sm">
            <span className="text-[9px] uppercase tracking-wider font-bold text-muted">Avg Files / Day</span>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-bold tracking-tight">{activeBaseline?.avg_files_day ? activeBaseline.avg_files_day.toFixed(1) : '0'}</span>
              <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1">
                — Based on historical activity
              </span>
            </div>
          </div>

          <div className="bg-card border border-border px-5 py-4 rounded-lg flex flex-col justify-between shadow-sm">
            <span className="text-[9px] uppercase tracking-wider font-bold text-muted">Total Monitored Tx</span>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-bold tracking-tight">{activeBaseline?.tx_count || 0}</span>
              <span className="text-[10px] font-bold text-muted flex items-center gap-1">
                Events shaping this baseline
              </span>
            </div>
          </div>

          <div className="bg-card border border-border px-5 py-4 rounded-lg flex flex-col justify-between shadow-sm">
            <span className="text-[9px] uppercase tracking-wider font-bold text-muted">Messages / Day</span>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-bold tracking-tight">{activeBaseline?.avg_messages_day ? activeBaseline.avg_messages_day.toFixed(1) : '0'}</span>
              <span className="text-[10px] font-bold text-muted flex items-center gap-1">
                Communication volume
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
              {activeBaseline?.known_ips?.length ? activeBaseline.known_ips.map(ip => (
                <span key={ip} className="px-2.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-bold rounded">
                  {ip}
                </span>
              )) : (
                <span className="text-xs text-muted">No known IPs yet</span>
              )}
            </div>

            <div className="border border-border/50 rounded-lg p-4 bg-page/50 flex flex-col gap-2 mt-auto">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted">Last Updated</span>
              </div>
              <span className="font-mono text-xs font-bold text-primary">{activeBaseline?.last_updated ? new Date(activeBaseline.last_updated).toLocaleString() : 'Never'}</span>
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
          <span className="text-[10px] font-bold tracking-wider uppercase text-primary mb-4">Anomaly Audit Trail (Recent Events)</span>
          <div className="flex flex-col">
            <div className="border-b border-border/50 pb-2 mb-2 flex">
              <span className="w-40 text-[9px] font-bold text-muted uppercase tracking-wider">Timestamp</span>
              <span className="w-40 text-[9px] font-bold text-muted uppercase tracking-wider">Event Type</span>
              <span className="flex-1 text-[9px] font-bold text-muted uppercase tracking-wider">Source IP / Detail</span>
            </div>
            {filteredAudit.map((evt) => (
              <div key={evt.id} className="py-2.5 flex items-start sm:items-center text-xs group hover:bg-page/50 -mx-2 px-2 rounded-md transition-colors border-b border-border/30 last:border-0">
                <span className="w-40 font-mono text-muted group-hover:text-primary transition-colors">{new Date(evt.created_at).toLocaleString()}</span>
                <span className={`w-40 font-mono font-bold ${evt.severity === 'CRITICAL' || evt.severity === 'HIGH' ? 'text-red-500' : 'text-blue-500'}`}>{evt.event_type}</span>
                <span className="flex-1 font-medium">{evt.source_ip || '-'} {Object.keys(evt.payload || {}).length > 0 ? `— ${JSON.stringify(evt.payload)}` : ''}</span>
              </div>
            ))}
            {filteredAudit.length === 0 && (
              <div className="py-8 text-center text-muted text-xs">No audit events found for this user.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponents
