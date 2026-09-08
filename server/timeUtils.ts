/**
 * Time and Date formatting utilities for Vietnam timezone (GMT+7: Asia/Ho_Chi_Minh)
 * Ensures consistency across Node.js server container environments (Render/Cloud Run/Docker)
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

/**
 * Checks if a given date is an official holiday when the Vietnam stock market (HOSE / HNX / UPCoM) is closed.
 * Pursuant to the Labor Code of Vietnam and official notices from the State Securities Commission (UBCKNN).
 */
export function isVietnamStockMarketClosed(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return false;

  const dayOfWeek = d.getDay();
  // Saturday (6) or Sunday (0)
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;

  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  const day = d.getDate(); // 1-31
  const ymd = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // 1. Tết Dương Lịch (01/01)
  if (month === 1 && day === 1) return true;
  if (month === 1 && day === 2 && new Date(year, 0, 1).getDay() === 0) return true; // Bù Chủ Nhật
  if (month === 1 && day === 3 && new Date(year, 0, 1).getDay() === 6) return true; // Bù Thứ Bảy

  // 2. Lễ 30/4 (Giải phóng Miền Nam) & 01/05 (Quốc tế Lao động)
  if ((month === 4 && day === 30) || (month === 5 && day === 1)) return true;
  if (month === 5 && (day === 2 || day === 3)) {
    const d304 = new Date(year, 3, 30);
    const d015 = new Date(year, 4, 1);
    if ((d304.getDay() === 6 || d304.getDay() === 0 || d015.getDay() === 6 || d015.getDay() === 0) && day <= 3) {
      return true;
    }
  }

  // 3. Quốc Khánh 02/09 (Nghỉ 2 ngày theo Luật Lao Động)
  // Ngày 02/09 luôn là ngày nghỉ lễ thị trường đóng cửa
  if (month === 9 && day === 2) return true;
  // Lịch nghỉ lễ 2/9 cụ thể các năm theo thông báo của UBCKNN/Bộ LĐ-TB&XH:
  const nationalDayHolidays = [
    '2024-09-02', '2024-09-03',
    '2025-09-01', '2025-09-02',
    '2026-08-31', '2026-09-01', '2026-09-02', // Năm 2026 nghỉ 31/08, 01/09, 02/09 - mở lại ngày 03/09
    '2027-09-02', '2027-09-03',
  ];
  if (nationalDayHolidays.includes(ymd)) return true;

  // 4. Giỗ Tổ Hùng Vương (10/03 Âm lịch)
  const gioToDates = [
    '2023-04-29', '2023-05-02', '2023-05-03',
    '2024-04-18',
    '2025-04-07',
    '2026-04-26', '2026-04-27',
    '2027-04-15',
  ];
  if (gioToDates.includes(ymd)) return true;

  // 5. Tết Nguyên Đán (Tết Âm Lịch)
  const tetRanges: [string, string][] = [
    ['2023-01-20', '2023-01-26'],
    ['2024-02-08', '2024-02-14'],
    ['2025-01-25', '2025-02-02'],
    ['2026-02-14', '2026-02-22'],
    ['2027-02-05', '2027-02-13'],
  ];
  for (const [start, end] of tetRanges) {
    if (ymd >= start && ymd <= end) return true;
  }

  return false;
}

export function getVietnamMarketHolidayName(date: Date = new Date()): string | null {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const ymd = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  if (month === 1 && day <= 3) return 'NGHỈ LỄ TẾT DƯƠNG LỊCH';
  if ((month === 4 && day >= 30) || (month === 5 && day <= 3)) return 'NGHỈ LỄ 30/4 & 1/5';
  if ((month === 8 && day === 31 && year === 2026) || (month === 9 && day <= 3)) return 'NGHỈ LỄ QUỐC KHÁNH 2/9';

  const gioToDates = ['2024-04-18', '2025-04-07', '2026-04-26', '2026-04-27', '2027-04-15'];
  if (gioToDates.includes(ymd)) return 'NGHỈ LỄ GIỖ TỔ HÙNG VƯƠNG';

  const tetRanges: [string, string][] = [
    ['2024-02-08', '2024-02-14'],
    ['2025-01-25', '2025-02-02'],
    ['2026-02-14', '2026-02-22'],
    ['2027-02-05', '2027-02-13'],
  ];
  for (const [start, end] of tetRanges) {
    if (ymd >= start && ymd <= end) return 'NGHỈ TẾT NGUYÊN ĐÁN';
  }

  return null;
}

export function getMarketSessionInfo(date: Date = new Date()): MarketSessionInfo {
  // Check Holiday closure
  const holidayName = getVietnamMarketHolidayName(date);
  if (holidayName && isVietnamStockMarketClosed(date)) {
    return {
      status: 'CLOSED',
      label: `${holidayName} (Thị trường đóng cửa)`,
      isOpen: false,
      canMatchOrders: false,
      closingTimeStr: '14:45:00',
    };
  }

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

/**
 * Checks if current Vietnam time falls within Quiet Hours (Night mode or Weekend silence)
 * Default: 21:30 to 08:30 (next morning), and Saturday/Sunday
 */
export function isVietnamQuietHours(
  options: {
    quietHoursEnabled?: boolean;
    quietHoursStart?: string; // e.g. "21:30" or "22:00"
    quietHoursEnd?: string;   // e.g. "08:30"
    quietWeekendEnabled?: boolean; // e.g. true
    date?: Date;
  } = {}
): { isQuiet: boolean; reason?: string; currentTimeStr: string } {
  const {
    quietHoursEnabled = true,
    quietHoursStart = '21:30',
    quietHoursEnd = '08:30',
    quietWeekendEnabled = true,
    date = new Date(),
  } = options;

  const { dayOfWeek, hours, minutes } = getVietnamTimeParts(date);
  const currentTotalMinutes = hours * 60 + minutes;
  const currentTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  if (!quietHoursEnabled) {
    return { isQuiet: false, currentTimeStr };
  }

  // Check Weekend (Sat = 6, Sun = 0)
  if (quietWeekendEnabled && (dayOfWeek === 0 || dayOfWeek === 6)) {
    const dayName = dayOfWeek === 0 ? 'Chủ Nhật' : 'Thứ Bảy';
    return {
      isQuiet: true,
      reason: `Cuối tuần (${dayName}) - Thị trường đóng cửa & Chế độ Im Lặng Ban Đêm/Nghỉ Lễ kích hoạt`,
      currentTimeStr,
    };
  }

  // Parse start & end times (HH:mm)
  const [startH, startM] = (quietHoursStart || '21:30').split(':').map((v) => parseInt(v, 10) || 0);
  const [endH, endM] = (quietHoursEnd || '08:30').split(':').map((v) => parseInt(v, 10) || 0);

  const startTotalMinutes = startH * 60 + startM;
  const endTotalMinutes = endH * 60 + endM;

  // If start > end (e.g. 21:30 -> 08:30 spans midnight)
  if (startTotalMinutes > endTotalMinutes) {
    if (currentTotalMinutes >= startTotalMinutes || currentTotalMinutes < endTotalMinutes) {
      return {
        isQuiet: true,
        reason: `Ban đêm (${currentTimeStr} nằm trong khung giờ yên lặng ${quietHoursStart} - ${quietHoursEnd} VN)`,
        currentTimeStr,
      };
    }
  } else {
    // start <= end (e.g. 01:00 -> 06:00)
    if (currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes) {
      return {
        isQuiet: true,
        reason: `Khung giờ yên lặng ban đêm (${currentTimeStr} nằm trong ${quietHoursStart} - ${quietHoursEnd} VN)`,
        currentTimeStr,
      };
    }
  }

  return { isQuiet: false, currentTimeStr };
}
