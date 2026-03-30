import { useState } from 'react';
import { 
  Search, Bell, Moon, Sun, MoreVertical, Plus, 
  Inbox, Send, FileEdit, AlertOctagon, Trash2, 
  Filter, Reply, Forward, Printer, ExternalLink, ShieldAlert, Paperclip, Download, X, Minus, Menu, ArrowLeft
} from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';
import { webmailFolders, webmailLabels, webmailEmails, type WebmailEmail } from '../mocks/webmail.mock';

// Compose Modal Component
function ComposeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card w-full max-w-2xl rounded-xl shadow-2xl border border-border flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar transition-colors">
          <h3 className="text-sm font-semibold text-primary">New Message</h3>
          <div className="flex items-center gap-2">
            <button className="p-1 text-muted hover:text-primary transition-colors rounded">
              <Minus className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1 text-muted hover:text-primary transition-colors rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Form Fields */}
        <div className="flex flex-col flex-1 bg-page">
          <div className="flex items-center px-4 py-3 border-b border-border">
            <span className="text-xs font-bold text-muted w-16 uppercase tracking-wider">TO:</span>
            <input type="text" className="flex-1 bg-transparent border-none outline-none text-sm text-primary placeholder:text-muted" placeholder="security-team@secp-platform.com" />
          </div>
          <div className="flex items-center px-4 py-3 border-b border-border">
            <span className="text-xs font-bold text-muted w-16 uppercase tracking-wider">SUBJECT:</span>
            <input type="text" className="flex-1 bg-transparent border-none outline-none text-sm text-primary placeholder:text-muted" placeholder="Urgent: System Update Status" />
          </div>
          <textarea 
            className="flex-1 w-full min-h-[240px] p-4 bg-transparent border-none outline-none text-sm text-primary resize-none placeholder:text-muted"
            placeholder="Type your secure communication here..."
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-sidebar transition-colors">
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 text-xs font-medium text-muted hover:text-primary transition-colors">
              <Paperclip className="w-4 h-4" /> Attach Files
            </button>
            <button className="flex items-center gap-2 text-xs font-medium text-muted hover:text-primary transition-colors">
              <ShieldAlert className="w-4 h-4" /> Encrypt Message
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted hover:text-primary transition-colors">
              Discard
            </button>
            <button className="flex items-center gap-2 px-5 py-2 bg-[#4f8ef7] hover:bg-[#3b7ae5] text-white rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-[#4f8ef7]/20">
              Send <Send className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Webmail() {
  const { theme, toggleTheme } = useThemeContext();
  const [selectedFolder, setSelectedFolder] = useState('Inbox');
  
  const getFolderCount = (name: string) => webmailEmails.filter(e => (e.folder || 'Inbox') === name).length;
  const filteredEmails = webmailEmails.filter(e => (e.folder || 'Inbox') === selectedFolder);
  
  const [selectedEmail, setSelectedEmail] = useState<WebmailEmail | null>(filteredEmails.length > 0 ? filteredEmails[0] : null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [showMobileFolders, setShowMobileFolders] = useState(false);
  const { toggleSidebar } = useSidebar();

  const getFolderIcon = (name: string) => {
    switch (name) {
      case 'Inbox': return Inbox;
      case 'Sent': return Send;
      case 'Drafts': return FileEdit;
      case 'Spam': return AlertOctagon;
      case 'Trash': return Trash2;
      default: return Inbox;
    }
  };

  return (
    <div className="flex-1 min-w-0 bg-page h-screen flex flex-col transition-colors duration-200">
      {/* Top Header */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-border bg-page sticky top-0 z-10 transition-colors">
        <div className="flex items-center gap-3 sm:gap-6">
          <button onClick={toggleSidebar} className="md:hidden p-2 -ml-2 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-primary hidden sm:block">Webmail</h1>
          <button 
            onClick={() => setIsComposeOpen(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#4f8ef7] hover:bg-[#3b7ae5] text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#4f8ef7]/20"
          >
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Compose</span>
          </button>
        </div>
        <div className="flex items-center gap-1 sm:gap-3">
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search communications..."
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

      {/* Main Content Areas */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left FOLDERS panel */}
        <div className={`${showMobileFolders ? 'flex w-full absolute inset-0 z-20' : 'hidden lg:flex'} lg:relative lg:w-60 border-r border-border bg-page flex-col py-4 overflow-y-auto transition-colors`}>
          <div className="flex items-center justify-between px-6 mb-2">
            <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest">Folders</h4>
            <button 
              onClick={() => setShowMobileFolders(false)}
              className="lg:hidden p-1 -mr-2 text-muted hover:text-primary rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-3">
            {webmailFolders.map((folder) => {
              const Icon = getFolderIcon(folder.name);
              const isActive = folder.name === selectedFolder;
              const count = getFolderCount(folder.name);
              return (
                <button
                  key={folder.name}
                  onClick={() => {
                    setSelectedFolder(folder.name);
                    setShowMobileFolders(false);
                    setSelectedEmail(null);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive 
                      ? 'bg-[#4f8ef7]/10 text-[#4f8ef7] font-semibold' 
                      : 'text-muted font-medium hover:bg-card hover:text-primary'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    {folder.name}
                  </div>
                  {count > 0 && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-[#4f8ef7] text-white' : 'bg-border text-muted'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}

            <div className="px-3 pt-6 pb-2">
              <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest">Labels</h4>
            </div>
            {webmailLabels.map((label) => (
              <button key={label.name} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted font-medium hover:bg-card hover:text-primary transition-colors">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: label.color }}></div>
                {label.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Middle MESSAGE LIST panel */}
        <div className={`${selectedEmail || showMobileFolders ? 'hidden md:flex' : 'flex'} w-full md:w-96 border-r border-border bg-page flex-col transition-colors`}>
          <div className="px-5 py-4 flex justify-between items-center border-b border-border">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowMobileFolders(true)}
                className="lg:hidden p-1 -ml-2 text-muted hover:text-primary hover:bg-card rounded-md transition-colors"
              >
                <Menu className="w-5 h-5" /> 
              </button>
              <h2 className="text-sm font-bold text-primary">{selectedFolder}</h2>
            </div>
            <button className="text-muted hover:text-primary transition-colors"><Filter className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredEmails.length === 0 ? (
              <div className="p-8 text-center text-sm font-medium text-muted">No messages found in {selectedFolder}.</div>
            ) : filteredEmails.map((email) => {
              const isSelected = selectedEmail?.id === email.id;
              return (
                <div 
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className={`p-5 border-b border-border cursor-pointer transition-all ${
                    isSelected ? 'bg-card border-l-4 border-l-[#4f8ef7]' : 'hover:bg-card border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="flex justify-between items-baseline mb-1">
                    <span className={`text-sm ${isSelected || !email.isRead ? 'font-bold text-primary' : 'font-semibold text-muted'}`}>
                      {email.sender}
                    </span>
                    <span className="text-[10px] font-bold tracking-wide uppercase text-muted whitespace-nowrap ml-2">
                      {email.time}
                    </span>
                  </div>
                  <div className={`text-sm mb-1.5 ${isSelected || !email.isRead ? 'font-bold text-primary' : 'font-semibold text-muted'}`}>
                    {email.subject}
                  </div>
                  <div className="text-xs text-muted leading-relaxed line-clamp-2">
                    {email.preview}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right MESSAGE DETAIL panel */}
        <div className={`${selectedEmail ? 'flex' : 'hidden md:flex'} flex-1 bg-card flex-col transition-colors h-full overflow-hidden`}>
          {/* Action Toolbar */}
          <div className="px-3 sm:px-6 py-3 flex items-center justify-between border-b border-border bg-page transition-colors">
            <div className="flex items-center gap-1">
              <button onClick={() => setSelectedEmail(null)} className="md:hidden flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-muted hover:text-primary hover:bg-card rounded-md transition-colors mr-1 border-r border-border pr-3">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => setIsComposeOpen(true)} className="flex items-center gap-2 px-2 sm:px-3 py-1.5 text-xs font-semibold text-muted hover:text-primary hover:bg-card rounded-md transition-colors">
                <Reply className="w-4 h-4" /> Reply
              </button>
              <button onClick={() => setIsComposeOpen(true)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-primary hover:bg-card rounded-md transition-colors">
                <Forward className="w-4 h-4" /> Forward
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button className="hidden sm:block p-2 text-muted hover:text-primary hover:bg-card rounded-md transition-colors"><Printer className="w-4 h-4" /></button>
              <button className="hidden sm:block p-2 text-muted hover:text-primary hover:bg-card rounded-md transition-colors"><ExternalLink className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-12">
            {selectedEmail ? (
              <div className="max-w-4xl mx-auto space-y-8">
                {/* Message Header */}
                <div>
                  <h1 className="text-xl lg:text-3xl font-bold text-primary mb-8 leading-tight">{selectedEmail.subject}</h1>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center flex-shrink-0">
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-bold text-primary text-base">{selectedEmail.sender}</span>
                          {selectedEmail.label && (
                            <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase">
                              {selectedEmail.label}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-medium text-muted tracking-wide">
                          From: <span className="text-primary opacity-80">{selectedEmail.from}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <span className="text-xs font-bold text-muted uppercase tracking-wider">Today, {selectedEmail.time} PM</span>
                      <span className="text-xs font-medium text-muted tracking-wide">
                        To: <span className="text-primary opacity-80">{selectedEmail.to}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Message Body */}
                <div className="text-sm text-primary leading-relaxed whitespace-pre-wrap">
                  {selectedEmail.body}
                </div>

                {/* Technical Details Box (if any) */}
                {selectedEmail.technical && (
                  <div className="bg-page border border-border p-6 rounded-xl mt-6 transition-colors">
                    <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-4">Technical Details</h4>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                      {selectedEmail.technical.map((tech, i) => (
                        <div key={i} className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted">{tech.label}:</span>
                          <span className="text-sm font-mono font-bold text-primary">{tech.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attachments Section (if any) */}
                {selectedEmail.attachments && (
                  <div className="pt-8 border-t border-border mt-8">
                    <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-4">
                      Attachments ({selectedEmail.attachments.length})
                    </h4>
                    <div className="flex flex-wrap gap-4">
                      {selectedEmail.attachments.map((file, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 bg-page border border-border rounded-xl transition-colors hover:border-[#4f8ef7]/50 cursor-pointer group">
                          <div className="w-10 h-10 bg-card rounded-lg flex items-center justify-center text-muted group-hover:text-[#4f8ef7] transition-colors shadow-sm">
                            <FileEdit className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-primary mb-0.5">{file.name}</span>
                            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{file.size}</span>
                          </div>
                          <button className="ml-4 p-2 text-muted hover:text-[#4f8ef7] transition-colors">
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-muted font-medium text-sm">
                No message selected
              </div>
            )}
          </div>
        </div>
      </div>

      {isComposeOpen && <ComposeModal onClose={() => setIsComposeOpen(false)} />}
    </div>
  );
}
