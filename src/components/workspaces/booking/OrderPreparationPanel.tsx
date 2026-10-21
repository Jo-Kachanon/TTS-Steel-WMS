import React, { useState } from 'react';
import { useWms } from '../../../context/WmsContext';
import { stagingDueDate } from '../../../context/bookingWork';
import { RoleStepHint } from '../../common/RoleStepHint';
import { StatusBadge } from '../../common/StatusBadge';
import { PICK_STATE_LABEL, PROCESSING_STATE_LABEL, bayLabel, productNameThai } from './bookingUi';

const ORDER_CHECKS = [
  'ทุกรายการอยู่ครบที่ประตู ตรงตามใบเบิก',
  'ป้ายสเปก ล็อต และเลขหลอมตรงกับใบเสนอราคา',
  'มัดรัดแน่น พร้อมยกขึ้นรถ',
  'เอกสารส่งของครบทั้งใบสั่ง',
];

interface OrderPreparationPanelProps {
  soNumber: string;
  onOpenTask: (taskId: string) => void;
  onBack: () => void;
}

/** Items are picked one by one; this panel brings the whole order together at its gate and confirms [08] once. */
export const OrderPreparationPanel: React.FC<OrderPreparationPanelProps> = ({ soNumber, onOpenTask, onBack }) => {
  const { currentRole, stockBookings, stockBookingGroups, inventory, pickTasks, processingJobs, navigateToWorkspace, stageOrderAtGate, confirmOrderReady08 } = useWms();
  const [checks, setChecks] = useState<boolean[]>(ORDER_CHECKS.map(() => false));
  const lines = stockBookings.filter((booking) => booking.approvedSoReference === soNumber && booking.status === 'RESERVED');
  const group = lines[0] ? stockBookingGroups.find((entry) => entry.id === lines[0].groupId) : undefined;
  const rows = lines.map((booking) => {
    const item = inventory.find((stock) => stock.id === booking.lotId);
    const task = pickTasks.find((entry) => entry.lotId === booking.lotId && entry.soNumber === soNumber);
    const job = processingJobs.find((entry) => entry.inputLotId === booking.lotId && entry.linkedSoNumber === soNumber);
    return { booking, item, task, job };
  }).filter((row) => row.item && !['07'].includes(row.item.canonicalStatus));
  const open = rows.filter(({ task }) => !task?.readinessConfirmed);
  const waitingProcessing = open.filter(({ task }) => !task);
  const waitingPick = open.filter(({ task }) => task && !['picked', 'qc_packing', 'staged'].includes(task.state));
  const staged = open.length > 0 && open.every(({ task }) => task?.state === 'staged');
  const allReady = rows.length > 0 && rows.every(({ task }) => task?.readinessConfirmed);
  const canStage = open.length > 0 && !waitingProcessing.length && !waitingPick.length && !staged && checks.every(Boolean);
  const due = stagingDueDate(group?.deliveryDate);
  const step = allReady ? 'done' : staged ? 'confirm' : waitingProcessing.length || waitingPick.length ? 'picking' : 'stage';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border-color)] pb-2">
        <div>
          <div className="text-[13px] font-bold">เตรียมส่งทั้งใบสั่ง {soNumber}</div>
          <div className="text-[var(--text-secondary)]">{group?.customerName} · ส่ง {group?.deliveryDate} · วางที่ประตู <strong className="text-[var(--text-primary)]">{group?.stagingGate}</strong> ภายใน <strong className="text-amber-300">{due}</strong></div>
        </div>
        <button onClick={onBack} className="rounded border border-[var(--border-color)] px-2 py-1">← กลับไปงานหยิบรายชิ้น</button>
      </div>

      <ol className="flex flex-wrap gap-1 text-[10px]">
        {[['picking', '1. หยิบแยกทีละรายการ'], ['stage', '2. รวมของที่ประตู'], ['confirm', '3. ผู้จัดการยืนยัน [08]'], ['done', '4. พร้อมส่งมอบ']].map(([key, label], index, all) => {
          const doneIndex = all.findIndex(([id]) => id === step);
          return <li key={key} className={`rounded px-2 py-1 ${index < doneIndex || step === 'done' ? 'bg-emerald-500/15 text-emerald-300' : index === doneIndex ? 'bg-blue-500/20 text-blue-200' : 'bg-[var(--bg-shell)] text-[var(--text-secondary)]'}`}>{label}</li>;
        })}
      </ol>

      <table className="w-full">
        <thead className="text-[var(--text-secondary)]"><tr><th className="text-left">ล็อต</th><th className="text-left">รายการ</th><th className="text-left">ตำแหน่งตอนนี้</th><th className="text-left">สถานะหยิบ</th><th /></tr></thead>
        <tbody>
          {rows.map(({ booking, item, task, job }) => (
            <tr key={booking.id} className="border-t border-[var(--border-color)] align-top">
              <td className="py-1.5 font-mono text-blue-400">{item!.id}</td>
              <td className="py-1.5">{productNameThai(item!.productName)} · {item!.totalWeightTons.toFixed(3)} ตัน<div><StatusBadge status={item!.canonicalStatus} size="sm" /></div></td>
              <td className="py-1.5">{bayLabel(item!.locationBay)}</td>
              <td className="py-1.5">{task ? PICK_STATE_LABEL[task.state] || task.state : job ? `แปรรูป: ${PROCESSING_STATE_LABEL[job.status] || job.status}` : 'รอออกใบงาน'}</td>
              <td className="py-1.5 text-right">
                {task ? <button onClick={() => onOpenTask(task.id)} className="text-blue-300 underline">เปิดใบหยิบ</button> : <button onClick={() => navigateToWorkspace('WMS-07')} className="text-purple-300 underline">คิวแปรรูป</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {step === 'picking' && (
        <p className="rounded bg-[var(--bg-shell)] px-2 py-1.5 text-amber-200">
          รอหยิบให้ครบก่อนรวมของที่ประตู · ยังไม่หยิบ {waitingPick.length} รายการ · รอแปรรูป/QC {waitingProcessing.length} รายการ
        </p>
      )}

      {step === 'stage' && (
        <div className="flex flex-col gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
          <RoleStepHint roles={['crane_operator']} action="รวมของทั้งใบสั่งที่ประตู" />
          <div className="font-semibold">หยิบครบทุกรายการแล้ว · รวมของที่ประตู {group?.stagingGate}</div>
          {ORDER_CHECKS.map((label, index) => (
            <label key={label} className="flex items-center gap-2">
              <input type="checkbox" checked={checks[index]} disabled={currentRole !== 'crane_operator'} onChange={(event) => setChecks((current) => current.map((value, position) => (position === index ? event.target.checked : value)))} />
              {label}
            </label>
          ))}
          <button disabled={!canStage || currentRole !== 'crane_operator'} onClick={() => stageOrderAtGate(soNumber)} className="rounded bg-blue-600 px-3 py-2 font-bold text-white disabled:opacity-40">วางของทั้งใบสั่งที่ประตู {group?.stagingGate} แล้ว</button>
        </div>
      )}

      {step === 'confirm' && (
        <div className="flex flex-col gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3">
          <RoleStepHint roles={['warehouse_manager']} action="ตรวจของที่ประตูและยืนยันพร้อมส่งทั้งใบสั่ง [08]" />
          <div>ของทั้ง {open.length} รายการอยู่ที่ประตู {group?.stagingGate} แล้ว · ผู้จัดการตรวจและยืนยันครั้งเดียวทั้งใบสั่ง</div>
          <button disabled={currentRole !== 'warehouse_manager'} onClick={() => confirmOrderReady08(soNumber)} className="rounded bg-indigo-600 px-3 py-2 font-bold text-white disabled:opacity-40">ยืนยันพร้อมส่งทั้งใบสั่ง [08] · แจ้ง Logistics App</button>
        </div>
      )}

      {step === 'done' && <p className="rounded bg-emerald-500/10 px-2 py-1.5 text-emerald-300">ทั้งใบสั่งพร้อมส่งมอบ [08] ที่ประตู {group?.stagingGate} · ส่งต่อให้ Logistics รับขึ้นรถ</p>}
    </div>
  );
};
