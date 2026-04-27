import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  Search,
  Moon,
  Sun,
  MoreVertical,
  Upload,
  Download,
  Trash2,
  FileText,
  FileArchive,
  Table,
  Key,
  Image as ImageIcon,
  File as FileIcon,
  Menu,
  Edit3,
  Eye,
  Users,
  Plus,
  ArrowLeft,
  FolderOpen,
  MessageSquare,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFiles } from '../hooks/useFiles';
import { deriveCategory, formatFileSize, supportsCollaboration, supportsPreview } from '../types/files.types';
import type { FileCategory, CollaborationSessionResponse, SecureFile } from '../types/files.types';
import { downloadFile, uploadFile, startCollaboration } from '../api/files';
import { useTheme } from '../hooks/useTheme';
import { useSidebar } from '../context/SidebarContext';
import { useAuth } from '../hooks/useAuth';
import { useLiveRefresh } from '../hooks/useLiveRefresh';
import { DEPARTMENT_OPTIONS, getPreferredDepartment } from '../lib/departments';
import CollaborationEditor from '../components/CollaborationEditor';
import FilePreviewModal from '../components/FilePreviewModal';
import NotificationDropdown from '../components/NotificationDropdown';
import { addUserToRoom, createProjectRoom, getProjectRooms, getRoomMembers, removeUserFromRoom } from '../api/messaging';
import { listDirectoryUsers } from '../api/auth';
import type { Room } from '../types/messaging.types';
import type { DirectoryUser } from '../types/user.types';

function ModalShell({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div className="relative w-[92vw] max-w-xl rounded-2xl border border-border bg-page shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-sm font-bold text-primary">{title}</h3>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-bold text-muted hover:text-primary hover:bg-card rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const getCategoryIcon = (category: FileCategory) => {
  switch (category) {
    case 'pdf': return <FileText className="w-5 h-5 text-[#ef4444]" />;
    case 'archive': return <FileArchive className="w-5 h-5 text-[#4f8ef7]" />;
    case 'spreadsheet': return <Table className="w-5 h-5 text-[#22c55e]" />;
    case 'key': return <Key className="w-5 h-5 text-[#a855f7]" />;
    case 'image': return <ImageIcon className="w-5 h-5 text-[#eab308]" />;
    case 'document': return <FileText className="w-5 h-5 text-[#3b82f6]" />;
    case 'other': return <FileIcon className="w-5 h-5 text-[#6b7280]" />;
  }
  return null;
};

function projectBucket(roomId: string): string {
  return `project/${roomId}`;
}

function roomIdFromBucket(bucket: string): string | null {
  return bucket.startsWith('project/') ? bucket.slice('project/'.length) : null;
}

function getBucketBadge(bucket: string, roomMap: Map<string, Room>) {
  switch (bucket) {
    case 'shared':
      return <span className="inline-flex whitespace-nowrap px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-full">SHARED</span>;
    case 'personal':
      return <span className="inline-flex whitespace-nowrap px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#14b8a6] bg-[#14b8a6]/10 border border-[#14b8a6]/20 rounded-full">PERSONAL</span>;
    default:
      if (bucket.startsWith('team/')) {
        const dept = bucket.split('/')[1] ?? 'team';
        return <span className="inline-flex whitespace-nowrap px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#a855f7] bg-[#a855f7]/10 border border-[#a855f7]/20 rounded-full">TEAM / {dept.toUpperCase()}</span>;
      }
      if (bucket.startsWith('project/')) {
        const roomId = roomIdFromBucket(bucket);
        const projectName = roomId ? roomMap.get(roomId)?.name : null;
        return (
          <span className="inline-flex whitespace-nowrap px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#4f8ef7] bg-[#4f8ef7]/10 border border-[#4f8ef7]/20 rounded-full">
            PROJECT / {(projectName ?? 'WORKSPACE').toUpperCase()}
          </span>
        );
      }
      return <span className="inline-flex whitespace-nowrap px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#6b7280] bg-[#6b7280]/10 border border-[#6b7280]/20 rounded-full">{bucket.toUpperCase()}</span>;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatStorageValue(value: number): string {
  if (value === 0) return '0';
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function formatDirectoryMeta(user: DirectoryUser | undefined): string {
  if (!user) {
    return 'Directory account';
  }
  const parts = [user.email, user.department, user.role]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(' • ') : 'Directory account';
}

export default function FileManager() {
  const [bucketFilter, setBucketFilter] = useState('All Buckets');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const activeBucketFilter = selectedProjectId ? projectBucket(selectedProjectId) : bucketFilter;
  const { files, storage, loading, addFile, removeFile, refreshFiles } = useFiles(activeBucketFilter);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { toggleSidebar } = useSidebar();
  const { user, isAdmin, isManagerOrAbove } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const [activeSession, setActiveSession] = useState<CollaborationSessionResponse | null>(null);
  const [activeFilename, setActiveFilename] = useState<string>('');
  const [previewFile, setPreviewFile] = useState<SecureFile | null>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);

  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createProjectName, setCreateProjectName] = useState('');
  const [createProjectDept, setCreateProjectDept] = useState(getPreferredDepartment(user?.department));
  const [createProjectError, setCreateProjectError] = useState<string | null>(null);
  const [createProjectSaving, setCreateProjectSaving] = useState(false);

  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<DirectoryUser[]>([]);
  const [projectMemberIds, setProjectMemberIds] = useState<string[]>([]);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [addingUsers, setAddingUsers] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const roomMap = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const activeProject = useMemo(
    () => rooms.find((room) => room.id === selectedProjectId) ?? null,
    [rooms, selectedProjectId],
  );
  const userMap = useMemo(() => new Map(availableUsers.map((entry) => [entry.id, entry])), [availableUsers]);
  const currentMemberSet = useMemo(() => new Set(projectMemberIds), [projectMemberIds]);
  const departmentOptions = DEPARTMENT_OPTIONS;

  const filteredUsers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    return availableUsers
      .filter((candidate) => candidate.is_active)
      .filter((candidate) => candidate.id !== user?.id)
      .filter((candidate) => !currentMemberSet.has(candidate.id))
      .filter((candidate) => {
        if (!query) return true;
        return (
          candidate.username.toLowerCase().includes(query) ||
          candidate.email.toLowerCase().includes(query) ||
          (candidate.department ?? '').toLowerCase().includes(query) ||
          candidate.role.toLowerCase().includes(query)
        );
      });
  }, [availableUsers, currentMemberSet, memberSearch, user?.id]);
  const visibleFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return files;
    }
    return files.filter((file) => {
      const roomId = roomIdFromBucket(file.bucket);
      const projectName = roomId ? roomMap.get(roomId)?.name ?? '' : '';
      return [
        file.filename,
        file.mime_type ?? '',
        file.bucket,
        projectName,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [files, roomMap, searchQuery]);
  const storageUsagePercent = useMemo(() => {
    if (!storage || storage.total_gb <= 0) return 0;
    return Math.max(0, Math.min(100, (storage.used_gb / storage.total_gb) * 100));
  }, [storage]);

  const loadRooms = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) {
      setRoomsLoading(true);
    }
    try {
      const nextRooms = await getProjectRooms();
      setRooms(nextRooms);
      setSelectedProjectId((current) => {
        if (current && nextRooms.some((room) => room.id === current)) {
          return current;
        }
        return null;
      });
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      if (!options.silent) {
        setRoomsLoading(false);
      }
    }
  }, []);

  const loadProjectMembers = useCallback(async () => {
    if (!selectedProjectId) return;
    setMembersLoading(true);
    try {
      const response = await getRoomMembers(selectedProjectId);
      setProjectMemberIds(response.members ?? []);
    } catch (error) {
      console.error('Failed to load project members:', error);
      setMemberActionError(error instanceof Error ? error.message : 'Failed to load project members');
    } finally {
      setMembersLoading(false);
    }
  }, [selectedProjectId]);

  const loadUsersForProject = useCallback(async () => {
    setUsersLoading(true);
    try {
      const nextUsers = await listDirectoryUsers();
      setAvailableUsers(nextUsers);
    } catch (error) {
      console.error('Failed to load directory users:', error);
      setMemberActionError(error instanceof Error ? error.message : 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRooms().catch(console.error);
  }, [loadRooms]);

  useEffect(() => {
    loadUsersForProject().catch(console.error);
  }, [loadUsersForProject]);

  useLiveRefresh(
    async () => {
      await Promise.all([
        refreshFiles({ silent: true }),
        loadRooms({ silent: true }),
      ]);
    },
    {
      enabled: Boolean(user?.id),
      intervalMs: 8000,
    },
  );

  const tabs = ['All Buckets', 'personal', 'shared'];

  const openAddMembersModal = async () => {
    if (!selectedProjectId) return;
    setMemberActionError(null);
    setSelectedUserIds(new Set());
    setMemberSearch('');
    setAddMembersOpen(true);
    await Promise.all([loadProjectMembers(), loadUsersForProject()]);
  };

  const openManageMembersModal = async () => {
    if (!selectedProjectId) return;
    setMemberActionError(null);
    setManageMembersOpen(true);
    await Promise.all([loadProjectMembers(), loadUsersForProject()]);
  };

  const uploadTargetBucket = selectedProjectId
    ? projectBucket(selectedProjectId)
    : bucketFilter === 'shared'
      ? 'shared'
      : 'personal';

  const uploadDisabled = !selectedProjectId && bucketFilter === 'shared' && !isAdmin;
  const uploadLabel = activeProject
    ? `Upload to ${activeProject.name}`
    : bucketFilter === 'shared'
      ? 'Upload to Shared'
      : 'Upload File';

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadFile(file, uploadTargetBucket);
      addFile({
        id: result.id,
        owner_id: user?.id ?? '',
        filename: result.filename,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
        storage_path: '',
        bucket: result.bucket,
        is_deleted: false,
        uploaded_at: result.uploaded_at,
      });
    } catch (err) {
      console.error('Upload failed:', err);
      alert(err instanceof Error ? err.message : 'Upload failed');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (fileId: string) => {
    try {
      await removeFile(fileId);
    } catch (err) {
      console.error('Delete failed:', err);
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleCollaborate = async (fileId: string, filename: string) => {
    try {
      const session = await startCollaboration(fileId);
      setActiveSession(session);
      setActiveFilename(filename);
    } catch (err) {
      console.error('Failed to start collaboration:', err);
      alert('Could not start collaboration session. Check console for details.');
    }
  };

  const handleSelectStandardBucket = (tab: string) => {
    setSelectedProjectId(null);
    setBucketFilter(tab);
  };

  const openProjectChat = (roomId: string) => {
    navigate('/messaging', { state: { roomId } });
  };

  const handleCreateProject = async () => {
    const name = createProjectName.trim();
    const department = createProjectDept.trim() || getPreferredDepartment(user?.department);

    if (!name) {
      setCreateProjectError('Project name is required');
      return;
    }

    setCreateProjectSaving(true);
    setCreateProjectError(null);
    try {
      const room = await createProjectRoom({ name, department });
      await loadRooms();
      setSelectedProjectId(room.id);
      setCreateProjectName('');
      setCreateProjectDept(department);
      setCreateProjectOpen(false);
    } catch (error) {
      setCreateProjectError(error instanceof Error ? error.message : 'Failed to create project');
    } finally {
      setCreateProjectSaving(false);
    }
  };

  const handleAddMembers = async () => {
    if (!selectedProjectId || selectedUserIds.size === 0) return;

    setAddingUsers(true);
    setMemberActionError(null);
    try {
      await Promise.all(
        Array.from(selectedUserIds).map((userId) => addUserToRoom(selectedProjectId, userId)),
      );
      await loadProjectMembers();
      setSelectedUserIds(new Set());
      setAddMembersOpen(false);
    } catch (error) {
      setMemberActionError(error instanceof Error ? error.message : 'Failed to add members');
    } finally {
      setAddingUsers(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedProjectId) return;

    setRemovingMemberId(memberId);
    setMemberActionError(null);
    try {
      await removeUserFromRoom(selectedProjectId, memberId);
      await loadProjectMembers();
    } catch (error) {
      setMemberActionError(error instanceof Error ? error.message : 'Failed to remove member');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const emptyStateMessage = searchQuery.trim()
    ? 'No files matched your search.'
    : activeProject
      ? 'No files found in this project yet. Members can upload files to get started.'
      : 'No files found. Upload a file to get started.';

  if (loading) {
    return <div className="p-8 flex items-center justify-center h-full text-muted font-medium bg-page transition-colors duration-200">Loading File Manager...</div>;
  }

  return (
    <div className="flex-1 min-w-0 bg-page h-screen overflow-y-auto transition-colors duration-200">
      {activeSession && (
        <CollaborationEditor
          sessionInfo={activeSession}
          filename={activeFilename}
          onClose={() => setActiveSession(null)}
        />
      )}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}

      <ModalShell
        title="Create project workspace"
        open={createProjectOpen}
        onClose={() => setCreateProjectOpen(false)}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">
              Project name
            </label>
            <input
              value={createProjectName}
              onChange={(e) => setCreateProjectName(e.target.value)}
              placeholder="e.g. Blue Team Evidence Review"
              className="w-full px-4 py-2 bg-card border border-border rounded-lg text-sm text-primary focus:outline-none focus:border-[#4f8ef7] placeholder:text-muted"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">
              Department
            </label>
            <select
              value={createProjectDept}
              onChange={(e) => setCreateProjectDept(e.target.value)}
              className="w-full px-4 py-2 bg-card border border-border rounded-lg text-sm text-primary focus:outline-none focus:border-[#4f8ef7]"
            >
              {departmentOptions.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>

          {createProjectError && (
            <div className="text-xs font-medium text-red-500">{createProjectError}</div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => setCreateProjectOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-card hover:bg-border text-primary transition-colors border border-border"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateProject}
              disabled={createProjectSaving}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-[#4f8ef7] hover:bg-[#3b7ae5] text-white transition-colors disabled:opacity-60"
            >
              {createProjectSaving ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        title="Add members to project"
        open={addMembersOpen}
        onClose={() => setAddMembersOpen(false)}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted" />
            <input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search users by name, role, email, department…"
              className="flex-1 px-4 py-2 bg-card border border-border rounded-lg text-sm text-primary focus:outline-none focus:border-[#4f8ef7] placeholder:text-muted"
            />
          </div>

          {memberActionError && (
            <div className="text-xs font-medium text-red-500">{memberActionError}</div>
          )}

          <div className="max-h-72 overflow-y-auto border border-border rounded-xl">
            {usersLoading && (
              <div className="px-4 py-3 text-xs font-medium text-muted">Loading users…</div>
            )}
            {!usersLoading && filteredUsers.length === 0 && (
              <div className="px-4 py-3 text-xs font-medium text-muted">No available users found.</div>
            )}
            {!usersLoading && filteredUsers.map((candidate) => {
              const checked = selectedUserIds.has(candidate.id);
              return (
                <label
                  key={candidate.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-card cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedUserIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(candidate.id)) next.delete(candidate.id);
                        else next.add(candidate.id);
                        return next;
                      });
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-bold text-primary truncate">{candidate.username}</div>
                      <div className="text-[10px] font-bold text-muted uppercase tracking-widest">{candidate.role}</div>
                    </div>
                    <div className="text-xs text-muted truncate">
                      {formatDirectoryMeta(candidate)}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs font-medium text-muted">
              Selected: {selectedUserIds.size}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAddMembersOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-card hover:bg-border text-primary transition-colors border border-border"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMembers}
                disabled={addingUsers || selectedUserIds.size === 0}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-[#4f8ef7] hover:bg-[#3b7ae5] text-white transition-colors disabled:opacity-60"
              >
                {addingUsers ? 'Adding…' : 'Add to project'}
              </button>
            </div>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        title="Project members"
        open={manageMembersOpen}
        onClose={() => setManageMembersOpen(false)}
      >
        <div className="space-y-4">
          {memberActionError && (
            <div className="text-xs font-medium text-red-500">{memberActionError}</div>
          )}

          <div className="max-h-72 overflow-y-auto border border-border rounded-xl">
            {membersLoading && (
              <div className="px-4 py-3 text-xs font-medium text-muted">Loading members…</div>
            )}
            {!membersLoading && projectMemberIds.length === 0 && (
              <div className="px-4 py-3 text-xs font-medium text-muted">No members found.</div>
            )}
            {!membersLoading && projectMemberIds.map((memberId) => {
              const directoryEntry = userMap.get(memberId);
              const displayName = directoryEntry?.username ?? memberId;
              const isSelf = user?.id === memberId;
              return (
                <div
                  key={memberId}
                  className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-primary truncate">{displayName}{isSelf ? ' (you)' : ''}</div>
                    {directoryEntry && (
                      <div className="text-xs text-muted truncate">
                        {formatDirectoryMeta(directoryEntry)}
                      </div>
                    )}
                  </div>
                  <button
                    disabled={isSelf || removingMemberId === memberId}
                    onClick={() => handleRemoveMember(memberId)}
                    className="px-3 py-2 rounded-lg text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors border border-red-500/20 disabled:opacity-60"
                  >
                    {removingMemberId === memberId ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setManageMembersOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-card hover:bg-border text-primary transition-colors border border-border"
            >
              Close
            </button>
          </div>
        </div>
      </ModalShell>

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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search secure files..."
              className="pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-primary focus:outline-none focus:border-[#4f8ef7] w-72 transition-all placeholder:text-muted"
            />
          </div>
          <NotificationDropdown />
          <button onClick={toggleTheme} className="p-2.5 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button className="p-2.5 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors"><MoreVertical className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-[1600px] mx-auto space-y-6">
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 shadow-sm transition-colors duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full xl:w-auto">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              disabled={uploadDisabled}
              className="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 bg-[#4f8ef7] hover:bg-[#3b7ae5] text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#4f8ef7]/20 w-full sm:w-auto disabled:opacity-60"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" /> {uploadLabel}
            </button>
            <div className="flex flex-wrap items-center gap-1 bg-page p-1 rounded-lg border border-border transition-colors duration-200 w-full sm:w-auto">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleSelectStandardBucket(tab)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    !selectedProjectId && bucketFilter === tab
                      ? 'bg-card text-primary shadow shadow-black/10'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  {tab === 'All Buckets' ? 'All Buckets' : tab.toUpperCase().replace('/', ' / ')}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full xl:w-auto xl:min-w-[24rem]">
            <div className="bg-page border border-border rounded-xl px-5 py-4 flex items-center gap-4 transition-colors duration-200">
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-muted whitespace-nowrap">
                Storage:
              </div>
              <div className="text-sm font-bold text-primary whitespace-nowrap">
                {storage ? `${formatStorageValue(storage.used_gb)} GB / ${formatStorageValue(storage.total_gb)} GB` : '0 GB / 50 GB'}
              </div>
              <div className="flex-1 h-2 rounded-full bg-card overflow-hidden min-w-[8rem]">
                <div
                  className="h-full rounded-full bg-[#4f8ef7] transition-all duration-300"
                  style={{ width: `${storageUsagePercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <FolderOpen className="w-5 h-5 text-[#4f8ef7]" />
                <h2 className="text-lg font-bold">Project Workspaces</h2>
              </div>
              <p className="text-sm text-muted mt-1">
                Enter a project to show its files. Members can publish, collaborate on, preview, and download the project documents.
              </p>
            </div>
            {isManagerOrAbove && (
              <button
                onClick={() => {
                  setCreateProjectDept(getPreferredDepartment(user?.department));
                  setCreateProjectError(null);
                  setCreateProjectOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#4f8ef7] hover:bg-[#3b7ae5] text-white text-sm font-bold transition-colors whitespace-nowrap self-start lg:self-auto"
              >
                <Plus className="w-4 h-4 flex-shrink-0" /> <span className="whitespace-nowrap">Create Project</span>
              </button>
            )}
          </div>

          {roomsLoading && (
            <div className="text-sm text-muted">Loading project workspaces…</div>
          )}

          {!roomsLoading && rooms.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-page px-4 py-6 text-sm text-muted">
              No project workspaces yet. {isManagerOrAbove ? 'Create one and then add members to share files.' : 'You will see project workspaces here when a manager or admin adds you.'}
            </div>
          )}

          {!roomsLoading && rooms.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {rooms.map((room) => {
                const isActive = room.id === selectedProjectId;
                return (
                  <div
                    key={room.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      isActive ? 'border-[#4f8ef7]/50 bg-[#4f8ef7]/10' : 'border-border bg-page'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-primary truncate">{room.name}</div>
                        <div className="text-xs text-muted uppercase tracking-wider mt-1">
                          Department: {room.department ?? '—'}
                        </div>
                        <div className="text-xs text-muted mt-2">
                          Created {room.created_at ? new Date(room.created_at).toLocaleDateString() : ''}
                        </div>
                      </div>
                      <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#4f8ef7] bg-[#4f8ef7]/10 border border-[#4f8ef7]/20 rounded-full">
                        PROJECT
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      <button
                        onClick={() => setSelectedProjectId(room.id)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                          isActive
                            ? 'bg-[#4f8ef7] text-white'
                            : 'bg-card hover:bg-border text-primary border border-border'
                        }`}
                      >
                        {isActive ? 'Viewing Files' : 'Open Project'}
                      </button>
                      {isManagerOrAbove && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedProjectId(room.id);
                              void openAddMembersModal();
                            }}
                            className="px-3 py-2 rounded-lg text-xs font-bold bg-card hover:bg-border text-primary border border-border transition-colors"
                          >
                            Add Members
                          </button>
                          <button
                            onClick={() => {
                              setSelectedProjectId(room.id);
                              void openManageMembersModal();
                            }}
                            className="px-3 py-2 rounded-lg text-xs font-bold bg-card hover:bg-border text-primary border border-border transition-colors"
                          >
                            Manage Members
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {activeProject && (
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-sm">
            <div>
              <div className="text-lg font-bold text-primary">{activeProject.name}</div>
              <div className="text-sm text-muted mt-1">
                Showing files for this project workspace only. All members can see and work with the files here.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => openProjectChat(activeProject.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-[#4f8ef7] hover:bg-[#3b7ae5] text-white transition-colors"
              >
                <MessageSquare className="w-4 h-4" /> Message
              </button>
              {isManagerOrAbove && (
                <>
                  <button
                    onClick={() => void openAddMembersModal()}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-card hover:bg-border text-primary border border-border transition-colors"
                  >
                    <Users className="w-4 h-4" /> Add Members
                  </button>
                  <button
                    onClick={() => void openManageMembersModal()}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-card hover:bg-border text-primary border border-border transition-colors"
                  >
                    <Users className="w-4 h-4" /> Manage Members
                  </button>
                </>
              )}
              <button
                onClick={() => setSelectedProjectId(null)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-page hover:bg-card text-primary border border-border transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to All Files
              </button>
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm transition-colors duration-200 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-border bg-card text-xs font-bold text-muted uppercase tracking-wider transition-colors duration-200">
                <th className="px-6 py-4">File Name</th>
                <th className="px-6 py-4">Bucket</th>
                <th className="px-6 py-4">Size</th>
                <th className="px-6 py-4">Upload Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card transition-colors duration-200">
              {visibleFiles.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted text-sm">
                    {emptyStateMessage}
                  </td>
                </tr>
              )}
              {visibleFiles.map((file) => {
                const category = deriveCategory(file.mime_type, file.filename);
                const isEditable = supportsCollaboration(file.mime_type, file.filename);
                const isPreviewable = supportsPreview(file.mime_type, file.filename);
                const projectRoomId = roomIdFromBucket(file.bucket);
                const canDeleteFile = !projectRoomId || isManagerOrAbove || isAdmin;

                return (
                  <tr key={file.id} className="hover:bg-page transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-page border border-border flex items-center justify-center transition-colors duration-200">
                          {getCategoryIcon(category)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-primary group-hover:text-[#4f8ef7] transition-colors">{file.filename}</div>
                          <div className="text-[11px] text-muted font-medium">MIME: {file.mime_type ?? 'unknown'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getBucketBadge(file.bucket, roomMap)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-primary">{formatFileSize(file.file_size)}</td>
                    <td className="px-6 py-4 text-sm text-muted font-medium">{formatDate(file.uploaded_at)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {isPreviewable && (
                          <button onClick={() => setPreviewFile(file)} className="p-2 text-muted hover:text-[#f59e0b] hover:bg-[#f59e0b]/10 rounded-lg transition-colors" title="Open preview">
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {isEditable && (
                          <button onClick={() => handleCollaborate(file.id, file.filename)} className="p-2 text-muted hover:text-[#22c55e] hover:bg-[#22c55e]/10 rounded-lg transition-colors" title="Collaborate">
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => downloadFile(file.id)} className="p-2 text-muted hover:text-[#4f8ef7] hover:bg-[#4f8ef7]/10 rounded-lg transition-colors" title="Download">
                          <Download className="w-4 h-4" />
                        </button>
                        {canDeleteFile && (
                          <button onClick={() => handleDelete(file.id)} className="p-2 text-muted hover:text-[#ef4444] hover:bg-[#ef4444]/10 rounded-lg transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {projectRoomId && (
                          <button
                            onClick={() => openProjectChat(projectRoomId)}
                            className="p-2 text-muted hover:text-[#4f8ef7] hover:bg-[#4f8ef7]/10 rounded-lg transition-colors"
                            title="Open project chat"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
