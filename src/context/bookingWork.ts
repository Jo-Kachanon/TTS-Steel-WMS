import { InventoryItem, PickTask, ProcessingJob, StockBooking, StockBookingGroup } from '../types/wms';

/** Gate names published by the Logistics App (mocked until the real integration exists). */
export const LOGISTICS_GATES = ['M2', 'M3', 'G1', 'G2', 'G3'] as const;

/**
 * Mock Logistics App lookup: the gate is owned by Logistics and only read here.
 * A stable hash keeps the same booking on the same gate across reloads.
 */
export const lookupLogisticsGate = (groupId: string, deliveryDate: string): string => {
  const key = `${groupId}|${deliveryDate}`;
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  return LOGISTICS_GATES[hash % LOGISTICS_GATES.length];
};

/** Goods must be staged at the Logistics gate one day before the quotation delivery date. */
export const stagingDueDate = (deliveryDate?: string): string => {
  if (!deliveryDate) return '';
  const date = new Date(`${deliveryDate}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const shortTimestamp = (date: Date): string => date.toISOString().slice(0, 16).replace('T', ' ');

/** Stock requisition (ใบเบิกสินค้า) for customer delivery, created from a reserved booking line. */
export const buildBookingPickTask = (
  booking: StockBooking,
  item: InventoryItem,
  group: StockBookingGroup,
  now: Date,
): PickTask => {
  const taskId = `PICK-${now.getTime()}-${item.id.slice(-4)}`;
  return {
    id: taskId,
    pickNumber: taskId,
    soNumber: booking.approvedSoReference || group.quotation?.quotationNo || group.id,
    lineNumber: 1,
    customerName: group.customerName,
    lotId: item.id,
    productSpec: `${item.productName} ${item.dimensions}`,
    targetBay: item.locationBay,
    stagingGate: group.stagingGate || '',
    allocatedQtyTons: item.totalWeightTons,
    actualPickedQtyTons: 0,
    shortQtyTons: 0,
    blockedQtyTons: 0,
    remainingQtyTons: item.totalWeightTons,
    state: 'queued',
    operator: '',
    assignedAt: shortTimestamp(now),
    barcodeVerified: false,
    qcChecklist: { strappingSecure: false, specTagMatches: false, gaugeToleranceOk: false, doDocsPrepared: false, designatedZonePlaced: false },
    readinessConfirmed: false,
    readinessVersion: 'v1',
  };
};

/** Product requisition for processing (ใบเบิกสินค้าเพื่อผลิตหรือแปรรูป), created from a reserved booking line. */
export const buildBookingProcessingJob = (
  booking: StockBooking,
  item: InventoryItem,
  group: StockBookingGroup,
  now: Date,
): ProcessingJob => {
  const jobId = `JOB-${now.getTime()}-${item.id.slice(-4)}`;
  return {
    id: jobId,
    jobNumber: jobId,
    jobType: 'CUSTOMER_SPEC_CUTTING',
    inputLotId: item.id,
    inputStatus: '05',
    inputQtyTons: item.totalWeightTons,
    outputQtyTons: 0,
    scrapQtyTons: 0,
    remainingQtyTons: item.totalWeightTons,
    status: 'PENDING',
    operator: '',
    machine: 'เครื่องแปรรูปทั่วไป',
    notes: `งานตามใบเสนอราคา ${booking.approvedSoReference}; แปรรูปและตรวจ QC ให้เสร็จ แล้ววางที่ประตู ${group.stagingGate} ภายใน ${stagingDueDate(group.deliveryDate)} (ส่ง ${group.deliveryDate})`,
    linkedSoNumber: booking.approvedSoReference,
    createdAt: shortTimestamp(now),
    physicalReceiptConfirmed: false,
  };
};
