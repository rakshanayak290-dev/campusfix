import { CheckCircle2, ClipboardCheck, Eye, Wrench } from 'lucide-react';
import type { ComplaintStatus } from '../types/campusfix';

const STAGES: {
  key: ComplaintStatus;
  label: string;
  subtitle: string;
  activeColor: string;
  ringColor: string;
  icon: typeof ClipboardCheck;
}[] = [
  {
    key: 'Submitted',
    label: 'Submitted',
    subtitle: 'Logged in system',
    activeColor: 'bg-[#142B4A] text-white',
    ringColor: 'ring-[#142B4A]/20',
    icon: ClipboardCheck,
  },
  {
    key: 'Under Review',
    label: 'Under Review',
    subtitle: 'Admin triage',
    activeColor: 'bg-[#F5A623] text-white',
    ringColor: 'ring-[#F5A623]/25',
    icon: Eye,
  },
  {
    key: 'In Progress',
    label: 'In Progress',
    subtitle: 'Team dispatched',
    activeColor: 'bg-[#3867F5] text-white',
    ringColor: 'ring-[#3867F5]/25',
    icon: Wrench,
  },
  {
    key: 'Resolved',
    label: 'Resolved',
    subtitle: 'Issue closed',
    activeColor: 'bg-[#16A36A] text-white',
    ringColor: 'ring-[#16A36A]/25',
    icon: CheckCircle2,
  },
];

export function ComplaintProgressTracker({ status }: { status: ComplaintStatus }) {
  const currentIndex = STAGES.findIndex((s) => s.key === status);

  return (
    <div className="w-full py-2">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-0 relative">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isActive = idx <= currentIndex;

          return (
            <div key={stage.key} className="relative flex sm:flex-col items-center sm:items-center gap-3 sm:gap-2.5">
              {/* Connector line on desktop */}
              {idx < STAGES.length - 1 && (
                <div
                  className={`hidden sm:block absolute top-5 left-1/2 w-full h-0.5 transition-colors duration-200 ${
                    idx < currentIndex ? 'bg-[#16A36A]' : 'bg-slate-200'
                  }`}
                  aria-hidden="true"
                />
              )}

              <div
                className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                  isCurrent
                    ? `${stage.activeColor} ring-4 ${stage.ringColor}`
                    : isCompleted
                      ? 'bg-[#16A36A] text-white'
                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>

              <div className="sm:text-center min-w-0">
                <p
                  className={`text-xs font-semibold tracking-wide uppercase ${
                    isActive ? 'text-[#142B4A]' : 'text-slate-400'
                  }`}
                >
                  {stage.label}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{stage.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
