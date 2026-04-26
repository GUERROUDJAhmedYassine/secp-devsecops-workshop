import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Bell,
  Download,
  FileText,
  Filter,
  Image as ImageIcon,
  LoaderCircle,
  Menu,
  Moon,
  MoreVertical,
  Paperclip,
  Pencil,
  ReplyAll,
  RefreshCcw,
  Reply,
  Search,
  Send,
  Shield,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';
import { useAuth } from '../hooks/useAuth';
import {
  deleteEmail,
  downloadEmailAttachment,
  getEmail,
  getInbox,
  getSent,
  sendEmail,
} from '../api/email';
import { listDirectoryUsers } from '../api/auth';
import type { EmailComposePayload, EmailMessage, MailFolder } from '../types/email.types';
import type { DirectoryUser } from '../types/user.types';

const EMPTY_COMPOSE = { to: '', subject: '', body: '' };

function formatMailTime(value: string, detailed = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return detailed
    ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function preview(body: string) {
  const trimmed = body.trim();
  return trimmed ? trimmed.slice(0, 140) : 'No message preview available.';
}

function replySubject(subject: string) {
  return subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function isImageAttachment(fileName: string | null | undefined) {
  return /\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(fileName ?? '');
}

function counterpart(email: EmailMessage, folder: MailFolder) {
  return folder === 'inbox'
    ? (email.sender_username || email.sender_email)
    : (email.recipient_username || email.recipient_email);
}

interface ComposeModalProps {
  seed: Pick<EmailComposePayload, 'to' | 'subject' | 'body'>;
  error: string | null;
  sending: boolean;
  onClose: () => void;
  onSend: (payload: EmailComposePayload) => Promise<void>;
}

function ComposeModal({ seed, error, sending, onClose, onSend }: ComposeModalProps) {
  const [to, setTo] = useState(seed.to);
  const [subject, setSubject] = useState(seed.subject);
  const [body, setBody] = useState(seed.body);
  const [attachment, setAttachment] = useState<File | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTo(seed.to);
    setSubject(seed.subject);
    setBody(seed.body);
    setAttachment(null);

    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = '';
    }
  }, [seed]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSend({ to, subject, body, attachment });
  }

  function handleAttachmentChange(event: React.ChangeEvent<HTMLInputElement>) {
    setAttachment(event.target.files?.[0] ?? null);
  }

  function clearAttachment() {
    setAttachment(null);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = '';
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-page shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <h2 className="text-sm font-semibold text-primary">New Message</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted transition-colors hover:bg-page hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block border-b border-border px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted">
          To:
          <input
            type="email"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="mt-2 w-full border-none bg-transparent text-sm font-medium text-primary outline-none placeholder:text-muted"
            placeholder="security-team@secp-platform.com"
            required
          />
        </label>

        <label className="block border-b border-border px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted">
          Subject:
          <input
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="mt-2 w-full border-none bg-transparent text-sm font-medium text-primary outline-none placeholder:text-muted"
            placeholder="Urgent: System Update Status"
            required
          />
        </label>

        <label className="block px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted">
          Message:
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="mt-2 min-h-[260px] w-full resize-none border-none bg-transparent text-sm leading-relaxed text-primary outline-none placeholder:text-muted"
            placeholder="Type your secure communication here..."
          />
        </label>

        {error && (
          <div className="border-t border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4 border-t border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2 text-xs font-semibold text-muted">
            <input
              ref={attachmentInputRef}
              type="file"
              className="hidden"
              onChange={handleAttachmentChange}
            />
            <button
              type="button"
              disabled={sending}
              onClick={() => attachmentInputRef.current?.click()}
              className="inline-flex items-center gap-2 hover:text-primary disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Paperclip className="h-4 w-4" />
              {attachment ? 'Replace File' : 'Attach Files'}
            </button>
            {attachment && (
              <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-page px-3 py-2">
                <div className="rounded-lg bg-card p-2 text-muted">
                  {isImageAttachment(attachment.name) ? (
                    <ImageIcon className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-primary">{attachment.name}</div>
                  <div className="text-xs font-semibold text-muted">{formatFileSize(attachment.size)}</div>
                </div>
                <button
                  type="button"
                  onClick={clearAttachment}
                  disabled={sending}
                  className="ml-auto rounded-md p-1 text-muted transition-colors hover:bg-card hover:text-primary disabled:cursor-not-allowed disabled:opacity-70"
                  aria-label="Remove attachment"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-lg bg-[#4f8ef7] px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-[#4f8ef7]/20 transition-colors hover:bg-[#3b7ae5] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const FOLDER_ITEMS: { key: string; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'sent', label: 'Sent' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'spam', label: 'Spam' },
  { key: 'trash', label: 'Trash' },
];

/* ------------------------------------------------------------------ */

export default function Webmail() {
  const { theme, toggleTheme } = useThemeContext();
  const { toggleSidebar } = useSidebar();
  useAuth();

  const [folder, setFolder] = useState<MailFolder>('inbox');
  const [activeFolder, setActiveFolder] = useState<string>('inbox');
  const [searchTerm, setSearchTerm] = useState('');
  const [inbox, setInbox] = useState<EmailMessage[]>([]);
  const [sent, setSent] = useState<EmailMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSeed, setComposeSeed] = useState(EMPTY_COMPOSE);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [filterOpen, setFilterOpen] = useState(false);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const [filterHasAttachments, setFilterHasAttachments] = useState(false);
  const [sortMode, setSortMode] = useState<'newest' | 'oldest'>('newest');

  const [forwardOpen, setForwardOpen] = useState(false);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [forwardQuery, setForwardQuery] = useState('');
  const [forwardSelected, setForwardSelected] = useState<DirectoryUser | null>(null);
  const [forwarding, setForwarding] = useState(false);
  const [forwardError, setForwardError] = useState<string | null>(null);
  const [attachmentDownloading, setAttachmentDownloading] = useState(false);

  const currentEmails = folder === 'inbox' ? inbox : sent;
  const unreadCount = inbox.filter((email) => !email.is_read).length;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredEmails = useMemo(() => {
    const searched = currentEmails.filter((email) => {
      if (!normalizedSearch) return true;
      return [
        email.subject,
        email.body,
        email.sender_username,
        email.sender_email,
        email.recipient_username,
        email.recipient_email,
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
    });

    const withFlags = searched.filter((email) => {
      if (filterUnreadOnly && folder === 'inbox' && email.is_read) return false;
      if (filterHasAttachments && !email.has_attachment) return false;
      return true;
    });

    const sorted = [...withFlags].sort((a, b) => {
      const at = new Date(a.sent_at).getTime();
      const bt = new Date(b.sent_at).getTime();
      return sortMode === 'newest' ? bt - at : at - bt;
    });

    return sorted;
  }, [currentEmails, normalizedSearch, filterUnreadOnly, filterHasAttachments, sortMode, folder]);

  useEffect(() => {
    void refreshMailbox('inbox', null);
  }, []);

  async function refreshMailbox(nextFolder: MailFolder = folder, preferredId: string | null = selectedId) {
    setLoading(true);
    setError(null);
    try {
      const [inboxData, sentData] = await Promise.all([
        getInbox({ page: 1, perPage: 50 }),
        getSent({ page: 1, perPage: 50 }),
      ]);
      setInbox(inboxData.emails);
      setSent(sentData.emails);
      setFolder(nextFolder);

      const folderEmails = nextFolder === 'inbox' ? inboxData.emails : sentData.emails;
      const nextId =
        preferredId && folderEmails.some((email) => email.id === preferredId)
          ? preferredId
          : folderEmails[0]?.id ?? null;
      setSelectedId(nextId);

      if (!nextId) {
        setSelectedEmail(null);
        return;
      }

      const opened = await getEmail(nextId, { markRead: nextFolder === 'inbox' });
      setSelectedEmail(opened);
      if (nextFolder === 'inbox') {
        setInbox((current) =>
          current.map((email) => (email.id === nextId ? { ...email, is_read: true } : email)),
        );
      }
    } catch (refreshError) {
      setError(errorMessage(refreshError));
      setSelectedEmail(null);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }

  async function openEmail(email: EmailMessage) {
    setSelectedId(email.id);
    setOpening(true);
    setError(null);
    try {
      const opened = await getEmail(email.id, { markRead: folder === 'inbox' });
      setSelectedEmail(opened);
      if (folder === 'inbox' && !email.is_read) {
        setInbox((current) =>
          current.map((item) => (item.id === email.id ? { ...item, is_read: true } : item)),
        );
      }
    } catch (openError) {
      setError(errorMessage(openError));
    } finally {
      setOpening(false);
    }
  }

  async function handleSend(payload: EmailComposePayload) {
    setSending(true);
    setComposeError(null);
    try {
      const created = await sendEmail(payload);
      setComposeOpen(false);
      await refreshMailbox('sent', created.id);
    } catch (sendError) {
      setComposeError(errorMessage(sendError));
    } finally {
      setSending(false);
    }
  }

  async function handleDelete() {
    if (!selectedEmail) return;
    if (!window.confirm('Delete this email?')) return;
    try {
      await deleteEmail(selectedEmail.id);
      await refreshMailbox(folder, null);
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    }
  }

  async function handleAttachmentDownload(email: EmailMessage) {
    if (!email.has_attachment) return;

    setAttachmentDownloading(true);
    setError(null);
    try {
      await downloadEmailAttachment(email.id, email.attachment_name ?? 'attachment');
    } catch (downloadError) {
      setError(errorMessage(downloadError));
    } finally {
      setAttachmentDownloading(false);
    }
  }

  async function openForward() {
    if (!selectedEmail) return;
    setForwardOpen(true);
    setForwardError(null);
    setDirectoryError(null);
    setForwardQuery('');
    setForwardSelected(null);

    setDirectoryLoading(true);
    try {
      const users = await listDirectoryUsers();
      setDirectory(users.filter((u) => u.email));
    } catch (dirError) {
      setDirectory([]);
      setDirectoryError(errorMessage(dirError));
    } finally {
      setDirectoryLoading(false);
    }
  }

  async function handleForward() {
    if (!selectedEmail || !forwardSelected) return;
    setForwarding(true);
    setForwardError(null);
    try {
      await sendEmail({
        to: forwardSelected.email,
        subject: selectedEmail.subject.toLowerCase().startsWith('fwd:')
          ? selectedEmail.subject
          : `Fwd: ${selectedEmail.subject}`,
        body: `--- Forwarded message ---\nFrom: ${selectedEmail.sender_email}\nTo: ${selectedEmail.recipient_email}\nSent: ${formatMailTime(selectedEmail.sent_at, true)}\nSubject: ${selectedEmail.subject}\n\n${selectedEmail.body}`,
      });
      setForwardOpen(false);
      await refreshMailbox(folder, selectedId);
    } catch (fwdError) {
      setForwardError(errorMessage(fwdError));
    } finally {
      setForwarding(false);
    }
  }

  const forwardCandidates = useMemo(() => {
    const q = forwardQuery.trim().toLowerCase();
    if (!q) return directory;
    return directory.filter((u) => `${u.username} ${u.email} ${u.department ?? ''}`.toLowerCase().includes(q));
  }, [directory, forwardQuery]);
  const SelectedAttachmentIcon =
    selectedEmail && isImageAttachment(selectedEmail.attachment_name) ? ImageIcon : FileText;

  return (
    <div className="flex h-screen min-w-0 flex-1 flex-col bg-page transition-colors duration-200">
      <header className="sticky top-0 z-10 border-b border-border bg-page">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={toggleSidebar} className="rounded-lg p-2 text-muted hover:bg-card hover:text-primary md:hidden">
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-primary">Webmail</h1>
              <button
                onClick={() => {
                  setComposeSeed(EMPTY_COMPOSE);
                  setComposeError(null);
                  setComposeOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-md bg-[#4f8ef7] px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-[#4f8ef7]/20 hover:bg-[#3b7ae5]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Compose
              </button>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
            <div className="relative hidden w-[28rem] max-w-full sm:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search communications..."
                className="w-full rounded-md border border-border bg-card py-2 pl-10 pr-4 text-sm text-primary placeholder:text-muted focus:border-[#4f8ef7] focus:outline-none"
              />
            </div>

            <button className="rounded-md p-2 text-muted hover:bg-card hover:text-primary" type="button" aria-label="Notifications">
              <Bell className="h-5 w-5" />
            </button>
            <button onClick={toggleTheme} className="rounded-md p-2 text-muted hover:bg-card hover:text-primary" type="button" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button className="rounded-md p-2 text-muted hover:bg-card hover:text-primary" type="button" aria-label="More">
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-3 text-sm font-medium text-muted">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Loading mailbox...
        </div>
      ) : (
        <>
          {error && (
            <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500 sm:px-8">
              {error}
            </div>
          )}

          <div className="flex flex-1 overflow-hidden">
            {/* ===== Left rail: folders + labels ===== */}
            <aside className="hidden w-[13rem] flex-col border-r border-border bg-page lg:flex">
              {/* FOLDERS */}
              <div className="px-5 pt-5 pb-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Folders</div>
              </div>
              <div className="px-3 pb-2">
                {FOLDER_ITEMS.map((item) => {
                  const isActive = activeFolder === item.key;
                  const isInbox = item.key === 'inbox';
                  const isSent = item.key === 'sent';

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setActiveFolder(item.key);
                        if (isInbox) void refreshMailbox('inbox', null);
                        else if (isSent) void refreshMailbox('sent', null);
                        else {
                          setSelectedEmail(null);
                          setSelectedId(null);
                        }
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive
                        ? 'bg-[#4f8ef7]/10 text-[#4f8ef7] font-semibold'
                        : 'text-muted hover:bg-card hover:text-primary'
                        }`}
                    >
                      <span className="flex items-center gap-2.5">
                        {item.label}
                      </span>
                      <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${isActive
                        ? 'bg-[#4f8ef7] text-white'
                        : 'bg-border text-muted'
                        }`}>
                        {isInbox
                          ? (unreadCount || inbox.length)
                          : isSent
                            ? sent.length
                            : 0}
                      </span>
                    </button>
                  );
                })}
              </div>

            </aside>

            {/* ===== Center: message list ===== */}
            <section className={`${selectedEmail ? 'hidden md:flex' : 'flex'} w-full flex-col border-r border-border bg-page md:w-[22rem] md:min-w-[22rem]`}>
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-sm font-bold text-primary">All Messages</h2>
                <div className="relative flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void refreshMailbox(folder, selectedId)}
                    className="rounded-md p-2 text-muted hover:bg-card hover:text-primary"
                    aria-label="Refresh"
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-2 text-muted hover:bg-card hover:text-primary"
                    aria-label="Filter"
                    onClick={() => setFilterOpen((v) => !v)}
                  >
                    <Filter className="h-4 w-4" />
                  </button>

                  {filterOpen && (
                    <div className="absolute right-0 top-10 z-20 w-64 overflow-hidden rounded-xl border border-border bg-page shadow-2xl">
                      <div className="border-b border-border px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted">
                        Filter
                      </div>
                      <div className="space-y-3 px-4 py-4">
                        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-primary">
                          <span>Unread only</span>
                          <input
                            type="checkbox"
                            checked={filterUnreadOnly}
                            onChange={(e) => setFilterUnreadOnly(e.target.checked)}
                            className="h-4 w-4 accent-[#4f8ef7]"
                          />
                        </label>
                        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-primary">
                          <span>Has attachments</span>
                          <input
                            type="checkbox"
                            checked={filterHasAttachments}
                            onChange={(e) => setFilterHasAttachments(e.target.checked)}
                            className="h-4 w-4 accent-[#4f8ef7]"
                          />
                        </label>
                        <div className="pt-1">
                          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Sort</div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setSortMode('newest')}
                              className={`rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide ${sortMode === 'newest'
                                ? 'bg-[#4f8ef7]/10 text-[#4f8ef7]'
                                : 'bg-card text-muted hover:text-primary'
                                }`}
                            >
                              Newest
                            </button>
                            <button
                              type="button"
                              onClick={() => setSortMode('oldest')}
                              className={`rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide ${sortMode === 'oldest'
                                ? 'bg-[#4f8ef7]/10 text-[#4f8ef7]'
                                : 'bg-card text-muted hover:text-primary'
                                }`}
                            >
                              Oldest
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-border bg-card px-4 py-3">
                        <button
                          type="button"
                          className="text-xs font-bold uppercase tracking-wider text-muted hover:text-primary"
                          onClick={() => {
                            setFilterUnreadOnly(false);
                            setFilterHasAttachments(false);
                            setSortMode('newest');
                          }}
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-[#4f8ef7] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#3b7ae5]"
                          onClick={() => setFilterOpen(false)}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-b border-border px-5 py-3 sm:hidden">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search communications..."
                    className="w-full rounded-md border border-border bg-card py-2 pl-10 pr-4 text-sm text-primary placeholder:text-muted focus:border-[#4f8ef7] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {filteredEmails.length === 0 ? (
                  <div className="px-5 py-10 text-sm font-medium text-muted">No emails matched this view.</div>
                ) : (
                  filteredEmails.map((email) => (
                    <button
                      key={email.id}
                      type="button"
                      onClick={() => {
                        void openEmail(email);
                      }}
                      className={`relative block w-full border-b border-border px-5 py-4 text-left transition-colors ${selectedId === email.id ? 'bg-card' : 'hover:bg-card'
                        }`}
                    >
                      {!email.is_read && folder === 'inbox' && <span className="absolute left-0 top-0 h-full w-1 bg-[#4f8ef7]" />}
                      <div className="mb-1 flex items-baseline justify-between gap-3">
                        <span
                          className={`text-sm ${selectedId === email.id || !email.is_read ? 'font-bold text-primary' : 'font-semibold text-muted'
                            }`}
                        >
                          {counterpart(email, folder)}
                        </span>
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted">{formatMailTime(email.sent_at)}</span>
                      </div>
                      <div
                        className={`mb-1.5 text-sm ${selectedId === email.id || !email.is_read ? 'font-bold text-primary' : 'font-semibold text-muted'
                          }`}
                      >
                        {email.subject}
                      </div>
                      <div className="text-xs leading-relaxed text-muted line-clamp-2">{preview(email.body)}</div>
                    </button>
                  ))
                )}
              </div>
            </section>

            {/* ===== Right: message viewer ===== */}
            <section className={`${selectedEmail ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-page`}>
              {/* Toolbar */}
              <div className="flex items-center justify-between border-b border-border bg-page px-3 py-2.5 sm:px-5">
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <button
                    onClick={() => setSelectedEmail(null)}
                    className="mr-1 inline-flex items-center gap-2 rounded-md border-r border-border px-2 py-1.5 text-xs font-semibold text-muted hover:bg-card hover:text-primary md:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                  <button
                    onClick={() => {
                      if (!selectedEmail) return;
                      setComposeSeed({
                        to: folder === 'inbox' ? selectedEmail.sender_email : selectedEmail.recipient_email,
                        subject: replySubject(selectedEmail.subject),
                        body: `\n\n--- Original message ---\n${selectedEmail.body}`,
                      });
                      setComposeError(null);
                      setComposeOpen(true);
                    }}
                    disabled={!selectedEmail}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-card hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Reply className="h-3.5 w-3.5" />
                    Reply
                  </button>
                  <button
                    type="button"
                    disabled={!selectedEmail}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-card hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => void openForward()}
                  >
                    <ReplyAll className="h-3.5 w-3.5" />
                    Forward
                  </button>
                  {selectedEmail && (
                    <button
                      onClick={() => {
                        void handleDelete();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-card hover:text-primary"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  )}
                </div>


              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-10">
                {opening ? (
                  <div className="flex h-full items-center justify-center gap-3 text-sm font-medium text-muted">
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    Opening message...
                  </div>
                ) : selectedEmail ? (
                  <div className="mx-auto max-w-4xl space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold leading-tight text-primary lg:text-3xl">{selectedEmail.subject}</h2>
                      <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-page text-[#4f8ef7]">
                            <Shield className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-primary">{selectedEmail.sender_username}</span>
                            </div>
                            <div className="mt-1 text-sm font-semibold text-muted">
                              From: <span className="font-semibold text-primary">{selectedEmail.sender_email}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-muted sm:flex-col sm:items-end sm:gap-1">
                          <div>{formatMailTime(selectedEmail.sent_at, true)}</div>
                          <div>
                            To: <span className="font-semibold text-primary">{selectedEmail.recipient_email}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-sm leading-relaxed text-primary">
                      <div className="whitespace-pre-wrap">{selectedEmail.body.trim() || 'This email has no body content.'}</div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
                        Attachments {selectedEmail.has_attachment ? '(1)' : '(0)'}
                      </div>

                      {selectedEmail.has_attachment ? (
                        <div className="mt-4">
                          <button
                            type="button"
                            disabled={attachmentDownloading}
                            onClick={() => {
                              void handleAttachmentDownload(selectedEmail);
                            }}
                            className="flex w-full items-center justify-between rounded-xl border border-border bg-page px-4 py-3 text-left hover:bg-card disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="rounded-lg bg-card p-2 text-muted">
                                <SelectedAttachmentIcon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-primary">
                                  {selectedEmail.attachment_name ?? 'Attachment'}
                                </div>
                                <div className="text-xs font-semibold text-muted">
                                  {selectedEmail.attachment_size ?? 'Download file'}
                                </div>
                              </div>
                            </div>
                            {attachmentDownloading ? (
                              <LoaderCircle className="h-4 w-4 animate-spin text-muted" />
                            ) : (
                              <Download className="h-4 w-4 text-muted" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2 text-sm font-medium text-muted">No attachments.</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm font-medium text-muted">
                    <Send className="h-6 w-6 text-[#4f8ef7]" />
                    Select an email to read it.
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}

      {composeOpen && (
        <ComposeModal
          seed={composeSeed}
          error={composeError}
          sending={sending}
          onClose={() => setComposeOpen(false)}
          onSend={handleSend}
        />
      )}

      {forwardOpen && selectedEmail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setForwardOpen(false)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-page shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border bg-card px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-primary">Forward message</div>
                <div className="mt-1 text-xs font-semibold text-muted line-clamp-1">{selectedEmail.subject}</div>
              </div>
              <button
                type="button"
                onClick={() => setForwardOpen(false)}
                className="rounded-md p-1 text-muted transition-colors hover:bg-page hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  value={forwardQuery}
                  onChange={(e) => setForwardQuery(e.target.value)}
                  placeholder="Search users..."
                  className="w-full rounded-md border border-border bg-card py-2 pl-10 pr-3 text-sm text-primary placeholder:text-muted focus:border-[#4f8ef7] focus:outline-none"
                />
              </div>

              {directoryError && (
                <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                  {directoryError}
                </div>
              )}

              <div className="mt-4 max-h-[320px] overflow-y-auto rounded-xl border border-border bg-card">
                {directoryLoading ? (
                  <div className="flex items-center gap-3 px-4 py-4 text-sm font-medium text-muted">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Loading users...
                  </div>
                ) : forwardCandidates.length === 0 ? (
                  <div className="px-4 py-4 text-sm font-medium text-muted">No users found.</div>
                ) : (
                  forwardCandidates.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setForwardSelected(u)}
                      className={`flex w-full items-center justify-between border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 ${forwardSelected?.id === u.id ? 'bg-[#4f8ef7]/10' : 'hover:bg-page'
                        }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-primary truncate">{u.username}</div>
                        <div className="text-xs font-semibold text-muted truncate">{u.email}</div>
                      </div>
                      {forwardSelected?.id === u.id && (
                        <span className="text-xs font-bold uppercase tracking-wider text-[#4f8ef7]">Selected</span>
                      )}
                    </button>
                  ))
                )}
              </div>

              {forwardError && (
                <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                  {forwardError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border bg-card px-5 py-4">
              <button
                type="button"
                onClick={() => setForwardOpen(false)}
                className="px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!forwardSelected || forwarding}
                onClick={() => void handleForward()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#4f8ef7] px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-[#4f8ef7]/20 transition-colors hover:bg-[#3b7ae5] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {forwarding ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ReplyAll className="h-4 w-4" />}
                Forward
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
