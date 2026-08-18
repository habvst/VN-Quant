import React, { useEffect, useState } from 'react';
import { formatMoneyWithDots, numberToVietnameseWords, parseMoneyFromDots } from '../utils/numberToVietnameseWords';

interface MoneyInputProps {
  id?: string;
  label?: string;
  value: number | string;
  onChange: (value: number, formatted: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  showWords?: boolean;
  showQuickPresets?: boolean;
  quickPresets?: { label: string; amount: number }[];
  textColor?: string;
  suffix?: string;
  disabled?: boolean;
  helpText?: string;
}

const DEFAULT_PRESETS = [
  { label: '+10 Tr', amount: 10_000_000 },
  { label: '+50 Tr', amount: 50_000_000 },
  { label: '+100 Tr', amount: 100_000_000 },
  { label: '+500 Tr', amount: 500_000_000 },
  { label: '+1 Tỷ', amount: 1_000_000_000 },
];

export const MoneyInput: React.FC<MoneyInputProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder = 'Nhập số tiền VNĐ...',
  className = '',
  inputClassName = '',
  showWords = true,
  showQuickPresets = false,
  quickPresets = DEFAULT_PRESETS,
  textColor = 'text-white',
  suffix = 'VNĐ',
  disabled = false,
  helpText,
}) => {
  const [displayValue, setDisplayValue] = useState<string>(() => formatMoneyWithDots(value));

  // Sync internal display when external value changes
  useEffect(() => {
    setDisplayValue(formatMoneyWithDots(value));
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const cleanDigits = rawVal.replace(/\D/g, '');
    const formatted = formatMoneyWithDots(cleanDigits);
    const numeric = parseMoneyFromDots(cleanDigits);

    setDisplayValue(formatted);
    onChange(numeric, formatted);
  };

  const handleAddPreset = (increment: number) => {
    const currentNum = parseMoneyFromDots(displayValue);
    const newNum = currentNum + increment;
    const formatted = formatMoneyWithDots(newNum);
    setDisplayValue(formatted);
    onChange(newNum, formatted);
  };

  const currentNumeric = parseMoneyFromDots(displayValue);
  const vietnameseWords = currentNumeric > 0 ? numberToVietnameseWords(currentNumeric) : '';

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="block text-gray-400 text-[11px] font-bold uppercase tracking-wider">
            {label}
          </label>
          {helpText && <span className="text-[10px] text-gray-500">{helpText}</span>}
        </div>
      )}

      {/* Input container */}
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full bg-[#050505] border border-gray-800 rounded p-2.5 font-mono font-bold text-sm tracking-wide transition outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 ${textColor} ${
            suffix ? 'pr-14' : ''
          } ${inputClassName}`}
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs font-mono font-bold text-gray-400 bg-gray-900/80 px-2 py-0.5 rounded border border-gray-800">
            {suffix}
          </div>
        )}
      </div>

      {/* Vietnamese words reflection banner */}
      {showWords && vietnameseWords && (
        <div className="flex items-start space-x-1.5 px-2.5 py-1.5 bg-blue-950/40 border border-blue-900/50 rounded text-[11px] font-mono animate-fadeIn">
          <span className="text-blue-400 font-bold shrink-0">Bằng chữ:</span>
          <span className="text-blue-200 font-semibold italic">{vietnameseWords}</span>
        </div>
      )}

      {/* Quick Add Presets if enabled */}
      {showQuickPresets && !disabled && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] text-gray-400 font-bold uppercase mr-1">Cộng nhanh:</span>
          {quickPresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handleAddPreset(preset.amount)}
              className="px-2 py-0.5 bg-gray-900 hover:bg-gray-800 hover:text-white border border-gray-800 rounded text-[10px] font-mono text-gray-300 transition"
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setDisplayValue('');
              onChange(0, '');
            }}
            className="px-2 py-0.5 bg-red-950/40 hover:bg-red-900/60 border border-red-900/40 rounded text-[10px] font-mono text-red-300 transition"
            title="Xóa về 0"
          >
            Về 0
          </button>
        </div>
      )}
    </div>
  );
};
