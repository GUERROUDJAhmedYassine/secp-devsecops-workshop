import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeContext } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import {
  ShieldPlus,
  User,
  Eye,
  XCircle,
  Sun,
  Moon,
  LockKeyhole,
  Terminal
} from 'lucide-react';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeContext();
  const { login, logout, error, clearError, isLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!username || !password) {
      setLocalError('Username and password are required');
      return;
    }

    try {
      const user = await login({ username, password });
      
      // Teacher's Requirement: Admin portal only allows IT_ADMIN
      if (user.role !== 'IT_ADMIN') {
        await logout(); // Kick them out immediately
        setLocalError('Access denied. Unauthorized portal.');
        return;
      }

      navigate('/admin/monitor');
    } catch (err) {
      // Error handled by context
    }
  };

  return (
    <div className="min-h-screen bg-page text-primary flex flex-col font-mono relative transition-colors duration-200">

      {/* Theme Toggle */}
      <div className="absolute top-6 right-6">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-md border border-border bg-card text-muted hover:text-primary transition-colors flex items-center justify-center shadow-sm"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">

        {/* Main Login Card - Slightly different border to indicate Admin */}
        <div className="w-full max-w-[420px] bg-card border-2 border-red-500/30 rounded-lg shadow-xl p-6 sm:p-8 flex flex-col relative z-10 transition-colors duration-200">
          
          {/* Security Overlay Label */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-bold px-4 py-1 rounded-full tracking-[0.2em] uppercase">
            Admin Gateway
          </div>

          {/* Header */}
          <div className="flex flex-col items-center mb-8 mt-2">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="text-red-500" size={24} />
              <h1 className="text-xl font-bold tracking-wide">SECURE SHELL</h1>
            </div>
            <p className="text-[9px] uppercase tracking-wider text-muted font-semibold text-center">
              IT Administration & SIEM Management Portal
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">

            {/* Username Input Group */}
            <div className="flex flex-col gap-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={16} className="text-muted" />
                </div>
                <input
                  type="text"
                  placeholder="Admin Username"
                  className="w-full pl-10 pr-4 py-2 bg-[#0f1117] dark:bg-[#1a2035] border border-border rounded-md text-sm placeholder:text-muted focus:outline-none focus:border-red-500 transition-colors"
                  style={{ backgroundColor: 'var(--bg-page)' }}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Input Group */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LockKeyhole size={16} className="text-muted" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Admin Password"
                className="w-full pl-10 pr-10 py-2 border border-border rounded-md text-sm placeholder:text-muted focus:outline-none focus:border-red-500 transition-colors"
                style={{ backgroundColor: 'var(--bg-page)' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-primary transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                <Eye size={16} />
              </button>
            </div>

            {/* Error Banners */}
            <div className="flex flex-col gap-2 mt-2">
              {(error || localError) && (
                <div className="bg-red-900/20 border-l-4 border-red-500 p-3 flex items-center gap-3 rounded-sm">
                  <XCircle size={16} className="text-red-500 shrink-0" />
                  <p className="text-xs text-red-500 font-medium">
                    {localError || error}
                  </p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`mt-2 w-full font-bold py-2.5 rounded-md text-sm transition-colors tracking-widest ${isLoading
                ? 'bg-red-600/50 text-white/70 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20'
                }`}
            >
              {isLoading ? 'AUTHENTICATING...' : 'AUTHORIZE ACCESS'}
            </button>
          </form>

        </div>

        {/* Page Footer */}
        <div className="mt-12 flex flex-col items-center justify-center text-center px-4 w-full">
          <div className="flex items-center gap-2 mb-3">
            <ShieldPlus size={14} className="text-red-500" />
            <h2 className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
              Restricted Access Area
            </h2>
          </div>
          <p className="text-[10px] text-muted max-w-lg leading-relaxed mb-6">
            Unauthorized access to this portal is a federal offense. 
            IP address and geolocation data are being recorded.
          </p>
        </div>
      </div>
    </div>
  );
}
