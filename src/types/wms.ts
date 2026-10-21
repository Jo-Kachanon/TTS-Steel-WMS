export type CanonicalProductStatus =
  | '01' // [01] สินค้าคงเหลือจริง (On-hand Inventory)
  | '02' // [02] สินค้าพร้อมเสนอขาย (Available to Promise)
  | '03' // [03] สินค้ารอยืนยันขาย (Soft Hold)
  | '04' // [04] สินค้าจองตามใบสั่งขาย (Reserved)
  | '05' // [05] สินค้ารอแปรรูป (Pending Processing)
  | '06' // [06] สินค้าระหว่างแปรรูป (Work in Process)
  | '07' // [07] สินค้าที่ไม่ผ่าน/ของเสีย (Nonconforming Product)
  | '08' // [08] สินค้าพร้อมส่งมอบ (Ready for Delivery)
  | '09' // [09] สินค้าระหว่างขนส่ง (In Transit)
  | '10' // [10] สินค้าส่งมอบแล้ว (Delivered)
  | '11'; // [11] สินค้ารอการตรวจสอบเคลมหรือส่งคืน (Claim/Return Pending)

export interface StockWorkTypeConfig {
  sku: string;
  workType: 'FINISHED' | 'PROCESSING';
  processingDays: number;
}

export type StockBookingStatus =
  | 'WAITING_WAREHOUSE'
  | 'WAITING_SALES_ACK'
  | 'WAITING_APPROVED_SO'
  | 'RESERVED'
  | 'EXPIRED'
  | 'CANCELLED';

/** One booking request = one customer quotation; each booked lot is a StockBooking line in the group. */
export interface StockBookingGroup {
  id: string;
  customerName: string;
  requesterRole: UserRole;
  createdAt: string;
  expiresAt: string;
  status: 'OPEN' | 'RESERVED' | 'EXPIRED';
  quotation?: BookingQuotation;
  /** Expected Delivery Date from the quotation; also the date the warehouse prepares and stages goods. */
  deliveryDate?: string;
  /** Read-only gate assigned by the Logistics App. */
  stagingGate?: string;
  confirmedAt?: string;
}

/** Damage found after booking review (while picking or at processing QC); resolved on the booking card. */
export interface BookingException {
  source: 'PICK' | 'QC';
  damagedLotId: string;
  damagedQtyTons: number;
  reason: string;
  reportedAt: string;
  suggestedLotId?: string;
  status: 'WAITING_WAREHOUSE' | 'WAITING_SALES' | 'RESOLVED' | 'CLOSED_NO_REPLACEMENT';
  replacementBookingId?: string;
}

export interface StockBooking {
  id: string;
  groupId: string;
  lotId: string;
  sourceLotId?: string;
  requesterRole: UserRole;
  createdAt: string;
  expiresAt: string;
  status: StockBookingStatus;
  customerName?: string;
  warehouseReply?: {
    foundLocation: string;
    condition: 'NORMAL' | 'DAMAGED';
    damagedQtyTons: number;
    suggestedLotId?: string;
    suggestedDays: number;
    committedDays: number;
    readyDate: string;
    note: string;
    operator: string;
    sentAt: string;
  };
  salesAcknowledgedAt?: string;
  damagedLotId?: string;
  approvedSoReference?: string;
  exception?: BookingException;
  /** Set when this line replaces a damaged line in the same group. */
  replacesBookingId?: string;
  preparationDate?: string;
  deliveryDate?: string;
  stagingGate?: string;
  operationCreated?: boolean;
}

/** Signed customer quotation (ใบเสนอราคา) that confirms a booking from [03] to [04]. */
export interface QuotationItem {
  lineNo: number;
  productCode: string;
  description: string;
  lotNo: string;
  warehouse: string;
  qty: number;
  unit: string;
  /** Booked lot this quotation line maps to; undefined when the line has no booked lot. */
  matchedLotId?: string;
}

export interface BookingQuotation {
  quotationNo: string;
  /** Where the prefilled data came from: text read from the PDF, or the booked lots when the PDF has no text layer. */
  prefillSource: 'PDF' | 'BOOKING';
  items: QuotationItem[];
  quotationDate: string;
  validUntil: string;
  expectedDeliveryDate: string;
  customerConfirmed: boolean;
  fileName: string;
  fileSizeBytes: number;
  /** Kept only for small files so the mock can reopen the attachment from localStorage. */
  fileDataUrl?: string;
  uploadedAt: string;
}

export interface StatusMeta {
  code: CanonicalProductStatus;
  labelTh: string;
  labelEn: string;
  authority: 'SYSTEM_ONE' | 'WMS' | 'LOGISTICS';
  color: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

export const CANONICAL_STATUS_MAP: Record<CanonicalProductStatus, StatusMeta> = {
  '01': {
    code: '01',
    labelTh: 'สินค้าคงเหลือจริง',
    labelEn: 'On-hand Inventory',
    authority: 'SYSTEM_ONE',
    color: '#0284c7',
    badgeBg: 'bg-sky-500/10',
    badgeBorder: 'border-sky-500/30',
    badgeText: 'text-sky-400',
  },
  '02': {
    code: '02',
    labelTh: 'สินค้าพร้อมเสนอขาย',
    labelEn: 'Available to Promise',
    authority: 'SYSTEM_ONE',
    color: '#10b981',
    badgeBg: 'bg-emerald-500/10',
    badgeBorder: 'border-emerald-500/30',
    badgeText: 'text-emerald-400',
  },
  '03': {
    code: '03',
    labelTh: 'สินค้ารอยืนยันขาย',
    labelEn: 'Soft Hold',
    authority: 'SYSTEM_ONE',
    color: '#f59e0b',
    badgeBg: 'bg-amber-500/10',
    badgeBorder: 'border-amber-500/30',
    badgeText: 'text-amber-400',
  },
  '04': {
    code: '04',
    labelTh: 'สินค้าจองตามใบสั่งขาย',
    labelEn: 'Reserved',
    authority: 'WMS',
    color: '#6366f1',
    badgeBg: 'bg-indigo-500/10',
    badgeBorder: 'border-indigo-500/30',
    badgeText: 'text-indigo-400',
  },
  '05': {
    code: '05',
    labelTh: 'สินค้ารอแปรรูป',
    labelEn: 'Pending Processing',
    authority: 'WMS',
    color: '#8b5cf6',
    badgeBg: 'bg-purple-500/10',
    badgeBorder: 'border-purple-500/30',
    badgeText: 'text-purple-400',
  },
  '06': {
    code: '06',
    labelTh: 'สินค้าระหว่างแปรรูป',
    labelEn: 'Work in Process',
    authority: 'WMS',
    color: '#06b6d4',
    badgeBg: 'bg-cyan-500/10',
    badgeBorder: 'border-cyan-500/30',
    badgeText: 'text-cyan-400',
  },
  '07': {
    code: '07',
    labelTh: 'สินค้าที่ไม่ผ่าน/ของเสีย',
    labelEn: 'Nonconforming Product',
    authority: 'WMS',
    color: '#ef4444',
    badgeBg: 'bg-rose-500/10',
    badgeBorder: 'border-rose-500/30',
    badgeText: 'text-rose-400',
  },
  '08': {
    code: '08',
    labelTh: 'สินค้าพร้อมส่งมอบ',
    labelEn: 'Ready for Delivery',
    authority: 'WMS',
    color: '#0ea5e9',
    badgeBg: 'bg-blue-500/10',
    badgeBorder: 'border-blue-500/30',
    badgeText: 'text-blue-400',
  },
  '09': {
    code: '09',
    labelTh: 'สินค้าระหว่างขนส่ง',
    labelEn: 'In Transit',
    authority: 'LOGISTICS',
    color: '#38bdf8',
    badgeBg: 'bg-sky-400/10',
    badgeBorder: 'border-sky-400/30',
    badgeText: 'text-sky-300',
  },
  '10': {
    code: '10',
    labelTh: 'สินค้าส่งมอบแล้ว',
    labelEn: 'Delivered',
    authority: 'LOGISTICS',
    color: '#22c55e',
    badgeBg: 'bg-green-500/10',
    badgeBorder: 'border-green-500/30',
    badgeText: 'text-green-400',
  },
  '11': {
    code: '11',
    labelTh: 'สินค้ารอการตรวจสอบเคลมหรือส่งคืน',
    labelEn: 'Claim/Return Pending',
    authority: 'LOGISTICS',
    color: '#f43f5e',
    badgeBg: 'bg-rose-600/15',
    badgeBorder: 'border-rose-600/40',
    badgeText: 'text-rose-300',
  },
};

export type PickTaskState =
  | 'queued'
  | 'assigned'
  | 'picking'
  | 'partial_exception'
  | 'picked'
  | 'qc_packing'
  | 'staged'
  | 'ready';

export type UserRole =
  | 'sales_rep'
  | 'warehouse_manager'
  | 'planning_approver'
  | 'crane_operator'
  | 'qc_inspector'
  | 'logistics_clerk'
  | 'system_admin';

export interface UserRoleMeta {
  role: UserRole;
  titleTh: string;
  titleEn: string;
  name: string;
  initials: string;
  badgeColor: string;
}

export const USER_ROLES: Record<UserRole, UserRoleMeta> = {
  sales_rep: {
    role: 'sales_rep',
    titleTh: 'ฝ่ายขาย',
    titleEn: 'Sales Rep',
    name: 'กิตติชัย ฤ.',
    initials: 'KR',
    badgeColor: 'bg-blue-600',
  },
  warehouse_manager: {
    role: 'warehouse_manager',
    titleTh: 'ผู้จัดการคลังสินค้า',
    titleEn: 'Warehouse Manager',
    name: 'สุชาติ ม.',
    initials: 'SM',
    badgeColor: 'bg-indigo-600',
  },
  planning_approver: {
    role: 'planning_approver',
    titleTh: 'ผู้อนุมัติแผนคลัง',
    titleEn: 'Warehouse Plan Approver',
    name: 'อรทัย พ.',
    initials: 'OP',
    badgeColor: 'bg-violet-600',
  },
  crane_operator: {
    role: 'crane_operator',
    titleTh: 'ผู้ควบคุมเครน / ลาน',
    titleEn: 'Crane / Yard Operator',
    name: 'สมหมาย ช.',
    initials: 'SC',
    badgeColor: 'bg-amber-600',
  },
  qc_inspector: {
    role: 'qc_inspector',
    titleTh: 'เจ้าหน้าที่ตรวจสอบคุณภาพ',
    titleEn: 'QC Inspector',
    name: 'วิโรจน์ ป.',
    initials: 'WP',
    badgeColor: 'bg-purple-600',
  },
  logistics_clerk: {
    role: 'logistics_clerk',
    titleTh: 'เจ้าหน้าที่ธุรการจัดส่ง',
    titleEn: 'Logistics Clerk',
    name: 'นงลักษณ์ ท.',
    initials: 'NT',
    badgeColor: 'bg-cyan-600',
  },
  system_admin: {
    role: 'system_admin',
    titleTh: 'ผู้ดูแลระบบระบบคลัง',
    titleEn: 'System Admin',
    name: 'ธนพล ส.',
    initials: 'TS',
    badgeColor: 'bg-slate-600',
  },
};

export type WarehouseId = 'WH-01' | 'WH-02' | 'WH-03';

export interface WarehouseMeta {
  id: WarehouseId;
  nameTh: string;
  desc: string;
  currentCapacityTons: number;
  maxCapacityTons: number;
}

export interface InventoryItem {
  id: string; // e.g. L-24-0988
  lotNumber: string;
  heatNumber: string;
  productCode: string;
  productName: string;
  sourceLotId?: string;
  grade: string;
  standard: string;
  dimensions: string;
  lengthM: number;
  totalWeightTons: number;
  availableWeightTons: number;
  reservedWeightTons: number;
  pieces: number;
  locationBay: string;
  zone: string;
  ageDays: number;
  agingCategory: 'STANDARD' | 'P1_CLEARANCE' | 'CRITICAL';
  canonicalStatus: CanonicalProductStatus;
  statusVersion: string;
  rfidTag: string;
  physicalCondition: 'NORMAL' | 'BENT_END' | 'SURFACE_RUST' | 'SEVERELY_DAMAGED';
  damageNote?: string;
  isExcluded: boolean;
  exclusionReason?: string;
  lastUpdated: string;
}

export interface CandidateRecommendation {
  rank: number;
  item: InventoryItem;
  fitPercent: number;
  reason: string;
  isAgingPriority: boolean;
  selectedQty: number;
  isSelected: boolean;
}

export interface SOLine {
  lineNumber: number;
  productCode: string;
  specDescription: string;
  requestedQtyTons: number;
  requestedPieces: number;
  uom: string;
  selectedQtyTons: number;
  remainingQtyTons: number;
  selectionStatus:
    | 'NOT_STARTED'
    | 'SELECTION_PENDING'
    | 'ACK_PENDING'
    | 'RETRYING'
    | 'STALE'
    | 'REJECTED'
    | 'SOFT_HOLD'
    | 'RESERVED';
  selectionId?: string;
  selectedLotIds: string[];
  /** Quantity physically held in [04]; independent from the quantity Sales chooses to issue. */
  reservationSlices?: { lotId: string; qtyTons: number }[];
  selectionSlices: { lotId: string; qtyTons: number }[];
  bypassReason?: string;
  systemOneResponse?: {
    ackStatus: 'ACK_200' | 'RETRY_SCHEDULED' | 'REJECTED' | 'STALE_LOCK';
    message: string;
    receivedAt: string;
  };
}

export interface SORequest {
  id: string;
  soNumber: string;
  customerName: string;
  requestDate: string;
  status:
    | 'DRAFT'
    | 'VERIFIED'
    | 'SELECTION_PENDING'
    | 'SOFT_HOLD'
    | 'RESERVED'
    | 'ALLOCATED'
    | 'PICKED'
    | 'DELIVERED';
  ocrConfidence: number;
  ocrState: 'PARSE_SUCCESS' | 'LOW_CONFIDENCE' | 'PARSE_FAILED' | 'STALE' | 'TIMEOUT';
  ocrRecoveryOwner?: string;
  ocrRecoveryNote?: string;
  fileFingerprint: string;
  fileName: string;
  lines: SOLine[];
  approvalRef: string;
  paymentAttestRef: string;
  optimisticLockVersion: string;
  bookingRequest?: {
    bookingId: string;
    status: 'REQUESTED' | 'CONFIRMED' | 'CHANGED' | 'CANCELLED';
    vehicleType: string;
    requestedDate: string;
    bookedTons: number;
    impactNote: string;
  };
}

export interface PickTask {
  id: string;
  pickNumber: string;
  soNumber: string;
  lineNumber: number;
  customerName: string;
  lotId: string;
  productSpec: string;
  targetBay: string;
  stagingGate: string;
  allocatedQtyTons: number;
  actualPickedQtyTons: number;
  shortQtyTons: number;
  blockedQtyTons: number;
  remainingQtyTons: number;
  state: PickTaskState;
  operator: string;
  assignedAt: string;
  completedAt?: string;
  notes?: string;
  barcodeVerified: boolean;
  qcChecklist: {
    strappingSecure: boolean;
    specTagMatches: boolean;
    gaugeToleranceOk: boolean;
    doDocsPrepared: boolean;
    designatedZonePlaced: boolean;
  };
  damagedException?: {
    reason: string;
    affectedQtyTons: number;
    unaffectedQtyTons: number;
    timestamp: string;
    processingJobId?: string;
    replacementLotId?: string;
  };
  readinessConfirmed: boolean;
  readinessVersion: string;
  whx01EventId?: string;
  manifestNumber?: string;
  driverName?: string;
  vehiclePlate?: string;
  outboundHandoverAccepted?: boolean;
  pickedUpQtyTons?: number;
  deliveredQtyTons?: number;
  transitInventoryItemIds?: string[];
  claimInventoryItemIds?: string[];
  deliveryFailureNote?: string;
  claimQtyTons?: number;
  claimReason?: string;
}

export interface ProcessingJob {
  id: string;
  jobNumber: string;
  jobType: 'DAMAGE_REWORK' | 'CUSTOMER_SPEC_CUTTING' | 'DEFECT_REMOVAL';
  inputLotId: string;
  inputStatus: CanonicalProductStatus;
  inputQtyTons: number;
  outputQtyTons: number;
  scrapQtyTons: number;
  remainingQtyTons: number;
  status: 'PENDING' | 'IN_PROCESS' | 'QC_INSPECTION' | 'COMPLETED';
  finalDisposition?: 'PASS_02' | 'PASS_04_RESERVED' | 'FAIL_07' | 'MIXED_02_07';
  failQtyTons?: number;
  operator: string;
  machine: string;
  notes: string;
  linkedSoNumber?: string;
  replacementLinkedLotId?: string;
  createdAt: string;
  completedAt?: string;
  physicalReceiptConfirmed: boolean;
  qcInspectionNotes?: string;
  startedAt?: string;
  physicalReceiptAt?: string;
  /** Operator marks processing finished; the job then waits for QC (status QC_INSPECTION). */
  processingFinishedAt?: string;
}

export interface MovementTransfer {
  id: string;
  transferNumber: string;
  lotId: string;
  productSpec: string;
  fromBay: string;
  toBay: string;
  qtyTons: number;
  status:
    | 'REQUESTED'
    | 'APPROVED'
    | 'MOVER_DISPATCHED'
    | 'RECEIVED'
  | 'DISCREPANCY'
  | 'REJECTED';
  requester: string;
  requestedAt: string;
  approver?: string;
  approvedAt?: string;
  mover?: string;
  dispatchedAt?: string;
  moverCompletedAt?: string;
  receiver?: string;
  receivedAt?: string;
  receivedQtyTons?: number;
  discrepancyNote?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  evidence?: string;
  reason: string;
  capacityChecked: boolean;
  specCompatible: boolean;
  timestamp: string;
  preservedStatus: CanonicalProductStatus;
  preservedReceiveDate: string;
  movementId?: string;
  receivedSliceId?: string;
  unreceivedQtyTons?: number;
}

export interface StockReplacementProposal {
  id: string;
  soNumber: string;
  lineNumber: number;
  originalLotId: string;
  proposedLotId: string;
  heldLotId?: string;
  originalBay: string;
  proposedBay: string;
  qtyTons: number;
  defectNote: string;
  evidence: string;
  status:
    | 'PROPOSED'
    | 'SALES_ACCEPTED'
    | 'SALES_REJECTED'
    | 'SYSTEM_ONE_PENDING'
    | 'SYSTEM_ONE_HOLD'
    | 'MANAGER_APPROVED';
  proposedBy: string;
  proposedAt: string;
  respondedBy?: string;
  respondedAt?: string;
}

export interface AdjustmentProposal {
  id: string;
  lotId: string;
  beforeQtyTons: number;
  deltaQtyTons: number;
  afterQtyTons: number;
  reason: string;
  evidence: string;
  stockVersion: string;
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED';
  proposer: string;
  proposedAt: string;
  reviewer?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface StatusCorrectionProposal {
  id: string;
  lotId: string;
  beforeStatus: CanonicalProductStatus;
  afterStatus: CanonicalProductStatus;
  qtyTons: number;
  sourceRef: string;
  expectedVersion: string;
  reason: string;
  evidence: string;
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED';
  proposer: string;
  proposedAt: string;
  reviewer?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface IntegrationMessage {
  id: string;
  source: 'SYSTEM_ONE' | 'WMS' | 'DATA_BUCKET' | 'LOGISTICS_APP';
  target: 'SYSTEM_ONE' | 'WMS' | 'DATA_BUCKET' | 'LOGISTICS_APP';
  direction: 'INBOUND' | 'OUTBOUND';
  schema: string;
  event: string;
  correlationId: string;
  idempotencyKey: string;
  dependencies: string[];
  transportAck: boolean;
  businessAck: boolean;
  status: 'SUCCESS' | 'RETRYING' | 'FAILED' | 'PENDING';
  attempts: number;
  owner: string;
  entityRef?: string;
  createdAt?: string;
  updatedAt?: string;
  retryable?: boolean;
  errorCode?: string;
  payloadSummary?: string;
  errorDetail?: string;
  history: string[];
}

export interface ReconciliationRecord {
  id: string;
  lotId: string;
  productName: string;
  locationBay: string;
  expectedQtyTons: number;
  actualCountQtyTons: number;
  varianceTons: number;
  expectedStatus: CanonicalProductStatus;
  actualStatus: CanonicalProductStatus;
  expectedVersion: string;
  actualVersion: string;
  status: 'MATCH' | 'DISCREPANCY';
  correctionProposalId?: string;
}

export interface ClearanceScenario {
  horizonMonths: 3 | 6 | 9 | 12 | 24 | 36;
  monthlyRunRateTons: number;
  feasibility: 'HIGH' | 'MEDIUM' | 'CAPACITY_CONSTRAINED';
  craneCapacityGapPercent: number;
  reason: string;
}

export interface ClearancePlan {
  id: string;
  planCode: string;
  title: string;
  baselineDate: string;
  baselineFrozenTons: number;
  targetTons: number;
  targetPercent: number;
  activeHorizonMonths: 3 | 6 | 9 | 12 | 24 | 36;
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'ACTIVE' | 'PAUSED' | 'CLOSED' | 'REJECTED';
  version: string;
  submittedBy?: string;
  reviewedBy?: string;
  activatedBy?: string;
  dataQualityWarning?: string;
  monthlyTargets: {
    month: string;
    targetTons: number;
    actualClearedTons: number; // only accepted LGX-03
    varianceTons: number;
    owner: string;
    status: 'ON_TRACK' | 'BEHIND' | 'COMPLETED';
  }[];
  resourceAssumptions?: {
    craneTonsPerShift: number;
    shiftsPerDay: number;
    workDaysPerMonth: number;
    craneClearanceSharePct: number;
  };
  scenarios: ClearanceScenario[];
  history: { date: string; action: string; actor: string; note: string }[];
}

export interface AuditEvent {
  id: string; // e.g. EVT-2024-9912
  timestamp: string;
  lotId: string;
  productSpec: string;
  qtyTons: number;
  uom: string;
  fromStatus: string;
  toStatus: string;
  trigger: string;
  actor: string;
  reason: string;
  boundary: 'SYSTEM_ONE' | 'WMS' | 'LOGISTICS' | 'YARD';
  correlationId: string;
  transportAck: boolean;
  businessAck: boolean;
  version: string;
  details?: Record<string, unknown>;
}

export interface AllocationPolicy {
  id: string;
  name: string;
  version: string;
  status: 'ACTIVE' | 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  description: string;
  agingThresholdDays?: number;
  rules: {
    ruleName: string;
    weight: number;
    description: string;
  }[];
  bypassRequiresReason: boolean;
  createdBy?: string;
  submittedBy?: string;
  approvedBy?: string;
  activatedBy?: string;
  reviewNote?: string;
  updatedAt?: string;
}
