import { useState } from 'react';
import { Search, Bell, MoreVertical, Moon, Sun, Plus, TrendingUp, AlertTriangle, X, Info, Shield } from 'lucide-react';
import { mockUsers } from '../../mock/mockAuth';
import { useThemeContext } from '../../context/ThemeContext';
import { Link } from 'react-router-dom';

export default function UserManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { theme, toggleTheme } = useThemeContext();
  
  const filteredUsers = mockUsers.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-page text-primary transition-colors duration-200">
      
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card transition-colors duration-200 shrink-0">
        <h1 className="text-sm font-semibold tracking-wide">User Management</h1>
        
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={14} className="text-muted" />
            </div>
            <input
              type="text"
              placeholder="Search users, roles, IP..."
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
        
        {/* Sub Header & Button */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold tracking-tight">Active Directory</h2>
            <p className="text-sm text-muted">Manage enterprise identities and access privileges.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Create New Identity
          </button>
        </div>

        {/* Stats KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border px-5 py-4 rounded-lg flex flex-col shadow-sm">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted mb-2">Total Users</span>
            <span className="text-2xl font-bold mb-1">1,284</span>
            <span className="text-xs text-blue-500 font-medium flex items-center gap-1">
              <TrendingUp size={12} /> +12% this month
            </span>
          </div>
          
          <div className="bg-card border border-border px-5 py-4 rounded-lg flex flex-col shadow-sm">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted mb-2">Active Sessions</span>
            <span className="text-2xl font-bold mb-1">432</span>
            <span className="text-xs text-muted">Currently authenticated</span>
          </div>

          <div className="bg-card border border-border px-5 py-4 rounded-lg flex flex-col shadow-sm">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted mb-2">Security Flags</span>
            <span className="text-2xl font-bold mb-1 text-red-500">08</span>
            <span className="text-xs text-red-500 font-medium flex items-center gap-1">
              <AlertTriangle size={12} /> Action required
            </span>
          </div>

          <div className="bg-card border border-border px-5 py-4 rounded-lg flex flex-col shadow-sm">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted mb-2">License Usage</span>
            <span className="text-2xl font-bold mb-4">86%</span>
            <div className="w-full h-1.5 bg-page rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: '86%' }}></div>
            </div>
          </div>
        </div>

        {/* Table Area */}
        <div className="bg-card border border-border rounded-lg shadow-sm flex flex-col flex-1 min-h-[400px]">
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-border/50 text-[10px] tracking-wider text-muted font-bold uppercase bg-page/30">
                  <th className="px-6 py-4">User Identity</th>
                  <th className="px-6 py-4">Username</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Last Login</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs border-b border-border/30">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-border/30 hover:bg-page/50 transition-colors group">
                    <td className="px-6 py-4">
                      <Link to={`/admin/users/${user.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
                        <div className="w-8 h-8 rounded-full bg-orange-200 text-orange-800 flex items-center justify-center font-bold text-xs shrink-0">
                          {user.initials}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-primary">{user.name}</span>
                          <span className="text-[10px] text-muted">{user.email}</span>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-mono text-muted">{user.username}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest uppercase border ${
                        user.role === 'IT_ADMIN' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                        user.role === 'MANAGER' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                        'bg-blue-500/10 text-blue-500 border-blue-500/20'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 capitalize text-muted">{user.department || '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-blue-500' : 'bg-slate-500'}`}></span>
                        <span className={user.is_active ? 'font-medium' : 'text-muted'}>
                          {user.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-muted">{user.last_login}</td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        to={`/admin/users/${user.id}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all"
                      >
                        <Shield size={12} />
                        Forensics
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="px-6 py-4 text-[10px] text-muted uppercase tracking-wider flex items-center justify-between font-medium">
              <span>Showing 1-{filteredUsers.length} of 1,284 users</span>
              <div className="flex items-center gap-1">
                <button className="p-1 hover:text-primary">&lt;</button>
                <button className="w-6 h-6 rounded flex items-center justify-center bg-blue-600 text-white">1</button>
                <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-page transition-colors">2</button>
                <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-page transition-colors">3</button>
                <button className="p-1 hover:text-primary">&gt;</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-xl rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[#1e253c] text-white">
              <div className="flex items-center gap-2 font-semibold">
                <Plus size={16} />
                <h3>Provision New User Account</h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-300 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-6">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">First Name</label>
                  <input type="text" placeholder="Enter first name" className="w-full px-3 py-2 bg-page border border-border rounded-md text-sm placeholder:text-muted focus:outline-none focus:border-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Last Name</label>
                  <input type="text" placeholder="Enter last name" className="w-full px-3 py-2 bg-page border border-border rounded-md text-sm placeholder:text-muted focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Corporate Email</label>
                <input type="text" placeholder="name@secp.enterprise" className="w-full px-3 py-2 bg-page border border-border rounded-md text-sm placeholder:text-muted focus:outline-none focus:border-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Access Role</label>
                  <select className="w-full px-3 py-2 bg-page border border-border rounded-md text-sm focus:outline-none focus:border-blue-500 appearance-none">
                    <option>EMPLOYEE</option>
                    <option>MANAGER</option>
                    <option>IT_ADMIN</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Department</label>
                  <select className="w-full px-3 py-2 bg-page border border-border rounded-md text-sm focus:outline-none focus:border-blue-500 appearance-none">
                    <option>Engineering</option>
                    <option>Infrastructure</option>
                    <option>Security Ops</option>
                    <option>Finance</option>
                  </select>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs leading-relaxed text-blue-600 dark:text-blue-400">
                <Info size={16} className="shrink-0 mt-0.5" />
                <p>
                  User will receive an automated enrollment email with temporary credentials and 2FA setup instructions. The identity will be restricted until enrollment is complete.
                </p>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 bg-page/30">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium hover:bg-page rounded-md transition-colors"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors">
                Create Identity
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
