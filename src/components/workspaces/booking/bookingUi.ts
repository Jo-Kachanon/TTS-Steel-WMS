import { UserRole } from '../../../types/wms';

export const INPUT_CLASS = 'mt-1 w-full rounded border border-[var(--border-color)] bg-[var(--input-bg)] px-2 py-1.5 text-[var(--text-primary)]';
export const LABEL_CLASS = 'text-[11px] text-[var(--text-secondary)]';

export const WAREHOUSE_ROLES: UserRole[] = ['warehouse_manager', 'crane_operator', 'system_admin'];

export const productNameThai = (name: string): string => name
  .replaceAll('H-Beam', 'เหล็กเอชบีม')
  .replaceAll('Wide Flange', 'เหล็กไวด์แฟลงก์')
  .replaceAll('Hot Rolled Coil', 'เหล็กม้วนรีดร้อน')
  .replaceAll('HR Coil', '')
  .replaceAll('mm', 'มม.')
  .replace(/(\d)M\b/g, '$1 ม.');

export const bayLabel = (bay: string): string => bay.replaceAll('Bay ', 'ช่อง ');

export const PICK_STATE_LABEL: Record<string, string> = {
  queued: 'ออกใบเบิกแล้ว · รอมอบหมายผู้หยิบ',
  assigned: 'มอบหมายแล้ว · รอเริ่มหยิบ',
  picking: 'กำลังหยิบ',
  picked: 'หยิบแล้ว · รอตรวจและจัดชุด',
  qc_packing: 'ตรวจคุณภาพและจัดชุด',
  staged: 'วางที่ประตูแล้ว · รอผู้จัดการยืนยัน',
  ready: 'พร้อมส่งมอบ',
  partial_exception: 'พบข้อยกเว้น',
};

export const PROCESSING_STATE_LABEL: Record<string, string> = {
  PENDING: 'ออกใบเบิกเพื่อแปรรูปแล้ว · รอเริ่มแปรรูป',
  IN_PROCESS: 'กำลังแปรรูป',
  QC_INSPECTION: 'รอตรวจคุณภาพหลังแปรรูป',
  COMPLETED: 'แปรรูปเสร็จ',
};

export const LINE_STEP_LABEL: Record<string, string> = {
  WAITING_WAREHOUSE: 'รอคลังตรวจสินค้า',
  WAITING_SALES_ACK: 'รอเซลล์รับทราบ',
  WAITING_APPROVED_SO: 'เซลล์รับทราบแล้ว',
  RESERVED: 'ยืนยันการจองแล้ว',
  EXPIRED: 'หมดอายุ · คืนเป็น [02]',
  CANCELLED: 'ยกเลิก',
};

export const formatThaiDateTime = (iso: string): string =>
  new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(iso));
