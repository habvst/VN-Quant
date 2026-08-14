import React from 'react';
import { Info } from 'lucide-react';

interface MetricTooltipProps {
  title: string;
  formula?: string;
  description: string;
  benchmark?: string;
  children: React.ReactNode;
}

export const MetricTooltip: React.FC<MetricTooltipProps> = ({
  title,
  formula,
  description,
  benchmark,
  children,
}) => {
  return (
    <div className="group relative inline-flex items-center cursor-help">
      {children}
      <Info className="w-3 h-3 ml-1 text-gray-500 group-hover:text-blue-400 transition shrink-0" />

      {/* Floating Popover Tooltip */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:flex flex-col w-64 p-2.5 bg-[#0b101e] border border-blue-500/50 rounded-md shadow-2xl z-[9999] text-left pointer-events-none backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-gray-800 pb-1 mb-1.5">
          <span className="text-[11px] font-bold text-white font-mono tracking-tight">{title}</span>
          <span className="text-[9px] text-blue-400 font-mono font-bold bg-blue-950/80 px-1.5 py-0.2 rounded border border-blue-800/60">
            QUANT METRIC
          </span>
        </div>

        {formula && (
          <div className="bg-black/60 p-1.5 rounded border border-gray-800 mb-1.5 font-mono text-[10px] text-amber-300">
            <code>{formula}</code>
          </div>
        )}

        <p className="text-[10px] text-gray-300 leading-relaxed font-sans mb-1.5">{description}</p>

        {benchmark && (
          <div className="text-[9px] font-mono text-emerald-400 border-t border-gray-800/80 pt-1 flex items-center justify-between">
            <span className="text-gray-400">Ngưỡng chuẩn:</span>
            <span className="font-bold">{benchmark}</span>
          </div>
        )}

        {/* Small arrow triangle */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-blue-500/50"></div>
      </div>
    </div>
  );
};
