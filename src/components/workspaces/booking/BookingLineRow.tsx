import React, { useState } from 'react';
import { useWms } from '../../../context/WmsContext';
import { stagingDueDate } from '../../../context/bookingWork';
import { InventoryItem, StockBooking, StockBookingGroup } from '../../../types/wms';
import { StatusBadge } from '../../common/StatusBadge';
import { WarehouseReviewForm } from './WarehouseReviewForm';
import { RequisitionPrintModal } from './RequisitionPrintModal';
import { INPUT_CLASS, LINE_STEP_LABEL, PICK_STATE_LABEL, PROCESSING_STATE_LABEL, WAREHOUSE_ROLES, bayLabel, productNameThai } from './bookingUi';

interface BookingLineRowProps {
  booking: StockBooking;
  item: InventoryItem;
  group: StockBookingGroup;
}

/** One booked lot inside a quotation: type, location, warehouse check, work progress and any damage exception. */
export const BookingLineRow: React.FC<BookingLineRowProps> = ({ booking, item, group }) => {
  const {
    currentRole, inventory, processingJobs, pickTasks, workTypeConfigs, navigateToWorkspace,
    submitWarehouseBookingReview, acknowledgeBookingLeadTime, acceptBookingReplacement,
    proposeExceptionReplacement, resolveBookingException,
  } = useWms();
  const [printKind, setPrintKind] = useState<'STOCK' | 'PROCESSING' | null>(null);
  const [exceptionLotId, setExceptionLotId] = useState('');
  const config = workTypeConfigs.find((entry) => entry.sku === item.productCode);
  const isProcessing = config?.workType === 'PROCESSING';
  const isWarehouse = WAREHOUSE_ROLES.includes(currentRole);
  const queueAhead = processingJobs.filter((job) => job.status !== 'COMPLETED' && inventory.find((stock) => stock.id === job.inputLotId)?.productCode === item.productCode).length;
  const job = processingJobs.find((entry) => entry.inputLotId === item.id && entry.linkedSoNumber && entry.linkedSoNumber === booking.approvedSoReference);
  const task = pickTasks.find((entry) => entry.lotId === item.id && entry.soNumber === booking.approvedSoReference);
  const reply = booking.warehouseReply;
  const exception = booking.exception;
  const stagingDue = stagingDueDate(group.deliveryDate);
  const lateForDelivery = Boolean(reply && stagingDue && reply.readyDate > stagingDue);
  const progress = task
    ? PICK_STATE_LABEL[task.state] || task.state
    : job ? PROCESSING_STATE_LABEL[job.status] || job.status
    : booking.status === 'RESERVED' ? 'รอออกใบงาน' : LINE_STEP_LABEL[booking.status];

  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-shell)] p-3 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-mono font-bold text-blue-400">{item.id}{booking.replacesBookingId && <span className="ml-2 rounded bg-blue-500/15 px-1.5 text-[10px] text-blue-300">ล็อตทดแทน</span>}</div>
          <div className="mt-0.5 font-semibold">{productNameThai(item.productName)} · {item.totalWeightTons.toFixed(3)} ตัน</div>
          <div className="mt-0.5 text-[var(--text-secondary)]">ตำแหน่ง: {bayLabel(item.locationBay)}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${isProcessing ? 'bg-purple-500/15 text-purple-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{isProcessing ? 'เหล็กแปรรูป · ต้องแปรรูปก่อนส่ง' : 'เหล็กสำเร็จรูป · หยิบส่งได้เลย'}</span>
          <StatusBadge status={item.canonicalStatus} size="sm" />
          <span className="text-[var(--text-secondary)]">{progress}</span>
        </div>
      </div>

      {booking.damagedLotId && <div className="mt-2 text-rose-300">ส่วนชำรุดตอนตรวจ: {booking.damagedLotId} · <StatusBadge status="07" size="sm" /></div>}
      {reply && (
        <div className="mt-2 rounded bg-[var(--bg-card)] p-2">
          คลังแจ้ง: พบที่ {bayLabel(reply.foundLocation)} · สภาพ{reply.condition === 'DAMAGED' ? 'ชำรุด' : 'ปกติ'} · รอ {reply.committedDays} วัน (ระบบแนะนำ {reply.suggestedDays} วัน) · คาดว่าพร้อม {reply.readyDate}
          {reply.note && <div className="text-[var(--text-secondary)]">{reply.note}</div>}
          {lateForDelivery && <div className="mt-1 text-rose-300">พร้อมช้ากว่ากำหนดวางที่ประตู {stagingDue} (ก่อนวันส่ง {group.deliveryDate} 1 วัน)</div>}
        </div>
      )}

      {booking.status === 'WAITING_WAREHOUSE' && isWarehouse && (
        <WarehouseReviewForm
          item={item}
          inventory={inventory}
          config={config}
          queueAhead={queueAhead}
          deliveryDate={group.deliveryDate}
          onSubmit={(input) => submitWarehouseBookingReview(booking.id, input)}
        />
      )}
      {booking.status === 'WAITING_SALES_ACK' && currentRole === 'sales_rep' && (
        <div className="mt-2 flex flex-wrap gap-2">
          {reply?.suggestedLotId && <button onClick={() => acceptBookingReplacement(booking.id)} className="rounded border border-blue-500/40 px-3 py-1.5 font-bold text-blue-300">รับล็อตทดแทนที่คลังแนะนำ ({reply.suggestedLotId})</button>}
          <button disabled={item.canonicalStatus !== '03'} onClick={() => acknowledgeBookingLeadTime(booking.id)} className="rounded bg-blue-600 px-3 py-1.5 font-bold text-white disabled:opacity-40">รับทราบวันที่คลังแจ้ง</button>
        </div>
      )}

      {exception && (
        <div className="mt-2 rounded border border-rose-500/30 bg-rose-500/5 p-2">
          <div className="font-semibold text-rose-300">พบของเสีย {exception.damagedQtyTons.toFixed(3)} ตัน {exception.source === 'PICK' ? 'ระหว่างหยิบ' : 'จาก QC หลังแปรรูป'} → {exception.damagedLotId} <StatusBadge status="07" size="sm" /></div>
          <div className="text-[var(--text-secondary)]">{exception.reason}</div>
          {exception.status === 'WAITING_WAREHOUSE' && (isWarehouse ? (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <select aria-label="ล็อตทดแทนของเสีย" value={exceptionLotId} onChange={(event) => setExceptionLotId(event.target.value)} className={`${INPUT_CLASS} max-w-xs`}>
                <option value="">ไม่มีล็อตทดแทน</option>
                {inventory.filter((stock) => stock.productCode === item.productCode && stock.canonicalStatus === '02' && stock.physicalCondition === 'NORMAL' && stock.availableWeightTons >= exception.damagedQtyTons).map((stock) => (
                  <option key={stock.id} value={stock.id}>{stock.id} · {bayLabel(stock.locationBay)} · {stock.availableWeightTons.toFixed(3)} ตัน</option>
                ))}
              </select>
              <button onClick={() => proposeExceptionReplacement(booking.id, exceptionLotId || undefined)} className="rounded bg-indigo-600 px-3 py-1.5 font-bold text-white">ส่งข้อเสนอให้เซลล์</button>
            </div>
          ) : <div className="mt-1 text-amber-300">รอคลังเสนอล็อตทดแทน</div>)}
          {exception.status === 'WAITING_SALES' && (currentRole === 'sales_rep' ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {exception.suggestedLotId && <button onClick={() => resolveBookingException(booking.id, true)} className="rounded bg-blue-600 px-3 py-1.5 font-bold text-white">รับล็อตทดแทน {exception.suggestedLotId}</button>}
              <button onClick={() => resolveBookingException(booking.id, false)} className="rounded border border-[var(--border-color)] px-3 py-1.5">{exception.suggestedLotId ? 'ไม่รับ · ส่งเท่าที่มี' : 'รับทราบ · ไม่มีล็อตทดแทน'}</button>
            </div>
          ) : <div className="mt-1 text-amber-300">รอเซลล์ตัดสินใจ{exception.suggestedLotId ? ` (เสนอ ${exception.suggestedLotId})` : ''}</div>)}
          {exception.status === 'RESOLVED' && <div className="mt-1 text-emerald-300">รับล็อตทดแทนแล้ว ({exception.replacementBookingId})</div>}
          {exception.status === 'CLOSED_NO_REPLACEMENT' && <div className="mt-1 text-[var(--text-secondary)]">ปิดเรื่อง · ไม่ใช้ล็อตทดแทน</div>}
        </div>
      )}

      {booking.status === 'RESERVED' && (
        <div className="mt-2 flex flex-wrap gap-2">
          {isProcessing && job && <button onClick={() => setPrintKind('PROCESSING')} className="rounded border border-purple-500/40 px-3 py-1.5 text-purple-300">ใบเบิกสินค้าเพื่อผลิตหรือแปรรูป</button>}
          {task && <button onClick={() => setPrintKind('STOCK')} className="rounded border border-emerald-500/40 px-3 py-1.5 text-emerald-300">ใบเบิกสินค้า</button>}
          {isProcessing && job && !task && <button onClick={() => navigateToWorkspace('WMS-07')} className="rounded border border-[var(--border-color)] px-3 py-1.5">เปิดคิวแปรรูป →</button>}
          {task && <button onClick={() => navigateToWorkspace('WMS-06')} className="rounded border border-[var(--border-color)] px-3 py-1.5">เปิดงานหยิบ →</button>}
        </div>
      )}
      {printKind && <RequisitionPrintModal kind={printKind} booking={booking} item={item} group={group} job={job} task={task} onClose={() => setPrintKind(null)} />}
    </div>
  );
};
