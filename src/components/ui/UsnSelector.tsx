import React, { useMemo } from 'react';

interface UsnSelectorProps {
  value: string;
  onChange: (nextUsn: string) => void;
  compact?: boolean;
  label?: string;
}

const ADMISSION_YEARS = ['22', '23', '24', '25', '26'];
const BRANCH_CODES = [
  { code: 'CS', name: 'CSE' },
  { code: 'IS', name: 'ISE' },
  { code: 'AI', name: 'AIML' },
  { code: 'CD', name: 'CSD' },
  { code: 'EC', name: 'ECE' },
  { code: 'EE', name: 'EEE' },
  { code: 'ME', name: 'MECH' },
  { code: 'CV', name: 'CIVIL' },
  { code: 'AG', name: 'AGRI' },
];

const ROLL_NUMBERS = Array.from({ length: 500 }, (_, i) => String(i + 1).padStart(3, '0'));

export function parseUsn(raw: string): { year: string; branch: string; roll: string } {
  const cleaned = raw.trim().toUpperCase();
  const match = cleaned.match(/^4AL(\d{2})([A-Z]{2})(\d{3})$/);
  if (match) {
    return {
      year: match[1],
      branch: match[2],
      roll: match[3],
    };
  }
  return {
    year: '25',
    branch: 'CS',
    roll: '122',
  };
}

export function UsnSelector({
  value,
  onChange,
  compact = false,
  label = 'Student USN (Alva’s Institute of Engineering & Technology)',
}: UsnSelectorProps) {
  const parsed = useMemo(() => parseUsn(value || '4AL25CS122'), [value]);

  const updatePart = (part: 'year' | 'branch' | 'roll', nextVal: string) => {
    const nextYear = part === 'year' ? nextVal : parsed.year;
    const nextBranch = part === 'branch' ? nextVal : parsed.branch;
    const nextRoll = part === 'roll' ? nextVal : parsed.roll;
    onChange(`4AL${nextYear}${nextBranch}${nextRoll}`);
  };

  const handleManualRollChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 3);
    const padded = digitsOnly.padStart(3, '0');
    onChange(`4AL${parsed.year}${parsed.branch}${padded}`);
  };

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label className="block text-xs font-semibold text-[#142B4A]">{label}</label>
          <span className="font-mono text-xs font-bold text-[#3867F5] tabular-nums">
            {`4AL${parsed.year}${parsed.branch}${parsed.roll}`}
          </span>
        </div>
      )}

      <div className={`grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {/* Fixed Institute Code */}
        <div className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-mono font-semibold text-[#142B4A] flex items-center justify-between">
          <span className="text-[11px] font-sans font-normal text-slate-500">Inst.</span>
          <span>4AL</span>
        </div>

        {/* Year */}
        <select
          aria-label="Admission Year"
          value={parsed.year}
          onChange={(e) => updatePart('year', e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-mono text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
        >
          {ADMISSION_YEARS.map((yr) => (
            <option key={yr} value={yr}>
              20{yr} ({yr})
            </option>
          ))}
        </select>

        {/* Branch */}
        <select
          aria-label="Branch Code"
          value={parsed.branch}
          onChange={(e) => updatePart('branch', e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-mono text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
        >
          {BRANCH_CODES.map((b) => (
            <option key={b.code} value={b.code}>
              {b.code} ({b.name})
            </option>
          ))}
        </select>

        {/* Last 3 Digits Selector */}
        <select
          aria-label="Choose last 3 digits of USN"
          value={ROLL_NUMBERS.includes(parsed.roll) ? parsed.roll : 'custom'}
          onChange={(e) => {
            if (e.target.value !== 'custom') {
              updatePart('roll', e.target.value);
            }
          }}
          className="px-3 py-2 rounded-lg border border-[#3867F5]/40 bg-white text-sm font-mono font-semibold text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
        >
          {ROLL_NUMBERS.map((num) => (
            <option key={num} value={num}>
              {num}{num === '122' ? ' (4AL25CS122)' : ''}
            </option>
          ))}
          {!ROLL_NUMBERS.includes(parsed.roll) && (
            <option value="custom">{parsed.roll} (Custom)</option>
          )}
        </select>
      </div>

      {/* Direct 3-digit quick input option */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>Select or enter last 3 digits (001–500; custom up to 999):</span>
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={3}
            value={parsed.roll}
            onChange={handleManualRollChange}
            aria-label="Enter last 3 digits of USN"
            className="w-20 px-2.5 py-1 rounded-md border border-slate-200 bg-white font-mono text-xs font-semibold text-[#142B4A] text-center focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
          />
          {parsed.roll !== '122' && (
            <button
              type="button"
              onClick={() => onChange('4AL25CS122')}
              className="text-xs font-semibold text-[#3867F5] hover:underline cursor-pointer"
            >
              Use 4AL25CS122
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
