import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Bell,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Eye,
  FilePlus2,
  Home,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { PriorityText, StatusText } from '../../components/ui/StatusDisplay';
import { useAuth } from '../../context/AuthContext';
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeAdminNotifications,
  subscribeAllComplaints,
  subscribeAllUsers,
  subscribeContactMessages,
} from '../../services/campusService';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
  type ComplaintCategory,
  type ComplaintPriority,
  type ComplaintRecord,
  type ComplaintStatus,
  type ContactMessageRecord,
  type NotificationRecord,
  type UserProfile,
} from '../../types/campusfix';
import { downloadComplaintPdf } from '../../utils/pdfReport';
import { AdminAnalyticsView } from './AdminAnalyticsView';
import { ComplaintActionModal } from './ComplaintActionModal';

type AdminSection =
  | 'dashboard'
  | 'all'
  | 'pending'
  | 'in-progress'
  | 'resolved'
  | 'students'
  | 'analytics'
  | 'settings';

interface AdminPortalProps {
  section: AdminSection;
  onNavigate: (path: string) => void;
}

export function AdminPortal({ section, onNavigate }: AdminPortalProps) {
  const { firebaseUser, profile, isAdmin, logout } = useAuth();

  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintRecord | null>(null);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);

  // Filters for Complaint Management Table
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | ComplaintCategory>('All');
  const [priorityFilter, setPriorityFilter] = useState<'All' | ComplaintPriority>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | ComplaintStatus>('All');

  useEffect(() => {
    if (!firebaseUser || !isAdmin) return;
    setLoading(true);
    const unsubComplaints = subscribeAllComplaints((items) => {
      setComplaints(items);
      setLoading(false);
    });
    const unsubUsers = subscribeAllUsers(setUsers);
    const unsubNotifs = subscribeAdminNotifications(setNotifications);
    const unsubContacts = subscribeContactMessages(setContactMessages);

    return () => {
      unsubComplaints();
      unsubUsers();
      unsubNotifs();
      unsubContacts();
    };
  }, [firebaseUser, isAdmin]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const stats = useMemo(() => {
    const total = complaints.length;
    const pending = complaints.filter(
      (c) => c.status === 'Submitted' || c.status === 'Under Review'
    ).length;
    const active = complaints.filter((c) => c.status === 'In Progress').length;
    const resolved = complaints.filter((c) => c.status === 'Resolved').length;
    return { total, pending, active, resolved };
  }, [complaints]);

  const studentsList = useMemo(
    () => users.filter((u) => u.role === 'student'),
    [users]
  );

  const sectionComplaints = useMemo(() => {
    let base = complaints;
    if (section === 'pending') {
      base = complaints.filter(
        (c) => c.status === 'Submitted' || c.status === 'Under Review'
      );
    } else if (section === 'in-progress') {
      base = complaints.filter((c) => c.status === 'In Progress');
    } else if (section === 'resolved') {
      base = complaints.filter((c) => c.status === 'Resolved');
    }

    return base.filter((c) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        c.complaintId.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.studentName.toLowerCase().includes(q) ||
        c.building.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q);
      const matchesCategory = categoryFilter === 'All' || c.category === categoryFilter;
      const matchesPriority = priorityFilter === 'All' || c.priority === priorityFilter;
      const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
      return matchesSearch && matchesCategory && matchesPriority && matchesStatus;
    });
  }, [complaints, section, searchQuery, categoryFilter, priorityFilter, statusFilter]);

  const adminName = profile?.fullName || firebaseUser?.displayName || 'Administrator';

  const navItems: {
    id: AdminSection;
    label: string;
    path: string;
    icon: typeof LayoutDashboard;
    count?: number;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    {
      id: 'all',
      label: 'All Complaints',
      path: '/admin/complaints',
      icon: ClipboardList,
      count: stats.total,
    },
    {
      id: 'pending',
      label: 'Pending Issues',
      path: '/admin/pending',
      icon: Clock,
      count: stats.pending,
    },
    {
      id: 'in-progress',
      label: 'In Progress',
      path: '/admin/in-progress',
      icon: Wrench,
      count: stats.active,
    },
    {
      id: 'resolved',
      label: 'Resolved Issues',
      path: '/admin/resolved',
      icon: CheckCircle2,
      count: stats.resolved,
    },
    { id: 'students', label: 'Students', path: '/admin/students', icon: Users },
    { id: 'analytics', label: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    await logout();
    onNavigate('/');
  };

  const isComplaintsTableSection =
    section === 'all' ||
    section === 'pending' ||
    section === 'in-progress' ||
    section === 'resolved';

  const sectionHeadingMap: Record<AdminSection, string> = {
    dashboard: 'Operations Overview',
    all: 'All Campus Complaints',
    pending: 'Pending Review Queue',
    'in-progress': 'Active Maintenance Work',
    resolved: 'Resolved Issues Archive',
    students: 'Registered Students Directory',
    analytics: 'Campus Maintenance Analytics',
    settings: 'Administration Settings & Inbox',
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#142B4A] text-white">
        <div className="h-16 px-6 flex items-center justify-between border-b border-white/10">
          <BrandLogo inverted onClick={() => onNavigate('/')} />
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
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
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="font-mono text-xs text-[#32C5F4] tabular-nums">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-1">
          <div className="px-3.5 py-2 text-xs text-slate-400 truncate">
            Signed in as <span className="text-white font-medium">{adminName}</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>Student Portal</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
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
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
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
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span className="font-mono text-xs text-[#32C5F4]">{item.count}</span>
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
                  onNavigate('/dashboard');
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/10"
              >
                <FilePlus2 className="w-4 h-4" />
                <span>Student Portal</span>
              </button>
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
              <div className="flex items-center gap-2 text-xs font-semibold text-[#3867F5]">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>CampusFix Admin Console</span>
              </div>
              <h1 className="font-display font-bold text-base sm:text-lg text-[#142B4A] truncate">
                {sectionHeadingMap[section]}
              </h1>
            </div>
          </div>

          <div className="relative flex items-center gap-2 sm:gap-3 shrink-0">
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
              onClick={() => onNavigate('/dashboard/report')}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-lg bg-[#3867F5] text-white text-xs font-semibold hover:bg-[#2955d9] transition-colors whitespace-nowrap cursor-pointer"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Report New Issue</span>
              <span className="sm:hidden">New</span>
            </button>
            <button
              type="button"
              onClick={() => setNotifDrawerOpen((o) => !o)}
              className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Admin notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF5350] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifDrawerOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-display font-bold text-sm text-[#142B4A]">
                    Admin Alerts ({unreadCount})
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void markAllNotificationsRead(notifications)}
                      className="text-xs font-semibold text-[#3867F5] hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-200">
                  {notifications.length === 0 ? (
                    <p className="p-6 text-center text-xs text-slate-500">
                      No notifications yet.
                    </p>
                  ) : (
                    notifications.slice(0, 10).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={async () => {
                          if (!n.read) await markNotificationRead(n.id);
                          const target = complaints.find((c) => c.complaintId === n.complaintId);
                          if (target) setSelectedComplaint(target);
                          setNotifDrawerOpen(false);
                        }}
                        className={`w-full text-left p-3.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                          n.read ? 'bg-white' : 'bg-[#3867F5]/[0.05]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-0.5">
                          <span className="font-mono font-semibold text-[#3867F5]">
                            {n.complaintId}
                          </span>
                          <span className="tabular-nums">
                            {n.createdAt ? n.createdAt.toLocaleDateString() : 'Now'}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-[#142B4A]">{n.title}</p>
                        <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">{n.message}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* DASHBOARD OVERVIEW */}
          {section === 'dashboard' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Total Complaints</p>
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
                    <p className="text-xs font-medium text-slate-500">Pending Complaints</p>
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
                    <p className="text-xs font-medium text-slate-500">Active Complaints</p>
                    <p className="font-display font-bold text-3xl text-[#3867F5] tabular-nums mt-1">
                      {stats.active}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-[#3867F5]/10 text-[#3867F5] flex items-center justify-center">
                    <Wrench className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Resolved Complaints</p>
                    <p className="font-display font-bold text-3xl text-[#16A36A] tabular-nums mt-1">
                      {stats.resolved}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-[#16A36A]/10 text-[#16A36A] flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <AdminAnalyticsView complaints={complaints} compact />

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="font-display font-bold text-base text-[#142B4A]">
                      Latest Incoming Complaints
                    </h2>
                    <p className="text-xs text-slate-500">
                      Click Manage to inspect photos, assign priority, or update status
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('/admin/complaints')}
                    className="text-xs font-semibold text-[#3867F5] hover:underline cursor-pointer"
                  >
                    Open Full Queue
                  </button>
                </div>

                {loading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="h-11 rounded-lg bg-slate-100 animate-pulse" />
                    ))}
                  </div>
                ) : complaints.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">
                    No student complaints have been submitted yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-[#F7F9FC]">
                          <th className="py-3 px-6">Complaint ID</th>
                          <th className="py-3 px-4">Student</th>
                          <th className="py-3 px-4">Title</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">Priority</th>
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
                            <td className="py-3.5 px-4 text-[#142B4A] font-medium whitespace-nowrap">
                              {item.studentName}
                            </td>
                            <td className="py-3.5 px-4 text-[#142B4A] max-w-[200px] truncate">
                              {item.title}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                              {item.category}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <PriorityText priority={item.priority} />
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <StatusText status={item.status} />
                            </td>
                            <td className="py-3.5 px-6 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setSelectedComplaint(item)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#142B4A] text-white text-xs font-semibold hover:bg-[#1e3d66] cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Manage
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* COMPLAINT MANAGEMENT QUEUE */}
          {isComplaintsTableSection && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search ID, student, title..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as 'All' | ComplaintCategory)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-[#142B4A] bg-white focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                >
                  <option value="All">All Categories</option>
                  {COMPLAINT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as 'All' | ComplaintPriority)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-[#142B4A] bg-white focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                >
                  <option value="All">All Priorities</option>
                  {COMPLAINT_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p} Priority
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'All' | ComplaintStatus)}
                  disabled={section !== 'all'}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-[#142B4A] bg-white disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                >
                  <option value="All">All Statuses</option>
                  {COMPLAINT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                {sectionComplaints.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">
                    No complaints match your selected filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-[#F7F9FC]">
                          <th className="py-3 px-6">Complaint ID</th>
                          <th className="py-3 px-4">Student Name</th>
                          <th className="py-3 px-4">Complaint Title</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">Location</th>
                          <th className="py-3 px-4">Priority</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {sectionComplaints.map((item) => (
                          <tr key={item.complaintId} className="hover:bg-slate-50/80">
                            <td className="py-3.5 px-6 font-mono text-xs font-semibold text-[#3867F5] tabular-nums whitespace-nowrap">
                              {item.complaintId}
                            </td>
                            <td className="py-3.5 px-4 font-medium text-[#142B4A] whitespace-nowrap">
                              {item.studentName}
                            </td>
                            <td className="py-3.5 px-4 text-[#142B4A] max-w-[200px] truncate">
                              {item.title}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                              {item.category}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 max-w-[160px] truncate">
                              {item.building} · {item.location}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <PriorityText priority={item.priority} />
                            </td>
                            <td className="py-3.5 px-4 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                              {item.createdAt ? item.createdAt.toLocaleDateString() : 'Today'}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <StatusText status={item.status} />
                            </td>
                            <td className="py-3.5 px-6 text-right whitespace-nowrap space-x-2">
                              <button
                                type="button"
                                onClick={() => setSelectedComplaint(item)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#142B4A] text-white text-xs font-semibold hover:bg-[#1e3d66] cursor-pointer"
                              >
                                Manage
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadComplaintPdf(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                                aria-label={`Export ${item.complaintId} PDF`}
                              >
                                <Download className="w-3.5 h-3.5" />
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

          {/* STUDENTS DIRECTORY */}
          {section === 'students' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="font-display font-bold text-base text-[#142B4A]">
                    Registered Students ({studentsList.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Active student accounts synchronized from Firestore
                  </p>
                </div>
              </div>

              {studentsList.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  No registered student profiles found yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-[#F7F9FC]">
                        <th className="py-3 px-6">Student Name</th>
                        <th className="py-3 px-4">Student ID</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-6 text-right">Reports Submitted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {studentsList.map((stu) => {
                        const reportCount = complaints.filter(
                          (c) => c.studentUid === stu.uid
                        ).length;
                        return (
                          <tr key={stu.uid} className="hover:bg-slate-50/80">
                            <td className="py-3.5 px-6 font-semibold text-[#142B4A]">
                              {stu.fullName}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums">
                              {stu.studentId || '—'}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              {stu.department || '—'}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">{stu.email}</td>
                            <td className="py-3.5 px-6 text-right font-mono font-semibold text-[#142B4A] tabular-nums">
                              {reportCount}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ANALYTICS */}
          {section === 'analytics' && <AdminAnalyticsView complaints={complaints} />}

          {/* SETTINGS & INBOX */}
          {section === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 space-y-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display font-bold text-base text-[#142B4A]">
                      Admin Notification Center
                    </h2>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => void markAllNotificationsRead(notifications)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3867F5] hover:underline cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark All Read
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-slate-200">
                    {notifications.length === 0 ? (
                      <p className="py-6 text-sm text-slate-500 text-center">
                        No admin alerts logged yet.
                      </p>
                    ) : (
                      notifications.slice(0, 15).map((n) => (
                        <div key={n.id} className="py-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-mono font-semibold text-[#3867F5]">
                              {n.complaintId}
                            </p>
                            <p className="text-sm font-semibold text-[#142B4A]">{n.title}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                          </div>
                          {!n.read && (
                            <button
                              type="button"
                              onClick={() => void markNotificationRead(n.id)}
                              className="text-xs font-semibold text-[#3867F5] shrink-0 cursor-pointer"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 space-y-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#3867F5]" />
                    <h2 className="font-display font-bold text-base text-[#142B4A]">
                      Landing Page Contact Inquiries ({contactMessages.length})
                    </h2>
                  </div>

                  {contactMessages.length === 0 ? (
                    <p className="py-6 text-sm text-slate-500 text-center">
                      No contact inquiries submitted yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {contactMessages.map((msg) => (
                        <div key={msg.id} className="py-3.5 space-y-1">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span className="font-semibold text-[#142B4A]">{msg.name}</span>
                            <span className="tabular-nums">
                              {msg.createdAt ? msg.createdAt.toLocaleDateString() : 'Recent'}
                            </span>
                          </div>
                          <p className="text-xs text-[#3867F5]">{msg.email}</p>
                          <p className="text-sm font-semibold text-[#142B4A]">{msg.subject}</p>
                          <p className="text-xs text-slate-600 leading-relaxed">{msg.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2">
                  <h3 className="font-display font-bold text-sm text-[#142B4A]">
                    Role-Based Security Configuration
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Administrator privileges are verified via Cloud Firestore{' '}
                    <code className="font-mono text-[#142B4A]">/admins/{'{uid}'}</code> and enforced
                    at the database rule layer. Students can only read and track their own reports.
                  </p>
                  <p className="text-xs text-slate-500 pt-1">
                    Active Admin: <span className="font-medium text-[#142B4A]">{firebaseUser?.email}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Complaint Manage Modal */}
      {selectedComplaint && (
        <ComplaintActionModal
          complaint={selectedComplaint}
          adminName={adminName}
          onClose={() => setSelectedComplaint(null)}
        />
      )}
    </div>
  );
}
