import { useState } from 'react';
import {
  Search, Bell, Moon, Sun, MoreVertical, Plus,
  Lock, Shield, Info, AlertTriangle, Smile, Send,
  Bold, Italic, Link as LinkIcon, List, Code, Menu, ArrowLeft
} from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';
import {
  securityRooms,
  directMessages,
  incidentResponseChat
} from '../mocks/messaging.mock';

export default function Messaging() {
  const { theme, toggleTheme } = useThemeContext();
  const { toggleSidebar } = useSidebar();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>('1');

  return (
    <div className="flex-1 min-w-0 bg-page h-screen flex flex-col transition-colors duration-200">
      {/* Top Header */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-border bg-page sticky top-0 z-10 transition-colors">
        <div className="flex items-center gap-3 sm:gap-6">
          <button onClick={toggleSidebar} className="md:hidden p-2 -ml-2 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center">
            <h1 className="text-base font-bold text-primary hidden sm:block">Security Operations</h1>
            <div className="hidden sm:block h-4 w-px bg-border mx-4"></div>
          <span className="text-xs sm:text-sm font-medium text-muted">
            Communications <span className="mx-1">&gt;</span> <span className="text-[#4f8ef7]">Internal Comms</span>
          </span>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-3">
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search threads..."
              className="pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-primary focus:outline-none focus:border-[#4f8ef7] w-64 transition-all placeholder:text-muted"
            />
          </div>
          <button className="p-2.5 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors"><Bell className="w-4 h-4" /></button>
          <button onClick={toggleTheme} className="p-2.5 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button className="p-2.5 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors"><MoreVertical className="w-4 h-4" /></button>
        </div>
      </header>

      {/* Main Content Areas */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left Sidebar - Rooms & DMs */}
        <div className={`${selectedRoomId ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-border bg-page flex-col py-2 overflow-y-auto transition-colors`}>
          <div className="px-6 py-4 flex justify-between items-center">
            <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest">Security Rooms</h4>
          </div>
          <nav className="flex flex-col space-y-0.5">
            {securityRooms.map((room) => {
              const isActive = room.isActive || room.id === selectedRoomId;
              return (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoomId(room.id)}
                  className={`w-full flex items-start gap-4 px-6 py-3 transition-colors ${isActive
                    ? 'bg-red-500/5 border-l-2 border-l-red-500'
                    : 'border-l-2 border-l-transparent hover:bg-card hover:border-l-border text-muted hover:text-primary'
                    }`}
                >
                  <div className={`p-2 rounded-lg flex-shrink-0 ${isActive ? 'bg-red-500/10 text-red-500' : 'bg-card text-[#4f8ef7]'}`}>
                    {room.iconType === 'lock' ? <Lock className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                  </div>
                  <div className="flex flex-col text-left flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-sm font-bold truncate pr-2 ${isActive ? 'text-primary' : ''}`}>{room.name}</span>
                      <span className="text-[10px] font-medium text-muted flex-shrink-0">{room.time}</span>
                    </div>
                    <span className="text-xs text-muted truncate">{room.preview}</span>
                  </div>
                </button>
              );
            })}
          </nav>

          <div className="px-6 mt-6 mb-2 flex justify-between items-center">
            <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest">Direct Messages</h4>
            <button className="text-[#4f8ef7] hover:text-[#3b7ae5] transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <nav className="flex flex-col space-y-0.5">
            {directMessages.map((dm) => (
              <button
                key={dm.id}
                onClick={() => setSelectedRoomId(dm.id)}
                className="w-full flex items-start gap-4 px-6 py-3 border-l-2 border-l-transparent hover:bg-card hover:border-l-border transition-colors text-muted hover:text-primary"
              >
                <div className="relative flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full ${dm.user.avatarColor} text-white flex items-center justify-center text-xs font-bold`}>
                    {dm.user.initials}
                  </div>
                  {dm.user.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-page rounded-full"></div>
                  )}
                </div>
                <div className="flex flex-col text-left flex-1 min-w-0 mt-0.5">
                  <span className="text-sm font-bold truncate text-primary leading-none mb-1">{dm.user.name}</span>
                  <span className="text-xs text-muted truncate">{dm.preview}</span>
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Chat Area */}
        <div className={`${selectedRoomId ? 'flex' : 'hidden md:flex'} flex-1 bg-page flex-col transition-colors h-full overflow-hidden relative`}>

          {/* Chat Header */}
          <div className="px-3 sm:px-6 flex items-center justify-between border-b border-border bg-page transition-colors flex-shrink-0 h-20">
            <div className="flex items-center gap-2 sm:gap-4">
              <button 
                onClick={() => setSelectedRoomId(null)} 
                className="md:hidden flex items-center justify-center p-2 -ml-2 text-muted hover:text-primary hover:bg-card rounded-md transition-colors mr-1 cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center shadow-inner">
                <Lock className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-base font-bold text-primary leading-tight mb-0.5">Incident Response #IR-904</h2>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest leading-none mt-0.5">Active Breach Drill</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center -space-x-2">
                {securityRooms[0].participants?.map((p) => (
                  <div key={p.id} className={`w-7 h-7 rounded-full ${p.avatarColor} text-white flex items-center justify-center text-[10px] font-bold border-2 border-page z-10 hover:z-20 transition-transform hover:scale-110 cursor-pointer shadow-sm`}>
                    {p.initials}
                  </div>
                ))}
                <div className="w-7 h-7 rounded-full bg-card text-muted flex items-center justify-center text-[10px] font-bold border-2 border-page z-0 shadow-sm cursor-pointer hover:bg-border transition-colors">
                  +4
                </div>
              </div>

              <div className="h-6 w-px bg-border"></div>

              <div className="flex items-center gap-1">
                <button className="p-2 text-muted hover:text-primary transition-colors"><Info className="w-5 h-5" /></button>
                <button className="p-2 text-muted hover:text-primary transition-colors"><Search className="w-5 h-5" /></button>
              </div>
            </div>
          </div>

          {/* Chat Transcript Area */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">

            <div className="flex items-center justify-center my-4">
              <div className="h-px bg-border flex-1"></div>
              <span className="px-4 text-[10px] font-bold text-muted uppercase tracking-widest bg-page">Today, October 24</span>
              <div className="h-px bg-border flex-1"></div>
            </div>

            {incidentResponseChat.map((msg) => {
              if (msg.isSystemAlert) {
                return (
                  <div key={msg.id} className="flex justify-center my-2">
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{msg.content}</span>
                    </div>
                  </div>
                );
              }

              if (msg.isSelf) {
                return (
                  <div key={msg.id} className="flex flex-col items-end gap-1 ml-auto max-w-2xl">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-muted">{msg.time}</span>
                      <span className="text-sm font-bold text-primary">{msg.sender.name}</span>
                    </div>
                    <div className="bg-[#4f8ef7] text-white p-4 rounded-2xl rounded-tr-sm shadow-md text-sm leading-relaxed">
                      {msg.content}
                    </div>
                    {msg.id === 'm3' && (
                      <div className="flex items-center gap-1 mt-1 text-[#4f8ef7]">
                        <span className="text-[10px] font-bold uppercase tracking-wider">✓ Read by all</span>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={msg.id} className="flex items-start gap-4 max-w-2xl">
                  <div className={`w-8 h-8 rounded-full ${msg.sender.avatarColor} text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1 shadow-sm`}>
                    {msg.sender.initials}
                  </div>
                  <div className="flex flex-col gap-1 items-start">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-primary">{msg.sender.name}</span>
                      <span className="text-xs font-medium text-muted">{msg.time}</span>
                    </div>
                    <div className="bg-card border border-border text-primary p-4 rounded-2xl rounded-tl-sm shadow-sm text-sm leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chat Input Area */}
          <div className="p-6 pt-2 flex-shrink-0 bg-page">
            <div className="max-w-4xl mx-auto flex flex-col bg-page border border-border rounded-xl shadow-sm focus-within:border-[#4f8ef7] transition-colors focus-within:ring-1 focus-within:ring-[#4f8ef7]/20 overflow-hidden">
              <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card/50">
                <button className="p-1.5 text-muted hover:text-primary hover:bg-card rounded"><Bold className="w-4 h-4" /></button>
                <button className="p-1.5 text-muted hover:text-primary hover:bg-card rounded italic"><Italic className="w-4 h-4" /></button>
                <div className="w-px h-4 bg-border mx-1"></div>
                <button className="p-1.5 text-muted hover:text-primary hover:bg-card rounded"><LinkIcon className="w-4 h-4" /></button>
                <div className="w-px h-4 bg-border mx-1"></div>
                <button className="p-1.5 text-muted hover:text-primary hover:bg-card rounded"><List className="w-4 h-4" /></button>
                <button className="p-1.5 text-muted hover:text-primary hover:bg-card rounded"><Code className="w-4 h-4" /></button>
              </div>
              <div className="flex items-center px-4 py-3 bg-card min-h-[60px]">
                <button className="p-1 text-muted hover:text-primary transition-colors flex-shrink-0">
                  <Plus className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  placeholder="Reply to #IR-904..."
                  className="flex-1 bg-transparent border-none outline-none text-sm text-primary px-3 placeholder:text-muted"
                />
                <button className="p-2 text-muted hover:text-primary transition-colors flex-shrink-0 mr-2">
                  <Smile className="w-5 h-5" />
                </button>
                <button className="flex items-center justify-center gap-2 bg-[#4f8ef7] hover:bg-[#3b7ae5] text-white px-5 py-2 rounded-lg text-sm font-bold shadow-md shadow-[#4f8ef7]/20 transition-all active:scale-95 flex-shrink-0">
                  Send <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="max-w-4xl mx-auto flex justify-end mt-2">
              <span className="text-[10px] font-bold text-muted uppercase tracking-widest">⌘ + Enter to send</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
