import { X } from 'lucide-react';

type LabelChipProps = {
  name: string;
  color: string;
  onRemove?: () => void;
};

export default function LabelChip({ name, color, onRemove }: LabelChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight"
      style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-80"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
