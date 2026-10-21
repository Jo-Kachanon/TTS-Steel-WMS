import React, { useState } from 'react';
import { BookingQuotation, InventoryItem, QuotationItem } from '../../../types/wms';
import { matchQuotationItems, quotationItemsFromBooking, readQuotationPdf } from '../../../utils/quotationPdf';
import { INPUT_CLASS, LABEL_CLASS, bayLabel } from './bookingUi';

type QuotationDraft = Omit<BookingQuotation, 'uploadedAt'>;

const INLINE_FILE_LIMIT_BYTES = 1.5 * 1024 * 1024;

interface QuotationAttachFormProps {
  bookedLots: InventoryItem[];
  /** Latest date the warehouse said all lots can be ready; used for the mock delivery date. */
  earliestReadyDate?: string;
  onAttach: (quotation: BookingQuotation) => boolean;
}

const emptyDraft = (bookedLots: InventoryItem[]): QuotationDraft => ({
  quotationNo: '', quotationDate: '', validUntil: '', expectedDeliveryDate: '', customerConfirmed: false,
  fileName: '', fileSizeBytes: 0, prefillSource: 'BOOKING', items: quotationItemsFromBooking(bookedLots),
});

/** Sales attaches the customer-confirmed quotation; header and items are prefilled from the PDF text, else from the booked lots. */
const isoDatePlus = (days: number, from = new Date()): string => {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

/**
 * Mock header values for the demo, used only where the file gave none:
 * quotation valid 3 days (TTS terms) and delivery no earlier than the warehouse ready date.
 */
const mockHeader = (earliestReadyDate?: string) => {
  const today = new Date();
  const minimumDelivery = isoDatePlus(3, today);
  return {
    quotationNo: `QT-${today.getFullYear() + 543}-${String(today.getTime()).slice(-4)}`,
    quotationDate: today.toISOString().slice(0, 10),
    validUntil: isoDatePlus(3, today),
    // Staging is due one day before delivery, so delivery is at least one day after the warehouse ready date.
    expectedDeliveryDate: earliestReadyDate && isoDatePlus(1, new Date(`${earliestReadyDate}T00:00:00`)) > minimumDelivery ? isoDatePlus(1, new Date(`${earliestReadyDate}T00:00:00`)) : minimumDelivery,
  };
};

export const QuotationAttachForm: React.FC<QuotationAttachFormProps> = ({ bookedLots, earliestReadyDate, onAttach }) => {
  const [draft, setDraft] = useState<QuotationDraft>(() => emptyDraft(bookedLots));
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState('');

  const update = (patch: Partial<QuotationDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    update({ fileName: file.name, fileSizeBytes: file.size, fileDataUrl: undefined });
    if (file.size <= INLINE_FILE_LIMIT_BYTES) {
      const reader = new FileReader();
      reader.onload = () => update({ fileDataUrl: String(reader.result) });
      reader.readAsDataURL(file);
    }
    setReading(true);
    try {
      const parsed = await readQuotationPdf(file);
      const items = parsed.items.length ? matchQuotationItems(parsed.items, bookedLots) : quotationItemsFromBooking(bookedLots);
      const mock = mockHeader(earliestReadyDate);
      setDraft((current) => ({
        ...current,
        quotationNo: parsed.quotationNo || current.quotationNo || mock.quotationNo,
        quotationDate: parsed.quotationDate || current.quotationDate || mock.quotationDate,
        validUntil: parsed.validUntil || current.validUntil || mock.validUntil,
        expectedDeliveryDate: parsed.expectedDeliveryDate || current.expectedDeliveryDate || mock.expectedDeliveryDate,
        prefillSource: parsed.items.length ? 'PDF' : 'BOOKING',
        items,
      }));
      setReadNote(parsed.items.length
        ? `อ่านจากไฟล์ได้ ${parsed.items.length} รายการ${parsed.quotationNo ? '' : ' · หัวเอกสารในไฟล์ว่าง ระบบเติมเลขที่และวันที่จำลองให้ ตรวจแล้วแก้ได้'}`
        : parsed.hasTextLayer ? 'ไม่พบตารางสินค้าในไฟล์ ใช้รายการจากล็อตที่จองแทน' : 'ไฟล์ไม่มีข้อความให้อ่าน (เช่น ไฟล์สแกน) ใช้รายการจากล็อตที่จองแทน');
    } catch {
      const mock = mockHeader(earliestReadyDate);
      setReadNote('อ่านไฟล์ไม่สำเร็จ ใช้รายการจากล็อตที่จองและวันที่จำลองแทน');
      setDraft((current) => ({
        ...current,
        quotationNo: current.quotationNo || mock.quotationNo,
        quotationDate: current.quotationDate || mock.quotationDate,
        validUntil: current.validUntil || mock.validUntil,
        expectedDeliveryDate: current.expectedDeliveryDate || mock.expectedDeliveryDate,
        prefillSource: 'BOOKING',
        items: quotationItemsFromBooking(bookedLots),
      }));
    } finally {
      setReading(false);
    }
  };

  const matchedLotIds = new Set(draft.items.map((line) => line.matchedLotId).filter(Boolean));
  const lotsMissingFromQuotation = bookedLots.filter((lot) => !matchedLotIds.has(lot.id));
  const canAttach = !reading && draft.fileName && draft.quotationNo.trim() && draft.expectedDeliveryDate && draft.customerConfirmed;

  return (
    <div className="mt-3 grid gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 sm:grid-cols-2">
      <div className="text-xs font-semibold sm:col-span-2">แนบใบเสนอราคาที่ลูกค้ายืนยันสั่งซื้อ · ระบบกรอกข้อมูลจากไฟล์ให้</div>
      <label className={`${LABEL_CLASS} sm:col-span-2`}>ไฟล์ใบเสนอราคา (PDF หรือรูปภาพ)
        <input type="file" accept="application/pdf,image/*" onChange={(event) => void handleFile(event.target.files?.[0])} className={INPUT_CLASS} />
      </label>
      {(reading || readNote) && <p className="text-[11px] text-amber-200 sm:col-span-2">{reading ? 'กำลังอ่านข้อมูลจากไฟล์…' : readNote}</p>}
      <label className={LABEL_CLASS}>เลขที่ใบเสนอราคา (Quotation No.)<input value={draft.quotationNo} onChange={(event) => update({ quotationNo: event.target.value })} className={INPUT_CLASS} /></label>
      <label className={LABEL_CLASS}>วันที่ใบเสนอราคา<input type="date" value={draft.quotationDate} onChange={(event) => update({ quotationDate: event.target.value })} className={INPUT_CLASS} /></label>
      <label className={LABEL_CLASS}>ยืนราคาถึงวันที่ (Valid Until)<input type="date" value={draft.validUntil} onChange={(event) => update({ validUntil: event.target.value })} className={INPUT_CLASS} /></label>
      <label className={LABEL_CLASS}>วันที่ส่งมอบตามใบเสนอราคา (Expected Delivery Date)<input type="date" value={draft.expectedDeliveryDate} onChange={(event) => update({ expectedDeliveryDate: event.target.value })} className={INPUT_CLASS} /></label>
      <p className="text-[10px] text-[var(--text-secondary)] sm:col-span-2">คลังต้องวางสินค้าที่ประตูก่อนวันส่ง 1 วัน · หลังแนบแล้วแก้วันส่งไม่ได้</p>
      <QuotationItemsTable items={draft.items} source={draft.prefillSource} />
      {lotsMissingFromQuotation.length > 0 && (
        <p className="text-[11px] text-rose-300 sm:col-span-2">ล็อตที่จองแต่ไม่อยู่ในใบเสนอราคา: {lotsMissingFromQuotation.map((lot) => lot.id).join(', ')}</p>
      )}
      <label className={`${LABEL_CLASS} flex items-center gap-2 sm:col-span-2`}>
        <input type="checkbox" checked={draft.customerConfirmed} onChange={(event) => update({ customerConfirmed: event.target.checked })} />
        ลูกค้าเลือก “ยืนยันสั่งซื้อ” และลงนามในใบเสนอราคาแล้ว
      </label>
      <button disabled={!canAttach} onClick={() => onAttach({ ...draft, uploadedAt: new Date().toISOString() })} className="rounded bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40 sm:col-span-2">แนบใบเสนอราคา</button>
    </div>
  );
};

export const QuotationItemsTable: React.FC<{ items: QuotationItem[]; source: BookingQuotation['prefillSource'] }> = ({ items, source }) => (
  <div className="overflow-x-auto sm:col-span-2">
    <div className="mb-1 text-[11px] text-[var(--text-secondary)]">รายการสินค้า · {source === 'PDF' ? 'อ่านจากไฟล์ใบเสนอราคา' : 'จากล็อตที่จอง'}</div>
    <table className="w-full text-[11px]">
      <thead className="text-[var(--text-secondary)]">
        <tr><th className="text-left">#</th><th className="text-left">รหัสสินค้า / รายละเอียด</th><th className="text-left">ม้วน / ล็อต</th><th className="text-left">คลัง</th><th className="text-right">จำนวน</th><th className="text-left pl-2">ตรงกับการจอง</th></tr>
      </thead>
      <tbody>
        {items.map((line) => (
          <tr key={`${line.lineNo}-${line.lotNo}`} className="border-t border-[var(--border-color)]">
            <td>{line.lineNo}</td>
            <td>{line.productCode}<div className="text-[var(--text-secondary)]">{line.description}</div></td>
            <td className="font-mono">{line.lotNo}</td>
            <td>{bayLabel(line.warehouse)}</td>
            <td className="text-right">{line.qty.toLocaleString('th-TH', { maximumFractionDigits: 3 })} {line.unit}</td>
            <td className={`pl-2 ${line.matchedLotId ? 'text-emerald-400' : 'text-rose-300'}`}>{line.matchedLotId ? `✓ ${line.matchedLotId}` : 'ไม่พบในการจอง'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
