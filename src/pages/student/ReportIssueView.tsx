import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Download,
  ImagePlus,
  Layers,
  Plus,
  Search,
  Send,
  Trash2,
  UploadCloud,
  Users,
} from 'lucide-react';
import { UsnSelector } from '../../components/ui/UsnSelector';
import { useAuth } from '../../context/AuthContext';
import {
  createBatchComplaints,
  createComplaint,
  type CreateComplaintInput,
  generateComplaintId,
  uploadComplaintImage,
} from '../../services/campusService';
import {
  CAMPUS_BUILDINGS,
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES,
  type ComplaintCategory,
  type ComplaintPriority,
  type ComplaintRecord,
  VALIDATION_LIMITS,
} from '../../types/campusfix';
import { downloadComplaintPdf } from '../../utils/pdfReport';

interface ReportIssueViewProps {
  onSuccessTrack: (complaintId: string) => void;
  onViewComplaints?: () => void;
  onBack?: () => void;
}

interface MultiComplaintDraft {
  id: string;
  studentName: string;
  studentIdNumber: string;
  title: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  building: string;
  location: string;
  description: string;
  affectedStudentsCount: number;
}

function createEmptyDraft(defaultName: string, defaultUsn: string): MultiComplaintDraft {
  return {
    id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    studentName: defaultName,
    studentIdNumber: defaultUsn,
    title: '',
    category: 'Electricity',
    priority: 'Medium',
    building: CAMPUS_BUILDINGS[0],
    location: '',
    description: '',
    affectedStudentsCount: 1,
  };
}

export function ReportIssueView({
  onSuccessTrack,
  onViewComplaints,
  onBack,
}: ReportIssueViewProps) {
  const { firebaseUser, profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const defaultStudentName = profile?.fullName || firebaseUser?.displayName || 'AIET Student';
  const defaultStudentUsn = profile?.studentId || '4AL25CS122';

  const [entryMode, setEntryMode] = useState<'single' | 'multiple'>('single');

  // Single complaint form state
  const [reporterName, setReporterName] = useState(defaultStudentName);
  const [reporterUsn, setReporterUsn] = useState(defaultStudentUsn);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('Electricity');
  const [building, setBuilding] = useState(CAMPUS_BUILDINGS[0]);
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState<ComplaintPriority>('Medium');
  const [affectedStudentsCount, setAffectedStudentsCount] = useState<number>(1);
  const [affectedUsnRange, setAffectedUsnRange] = useState('');

  // Multi-complaint batch form state (start with 2 visible cards when toggled to multiple)
  const [multiDrafts, setMultiDrafts] = useState<MultiComplaintDraft[]>(() => [
    createEmptyDraft(defaultStudentName, defaultStudentUsn),
    createEmptyDraft(defaultStudentName, defaultStudentUsn),
  ]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [createdComplaints, setCreatedComplaints] = useState<ComplaintRecord[]>([]);

  const handleFileSelection = (file: File | null) => {
    setError(null);
    setStorageWarning(null);
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Invalid file format. Please upload a JPG, PNG, or WEBP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image exceeds the 5 MB limit. Please select a smaller photograph.');
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const clearSelectedFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadProgress(0);
    setStorageWarning(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submitSingleComplaint = async (skipPhotoUpload = false) => {
    setError(null);
    setStorageWarning(null);

    if (!firebaseUser) {
      setError('You must be signed in to submit a report.');
      return;
    }
    if (!firebaseUser.emailVerified) {
      setError(
        'Please verify your email address before submitting a complaint. You can use the verification banner above or sign in with Google.'
      );
      return;
    }
    if (title.trim().length < VALIDATION_LIMITS.title.min) {
      setError(`Issue title must be at least ${VALIDATION_LIMITS.title.min} characters.`);
      return;
    }
    if (description.trim().length < VALIDATION_LIMITS.description.min) {
      setError(`Detailed description must be at least ${VALIDATION_LIMITS.description.min} characters.`);
      return;
    }
    if (location.trim().length < VALIDATION_LIMITS.location.min) {
      setError('Please specify the exact room, floor, or area.');
      return;
    }

    setSubmitting(true);
    const complaintId = generateComplaintId();
    let uploadedImageUrl = '';

    try {
      if (selectedFile && !skipPhotoUpload) {
        try {
          uploadedImageUrl = await uploadComplaintImage(
            firebaseUser.uid,
            complaintId,
            selectedFile,
            (pct) => setUploadProgress(pct)
          );
        } catch (uploadErr) {
          setStorageWarning(
            uploadErr instanceof Error
              ? uploadErr.message
              : 'Photograph upload failed. You can submit without the photograph or retry.'
          );
          setSubmitting(false);
          return;
        }
      }

      const studentEmail = profile?.email || firebaseUser.email || '';
      const activeReporterName =
        reporterName.trim().length >= 2 ? reporterName.trim() : defaultStudentName;
      const activeReporterUsn = reporterUsn.trim().toUpperCase() || defaultStudentUsn;

      await createComplaint({
        complaintId,
        studentUid: firebaseUser.uid,
        studentName: activeReporterName,
        studentEmail,
        studentIdNumber: activeReporterUsn,
        title,
        description,
        category,
        building,
        location,
        priority,
        imageUrl: uploadedImageUrl,
        affectedStudentsCount,
        affectedUsnRange,
      });

      const savedRecord: ComplaintRecord = {
        complaintId,
        studentUid: firebaseUser.uid,
        studentName: activeReporterName,
        studentEmail,
        studentIdNumber: activeReporterUsn,
        title: title.trim(),
        description: description.trim(),
        category,
        building,
        location: location.trim(),
        priority,
        imageUrl: uploadedImageUrl,
        status: 'Submitted',
        adminRemarks: '',
        affectedStudentsCount,
        affectedUsnRange: affectedUsnRange.trim(),
        history: [
          {
            status: 'Submitted',
            note: 'Issue reported by student and queued for administrative review.',
            actorName: activeReporterName,
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setCreatedComplaints([savedRecord]);
      setTitle('');
      setDescription('');
      setLocation('');
      setAffectedStudentsCount(1);
      setAffectedUsnRange('');
      clearSelectedFile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateMultiDraft = (id: string, patch: Partial<MultiComplaintDraft>) => {
    setMultiDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const addMultiDraftCard = () => {
    setMultiDrafts((prev) => [
      ...prev,
      createEmptyDraft(defaultStudentName, defaultStudentUsn),
    ]);
  };

  const removeMultiDraftCard = (id: string) => {
    setMultiDrafts((prev) => (prev.length > 1 ? prev.filter((d) => d.id !== id) : prev));
  };

  const handleSubmitMultiple = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firebaseUser) {
      setError('You must be signed in to submit reports.');
      return;
    }
    if (!firebaseUser.emailVerified) {
      setError(
        'Please verify your email address before submitting complaints. Use the verification banner above or sign in with Google.'
      );
      return;
    }

    for (let i = 0; i < multiDrafts.length; i += 1) {
      const d = multiDrafts[i];
      if (d.title.trim().length < VALIDATION_LIMITS.title.min) {
        setError(`Complaint #${i + 1}: Title must be at least ${VALIDATION_LIMITS.title.min} characters.`);
        return;
      }
      if (d.location.trim().length < VALIDATION_LIMITS.location.min) {
        setError(`Complaint #${i + 1}: Please specify the room, floor, or area.`);
        return;
      }
      if (d.description.trim().length < VALIDATION_LIMITS.description.min) {
        setError(
          `Complaint #${i + 1}: Description must be at least ${VALIDATION_LIMITS.description.min} characters.`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const studentEmail = profile?.email || firebaseUser.email || '';
      const inputs: CreateComplaintInput[] = multiDrafts.map((d) => ({
        complaintId: generateComplaintId(),
        studentUid: firebaseUser.uid,
        studentName: d.studentName.trim() || defaultStudentName,
        studentEmail,
        studentIdNumber: d.studentIdNumber.trim().toUpperCase() || defaultStudentUsn,
        title: d.title.trim(),
        description: d.description.trim(),
        category: d.category,
        building: d.building,
        location: d.location.trim(),
        priority: d.priority,
        imageUrl: '',
        affectedStudentsCount: Math.min(500, Math.max(1, d.affectedStudentsCount || 1)),
        affectedUsnRange: '',
      }));

      await createBatchComplaints(inputs);

      const savedList: ComplaintRecord[] = inputs.map((item) => ({
        ...item,
        status: 'Submitted',
        adminRemarks: '',
        history: [
          {
            status: 'Submitted',
            note: 'Submitted via Multi-Complaint portal.',
            actorName: item.studentName,
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      setCreatedComplaints(savedList);
      setMultiDrafts([
        createEmptyDraft(defaultStudentName, defaultStudentUsn),
        createEmptyDraft(defaultStudentName, defaultStudentUsn),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit multiple complaints.');
    } finally {
      setSubmitting(false);
    }
  };

  if (createdComplaints.length > 0) {
    const primary = createdComplaints[0];
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-[#142B4A] hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        )}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-[#16A36A]/10 text-[#16A36A] flex items-center justify-center mb-5">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="font-display font-bold text-2xl text-[#142B4A]">
            {createdComplaints.length > 1
              ? `${createdComplaints.length} Complaints Submitted Successfully`
              : 'Complaint Submitted Successfully'}
          </h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Your report{createdComplaints.length > 1 ? 's have' : ' has'} been logged in Firestore
            and Campus Administration has been notified.
          </p>

          <div className="my-6 space-y-2.5">
            {createdComplaints.map((rec) => (
              <div
                key={rec.complaintId}
                className="p-4 rounded-xl bg-[#F7F9FC] border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-mono font-bold text-sm text-[#3867F5] tabular-nums">
                    {rec.complaintId}
                  </p>
                  <p className="font-semibold text-sm text-[#142B4A] truncate">{rec.title}</p>
                  <p className="text-xs text-slate-500">
                    {rec.studentName} ({rec.studentIdNumber}) · {rec.building} · {rec.location}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onSuccessTrack(rec.complaintId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3867F5] text-white text-xs font-semibold hover:bg-[#2955d9] cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                    Track
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadComplaintPdf(rec)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[#142B4A] text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    PDF
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setCreatedComplaints([])}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#3867F5] text-white text-sm font-semibold hover:bg-[#2955d9] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Report More Complaints
            </button>
            {onViewComplaints && (
              <button
                type="button"
                onClick={onViewComplaints}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-[#142B4A] text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <ClipboardList className="w-4 h-4" />
                View All My Complaints
              </button>
            )}
            <button
              type="button"
              onClick={() => onSuccessTrack(primary.complaintId)}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-[#142B4A] cursor-pointer"
            >
              Track Latest Issue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Go back to previous page"
              className="mb-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-[#142B4A] hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          )}
          <h2 className="font-display font-bold text-2xl text-[#142B4A] tracking-tight">
            Report Campus Issues
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Reporting under USN{' '}
            <span className="font-mono font-semibold text-[#142B4A]">{defaultStudentUsn}</span> ·
            Submit a single issue with photo or multiple complaints at once.
          </p>
        </div>

        {/* Single vs Multiple Mode Switcher */}
        <div className="inline-flex items-center p-1 rounded-xl bg-white border border-slate-200 self-start">
          <button
            type="button"
            onClick={() => {
              setEntryMode('single');
              setError(null);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              entryMode === 'single'
                ? 'bg-[#142B4A] text-white'
                : 'text-slate-600 hover:text-[#142B4A]'
            }`}
          >
            Single Complaint
          </button>
          <button
            type="button"
            onClick={() => {
              setEntryMode('multiple');
              setError(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              entryMode === 'multiple'
                ? 'bg-[#3867F5] text-white'
                : 'text-slate-600 hover:text-[#142B4A]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Multiple Complaints ({multiDrafts.length})
          </button>
        </div>
      </div>

      {entryMode === 'single' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitSingleComplaint(false);
          }}
          className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6"
        >
          {error && (
            <div className="p-3.5 rounded-lg bg-[#EF5350]/10 border border-[#EF5350]/25 text-sm text-[#B71C1C] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#EF5350]" />
              <span>{error}</span>
            </div>
          )}

          {storageWarning && (
            <div className="p-4 rounded-lg bg-[#F5A623]/10 border border-[#F5A623]/30 text-sm text-[#92400E] space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#F5A623]" />
                <span>{storageWarning}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void submitSingleComplaint(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#142B4A] text-white text-xs font-semibold hover:bg-[#1e3d66] cursor-pointer"
                >
                  Submit Complaint Without Photo
                </button>
                <button
                  type="button"
                  onClick={clearSelectedFile}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Remove Photo
                </button>
              </div>
            </div>
          )}

          <div className="p-4 rounded-xl bg-[#F7F9FC] border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                Student Name
              </label>
              <input
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                maxLength={VALIDATION_LIMITS.fullName.max}
                placeholder="Enter student name"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
              />
            </div>
            <UsnSelector
              value={reporterUsn}
              onChange={setReporterUsn}
              compact
              label="Student USN (Choose 001–500)"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
              Issue Title <span className="text-[#EF5350]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={VALIDATION_LIMITS.title.max}
              placeholder="e.g., Flickering overhead LED lights in Lab 302"
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                Category <span className="text-[#EF5350]">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-[#142B4A] bg-white focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
              >
                {COMPLAINT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                Priority Level <span className="text-[#EF5350]">*</span>
              </label>
              <div className="grid grid-cols-4 gap-1.5 p-1 rounded-lg bg-[#F7F9FC] border border-slate-200">
                {COMPLAINT_PRIORITIES.map((p) => {
                  const active = priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        active
                          ? p === 'Critical'
                            ? 'bg-[#EF5350] text-white'
                            : p === 'High'
                              ? 'bg-[#F5A623] text-white'
                              : 'bg-[#142B4A] text-white'
                          : 'text-slate-600 hover:text-[#142B4A]'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                Campus Building <span className="text-[#EF5350]">*</span>
              </label>
              <select
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-[#142B4A] bg-white focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
              >
                {CAMPUS_BUILDINGS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                Specific Location <span className="text-[#EF5350]">*</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={VALIDATION_LIMITS.location.max}
                placeholder="e.g., 3rd Floor, Room 302 near east window"
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
              Detailed Description <span className="text-[#EF5350]">*</span>
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={VALIDATION_LIMITS.description.max}
              placeholder="Describe the issue clearly, when it started, and any safety hazards..."
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
            />
            <p className="text-xs text-slate-400 mt-1 tabular-nums text-right">
              {description.length}/{VALIDATION_LIMITS.description.max}
            </p>
          </div>

          {/* Cohort Impact (1 - 500 Students) */}
          <div className="p-4 rounded-xl bg-[#F7F9FC] border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center justify-between text-xs font-semibold text-[#142B4A] mb-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#3867F5]" />
                  Affected Cohort Students (1–500)
                </span>
                <span className="font-mono text-[#3867F5] tabular-nums">
                  {affectedStudentsCount} student{affectedStudentsCount > 1 ? 's' : ''}
                </span>
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={affectedStudentsCount}
                onChange={(e) =>
                  setAffectedStudentsCount(
                    Math.min(500, Math.max(1, Number(e.target.value) || 1))
                  )
                }
                className="w-full px-3.5 py-2 rounded-lg border border-slate-200 bg-white font-mono text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                Affected USN Range / Batch{' '}
                <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={affectedUsnRange}
                onChange={(e) => setAffectedUsnRange(e.target.value)}
                maxLength={VALIDATION_LIMITS.affectedUsnRange.max}
                placeholder="e.g., 4AL25CS001 – 4AL25CS500"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-200 bg-white font-mono text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
              />
            </div>
          </div>

          {/* Drag & Drop Photo Upload */}
          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
              Upload Photograph{' '}
              <span className="text-slate-400 font-normal">
                (Optional · JPG, PNG, WEBP up to 5 MB)
              </span>
            </label>

            {!previewUrl ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const dropped = e.dataTransfer.files?.[0] || null;
                  handleFileSelection(dropped);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragActive
                    ? 'border-[#3867F5] bg-[#3867F5]/5'
                    : 'border-slate-200 hover:border-slate-300 bg-[#F7F9FC]'
                }`}
              >
                <UploadCloud className="w-8 h-8 text-[#3867F5] mx-auto mb-2.5" />
                <p className="text-sm font-semibold text-[#142B4A]">
                  Drag and drop an image here, or click to browse
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Clear photos help maintenance crews resolve issues faster
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleFileSelection(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl p-4 bg-[#F7F9FC] space-y-3">
                <div className="flex items-start gap-4">
                  <img
                    src={previewUrl}
                    alt="Complaint photograph preview"
                    className="w-24 h-24 rounded-lg object-cover border border-slate-200 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#142B4A]">
                      <ImagePlus className="w-4 h-4 text-[#3867F5] shrink-0" />
                      <span className="truncate">{selectedFile?.name}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 tabular-nums">
                      {selectedFile ? `${(selectedFile.size / 1024).toFixed(0)} KB` : ''}
                    </p>
                    {submitting && uploadProgress > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-slate-600 mb-1 tabular-nums">
                          <span>Uploading photograph...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full bg-[#3867F5] transition-all duration-150"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={clearSelectedFile}
                    disabled={submitting}
                    className="p-2 rounded-lg text-slate-500 hover:text-[#EF5350] hover:bg-white transition-colors cursor-pointer"
                    aria-label="Remove selected image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setEntryMode('multiple')}
              className="text-xs font-semibold text-[#3867F5] hover:underline cursor-pointer"
            >
              Need to submit multiple complaints at once? Switch to Multiple Complaints
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#3867F5] text-white text-sm font-semibold hover:bg-[#2955d9] disabled:opacity-60 transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Submitting Complaint...' : 'Submit Complaint'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmitMultiple} className="space-y-4">
          {error && (
            <div className="p-3.5 rounded-lg bg-[#EF5350]/10 border border-[#EF5350]/25 text-sm text-[#B71C1C] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#EF5350]" />
              <span>{error}</span>
            </div>
          )}

          {multiDrafts.map((draft, idx) => (
            <div
              key={draft.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="font-display font-bold text-base text-[#142B4A]">
                  Complaint #{idx + 1}
                </h3>
                {multiDrafts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMultiDraftCard(draft.id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[#EF5350] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                    Student Name
                  </label>
                  <input
                    type="text"
                    value={draft.studentName}
                    onChange={(e) => updateMultiDraft(draft.id, { studentName: e.target.value })}
                    placeholder="Student Full Name"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                    Student USN (001–500)
                  </label>
                  <input
                    type="text"
                    value={draft.studentIdNumber}
                    onChange={(e) =>
                      updateMultiDraft(draft.id, {
                        studentIdNumber: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="4AL25CS122"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                    Issue Title <span className="text-[#EF5350]">*</span>
                  </label>
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(e) => updateMultiDraft(draft.id, { title: e.target.value })}
                    maxLength={VALIDATION_LIMITS.title.max}
                    placeholder="e.g., Projector bulb dim in Seminar Hall 2"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                    Category
                  </label>
                  <select
                    value={draft.category}
                    onChange={(e) =>
                      updateMultiDraft(draft.id, {
                        category: e.target.value as ComplaintCategory,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-[#142B4A] bg-white focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                  >
                    {COMPLAINT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                    Building
                  </label>
                  <select
                    value={draft.building}
                    onChange={(e) => updateMultiDraft(draft.id, { building: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-[#142B4A] bg-white focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                  >
                    {CAMPUS_BUILDINGS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                    Specific Location <span className="text-[#EF5350]">*</span>
                  </label>
                  <input
                    type="text"
                    value={draft.location}
                    onChange={(e) => updateMultiDraft(draft.id, { location: e.target.value })}
                    maxLength={VALIDATION_LIMITS.location.max}
                    placeholder="Room / Floor / Area"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                    Priority &amp; Affected (1–500)
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={draft.priority}
                      onChange={(e) =>
                        updateMultiDraft(draft.id, {
                          priority: e.target.value as ComplaintPriority,
                        })
                      }
                      className="flex-1 px-2.5 py-2 rounded-lg border border-slate-200 text-sm text-[#142B4A] bg-white focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                    >
                      {COMPLAINT_PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={draft.affectedStudentsCount}
                      onChange={(e) =>
                        updateMultiDraft(draft.id, {
                          affectedStudentsCount: Math.min(
                            500,
                            Math.max(1, Number(e.target.value) || 1)
                          ),
                        })
                      }
                      title="Affected Students (1-500)"
                      className="w-20 px-2.5 py-2 rounded-lg border border-slate-200 font-mono text-sm text-[#142B4A] text-center focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                  Description <span className="text-[#EF5350]">*</span>
                </label>
                <textarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) => updateMultiDraft(draft.id, { description: e.target.value })}
                  maxLength={VALIDATION_LIMITS.description.max}
                  placeholder="Describe the campus issue in detail (min 10 characters)..."
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                />
              </div>
            </div>
          ))}

          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={addMultiDraftCard}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-[#F7F9FC] text-sm font-semibold text-[#142B4A] hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#3867F5]" />
              Add Another Complaint
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#3867F5] text-white text-sm font-semibold hover:bg-[#2955d9] disabled:opacity-60 transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
              {submitting
                ? 'Submitting All Complaints...'
                : `Submit All ${multiDrafts.length} Complaints`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
