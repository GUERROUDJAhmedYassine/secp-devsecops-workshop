import { useNavigate } from 'react-router-dom';
import { useThemeContext } from '../context/ThemeContext';
import { 
  ShieldPlus, 
  User, 
  Lock, 
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/dashboard');
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

      <div className="flex-1 flex flex-col items-center justify-center pb-20">
        
        {/* Main Login Card */}
        <div className="w-[420px] bg-card border border-border rounded-lg shadow-sm p-8 flex flex-col relative z-10 transition-colors duration-200">
          
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
                />
              </div>
              <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider ml-1">
                This field is required
              </span>
            </div>

            {/* Password Input Group */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LockKeyhole size={16} className="text-muted" />
              </div>
              <input
                type="password"
                placeholder="Enter your password"
                className="w-full pl-10 pr-10 py-2 border border-border rounded-md text-sm placeholder:text-muted focus:outline-none focus:border-blue-500 transition-colors"
                style={{ backgroundColor: 'var(--bg-page)' }}
              />
              <button 
                type="button" 
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-primary transition-colors"
              >
                <Eye size={16} />
              </button>
            </div>

            {/* Error Banners */}
            <div className="flex flex-col gap-2 mt-2">
              {/* Invalid Credentials Error */}
              <div className="bg-red-50 dark:bg-red-950/30 border-l-[3px] border-red-500 p-3 flex items-center gap-3">
                <XCircle size={16} className="text-red-500 shrink-0" />
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                  Invalid username or password. Please try again.
                </p>
              </div>

              {/* Locked Account Warning */}
              <div className="bg-slate-100 dark:bg-slate-800/50 border-l-[3px] border-slate-400 dark:border-slate-500 p-3 flex items-center gap-3">
                <Lock size={16} className="text-slate-600 dark:text-slate-400 shrink-0" />
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  Account locked. Too many failed attempts. Try again in 15 minutes.
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-md text-sm transition-colors"
            >
              SIGN IN
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
        <div className="absolute bottom-10 inset-x-0 flex flex-col items-center justify-center text-center px-6">
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
