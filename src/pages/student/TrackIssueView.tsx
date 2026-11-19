import React, { useEffect, useState } from 'react';
import {
  Building2,
  Calendar,
  Download,
  FilePlus2,
  FileText,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  Search,
} from 'lucide-react';
import { ComplaintProgressTracker } from '../../components/ComplaintProgressTracker';
import { PriorityText, StatusText } from '../../components/ui/StatusDisplay';
import type { ComplaintRecord } from '../../types/campusfix';
import { downloadComplaintPdf } from '../../utils/pdfReport';

interface TrackIssueViewProps {
  complaints: ComplaintRecord[];
  initialComplaintId?: string | null;
  onReportMore?: () => void;
}

export function TrackIssueView({
  complaints,
  initialComplaintId,
  onReportMore,
}: TrackIssueViewProps) {
  const [searchId, setSearchId] = useState(initialComplaintId || '');
  const [selectedId, setSelectedId] = useState<string | null>(
    initialComplaintId || complaints[0]?.complaintId || null
  );
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (initialComplaintId) {
      setSearchId(initialComplaintId);
      setSelectedId(initialComplaintId);
      setSearchError(null);
    } else if (!selectedId && complaints.length > 0) {
      setSelectedId(complaints[0].complaintId);
    }
  }, [initialComplaintId, complaints, selectedId]);

  const activeComplaint =
    complaints.find((c) => c.complaintId.toLowerCase() === (selectedId || '').toLowerCase()) || null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    const trimmed = searchId.trim();
    if (!trimmed) return;

    const match = complaints.find(
      (c) => c.complaintId.toLowerCase() === trimmed.toLowerCase()
    );
    if (!match) {
      setSearchError(
        `No complaint with ID "${trimmed}" was found under your student account.`
      );
      return;
    }
    setSelectedId(match.complaintId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-[#142B4A] tracking-tight">
            Track Issue Progress
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Search using your Complaint ID or select a report below to view real-time status and remarks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 sm:flex-initial">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="Enter ID (e.g., CMP-2026-..."
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white border border-slate-200 text-sm font-mono text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-lg bg-[#142B4A] text-white text-sm font-semibold hover:bg-[#1e3d66] transition-colors cursor-pointer shrink-0"
            >
              Track
            </button>
          </form>
          {onReportMore && (
            <button
              type="button"
              onClick={onReportMore}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#3867F5] text-white text-sm font-semibold hover:bg-[#2955d9] transition-colors cursor-pointer shrink-0"
            >
              <FilePlus2 className="w-4 h-4" />
              Report Issue
            </button>
          )}
        </div>
      </div>

      {searchError && (
        <div className="p-3.5 rounded-lg bg-[#EF5350]/10 border border-[#EF5350]/25 text-sm text-[#B71C1C]">
          {searchError}
        </div>
      )}

      {complaints.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-display font-semibold text-lg text-[#142B4A]">
            No complaints to track yet
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Once you report an issue, you can monitor every status update right here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Quick Selector Column */}
          <div className="lg:col-span-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
              Your Reports ({complaints.length})
            </p>
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
              {complaints.map((item) => {
                const isSelected = activeComplaint?.complaintId === item.complaintId;
                return (
                  <button
                    key={item.complaintId}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.complaintId);
                      setSearchId(item.complaintId);
                      setSearchError(null);
                    }}
                    className={`w-full text-left p-4 transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#3867F5]/[0.06]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-xs font-semibold text-[#3867F5] tabular-nums">
                        {item.complaintId}
                      </span>
                      <StatusText status={item.status} />
                    </div>
                    <p className="text-sm font-semibold text-[#142B4A] truncate">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-1 truncate">
                      {item.category} · {item.building}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail & Progress Column */}
          <div className="lg:col-span-8">
            {activeComplaint && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-200">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1.5">
                      <span className="font-mono font-semibold text-[#3867F5]">
                        {activeComplaint.complaintId}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{activeComplaint.category}</span>
                      <span aria-hidden="true">·</span>
                      <PriorityText priority={activeComplaint.priority} />
                    </div>
                    <h3 className="font-display font-bold text-xl text-[#142B4A]">
                      {activeComplaint.title}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => downloadComplaintPdf(activeComplaint)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-[#142B4A] hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export PDF
                  </button>
                </div>

                {/* Horizontal Visual Progress Tracker */}
                <div className="p-4 sm:p-5 rounded-xl bg-[#F7F9FC] border border-slate-200">
                  <ComplaintProgressTracker status={activeComplaint.status} />
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-start gap-2.5">
                    <Building2 className="w-4 h-4 text-[#3867F5] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">Building</p>
                      <p className="font-medium text-[#142B4A]">{activeComplaint.building}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-[#3867F5] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">Location</p>
                      <p className="font-medium text-[#142B4A]">{activeComplaint.location}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Calendar className="w-4 h-4 text-[#3867F5] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">Submitted On</p>
                      <p className="font-medium text-[#142B4A] tabular-nums">
                        {activeComplaint.createdAt
                          ? activeComplaint.createdAt.toLocaleDateString()
                          : 'Just now'}
                      </p>
                    </div>
                  </div>
                </div>

                {((activeComplaint.affectedStudentsCount ?? 1) > 1 ||
                  activeComplaint.affectedUsnRange) && (
                  <div className="p-3.5 rounded-xl bg-[#F7F9FC] border border-slate-200 text-xs text-[#142B4A] flex flex-wrap items-center gap-4">
                    <span className="font-semibold tabular-nums">
                      Affected Cohort: {activeComplaint.affectedStudentsCount ?? 1} student(s)
                    </span>
                    {activeComplaint.affectedUsnRange && (
                      <span className="font-mono text-slate-600">
                        USN Range: {activeComplaint.affectedUsnRange}
                      </span>
                    )}
                  </div>
                )}

                {/* Description */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Issue Description
                  </h4>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {activeComplaint.description}
                  </p>
                </div>

                {/* Admin Remarks */}
                <div className="p-4 rounded-xl bg-[#F7F9FC] border border-slate-200">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#142B4A] mb-1.5">
                    <MessageSquare className="w-4 h-4 text-[#3867F5]" />
                    <span>Administrator Remarks</span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {activeComplaint.adminRemarks
                      ? activeComplaint.adminRemarks
                      : 'Pending review by Campus Administration. Updates will appear here in real time.'}
                  </p>
                </div>

                {/* Uploaded Image */}
                {activeComplaint.imageUrl ? (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Attached Photograph
                    </h4>
                    <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 max-w-md">
                      <img
                        src={activeComplaint.imageUrl}
                        alt={`Evidence for ${activeComplaint.complaintId}`}
                        referrerPolicy="no-referrer"
                        className="w-full max-h-72 object-cover"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <ImageIcon className="w-4 h-4" />
                    <span>No photograph attached to this report.</span>
                  </div>
                )}

                {/* History Timeline */}
                {activeComplaint.history.length > 0 && (
                  <div className="pt-4 border-t border-slate-200">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                      Activity History
                    </h4>
                    <div className="space-y-3">
                      {activeComplaint.history.map((entry, i) => (
                        <div key={`${entry.timestamp}-${i}`} className="flex items-start gap-3 text-xs">
                          <span className="font-mono text-slate-400 tabular-nums shrink-0 pt-0.5">
                            {new Date(entry.timestamp).toLocaleDateString()}
                          </span>
                          <div>
                            <p className="font-semibold text-[#142B4A]">
                              {entry.status} · <span className="font-normal text-slate-500">{entry.actorName}</span>
                            </p>
                            <p className="text-slate-600 mt-0.5">{entry.note}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
