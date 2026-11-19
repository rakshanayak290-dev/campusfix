import React, { useState } from 'react';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  Image as ImageIcon,
  Mail,
  MapPin,
  Save,
  User,
  X,
} from 'lucide-react';
import { ComplaintProgressTracker } from '../../components/ComplaintProgressTracker';
import { PriorityText, StatusText } from '../../components/ui/StatusDisplay';
import { updateComplaintByAdmin } from '../../services/campusService';
import {
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
  type ComplaintPriority,
  type ComplaintRecord,
  type ComplaintStatus,
  VALIDATION_LIMITS,
} from '../../types/campusfix';
import { downloadComplaintPdf } from '../../utils/pdfReport';

interface ComplaintActionModalProps {
  complaint: ComplaintRecord;
  adminName: string;
  onClose: () => void;
}

export function ComplaintActionModal({
  complaint,
  adminName,
  onClose,
}: ComplaintActionModalProps) {
  const [status, setStatus] = useState<ComplaintStatus>(complaint.status);
  const [priority, setPriority] = useState<ComplaintPriority>(complaint.priority);
  const [remarks, setRemarks] = useState<string>(complaint.adminRemarks);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (targetStatus: ComplaintStatus = status) => {
    setError(null);
    setSaving(true);
    try {
      await updateComplaintByAdmin({
        complaint,
        newStatus: targetStatus,
        newPriority: priority,
        adminRemarks: remarks,
        adminName,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update complaint.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#142B4A]/60 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-semibold text-[#3867F5]">
                {complaint.complaintId}
              </span>
              <span aria-hidden="true">·</span>
              <span>{complaint.category}</span>
            </div>
            <h2 className="font-display font-bold text-lg text-[#142B4A] truncate">
              {complaint.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => downloadComplaintPdf(complaint)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-[#142B4A] hover:bg-slate-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-[#142B4A] hover:bg-slate-100 cursor-pointer"
              aria-label="Close details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="p-4 rounded-xl bg-[#F7F9FC] border border-slate-200">
            <ComplaintProgressTracker status={status} />
          </div>

          {/* Student & Location Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-[#F7F9FC] rounded-xl p-4 border border-slate-200">
            <div className="flex items-start gap-2.5">
              <User className="w-4 h-4 text-[#3867F5] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Reported By</p>
                <p className="font-semibold text-[#142B4A]">
                  {complaint.studentName}
                  {complaint.studentIdNumber ? ` · ${complaint.studentIdNumber}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Mail className="w-4 h-4 text-[#3867F5] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Student Email</p>
                <p className="font-medium text-[#142B4A] truncate">{complaint.studentEmail}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Building2 className="w-4 h-4 text-[#3867F5] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Building &amp; Location</p>
                <p className="font-medium text-[#142B4A]">
                  {complaint.building} · {complaint.location}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-[#3867F5] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Submitted Timestamp</p>
                <p className="font-medium text-[#142B4A] tabular-nums">
                  {complaint.createdAt ? complaint.createdAt.toLocaleString() : 'Just now'}
                </p>
              </div>
            </div>
            {((complaint.affectedStudentsCount ?? 1) > 1 || complaint.affectedUsnRange) && (
              <div className="sm:col-span-2 pt-2 border-t border-slate-200 flex flex-wrap items-center gap-4 text-xs">
                <span className="font-semibold text-[#142B4A] tabular-nums">
                  Affected Cohort: {complaint.affectedStudentsCount ?? 1} student(s)
                </span>
                {complaint.affectedUsnRange && (
                  <span className="font-mono text-slate-600">
                    USN Range: {complaint.affectedUsnRange}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Detailed Description
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {complaint.description}
            </p>
          </div>

          {/* Uploaded Photo */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Submitted Photograph
            </h3>
            {complaint.imageUrl ? (
              <a
                href={complaint.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="block max-w-md rounded-xl overflow-hidden border border-slate-200 hover:opacity-95 transition-opacity"
              >
                <img
                  src={complaint.imageUrl}
                  alt={`Complaint ${complaint.complaintId}`}
                  referrerPolicy="no-referrer"
                  className="w-full max-h-64 object-cover"
                />
              </a>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ImageIcon className="w-4 h-4" />
                <span>No photograph attached by student.</span>
              </div>
            )}
          </div>

          {/* Admin Update Controls */}
          <div className="pt-4 border-t border-slate-200 space-y-4">
            <h3 className="font-display font-bold text-sm text-[#142B4A]">
              Update Resolution Status &amp; Remarks
            </h3>

            {error && (
              <p className="text-sm text-[#EF5350] font-medium">{error}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                  Status Stage
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ComplaintStatus)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-[#142B4A] bg-white focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                >
                  {COMPLAINT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                  Priority Level
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as ComplaintPriority)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-[#142B4A] bg-white focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                >
                  {COMPLAINT_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                Administrator Remarks <span className="text-slate-400 font-normal">(Visible to student)</span>
              </label>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                maxLength={VALIDATION_LIMITS.adminRemarks.max}
                placeholder="e.g., Electrical team assigned to inspect ballast replacement in Room 302."
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
              />
            </div>
          </div>

          {/* Audit History */}
          {complaint.history.length > 0 && (
            <div className="pt-4 border-t border-slate-200">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Complaint History
              </h3>
              <div className="space-y-2.5">
                {complaint.history.map((entry, idx) => (
                  <div key={`${entry.timestamp}-${idx}`} className="flex items-start gap-3 text-xs">
                    <span className="font-mono text-slate-400 tabular-nums shrink-0">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                    <div>
                      <p className="font-semibold text-[#142B4A]">
                        {entry.status} · <span className="font-normal text-slate-500">{entry.actorName}</span>
                      </p>
                      <p className="text-slate-600">{entry.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-[#F7F9FC] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <StatusText status={complaint.status} />
            <span aria-hidden="true">·</span>
            <PriorityText priority={complaint.priority} />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {complaint.status !== 'Resolved' && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave('Resolved')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#16A36A] text-white text-xs font-semibold hover:bg-[#15803D] disabled:opacity-60 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark as Resolved
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave(status)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#3867F5] text-white text-xs font-semibold hover:bg-[#2955d9] disabled:opacity-60 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Update'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
