/**
 * Client-side Time and Date formatting utilities for Vietnam timezone (GMT+7: Asia/Ho_Chi_Minh)
 * Ensures accurate real-time market display regardless of user device timezone or browser settings.
 */

export const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

export type MarketSessionStatus =
  | 'PRE_OPEN'
  | 'ATO'
  | 'CONTINUOUS_MORNING'
  | 'LUNCH_BREAK'
  | 'CONTINUOUS_AFTERNOON'
  | 'ATC'
  | 'PUT_THROUGH'
  | 'CLOSED';

export interface MarketSessionInfo {
  status: MarketSessionStatus;
  label: string;
  isOpen: boolean;
  canMatchOrders: boolean;
  closingTimeStr: string;
}

export function getVietnamTimeParts(date: Date = new Date()): { dayOfWeek: number; hours: number; minutes: number; seconds: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: VIETNAM_TIMEZONE,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  let weekdayStr = '';
  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  for (const p of parts) {
    if (p.type === 'weekday') weekdayStr = p.value;
    else if (p.type === 'hour') {
      const h = parseInt(p.value, 10);
      hours = h === 24 ? 0 : h;
    }
    else if (p.type === 'minute') minutes = parseInt(p.value, 10);
    else if (p.type === 'second') seconds = parseInt(p.value, 10);
  }

  const daysMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = daysMap[weekdayStr] ?? 0;
  return { dayOfWeek, hours, minutes, seconds };
}

export function getMarketSessionInfo(date: Date = new Date()): MarketSessionInfo {
  const { dayOfWeek, hours, minutes } = getVietnamTimeParts(date);
  const totalMinutes = hours * 60 + minutes;

  // Weekend: Saturday (6) or Sunday (0)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      status: 'CLOSED',
      label: 'ĐÓNG CỬA (Cuối tuần)',
      isOpen: false,
      canMatchOrders: false,
      closingTimeStr: '14:45:00',
    };
  }

  // Weekdays (Monday - Friday)
  // Before 08:30
  if (totalMinutes < 510) {
    return {
      status: 'CLOSED',
      label: 'CHƯA MỞ CỬA',
      isOpen: false,
      canMatchOrders: false,
      closingTimeStr: '14:45:00',
    };
  }

  // 08:30 - 09:00: Pre-open
  if (totalMinutes < 540) {
    return {
      status: 'PRE_OPEN',
      label: 'TIỀN MỞ CỬA (08:30 - 09:00)',
      isOpen: false,
      canMatchOrders: false,
      closingTimeStr: '14:45:00',
    };
  }

  // 09:00 - 09:15: ATO
  if (totalMinutes < 555) {
    return {
      status: 'ATO',
      label: 'PHIÊN ATO (09:00 - 09:15)',
      isOpen: true,
      canMatchOrders: true,
      closingTimeStr: '14:45:00',
    };
  }

  // 09:15 - 11:30: Continuous Morning
  if (totalMinutes < 690) {
    return {
      status: 'CONTINUOUS_MORNING',
      label: 'KHỚP LỆNH LIÊN TỤC (Sáng)',
      isOpen: true,
      canMatchOrders: true,
      closingTimeStr: '14:45:00',
    };
  }

  // 11:30 - 13:00: Lunch Break
  if (totalMinutes < 780) {
    return {
      status: 'LUNCH_BREAK',
      label: 'NGHỈ TRƯA (11:30 - 13:00)',
      isOpen: false,
      canMatchOrders: false,
      closingTimeStr: '11:30:00',
    };
  }

  // 13:00 - 14:30: Continuous Afternoon
  if (totalMinutes < 870) {
    return {
      status: 'CONTINUOUS_AFTERNOON',
      label: 'KHỚP LỆNH LIÊN TỤC (Chiều)',
      isOpen: true,
      canMatchOrders: true,
      closingTimeStr: '14:45:00',
    };
  }

  // 14:30 - 14:45: ATC
  if (totalMinutes < 885) {
    return {
      status: 'ATC',
      label: 'PHIÊN ATC (14:30 - 14:45)',
      isOpen: true,
      canMatchOrders: true,
      closingTimeStr: '14:45:00',
    };
  }

  // 14:45 - 15:00: Put-through
  if (totalMinutes < 900) {
    return {
      status: 'PUT_THROUGH',
      label: 'THỎA THUẬN (14:45 - 15:00)',
      isOpen: false,
      canMatchOrders: false,
      closingTimeStr: '14:45:00',
    };
  }

  // After 15:00: Closed
  return {
    status: 'CLOSED',
    label: 'ĐÃ ĐÓNG CỬA PHIÊN',
    isOpen: false,
    canMatchOrders: false,
    closingTimeStr: '14:45:00',
  };
}

export function getVietnamTimeString(date: Date | number | string = new Date()): string {
  const d = typeof date === 'object' ? date : new Date(date);
  return d.toLocaleTimeString('vi-VN', {
    timeZone: VIETNAM_TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function getVietnamTimeShort(date: Date | number | string = new Date()): string {
  const d = typeof date === 'object' ? date : new Date(date);
  return d.toLocaleTimeString('vi-VN', {
    timeZone: VIETNAM_TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getVietnamDateTimeString(date: Date | number | string = new Date()): string {
  const d = typeof date === 'object' ? date : new Date(date);
  return d.toLocaleString('vi-VN', {
    timeZone: VIETNAM_TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getVietnamDateString(date: Date | number | string = new Date()): string {
  const d = typeof date === 'object' ? date : new Date(date);
  return d.toLocaleDateString('vi-VN', {
    timeZone: VIETNAM_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
