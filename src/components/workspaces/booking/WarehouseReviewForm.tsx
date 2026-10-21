import React, { useState } from 'react';
import { InventoryItem, StockBooking, StockWorkTypeConfig } from '../../../types/wms';
import { stagingDueDate } from '../../../context/bookingWork';
import { INPUT_CLASS, LABEL_CLASS, bayLabel } from './bookingUi';

type ReviewInput = Omit<NonNullable<StockBooking['warehouseReply']>, 'operator' | 'sentAt'>;

interface WarehouseReviewFormProps {
  item: InventoryItem;
  inventory: InventoryItem[];
  config?: StockWorkTypeConfig;
  queueAhead: number;
  deliveryDate?: string;
  onSubmit: (input: ReviewInput) => boolean;
}

const addDays = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Warehouse check of one booked lot: location defaults to the system location; only a mismatch needs typing. */
export const WarehouseReviewForm: React.FC<WarehouseReviewFormProps> = ({ item, inventory, config, queueAhead, deliveryDate, onSubmit }) => {
  const isProcessing = config?.workType === 'PROCESSING';
  const suggestedDays = isProcessing ? config!.processingDays * Math.max(1, queueAhead + 1) : 0;
  const [locationMatches, setLocationMatches] = useState(true);
  const [actualLocation, setActualLocation] = useState('');
  const [days, setDays] = useState<number | ''>(isProcessing ? '' : 0);
  const [damaged, setDamaged] = useState(false);
  const [damagedQty, setDamagedQty] = useState(item.totalWeightTons);
  const [replacementLotId, setReplacementLotId] = useState('');
  const [note, setNote] = useState('');

  const readyDate = days === '' ? '' : addDays(Number(days));
  const stagingDue = stagingDueDate(deliveryDate);
  const lateForDelivery = Boolean(stagingDue && readyDate && readyDate > stagingDue);
  const replacementCandidates = inventory.filter((stock) => stock.id !== item.id && stock.productCode === item.productCode && stock.canonicalStatus === '02' && stock.physicalCondition === 'NORMAL' && stock.availableWeightTons >= item.totalWeightTons);
  const invalid = (!locationMatches && !actualLocation.trim()) || days === '' || days < 0 || (damaged && (damagedQty <= 0 || damagedQty > item.totalWeightTons));

  const submit = () => {
    if (invalid) return;
    onSubmit({
      foundLocation: locationMatches ? item.locationBay : actualLocation,
      condition: damaged ? 'DAMAGED' : 'NORMAL',
      damagedQtyTons: damaged ? damagedQty : 0,
      suggestedLotId: damaged ? replacementLotId || undefined : undefined,
      suggestedDays,
      committedDays: Number(days),
      readyDate,
      note,
    });
  };

  return (
    <div className="mt-3 grid gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3 sm:grid-cols-2">
      <div className="text-xs font-semibold sm:col-span-2">
        ตรวจสินค้า · {isProcessing ? `เหล็กแปรรูป · ระบบแนะนำ ${suggestedDays} วัน (มาตรฐาน ${config!.processingDays} วัน · คิวเดียวกัน ${queueAhead} งาน)` : 'เหล็กสำเร็จรูป · หยิบได้เลย'}
      </div>
      <div className={`${LABEL_CLASS} sm:col-span-2`}>
        ตำแหน่งตามระบบ: <strong className="text-[var(--text-primary)]">{bayLabel(item.locationBay)}</strong>
        <div className="mt-1 flex gap-2">
          <button type="button" onClick={() => setLocationMatches(true)} className={`rounded border px-2 py-1 ${locationMatches ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-[var(--border-color)]'}`}>ตรงตามระบบ</button>
          <button type="button" onClick={() => setLocationMatches(false)} className={`rounded border px-2 py-1 ${!locationMatches ? 'border-amber-500 bg-amber-500/15 text-amber-300' : 'border-[var(--border-color)]'}`}>ไม่ตรง · กรอกตำแหน่งจริง</button>
        </div>
        {!locationMatches && <input aria-label="ตำแหน่งที่พบจริง" value={actualLocation} onChange={(event) => setActualLocation(event.target.value)} placeholder="เช่น 03-C2" className={INPUT_CLASS} />}
      </div>
      <label className={LABEL_CLASS}>วันที่ต้องรอ (วัน) · คลังกรอกเอง
        <input type="number" min="0" value={days} onChange={(event) => setDays(event.target.value === '' ? '' : Number(event.target.value))} className={INPUT_CLASS} />
      </label>
      <label className={LABEL_CLASS}>ผลตรวจสภาพ
        <select value={damaged ? 'DAMAGED' : 'NORMAL'} onChange={(event) => { setDamaged(event.target.value === 'DAMAGED'); setDamagedQty(item.totalWeightTons); }} className={INPUT_CLASS}>
          <option value="NORMAL">สภาพปกติ</option>
          <option value="DAMAGED">พบชำรุด · แยกส่วนเสียเป็น [07]</option>
        </select>
      </label>
      {damaged && (
        <label className={LABEL_CLASS}>น้ำหนักที่ชำรุด (ตัน)
          <input type="number" min="0.001" max={item.totalWeightTons} step="0.001" value={damagedQty} onChange={(event) => setDamagedQty(Number(event.target.value))} className={INPUT_CLASS} />
        </label>
      )}
      {damaged && (
        <label className={LABEL_CLASS}>ล็อตทดแทนที่แนะนำ
          <select value={replacementLotId} onChange={(event) => setReplacementLotId(event.target.value)} className={INPUT_CLASS}>
            <option value="">ไม่มีข้อเสนอ</option>
            {replacementCandidates.map((stock) => <option key={stock.id} value={stock.id}>{stock.id} · {bayLabel(stock.locationBay)} · {stock.availableWeightTons.toFixed(3)} ตัน</option>)}
          </select>
        </label>
      )}
      <label className={`${LABEL_CLASS} sm:col-span-2`}>หมายเหตุ<textarea value={note} onChange={(event) => setNote(event.target.value)} className={INPUT_CLASS} /></label>
      {lateForDelivery && <p className="text-[11px] text-rose-300 sm:col-span-2">คาดว่าพร้อม {readyDate} ช้ากว่ากำหนดวางที่ประตู {stagingDue} (ก่อนวันส่ง {deliveryDate} 1 วัน) · ระบบจะแจ้งเซลล์</p>}
      <button onClick={submit} disabled={invalid} className="self-end rounded bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50 sm:col-span-2">ส่งผลตรวจให้เซลล์</button>
    </div>
  );
};
