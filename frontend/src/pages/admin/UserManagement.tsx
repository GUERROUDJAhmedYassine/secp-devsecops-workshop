import { useState, useEffect, useCallback } from 'react';
import { Search, MoreVertical, Moon, Sun, Plus, TrendingUp, AlertTriangle, X, Info, Loader2, Menu, RefreshCw, Unlock, Trash2, Download } from 'lucide-react';
import { useThemeContext } from '../../context/ThemeContext';
import { Link } from 'react-router-dom';
import { registerUser, listUsers, deleteUser, unlockUser } from '../../api/admin';
import { apiGetBlob } from '../../lib/apiClient';
import { FILES_BASE, WG_SERVER_PUBLIC_KEY, WG_SERVER_ENDPOINT } from '../../lib/constants';
import type { User, UserRole } from '../../types/user.types';
import { useSidebar } from '../../context/SidebarContext';
import NotificationDropdown from '../../components/NotificationDropdown';
/** Derive initials from username (e.g. "ahmed.benali" → "AB") */
function getInitials(username: string): string {
  const parts = username.split(/[.\-_\s]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return username.substring(0, 2).toUpperCase();
}

export default function UserManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Users state from backend
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Registration Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<UserRole>('EMPLOYEE');
  const [department, setDepartment] = useState('Engineering');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { toggleSidebar } = useSidebar();
  const { theme, toggleTheme } = useThemeContext();

  /* ---- Fetch users from backend ---- */
  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    setLoadError(null);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load users.');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  /* ---- Register handler ---- */
  const handleRegister = async () => {
    if (!firstName || !lastName) {
      setSubmitError('First name and Last name are required.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`.replace(/\s+/g, '');

      await registerUser({
        username,
        password: 'Welcome123!',
        email: `${username}@secp.com`,
        role,
        department
      });

      setFirstName('');
      setLastName('');
      setRole('EMPLOYEE');
      setDepartment('Engineering');
      setIsModalOpen(false);

      // Refresh the user list after successful registration
      fetchUsers();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to register identity.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---- Action handlers ---- */
  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await deleteUser(userId);
      fetchUsers();
    } catch (error: any) {
      alert("Failed to delete user: " + error.message);
    }
  };

  const handleUnlockUser = async (userId: string) => {
    try {
      await unlockUser(userId);
      fetchUsers();
    } catch (error: any) {
      alert("Failed to unlock user: " + error.message);
    }
  };

  const handleDownloadVPN = async (user: User) => {
    // If we have a stored file, download it from the files-service
    if (user.vpn_config_file_id) {
      try {
        const response = await apiGetBlob(`${FILES_BASE}/files/${user.vpn_config_file_id}`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `vpn_${user.username}.conf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        return;
      } catch (error: any) {
        console.warn('Storage download failed, falling back to client-side generation:', error.message);
      }
    }

    // Fallback: generate the .conf client-side from user data already in the response
    if (user.vpn_internal_ip) {
      const confContent = [
        '[Interface]',
        `# Client config for ${user.username}`,
        `Address = ${user.vpn_internal_ip}/24`,
        'DNS = 1.1.1.1',
        '',
        '[Peer]',
        '# Server — ask your IT Admin for the server public key',
        'PublicKey = ' + WG_SERVER_PUBLIC_KEY,
        'Endpoint = ' + WG_SERVER_ENDPOINT,
        'AllowedIPs = 0.0.0.0/0',
        'PersistentKeepalive = 25',
      ].join('\n');

      const blob = new Blob([confContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `vpn_${user.username}.conf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } else {
      alert(`No VPN configuration found for ${user.username}.`);
    }
  };


  /* ---- Derived stats ---- */
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.is_active).length;
  const flaggedUsers = users.filter(u => u.failed_logins > 0 || u.locked_until).length;

  /* ---- Client-side search ---- */
  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.department ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-page text-primary transition-colors duration-200">

      {/* Top Header */}

      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card transition-colors duration-200 shrink-0">
        <button onClick={toggleSidebar} className="md:hidden p-2 -ml-2 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors">
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-sm font-semibold tracking-wide">User Management</h1>

        <div className="flex items-center gap-4">
          <div className="relative w-64">

            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={14} className="text-muted" />
            </div>
            <input
              type="text"
              placeholder="Search users, roles, department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-page border border-border rounded-md text-xs placeholder:text-muted focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <button onClick={fetchUsers} className="text-muted hover:text-primary transition-colors p-1" title="Refresh users">
            <RefreshCw size={16} className={isLoadingUsers ? 'animate-spin' : ''} />
          </button>
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
            <span className="text-2xl font-bold mb-1">{isLoadingUsers ? '—' : totalUsers.toLocaleString()}</span>
            <span className="text-xs text-blue-500 font-medium flex items-center gap-1">
              <TrendingUp size={12} /> From database
            </span>
          </div>

          <div className="bg-card border border-border px-5 py-4 rounded-lg flex flex-col shadow-sm">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted mb-2">Active Users</span>
            <span className="text-2xl font-bold mb-1">{isLoadingUsers ? '—' : activeUsers.toLocaleString()}</span>
            <span className="text-xs text-muted">Currently active</span>
          </div>

          <div className="bg-card border border-border px-5 py-4 rounded-lg flex flex-col shadow-sm">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted mb-2">Security Flags</span>
            <span className="text-2xl font-bold mb-1 text-red-500">{isLoadingUsers ? '—' : String(flaggedUsers).padStart(2, '0')}</span>
            <span className="text-xs text-red-500 font-medium flex items-center gap-1">
              {flaggedUsers > 0 ? <><AlertTriangle size={12} /> Action required</> : 'All clear'}
            </span>
          </div>

          <div className="bg-card border border-border px-5 py-4 rounded-lg flex flex-col shadow-sm">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted mb-2">Active Rate</span>
            <span className="text-2xl font-bold mb-4">{isLoadingUsers || totalUsers === 0 ? '—' : `${Math.round((activeUsers / totalUsers) * 100)}%`}</span>
            <div className="w-full h-1.5 bg-page rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: totalUsers > 0 ? `${Math.round((activeUsers / totalUsers) * 100)}%` : '0%' }}></div>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {loadError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-500 text-sm flex items-center justify-between">
            <span>{loadError}</span>
            <button onClick={fetchUsers} className="text-xs font-bold underline">Retry</button>
          </div>
        )}

        {/* Table Area */}
        <div className="bg-card border border-border rounded-lg shadow-sm flex flex-col flex-1 min-h-[400px]">
          <div className="flex-1 overflow-x-auto">
            {isLoadingUsers ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-[#4f8ef7]" />
              </div>
            ) : (
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
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-muted">
                        {searchTerm ? 'No users match your search.' : 'No users found.'}
                      </td>
                    </tr>
                  )}
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-border/30 hover:bg-page/50 transition-colors group">
                      <td className="px-6 py-4">
                        <Link to={`/admin/users/${user.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
                          <div className="w-8 h-8 rounded-full bg-orange-200 text-orange-800 flex items-center justify-center font-bold text-xs shrink-0">
                            {getInitials(user.username)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-primary">{user.username}</span>
                            <span className="text-[10px] text-muted">{user.email}</span>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 font-mono text-muted">{user.username}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest uppercase border ${user.role === 'IT_ADMIN' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
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
                      <td className="px-6 py-4 font-mono text-muted">
                        {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {(user.vpn_config_file_id || user.vpn_internal_ip) && (
                            <button
                              onClick={() => handleDownloadVPN(user)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                              title="Download WireGuard VPN Configuration"
                            >
                              <Download size={12} />
                              VPN Config
                            </button>
                          )}
                          <button
                            onClick={() => handleUnlockUser(user.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500 hover:text-white transition-all"
                            title="Unlock Account"
                          >
                            <Unlock size={12} />
                            Unlock
                          </button>
                          {/* EDIT AND FORENSICS BUTTONS REMOVED */}
                          {!user.username.startsWith('deleted_') && (
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                              title="Delete User"
                            >
                              <Trash2 size={12} />
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!isLoadingUsers && (
              <div className="px-6 py-4 text-[10px] text-muted uppercase tracking-wider flex items-center justify-between font-medium">
                <span>Showing {filteredUsers.length} of {totalUsers} users</span>
              </div>
            )}
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

              {submitError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-500 text-sm">
                  {submitError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">First Name</label>
                  <input
                    type="text"
                    placeholder="Enter first name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2 bg-page border border-border rounded-md text-sm placeholder:text-muted focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Last Name</label>
                  <input
                    type="text"
                    placeholder="Enter last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-2 bg-page border border-border rounded-md text-sm placeholder:text-muted focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Corporate Email</label>
                <input
                  type="text"
                  value={firstName && lastName ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@secp.com`.replace(/\s+/g, '') : ""}
                  readOnly
                  placeholder="name@secp.com (Auto-generated)"
                  className="w-full px-3 py-2 bg-page border border-border rounded-md text-sm text-muted bg-opacity-50 cursor-not-allowed focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Access Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-page border border-border rounded-md text-sm focus:outline-none focus:border-blue-500 appearance-none"
                  >
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="IT_ADMIN">IT_ADMIN</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-page border border-border rounded-md text-sm focus:outline-none focus:border-blue-500 appearance-none"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Infrastructure">Infrastructure</option>
                    <option value="Security Ops">Security Ops</option>
                    <option value="Finance">Finance</option>
                  </select>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs leading-relaxed text-blue-600 dark:text-blue-400">
                <Info size={16} className="shrink-0 mt-0.5" />
                <p>
                  The password and the VPN certification will be handed over hand-to-hand or later in a secure chat.
                </p>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 bg-page/30">
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium hover:bg-page rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRegister}
                disabled={isSubmitting || !firstName || !lastName}
                className={`flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors ${isSubmitting || !firstName || !lastName ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? (
                  <><Loader2 size={16} className="animate-spin" /> Provisioning...</>
                ) : (
                  'Create Identity'
                )}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
