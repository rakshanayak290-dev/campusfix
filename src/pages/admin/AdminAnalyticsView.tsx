import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES,
  type ComplaintRecord,
} from '../../types/campusfix';

const CHART_COLORS = [
  '#3867F5',
  '#142B4A',
  '#32C5F4',
  '#16A36A',
  '#F5A623',
  '#EF5350',
  '#6366F1',
  '#0EA5E9',
];

export function AdminAnalyticsView({
  complaints,
  compact = false,
}: {
  complaints: ComplaintRecord[];
  compact?: boolean;
}) {
  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; total: number; resolved: number; pending: number }>();

    complaints.forEach((c) => {
      const dt = c.createdAt || new Date();
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const label = dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const existing = map.get(key) || { month: label, total: 0, resolved: 0, pending: 0 };
      existing.total += 1;
      if (c.status === 'Resolved') {
        existing.resolved += 1;
      } else {
        existing.pending += 1;
      }
      map.set(key, existing);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [complaints]);

  const categoryData = useMemo(() => {
    return COMPLAINT_CATEGORIES.map((cat) => ({
      name: cat.replace(' Maintenance', '').replace(' Connectivity', '').replace(' Cleanliness', ''),
      fullName: cat,
      count: complaints.filter((c) => c.category === cat).length,
    })).filter((d) => d.count > 0);
  }, [complaints]);

  const pendingVsResolvedData = useMemo(() => {
    const submitted = complaints.filter((c) => c.status === 'Submitted').length;
    const review = complaints.filter((c) => c.status === 'Under Review').length;
    const progress = complaints.filter((c) => c.status === 'In Progress').length;
    const resolved = complaints.filter((c) => c.status === 'Resolved').length;
    return [
      { stage: 'Submitted', count: submitted, fill: '#142B4A' },
      { stage: 'Under Review', count: review, fill: '#F5A623' },
      { stage: 'In Progress', count: progress, fill: '#3867F5' },
      { stage: 'Resolved', count: resolved, fill: '#16A36A' },
    ];
  }, [complaints]);

  const priorityData = useMemo(() => {
    return COMPLAINT_PRIORITIES.map((p) => ({
      priority: p,
      count: complaints.filter((c) => c.priority === p).length,
    }));
  }, [complaints]);

  const resolutionMetrics = useMemo(() => {
    const resolvedList = complaints.filter((c) => c.status === 'Resolved');
    const rate =
      complaints.length > 0 ? Math.round((resolvedList.length / complaints.length) * 100) : 0;

    let totalHours = 0;
    let measured = 0;
    resolvedList.forEach((c) => {
      if (c.createdAt && c.updatedAt) {
        const diffHrs = Math.max(0.1, (c.updatedAt.getTime() - c.createdAt.getTime()) / 3600000);
        totalHours += diffHrs;
        measured += 1;
      }
    });
    const avgHours = measured > 0 ? (totalHours / measured).toFixed(1) : '—';

    return {
      resolutionRate: `${rate}%`,
      avgHours: measured > 0 ? `${avgHours} hrs` : 'No resolved data',
      resolvedCount: resolvedList.length,
    };
  }, [complaints]);

  if (complaints.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
        <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h3 className="font-display font-semibold text-base text-[#142B4A]">
          No analytics data yet
        </h3>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          Charts will populate automatically from live Firestore complaints as students report
          issues across campus.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!compact && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">Resolution Rate</p>
            <p className="font-display font-bold text-3xl text-[#16A36A] tabular-nums mt-1">
              {resolutionMetrics.resolutionRate}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">Avg. Resolution Time</p>
            <p className="font-display font-bold text-3xl text-[#142B4A] tabular-nums mt-1">
              {resolutionMetrics.avgHours}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">Completed Tickets</p>
            <p className="font-display font-bold text-3xl text-[#3867F5] tabular-nums mt-1">
              {resolutionMetrics.resolvedCount}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Complaint Statistics */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="font-display font-bold text-base text-[#142B4A] mb-1">
            Monthly Complaint Statistics
          </h3>
          <p className="text-xs text-slate-500 mb-5">
            Pending vs. resolved complaint volume over time
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="pending" name="Pending / Active" fill="#F5A623" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resolved" name="Resolved" fill="#16A36A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category-wise Distribution */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="font-display font-bold text-base text-[#142B4A] mb-1">
            Category-Wise Distribution
          </h3>
          <p className="text-xs text-slate-500 mb-5">
            Breakdown of reported issues by facility category
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="count"
                  nameKey="fullName"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {categoryData.map((entry, idx) => (
                    <Cell key={entry.fullName} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Resolution Performance by Stage */}
        {!compact && (
          <>
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h3 className="font-display font-bold text-base text-[#142B4A] mb-1">
                Pending vs. Resolved Pipeline
              </h3>
              <p className="text-xs text-slate-500 mb-5">
                Current ticket counts across the 4 resolution stages
              </p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pendingVsResolvedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="stage" tick={{ fontSize: 12, fill: '#64748B' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Complaints" radius={[4, 4, 0, 0]}>
                      {pendingVsResolvedData.map((item) => (
                        <Cell key={item.stage} fill={item.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h3 className="font-display font-bold text-base text-[#142B4A] mb-1">
                Priority Severity Breakdown
              </h3>
              <p className="text-xs text-slate-500 mb-5">
                Distribution of Low, Medium, High, and Critical requests
              </p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="priority" tick={{ fontSize: 12, fill: '#64748B' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Issues" fill="#3867F5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
