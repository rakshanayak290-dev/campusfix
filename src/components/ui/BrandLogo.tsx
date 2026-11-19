import { Wrench } from 'lucide-react';

interface BrandLogoProps {
  inverted?: boolean;
  onClick?: () => void;
}

export function BrandLogo({ inverted = false, onClick }: BrandLogoProps) {
  const content = (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <span
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          inverted ? 'bg-[#3867F5] text-white' : 'bg-[#142B4A] text-white'
        }`}
      >
        <Wrench className="w-4 h-4" />
      </span>
      <span
        className={`font-display font-bold text-lg tracking-tight ${
          inverted ? 'text-white' : 'text-[#142B4A]'
        }`}
      >
        CampusFix
      </span>
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3867F5] rounded-lg cursor-pointer"
      >
        {content}
      </button>
    );
  }

  return content;
}
