import React from 'react';
import { useWms } from '../../../context/WmsContext';
import { stagingDueDate } from '../../../context/bookingWork';
import { StockBookingGroup } from '../../../types/wms';
import { BookingLineRow } from './BookingLineRow';
import { QuotationAttachForm, QuotationItemsTable } from './QuotationAttachForm';
import { formatThaiDateTime } from './bookingUi';

const GroupSteps: React.FC<{ steps: { label: string; done: boolean }[] }> = ({ steps }) => (
  <ol className="mt-3 flex flex-wrap gap-1 text-[10px]">
    {steps.map((step, index) => (
      <li key={step.label} className={`rounded px-2 py-1 ${step.done ? 'bg-emerald-500/15 text-emerald-300' : 'bg-[var(--bg-shell)] text-[var(--text-secondary)]'}`}>
        {index + 1}. {step.label}
      </li>
    ))}
  </ol>
);

const BookingGroupCard: React.FC<{ group: StockBookingGroup }> = ({ group }) => {
  const { currentRole, stockBookings, inventory, attachBookingQuotation, confirmBookingGroup } = useWms();
  const lines = stockBookings
    .filter((booking) => booking.groupId === group.id)
    .map((booking) => ({ booking, item: inventory.find((stock) => stock.id === booking.lotId) }))
    .filter((line): line is { booking: typeof line.booking; item: NonNullable<typeof line.item> } => Boolean(line.item));
  const active = lines.filter(({ booking }) => !['EXPIRED', 'CANCELLED'].includes(booking.status));
  const reviewed = active.filter(({ booking }) => booking.status !== 'WAITING_WAREHOUSE').length;
  const acknowledged = active.filter(({ booking }) => ['WAITING_APPROVED_SO', 'RESERVED'].includes(booking.status)).length;
  const ready = active.filter(({ item }) => ['08', '09', '10'].includes(item.canonicalStatus)).length;
  const reservedLines = active.filter(({ booking }) => booking.status === 'RESERVED');
  const allAcknowledged = active.length > 0 && acknowledged === active.length;
  const canConfirm = currentRole === 'sales_rep' && group.status === 'OPEN' && Boolean(group.quotation) && allAcknowledged;

  return (
    <article className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-color)] pb-3">
        <div>
          <div className="font-mono text-xs font-bold text-blue-400">{group.id}{group.quotation && ` · ใบเสนอราคา ${group.quotation.quotationNo}`}</div>
          <div className="mt-1 text-sm font-semibold">ลูกค้า: {group.customerName} · {active.length} ล็อต · {active.reduce((sum, { item }) => sum + item.totalWeightTons, 0).toFixed(3)} ตัน</div>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">
            {group.deliveryDate
              ? <>วันส่ง (ตามใบเสนอราคา): <strong className="text-[var(--text-primary)]">{group.deliveryDate}</strong> · วางสินค้าที่ประตูภายใน <strong className="text-amber-300">{stagingDueDate(group.deliveryDate)}</strong> (ก่อนวันส่ง 1 วัน) · ประตู <strong className="text-[var(--text-primary)]">{group.stagingGate}</strong> <span title="ประตูกำหนดโดย Logistics App">(จาก Logistics App · แก้ไขที่ Logistics App)</span></>
              : 'วันส่งและประตูจะขึ้นหลังแนบใบเสนอราคา'}
          </div>
        </div>
        <div className="text-right text-xs">
          <div className="font-semibold">{group.status === 'RESERVED' ? `ยืนยันการจองแล้ว · พร้อมส่ง ${ready}/${active.length} ล็อต` : group.status === 'EXPIRED' ? 'หมดอายุ · คืนเป็น [02]' : 'รอยืนยันการจอง'}</div>
          {group.status === 'OPEN' && <div className="text-[var(--text-secondary)]">ต้องแนบใบเสนอราคาภายใน {formatThaiDateTime(group.expiresAt)}</div>}
        </div>
      </div>
      <GroupSteps steps={[
        { label: 'จอง [03]', done: true },
        { label: `คลังตรวจ ${reviewed}/${active.length}`, done: active.length > 0 && reviewed === active.length },
        { label: `เซลล์รับทราบ ${acknowledged}/${active.length}`, done: allAcknowledged },
        { label: 'แนบใบเสนอราคา', done: Boolean(group.quotation) },
        { label: 'ยืนยัน [04] · ออกใบเบิก', done: group.status === 'RESERVED' },
        { label: `พร้อมส่ง [08] ${ready}/${active.length}`, done: active.length > 0 && ready === active.length },
      ]} />

      {group.quotation ? (
        <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
          ใบเสนอราคา <strong>{group.quotation.quotationNo}</strong> · ลงวันที่ {group.quotation.quotationDate || '—'} · ยืนราคาถึง {group.quotation.validUntil || '—'}
          <div className="mt-1 text-[var(--text-secondary)]">ไฟล์: {group.quotation.fileDataUrl ? <a href={group.quotation.fileDataUrl} download={group.quotation.fileName} className="text-blue-400 underline">{group.quotation.fileName}</a> : group.quotation.fileName}</div>
          <div className="mt-2 grid"><QuotationItemsTable items={group.quotation.items} source={group.quotation.prefillSource} /></div>
        </div>
      ) : group.status === 'OPEN' && currentRole === 'sales_rep' && (
        <QuotationAttachForm bookedLots={active.map(({ item }) => item)} earliestReadyDate={active.map(({ booking }) => booking.warehouseReply?.readyDate || '').sort().pop() || undefined} onAttach={(quotation) => attachBookingQuotation(group.id, quotation)} />
      )}

      <div className="mt-3 flex flex-col gap-2">
        {lines.map(({ booking, item }) => <BookingLineRow key={booking.id} booking={booking} item={item} group={group} />)}
      </div>

      {group.status === 'OPEN' && currentRole === 'sales_rep' && (
        <div className="mt-3">
          <button disabled={!canConfirm} onClick={() => confirmBookingGroup(group.id)} className="w-full rounded bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
            ยืนยันการจองตามใบเสนอราคา · เปลี่ยนเป็น [04] และออกใบเบิกตามประเภทเหล็ก
          </button>
          {!canConfirm && <p className="mt-1 text-[11px] text-amber-300">{!allAcknowledged ? 'รอคลังตรวจและเซลล์รับทราบให้ครบทุกล็อต' : 'แนบใบเสนอราคาก่อนยืนยัน'}</p>}
        </div>
      )}
      {reservedLines.length > 0 && <p className="mt-2 text-[11px] text-[var(--text-secondary)]">เหล็กสำเร็จรูปออกใบเบิกสินค้าเพื่อหยิบทันที · เหล็กแปรรูปออกใบเบิกเพื่อแปรรูปก่อน แล้วระบบออกใบเบิกสินค้าให้เองเมื่อ QC ผ่าน</p>}
    </article>
  );
};

/** All booking requests (one per customer quotation) with their lots, checks and delivery progress. */
export const BookingGroupsPanel: React.FC = () => {
  const { currentRole, stockBookingGroups } = useWms();
  const visible = stockBookingGroups.filter((group) => currentRole !== 'sales_rep' || group.requesterRole === 'sales_rep');
  return (
    <section className="flex flex-col gap-3">
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
        <h2 className="font-bold">รายการจองและติดตามสินค้า</h2>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">หนึ่งรายการต่อหนึ่งใบเสนอราคา · เซลล์ติดตามตำแหน่ง งานแปรรูป งานหยิบ และความพร้อมส่งของทุกล็อตได้ที่นี่</p>
      </div>
      {visible.length === 0 && <p className="rounded-xl border border-dashed border-[var(--border-color)] p-6 text-center text-xs text-[var(--text-secondary)]">ยังไม่มีรายการจอง · เลือกสินค้าจากเมนู “สินค้าพร้อมจอง”</p>}
      {visible.map((group) => <BookingGroupCard key={group.id} group={group} />)}
    </section>
  );
};
