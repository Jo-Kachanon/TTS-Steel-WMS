import { InventoryItem, QuotationItem } from '../types/wms';

const PDFJS_VERSION = '3.11.174';
const PDFJS_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

interface PdfTextItem { str?: string }
interface PdfPage { getTextContent: () => Promise<{ items: PdfTextItem[] }> }
interface PdfDocument { numPages: number; getPage: (pageNumber: number) => Promise<PdfPage> }
interface PdfJsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (source: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> };
}

export interface ParsedQuotation {
  quotationNo: string;
  quotationDate: string;
  validUntil: string;
  expectedDeliveryDate: string;
  customerName: string;
  items: QuotationItem[];
  hasTextLayer: boolean;
}

let pdfJsPromise: Promise<PdfJsLib> | null = null;

/** Loads pdf.js on demand; the mock has no bundler dependency for it. */
const loadPdfJs = (): Promise<PdfJsLib> => {
  const existing = (window as unknown as { pdfjsLib?: PdfJsLib }).pdfjsLib;
  if (existing) return Promise.resolve(existing);
  if (pdfJsPromise) return pdfJsPromise;
  pdfJsPromise = new Promise<PdfJsLib>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${PDFJS_BASE}/pdf.min.js`;
    script.onload = () => {
      const lib = (window as unknown as { pdfjsLib?: PdfJsLib }).pdfjsLib;
      if (!lib) {
        reject(new Error('pdf.js loaded without pdfjsLib'));
        return;
      }
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.js`;
      resolve(lib);
    };
    script.onerror = () => {
      pdfJsPromise = null;
      reject(new Error('pdf.js could not be loaded'));
    };
    document.head.appendChild(script);
  });
  return pdfJsPromise;
};

const extractPdfText = async (file: File): Promise<string> => {
  const lib = await loadPdfJs();
  const document = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str || '').join(' '));
  }
  return pages.join('\n').replace(/\s+/g, ' ');
};

/** Header values are blank lines of underscores in an unfilled template; treat those as empty. */
const cleanValue = (value: string | undefined): string => {
  const trimmed = (value || '').trim();
  return /^[_.\s/-]*$/.test(trimmed) ? '' : trimmed;
};

const matchField = (text: string, pattern: RegExp): string => cleanValue(text.match(pattern)?.[1]);

/** Accepts dd/mm/yyyy (Buddhist or Gregorian year) or yyyy-mm-dd and returns yyyy-mm-dd. */
const toIsoDate = (value: string): string => {
  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const dmy = value.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/);
  if (!dmy) return '';
  const year = Number(dmy[3]) > 2400 ? Number(dmy[3]) - 543 : Number(dmy[3]);
  return `${year}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
};

/**
 * Item rows in the TTS quotation template read as:
 * no · product code · description · thick · width · length · coil/lot · whse · qty · unit · unit price · amount
 */
const ITEM_ROW = /(?:^|\s)(\d{1,2})\s+([A-Z][A-Z0-9/]*(?:\s*-\s*\d+)?(?:\s*·\s*\d+)?)\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\S+)\s+([A-Z]{1,3}\d{3,}[A-Z0-9-]*)\s+([A-Z]\d{1,3})\s+([\d,]+\.\d+)\s+(kg\.?|KGS\.?|ตัน|TON|PCS\.?)/gi;

const parseItems = (text: string): QuotationItem[] => {
  const start = text.search(/Product\s*&\s*Price/i);
  const end = text.search(/Total Net Weight/i);
  const section = start >= 0 ? text.slice(start, end > start ? end : undefined) : text;
  return [...section.matchAll(ITEM_ROW)].map((row) => ({
    lineNo: Number(row[1]),
    productCode: row[2].replace(/\s+/g, ' ').trim(),
    description: row[3].trim(),
    lotNo: row[7],
    warehouse: row[8],
    qty: Number(row[9].replace(/,/g, '')),
    unit: row[10].replace('.', '').toLowerCase(),
  }));
};

export const parseQuotationText = (text: string): ParsedQuotation => ({
  quotationNo: matchField(text, /Quotation No\.\s+(.+?)\s+เลขที่แก้ไข/),
  quotationDate: toIsoDate(matchField(text, /Quotation Date\s+(.+?)\s+ยืนราคา/)),
  validUntil: toIsoDate(matchField(text, /Valid Until\s+(.+?)\s+เลขที่ค/)),
  expectedDeliveryDate: toIsoDate(matchField(text, /Expected Deli\s*\.?\s*Date\s+(.+?)\s+\d\s*\./)),
  customerName: matchField(text, /Customer Name\s+(.+?)\s+บริษัท/),
  items: parseItems(text),
  hasTextLayer: text.trim().length > 0,
});

export const readQuotationPdf = async (file: File): Promise<ParsedQuotation> => {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return { quotationNo: '', quotationDate: '', validUntil: '', expectedDeliveryDate: '', customerName: '', items: [], hasTextLayer: false };
  }
  return parseQuotationText(await extractPdfText(file));
};

const normalizeLot = (value: string): string => value.replace(/[\s-]/g, '').toUpperCase();

/** Maps each quotation line to a booked lot by lot, coil or heat number. */
export const matchQuotationItems = (items: QuotationItem[], bookedLots: InventoryItem[]): QuotationItem[] =>
  items.map((line) => {
    const key = normalizeLot(line.lotNo);
    const match = bookedLots.find((lot) =>
      [lot.id, lot.lotNumber, lot.heatNumber, lot.sourceLotId || ''].some((candidate) => candidate && normalizeLot(candidate).startsWith(key)));
    return { ...line, matchedLotId: match?.id };
  });

/** Fallback when the PDF has no readable item table (e.g. a scanned signed copy): one line per booked lot. */
export const quotationItemsFromBooking = (bookedLots: InventoryItem[]): QuotationItem[] =>
  bookedLots.map((lot, index) => ({
    lineNo: index + 1,
    productCode: lot.productCode,
    description: lot.productName,
    lotNo: lot.lotNumber,
    warehouse: lot.locationBay,
    qty: lot.totalWeightTons,
    unit: 'ตัน',
    matchedLotId: lot.id,
  }));
