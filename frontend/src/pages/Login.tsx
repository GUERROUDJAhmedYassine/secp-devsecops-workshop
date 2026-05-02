import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeContext } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import {
  ShieldPlus,
  User,
  Eye,
  XCircle,
  Globe,
  Sun,
  Moon,
  LockKeyhole
} from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeContext();
  const { login, logout, error, clearError, isLoading, isAuthenticated } = useAuth();

  /* Redirect already-authenticated users away from the login page */
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

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
      
      // Teacher's Requirement: Normal login page rejects IT_ADMIN
      if (user.role === 'IT_ADMIN') {
        await logout(); // Kick them out immediately
        setLocalError('Please use the management portal.');
        return;
      }

      navigate('/dashboard');
    } catch (err) {
      // The error is already populated in the context (accessible via `error`)
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

        {/* Main Login Card */}
        <div className="w-full max-w-[420px] bg-card border border-border rounded-lg shadow-sm p-6 sm:p-8 flex flex-col relative z-10 transition-colors duration-200">

          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-2 mb-2">
              <ShieldPlus className="text-blue-500" size={24} />
              <h1 className="text-xl font-bold tracking-wide">SECP PLATFORM</h1>
            </div>
            <p className="text-[9px] uppercase tracking-wider text-muted font-semibold">
              Secure Enterprise Communication Platform
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
                  placeholder="Enter your username"
                  className="w-full pl-10 pr-4 py-2 bg-[#0f1117] dark:bg-[#1a2035] border border-border rounded-md text-sm placeholder:text-muted focus:outline-none focus:border-blue-500 transition-colors"
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
                placeholder="Enter your password"
                className="w-full pl-10 pr-10 py-2 border border-border rounded-md text-sm placeholder:text-muted focus:outline-none focus:border-blue-500 transition-colors"
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
                <div className="bg-red-300 border-l-4 border-red-700 p-3 flex items-center gap-3 rounded-sm">
                  <XCircle size={16} className="text-red-700 shrink-0" />
                  <p className="text-xs text-red-700 font-medium">
                    {localError || error}
                  </p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`mt-2 w-full font-medium py-2.5 rounded-md text-sm transition-colors ${isLoading
                ? 'bg-blue-600/50 text-white/70 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
            >
              {isLoading ? 'SIGNING IN...' : 'SIGN IN'}
            </button>
          </form>

          {/* Footer inside card */}
          <div className="mt-8 flex flex-col items-center justify-center text-xs gap-1">
            <span className="text-muted">Don't have an account?</span>
            <button className="text-blue-500 hover:text-blue-600 transition-colors">
              Contact your IT administrator.
            </button>
          </div>
        </div>

        {/* Page Footer */}
        <div className="mt-12 flex flex-col items-center justify-center text-center px-4 w-full">
          <div className="flex items-center gap-2 mb-3">
            <Globe size={14} className="text-muted" />
            <h2 className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
              Security Enforcement
            </h2>
          </div>
          <p className="text-[10px] text-muted max-w-lg leading-relaxed mb-6">
            This platform requires an active VPN connection. Contact IT if you cannot connect. System activities
            are logged and subject to monitoring.
          </p>

          <div className="flex flex-col gap-3">
            <p className="text-[9px] text-muted uppercase tracking-wider font-semibold">
              © 2024 SECP MONOLITHIC VAULT. ALL RIGHTS RESERVED. HIGH-SECURITY ENVIRONMENT.
            </p>
            <div className="flex items-center justify-center gap-6 mt-1">
              <button className="text-[9px] font-bold text-muted hover:text-primary transition-colors tracking-wider uppercase">
                Security Policy
              </button>
              <button className="text-[9px] font-bold text-muted hover:text-primary transition-colors tracking-wider uppercase">
                Terms of Access
              </button>
              <button className="text-[9px] font-bold text-muted hover:text-primary transition-colors tracking-wider uppercase">
                System Status
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
