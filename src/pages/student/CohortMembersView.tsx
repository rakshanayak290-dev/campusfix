import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  FilePlus2,
  Plus,
  Share2,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  createBatchComplaints,
  type CreateComplaintInput,
  generateComplaintId,
  registerCohortStudentMember,
} from '../../services/campusService';
import {
  CAMPUS_BUILDINGS,
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES,
  type ComplaintCategory,
  type ComplaintPriority,
  DEPARTMENTS,
  MAX_STUDENT_COHORT_CAPACITY,
  type PublicStats,
  VALIDATION_LIMITS,
} from '../../types/campusfix';

interface CohortMembersViewProps {
  stats: PublicStats;
  onNavigate: (path: string) => void;
  onBack?: () => void;
}

interface MemberDraftRow {
  id: string;
  fullName: string;
  studentId: string;
  department: string;
  email: string;
  password: string;
  includeComplaint: boolean;
  issueTitle: string;
  issueCategory: ComplaintCategory;
  issueBuilding: string;
  issueLocation: string;
  issuePriority: ComplaintPriority;
  issueDescription: string;
  status: 'pending' | 'registering' | 'registered' | 'error';
  message?: string;
}

function makeDefaultUsn(index: number): string {
  const num = Math.min(500, Math.max(1, index));
  return `4AL25CS${String(num).padStart(3, '0')}`;
}

function createDraftRow(index: number): MemberDraftRow {
  return {
    id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    fullName: '',
    studentId: makeDefaultUsn(index),
    department: DEPARTMENTS[0],
    email: '',
    password: '',
    includeComplaint: true,
    issueTitle: '',
    issueCategory: 'Electricity',
    issueBuilding: CAMPUS_BUILDINGS[0],
    issueLocation: '',
    issuePriority: 'Medium',
    issueDescription: '',
    status: 'pending',
  };
}

export function CohortMembersView({ stats, onNavigate, onBack }: CohortMembersViewProps) {
  const { firebaseUser, logout } = useAuth();

  const registeredCount = Math.min(
    MAX_STUDENT_COHORT_CAPACITY,
    Number(stats.registeredStudents ?? 0)
  );
  const availableSlots = Math.max(0, MAX_STUDENT_COHORT_CAPACITY - registeredCount);
  const capacityPercent = Math.min(
    100,
    Math.round((registeredCount / MAX_STUDENT_COHORT_CAPACITY) * 100)
  );

  const [rows, setRows] = useState<MemberDraftRow[]>(() => [createDraftRow(122)]);
  const [submittingBatch, setSubmittingBatch] = useState(false);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Quick bulk CSV intake
  const [showCsvPanel, setShowCsvPanel] = useState(false);
  const [csvText, setCsvText] = useState('');

  const inviteUrl = `${window.location.origin}/register`;

  const handleCopyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 3500);
    } catch {
      setBatchNotice(`Copy and share this registration URL with students: ${inviteUrl}`);
    }
  };

  const handleSwitchAccountRegister = async () => {
    await logout();
    onNavigate('/register');
  };

  const addMemberRow = () => {
    const nextRoll = Math.min(500, registeredCount + rows.length + 1);
    setRows((prev) => [...prev, createDraftRow(nextRoll)]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const updateRow = (id: string, patch: Partial<MemberDraftRow>) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  };

  const handleImportCsvRows = () => {
    const lines = csvText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const remainingAllowed = Math.max(0, MAX_STUDENT_COHORT_CAPACITY - registeredCount);
    const parsed: MemberDraftRow[] = lines.slice(0, remainingAllowed || 50).map((line, idx) => {
      const [
        fullName = '',
        studentId = '',
        deptOrCode = '',
        email = '',
        password = '',
        issueTitle = '',
        issueLocation = '',
        issueDescription = '',
      ] = line.split(',').map((c) => c.trim());
      const matchedDept =
        DEPARTMENTS.find((d) => d.toLowerCase().includes(deptOrCode.toLowerCase())) ||
        DEPARTMENTS[0];
      return {
        ...createDraftRow(idx + 1),
        id: `csv_${Date.now()}_${idx}`,
        fullName,
        studentId: studentId || makeDefaultUsn(idx + 1),
        department: matchedDept,
        email,
        password,
        includeComplaint: Boolean(issueTitle),
        issueTitle,
        issueLocation,
        issueDescription,
      };
    });

    setRows(parsed);
    setShowCsvPanel(false);
    setCsvText('');
    setBatchNotice(`Loaded ${parsed.length} member row(s) into the cohort queue.`);
  };

  const handleRegisterAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setBatchNotice(null);

    const pendingRows = rows.filter((r) => r.status !== 'registered');
    if (pendingRows.length === 0) {
      setBatchNotice('All listed members are already registered.');
      return;
    }
    if (registeredCount + pendingRows.length > MAX_STUDENT_COHORT_CAPACITY) {
      setBatchNotice(
        `Only ${availableSlots} slot(s) remain in the 500-member cohort capacity.`
      );
      return;
    }

    for (let i = 0; i < pendingRows.length; i += 1) {
      const r = pendingRows[i];
      if (r.includeComplaint) {
        if (r.issueTitle.trim().length < VALIDATION_LIMITS.title.min) {
          setBatchNotice(
            `Member #${i + 1}: Please enter an issue title (at least ${VALIDATION_LIMITS.title.min} characters) or uncheck "Give Complaint".`
          );
          return;
        }
        if (r.issueLocation.trim().length < VALIDATION_LIMITS.location.min) {
          setBatchNotice(`Member #${i + 1}: Please specify the location of the complaint.`);
          return;
        }
        if (r.issueDescription.trim().length < VALIDATION_LIMITS.description.min) {
          setBatchNotice(
            `Member #${i + 1}: Description must be at least ${VALIDATION_LIMITS.description.min} characters.`
          );
          return;
        }
      }
    }

    setSubmittingBatch(true);
    let registeredSuccess = 0;
    const complaintsToCreate: CreateComplaintInput[] = [];

    for (const row of pendingRows) {
      updateRow(row.id, { status: 'registering', message: undefined });
      try {
        await registerCohortStudentMember({
          fullName: row.fullName,
          studentId: row.studentId,
          email: row.email,
          department: row.department,
          password: row.password,
        });
        registeredSuccess += 1;

        if (row.includeComplaint && firebaseUser) {
          complaintsToCreate.push({
            complaintId: generateComplaintId(),
            studentUid: firebaseUser.uid,
            studentName: row.fullName.trim(),
            studentEmail: row.email.trim(),
            studentIdNumber: row.studentId.trim().toUpperCase(),
            title: row.issueTitle.trim(),
            description: row.issueDescription.trim(),
            category: row.issueCategory,
            building: row.issueBuilding,
            location: row.issueLocation.trim(),
            priority: row.issuePriority,
            imageUrl: '',
            affectedStudentsCount: 1,
            affectedUsnRange: row.studentId.trim().toUpperCase(),
          });
        }

        updateRow(row.id, {
          status: 'registered',
          message: row.includeComplaint
            ? `Registered (${row.studentId}) & complaint queued`
            : `Registered (${row.studentId})`,
        });
      } catch (err) {
        const code = (err as { code?: string })?.code || '';
        const msg =
          code === 'auth/operation-not-allowed'
            ? 'Enable Email/Password in Firebase Console -> Authentication -> Sign-in method.'
            : err instanceof Error
              ? err.message
              : 'Registration failed.';
        updateRow(row.id, { status: 'error', message: msg });
      }
    }

    let complaintsSubmitted = 0;
    if (complaintsToCreate.length > 0 && firebaseUser?.emailVerified) {
      try {
        await createBatchComplaints(complaintsToCreate);
        complaintsSubmitted = complaintsToCreate.length;
      } catch (err) {
        setBatchNotice(
          err instanceof Error
            ? `Registered ${registeredSuccess} member(s), but complaint submission failed: ${err.message}`
            : `Registered ${registeredSuccess} member(s), but complaints could not be saved.`
        );
        setSubmittingBatch(false);
        return;
      }
    }

    setSubmittingBatch(false);
    if (registeredSuccess > 0) {
      const complaintNote =
        complaintsSubmitted > 0
          ? ` and logged ${complaintsSubmitted} complaint(s)`
          : complaintsToCreate.length > 0 && !firebaseUser?.emailVerified
            ? ' (verify your email to submit their queued complaints)'
            : '';
      setBatchNotice(
        `Successfully registered ${registeredSuccess} member(s)${complaintNote}.`
      );
    } else {
      setBatchNotice('No members were registered. Check row error details below.');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-[#142B4A] hover:bg-slate-50 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}
          <h2 className="font-display font-bold text-2xl text-[#142B4A] tracking-tight">
            500-Member Student Cohort Portal
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Register up to 500 student members (USN 001–500) and record their campus complaints in
            the same workflow.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('/dashboard/report')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#3867F5] text-white text-xs font-semibold hover:bg-[#2955d9] transition-colors cursor-pointer self-start"
        >
          <FilePlus2 className="w-4 h-4" />
          Report / Multiple Complaints
        </button>
      </div>

      {/* Live 500-Member Capacity Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#3867F5]/10 text-[#3867F5] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">
                Cohort Registration Capacity (USN 001–500)
              </p>
              <p className="font-display font-bold text-2xl text-[#142B4A] tabular-nums">
                {registeredCount} / {MAX_STUDENT_COHORT_CAPACITY} Members Registered
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <p className="font-mono text-sm font-bold text-[#16A36A] tabular-nums">
              {availableSlots} Open Slots
            </p>
            <p className="text-xs text-slate-500">
              20 distributed counter shards active for concurrent writes
            </p>
          </div>
        </div>

        <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-[#3867F5] transition-all duration-300"
            style={{ width: `${capacityPercent}%` }}
          />
        </div>
      </div>

      {/* Open Registration for Everyone (Share Link & Shared Kiosk Switch) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#3867F5] mb-1">
              <Share2 className="w-3.5 h-3.5" />
              <span>Open Access for Everyone (Up to 500 Students)</span>
            </div>
            <h3 className="font-display font-bold text-lg text-[#142B4A]">
              Let Every Student Register &amp; Submit Their Own Complaint
            </h3>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Share the registration link below so classmates can open the Student Portal on their
              own phones or laptops, sign in with Google or email, pick their USN (001–500), and
              submit issues independently. On a shared laptop, click Switch Student below.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSwitchAccountRegister}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#142B4A] text-white text-xs font-semibold hover:bg-[#1e3d66] transition-colors cursor-pointer shrink-0 self-start"
          >
            <UserPlus className="w-4 h-4" />
            Switch Student / Register Next Member
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            readOnly
            value={inviteUrl}
            aria-label="Student registration link"
            className="flex-1 px-3.5 py-2 rounded-lg border border-slate-200 bg-[#F7F9FC] font-mono text-xs text-[#142B4A] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleCopyInviteLink}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-[#142B4A] hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
          >
            <Copy className="w-3.5 h-3.5 text-[#3867F5]" />
            <span>{inviteCopied ? 'Invite Link Copied!' : 'Copy Invite Link'}</span>
          </button>
        </div>
      </div>

      {/* Multi-Member Registration + Complaint Form */}
      <form
        onSubmit={handleRegisterAll}
        className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h3 className="font-display font-bold text-lg text-[#142B4A]">
              Register Members &amp; Submit Their Complaints
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Each member can register (up to 500 seats) and optionally give their campus complaint
              immediately.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCsvPanel((v) => !v)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-[#142B4A] hover:bg-slate-50 cursor-pointer"
            >
              {showCsvPanel ? 'Hide CSV Paste' : 'Paste CSV List'}
            </button>
            <button
              type="button"
              onClick={addMemberRow}
              disabled={submittingBatch || rows.length >= availableSlots}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#142B4A] text-white text-xs font-semibold hover:bg-[#1e3d66] disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Member
            </button>
          </div>
        </div>

        {showCsvPanel && (
          <div className="p-4 rounded-xl bg-[#F7F9FC] border border-slate-200 space-y-3">
            <label className="block text-xs font-semibold text-[#142B4A]">
              Paste lines as: Full Name, USN, Dept, Email, Password, Issue Title (optional), Location, Description
            </label>
            <textarea
              rows={4}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Aarav Rao, 4AL25CS001, CSE, aarav001@example.com, Pass@123, Broken Fan, Room 204, Ceiling fan stopped working since morning"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono text-xs text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleImportCsvRows}
                className="px-4 py-1.5 rounded-lg bg-[#3867F5] text-white text-xs font-semibold hover:bg-[#2955d9] cursor-pointer"
              >
                Load into Member Queue
              </button>
            </div>
          </div>
        )}

        {batchNotice && (
          <div className="p-3.5 rounded-lg bg-[#3867F5]/10 border border-[#3867F5]/25 text-xs sm:text-sm text-[#142B4A] font-medium">
            {batchNotice}
          </div>
        )}

        <div className="space-y-4">
          {rows.map((row, idx) => (
            <div
              key={row.id}
              className="p-4 rounded-xl border border-slate-200 bg-[#F7F9FC] space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs font-bold text-[#142B4A]">
                    Member #{idx + 1}
                  </span>
                  {row.status !== 'registered' && (
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3867F5] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={row.includeComplaint}
                        onChange={(e) =>
                          updateRow(row.id, { includeComplaint: e.target.checked })
                        }
                        className="rounded border-slate-300 text-[#3867F5] focus:ring-[#3867F5]"
                      />
                      <span>Give Complaint Now</span>
                    </label>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {row.status === 'registered' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A36A]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {row.message}
                    </span>
                  )}
                  {row.status === 'error' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#EF5350]">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {row.message}
                    </span>
                  )}
                  {rows.length > 1 && row.status !== 'registered' && (
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      disabled={submittingBatch}
                      className="p-1 text-slate-400 hover:text-[#EF5350] cursor-pointer"
                      aria-label="Remove member row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Registration Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <input
                  type="text"
                  value={row.fullName}
                  onChange={(e) => updateRow(row.id, { fullName: e.target.value })}
                  placeholder="Full Name"
                  required
                  disabled={row.status === 'registered'}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5] disabled:bg-slate-100"
                />
                <input
                  type="text"
                  value={row.studentId}
                  onChange={(e) =>
                    updateRow(row.id, { studentId: e.target.value.toUpperCase() })
                  }
                  placeholder="USN (e.g. 4AL25CS001)"
                  required
                  disabled={row.status === 'registered'}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5] disabled:bg-slate-100"
                />
                <select
                  value={row.department}
                  onChange={(e) => updateRow(row.id, { department: e.target.value })}
                  disabled={row.status === 'registered'}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5] disabled:bg-slate-100"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
                <input
                  type="email"
                  value={row.email}
                  onChange={(e) => updateRow(row.id, { email: e.target.value })}
                  placeholder="Student Email"
                  required
                  disabled={row.status === 'registered'}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5] disabled:bg-slate-100"
                />
                <input
                  type="password"
                  value={row.password}
                  onChange={(e) => updateRow(row.id, { password: e.target.value })}
                  placeholder="Password (min 6 chars)"
                  required
                  disabled={row.status === 'registered'}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5] disabled:bg-slate-100"
                />
              </div>

              {/* Member Complaint Fields */}
              {row.includeComplaint && (
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <input
                      type="text"
                      value={row.issueTitle}
                      onChange={(e) => updateRow(row.id, { issueTitle: e.target.value })}
                      placeholder="Complaint Title *"
                      maxLength={VALIDATION_LIMITS.title.max}
                      disabled={row.status === 'registered'}
                      className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5] disabled:bg-slate-100"
                    />
                    <select
                      value={row.issueCategory}
                      onChange={(e) =>
                        updateRow(row.id, {
                          issueCategory: e.target.value as ComplaintCategory,
                        })
                      }
                      disabled={row.status === 'registered'}
                      className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5] disabled:bg-slate-100"
                    >
                      {COMPLAINT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <select
                      value={row.issueBuilding}
                      onChange={(e) => updateRow(row.id, { issueBuilding: e.target.value })}
                      disabled={row.status === 'registered'}
                      className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5] disabled:bg-slate-100"
                    >
                      {CAMPUS_BUILDINGS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={row.issueLocation}
                        onChange={(e) =>
                          updateRow(row.id, { issueLocation: e.target.value })
                        }
                        placeholder="Room / Area *"
                        disabled={row.status === 'registered'}
                        className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5] disabled:bg-slate-100"
                      />
                      <select
                        value={row.issuePriority}
                        onChange={(e) =>
                          updateRow(row.id, {
                            issuePriority: e.target.value as ComplaintPriority,
                          })
                        }
                        disabled={row.status === 'registered'}
                        className="px-2 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5] disabled:bg-slate-100"
                      >
                        {COMPLAINT_PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={row.issueDescription}
                    onChange={(e) => updateRow(row.id, { issueDescription: e.target.value })}
                    placeholder="Detailed complaint description (min 10 characters) *"
                    maxLength={VALIDATION_LIMITS.description.max}
                    disabled={row.status === 'registered'}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5] disabled:bg-slate-100"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Supports registering multiple cohort members and immediately logging each member&apos;s
            campus complaint.
          </p>
          <button
            type="submit"
            disabled={submittingBatch || availableSlots === 0}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#3867F5] text-white text-sm font-semibold hover:bg-[#2955d9] disabled:opacity-60 transition-colors cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            {submittingBatch
              ? 'Processing Members...'
              : `Register & Submit (${rows.filter((r) => r.status !== 'registered').length})`}
          </button>
        </div>
      </form>
    </div>
  );
}
