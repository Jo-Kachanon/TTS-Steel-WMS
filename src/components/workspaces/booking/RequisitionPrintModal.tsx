import React from 'react';
import { InventoryItem, PickTask, ProcessingJob, StockBooking, StockBookingGroup } from '../../../types/wms';
import { stagingDueDate } from '../../../context/bookingWork';
import { bayLabel, productNameThai } from './bookingUi';

interface RequisitionPrintModalProps {
  kind: 'STOCK' | 'PROCESSING';
  booking: StockBooking;
  item: InventoryItem;
  group: StockBookingGroup;
  job?: ProcessingJob;
  task?: PickTask;
  onClose: () => void;
}

const escapeHtml = (value: string | number | undefined): string =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));

const box = (checked: boolean) => (checked ? '☑' : '☐');
const tons = (value: number | undefined) => (value === undefined ? '' : value.toFixed(3));

// Colours and layout follow the TTS controlled-document templates (orange title block, peach label cells).
const PRINT_STYLES = `
  @page { size: A4; margin: 12mm; }
  body { font-family: 'Sarabun', 'Noto Sans Thai', 'Tahoma', sans-serif; font-size: 10.5px; color: #1f1f1f; margin: 12px; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; margin-bottom: 6px; }
  .title { background: #f39a5b; padding: 10px 14px; flex: 1; text-align: center; }
  .title h1 { font-size: 18px; margin: 0; } .title .en { font-weight: bold; font-size: 11px; margin-top: 2px; } .title .co { font-size: 11px; }
  .ctrl { text-align: right; font-size: 9px; color: #1d3c8a; line-height: 1.5; } .ctrl b { display: block; }
  h2 { font-size: 11px; margin: 10px 0 0; background: #f39a5b; padding: 3px 6px; }
  table { width: 100%; border-collapse: collapse; } td, th { border: 1px solid #b9b9b9; padding: 3px 5px; vertical-align: top; }
  th { background: #f6b989; text-align: center; font-size: 9.5px; } .k { background: #f6b989; width: 16%; font-weight: bold; }
  .k small, th small { display: block; font-weight: normal; color: #8a3b0c; }
  .note { color: #b3261e; font-size: 9.5px; margin: 4px 0; } .sign td { height: 78px; text-align: center; font-size: 9.5px; }
  .page { text-align: right; font-size: 9px; color: #666; margin-top: 8px; }
  @media print { button { display: none; } }
`;

const signRow = (section: string, titles: string[]) => `<h2>${section}. การอนุมัติและลงนาม / Approval &amp; Sign-off</h2><table class="sign"><tr>${titles.map((title) => `<th>${title}</th>`).join('')}</tr><tr>${titles.map(() => '<td><br/>ลงชื่อ ..........................<br/>( .......................... )<br/>ตำแหน่ง ....................<br/>วันที่ ....../....../...... เวลา ..........</td>').join('')}</tr></table><div class="page">หน้า 1 / 1</div>`;

const docHead = (titleTh: string, titleEn: string) => `<div class="head"><div class="title"><h1>${titleTh}</h1><div class="en">(${titleEn})</div><div class="co">บริษัท ไทยทวีพรค้าเหล็ก จำกัด</div></div><div class="ctrl">เอกสารใช้ภายใน ห้ามแก้ไขหากไม่ได้รับอนุมัติ<b>INTERNAL USE – CONTROLLED DOCUMENT</b>รหัสแบบฟอร์ม ____________ Rev. ____</div></div>`;

const stockRequisitionHtml = ({ booking, item, group, job, task }: RequisitionPrintModalProps): string => `
  ${docHead('ใบเบิกสินค้า', 'STOCK REQUISITION FORM')}
  <h2>1. ข้อมูลเอกสาร / Document Information</h2>
  <table>
    <tr><td class="k">เลขที่เอกสาร</td><td>${escapeHtml(task?.pickNumber)}</td><td class="k">วันที่</td><td>${new Date().toISOString().slice(0, 10)}</td></tr>
    <tr><td class="k">กำหนดส่งสินค้า</td><td>${escapeHtml(group.deliveryDate)} · วางที่ประตู ${escapeHtml(group.stagingGate)} ภายใน ${escapeHtml(stagingDueDate(group.deliveryDate))}</td><td class="k">เลขที่ใบสั่งขาย / ใบเสนอราคา</td><td>${escapeHtml(booking.approvedSoReference)}</td></tr>
    <tr><td class="k">ชื่อลูกค้า</td><td>${escapeHtml(group.customerName)}</td><td class="k">แผนกผู้ขอเบิก</td><td>ฝ่ายขาย</td></tr>
    <tr><td class="k">คลังที่เบิก</td><td>WH-01</td><td class="k">เลขที่งานผลิต (ถ้ามี)</td><td>${escapeHtml(job?.jobNumber || '-')}</td></tr>
    <tr><td class="k">วัตถุประสงค์การเบิก</td><td colspan="3">${box(true)} ส่งมอบให้ลูกค้า ${box(false)} ผลิต / แปรรูป ${box(false)} ใช้ภายใน ${box(false)} ตัวอย่างสินค้า ${box(false)} โอนย้ายคลัง</td></tr>
  </table>
  <h2>2. รายการสินค้าที่ขอเบิก / Requisition Items</h2>
  <table>
    <tr><th>ลำดับ</th><th>รหัสสินค้า</th><th>รายละเอียด</th><th>ขนาด / เกรด</th><th>ล็อต / ม้วน / Heat</th><th>ขอเบิก (ตัน)</th><th>จ่ายจริง (ตัน)</th><th>ตำแหน่ง</th><th>หมายเหตุ</th></tr>
    <tr><td>1</td><td>${escapeHtml(item.productCode)}</td><td>${escapeHtml(productNameThai(item.productName))}</td><td>${escapeHtml(item.dimensions)} / ${escapeHtml(item.grade)}</td><td>${escapeHtml(item.lotNumber)} / ${escapeHtml(item.heatNumber)}</td><td>${tons(task?.allocatedQtyTons ?? item.totalWeightTons)}</td><td>${task?.actualPickedQtyTons ? tons(task.actualPickedQtyTons) : ''}</td><td>${escapeHtml(bayLabel(task?.targetBay || item.locationBay))}</td><td>วางที่ประตู ${escapeHtml(group.stagingGate)} (Logistics App)</td></tr>
  </table>
  <p class="note">หมายเหตุคลัง: จ่ายสินค้าตามหลักเข้าก่อน – ออกก่อน • บันทึกเลขล็อต/ม้วนที่จ่ายจริงทุกรายการ • ตรวจนับและชั่งน้ำหนักต่อหน้าผู้รับสินค้า • หากจ่ายไม่ครบตามที่ขอ ให้ระบุเหตุผลในช่องหมายเหตุ</p>
  ${signRow('3', ['ผู้ขอเบิก<small>Requested by</small>', 'ผู้ตรวจสอบ / อนุมัติ<small>Checked / Approved by</small>', 'ผู้จ่ายสินค้า (คลัง)<small>Issued by</small>', 'ผู้รับสินค้า<small>Received by</small>'])}`;

const processingRequisitionHtml = ({ booking, item, group, job, task }: RequisitionPrintModalProps): string => {
  const daysLeft = group.deliveryDate ? (Date.parse(stagingDueDate(group.deliveryDate)) - Date.now()) / 86_400_000 : 99;
  const completed = job?.status === 'COMPLETED';
  const yieldPct = completed && job!.inputQtyTons ? ((job!.outputQtyTons / job!.inputQtyTons) * 100).toFixed(1) : '';
  return `
  ${docHead('ใบเบิกสินค้าเพื่อผลิตหรือแปรรูป', 'PRODUCT REQUISITION FOR PRODUCTION OR PROCESSING')}
  <h2>1. ข้อมูลเอกสารและงานผลิต / Document &amp; Job Information</h2>
  <table>
    <tr><td class="k">เลขที่เอกสาร</td><td>${escapeHtml(job?.jobNumber)}</td><td class="k">วันที่</td><td>${new Date().toISOString().slice(0, 10)}</td><td class="k">กำหนดแล้วเสร็จ</td><td>${escapeHtml(stagingDueDate(group.deliveryDate))} (วางที่ประตูก่อนส่ง ${escapeHtml(group.deliveryDate)})</td></tr>
    <tr><td class="k">เลขที่ใบสั่งขาย</td><td>${escapeHtml(booking.approvedSoReference)}</td><td class="k">ลูกค้า</td><td>${escapeHtml(group.customerName)}</td><td class="k">เลขที่งานผลิต/แปรรูป</td><td>${escapeHtml(job?.id)}</td></tr>
    <tr><td class="k">เครื่องจักร/ไลน์</td><td>${escapeHtml(job?.machine)}</td><td class="k">อ้างอิงใบเบิกสินค้า</td><td>${escapeHtml(task?.pickNumber || 'ออกหลัง QC ผ่าน')}</td><td class="k">ความเร่งด่วน</td><td>${box(daysLeft > 3)} ปกติ ${box(daysLeft <= 3)} ด่วน</td></tr>
  </table>
  <h2>2. ประเภทการแปรรูปและข้อกำหนดงาน / Processing Type &amp; Instructions</h2>
  <table>
    <tr><td class="k">ประเภทการแปรรูป</td><td>☐ ตัดตามความยาว (C-Line) ☐ ตัดเฉือน (Shearing) ☐ ผ่าสลิท (Slitting) ☐ พับ (Bending) ☐ ม้วน/รีดขึ้นรูป ☐ ปรับเรียบ (Leveling) ☐ เคลือบน้ำมัน (Oiling) อื่นๆ ......</td></tr>
    <tr><td class="k">แบบ/เอกสารอ้างอิง</td><td>เลขที่แบบ .......... ☐ แนบแบบ ☐ แบบ Spec ลูกค้า</td></tr>
    <tr><td class="k">ค่าคลาดเคลื่อนที่ยอมรับ</td><td>หนา ± ....... mm กว้าง ± ....... mm ยาว ± ....... mm</td></tr>
    <tr><td class="k">การบรรจุผลผลิต</td><td>☐ มัดเหล็กรัด ☐ วางบนพาเลท/ไม้รอง ☐ ห่อกันน้ำ/กันสนิม ☐ ติดป้ายบ่งชี้</td></tr>
  </table>
  <h2>3. รายการวัตถุดิบที่เบิก / Raw Materials Issued</h2>
  <table>
    <tr><th>ลำดับ</th><th>รหัสวัตถุดิบ</th><th>รายละเอียด</th><th>ขนาด/เกรด</th><th>ม้วน/ล็อต</th><th>ขอเบิก (ตัน)</th><th>จ่ายจริง (ตัน)</th><th>หมายเหตุ</th></tr>
    <tr><td>1</td><td>${escapeHtml(item.productCode)}</td><td>${escapeHtml(productNameThai(item.productName))}</td><td>${escapeHtml(item.dimensions)} / ${escapeHtml(item.grade)}</td><td>${escapeHtml(item.lotNumber)}</td><td>${tons(job?.inputQtyTons)}</td><td>${job?.physicalReceiptConfirmed ? tons(job.inputQtyTons) : ''}</td><td>${escapeHtml(bayLabel(item.locationBay))}</td></tr>
  </table>
  <h2>4. ผลผลิตที่ต้องการและผลผลิตจริง / Target &amp; Actual Output</h2>
  <table>
    <tr><th>ลำดับ</th><th>รหัส/ชื่อผลผลิต</th><th>ขนาดสำเร็จ</th><th>เป้าหมาย (ตัน)</th><th>ผลิตได้จริง (ตัน)</th><th>หมายเหตุ</th></tr>
    <tr><td>1</td><td>${escapeHtml(item.productCode)} ตามใบเสนอราคา</td><td></td><td>${tons(job?.inputQtyTons)}</td><td>${completed ? tons(job!.outputQtyTons) : ''}</td><td></td></tr>
  </table>
  <h2>5. สรุปการใช้วัตถุดิบ / Yield Summary</h2>
  <table>
    <tr><td class="k">(A) น้ำหนักวัตถุดิบที่เบิกรวม</td><td>${tons(job?.inputQtyTons)} ตัน</td><td class="k">(B) ผลผลิตจริง</td><td>${completed ? tons(job!.outputQtyTons) : ''}</td></tr>
    <tr><td class="k">(C) ของเสีย / เศษ</td><td>${completed ? tons((job!.scrapQtyTons || 0) + (job!.failQtyTons || 0)) : ''}</td><td class="k">(D) เศษเหลือใช้คืนคลัง</td><td></td></tr>
    <tr><td class="k">อัตราผลได้ = B ÷ A × 100</td><td>${yieldPct ? `${yieldPct} %` : ''}</td><td class="k">ผลตรวจคุณภาพ</td><td>${box(completed && !job!.failQtyTons)} ผ่าน ${box(Boolean(completed && job!.failQtyTons))} ไม่ผ่าน</td></tr>
  </table>
  <p class="note">หากผลต่าง (Variance) หรืออัตราของเสียเกินเกณฑ์ที่บริษัทกำหนด ให้หัวหน้าฝ่ายผลิตระบุสาเหตุในช่องหมายเหตุ และแจ้งฝ่ายวางแผน/คลังสินค้า</p>
  ${signRow('6', ['ผู้ขอเบิก<small>Requested by</small>', 'ผู้อนุมัติ<small>Approved by</small>', 'ผู้จ่ายวัตถุดิบ<small>Issued by (Warehouse)</small>', 'ผู้รับวัตถุดิบ<small>Received by (Production)</small>', 'ผู้ควบคุมการผลิต/แปรรูป<small>Production Supervisor</small>'])}`;
};

/** Print preview of the TTS requisition templates, prefilled from the booking, quotation and work order. */
export const RequisitionPrintModal: React.FC<RequisitionPrintModalProps> = (props) => {
  const title = props.kind === 'STOCK' ? 'ใบเบิกสินค้า' : 'ใบเบิกสินค้าเพื่อผลิตหรือแปรรูป';
  const body = props.kind === 'STOCK' ? stockRequisitionHtml(props) : processingRequisitionHtml(props);
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_STYLES}</style></head><body>${body}</body></html>`;

  const print = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-label={title}>
      <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-[var(--bg-card)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <strong className="text-sm">{title}</strong>
          <div className="flex gap-2">
            <button onClick={print} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">พิมพ์ / บันทึก PDF</button>
            <button onClick={props.onClose} className="rounded border border-[var(--border-color)] px-3 py-1.5 text-xs">ปิด</button>
          </div>
        </div>
        <iframe title={title} srcDoc={html} className="flex-1 rounded bg-white" />
      </div>
    </div>
  );
};
