/**
 * Vector Code-128 & EAN Barcode Generator Utility
 * Generates crisp SVG representation of standard barcodes without external heavy dependencies.
 */

// Code 128B character patterns (values 0-106)
// Each pattern represents widths of 3 bars and 3 spaces (sum = 11 modules), stop is 13 modules.
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106 (106 is STOP)
];

const START_CODE_B = 104;
const STOP_CODE = 106;

/**
 * Encodes string to Code 128B module widths
 */
export function encodeCode128(text: string): string {
  if (!text) text = '000000';
  
  // Convert text characters to code 128B values (ASCII 32 to 126 -> value 0 to 94)
  const values: number[] = [START_CODE_B];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 32 && code <= 126) {
      values.push(code - 32);
    } else {
      values.push(0); // space fallback
    }
  }

  // Calculate Checksum
  let checksum = values[0];
  for (let i = 1; i < values.length; i++) {
    checksum += values[i] * i;
  }
  values.push(checksum % 103);
  values.push(STOP_CODE);

  // Convert values to bar/space widths string
  let patternString = '';
  for (const val of values) {
    patternString += CODE128_PATTERNS[val] || CODE128_PATTERNS[0];
  }

  return patternString;
}

export interface BarcodeSvgOptions {
  height?: number;
  barWidth?: number;
  showText?: boolean;
  textColor?: string;
  barColor?: string;
  fontSize?: number;
}

/**
 * Generates an SVG string representation of Code128 barcode
 */
export function generateBarcodeSvg(text: string, options: BarcodeSvgOptions = {}): string {
  const {
    height = 40,
    barWidth = 1.6,
    showText = false,
    barColor = '#000000',
  } = options;

  const cleanText = text.trim() || '000000';
  const pattern = encodeCode128(cleanText);

  let currentX = 10; // Quiet zone
  const rects: string[] = [];

  let isBar = true;
  for (let i = 0; i < pattern.length; i++) {
    const width = parseInt(pattern[i], 10) * barWidth;
    if (isBar) {
      rects.push(`<rect x="${currentX.toFixed(1)}" y="0" width="${width.toFixed(1)}" height="${height}" fill="${barColor}" />`);
    }
    currentX += width;
    isBar = !isBar;
  }

  const totalWidth = currentX + 10; // Extra quiet zone

  return `
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 ${totalWidth} ${height}" 
      width="100%" 
      height="${height}"
      preserveAspectRatio="none"
      shape-rendering="crispEdges"
      style="display: block; margin: 0 auto;"
    >
      ${rects.join('')}
    </svg>
  `.trim();
}

/**
 * Generates a random valid 12-13 digit apparel EAN/Barcode number
 */
export function generateRandomBarcode(): string {
  // Iran EAN prefix 626 + 9 random digits + check digit
  const prefix = '626';
  let digits = prefix;
  for (let i = 0; i < 9; i++) {
    digits += Math.floor(Math.random() * 10);
  }

  // Calculate EAN-13 check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return digits + checkDigit;
}
