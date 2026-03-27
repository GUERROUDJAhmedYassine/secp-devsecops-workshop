import { Search, Bell, Moon, Sun, MoreVertical, Plus, Mail, MessageSquare, Vault, Shield, Settings, Send, Menu } from 'lucide-react';
import { useDashboard } from '../hooks/useDashboard';
import { useEmails } from '../hooks/useEmails';
import { useThemeContext } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';

export default function Dashboard() {
  const { stats, loading: dashboardLoading } = useDashboard();
  const { emails, chat, loading: emailsLoading } = useEmails();
  const { theme, toggleTheme } = useThemeContext();
  const { toggleSidebar } = useSidebar();

  if (dashboardLoading || emailsLoading) {
    return <div className="p-8 flex items-center justify-center h-full text-muted font-medium bg-page transition-colors duration-200">Loading Dashboard...</div>;
  }

  return (
    <div className="flex-1 min-w-0 bg-page h-screen overflow-y-auto transition-colors duration-200">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-border bg-page sticky top-0 z-10 transition-colors duration-200">
        <div className="flex items-center gap-3 sm:gap-6">
          <button onClick={toggleSidebar} className="md:hidden p-2 -ml-2 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-primary hidden sm:block">Dashboard</h1>
          <button className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#4f8ef7] hover:bg-[#3b7ae5] text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#4f8ef7]/20">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Compose</span>
          </button>
        </div>
        <div className="flex items-center gap-1 sm:gap-3">
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search operations..."
              className="pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-primary focus:outline-none focus:border-[#4f8ef7] w-72 transition-all placeholder:text-muted"
            />
          </div>
          <button className="p-2.5 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors"><Bell className="w-5 h-5" /></button>
          <button onClick={toggleTheme} className="p-2.5 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button className="p-2.5 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors"><MoreVertical className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-[1600px] mx-auto space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-5 bg-card border border-border rounded-xl flex flex-col justify-between h-32 hover:border-[#4f8ef7]/50 transition-colors shadow-sm cursor-pointer group">
            <div className="flex justify-between items-start text-muted">
              <span className="text-xs font-bold tracking-wider uppercase group-hover:text-[#4f8ef7] transition-colors">Unread Emails</span>
              <Mail className="w-4 h-4 text-[#4f8ef7]" />
            </div>
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="text-3xl font-bold text-primary">{stats?.unread_emails}</span>
              <span className="text-sm font-medium text-[#4f8ef7]">+2 today</span>
            </div>
          </div>
          
          <div className="p-5 bg-card border border-border rounded-xl flex flex-col justify-between h-32 hover:border-[#4f8ef7]/50 transition-colors shadow-sm cursor-pointer group">
            <div className="flex justify-between items-start text-muted">
              <span className="text-xs font-bold tracking-wider uppercase group-hover:text-[#4f8ef7] transition-colors">New Messages</span>
              <MessageSquare className="w-4 h-4 text-[#4f8ef7]" />
            </div>
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="text-3xl font-bold text-primary">{stats?.new_messages}</span>
              <span className="text-sm font-medium text-[#ef4444]">Urgent</span>
            </div>
          </div>

          <div className="p-5 bg-card border border-border rounded-xl flex flex-col justify-between h-32 hover:border-[#4f8ef7]/50 transition-colors shadow-sm cursor-pointer group">
            <div className="flex justify-between items-start text-muted">
              <span className="text-xs font-bold tracking-wider uppercase group-hover:text-[#4f8ef7] transition-colors">My Files</span>
              <Vault className="w-4 h-4 text-[#4f8ef7]" />
            </div>
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="text-3xl font-bold text-primary">{stats?.my_files_count}</span>
              <span className="text-sm font-medium text-muted">{stats?.my_files_size}</span>
            </div>
          </div>

          <div className="p-5 bg-card border border-border rounded-xl flex flex-col justify-between h-32 hover:border-[#4f8ef7]/50 transition-colors shadow-sm cursor-pointer group">
            <div className="flex justify-between items-start text-muted">
              <span className="text-xs font-bold tracking-wider uppercase group-hover:text-[#4f8ef7] transition-colors">VPN Status</span>
              <Shield className="w-4 h-4 text-[#22c55e]" />
            </div>
            <div className="flex items-center justify-between mt-auto">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e] shadow-[0_0_10px_#22c55e]"></div>
                <span className="text-sm font-bold text-primary">{stats?.vpn_status}</span>
              </div>
              <span className="text-xs font-mono text-muted bg-page px-2 py-1 rounded transition-colors duration-200">{stats?.vpn_ip}</span>
            </div>
          </div>
        </div>

        {/* Panels */}
        <div className="flex flex-col lg:flex-row gap-6 mt-6">
          <div className="w-full lg:w-3/5 bg-card border border-border rounded-xl flex flex-col h-[600px] overflow-hidden shadow-sm transition-colors duration-200">
            <div className="px-6 py-5 flex justify-between items-center border-b border-border">
              <h2 className="text-lg font-bold text-primary">Recent Emails</h2>
              <button className="text-[11px] font-bold text-[#4f8ef7] tracking-widest uppercase hover:text-[#3b7ae5] transition-colors">VIEW ALL</button>
            </div>
            <div className="flex-1 overflow-y-auto bg-card">
              {emails.map((email: any) => (
                <div key={email.id} className="group px-6 py-5 border-b border-border last:border-0 hover:bg-page transition-colors cursor-pointer relative">
                  {!email.is_read && <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#4f8ef7]"></div>}
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="font-semibold text-primary group-hover:text-[#4f8ef7] transition-colors text-sm">{email.sender}</span>
                    <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">{email.timestamp}</span>
                  </div>
                  <div className="text-sm font-semibold text-primary mb-1.5">{email.subject}</div>
                  <div className="text-sm text-muted line-clamp-1 leading-relaxed">{email.preview}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full lg:w-2/5 bg-card border border-border rounded-xl flex flex-col h-[600px] overflow-hidden shadow-sm transition-colors duration-200">
            <div className="px-6 py-5 flex justify-between items-center border-b border-border">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-primary">Team Chat</h2>
                <div className="w-2 h-2 rounded-full bg-[#22c55e] shadow-[0_0_8px_#22c55e]"></div>
              </div>
              <div className="flex gap-1">
                <button className="p-2 text-muted hover:text-primary hover:bg-border rounded-md transition-colors"><Search className="w-4 h-4" /></button>
                <button className="p-2 text-muted hover:text-primary hover:bg-border rounded-md transition-colors"><Settings className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-card">
              {chat.map((msg: any) => (
                <div key={msg.id} className={`flex gap-3 ${msg.is_me ? 'flex-row-reverse' : ''}`}>
                  {!msg.is_me && (
                    <div className="w-8 h-8 rounded-full bg-[#4f8ef7]/10 flex items-center justify-center text-xs font-bold text-[#4f8ef7] border border-[#4f8ef7]/20 flex-shrink-0">
                      {msg.avatar}
                    </div>
                  )}
                  <div className={`flex flex-col max-w-[85%] ${msg.is_me ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1.5 px-1">
                      <span className="text-xs font-semibold text-muted">{msg.sender}</span>
                      <span className="text-[10px] uppercase font-bold text-muted">{msg.time}</span>
                    </div>
                    <div className={`px-4 py-2.5 text-sm leading-relaxed shadow-sm ${msg.is_me ? 'bg-[#4f8ef7] text-white rounded-2xl rounded-tr-sm' : 'bg-page border border-border text-primary rounded-2xl rounded-tl-sm transition-colors duration-200'}`}>
                      {msg.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-card border-t border-border flex gap-3 items-center transition-colors duration-200">
              <input 
                type="text" 
                placeholder="Type a message..." 
                className="flex-1 bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-[#4f8ef7] transition-colors placeholder:text-muted" 
              />
              <button className="p-2.5 bg-[#4f8ef7] hover:bg-[#3b7ae5] text-white rounded-lg transition-colors shadow-lg shadow-[#4f8ef7]/20">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
