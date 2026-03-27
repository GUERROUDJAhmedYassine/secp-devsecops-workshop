import { useState } from 'react';
import { Search, Bell, Moon, Sun, MoreVertical, ShieldCheck, Clock, Download, Globe, Activity, ShieldAlert } from 'lucide-react';
import { useThemeContext } from '../../context/ThemeContext';

export default function UserProfileForensics() {
  const { theme, toggleTheme } = useThemeContext();
  const [searchTerm, setSearchTerm] = useState('');

  const loginHistory = [
    { time: '2023-11-24 14:22:15', ip: '192.168.1.104', device: 'macOS 13.1 (Internal)', status: 'SUCCESS' },
    { time: '2023-11-24 09:15:30', ip: '192.168.1.104', device: 'macOS 13.1 (Internal)', status: 'SUCCESS' },
    { time: '2023-11-23 21:40:02', ip: '45.33.112.9', device: 'iOS 17.1 (iPhone 15 Pro)', status: 'SUCCESS' },
  ];

  const filteredHistory = loginHistory.filter(h => 
    h.ip.includes(searchTerm) || h.device.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-page text-primary transition-colors duration-200">
      
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card transition-colors duration-200 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-muted tracking-wide">Security Operations</h1>
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
              <div className="w-12 h-12 rounded-lg bg-orange-200 text-orange-800 flex items-center justify-center font-bold text-xl shrink-0 overflow-hidden">
                {/* Simulated Avatar Image */}
                <div className="w-full h-full bg-orange-300 relative">
                  <div className="absolute bottom-0 w-8 h-8 rounded-full bg-orange-800/30 left-2"></div>
                  <div className="absolute top-2 w-5 h-5 rounded-full bg-orange-800/20 left-3.5"></div>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base">Fatima Khaldi</span>
                <span className="text-xs text-muted">Lead Security Engineer</span>
                <div className="flex gap-2 mt-1 -ml-1">
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-widest text-blue-500 uppercase bg-blue-500/10 border border-blue-500/20 scale-90 origin-left">EMPLOYEE</span>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-widest text-emerald-500 uppercase bg-emerald-500/10 border border-emerald-500/20 scale-90 origin-left">ACTIVE</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 mb-6 text-sm border-b border-border pb-6">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Security Risk Score</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Low</span>
              </div>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-3xl font-bold tracking-tight text-emerald-500 leading-none">12</span>
                <span className="text-xs text-muted font-bold pb-1">/100</span>
              </div>
              <div className="w-full h-1 bg-page rounded-full overflow-hidden mb-2">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '12%' }}></div>
              </div>
              <p className="text-[10px] text-muted leading-tight">Baseline interaction matches established profile patterns.</p>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted mb-1">Account Information</span>
              <div className="flex justify-between items-center text-muted">
                <span className="font-medium">Account ID</span>
                <span className="font-mono text-primary">PK-9926-SEC</span>
              </div>
              <div className="flex justify-between items-center text-muted">
                <span className="font-medium">Vault Level</span>
                <span className="font-medium text-primary">Tier 4 (Admin)</span>
              </div>
              <div className="flex justify-between items-center text-muted">
                <span className="font-medium">Department</span>
                <span className="font-medium text-primary">Infrastructure Ops</span>
              </div>
            </div>
          </div>

          <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card border border-border p-4 rounded-lg shadow-sm flex flex-col justify-between">
                <span className="text-[9px] uppercase tracking-wider font-bold text-muted mb-2">Logins (24H)</span>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold tracking-tight">14</span>
                  <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 mb-1">
                    <TrendingIcon type="up" color="text-emerald-500" /> stable
                  </span>
                </div>
              </div>
              <div className="bg-card border border-border p-4 rounded-lg shadow-sm flex flex-col justify-between">
                <span className="text-[9px] uppercase tracking-wider font-bold text-muted mb-2">Data Egress</span>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold tracking-tight">1.2 GB</span>
                  <span className="text-[10px] font-bold text-orange-500 flex items-center gap-1 mb-1">
                    -12%
                  </span>
                </div>
              </div>
              <div className="bg-card border border-border p-4 rounded-lg shadow-sm flex flex-col justify-between">
                <span className="text-[9px] uppercase tracking-wider font-bold text-muted mb-2">Failed Auth</span>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold tracking-tight">0</span>
                  <span className="text-[10px] font-medium text-muted mb-1">
                    None
                  </span>
                </div>
              </div>
              <div className="bg-card border border-border p-4 rounded-lg shadow-sm flex flex-col justify-between">
                <span className="text-[9px] uppercase tracking-wider font-bold text-muted mb-2">Geolocations</span>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold tracking-tight">2</span>
                  <span className="text-[10px] font-medium text-muted mb-1">
                    Known
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
                {filteredHistory.map((item, i) => (
                  <div key={i} className="grid grid-cols-4 py-3 border-b border-border/30 last:border-0 hover:bg-page/50 transition-colors group px-1 -mx-1 rounded">
                    <span className="font-mono text-muted group-hover:text-primary transition-colors">{item.time}</span>
                    <span className="font-mono">{item.ip}</span>
                    <span className="text-muted">{item.device}</span>
                    <span className="font-bold text-emerald-500 tracking-wider text-[10px] text-right">{item.status}</span>
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
              <div className="grid grid-cols-12 py-3 border-b border-border/30 hover:bg-page/50 px-2 -mx-2 rounded">
                <span className="col-span-5 font-mono text-muted truncate pr-2">root_ca_config.yaml</span>
                <span className="col-span-2">12 KB</span>
                <span className="col-span-3 flex items-start">
                  <span className="px-2 py-0.5 text-[9px] font-bold text-red-500 uppercase tracking-widest bg-red-500/10 border border-red-500/20 rounded">Critical</span>
                </span>
                <span className="col-span-2 flex justify-end">
                  <button className="text-muted hover:text-primary p-1 rounded-sm"><Download size={14} /></button>
                </span>
              </div>
              <div className="grid grid-cols-12 py-3 hover:bg-page/50 px-2 -mx-2 rounded">
                <span className="col-span-5 font-mono text-muted truncate pr-2">vpn_subnet_mask.pcap</span>
                <span className="col-span-2">450 MB</span>
                <span className="col-span-3 flex items-start">
                  <span className="px-2 py-0.5 text-[9px] font-bold text-amber-500 uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 rounded">High</span>
                </span>
                <span className="col-span-2 flex justify-end">
                  <button className="text-muted hover:text-primary p-1 rounded-sm"><Download size={14} /></button>
                </span>
              </div>
            </div>
          </div>

          {/* Anomaly Detection */}
          <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary mb-4">Anomaly Detection</h3>
            
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <ShieldCheck className="text-emerald-500 mt-0.5 shrink-0" size={18} />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold tracking-tight text-emerald-600 dark:text-emerald-400">Biometric Match Verified</span>
                  <span className="text-xs text-muted">Hardware token match, YubiKey 5C Nano</span>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-page/50 border border-border/50">
                <Clock className="text-muted mt-0.5 shrink-0" size={18} />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold tracking-tight">Geographic Shift Detected</span>
                  <span className="text-xs text-muted">Travel mode enabled for 14 days (Dubai ext)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Banner */}
        <div className="bg-card border border-border p-6 rounded-lg shadow-sm flex flex-col relative overflow-hidden">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary">Active VPN Tunnel Sessions</h3>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold tracking-widest text-emerald-500 border border-emerald-500/20 bg-emerald-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              TUNNEL ENCRYPTED
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-page/50 border border-border/50">
              <Globe className="text-blue-500" size={20} />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted mb-0.5">Gateway</span>
                <span className="font-mono text-sm font-bold">LON-99-SEC</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-4 rounded-lg bg-page/50 border border-border/50">
              <Activity className="text-blue-500" size={20} />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted mb-0.5">Uptime</span>
                <span className="font-mono text-sm font-bold">04: 21: 11</span>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-page/50 border border-border/50">
              <ShieldAlert className="text-blue-500" size={20} />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted mb-0.5">Encryption</span>
                <span className="font-mono text-sm font-bold">AES-256-GCM</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function TrendingIcon({ type, color }: { type: 'up' | 'down', color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${color}`}>
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
