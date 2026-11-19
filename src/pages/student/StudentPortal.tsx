import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Share2,
  User,
  UserPlus,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { PriorityText, StatusText } from '../../components/ui/StatusDisplay';
import { UsnSelector } from '../../components/ui/UsnSelector';
import { useAuth } from '../../context/AuthContext';
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribePublicStats,
  subscribeStudentComplaints,
  subscribeStudentNotifications,
  updateUserProfile,
} from '../../services/campusService';
import {
  type ComplaintRecord,
  type ComplaintStatus,
  DEPARTMENTS,
  MAX_STUDENT_COHORT_CAPACITY,
  type NotificationRecord,
  type PublicStats,
} from '../../types/campusfix';
import { downloadComplaintPdf } from '../../utils/pdfReport';
import { CohortMembersView } from './CohortMembersView';
import { ReportIssueView } from './ReportIssueView';
import { TrackIssueView } from './TrackIssueView';

type StudentSection =
  | 'overview'
  | 'report'
  | 'complaints'
  | 'track'
  | 'cohort'
  | 'notifications'
  | 'profile';

interface StudentPortalProps {
  section: StudentSection;
  onNavigate: (path: string) => void;
  onBack?: () => void;
}

export function StudentPortal({ section, onNavigate, onBack }: StudentPortalProps) {
  const {
    firebaseUser,
    profile,
    loginSuccessMessage,
    clearLoginSuccess,
    resendVerificationEmail,
    refreshVerificationStatus,
    reloadProfile,
    logout,
  } = useAuth();

  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loadingComplaints, setLoadingComplaints] = useState(true);
  const [trackedComplaintId, setTrackedComplaintId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Filters for My Complaints
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ComplaintStatus>('All');

  // Verification banner state
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  // Profile form state
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [studentId, setStudentId] = useState(profile?.studentId || '4AL25CS122');
  const [department, setDepartment] = useState(profile?.department || DEPARTMENTS[0]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);
  const [usnQuickSaved, setUsnQuickSaved] = useState<string | null>(null);
  const [showPrivateEmail, setShowPrivateEmail] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [publicStats, setPublicStats] = useState<PublicStats>({
    totalReported: 0,
    totalResolved: 0,
    activeRequests: 0,
    registeredStudents: 0,
    updatedAt: null,
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName);
      setStudentId(profile.studentId || '4AL25CS122');
      setDepartment(profile.department || DEPARTMENTS[0]);
    }
  }, [profile]);

  useEffect(() => {
    if (!firebaseUser) return;
    setLoadingComplaints(true);
    const unsubComplaints = subscribeStudentComplaints(firebaseUser.uid, (items) => {
      setComplaints(items);
      setLoadingComplaints(false);
    });
    const unsubNotifs = subscribeStudentNotifications(firebaseUser.uid, setNotifications);
    const unsubStats = subscribePublicStats(setPublicStats);
    return () => {
      unsubComplaints();
      unsubNotifs();
      unsubStats();
    };
  }, [firebaseUser]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const stats = useMemo(() => {
    const total = complaints.length;
    const pending = complaints.filter(
      (c) => c.status === 'Submitted' || c.status === 'Under Review'
    ).length;
    const inProgress = complaints.filter((c) => c.status === 'In Progress').length;
    const resolved = complaints.filter((c) => c.status === 'Resolved').length;
    return { total, pending, inProgress, resolved };
  }, [complaints]);

  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        c.complaintId.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.building.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [complaints, statusFilter, searchQuery]);

  const displayName = profile?.fullName || firebaseUser?.displayName || 'AIET Student';

  const navItems: {
    id: StudentSection;
    label: string;
    path: string;
    icon: typeof LayoutDashboard;
    badge?: number;
  }[] = [
    { id: 'overview', label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { id: 'report', label: 'Report an Issue', path: '/dashboard/report', icon: FilePlus2 },
    { id: 'complaints', label: 'My Complaints', path: '/dashboard/complaints', icon: ClipboardList },
    { id: 'track', label: 'Track Issues', path: '/dashboard/track', icon: Search },
    { id: 'cohort', label: '500-Member Portal', path: '/dashboard/cohort', icon: Users },
    {
      id: 'notifications',
      label: 'Notifications',
      path: '/dashboard/notifications',
      icon: Bell,
      badge: unreadCount,
    },
    { id: 'profile', label: 'Profile', path: '/dashboard/profile', icon: User },
  ];

  const handleOpenTrack = (complaintId: string) => {
    setTrackedComplaintId(complaintId);
    onNavigate('/dashboard/track');
  };

  const activeUsn = profile?.studentId || studentId || '4AL25CS122';

  const handleQuickUsnSave = async () => {
    if (!firebaseUser) return;
    setSavingProfile(true);
    setUsnQuickSaved(null);
    try {
      await updateUserProfile(firebaseUser.uid, {
        fullName: fullName || displayName,
        studentId,
        department,
      });
      await reloadProfile();
      setUsnQuickSaved(`USN updated to ${studentId}`);
    } catch (err) {
      setUsnQuickSaved(err instanceof Error ? err.message : 'Could not update USN.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSavingProfile(true);
    setProfileFeedback(null);
    try {
      await updateUserProfile(firebaseUser.uid, { fullName, studentId, department });
      await reloadProfile();
      setProfileFeedback('Profile details updated successfully.');
    } catch (err) {
      setProfileFeedback(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onNavigate('/');
  };

  const handleSwitchStudent = async () => {
    await logout();
    onNavigate('/register');
  };

  const handleCopyInviteLink = async () => {
    const inviteUrl = `${window.location.origin}/register`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setShareFeedback(
        'Registration link copied — share with classmates so up to 500 students can register and submit complaints.'
      );
    } catch {
      setShareFeedback(`Share this student registration link: ${inviteUrl}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#142B4A] text-white">
        <div className="h-16 px-6 flex items-center border-b border-white/10">
          <BrandLogo inverted onClick={() => onNavigate('/')} />
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.path)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#3867F5] text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="font-mono text-xs font-semibold text-[#32C5F4] tabular-nums">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-1">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#142B4A]/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative w-72 max-w-full bg-[#142B4A] text-white flex flex-col z-10">
            <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
              <BrandLogo inverted onClick={() => onNavigate('/')} />
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-2 text-slate-300 hover:text-white"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-5 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setMobileNavOpen(false);
                      onNavigate(item.path);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium ${
                      active ? 'bg-[#3867F5] text-white' : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span className="font-mono text-xs text-[#32C5F4]">{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/10 space-y-1">
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  onNavigate('/');
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/10"
              >
                <Home className="w-4 h-4" />
                <span>Back to Home</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/10"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-8 h-16 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-lg text-[#142B4A] hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-base sm:text-lg text-[#142B4A] truncate">
                Welcome Back, {displayName}
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block truncate">
                USN <span className="font-mono font-semibold text-[#142B4A]">{activeUsn}</span> · Alva&apos;s Institute of Engineering &amp; Technology, Mijar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-[#142B4A] text-xs font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
              title="Copy link so any student can register and submit complaints"
            >
              <Share2 className="w-3.5 h-3.5 text-[#3867F5]" />
              <span>Share Invite</span>
            </button>
            <button
              type="button"
              onClick={handleSwitchStudent}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-[#142B4A] text-xs font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
              title="Sign out so another student can register or log in"
            >
              <UserPlus className="w-3.5 h-3.5 text-[#16A36A]" />
              <span>Switch Student</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-[#142B4A] text-xs font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
              title="Return to first page"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/dashboard/notifications')}
              className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#3867F5] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/dashboard/report')}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-[#3867F5] text-white text-xs font-semibold hover:bg-[#2955d9] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline">Report Issue</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Invite Share Confirmation Banner */}
          {shareFeedback && (
            <div className="p-4 rounded-xl bg-[#3867F5]/10 border border-[#3867F5]/25 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Share2 className="w-4 h-4 text-[#3867F5] shrink-0" />
                <p className="text-xs sm:text-sm font-semibold text-[#142B4A]">{shareFeedback}</p>
              </div>
              <button
                type="button"
                onClick={() => setShareFeedback(null)}
                className="p-1 rounded-md text-slate-500 hover:text-[#142B4A] cursor-pointer"
                aria-label="Dismiss invite notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {/* Login Confirmation Banner */}
          {loginSuccessMessage && (
            <div className="p-4 rounded-xl bg-[#16A36A]/10 border border-[#16A36A]/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#16A36A] shrink-0" />
                <p className="text-sm font-semibold text-[#142B4A]">{loginSuccessMessage}</p>
              </div>
              <button
                type="button"
                onClick={clearLoginSuccess}
                className="p-1 rounded-md text-slate-500 hover:text-[#142B4A] cursor-pointer"
                aria-label="Dismiss login confirmation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Email Verification Gate Banner if unverified email/password user */}
          {firebaseUser && !firebaseUser.emailVerified && (
            <div className="p-4 rounded-xl bg-[#F5A623]/10 border border-[#F5A623]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-[#142B4A]">
                    Verify your email address to submit reports
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    We sent a verification link to {firebaseUser.email}. Check your inbox and click
                    Refresh Status once verified.
                  </p>
                  {verifyMsg && (
                    <p className="text-xs font-semibold text-[#142B4A] mt-1">{verifyMsg}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    await resendVerificationEmail();
                    setVerifyMsg('Verification email resent.');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-[#142B4A] hover:bg-slate-50 cursor-pointer"
                >
                  Resend Email
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await refreshVerificationStatus();
                    setVerifyMsg(
                      ok
                        ? 'Email verified! Full reporting enabled.'
                        : 'Still awaiting verification — click the link in your email first.'
                    );
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#142B4A] text-white text-xs font-semibold hover:bg-[#1e3d66] cursor-pointer"
                >
                  Refresh Status
                </button>
              </div>
            </div>
          )}

          {/* OVERVIEW */}
          {section === 'overview' && (
            <div className="space-y-6">
              {/* 4 Statistics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Total Reports</p>
                    <p className="font-display font-bold text-3xl text-[#142B4A] tabular-nums mt-1">
                      {stats.total}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-[#142B4A]/5 text-[#142B4A] flex items-center justify-center">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Pending Issues</p>
                    <p className="font-display font-bold text-3xl text-[#B45309] tabular-nums mt-1">
                      {stats.pending}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-[#F5A623]/10 text-[#F5A623] flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">In Progress</p>
                    <p className="font-display font-bold text-3xl text-[#3867F5] tabular-nums mt-1">
                      {stats.inProgress}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-[#3867F5]/10 text-[#3867F5] flex items-center justify-center">
                    <Wrench className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Resolved Issues</p>
                    <p className="font-display font-bold text-3xl text-[#16A36A] tabular-nums mt-1">
                      {stats.resolved}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-[#16A36A]/10 text-[#16A36A] flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Student USN Selection & 500-Member Cohort Card */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display font-bold text-base text-[#142B4A]">
                        Student USN Configuration
                      </h2>
                      <p className="text-xs text-slate-500">
                        Default USN is <span className="font-mono font-semibold text-[#142B4A]">4AL25CS122</span> · Choose the last 3 digits (001–500) below
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={savingProfile}
                      onClick={handleQuickUsnSave}
                      className="px-4 py-2 rounded-lg bg-[#142B4A] text-white text-xs font-semibold hover:bg-[#1e3d66] disabled:opacity-60 transition-colors cursor-pointer self-start sm:self-auto"
                    >
                      {savingProfile ? 'Saving...' : 'Save USN'}
                    </button>
                  </div>
                  <UsnSelector value={studentId} onChange={setStudentId} compact label="" />
                  {usnQuickSaved && (
                    <p className="text-xs font-semibold text-[#16A36A]">{usnQuickSaved}</p>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">
                        500-Member Capacity
                      </span>
                      <Users className="w-4 h-4 text-[#3867F5]" />
                    </div>
                    <p className="font-display font-bold text-2xl text-[#142B4A] tabular-nums">
                      {Math.min(MAX_STUDENT_COHORT_CAPACITY, publicStats.registeredStudents ?? 0)} / {MAX_STUDENT_COHORT_CAPACITY}
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Every student can register from their own device or switch accounts here to submit complaints.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => onNavigate('/dashboard/cohort')}
                      className="w-full py-2 px-3.5 rounded-lg border border-slate-200 bg-[#F7F9FC] text-xs font-semibold text-[#142B4A] hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Open 500-Member Cohort Portal
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleCopyInviteLink}
                        className="py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-[#3867F5] hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Copy Invite Link
                      </button>
                      <button
                        type="button"
                        onClick={handleSwitchStudent}
                        className="py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-[#142B4A] hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Next Student
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Complaints Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display font-bold text-lg text-[#142B4A]">
                      Recent Complaints
                    </h2>
                    <p className="text-xs text-slate-500">
                      Real-time updates from Campus Facilities Administration
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => onNavigate('/dashboard/report')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3867F5] text-white text-xs font-semibold hover:bg-[#2955d9] cursor-pointer"
                    >
                      <FilePlus2 className="w-3.5 h-3.5" />
                      Report Another Issue
                    </button>
                    {complaints.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onNavigate('/dashboard/complaints')}
                        className="text-xs font-semibold text-[#3867F5] hover:underline cursor-pointer"
                      >
                        View All
                      </button>
                    )}
                  </div>
                </div>

                {loadingComplaints ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3].map((row) => (
                      <div key={row} className="h-11 rounded-lg bg-slate-100 animate-pulse" />
                    ))}
                  </div>
                ) : complaints.length === 0 ? (
                  <div className="p-12 text-center">
                    <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <h3 className="font-display font-semibold text-base text-[#142B4A]">
                      No complaints submitted yet
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                      Spot a broken light, water leak, or Wi-Fi dead zone? Submit your first campus
                      report in under a minute.
                    </p>
                    <button
                      type="button"
                      onClick={() => onNavigate('/dashboard/report')}
                      className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#3867F5] text-white text-sm font-semibold hover:bg-[#2955d9] transition-colors cursor-pointer"
                    >
                      <FilePlus2 className="w-4 h-4" />
                      Report Your First Issue
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-[#F7F9FC]">
                          <th className="py-3 px-6">Complaint ID</th>
                          <th className="py-3 px-4">Issue Title</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">Location</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-6 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {complaints.slice(0, 6).map((item) => (
                          <tr key={item.complaintId} className="hover:bg-slate-50/80">
                            <td className="py-3.5 px-6 font-mono text-xs font-semibold text-[#3867F5] tabular-nums whitespace-nowrap">
                              {item.complaintId}
                            </td>
                            <td className="py-3.5 px-4 font-medium text-[#142B4A] max-w-[220px] truncate">
                              {item.title}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                              {item.category}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 max-w-[180px] truncate">
                              {item.building} · {item.location}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 font-mono text-xs tabular-nums whitespace-nowrap">
                              {item.createdAt ? item.createdAt.toLocaleDateString() : 'Today'}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <StatusText status={item.status} />
                            </td>
                            <td className="py-3.5 px-6 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenTrack(item.complaintId)}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3867F5] hover:text-[#142B4A] cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* REPORT AN ISSUE */}
          {section === 'report' && (
            <ReportIssueView
              onBack={onBack ? onBack : () => onNavigate('/dashboard')}
              onViewComplaints={() => onNavigate('/dashboard/complaints')}
              onSuccessTrack={(id) => {
                setTrackedComplaintId(id);
                onNavigate('/dashboard/track');
              }}
            />
          )}

          {/* MY COMPLAINTS */}
          {section === 'complaints' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display font-bold text-2xl text-[#142B4A] tracking-tight">
                    My Complaints
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Complete list of all campus issues submitted from your account.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('/dashboard/report')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#3867F5] text-white text-sm font-semibold hover:bg-[#2955d9] cursor-pointer self-start"
                >
                  <FilePlus2 className="w-4 h-4" />
                  New Complaint
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by ID, title, category, or building..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white border border-slate-200 text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                  />
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                  {(['All', 'Submitted', 'Under Review', 'In Progress', 'Resolved'] as const).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                          statusFilter === st
                            ? 'bg-white text-[#142B4A] shadow-sm'
                            : 'text-slate-600 hover:text-[#142B4A]'
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                {filteredComplaints.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">
                    No complaints match your current filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-[#F7F9FC]">
                          <th className="py-3 px-6">Complaint ID</th>
                          <th className="py-3 px-4">Title</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">Priority</th>
                          <th className="py-3 px-4">Location</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {filteredComplaints.map((item) => (
                          <tr key={item.complaintId} className="hover:bg-slate-50/80">
                            <td className="py-3.5 px-6 font-mono text-xs font-semibold text-[#3867F5] tabular-nums whitespace-nowrap">
                              {item.complaintId}
                            </td>
                            <td className="py-3.5 px-4 font-medium text-[#142B4A] max-w-[200px] truncate">
                              {item.title}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                              {item.category}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <PriorityText priority={item.priority} />
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 max-w-[170px] truncate">
                              {item.building} · {item.location}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 font-mono text-xs tabular-nums whitespace-nowrap">
                              {item.createdAt ? item.createdAt.toLocaleDateString() : 'Today'}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <StatusText status={item.status} />
                            </td>
                            <td className="py-3.5 px-6 text-right whitespace-nowrap space-x-3">
                              <button
                                type="button"
                                onClick={() => handleOpenTrack(item.complaintId)}
                                className="text-xs font-semibold text-[#3867F5] hover:underline cursor-pointer"
                              >
                                Track
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadComplaintPdf(item)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-[#142B4A] cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                PDF
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TRACK ISSUES */}
          {section === 'track' && (
            <TrackIssueView
              complaints={complaints}
              initialComplaintId={trackedComplaintId}
              onReportMore={() => onNavigate('/dashboard/report')}
            />
          )}

          {/* 500-MEMBER COHORT PORTAL */}
          {section === 'cohort' && (
            <CohortMembersView
              stats={publicStats}
              onNavigate={onNavigate}
              onBack={onBack ? onBack : () => onNavigate('/dashboard')}
            />
          )}

          {/* NOTIFICATIONS */}
          {section === 'notifications' && (
            <div className="max-w-3xl space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-display font-bold text-2xl text-[#142B4A] tracking-tight">
                    Notifications
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Real-time alerts when your complaints are reviewed, assigned, or resolved.
                  </p>
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllNotificationsRead(notifications)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-[#142B4A] hover:bg-slate-50 cursor-pointer"
                  >
                    <CheckCheck className="w-4 h-4 text-[#16A36A]" />
                    Mark All Read
                  </button>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-200 overflow-hidden">
                {notifications.length === 0 ? (
                  <div className="p-10 text-center">
                    <Bell className="w-9 h-9 text-slate-300 mx-auto mb-3" />
                    <p className="font-semibold text-[#142B4A]">No notifications yet</p>
                    <p className="text-sm text-slate-500 mt-1">
                      You will receive real-time alerts here whenever complaint statuses change.
                    </p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        notif.read ? 'bg-white' : 'bg-[#3867F5]/[0.04]'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono font-semibold text-[#3867F5]">
                            {notif.complaintId}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {notif.createdAt ? notif.createdAt.toLocaleString() : 'Just now'}
                          </span>
                          {!notif.read && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-[#3867F5]">Unread</span>
                            </>
                          )}
                        </div>
                        <h3 className="font-display font-semibold text-sm text-[#142B4A]">
                          {notif.title}
                        </h3>
                        <p className="text-sm text-slate-600">{notif.message}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!notif.read) await markNotificationRead(notif.id);
                            handleOpenTrack(notif.complaintId);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#142B4A] text-white text-xs font-semibold hover:bg-[#1e3d66] cursor-pointer"
                        >
                          View Issue
                        </button>
                        {!notif.read && (
                          <button
                            type="button"
                            onClick={() => void markNotificationRead(notif.id)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                          >
                            Mark Read
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* PROFILE */}
          {section === 'profile' && (
            <div className="max-w-2xl space-y-5">
              <div>
                <h2 className="font-display font-bold text-2xl text-[#142B4A] tracking-tight">
                  Student Profile
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Manage your academic identification and contact details.
                </p>
              </div>

              <form
                onSubmit={handleProfileSave}
                className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                  />
                </div>

                <UsnSelector
                  value={studentId}
                  onChange={setStudentId}
                  label="Student USN (Choose last 3 digits)"
                />

                <div>
                  <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                    Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-[#142B4A] bg-white focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-[#142B4A]">
                      College Email (Private)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPrivateEmail((prev) => !prev)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#3867F5] hover:underline cursor-pointer"
                    >
                      {showPrivateEmail ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          Hide
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          Reveal
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={
                      showPrivateEmail
                        ? profile?.email || firebaseUser?.email || ''
                        : '••••••••••••••••••••'
                    }
                    disabled
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600"
                  />
                </div>

                {profileFeedback && (
                  <p className="text-sm font-medium text-[#16A36A]">{profileFeedback}</p>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-5 py-2.5 rounded-lg bg-[#142B4A] text-white text-sm font-semibold hover:bg-[#1e3d66] disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {savingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
