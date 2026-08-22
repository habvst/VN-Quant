/**
 * Time and Date formatting utilities for Vietnam timezone (GMT+7: Asia/Ho_Chi_Minh)
 * Ensures consistency across Node.js server container environments (Render/Cloud Run/Docker)
 */

export const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

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
