import { useState } from 'react';
import { Search, Filter, Moon, Sun, Bell, MoreVertical, Menu } from 'lucide-react';
import { mockEvents } from '../../mock/mockAuth';
import { useThemeContext } from '../../context/ThemeContext';
import { useSidebar } from '../../context/SidebarContext';
export default function EventLog() {
  const [searchTerm, setSearchTerm] = useState('');
  const { theme, toggleTheme } = useThemeContext();
  const { toggleSidebar } = useSidebar();
  const filteredEvents = mockEvents.filter(e =>
    e.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.source_ip.includes(searchTerm) ||
    e.service.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-page text-primary transition-colors duration-200">

      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card transition-colors duration-200 shrink-0">
        <button onClick={toggleSidebar} className="md:hidden p-2 -ml-2 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors">
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight">Global Event Log</h1>
          <div className="px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-500 border border-slate-500/20 text-xs font-bold tracking-wider">
            {mockEvents.length} EVENTS
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={14} className="text-muted" />
            </div>
            <input
              type="text"
              placeholder="Search events, IPs, services..."
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
          <button className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-md hover:bg-page transition-colors text-sm font-medium text-muted hover:text-primary">
            <Filter size={14} />
            Filter
          </button>
          <button className="text-muted hover:text-primary transition-colors p-1 hidden sm:block">
            <MoreVertical size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-card border border-border rounded-lg shadow-sm flex flex-col">

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-[10px] tracking-wider text-muted uppercase bg-page/30">
                  <th className="px-6 py-4 font-semibold">Event ID</th>
                  <th className="px-6 py-4 font-semibold">Timestamp</th>
                  <th className="px-6 py-4 font-semibold">Type</th>
                  <th className="px-6 py-4 font-semibold">Severity</th>
                  <th className="px-6 py-4 font-semibold">Service</th>
                  <th className="px-6 py-4 font-semibold">Source IP</th>
                  <th className="px-6 py-4 font-semibold">Payload Details</th>
                </tr>
              </thead>
              <tbody className="text-sm border-b border-border/30">
                {filteredEvents.map((evt) => (
                  <tr key={evt.id} className="border-b border-border/30 hover:bg-page/50 transition-colors group">
                    <td className="px-6 py-3 font-mono text-xs text-blue-500 w-24">EVT-{evt.id.toString().padStart(5, '0')}</td>
                    <td className="px-6 py-3 font-mono text-xs text-muted w-36 whitespace-nowrap">{evt.created_at}</td>
                    <td className="px-6 py-3 font-medium whitespace-nowrap">{evt.event_type}</td>
                    <td className="px-6 py-3 w-32">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase border ${evt.severity === 'CRITICAL' ? 'text-red-600 bg-red-500/10 border-red-500/20 dark:text-red-400' :
                          evt.severity === 'HIGH' ? 'text-orange-600 bg-orange-500/10 border-orange-500/20 dark:text-orange-400' :
                            evt.severity === 'MEDIUM' ? 'text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-400' :
                              evt.severity === 'LOW' ? 'text-blue-600 bg-blue-500/10 border-blue-500/20 dark:text-blue-400' :
                                'text-slate-600 bg-slate-500/10 border-slate-500/20 dark:text-slate-400'
                        }`}>
                        {evt.severity}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-muted w-24">{evt.service}</td>
                    <td className="px-6 py-3 font-mono text-xs w-32">{evt.source_ip}</td>
                    <td className="px-6 py-3">
                      <div className="bg-page/50 rounded p-1.5 border border-border/50 text-xs font-mono text-muted overflow-hidden text-ellipsis whitespace-nowrap max-w-xs">
                        {JSON.stringify(evt.payload)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredEvents.length === 0 && (
              <div className="p-12 text-center text-muted">
                No events found matching your search.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
