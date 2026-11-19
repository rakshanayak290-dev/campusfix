import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Flag,
  Wrench,
} from 'lucide-react';
import type { ComplaintPriority, ComplaintStatus } from '../../types/campusfix';

export function StatusText({ status }: { status: ComplaintStatus }) {
  switch (status) {
    case 'Submitted':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#142B4A] whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-[#3867F5]" />
          <span>Submitted</span>
        </span>
      );
    case 'Under Review':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B45309] whitespace-nowrap">
          <Eye className="w-3.5 h-3.5 text-[#F5A623]" />
          <span>Under Review</span>
        </span>
      );
    case 'In Progress':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4ED8] whitespace-nowrap">
          <Wrench className="w-3.5 h-3.5 text-[#3867F5]" />
          <span>In Progress</span>
        </span>
      );
    case 'Resolved':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#15803D] whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#16A36A]" />
          <span>Resolved</span>
        </span>
      );
  }
}

export function PriorityText({ priority }: { priority: ComplaintPriority }) {
  switch (priority) {
    case 'Low':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
          <Flag className="w-3.5 h-3.5 text-slate-400" />
          <span>Low</span>
        </span>
      );
    case 'Medium':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4ED8] whitespace-nowrap">
          <Flag className="w-3.5 h-3.5 text-[#3867F5]" />
          <span>Medium</span>
        </span>
      );
    case 'High':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B45309] whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 text-[#F5A623]" />
          <span>High</span>
        </span>
      );
    case 'Critical':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C62828] whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5 text-[#EF5350]" />
          <span>Critical</span>
        </span>
      );
  }
}
