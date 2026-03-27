import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Search, Bell, Moon, Sun, MoreVertical, Upload, Download, MoreHorizontal, FileText, FileArchive, Table, Key, Image as ImageIcon, CheckCircle, Shield, Clock, Menu } from 'lucide-react';
import { useFiles } from '../hooks/useFiles';
import type { FileCategory, BucketType } from '../types/files.types';
import { downloadFile, uploadFile } from '../api/files';
import { useTheme } from '../hooks/useTheme';
import { useSidebar } from '../context/SidebarContext';

const getCategoryIcon = (category: FileCategory) => {
  switch (category) {
    case 'pdf': return <FileText className="w-5 h-5 text-[#ef4444]" />;
    case 'archive': return <FileArchive className="w-5 h-5 text-[#4f8ef7]" />;
    case 'spreadsheet': return <Table className="w-5 h-5 text-[#22c55e]" />;
    case 'key': return <Key className="w-5 h-5 text-[#a855f7]" />;
    case 'image': return <ImageIcon className="w-5 h-5 text-[#eab308]" />;
  }
  return null;
};

const getBucketBadge = (bucket: BucketType) => {
  switch (bucket) {
    case 'CRITICAL_OPS': return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-full">CRITICAL_OPS</span>;
    case 'LOGS_ARCHIVE': return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#a855f7] bg-[#a855f7]/10 border border-[#a855f7]/20 rounded-full">LOGS_ARCHIVE</span>;
    case 'USER_DATA': return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#14b8a6] bg-[#14b8a6]/10 border border-[#14b8a6]/20 rounded-full">USER_DATA</span>;
  }
  return null;
};

export default function FileManager() {
  const [bucketFilter, setBucketFilter] = useState('All Buckets');
  const { files, storage, vaultInfo, loading, addFile } = useFiles(bucketFilter);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, toggleTheme } = useTheme();
  const { toggleSidebar } = useSidebar();

  const tabs = ['All Buckets', 'CRITICAL_OPS', 'LOGS_ARCHIVE', 'USER_DATA'];

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadFile(file);
    
    let category: FileCategory = 'archive';
    if (file.type.includes('image')) category = 'image';
    else if (file.type.includes('pdf')) category = 'pdf';
    else if (file.type.includes('spreadsheet') || file.name.endsWith('.csv') || file.name.endsWith('.xlsx')) category = 'spreadsheet';
    else if (file.name.endsWith('.key') || file.name.endsWith('.pem')) category = 'key';

    addFile({
      id: Math.random().toString(36).substr(2, 9),
      filename: file.name,
      category,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      size_label: (file.size / 1024).toFixed(1) + ' KB',
      bucket: 'USER_DATA',
      modified_at: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      owner_id: 'usr_current'
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (loading) return <div className="p-8 flex items-center justify-center h-full text-muted font-medium bg-page transition-colors duration-200">Loading File Manager...</div>;

  return (
    <div className="flex-1 min-w-0 bg-page h-screen overflow-y-auto transition-colors duration-200">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-border bg-page sticky top-0 z-10 transition-colors duration-200">
        <div className="flex items-center gap-3 sm:gap-6">
          <button onClick={toggleSidebar} className="md:hidden p-2 -ml-2 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-primary hidden sm:block">File Manager</h1>
        </div>
        <div className="flex items-center gap-1 sm:gap-3">
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search secure files..."
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
        {/* Filter Bar */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 shadow-sm transition-colors duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full xl:w-auto">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
            />
            <button 
              className="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 bg-[#4f8ef7] hover:bg-[#3b7ae5] text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#4f8ef7]/20 w-full sm:w-auto" 
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" /> Upload File
            </button>
            <div className="flex flex-wrap items-center gap-1 bg-page p-1 rounded-lg border border-border transition-colors duration-200 w-full sm:w-auto">
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setBucketFilter(tab)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${bucketFilter === tab
                    ? 'bg-card text-primary shadow shadow-black/10'
                    : 'text-muted hover:text-primary'
                    }`}
                >
                  {tab.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm bg-page px-4 py-2 rounded-lg border border-border transition-colors duration-200 w-full xl:w-auto justify-between">
            <span className="text-muted font-medium tracking-wide text-xs">STORAGE:</span>
            <div className="flex items-center gap-3">
              <span className="text-primary font-semibold">{storage?.used_gb} GB <span className="text-muted font-normal">/ {storage?.total_gb} GB</span></span>
              <div className="w-32 h-2 bg-card rounded-full overflow-hidden border border-border transition-colors duration-200">
                <div
                  className="h-full bg-gradient-to-r from-[#4f8ef7] to-[#81abea] rounded-full"
                  style={{ width: `${(storage!.used_gb / storage!.total_gb) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* File Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm transition-colors duration-200 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-border bg-card text-xs font-bold text-muted uppercase tracking-wider transition-colors duration-200">
                <th className="px-6 py-4">File Name</th>
                <th className="px-6 py-4">Bucket</th>
                <th className="px-6 py-4">Size</th>
                <th className="px-6 py-4">Modified Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card transition-colors duration-200">
              {files.map((file) => (
                <tr key={file.id} className="hover:bg-page transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-page border border-border flex items-center justify-center transition-colors duration-200">
                        {getCategoryIcon(file.category)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-primary group-hover:text-[#4f8ef7] transition-colors">{file.filename}</div>
                        <div className="text-[11px] text-muted font-medium">MIME: {file.mime_type}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getBucketBadge(file.bucket)}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-primary">{file.size_label}</td>
                  <td className="px-6 py-4 text-sm text-muted font-medium">{file.modified_at}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => downloadFile(file.id)} className="p-2 text-muted hover:text-[#4f8ef7] hover:bg-[#4f8ef7]/10 rounded-lg transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-muted hover:text-primary hover:bg-border rounded-lg transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Info Cards */}
        {vaultInfo && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
            <div className="p-5 bg-card border border-border rounded-xl flex flex-col justify-between hover:border-[#4f8ef7]/30 transition-colors shadow-sm cursor-pointer min-h-[8rem]">
              <span className="text-xs font-bold tracking-wider uppercase text-muted">Bucket Health</span>
              <div>
                <div className="text-lg font-bold text-primary mb-3">{vaultInfo.bucket_health.status}</div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#22c55e]" />
                  <span className="text-[11px] font-bold text-[#22c55e]">{vaultInfo.bucket_health.availability} Availability</span>
                </div>
              </div>
            </div>

            <div className="p-5 bg-card border border-border rounded-xl flex flex-col justify-between hover:border-[#4f8ef7]/30 transition-colors shadow-sm cursor-pointer h-32">
              <span className="text-xs font-bold tracking-wider uppercase text-muted">Active Encryption</span>
              <div>
                <div className="text-lg font-bold text-primary mb-3">{vaultInfo.encryption}</div>
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-[#4f8ef7]" />
                  <span className="text-[11px] font-bold text-[#4f8ef7]">{vaultInfo.hsm_enabled ? 'Hardware Security Module Enabled' : 'Standard Software Encryption'}</span>
                </div>
              </div>
            </div>

            <div className="p-5 bg-card border border-border rounded-xl flex flex-col justify-between hover:border-[#4f8ef7]/30 transition-colors shadow-sm cursor-pointer h-32">
              <span className="text-xs font-bold tracking-wider uppercase text-muted">Recent Activity</span>
              <div>
                <div className="text-sm font-semibold text-primary mb-2 leading-snug">
                  <span className="text-[#4f8ef7]">{vaultInfo.recent_activity.user}</span> {vaultInfo.recent_activity.action}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-muted" />
                  <span className="text-[11px] font-bold text-muted">{vaultInfo.recent_activity.time_utc}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
