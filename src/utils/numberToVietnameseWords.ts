/**
 * Vietnamese Number to Currency Words Converter & Money Formatter
 * VN-Quant Finance Utilities
 */

const DIGITS_TEXT = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

/**
 * Reads a 3-digit number block into Vietnamese words
 * @param num 3-digit number (0-999)
 * @param isLeadingGroup true if this is the highest group in the number
 */
function read3Digits(num: number, isLeadingGroup: boolean): string {
  const h = Math.floor(num / 100);
  const t = Math.floor((num % 100) / 10);
  const u = num % 10;

  if (num === 0) {
    return isLeadingGroup ? 'không' : '';
  }

  let result = '';

  // 1. Hundreds
  if (!isLeadingGroup || h > 0) {
    result += `${DIGITS_TEXT[h]} trăm `;
  }

  // 2. Tens
  if (t === 0) {
    if (!isLeadingGroup && h >= 0 && u > 0) {
      result += 'linh ';
    } else if (isLeadingGroup && h > 0 && u > 0) {
      result += 'linh ';
    }
  } else if (t === 1) {
    result += 'mười ';
  } else {
    result += `${DIGITS_TEXT[t]} mươi `;
  }

  // 3. Units
  if (u === 1) {
    if (t > 1) {
      result += 'mốt';
    } else {
      result += 'một';
    }
  } else if (u === 5) {
    if (t > 0) {
      result += 'lăm';
    } else {
      result += 'năm';
    }
  } else if (u === 4) {
    if (t > 1) {
      result += 'tư';
    } else {
      result += 'bốn';
    }
  } else if (u > 0) {
    result += DIGITS_TEXT[u];
  }

  return result.trim();
}

/**
 * Converts a positive number into full Vietnamese currency words
 * e.g. 150000000 -> "Một trăm năm mươi triệu đồng"
 * e.g. 71000000 -> "Bảy mươi mốt triệu đồng"
 * e.g. 1500000000 -> "Một tỷ năm trăm triệu đồng"
 */
export function numberToVietnameseWords(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  // Parse clean numeric string
  const numStr = typeof value === 'number' ? Math.floor(Math.abs(value)).toString() : value.toString().replace(/\D/g, '');
  if (!numStr || numStr === '0') {
    return 'Không đồng';
  }

  const num = BigInt(numStr);
  if (num === 0n) {
    return 'Không đồng';
  }

  // Split into 3-digit groups from right to left
  const groups: number[] = [];
  let tempStr = numStr;
  while (tempStr.length > 0) {
    const chunk = tempStr.slice(Math.max(0, tempStr.length - 3));
    groups.push(parseInt(chunk, 10));
    tempStr = tempStr.slice(0, Math.max(0, tempStr.length - 3));
  }

  const unitsScale = ['', 'nghìn', 'triệu', 'tỷ'];
  const wordsArray: string[] = [];

  for (let i = groups.length - 1; i >= 0; i--) {
    const groupVal = groups[i];
    const isLeading = i === groups.length - 1;

    if (groupVal > 0) {
      const groupText = read3Digits(groupVal, isLeading);
      // Scale calculation for large numbers (> 1 billion)
      const scaleIndex = i % 4;
      const billionMultiplier = Math.floor(i / 4);
      let scaleText = unitsScale[scaleIndex];

      if (scaleIndex === 0 && billionMultiplier > 0) {
        scaleText = 'tỷ'.repeat(billionMultiplier).split('').join(' ');
      }

      const combined = scaleText ? `${groupText} ${scaleText}` : groupText;
      wordsArray.push(combined);
    }
  }

  if (wordsArray.length === 0) {
    return 'Không đồng';
  }

  let finalWords = wordsArray.join(' ').trim().replace(/\s+/g, ' ');
  // Capitalize first character
  finalWords = finalWords.charAt(0).toUpperCase() + finalWords.slice(1) + ' đồng';

  return finalWords;
}

/**
 * Formats a number with dot (.) thousand separators
 * e.g. 150000000 -> "150.000.000"
 */
export function formatMoneyWithDots(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const cleanStr = value.toString().replace(/\D/g, '');
  if (!cleanStr) return '';
  return cleanStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Parses a dot-separated string into a raw integer number
 * e.g. "150.000.000" -> 150000000
 */
export function parseMoneyFromDots(formattedStr: string): number {
  if (!formattedStr) return 0;
  const clean = formattedStr.replace(/\D/g, '');
  const parsed = parseInt(clean, 10);
  return isNaN(parsed) ? 0 : parsed;
}
