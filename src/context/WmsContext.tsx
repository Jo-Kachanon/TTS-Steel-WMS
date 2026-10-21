import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  CanonicalProductStatus,
  PickTaskState,
  UserRole,
  WarehouseId,
  InventoryItem,
  SORequest,
  PickTask,
  ProcessingJob,
  MovementTransfer,
  StockReplacementProposal,
  ClearancePlan,
  AuditEvent,
  AllocationPolicy,
  AdjustmentProposal,
  StatusCorrectionProposal,
  IntegrationMessage,
  ReconciliationRecord,
  StockBooking,
  StockBookingGroup,
  BookingQuotation,
  StockWorkTypeConfig,
  USER_ROLES,
  CANONICAL_STATUS_MAP,
} from '../types/wms';
import { buildBookingPickTask, buildBookingProcessingJob, lookupLogisticsGate, stagingDueDate } from './bookingWork';
import {
  INITIAL_WAREHOUSES,
  INITIAL_INVENTORY,
  INITIAL_SO_REQUESTS,
  INITIAL_PICK_TASKS,
  INITIAL_PROCESSING_JOBS,
  INITIAL_MOVEMENTS,
  INITIAL_REPLACEMENT_PROPOSALS,
  INITIAL_CLEARANCE_PLAN,
  INITIAL_AUDIT_EVENTS,
  INITIAL_POLICIES,
  INITIAL_INTEGRATION_MESSAGES,
  INITIAL_ADJUSTMENT_PROPOSALS,
  INITIAL_RECONCILIATION_RECORDS,
} from '../data/initialData';

export type WorkspaceId = 'WMS-01' | 'WMS-02' | 'WMS-03' | 'WMS-04' | 'WMS-05' | 'WMS-06' | 'WMS-07' | 'WMS-08' | 'WMS-11';

export interface GateBlockedDetails {
  title: string;
  unmetGates: string[];
  recoveryRoute: string;
  targetWorkspace?: WorkspaceId;
  targetContext?: Record<string, unknown>;
}

interface WmsContextType {
  // Theme & App State
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  selectedWarehouse: WarehouseId;
  setSelectedWarehouse: (wh: WarehouseId) => void;
  activeWorkspace: WorkspaceId;
  setActiveWorkspace: (ws: WorkspaceId) => void;

  // Cross-workspace Context & Deep Links
  navContext: {
    selectedSoId?: string;
    selectedLineNumber?: number;
    selectedLotId?: string;
    returnWorkspace?: WorkspaceId;
    tabIndex?: number;
    tabIntentKey?: number;
  };
  navigateToWorkspace: (
    ws: WorkspaceId,
    ctx?: {
      selectedSoId?: string;
      selectedLineNumber?: number;
      selectedLotId?: string;
      returnWorkspace?: WorkspaceId;
      tabIndex?: number;
    }
  ) => void;

  // Domain Models
  inventory: InventoryItem[];
  soRequests: SORequest[];
  pickTasks: PickTask[];
  processingJobs: ProcessingJob[];
  movements: MovementTransfer[];
  replacementProposals: StockReplacementProposal[];
  clearancePlan: ClearancePlan;
  auditEvents: AuditEvent[];
  policies: AllocationPolicy[];
  activePolicyId: string;
  setActivePolicyId: (id: string) => void;
  integrationMessages: IntegrationMessage[];
  adjustmentProposals: AdjustmentProposal[];
  statusCorrectionProposals: StatusCorrectionProposal[];
  reconciliationRecords: ReconciliationRecord[];
  stockBookings: StockBooking[];
  stockBookingGroups: StockBookingGroup[];
  workTypeConfigs: StockWorkTypeConfig[];
  createStockBookingGroup: (lines: { lotId: string; qtyTons: number }[], customerName: string) => boolean;
  submitWarehouseBookingReview: (bookingId: string, input: Omit<NonNullable<StockBooking['warehouseReply']>, 'operator' | 'sentAt'>) => boolean;
  acknowledgeBookingLeadTime: (bookingId: string) => boolean;
  acceptBookingReplacement: (bookingId: string) => boolean;
  attachBookingQuotation: (groupId: string, quotation: BookingQuotation) => boolean;
  confirmBookingGroup: (groupId: string) => boolean;
  proposeExceptionReplacement: (bookingId: string, replacementLotId: string | undefined) => boolean;
  resolveBookingException: (bookingId: string, acceptReplacement: boolean) => boolean;
  saveWorkTypeConfig: (config: StockWorkTypeConfig) => boolean;

  // Gate Modal
  gateBlocked: GateBlockedDetails | null;
  closeGateModal: () => void;
  triggerGateBlocked: (details: GateBlockedDetails) => void;

  // Core Business Actions
  verifySoRequest: (soId: string) => void;
  uploadSoPdfSimulation: (file: File) => void;
  updateSoLinePermitted: (soId: string, lineNumber: number, spec: string, qtyTons: number, uom: string) => void;
  updateSalesReservationSelection: (soId: string, lineNumber: number, slices: { lotId: string; qtyTons: number }[]) => boolean;
  resolveOcrRecovery: (soId: string, note: string) => void;

  submitSalesSelectionToSystemOne: (
    soId: string,
    lineNumber: number,
    slices: { lotId: string; qtyTons: number }[],
    bypassReason?: string
  ) => Promise<boolean>;
  retrySystemOneSubmission: (soId: string, lineNumber: number) => Promise<boolean>;
  managerApproveAllocation: (soId: string, lineNumber: number) => boolean;
  createPickTaskForReserved: (soId: string, lineNumber: number) => boolean;

  managerAssignPickTask: (taskId: string, operator: string) => boolean;
  updatePickTaskStatus: (taskId: string, newState: PickTaskState, notes?: string, actualPickedQtyTons?: number) => boolean;
  updatePickQcChecklist: (taskId: string, checklist: PickTask['qcChecklist']) => void;
  reportDamagedStockInPicking: (taskId: string, damagedQtyTons: number, reason: string) => boolean;
  managerConfirmStaging08: (taskId: string, designatedZone: string) => boolean;
  amendStagingReadinessWHX02: (taskId: string, reason: string, designatedZone?: string) => boolean;
  cancelStagingReadinessWHX03: (taskId: string, reason: string) => boolean;

  simulateLogisticsHandoverLGX03: (taskId: string, driver: string, plate: string, actualQtyTons?: number) => boolean;
  simulateDeliveryLGX04: (taskId: string) => boolean;
  simulateDeliveryFailureLGX05: (taskId: string, reason: string) => boolean;
  simulateCustomerClaimLGX06: (taskId: string, claimQtyTons: number, defectReason: string) => boolean;

  // 4-Stage Gated Transfer Lifecycle
  requestBayMovement: (lotId: string, toBay: string, qtyTons: number, reason: string) => boolean;
  approveBayMovement: (transferId: string) => boolean;
  rejectBayMovement: (transferId: string, reason: string) => boolean;
  dispatchBayMovementMover: (transferId: string, moverName: string) => boolean;
  confirmBayTransferReceipt: (transferId: string, receivedQtyTons: number, discrepancyNote?: string, evidence?: string) => boolean;

  // Processing & Damage Rework Lifecycle
  approveProcessingJob: (jobId: string) => boolean;
  startProcessingJob: (jobId: string) => boolean;
  confirmProcessingPhysicalReceipt: (jobId: string) => boolean;
  finishProcessingJob: (jobId: string) => boolean;
  stageOrderAtGate: (soNumber: string) => boolean;
  confirmOrderReady08: (soNumber: string) => boolean;
  completeProcessingJobQC: (
    jobId: string,
    passQtyTons: number,
    failQtyTons: number,
    scrapQtyTons: number,
    qcNotes: string
  ) => boolean;

  // Stock Replacement Flow
  proposeStockReplacement: (soNumber: string, lineNumber: number, origLotId: string, proposedLotId: string, qty: number, reason: string) => void;
  acceptReplacementProposal: (proposalId: string) => boolean;
  rejectReplacementProposal: (proposalId: string, reason: string) => boolean;
  managerApproveReplacementHoldToReserved: (proposalId: string) => boolean;
  createPickTaskForReplacement: (proposalId: string) => boolean;

  // Policy & Master Data Controls
  saveClearancePlanDraft: (
    targetTons: number,
    horizonMonths: 3 | 6 | 9 | 12 | 24 | 36,
    resources: NonNullable<ClearancePlan['resourceAssumptions']>
  ) => boolean;
  submitClearancePlanForReview: () => boolean;
  reviewClearancePlan: (action: 'APPROVE' | 'REJECT', note: string) => boolean;
  activateClearancePlan: () => boolean;
  pauseClearancePlan: () => boolean;
  closeClearancePlan: (note: string) => boolean;
  postOpeningStockImport: (items: InventoryItem[], idempotencyKey: string, sourceReference: string) => boolean;
  activatePolicy: (policyId: string) => void;
  saveNewPolicyDraft: (name: string, description: string, rules: AllocationPolicy['rules']) => void;
  submitPolicyForReview: (policyId: string) => boolean;
  reviewPolicy: (policyId: string, action: 'APPROVE' | 'REJECT', note: string) => boolean;
  addAdjustmentProposal: (lotId: string, deltaQtyTons: number, reason: string, evidence: string) => string;
  reviewAdjustmentProposal: (proposalId: string, action: 'APPROVE' | 'REJECT', note: string) => boolean;
  proposeStatusCorrection: (lotId: string, afterStatus: CanonicalProductStatus, sourceRef: string, reason: string, evidence: string) => string;
  reviewStatusCorrectionProposal: (proposalId: string, action: 'APPROVE' | 'REJECT', note: string) => boolean;
  createReconciliationCorrection: (recId: string, note: string) => void;
  retryIntegrationMessage: (msgId: string) => void;
  resetDemoData: () => void;
}

const WmsContext = createContext<WmsContextType | undefined>(undefined);

const getLegacySampleReservationSlices = (): Map<string, number> | null => {
  try {
    const saved = localStorage.getItem('tts_so_requests_v2');
    if (!saved) return null;
    const requests = JSON.parse(saved) as SORequest[];
    const sampleLine = requests
      .find((request) => request.soNumber === 'SO-2024-0892')
      ?.lines.find((line) => line.lineNumber === 1);
    if (sampleLine?.selectionId !== 'SEL-2024-0892-01' || sampleLine.selectionStatus !== 'SOFT_HOLD') return null;
    return new Map(sampleLine.selectionSlices.map((slice) => [slice.lotId, slice.qtyTons]));
  } catch {
    return null;
  }
};

export const WmsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('tts_theme') as 'dark' | 'light') || 'dark';
  });

  const [currentRole, setCurrentRole] = useState<UserRole>('sales_rep');
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseId>('WH-01');
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('WMS-05');
  const [activePolicyId, setActivePolicyId] = useState<string>('POL-01');

  const [navContext, setNavContext] = useState<{
    selectedSoId?: string;
    selectedLineNumber?: number;
    selectedLotId?: string;
    returnWorkspace?: WorkspaceId;
    tabIndex?: number;
    tabIntentKey?: number;
  }>({
    selectedSoId: 'SO-2024-0892',
    selectedLineNumber: 1,
  });

  const [gateBlocked, setGateBlocked] = useState<GateBlockedDetails | null>(null);

  // Domain states with localStorage persistence
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('tts_inventory_v2');
    if (!saved) return INITIAL_INVENTORY;
    const storedInventory = JSON.parse(saved) as InventoryItem[];
    const sampleReservationSlices = getLegacySampleReservationSlices();
    if (!sampleReservationSlices) return storedInventory;
    return storedInventory.map((item) => {
      const reservedQty = sampleReservationSlices.get(item.id);
      return reservedQty !== undefined && item.canonicalStatus === '03'
        ? { ...item, canonicalStatus: '04', availableWeightTons: 0, reservedWeightTons: reservedQty }
        : item;
    });
  });

  const [soRequests, setSoRequests] = useState<SORequest[]>(() => {
    const saved = localStorage.getItem('tts_so_requests_v2');
    if (!saved) return INITIAL_SO_REQUESTS;
    const requests = JSON.parse(saved) as SORequest[];
    if (!getLegacySampleReservationSlices()) return requests;
    return requests.map((request) => request.soNumber !== 'SO-2024-0892'
      ? request
      : {
          ...request,
          status: 'RESERVED',
          lines: request.lines.map((line) => line.lineNumber === 1
            ? {
                ...line,
                selectionStatus: 'RESERVED',
                systemOneResponse: line.systemOneResponse
                  ? { ...line.systemOneResponse, message: 'ยืนยันจองสินค้า [04] ตามใบสั่งขายแล้ว' }
                  : undefined,
              }
            : line),
        });
  });

  const [pickTasks, setPickTasks] = useState<PickTask[]>(() => {
    const saved = localStorage.getItem('tts_pick_tasks_v2');
    return saved ? JSON.parse(saved) : INITIAL_PICK_TASKS;
  });

  const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>(() => {
    const saved = localStorage.getItem('tts_processing_jobs_v2');
    return saved ? JSON.parse(saved) : INITIAL_PROCESSING_JOBS;
  });

  const [movements, setMovements] = useState<MovementTransfer[]>(() => {
    const saved = localStorage.getItem('tts_movements_v2');
    return saved ? JSON.parse(saved) : INITIAL_MOVEMENTS;
  });

  const [replacementProposals, setReplacementProposals] = useState<StockReplacementProposal[]>(() => {
    const saved = localStorage.getItem('tts_replacement_proposals_v2');
    return saved ? JSON.parse(saved) : INITIAL_REPLACEMENT_PROPOSALS;
  });

  const [clearancePlan, setClearancePlan] = useState<ClearancePlan>(() => {
    const saved = localStorage.getItem('tts_clearance_plan_v2');
    return saved ? JSON.parse(saved) : INITIAL_CLEARANCE_PLAN;
  });

  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(() => {
    const saved = localStorage.getItem('tts_audit_events_v2');
    return saved ? JSON.parse(saved) : INITIAL_AUDIT_EVENTS;
  });

  const [policies, setPolicies] = useState<AllocationPolicy[]>(() => {
    const saved = localStorage.getItem('tts_policies_v2');
    return saved ? JSON.parse(saved) : INITIAL_POLICIES;
  });

  const [integrationMessages, setIntegrationMessages] = useState<IntegrationMessage[]>(() => {
    const saved = localStorage.getItem('tts_integration_messages_v2');
    return saved ? JSON.parse(saved) : INITIAL_INTEGRATION_MESSAGES;
  });

  const [adjustmentProposals, setAdjustmentProposals] = useState<AdjustmentProposal[]>(() => {
    const saved = localStorage.getItem('tts_adjustments_v2');
    return saved ? JSON.parse(saved) : INITIAL_ADJUSTMENT_PROPOSALS;
  });

  const [statusCorrectionProposals, setStatusCorrectionProposals] = useState<StatusCorrectionProposal[]>(() => {
    const saved = localStorage.getItem('tts_status_corrections_v1');
    return saved ? JSON.parse(saved) : [];
  });

  const [reconciliationRecords, setReconciliationRecords] = useState<ReconciliationRecord[]>(() => {
    const saved = localStorage.getItem('tts_reconciliations_v2');
    return saved ? JSON.parse(saved) : INITIAL_RECONCILIATION_RECORDS;
  });

  const [stockBookings, setStockBookings] = useState<StockBooking[]>(() => {
    const saved = localStorage.getItem('tts_stock_bookings_v2');
    return saved ? JSON.parse(saved) as StockBooking[] : [];
  });
  const [stockBookingGroups, setStockBookingGroups] = useState<StockBookingGroup[]>(() => {
    const saved = localStorage.getItem('tts_stock_booking_groups_v1');
    return saved ? JSON.parse(saved) as StockBookingGroup[] : [];
  });
  const [workTypeConfigs, setWorkTypeConfigs] = useState<StockWorkTypeConfig[]>(() => {
    const saved = localStorage.getItem('tts_work_type_configs_v2');
    return saved ? JSON.parse(saved) as StockWorkTypeConfig[] : [
      { sku: 'H-SM400-300150', workType: 'FINISHED', processingDays: 0 },
      { sku: 'WF-SM400-200200', workType: 'FINISHED', processingDays: 0 },
      { sku: 'RB-SD40-DB25', workType: 'FINISHED', processingDays: 0 },
      { sku: 'RB-SD40-DB19', workType: 'FINISHED', processingDays: 0 },
      { sku: 'COIL-HR-SS400-30', workType: 'PROCESSING', processingDays: 3 },
      { sku: 'AZ-GL-023-914', workType: 'FINISHED', processingDays: 0 },
      { sku: 'AZ-AZ70-035-914', workType: 'PROCESSING', processingDays: 2 },
      { sku: 'COIL-HR-30MM', workType: 'PROCESSING', processingDays: 3 },
      { sku: 'PL-SS400-9MM', workType: 'PROCESSING', processingDays: 2 },
    ];
  });

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem('tts_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('tts_inventory_v2', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('tts_so_requests_v2', JSON.stringify(soRequests));
  }, [soRequests]);

  useEffect(() => {
    localStorage.setItem('tts_pick_tasks_v2', JSON.stringify(pickTasks));
  }, [pickTasks]);

  useEffect(() => {
    localStorage.setItem('tts_processing_jobs_v2', JSON.stringify(processingJobs));
  }, [processingJobs]);

  useEffect(() => {
    localStorage.setItem('tts_movements_v2', JSON.stringify(movements));
  }, [movements]);

  useEffect(() => {
    localStorage.setItem('tts_replacement_proposals_v2', JSON.stringify(replacementProposals));
  }, [replacementProposals]);

  useEffect(() => {
    localStorage.setItem('tts_clearance_plan_v2', JSON.stringify(clearancePlan));
  }, [clearancePlan]);

  useEffect(() => {
    localStorage.setItem('tts_audit_events_v2', JSON.stringify(auditEvents));
  }, [auditEvents]);

  useEffect(() => {
    localStorage.setItem('tts_policies_v2', JSON.stringify(policies));
  }, [policies]);

  useEffect(() => {
    localStorage.setItem('tts_integration_messages_v2', JSON.stringify(integrationMessages));
  }, [integrationMessages]);

  useEffect(() => {
    localStorage.setItem('tts_adjustments_v2', JSON.stringify(adjustmentProposals));
  }, [adjustmentProposals]);

  useEffect(() => {
    localStorage.setItem('tts_status_corrections_v1', JSON.stringify(statusCorrectionProposals));
  }, [statusCorrectionProposals]);

  useEffect(() => {
    localStorage.setItem('tts_reconciliations_v2', JSON.stringify(reconciliationRecords));
  }, [reconciliationRecords]);

  useEffect(() => {
    localStorage.setItem('tts_stock_bookings_v2', JSON.stringify(stockBookings));
  }, [stockBookings]);

  useEffect(() => {
    localStorage.setItem('tts_stock_booking_groups_v1', JSON.stringify(stockBookingGroups));
  }, [stockBookingGroups]);

  useEffect(() => {
    localStorage.setItem('tts_work_type_configs_v2', JSON.stringify(workTypeConfigs));
  }, [workTypeConfigs]);

  useEffect(() => {
    const expireBookings = () => {
      const now = Date.now();
      const expiredIds = stockBookings
        .filter((booking) => ['WAITING_WAREHOUSE', 'WAITING_SALES_ACK', 'WAITING_APPROVED_SO'].includes(booking.status) && Date.parse(booking.expiresAt) <= now)
        .map((booking) => booking.id);
      if (!expiredIds.length) return;
      const expiring = stockBookings.filter((booking) => expiredIds.includes(booking.id));
      const lots = new Set(expiring.map((booking) => booking.lotId));
      setInventory((current) => current.map((item) => lots.has(item.id) && item.canonicalStatus === '03'
        ? { ...item, canonicalStatus: '02', availableWeightTons: item.totalWeightTons, reservedWeightTons: 0, lastUpdated: new Date().toISOString().slice(0, 16).replace('T', ' ') }
        : item));
      setStockBookings((current) => current.map((booking) => expiredIds.includes(booking.id) ? { ...booking, status: 'EXPIRED' } : booking));
      const expiredGroups = new Set(expiring.map((booking) => booking.groupId));
      setStockBookingGroups((current) => current.map((group) => expiredGroups.has(group.id) && group.status === 'OPEN' ? { ...group, status: 'EXPIRED' } : group));
      addAuditLog(expiring.map((booking) => booking.lotId).join(', '), 'ยกเลิกการจองที่หมดอายุ', 0, 'ตัน', '[03]', '[02]', 'ครบกำหนด 7 วันโดยไม่มีใบเสนอราคาที่ลูกค้ายืนยัน', 'คืนสินค้าเป็นสินค้าพร้อมเสนอขาย', 'WMS');
    };
    expireBookings();
    const timer = window.setInterval(expireBookings, 60_000);
    return () => window.clearInterval(timer);
  }, [stockBookings]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  const closeGateModal = () => setGateBlocked(null);
  const triggerGateBlocked = (details: GateBlockedDetails) => setGateBlocked(details);

  const createStockBookingGroup = (lines: { lotId: string; qtyTons: number }[], customerName: string): boolean => {
    if (currentRole !== 'sales_rep' || !lines.length || !customerName.trim()) return false;
    const resolved = lines.map((line) => ({ line, item: inventory.find((candidate) => candidate.id === line.lotId) }));
    const invalid = resolved.some(({ line, item }) => !item || item.canonicalStatus !== '02' || !Number.isFinite(line.qtyTons) || line.qtyTons <= 0 || line.qtyTons > item.availableWeightTons + 0.001);
    if (invalid || new Set(lines.map((line) => line.lotId)).size !== lines.length) return false;
    const now = new Date();
    const timestamp = now.toISOString();
    const shortTime = timestamp.slice(0, 16).replace('T', ' ');
    const groupId = `BKG-${now.getTime()}`;
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const held = resolved.map(({ line, item }, index) => {
      const isWholeLot = Math.abs(line.qtyTons - item!.totalWeightTons) <= 0.001;
      return { line, item: item!, isWholeLot, bookedId: isWholeLot ? item!.id : `${item!.id}-HOLD-${now.getTime().toString().slice(-5)}${index}` };
    });
    setInventory((current) => current.flatMap((stock) => {
      const entry = held.find((candidate) => candidate.item.id === stock.id);
      if (!entry) return [stock];
      const heldItem: InventoryItem = {
        ...stock,
        id: entry.bookedId,
        lotNumber: entry.isWholeLot ? stock.lotNumber : `${stock.lotNumber}-HOLD`,
        sourceLotId: entry.isWholeLot ? stock.sourceLotId : stock.id,
        totalWeightTons: entry.line.qtyTons,
        availableWeightTons: 0,
        reservedWeightTons: entry.line.qtyTons,
        canonicalStatus: '03',
        lastUpdated: shortTime,
      };
      if (entry.isWholeLot) return [heldItem];
      const remainingItem: InventoryItem = {
        ...stock,
        totalWeightTons: Math.max(0, stock.totalWeightTons - entry.line.qtyTons),
        availableWeightTons: Math.max(0, stock.availableWeightTons - entry.line.qtyTons),
        pieces: Math.max(0, stock.pieces - Math.round(stock.pieces * entry.line.qtyTons / stock.totalWeightTons)),
        lastUpdated: shortTime,
      };
      return [remainingItem, heldItem];
    }));
    setStockBookingGroups((current) => [{ id: groupId, customerName: customerName.trim(), requesterRole: currentRole, createdAt: timestamp, expiresAt, status: 'OPEN' }, ...current]);
    setStockBookings((current) => [
      ...held.map(({ item, isWholeLot, bookedId }, index): StockBooking => ({
        id: `${groupId}-${index + 1}`,
        groupId,
        lotId: bookedId,
        sourceLotId: isWholeLot ? item.sourceLotId : item.id,
        requesterRole: currentRole,
        createdAt: timestamp,
        expiresAt,
        status: 'WAITING_WAREHOUSE',
        customerName: customerName.trim(),
      })),
      ...current,
    ]);
    held.forEach(({ item, line, bookedId }) => addAuditLog(bookedId, item.productName, line.qtyTons, 'ตัน', '[02]', '[03]', 'สร้างการจองสินค้า', `คำขอจอง ${groupId}; รอคลังตรวจ`, 'WMS'));
    return true;
  };

  const submitWarehouseBookingReview = (bookingId: string, input: Omit<NonNullable<StockBooking['warehouseReply']>, 'operator' | 'sentAt'>): boolean => {
    if (!['warehouse_manager', 'crane_operator', 'system_admin'].includes(currentRole)) return false;
    const booking = stockBookings.find((entry) => entry.id === bookingId);
    const item = booking ? inventory.find((entry) => entry.id === booking.lotId) : undefined;
    if (!booking || !item || booking.status !== 'WAITING_WAREHOUSE' || input.committedDays < 0 || input.damagedQtyTons < 0 || input.damagedQtyTons > item.totalWeightTons + 0.001) return false;
    if (input.suggestedLotId) {
      const suggested = inventory.find((entry) => entry.id === input.suggestedLotId);
      // A replacement lot takes over the whole booked quantity; the good remainder returns to [02].
      const requiredQty = item.totalWeightTons;
      if (!suggested || suggested.canonicalStatus !== '02' || suggested.productCode !== item.productCode || suggested.physicalCondition !== 'NORMAL' || suggested.availableWeightTons < requiredQty) return false;
    }
    if (input.condition === 'DAMAGED' && (input.damagedQtyTons <= 0 || input.damagedQtyTons > item.totalWeightTons + 0.001)) return false;
    const sentAt = new Date().toISOString();
    const trimmedLocation = input.foundLocation.trim();
    const foundLocation = /^\d{2}-[A-Z]\d+$/i.test(trimmedLocation) ? `Bay ${trimmedLocation.toUpperCase()}` : trimmedLocation;
    let damagedLotId: string | undefined;
    if (input.condition === 'DAMAGED') {
      damagedLotId = Math.abs(input.damagedQtyTons - item.totalWeightTons) <= 0.001 ? item.id : `${item.id}-DMG-${Date.now().toString().slice(-5)}`;
      setInventory((current) => current.flatMap((entry) => {
        if (entry.id !== item.id) return [entry];
        const timestamp = sentAt.slice(0, 16).replace('T', ' ');
        const damaged: InventoryItem = {
          ...entry, id: damagedLotId!, lotNumber: `${entry.lotNumber}-DMG`,
          totalWeightTons: input.damagedQtyTons, availableWeightTons: 0, reservedWeightTons: 0,
          canonicalStatus: '07', physicalCondition: 'SEVERELY_DAMAGED', isExcluded: true,
          exclusionReason: input.note || 'Operator แจ้งสินค้าชำรุด', lastUpdated: timestamp,
        };
        if (damagedLotId === item.id) return [damaged];
        const remainingQty = Math.max(0, entry.totalWeightTons - input.damagedQtyTons);
        return [
          { ...entry, totalWeightTons: remainingQty, reservedWeightTons: remainingQty, availableWeightTons: 0, pieces: Math.max(0, entry.pieces - Math.round(entry.pieces * input.damagedQtyTons / entry.totalWeightTons)), lastUpdated: timestamp },
          damaged,
        ];
      }));
    } else {
      setInventory((current) => current.map((entry) => entry.id === item.id
        ? { ...entry, locationBay: foundLocation, lastUpdated: sentAt.slice(0, 16).replace('T', ' ') }
        : entry));
    }
    setStockBookings((current) => current.map((entry) => entry.id === bookingId
      ? { ...entry, ...(damagedLotId ? { damagedLotId } : {}), warehouseReply: { ...input, foundLocation, operator: USER_ROLES[currentRole].titleTh, sentAt }, status: 'WAITING_SALES_ACK' }
      : entry));
    addAuditLog(damagedLotId || item.id, item.productName, input.damagedQtyTons || item.totalWeightTons, 'ตัน', '[03]', input.condition === 'DAMAGED' ? '[07]' : '[03]', 'คลังตรวจสินค้าและแจ้งกำหนด', `แจ้งระยะเวลารอ ${input.committedDays} วัน; ${input.note}`, 'WMS');
    return true;
  };

  const acknowledgeBookingLeadTime = (bookingId: string): boolean => {
    if (currentRole !== 'sales_rep') return false;
    const booking = stockBookings.find((entry) => entry.id === bookingId);
    const item = booking ? inventory.find((entry) => entry.id === booking.lotId) : undefined;
    if (!booking || !item || item.canonicalStatus !== '03' || booking.status !== 'WAITING_SALES_ACK' || !booking.warehouseReply || Date.parse(booking.expiresAt) <= Date.now()) return false;
    setStockBookings((current) => current.map((entry) => entry.id === bookingId
      ? { ...entry, salesAcknowledgedAt: new Date().toISOString(), status: 'WAITING_APPROVED_SO' }
      : entry));
    return true;
  };

  const acceptBookingReplacement = (bookingId: string): boolean => {
    if (currentRole !== 'sales_rep') return false;
    const booking = stockBookings.find((entry) => entry.id === bookingId);
    const original = booking ? inventory.find((entry) => entry.id === booking.lotId) : undefined;
    const replacementId = booking?.warehouseReply?.suggestedLotId;
    const replacement = replacementId ? inventory.find((entry) => entry.id === replacementId) : undefined;
    // Booked quantity = remaining good part plus any damaged slice split off during the warehouse review.
    const splitDamagedQty = booking?.damagedLotId && booking.damagedLotId !== original?.id ? booking.warehouseReply?.damagedQtyTons || 0 : 0;
    const qty = (original?.totalWeightTons || 0) + splitDamagedQty;
    if (!booking || booking.status !== 'WAITING_SALES_ACK' || !replacement || replacement.canonicalStatus !== '02' || replacement.availableWeightTons < qty - 0.001) return false;
    const replacementHeldId = Math.abs(replacement.availableWeightTons - qty) <= 0.001 ? replacement.id : `${replacement.id}-HOLD-${Date.now().toString().slice(-6)}`;
    setInventory((current) => current.flatMap((entry) => {
      if (entry.id === original?.id) return entry.canonicalStatus === '03' ? [{ ...entry, canonicalStatus: '02' as const, availableWeightTons: entry.totalWeightTons, reservedWeightTons: 0 }] : [entry];
      if (entry.id !== replacement.id) return [entry];
      if (Math.abs(entry.availableWeightTons - qty) <= 0.001) return [{ ...entry, canonicalStatus: '03' as const, availableWeightTons: 0, reservedWeightTons: qty }];
      return [
        { ...entry, totalWeightTons: entry.totalWeightTons - qty, availableWeightTons: entry.availableWeightTons - qty },
        { ...entry, id: replacementHeldId, lotNumber: `${entry.lotNumber}-HOLD`, sourceLotId: entry.id, totalWeightTons: qty, availableWeightTons: 0, reservedWeightTons: qty, canonicalStatus: '03' as const },
      ];
    }));
    setStockBookings((current) => current.map((entry) => entry.id === bookingId ? { ...entry, lotId: replacementHeldId, sourceLotId: replacement.id } : entry));
    return true;
  };

  const attachBookingQuotation = (groupId: string, quotation: BookingQuotation): boolean => {
    const group = stockBookingGroups.find((entry) => entry.id === groupId);
    if (currentRole !== 'sales_rep' || !group || group.status !== 'OPEN') return false;
    if (!quotation.quotationNo.trim() || !quotation.fileName || !quotation.expectedDeliveryDate || !quotation.customerConfirmed) return false;
    const quotationNo = quotation.quotationNo.trim();
    const stagingGate = lookupLogisticsGate(groupId, quotation.expectedDeliveryDate);
    setStockBookingGroups((current) => current.map((entry) => entry.id === groupId
      ? { ...entry, quotation: { ...quotation, quotationNo }, deliveryDate: quotation.expectedDeliveryDate, stagingGate }
      : entry));
    setStockBookings((current) => current.map((entry) => entry.groupId === groupId
      ? { ...entry, approvedSoReference: quotationNo, preparationDate: stagingDueDate(quotation.expectedDeliveryDate), deliveryDate: quotation.expectedDeliveryDate, stagingGate }
      : entry));
    addAuditLog(groupId, 'ใบเสนอราคา', 0, 'ตัน', '[03]', '[03]', 'แนบใบเสนอราคาที่ลูกค้ายืนยัน', `${quotationNo}; ไฟล์ ${quotation.fileName}; ส่ง ${quotation.expectedDeliveryDate}; ประตู ${stagingGate} (Logistics App)`, 'WMS');
    return true;
  };

  /** Lines still in play for a group: expired or cancelled lines no longer block confirmation. */
  const activeGroupLines = (groupId: string) => stockBookings.filter((entry) => entry.groupId === groupId && !['EXPIRED', 'CANCELLED'].includes(entry.status));

  const workTypeOf = (item: InventoryItem) => workTypeConfigs.find((entry) => entry.sku === item.productCode)?.workType || 'FINISHED';

  /** After [04], each lot is routed by its SKU work type: processed steel to the processing queue, finished steel straight to picking. */
  const routeReservedLines = (lines: { booking: StockBooking; item: InventoryItem }[], group: StockBookingGroup, now: Date) => {
    const jobs: ProcessingJob[] = [];
    const tasks: PickTask[] = [];
    const processingLotIds = new Set<string>();
    lines.forEach(({ booking, item }) => {
      if (workTypeOf(item) === 'PROCESSING') {
        jobs.push(buildBookingProcessingJob(booking, item, group, now));
        processingLotIds.add(item.id);
      } else {
        tasks.push(buildBookingPickTask(booking, item, group, now));
      }
    });
    if (jobs.length) setProcessingJobs((current) => [...jobs, ...current]);
    if (tasks.length) setPickTasks((current) => [...tasks, ...current]);
    return { jobs, tasks, processingLotIds };
  };

  const confirmBookingGroup = (groupId: string): boolean => {
    const group = stockBookingGroups.find((entry) => entry.id === groupId);
    const lines = activeGroupLines(groupId).map((booking) => ({ booking, item: inventory.find((entry) => entry.id === booking.lotId) }));
    if (currentRole !== 'sales_rep' || !group || group.status !== 'OPEN' || !group.quotation?.customerConfirmed || !group.deliveryDate || !group.stagingGate || Date.parse(group.expiresAt) <= Date.now()) return false;
    if (!lines.length || lines.some(({ booking, item }) => booking.status !== 'WAITING_APPROVED_SO' || !booking.salesAcknowledgedAt || !item || item.canonicalStatus !== '03')) return false;
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 16).replace('T', ' ');
    const quotationNo = group.quotation.quotationNo;
    const reservedLines = lines.map(({ booking, item }) => ({ booking: { ...booking, approvedSoReference: quotationNo }, item: item! }));
    const { processingLotIds, jobs, tasks } = routeReservedLines(reservedLines, group, now);
    setInventory((current) => current.map((entry) => {
      if (!reservedLines.some(({ item }) => item.id === entry.id)) return entry;
      return { ...entry, canonicalStatus: processingLotIds.has(entry.id) ? '05' : '04', availableWeightTons: 0, reservedWeightTons: entry.totalWeightTons, lastUpdated: timestamp };
    }));
    setStockBookings((current) => current.map((entry) => reservedLines.some(({ booking }) => booking.id === entry.id)
      ? { ...entry, status: 'RESERVED', approvedSoReference: quotationNo, preparationDate: stagingDueDate(group.deliveryDate), deliveryDate: group.deliveryDate, stagingGate: group.stagingGate, operationCreated: true }
      : entry));
    setStockBookingGroups((current) => current.map((entry) => entry.id === groupId ? { ...entry, status: 'RESERVED', confirmedAt: now.toISOString() } : entry));
    reservedLines.forEach(({ item }) => {
      addAuditLog(item.id, item.productName, item.totalWeightTons, 'ตัน', '[03]', '[04]', 'ยืนยันการจองด้วยใบเสนอราคา', `ใบเสนอราคา ${quotationNo}; ส่ง ${group.deliveryDate}; ประตู ${group.stagingGate}`, 'WMS');
      if (processingLotIds.has(item.id)) {
        const job = jobs.find((entry) => entry.inputLotId === item.id);
        addAuditLog(item.id, item.productName, item.totalWeightTons, 'ตัน', '[04]', '[05]', 'ออกใบเบิกสินค้าเพื่อผลิตหรือแปรรูป', `งาน ${job?.jobNumber} ตาม ${quotationNo}`, 'WMS');
      } else {
        const task = tasks.find((entry) => entry.lotId === item.id);
        addAuditLog(item.id, item.productName, item.totalWeightTons, 'ตัน', '[04]', '[04]', 'ออกใบเบิกสินค้า (ส่งมอบให้ลูกค้า)', `ใบเบิก ${task?.pickNumber} ตาม ${quotationNo}`, 'WMS');
      }
    });
    return true;
  };

  const proposeExceptionReplacement = (bookingId: string, replacementLotId: string | undefined): boolean => {
    if (!['warehouse_manager', 'crane_operator', 'system_admin'].includes(currentRole)) return false;
    const booking = stockBookings.find((entry) => entry.id === bookingId);
    if (!booking?.exception || booking.exception.status !== 'WAITING_WAREHOUSE') return false;
    if (replacementLotId) {
      const damaged = inventory.find((entry) => entry.id === booking.exception!.damagedLotId);
      const candidate = inventory.find((entry) => entry.id === replacementLotId);
      if (!candidate || candidate.canonicalStatus !== '02' || candidate.physicalCondition !== 'NORMAL' || candidate.availableWeightTons < booking.exception.damagedQtyTons - 0.001 || (damaged && candidate.productCode !== damaged.productCode)) return false;
    }
    setStockBookings((current) => current.map((entry) => entry.id === bookingId && entry.exception
      ? { ...entry, exception: { ...entry.exception, suggestedLotId: replacementLotId, status: 'WAITING_SALES' } }
      : entry));
    return true;
  };

  const resolveBookingException = (bookingId: string, acceptReplacement: boolean): boolean => {
    if (currentRole !== 'sales_rep') return false;
    const booking = stockBookings.find((entry) => entry.id === bookingId);
    const group = booking ? stockBookingGroups.find((entry) => entry.id === booking.groupId) : undefined;
    const exception = booking?.exception;
    if (!booking || !group || !exception || exception.status !== 'WAITING_SALES') return false;
    if (!acceptReplacement || !exception.suggestedLotId) {
      setStockBookings((current) => current.map((entry) => entry.id === bookingId && entry.exception ? { ...entry, exception: { ...entry.exception, status: 'CLOSED_NO_REPLACEMENT' } } : entry));
      addAuditLog(exception.damagedLotId, 'ของเสียหลังจอง', exception.damagedQtyTons, 'ตัน', '[07]', '[07]', 'เซลล์รับทราบ ไม่ใช้ล็อตทดแทน', exception.reason, 'WMS');
      return true;
    }
    const source = inventory.find((entry) => entry.id === exception.suggestedLotId);
    const qty = exception.damagedQtyTons;
    if (!source || source.canonicalStatus !== '02' || source.availableWeightTons < qty - 0.001) return false;
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 16).replace('T', ' ');
    const isWholeLot = Math.abs(source.availableWeightTons - qty) <= 0.001 && Math.abs(source.totalWeightTons - qty) <= 0.001;
    const heldId = isWholeLot ? source.id : `${source.id}-HOLD-${now.getTime().toString().slice(-6)}`;
    const heldItem: InventoryItem = { ...source, id: heldId, lotNumber: isWholeLot ? source.lotNumber : `${source.lotNumber}-HOLD`, sourceLotId: isWholeLot ? source.sourceLotId : source.id, totalWeightTons: qty, availableWeightTons: 0, reservedWeightTons: qty, canonicalStatus: '04', lastUpdated: timestamp };
    const replacementBooking: StockBooking = {
      id: `${group.id}-R${now.getTime().toString().slice(-4)}`,
      groupId: group.id,
      lotId: heldId,
      sourceLotId: source.id,
      requesterRole: currentRole,
      createdAt: now.toISOString(),
      expiresAt: booking.expiresAt,
      status: 'RESERVED',
      customerName: group.customerName,
      approvedSoReference: booking.approvedSoReference,
      preparationDate: stagingDueDate(group.deliveryDate),
      deliveryDate: group.deliveryDate,
      stagingGate: group.stagingGate,
      operationCreated: true,
      replacesBookingId: booking.id,
    };
    const { processingLotIds } = routeReservedLines([{ booking: replacementBooking, item: heldItem }], group, now);
    const finalHeld = processingLotIds.has(heldId) ? { ...heldItem, canonicalStatus: '05' as const } : heldItem;
    setInventory((current) => current.flatMap((entry) => {
      if (entry.id !== source.id) return [entry];
      if (isWholeLot) return [finalHeld];
      return [{ ...entry, totalWeightTons: entry.totalWeightTons - qty, availableWeightTons: entry.availableWeightTons - qty, lastUpdated: timestamp }, finalHeld];
    }));
    setStockBookings((current) => [
      replacementBooking,
      ...current.map((entry) => entry.id === bookingId && entry.exception ? { ...entry, exception: { ...entry.exception, status: 'RESOLVED' as const, replacementBookingId: replacementBooking.id } } : entry),
    ]);
    addAuditLog(heldId, source.productName, qty, 'ตัน', '[02]', '[04]', 'จองล็อตทดแทนของเสีย', `แทน ${exception.damagedLotId} ตาม ${booking.approvedSoReference}`, 'WMS');
    return true;
  };

  const saveWorkTypeConfig = (config: StockWorkTypeConfig): boolean => {
    if (!['warehouse_manager', 'system_admin'].includes(currentRole) || !Number.isFinite(config.processingDays) || config.processingDays < 0 || (config.workType === 'FINISHED' && config.processingDays !== 0)) return false;
    setWorkTypeConfigs((current) => current.some((entry) => entry.sku === config.sku)
      ? current.map((entry) => entry.sku === config.sku ? config : entry)
      : [...current, config]);
    return true;
  };

  const navigateToWorkspace = (
    ws: WorkspaceId,
    ctx?: {
      selectedSoId?: string;
      selectedLineNumber?: number;
      selectedLotId?: string;
      returnWorkspace?: WorkspaceId;
      tabIndex?: number;
    }
  ) => {
    if (ctx) {
      setNavContext((prev) => ({
        ...prev,
        ...ctx,
        ...(ctx.tabIndex !== undefined ? { tabIntentKey: (prev.tabIntentKey ?? 0) + 1 } : {}),
        returnWorkspace: activeWorkspace,
      }));
    }
    setActiveWorkspace(ws);
  };

  const addAuditLog = (
    lotId: string,
    productSpec: string,
    qtyTons: number,
    uom: string,
    fromStatus: string,
    toStatus: string,
    trigger: string,
    reason: string,
    boundary: 'SYSTEM_ONE' | 'WMS' | 'LOGISTICS' | 'YARD',
    details?: Record<string, unknown>
  ) => {
    const newEvent: AuditEvent = {
      id: `EVT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      lotId,
      productSpec,
      qtyTons,
      uom,
      fromStatus,
      toStatus,
      trigger,
      actor: `${USER_ROLES[currentRole].titleTh} (${USER_ROLES[currentRole].name})`,
      reason,
      boundary,
      correlationId: `CORR-${Date.now().toString().slice(-6)}`,
      transportAck: true,
      businessAck: true,
      version: 'v2.10',
      details,
    };
    setAuditEvents((prev) => [newEvent, ...prev]);
  };

  const appendIntegrationMessage = (
    input: Pick<
      IntegrationMessage,
      'source' | 'target' | 'direction' | 'schema' | 'event' | 'correlationId' | 'idempotencyKey' | 'dependencies' | 'owner'
    > &
      Partial<
        Pick<
          IntegrationMessage,
          | 'status'
          | 'attempts'
          | 'transportAck'
          | 'businessAck'
          | 'entityRef'
          | 'retryable'
          | 'errorCode'
          | 'payloadSummary'
          | 'errorDetail'
        >
      >
  ) => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const status = input.status || 'SUCCESS';
    const message: IntegrationMessage = {
      ...input,
      id: `MSG-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
      status,
      attempts: input.attempts ?? 1,
      transportAck: input.transportAck ?? status === 'SUCCESS',
      businessAck: input.businessAck ?? status === 'SUCCESS',
      retryable: input.retryable ?? status !== 'SUCCESS',
      createdAt: timestamp,
      updatedAt: timestamp,
      history: [
        `${timestamp}: ${status === 'SUCCESS' ? 'SIMULATED transport and business ACK accepted' : 'SIMULATED event queued for recovery'}`,
      ],
    };
    setIntegrationMessages((prev) => [message, ...prev]);
  };

  // WMS-01: Verify SO
  const verifySoRequest = (soId: string) => {
    setSoRequests((prev) =>
      prev.map((so) => (so.id === soId || so.soNumber === soId ? { ...so, status: 'VERIFIED' } : so))
    );
  };

  // WMS-01: PDF Upload Simulation
  const uploadSoPdfSimulation = (file: File) => {
    const existing = soRequests.find(
      (r) => r.fileName === file.name || r.fileFingerprint.includes(file.name.slice(0, 6))
    );

    if (existing) {
      triggerGateBlocked({
        title: 'ตรวจพบลายนิ้วมือไฟล์ซ้ำ (Duplicate Fingerprint Detected)',
        unmetGates: [
          `ไฟล์ "${file.name}" มี SHA-256 ตรงกับเอกสารเดิมในระบบ (${existing.soNumber})`,
          'ระบบเปิดคำสั่งซื้อเดิมขึ้นมาให้อัตโนมัติ เพื่อป้องกันการจองซ้ำซ้อน',
        ],
        recoveryRoute: 'กำลังนำท่านไปยังคำสั่งซื้อที่มีอยู่แล้วในระบบ',
        targetWorkspace: 'WMS-01',
        targetContext: { selectedSoId: existing.soNumber },
      });
      navigateToWorkspace('WMS-01', { selectedSoId: existing.soNumber, tabIndex: 0 });
      return;
    }

    const newSoNumber = `SO-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newReq: SORequest = {
      id: `REQ-${newSoNumber}`,
      soNumber: newSoNumber,
      customerName: 'บจก. บางกอกสตรัคเจอรัลสตีล (จำลองข้อมูล)',
      requestDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'VERIFIED',
      ocrConfidence: 98.7,
      ocrState: 'PARSE_SUCCESS',
      fileFingerprint: `SHA256-${Math.random().toString(16).substring(2, 10).toUpperCase()}`,
      fileName: file.name,
      approvalRef: `SO-APPR-${newSoNumber}`,
      paymentAttestRef: `ACC-ATT-${Math.floor(100 + Math.random() * 900)}`,
      optimisticLockVersion: 'v2.10',
      lines: [
        {
          lineNumber: 1,
          productCode: 'H-SM400-300150',
          specDescription: 'เหล็กเอชบีม H-Beam 300×150×6.5×9mm SM400 มอก. 1227-2558 (ความยาว 12.0M)',
          requestedQtyTons: 30.0,
          requestedPieces: 40,
          uom: 'ตัน (Tons)',
          selectedQtyTons: 0,
          remainingQtyTons: 30.0,
          selectionStatus: 'NOT_STARTED',
          selectedLotIds: [],
          selectionSlices: [],
        },
      ],
    };

    setSoRequests((prev) => [newReq, ...prev]);
    navigateToWorkspace('WMS-05', {
      selectedSoId: newReq.soNumber,
      selectedLineNumber: 1,
    });
  };

  const updateSoLinePermitted = (
    soId: string,
    lineNumber: number,
    spec: string,
    qtyTons: number,
    uom: string
  ) => {
    setSoRequests((prev) =>
      prev.map((so) => {
        if (so.id === soId || so.soNumber === soId) {
          return {
            ...so,
            lines: so.lines.map((ln) =>
              ln.lineNumber === lineNumber
                ? {
                    ...ln,
                    specDescription: spec,
                    requestedQtyTons: qtyTons,
                    remainingQtyTons: Math.max(0, qtyTons - ln.selectedQtyTons),
                    uom,
                  }
                : ln
            ),
          };
        }
        return so;
      })
    );
  };

  const updateSalesReservationSelection = (
    soId: string,
    lineNumber: number,
    slices: { lotId: string; qtyTons: number }[]
  ): boolean => {
    const so = soRequests.find((request) => request.id === soId || request.soNumber === soId);
    const line = so?.lines.find((entry) => entry.lineNumber === lineNumber);
    const reservationSlices = line?.reservationSlices ?? line?.selectionSlices ?? [];
    const totalSelected = slices.reduce((total, slice) => total + slice.qtyTons, 0);
    const duplicateLot = new Set(slices.map((slice) => slice.lotId)).size !== slices.length;
    const invalidSlice = slices.some((slice) => {
      const reserved = reservationSlices.find((entry) => entry.lotId === slice.lotId);
      const item = inventory.find((candidate) => candidate.id === slice.lotId);
      return !reserved || !item || item.canonicalStatus !== '04' ||
        item.reservedWeightTons < reserved.qtyTons - 0.001 ||
        !Number.isFinite(slice.qtyTons) || slice.qtyTons <= 0 || slice.qtyTons > reserved.qtyTons + 0.001;
    });

    if (currentRole !== 'sales_rep' || !so || !line || line.selectionStatus !== 'RESERVED' ||
      !slices.length || duplicateLot || invalidSlice || !Number.isFinite(totalSelected) ||
      totalSelected <= 0 || totalSelected > line.requestedQtyTons + 0.001) {
      triggerGateBlocked({
        title: 'ปรับจำนวนเลือกสินค้าไม่ได้',
        unmetGates: [
          currentRole !== 'sales_rep' ? 'การปรับจำนวนเลือกทำได้โดยฝ่ายขายเท่านั้น' : '',
          !line || line.selectionStatus !== 'RESERVED' ? 'รายการต้องมีสินค้าที่จองสถานะ [04] ตามใบสั่งขายแล้ว' : '',
          invalidSlice || duplicateLot ? 'เลือกได้เฉพาะล็อต [04] ที่จองให้รายการนี้ และจำนวนต้องไม่เกินยอดจองของล็อต' : '',
          totalSelected <= 0 || totalSelected > (line?.requestedQtyTons ?? 0) + 0.001 ? 'จำนวนรวมต้องมากกว่า 0 และไม่เกินปริมาณที่ขอ' : '',
        ].filter(Boolean),
        recoveryRoute: 'ปรับจำนวนของล็อต [04] ที่ผูกกับใบสั่งขาย แล้วบันทึกใหม่',
      });
      return false;
    }

    setSoRequests((prev) => prev.map((request) => request.id === so.id
      ? {
          ...request,
          lines: request.lines.map((entry) => entry.lineNumber === lineNumber
            ? {
                ...entry,
                selectedQtyTons: totalSelected,
                remainingQtyTons: Math.max(0, entry.requestedQtyTons - totalSelected),
                selectedLotIds: slices.map((slice) => slice.lotId),
                selectionSlices: slices.map((slice) => ({ ...slice })),
                reservationSlices: reservationSlices.map((slice) => ({ ...slice })),
              }
            : entry),
        }
      : request));

    addAuditLog(
      slices.map((slice) => slice.lotId).join(', '),
      line.specDescription,
      totalSelected,
      'ตัน (Tons)',
      '[04] Reserved',
      '[04] Reserved',
      'Sales Updated Reserved Lot Selection',
      `ฝ่ายขายปรับจำนวนเบิกเป็น ${totalSelected.toFixed(3)} ตัน โดยไม่เปลี่ยนยอดจองในสต็อก`,
      'WMS',
      { soNumber: so.soNumber, lineNumber, slices }
    );
    return true;
  };

  const resolveOcrRecovery = (soId: string, note: string) => {
    setSoRequests((prev) =>
      prev.map((so) =>
        so.id === soId || so.soNumber === soId
          ? {
              ...so,
              ocrState: 'PARSE_SUCCESS',
              ocrRecoveryNote: note,
              status: 'VERIFIED',
            }
          : so
      )
    );
  };

  // WMS-05: Sales Submits Candidates to System One
  const submitSalesSelectionToSystemOne = async (
    soId: string,
    lineNumber: number,
    slices: { lotId: string; qtyTons: number }[],
    bypassReason?: string
  ): Promise<boolean> => {
    const totalSelected = slices.reduce((acc, curr) => acc + curr.qtyTons, 0);
    const so = soRequests.find((s) => s.id === soId || s.soNumber === soId);
    const line = so?.lines.find((l) => l.lineNumber === lineNumber);
    const selectedLotIds = slices.map((slice) => slice.lotId);
    const invalidSlice = slices.find((slice) => {
      const item = inventory.find((candidate) => candidate.id === slice.lotId);
      return !item || !Number.isFinite(slice.qtyTons) || slice.qtyTons <= 0 || item.canonicalStatus !== '02' || item.isExcluded || item.reservedWeightTons > 0.001 || slice.qtyTons > item.availableWeightTons + 0.001;
    });

    if (!line || totalSelected <= 0 || (line && totalSelected > line.requestedQtyTons + 0.001) || (line && ['SOFT_HOLD', 'RESERVED'].includes(line.selectionStatus)) || new Set(selectedLotIds).size !== selectedLotIds.length || invalidSlice) {
      triggerGateBlocked({
        title: 'รายการเลือกสินค้าไม่ผ่านการตรวจสอบ',
        unmetGates: ['ต้องเลือกไม่เกินยอด SO, Lot คนละรายการที่ยังอยู่สถานะ [02], ไม่ถูก exclude, ไม่มีรายการจองค้าง และจำนวนไม่เกิน available'],
        recoveryRoute: 'คำนวณคำแนะนำสินค้าใหม่และตรวจยอด/สถานะของแต่ละ slice ก่อนส่ง',
      });
      return false;
    }

    const selectionId = `SEL-${Date.now().toString().slice(-6)}`;

    // Record the SO selection while the System One confirmation is pending.
    setSoRequests((prev) =>
      prev.map((s) => {
        if (s.id === soId || s.soNumber === soId) {
          return {
            ...s,
            status: 'SELECTION_PENDING',
            lines: s.lines.map((l) =>
              l.lineNumber === lineNumber
                ? {
                    ...l,
                    selectedQtyTons: totalSelected,
                    remainingQtyTons: Math.max(0, l.requestedQtyTons - totalSelected),
                    selectionStatus: 'SELECTION_PENDING',
                    selectionId,
                    selectedLotIds: slices.map((sl) => sl.lotId),
                    selectionSlices: slices,
                    bypassReason,
                  }
                : l
            ),
          };
        }
        return s;
      })
    );

    addAuditLog(
      slices.map((s) => s.lotId).join(', '),
      line.specDescription,
      totalSelected,
      'ตัน (Tons)',
      '[02] Available to Promise',
      'SELECTION_PENDING',
      'Sales Submit Selection to System One',
      `ฝ่ายขายส่งคำขอจัดสรร ${totalSelected} ตัน ไปยังระบบหน้าบ้าน (System One)`,
      'SYSTEM_ONE',
      { selectionId, bypassReason }
    );

    appendIntegrationMessage({
      source: 'WMS',
      target: 'SYSTEM_ONE',
      direction: 'OUTBOUND',
      schema: 'urn:tts:system-one:stock-selection-request:1.0',
      event: 'SALES_SELECTION_SUBMITTED',
      correlationId: `CORR-${selectionId}`,
      idempotencyKey: `IDEM-${selectionId}`,
      dependencies: [so?.soNumber || soId, `LINE-${lineNumber}`],
      owner: 'System One Integration Gateway',
      entityRef: selectionId,
      payloadSummary: `${totalSelected} T selected across ${slices.length} stock slice(s); awaiting System One business acceptance.`,
      status: 'PENDING',
      transportAck: true,
      businessAck: false,
      retryable: true,
    });

    // Simulate System One confirming the SO selection before WMS reserves the stock.
    await new Promise((resolve) => setTimeout(resolve, 800));

    const heldSlices = slices.map((slice, index) => {
      const item = inventory.find((candidate) => candidate.id === slice.lotId)!;
      const useSourceLot = item.reservedWeightTons <= 0.001 && Math.abs(item.totalWeightTons - slice.qtyTons) <= 0.001;
      return {
        sourceLotId: slice.lotId,
        lotId: useSourceLot ? item.id : `${item.id}-HOLD-${selectionId.slice(-4)}-${lineNumber}-${index + 1}`,
        qtyTons: slice.qtyTons,
      };
    });

    // Reserve only the accepted SO quantity as [04], splitting partial quantities
    // so one lot cannot appear available and reserved at the same time.
    setInventory((prev) => prev.flatMap((item) => {
      const holdsFromSource = heldSlices.filter((slice) => slice.sourceLotId === item.id);
      if (!holdsFromSource.length) return [item];
      const heldQty = holdsFromSource.reduce((total, slice) => total + slice.qtyTons, 0);
      const useWholeSource = holdsFromSource.length === 1 && holdsFromSource[0].lotId === item.id;
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
      const remainingQty = Math.max(0, item.totalWeightTons - heldQty);
      const residual = remainingQty > 0.001 ? {
        ...item,
        totalWeightTons: remainingQty,
        availableWeightTons: Math.max(0, item.availableWeightTons - heldQty),
        canonicalStatus: '02' as const,
        lastUpdated: timestamp,
      } : null;
      const heldItems = useWholeSource
        ? [{ ...item, canonicalStatus: '04' as const, availableWeightTons: 0, reservedWeightTons: heldQty, lastUpdated: timestamp }]
        : holdsFromSource.map((slice) => ({
            ...item,
            id: slice.lotId,
            lotNumber: slice.lotId,
            sourceLotId: item.id,
            totalWeightTons: slice.qtyTons,
            availableWeightTons: 0,
            reservedWeightTons: slice.qtyTons,
            canonicalStatus: '04' as const,
            lastUpdated: timestamp,
          }));
      if (useWholeSource) return heldItems;
      return [...(residual ? [residual] : []), ...heldItems];
    }));

    setSoRequests((prev) =>
      prev.map((s) => {
        if (s.id === soId || s.soNumber === soId) {
          return {
            ...s,
            status: 'RESERVED',
            lines: s.lines.map((l) =>
              l.lineNumber === lineNumber
                ? {
                    ...l,
                    selectionStatus: 'RESERVED',
                    selectedLotIds: heldSlices.map((slice) => slice.lotId),
                    selectionSlices: heldSlices.map(({ lotId, qtyTons }) => ({ lotId, qtyTons })),
                    reservationSlices: heldSlices.map(({ lotId, qtyTons }) => ({ lotId, qtyTons })),
                    systemOneResponse: {
                      ackStatus: 'ACK_200',
                      message: 'System One confirmed SO selection; WMS reserved stock as [04] (S1-RESERVE-8821)',
                      receivedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
                    },
                  }
                : l
            ),
          };
        }
        return s;
      })
    );

    addAuditLog(
      slices.map((s) => s.lotId).join(', '),
      line.specDescription,
      totalSelected,
      'ตัน (Tons)',
      'SELECTION_PENDING',
      '[04] Reserved',
      'Sales SO Selection Confirmation (S1-RESERVE-8821)',
      'ระบบหน้าบ้านยืนยันรายการตาม SO และคลังจองสินค้าเป็นสถานะ [04] ผูกกับ SO/Line',
      'SYSTEM_ONE'
    );

    appendIntegrationMessage({
      source: 'SYSTEM_ONE',
      target: 'WMS',
      direction: 'INBOUND',
      schema: 'urn:tts:system-one:status-attestation:1.0',
      event: 'SO_SELECTION_ACCEPTED_RESERVED',
      correlationId: `CORR-${selectionId}`,
      idempotencyKey: `IDEM-SYS1-${selectionId}-ACK`,
      dependencies: [selectionId],
      owner: 'WMS Status Ingestion',
      entityRef: selectionId,
      payloadSummary: `System One confirmed ${totalSelected} T against the SO; WMS reserved the selected stock as [04].`,
    });
    setIntegrationMessages((prev) => prev.map((message) => message.event === 'SALES_SELECTION_SUBMITTED' && message.correlationId === `CORR-${selectionId}`
      ? {
          ...message,
          status: 'SUCCESS',
          transportAck: true,
          businessAck: true,
          retryable: false,
          updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
          history: [...message.history, `${new Date().toISOString().replace('T', ' ').substring(0, 19)}: SO selection confirmed; WMS reservation status [04] applied.`],
        }
      : message));
    appendIntegrationMessage({
      source: 'SYSTEM_ONE',
      target: 'DATA_BUCKET',
      direction: 'OUTBOUND',
      schema: 'urn:tts:system-one:warehouse-status-snapshot:1.0',
      event: 'PRODUCT_STATUS_04_PUBLISHED',
      correlationId: `CORR-${selectionId}`,
      idempotencyKey: `IDEM-SYS1-BUCKET-${selectionId}`,
      dependencies: [selectionId],
      owner: 'System One Data Publisher',
      entityRef: selectionId,
      payloadSummary: `Status [04] reservation published for Warehouse read access; pick task still requires Manager approval.`,
    });

    return true;
  };

  const retrySystemOneSubmission = async (soId: string, lineNumber: number): Promise<boolean> => {
    const so = soRequests.find((s) => s.id === soId || s.soNumber === soId);
    const line = so?.lines.find((l) => l.lineNumber === lineNumber);
    if (!so || !line) return false;
    return submitSalesSelectionToSystemOne(soId, lineNumber, line.selectionSlices, line.bypassReason);
  };

  // WMS-05: Manager Allocation Gate (03 -> 04 Reserved)
  const managerApproveAllocation = (soId: string, lineNumber: number): boolean => {
    if (currentRole !== 'warehouse_manager') {
      triggerGateBlocked({
        title: 'ไม่อนุญาตให้ดำเนินการ: ต้องใช้สิทธิ์ผู้จัดการคลัง (Warehouse Manager Only)',
        unmetGates: [
          `ผู้ใช้งานปัจจุบันเป็น "${USER_ROLES[currentRole].titleTh}" ไม่มีสิทธิ์อนุมัติการจองสินค้า [03] → [04]`,
          'ฝ่ายขาย (Sales Rep) ไม่สามารถอนุมัติการจัดสรรหรือสร้างใบหยิบได้โดยเด็ดขาดตามกฎ BRD',
        ],
        recoveryRoute: 'สลับสิทธิ์ผู้ใช้งานเป็น "ผู้จัดการคลังสินค้า (Warehouse Manager)" ที่แถบด้านบนขวา',
      });
      return false;
    }

    const so = soRequests.find((s) => s.id === soId || s.soNumber === soId);
    const line = so?.lines.find((l) => l.lineNumber === lineNumber);

    if (!so || !line) return false;

    const unmet: string[] = [];
    if (line.selectionStatus !== 'SOFT_HOLD') {
      unmet.push('สถานะสินค้ายังไม่ได้การตอบรับเป็น [03] Soft Hold จากระบบหน้าบ้าน');
    }
    if (!so?.approvalRef) {
      unmet.push('คำสั่งซื้อยังไม่ผ่านการอนุมัติ (SO Approval Attestation ขาดหาย)');
    }
    if (!so?.paymentAttestRef) {
      unmet.push('ไม่พบหลักฐานการชำระเงิน (Payment Status Attestation Missing)');
    }
    if (line.selectedQtyTons <= 0) {
      unmet.push('ยังไม่มีการจัดสรรจำนวนสินค้า');
    }
    for (const slice of line.selectionSlices) {
      const item = inventory.find((candidate) => candidate.id === slice.lotId);
      if (!item || item.canonicalStatus !== '03' || Math.abs(item.totalWeightTons - slice.qtyTons) > 0.001) {
        unmet.push(`slice ${slice.lotId} ไม่พบสถานะ [03] หรือจำนวน ${slice.qtyTons.toFixed(3)} ตันไม่ตรงกับสินค้าที่ระบบหน้าบ้านตอบรับ`);
      }
    }

    if (unmet.length > 0) {
      triggerGateBlocked({
        title: 'ไม่ผ่านเกณฑ์การอนุมัติการจัดสรร (Allocation Gates Failed)',
        unmetGates: unmet,
        recoveryRoute: 'ตรวจสอบผลการยืนยันจากระบบหน้าบ้านในแท็บ SO Recommendations ให้ครบก่อนอนุมัติ',
      });
      return false;
    }

    // Atomically transition from 03 -> 04 Reserved
    setSoRequests((prev) =>
      prev.map((s) => {
        if (s.id === soId || s.soNumber === soId) {
          return {
            ...s,
            status: 'RESERVED',
            lines: s.lines.map((l) =>
              l.lineNumber === lineNumber ? { ...l, selectionStatus: 'RESERVED' } : l
            ),
          };
        }
        return s;
      })
    );

    // Move only accepted [03] slices into [04]; no unrelated ATP stock is reserved.
    setInventory((prev) =>
      prev.map((item) => {
        if (line.selectedLotIds.includes(item.id)) {
          return {
            ...item,
            canonicalStatus: '04',
            reservedWeightTons: item.totalWeightTons,
            availableWeightTons: 0,
            lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16),
          };
        }
        return item;
      })
    );

    addAuditLog(
      line.selectedLotIds.join(', '),
      line.specDescription,
      line.selectedQtyTons,
      'ตัน (Tons)',
      '[03] Soft Hold',
      '[04] Reserved',
      'Manager Allocation Approval (Gate 5/5 PASS)',
      `ผู้จัดการคลังอนุมัติการจัดสรรสต็อก ล็อกสถานะ [04] สินค้าจองตามใบสั่งขาย พร้อมส่งต่อ WMS-06`,
      'WMS'
    );

    appendIntegrationMessage({
      source: 'WMS',
      target: 'DATA_BUCKET',
      direction: 'OUTBOUND',
      schema: 'urn:tts:warehouse:reserved-stock-event:1.0',
      event: 'WAREHOUSE_STOCK_RESERVED',
      correlationId: `CORR-RES-${so.soNumber}-${line.lineNumber}`,
      idempotencyKey: `IDEM-RES-${so.soNumber}-${line.lineNumber}-${line.selectionId || 'NA'}`,
      dependencies: [line.selectionId || so.soNumber],
      owner: 'WMS Stock Event Publisher',
      entityRef: `${so.soNumber}-LINE-${line.lineNumber}`,
      payloadSummary: `Status [04] reserved for ${line.selectedQtyTons} T after Manager approval; ready to issue pick only after this state.`,
    });

    return true;
  };

  // WMS-06: Create Pick Task (ONLY from 04 Reserved)
  const createPickTaskForReserved = (soId: string, lineNumber: number): boolean => {
    const so = soRequests.find((s) => s.id === soId || s.soNumber === soId);
    const line = so?.lines.find((l) => l.lineNumber === lineNumber);

    if (!so || !line || line.selectionStatus !== 'RESERVED') {
      triggerGateBlocked({
        title: 'ไม่อนุญาตให้สร้างใบหยิบ (Pick Issuance Blocked)',
        unmetGates: [
          `สถานะปัจจุบันของรายการสินค้าคือ "${line?.selectionStatus || 'UNKNOWN'}" (ไม่ใช่ [04] Reserved)`,
          'สินค้าต้องเป็น [04] Reserved และผูกกับ SO/Line นี้ก่อน จึงจะออกใบหยิบได้',
        ],
        recoveryRoute: 'กลับไปที่ WMS-05 เพื่อตรวจการจอง [04] และ SO/Line ที่ผูกกับสินค้า',
        targetWorkspace: 'WMS-05',
        targetContext: { selectedSoId: soId, selectedLineNumber: lineNumber },
      });
      return false;
    }

    if (currentRole !== 'warehouse_manager') {
      triggerGateBlocked({
        title: 'สิทธิ์ไม่เพียงพอในการออกใบหยิบ (Insufficient Permissions)',
        unmetGates: ['เฉพาะผู้จัดการคลังสินค้า (Warehouse Manager) เท่านั้นที่สามารถสั่งสร้างใบหยิบใหม่ได้'],
        recoveryRoute: 'สลับสิทธิ์การใช้งานเป็น "ผู้จัดการคลังสินค้า"',
      });
      return false;
    }

    const invalidPickSlices = line.selectionSlices.flatMap((slice) => {
      const item = inventory.find((candidate) => candidate.id === slice.lotId);
      return !item || item.canonicalStatus !== '04' || item.totalWeightTons < slice.qtyTons - 0.001 || item.reservedWeightTons < slice.qtyTons - 0.001
        ? [`Lot ${slice.lotId} ต้องเป็นสถานะ [04] Reserved และมียอดจองไม่น้อยกว่า ${slice.qtyTons.toFixed(3)} ตัน (ปัจจุบัน ${item ? `[${item.canonicalStatus}] ${item.reservedWeightTons.toFixed(3)} ตัน` : 'ไม่พบ Lot'})`]
        : [];
    });
    const existingPickTask = pickTasks.find((task) => task.soNumber === so.soNumber && task.lineNumber === lineNumber);
    if (invalidPickSlices.length > 0 || existingPickTask) {
      triggerGateBlocked({
        title: 'ออกใบหยิบได้เฉพาะสินค้าสถานะ [04] Reserved',
        unmetGates: [
          ...invalidPickSlices,
          ...(existingPickTask ? [`พบใบหยิบ ${existingPickTask.pickNumber} ของ SO/Line นี้แล้ว เพื่อป้องกันการจองหรือหยิบซ้ำ`] : []),
        ],
        recoveryRoute: existingPickTask
          ? 'ดำเนินงานต่อจากใบหยิบเดิมใน WMS-06; หากเป็นงานทดแทนให้ใช้ขั้นตอนสินค้าทดแทน'
          : 'ตรวจสอบสถานะ [04], ยอดจอง และ SO/Line ที่ผูกกับ Lot ก่อนออกใบหยิบ',
        targetWorkspace: existingPickTask ? 'WMS-06' : 'WMS-05',
        targetContext: existingPickTask ? undefined : { selectedSoId: soId, selectedLineNumber: lineNumber },
      });
      return false;
    }

    const newTasks: PickTask[] = line.selectionSlices.map((slice, idx) => {
      const invItem = inventory.find((it) => it.id === slice.lotId);
      const pickId = `PK-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
      return {
        id: `PICK-${pickId}-${idx}`,
        pickNumber: pickId,
        soNumber: so.soNumber,
        lineNumber: line.lineNumber,
        customerName: so.customerName,
        lotId: slice.lotId,
        productSpec: invItem?.productName || line.specDescription,
        targetBay: invItem?.locationBay || 'Bay 03-B2',
        stagingGate: 'STG-GATE-01',
        allocatedQtyTons: slice.qtyTons,
        actualPickedQtyTons: 0,
        shortQtyTons: 0,
        blockedQtyTons: 0,
        remainingQtyTons: slice.qtyTons,
        state: 'queued',
        operator: '',
        assignedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        barcodeVerified: false,
        qcChecklist: {
          strappingSecure: false,
          specTagMatches: false,
          gaugeToleranceOk: false,
          doDocsPrepared: false,
          designatedZonePlaced: false,
        },
        readinessConfirmed: false,
        readinessVersion: 'v2.10',
      };
    });

    setPickTasks((prev) => [...newTasks, ...prev]);

    addAuditLog(
      line.selectedLotIds.join(', '),
      line.specDescription,
      line.selectedQtyTons,
      'ตัน (Tons)',
      '[04] Reserved',
      '[04] Reserved (Pick Queued)',
      'Pick Task Created',
      `ออกใบสั่งหยิบสินค้าใหม่ ${newTasks.length} รายการใน WMS-06`,
      'WMS'
    );

    navigateToWorkspace('WMS-06');
    return true;
  };

  const managerAssignPickTask = (taskId: string, operator: string): boolean => {
    const task = pickTasks.find((item) => item.id === taskId);
    const reassignmentAllowed = task?.state === 'assigned' && task.actualPickedQtyTons <= 0.001 && !task.barcodeVerified;
    if (currentRole !== 'warehouse_manager') {
      triggerGateBlocked({
        title: 'มอบหมายงานหยิบได้เฉพาะผู้จัดการคลัง',
        unmetGates: ['Warehouse Manager เป็นผู้ issue, assign และ reassign งานหยิบ'],
        recoveryRoute: 'สลับบทบาทเป็นผู้จัดการคลังสินค้า',
      });
      return false;
    }
    if (!task || !operator.trim() || (task.state !== 'queued' && !reassignmentAllowed)) {
      triggerGateBlocked({
        title: 'มอบหมายหรือเปลี่ยนผู้รับงานไม่ได้',
        unmetGates: ['งานต้องอยู่ในคิว หรือยังไม่เริ่มหยิบและยังไม่มีการสแกน'],
        recoveryRoute: 'ตรวจสถานะงานและผู้รับผิดชอบก่อนมอบหมาย; งานที่เริ่มแล้วให้จัดการผ่านข้อยกเว้น',
      });
      return false;
    }
    if (task.state === 'assigned' && task.operator.trim() === operator.trim()) {
      triggerGateBlocked({
        title: 'งานนี้มอบหมายให้ผู้ปฏิบัติงานคนนี้อยู่แล้ว',
        unmetGates: ['เลือกชื่อผู้รับงานใหม่เพื่อทำการมอบหมายซ้ำ'],
        recoveryRoute: 'ตรวจรายชื่อผู้ปฏิบัติงานก่อนบันทึก',
      });
      return false;
    }

    const previousOperator = task.operator || 'ยังไม่มอบหมาย';
    const assignedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setPickTasks((prev) => prev.map((item) => item.id === taskId
      ? { ...item, state: 'assigned', operator: operator.trim(), assignedAt }
      : item));
    addAuditLog(
      task.lotId,
      task.productSpec,
      task.allocatedQtyTons,
      'ตัน (Tons)',
      `Pick Task: ${task.state}`,
      'Pick Task: assigned',
      task.state === 'queued' ? 'Warehouse Manager Assigned Pick Task' : 'Warehouse Manager Reassigned Pick Task',
      `ผู้จัดการคลังมอบหมายงาน ${task.pickNumber}: ${previousOperator} → ${operator.trim()}`,
      'WMS',
    );
    return true;
  };

  const updatePickTaskStatus = (
    taskId: string,
    newState: PickTaskState,
    notes?: string,
    actualPickedQtyTons?: number
  ): boolean => {
    const task = pickTasks.find((t) => t.id === taskId);
    const allowedNext: Partial<Record<PickTaskState, PickTaskState>> = {
      assigned: 'picking',
      picking: 'picked',
      picked: 'qc_packing',
      qc_packing: 'staged',
    };
    if (currentRole !== 'crane_operator') {
      triggerGateBlocked({
        title: 'ไม่มีสิทธิ์อัปเดตงานหยิบ',
        unmetGates: ['สถานะงานหยิบและจัดชุดอัปเดตโดย Crane / Yard Operator เท่านั้น'],
        recoveryRoute: 'สลับเป็นบทบาท Crane / Yard Operator',
      });
      return false;
    }
    if (!task || allowedNext[task.state] !== newState) {
      triggerGateBlocked({
        title: 'ลำดับงานหยิบไม่ถูกต้อง',
        unmetGates: [`เปลี่ยนจาก ${task?.state || 'UNKNOWN'} เป็น ${newState} ไม่ได้`],
        recoveryRoute: 'ทำขั้นตอนก่อนหน้าให้เสร็จก่อนดำเนินการต่อ',
      });
      return false;
    }
    if (!task.operator.trim()) {
      triggerGateBlocked({
        title: 'ยังไม่มีผู้รับงานหยิบ',
        unmetGates: ['ผู้จัดการคลังต้องมอบหมายผู้ปฏิบัติงานก่อนเริ่มหยิบ'],
        recoveryRoute: 'ให้ Warehouse Manager มอบหมายงานจากแผงควบคุม WMS-06',
      });
      return false;
    }
    if (task.state === 'picking' && (!task.qcChecklist.specTagMatches || !task.qcChecklist.gaugeToleranceOk)) {
      triggerGateBlocked({
        title: 'ยังยืนยันผลหยิบไม่ได้',
        unmetGates: ['ตรวจป้าย/สเปกให้ตรงกับ SO และตรวจขนาด/ค่าคลาดเคลื่อนก่อนบันทึกจำนวนจริง'],
        recoveryRoute: 'ทำรายการตรวจในขั้นหยิบให้ครบก่อนบันทึกผล',
      });
      return false;
    }
    if (task.state === 'qc_packing' && (!Object.values(task.qcChecklist).every(Boolean) || (task.actualPickedQtyTons || 0) < task.allocatedQtyTons - 0.001 || (task.remainingQtyTons || 0) > 0.001)) {
      triggerGateBlocked({
        title: 'ยังส่งงานเข้าจุด Staging ไม่ได้',
        unmetGates: ['จำนวนหยิบต้องครบตาม allocation และต้องตรวจรัดมัด เอกสาร และพิกัด staging ครบ'],
        recoveryRoute: 'ทำ QC/จัดชุดและยืนยันการวางในโซนที่กำหนดก่อนส่งให้ Manager ตรวจ',
      });
      return false;
    }
    if (newState === 'picked' && (!Number.isFinite(actualPickedQtyTons) || (actualPickedQtyTons as number) <= 0 || (actualPickedQtyTons as number) > task.allocatedQtyTons)) {
      triggerGateBlocked({
        title: 'จำนวนที่หยิบจริงไม่ถูกต้อง',
        unmetGates: [`กรอกจำนวนจริงมากกว่า 0 และไม่เกิน ${task.allocatedQtyTons.toFixed(3)} ตัน`],
        recoveryRoute: 'ตรวจยอดชั่ง/จำนวนมัดและบันทึกยอดจริง',
      });
      return false;
    }
    setPickTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const isShortPick = newState === 'picked' && (actualPickedQtyTons as number) < t.allocatedQtyTons - 0.001;
          const finalState = isShortPick ? 'partial_exception' : newState;
          const pickedQty = newState === 'picked' ? (actualPickedQtyTons as number) : t.actualPickedQtyTons;
          return {
            ...t,
            state: finalState,
            actualPickedQtyTons: pickedQty,
            shortQtyTons: isShortPick ? t.allocatedQtyTons - pickedQty : t.shortQtyTons,
            remainingQtyTons: Math.max(0, t.allocatedQtyTons - pickedQty),
            barcodeVerified: newState !== 'queued' ? true : t.barcodeVerified,
            completedAt: newState === 'staged' ? new Date().toISOString().replace('T', ' ').substring(0, 16) : t.completedAt,
            notes: notes || t.notes,
          };
        }
        return t;
      })
    );

    if (task) {
      addAuditLog(
        task.lotId,
        task.productSpec,
        task.allocatedQtyTons,
        'ตัน (Tons)',
        `Pick State: ${task.state}`,
        `Pick State: ${newState === 'picked' && (actualPickedQtyTons as number) < task.allocatedQtyTons - 0.001 ? 'partial_exception' : newState}`,
        `Pick State Transition: ${newState}`,
        notes || `บันทึกยอดหยิบจริง ${actualPickedQtyTons ?? task.actualPickedQtyTons} จากยอดจัดสรร ${task.allocatedQtyTons} ตัน`,
        'WMS'
      );
    }
    return true;
  };

  const updatePickQcChecklist = (taskId: string, checklist: PickTask['qcChecklist']) => {
    if (currentRole !== 'crane_operator') {
      triggerGateBlocked({
        title: 'ไม่มีสิทธิ์แก้ checklist การหยิบ',
        unmetGates: ['Checklist การตรวจสเปกและจัดชุดแก้โดย Crane / Yard Operator เท่านั้น'],
        recoveryRoute: 'สลับเป็นบทบาท Crane / Yard Operator',
      });
      return;
    }
    const task = pickTasks.find((item) => item.id === taskId);
    const editableFields = task?.state === 'picking'
      ? ['specTagMatches', 'gaugeToleranceOk'] as (keyof PickTask['qcChecklist'])[]
      : task?.state === 'qc_packing'
        ? ['strappingSecure', 'doDocsPrepared', 'designatedZonePlaced'] as (keyof PickTask['qcChecklist'])[]
        : [];
    const hasOutOfStageChange = task && (Object.keys(checklist) as (keyof PickTask['qcChecklist'])[])
      .some((key) => checklist[key] !== task.qcChecklist[key] && !editableFields.includes(key));
    if (!task || editableFields.length === 0 || hasOutOfStageChange) {
      triggerGateBlocked({
        title: 'ตรวจรายการนี้ได้เฉพาะในขั้นตอนที่เกี่ยวข้อง',
        unmetGates: ['รายการตรวจตอนหยิบทำได้ระหว่าง Picking; รายการ QC/บรรจุ/วางโซนทำได้ระหว่าง QC & Packing'],
        recoveryRoute: 'กลับไปยังขั้นตอนงานปัจจุบันแล้วบันทึกรายการตรวจที่เกี่ยวข้อง',
      });
      return;
    }
    setPickTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, qcChecklist: checklist } : t))
    );
  };

  // P0 CORRECTION 3: Damage Exception during picking
  // Stop and quantify ONLY the affected slice; keep unaffected reserved qty at 04!
  // Create processing job 04 -> 05 on approval -> 06 when work starts. Never send original directly to 07!
  /** Damage on a booked lot while picking: damaged part goes to [07]; the good part keeps its pick; the booking card offers a replacement. */
  const reportBookingPickDamage = (task: PickTask, sourceItem: InventoryItem, booking: StockBooking, damagedQtyTons: number, reason: string): boolean => {
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 16).replace('T', ' ');
    const unaffectedQty = Math.max(0, task.allocatedQtyTons - damagedQtyTons);
    const isWholeLot = unaffectedQty <= 0.001;
    const damagedLotId = isWholeLot ? sourceItem.id : `${sourceItem.id}-DMG-${now.getTime().toString().slice(-5)}`;
    const damagedItem: InventoryItem = {
      ...sourceItem, id: damagedLotId, lotNumber: isWholeLot ? sourceItem.lotNumber : `${sourceItem.lotNumber}-DMG`, sourceLotId: isWholeLot ? sourceItem.sourceLotId : sourceItem.id,
      totalWeightTons: damagedQtyTons, availableWeightTons: 0, reservedWeightTons: 0, canonicalStatus: '07',
      physicalCondition: 'SEVERELY_DAMAGED', isExcluded: true, exclusionReason: `พบชำรุดระหว่างหยิบ: ${reason}`, lastUpdated: timestamp,
    };
    setInventory((current) => current.flatMap((entry) => {
      if (entry.id !== sourceItem.id) return [entry];
      if (isWholeLot) return [damagedItem];
      return [{ ...entry, totalWeightTons: unaffectedQty, reservedWeightTons: unaffectedQty, lastUpdated: timestamp }, damagedItem];
    }));
    setPickTasks((current) => current.map((entry) => entry.id === task.id
      ? {
          ...entry,
          allocatedQtyTons: unaffectedQty,
          remainingQtyTons: Math.max(0, unaffectedQty - entry.actualPickedQtyTons),
          state: isWholeLot ? 'partial_exception' : entry.state,
          notes: `${entry.notes ? `${entry.notes}; ` : ''}แยกของเสีย ${damagedQtyTons.toFixed(3)} ตัน เป็น ${damagedLotId} [07]`,
        }
      : entry));
    setStockBookings((current) => current.map((entry) => entry.id === booking.id
      ? { ...entry, exception: { source: 'PICK', damagedLotId, damagedQtyTons, reason, reportedAt: now.toISOString(), status: 'WAITING_WAREHOUSE' } }
      : entry));
    addAuditLog(damagedLotId, sourceItem.productName, damagedQtyTons, 'ตัน', '[04]', '[07]', 'พบของชำรุดระหว่างหยิบ', `${reason}; ส่วนดี ${unaffectedQty.toFixed(3)} ตัน หยิบต่อ; รอคลังเสนอล็อตทดแทนบนการ์ดการจอง`, 'WMS');
    return true;
  };

  const reportDamagedStockInPicking = (
    taskId: string,
    damagedQtyTons: number,
    reason: string
  ): boolean => {
    const task = pickTasks.find((t) => t.id === taskId);
    if (currentRole !== 'crane_operator' || !task || task.state !== 'picking' || !Number.isFinite(damagedQtyTons) || damagedQtyTons <= 0 || damagedQtyTons > task.allocatedQtyTons) {
      triggerGateBlocked({
        title: 'ข้อมูลแจ้งของเสียไม่ผ่านการตรวจสอบ',
        unmetGates: ['ต้องเป็น Crane / Yard Operator, งานอยู่ระหว่างหยิบ และยอดเสียต้องมากกว่า 0 แต่ไม่เกินยอดจัดสรร'],
        recoveryRoute: 'เปิดแจ้งของเสียจากใบหยิบที่กำลังดำเนินการและกรอกยอดผลกระทบจริง',
      });
      return false;
    }
    const sourceItem = inventory.find((item) => item.id === task.lotId);
    if (!sourceItem || sourceItem.canonicalStatus !== '04' || sourceItem.totalWeightTons < task.allocatedQtyTons - 0.001 || !reason.trim()) {
      triggerGateBlocked({ title: 'ยืนยันของชำรุดไม่ได้', unmetGates: ['งานต้องอ้างสินค้า [04] Reserved ที่มีจำนวนครบตาม allocation และต้องบันทึกสาเหตุ'], recoveryRoute: 'ตรวจ lot, ยอดจอง และเหตุผลความเสียหายก่อนเปิด exception' });
      return false;
    }

    const linkedBooking = stockBookings.find((entry) => entry.lotId === task.lotId && entry.approvedSoReference === task.soNumber && entry.status === 'RESERVED');
    if (linkedBooking) return reportBookingPickDamage(task, sourceItem, linkedBooking, damagedQtyTons, reason.trim());

    const unaffectedQty = Math.max(0, task.allocatedQtyTons - damagedQtyTons);
    const jobId = `JOB-2026-${Math.floor(100 + Math.random() * 900)}`;
    const policy = policies.find((item) => item.id === activePolicyId) || policies.find((item) => item.status === 'ACTIVE');
    const agingThreshold = policy?.agingThresholdDays || 90;
    const agingWeight = policy?.rules.find((rule) => rule.ruleName.includes('Aging') || rule.ruleName.includes('Clearance'))?.weight ?? 45;
    const fifoWeight = policy?.rules.find((rule) => rule.ruleName.includes('FIFO'))?.weight ?? 30;
    const bayWeight = policy?.rules.find((rule) => rule.ruleName.includes('Bay') || rule.ruleName.includes('Crane'))?.weight ?? 15;
    const recommendation = inventory
      .filter((item) => item.id !== task.lotId && item.canonicalStatus === '02' && !item.isExcluded && item.availableWeightTons >= damagedQtyTons && item.productCode === sourceItem?.productCode)
      .map((item) => {
        const agingScore = item.ageDays >= agingThreshold ? 100 : Math.round((item.ageDays / agingThreshold) * 60);
        const fifoScore = Math.min(100, Math.round(50 + (item.ageDays / 120) * 50));
        const bayScore = item.locationBay.includes('03-B2') ? 100 : item.locationBay.includes('03-C1') ? 92 : 80;
        const otherWeight = Math.max(0, 100 - agingWeight - fifoWeight - bayWeight);
        return { item, score: Math.round((agingScore * agingWeight + fifoScore * fifoWeight + bayScore * bayWeight + 85 * otherWeight) / 100) };
      })
      .sort((left, right) => right.score - left.score)[0];
    const replacementLotId = recommendation?.item.id;

    setPickTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              state: 'partial_exception',
              shortQtyTons: damagedQtyTons,
              blockedQtyTons: damagedQtyTons,
              remainingQtyTons: unaffectedQty,
              damagedException: {
                reason,
                affectedQtyTons: damagedQtyTons,
                unaffectedQtyTons: unaffectedQty,
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
                processingJobId: jobId,
                replacementLotId,
              },
            }
          : t
      )
    );

    // Keep unaffected quantity at 04 Reserved; slice only the affected quantity to 05 Pending Processing!
    setInventory((prev) => {
      const origItem = prev.find((it) => it.id === task.lotId);
      if (!origItem) return prev;

      const dmgLotId = `${task.lotId}-DMG`;
      const damagedSliceItem: InventoryItem = {
        ...origItem,
        id: dmgLotId,
        lotNumber: dmgLotId,
        totalWeightTons: damagedQtyTons,
        availableWeightTons: 0,
        reservedWeightTons: 0,
        canonicalStatus: '05', // [05] สินค้ารอแปรรูป (Pending Processing)
        locationBay: 'BAY-REWORK-01',
        physicalCondition: 'BENT_END',
        isExcluded: true,
        exclusionReason: `พบชำรุดระหว่างหยิบ: ${reason}`,
        lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16),
      };

      const updatedOrigItem: InventoryItem = {
        ...origItem,
        totalWeightTons: unaffectedQty,
        reservedWeightTons: unaffectedQty,
        availableWeightTons: 0,
        canonicalStatus: '04', // [04] สินค้าจองตามใบสั่งขาย (Reserved) - ส่วนที่สมบูรณ์คงเดิม!
        lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16),
      };

      const remainingList = prev.filter((it) => it.id !== task.lotId);
      return unaffectedQty > 0
        ? [...remainingList, updatedOrigItem, damagedSliceItem]
        : [...remainingList, damagedSliceItem];
    });

    // Create Processing Job in WMS-11 with status PENDING (04 -> 05 on approval)
    const dmgLotId = `${task.lotId}-DMG`;
    const newJob: ProcessingJob = {
      id: jobId,
      jobNumber: jobId,
      jobType: 'DAMAGE_REWORK',
      inputLotId: dmgLotId,
      inputStatus: '05',
      inputQtyTons: damagedQtyTons,
      outputQtyTons: 0,
      scrapQtyTons: 0,
      remainingQtyTons: damagedQtyTons,
      status: 'PENDING',
      operator: 'มานพ ช่างตัด',
      machine: 'CUT-MACHINE-02',
      notes: reason,
      linkedSoNumber: task.soNumber,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      physicalReceiptConfirmed: false,
    };
    setProcessingJobs((prev) => [newJob, ...prev]);

    // Create replacement proposal for Sales decision in WMS-05
    const candidateItem = recommendation?.item;
    if (candidateItem) {
      const newProposal: StockReplacementProposal = {
      id: `REP-${Date.now().toString().slice(-6)}`,
      soNumber: task.soNumber,
      lineNumber: task.lineNumber,
      originalLotId: task.lotId,
      proposedLotId: candidateItem.id,
      originalBay: task.targetBay,
      proposedBay: candidateItem.locationBay,
      qtyTons: damagedQtyTons,
      defectNote: `พบสินค้าชำรุดขณะยก: ${reason} • แนะนำตาม policy ${policy?.version || 'default'} (score ${recommendation.score})`,
      evidence: 'PHOTO-QC-DAMAGE-ATTACHED.JPG',
      status: 'PROPOSED',
      proposedBy: `${USER_ROLES[currentRole].titleTh} (${USER_ROLES[currentRole].name})`,
      proposedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      };
      setReplacementProposals((prev) => [newProposal, ...prev]);
    }

    addAuditLog(
      task.lotId,
      task.productSpec,
      damagedQtyTons,
      'ตัน (Tons)',
      '[04] Reserved',
      '[05] Pending Processing',
      'Damaged Stock Exception Reported in Picking',
      `พบชำรุดเฉพาะส่วน ${damagedQtyTons} ตัน (ส่วนดี ${unaffectedQty} ตัน คงที่ [04]) เปิดงานแปรรูป ${jobId} ใน WMS-11 และ${candidateItem ? `แนะนำ Lot ${candidateItem.id} ใน WMS-05 ตาม policy ${policy?.version || 'default'}` : 'ไม่พบ Lot ทดแทนที่ตรงสเปกและมี available เพียงพอ; ให้จัดการคำขอใหม่เมื่อมี stock'}`,
      'WMS'
    );

    return true;
  };

  // WMS-06: Manager Confirms [08] Ready for Delivery + WHX-01
  /** Pick tasks of a quotation order that are prepared and shipped together. */
  const orderPickTasks = (soNumber: string) => pickTasks.filter((task) => task.soNumber === soNumber && stockBookings.some((booking) => booking.lotId === task.lotId && booking.approvedSoReference === soNumber));
  /** Reserved booking lines of the order that still have no pick task (processed steel waiting for processing / QC). */
  const orderLinesWithoutPick = (soNumber: string) => stockBookings.filter((booking) => booking.approvedSoReference === soNumber && booking.status === 'RESERVED'
    && !pickTasks.some((task) => task.lotId === booking.lotId && task.soNumber === soNumber)
    && ['04', '05', '06'].includes(inventory.find((item) => item.id === booking.lotId)?.canonicalStatus || ''));

  /** Every item is picked on its own; once all are picked, the crane operator brings the whole order to its gate in one step. */
  const stageOrderAtGate = (soNumber: string): boolean => {
    const tasks = orderPickTasks(soNumber).filter((task) => !task.readinessConfirmed);
    if (currentRole !== 'crane_operator' || !tasks.length || orderLinesWithoutPick(soNumber).length > 0) return false;
    if (tasks.some((task) => !['picked', 'qc_packing'].includes(task.state) || (task.actualPickedQtyTons || 0) < task.allocatedQtyTons - 0.001)) return false;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const ids = new Set(tasks.map((task) => task.id));
    setPickTasks((prev) => prev.map((task) => ids.has(task.id)
      ? { ...task, state: 'staged', remainingQtyTons: 0, completedAt: now, qcChecklist: { strappingSecure: true, specTagMatches: true, gaugeToleranceOk: true, doDocsPrepared: true, designatedZonePlaced: true }, notes: `เตรียมส่งรวมใบสั่ง ${soNumber} ที่ประตู ${task.stagingGate}` }
      : task));
    tasks.forEach((task) => addAuditLog(task.lotId, task.productSpec, task.allocatedQtyTons, 'ตัน', 'Pick State: picked', 'Pick State: staged', 'เตรียมส่งรวมทั้งใบสั่ง', `วางที่ประตู ${task.stagingGate} พร้อมรายการอื่นในใบสั่ง ${soNumber}`, 'WMS'));
    return true;
  };

  /** Manager confirms the whole order ready for delivery [08] at its gate with one WHX-01 signal. */
  const confirmOrderReady08 = (soNumber: string): boolean => {
    const tasks = orderPickTasks(soNumber).filter((task) => !task.readinessConfirmed);
    if (currentRole !== 'warehouse_manager' || !tasks.length || orderLinesWithoutPick(soNumber).length > 0 || tasks.some((task) => task.state !== 'staged')) return false;
    if (tasks.some((task) => inventory.find((item) => item.id === task.lotId)?.canonicalStatus !== '04')) return false;
    const whx01Id = `WHX-01-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const byLot = new Map(tasks.map((task) => [task.lotId, task]));
    setPickTasks((prev) => prev.map((task) => tasks.some((entry) => entry.id === task.id)
      ? { ...task, state: 'ready', readinessConfirmed: true, readinessVersion: `v${(Number(task.readinessVersion.replace(/^v/i, '')) + 0.01).toFixed(2)}`, whx01EventId: whx01Id }
      : task));
    setInventory((prev) => prev.map((item) => byLot.has(item.id)
      ? { ...item, canonicalStatus: '08', locationBay: byLot.get(item.id)!.stagingGate, lastUpdated: now }
      : item));
    tasks.forEach((task) => addAuditLog(task.lotId, task.productSpec, task.allocatedQtyTons, 'ตัน', '[04] Reserved', '[08] Ready for Delivery', `ผู้จัดการยืนยันพร้อมส่งทั้งใบสั่ง (${whx01Id})`, `ใบสั่ง ${soNumber} · ประตู ${task.stagingGate}`, 'WMS'));
    appendIntegrationMessage({
      source: 'WMS',
      target: 'LOGISTICS_APP',
      direction: 'OUTBOUND',
      schema: 'urn:tts:logistics:warehouse-readiness:1.0',
      event: 'WAREHOUSE_READINESS_CONFIRMED',
      correlationId: `CORR-${whx01Id}`,
      idempotencyKey: `IDEM-LGX-READY-${whx01Id}`,
      dependencies: tasks.map((task) => task.id),
      owner: 'WMS Logistics Interface',
      entityRef: soNumber,
      payloadSummary: `Order ${soNumber}: ${tasks.length} items, ${tasks.reduce((sum, task) => sum + task.allocatedQtyTons, 0).toFixed(3)} T ready at gate ${tasks[0].stagingGate}.`,
    });
    return true;
  };

  const managerConfirmStaging08 = (taskId: string, designatedZone: string): boolean => {
    if (currentRole !== 'warehouse_manager') {
      triggerGateBlocked({
        title: 'ไม่อนุญาตให้ดำเนินการ: ต้องใช้สิทธิ์ผู้จัดการคลัง (Warehouse Manager Only)',
        unmetGates: [
          'การยืนยันสินค้าพร้อมส่งมอบ [08] Ready for Delivery และพิกัด Staging ต้องได้รับการตรวจสอบโดย ผจก. คลัง เท่านั้น',
        ],
        recoveryRoute: 'สลับสิทธิ์การใช้งานเป็น "ผู้จัดการคลังสินค้า (Warehouse Manager)"',
      });
      return false;
    }

    const task = pickTasks.find((t) => t.id === taskId);
    if (!task) return false;
    const stagedItem = inventory.find((item) => item.id === task.lotId);
    const checklistComplete = Object.values(task.qcChecklist).every(Boolean);
    if (task.readinessConfirmed || task.state !== 'staged' || (task.actualPickedQtyTons || 0) < task.allocatedQtyTons - 0.001 || (task.remainingQtyTons || 0) > 0.001 || !checklistComplete || !designatedZone.trim() || stagedItem?.canonicalStatus !== '04' || (stagedItem?.totalWeightTons || 0) < task.allocatedQtyTons - 0.001 || (stagedItem?.reservedWeightTons || 0) < task.allocatedQtyTons - 0.001) {
      triggerGateBlocked({
        title: 'งานยังไม่พร้อมยืนยัน [08]',
        unmetGates: [
          `สถานะงานหยิบปัจจุบันคือ "${task.state}"; ต้องเป็น staged และยอดหยิบจริงต้องครบ ${task.allocatedQtyTons.toFixed(3)} ตัน`,
          'ต้องไม่มีปริมาณค้าง, checklist QC/เอกสาร/โซนครบ, lot ต้องเป็น [04] และมียอดรวม/ยอดจองไม่น้อยกว่ายอด task',
          'ต้องระบุพิกัด staging จริงก่อนส่ง WHX-01',
        ],
        recoveryRoute: 'ให้ Crane ทำ pick, QC/Packing และ staging ให้ครบ แล้วให้ Warehouse Manager ตรวจพิกัดก่อนยืนยัน',
      });
      return false;
    }

    const whx01Id = `WHX-01-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    setPickTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              state: 'ready',
              readinessConfirmed: true,
              stagingGate: designatedZone,
              readinessVersion: `v${(Number(t.readinessVersion.replace(/^v/i, '')) + 0.01).toFixed(2)}`,
              whx01EventId: whx01Id,
            }
          : t
      )
    );

    // Update inventory to [08] Ready for Delivery (P0 RULE: Readiness DOES NOT decrement stock!)
    setInventory((prev) => prev.map((it) => it.id === task.lotId
      ? { ...it, canonicalStatus: '08', locationBay: designatedZone, lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16) }
      : it));

    addAuditLog(
      task.lotId,
      task.productSpec,
      task.allocatedQtyTons,
      'ตัน (Tons)',
      '[04] Reserved',
      '[08] Ready for Delivery',
      `Warehouse Manager Confirms Staging (${whx01Id})`,
      `ผจก.คลัง ยืนยันพิกัดชานชาลา ${designatedZone} สถานะ [08] พร้อมส่งมอบ ส่งสัญญาณ WHX-01 จำลอง (ไม่ตัดสต็อก)`,
      'WMS'
    );

    appendIntegrationMessage({
      source: 'WMS',
      target: 'DATA_BUCKET',
      direction: 'OUTBOUND',
      schema: 'urn:tts:warehouse:readiness-confirmation:1.0',
      event: 'WHX01_STAGING_READY',
      correlationId: `CORR-${whx01Id}`,
      idempotencyKey: `IDEM-${whx01Id}`,
      dependencies: [task.id, task.readinessVersion],
      owner: 'WMS Readiness Publisher',
      entityRef: task.id,
      payloadSummary: `Warehouse Manager confirmed [08] สินค้าพร้อมส่งมอบ at ${designatedZone}; stock remains on hand until LGX-03.`,
    });
    appendIntegrationMessage({
      source: 'WMS',
      target: 'LOGISTICS_APP',
      direction: 'OUTBOUND',
      schema: 'urn:tts:logistics:warehouse-readiness:1.0',
      event: 'WAREHOUSE_READINESS_CONFIRMED',
      correlationId: `CORR-${whx01Id}`,
      idempotencyKey: `IDEM-LGX-READY-${whx01Id}`,
      dependencies: [task.id, task.readinessVersion],
      owner: 'WMS Logistics Interface',
      entityRef: task.id,
      payloadSummary: `Shipment ${task.soNumber}, ${task.allocatedQtyTons} T ready at ${designatedZone}; no outbound stock posting.`,
    });

    return true;
  };

  const amendStagingReadinessWHX02 = (taskId: string, reason: string, designatedZone?: string): boolean => {
    const task = pickTasks.find((t) => t.id === taskId);
    const amendedZone = designatedZone?.trim() || task?.stagingGate || '';
    if (currentRole !== 'warehouse_manager' || !task || !task.readinessConfirmed || task.outboundHandoverAccepted || !reason.trim() || !amendedZone) {
      triggerGateBlocked({
        title: 'ไม่สามารถแก้ไขความพร้อมส่งมอบ',
        unmetGates: ['ต้องเป็น Warehouse Manager และ readiness ต้องยังไม่ถูกใช้รับขึ้นรถ'],
        recoveryRoute: 'ตรวจบทบาทและ pickup state; หากส่งขึ้นรถแล้วให้ใช้ Logistics correction flow',
      });
      return false;
    }

    const readinessVersion = `v${(Number(task.readinessVersion.replace(/^v/i, '')) + 0.01).toFixed(2)}`;
    setPickTasks((prev) => prev.map((item) => item.id === taskId ? { ...item, stagingGate: amendedZone, readinessVersion } : item));
    setInventory((prev) => prev.map((item) => item.id === task.lotId ? { ...item, locationBay: amendedZone, lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16) } : item));

    addAuditLog(
      task.lotId,
      task.productSpec,
      task.allocatedQtyTons,
      'ตัน (Tons)',
      '[08] Ready for Delivery',
      '[08] Ready for Delivery (Amended)',
      'WHX-02 Amend Readiness Staging',
      `แก้ไขพิกัดส่งมอบเป็น ${amendedZone}; readiness version ${readinessVersion}: ${reason} (ส่งผลกระทบต่อคิวรถจำลอง)`,
      'WMS'
    );
    appendIntegrationMessage({
      source: 'WMS',
      target: 'LOGISTICS_APP',
      direction: 'OUTBOUND',
      schema: 'urn:tts:logistics:warehouse-readiness:1.0',
      event: 'WHX02_READINESS_AMENDED',
      correlationId: `CORR-WHX02-${task.id}-${readinessVersion}`,
      idempotencyKey: `IDEM-WHX02-${task.id}-${readinessVersion}`,
      dependencies: [task.whx01EventId || task.id],
      owner: 'WMS Logistics Interface',
      entityRef: task.id,
      payloadSummary: `Readiness ${readinessVersion} amended to ${amendedZone}: ${reason}; inventory remains on hand.`,
    });
    appendIntegrationMessage({
      source: 'WMS',
      target: 'DATA_BUCKET',
      direction: 'OUTBOUND',
      schema: 'urn:tts:warehouse:readiness-amendment:1.0',
      event: 'WHX02_READINESS_AMENDED',
      correlationId: `CORR-WHX02-BUCKET-${task.id}-${readinessVersion}`,
      idempotencyKey: `IDEM-WHX02-BUCKET-${task.id}-${readinessVersion}`,
      dependencies: [task.whx01EventId || task.id],
      owner: 'WMS Readiness Publisher',
      entityRef: task.id,
      payloadSummary: `Readiness ${readinessVersion} changed to ${amendedZone}; canonical status remains [08].`,
    });
    return true;
  };

  const cancelStagingReadinessWHX03 = (taskId: string, reason: string): boolean => {
    const task = pickTasks.find((t) => t.id === taskId);
    if (currentRole !== 'warehouse_manager' || !task || !task.readinessConfirmed || task.outboundHandoverAccepted) {
      triggerGateBlocked({
        title: 'ไม่สามารถถอนความพร้อมส่งมอบ',
        unmetGates: ['ต้องเป็น Warehouse Manager; ถอน readiness ได้ก่อนมี pickup accepted เท่านั้น'],
        recoveryRoute: 'ตรวจบทบาทและ pickup state ก่อนส่ง WHX-03',
      });
      return false;
    }

    setPickTasks((prev) => prev.map((t) => t.id === taskId ? {
      ...t,
      readinessConfirmed: false,
      state: 'staged',
      readinessVersion: `v${(Number(t.readinessVersion.replace(/^v/i, '')) + 0.01).toFixed(2)}`,
    } : t));

    setInventory((prev) =>
      prev.map((it) => (it.id === task.lotId ? { ...it, canonicalStatus: '04', locationBay: task.targetBay, lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16) } : it))
    );

    addAuditLog(
      task.lotId,
      task.productSpec,
      task.allocatedQtyTons,
      'ตัน (Tons)',
      '[08] Ready for Delivery',
      '[04] Reserved',
      'WHX-03 Cancel Readiness Gate',
      `ยกเลิกความพร้อมส่งมอบ: ${reason} ปรับสถานะกลับเป็น [04] Reserved`,
      'WMS'
    );
    appendIntegrationMessage({
      source: 'WMS',
      target: 'LOGISTICS_APP',
      direction: 'OUTBOUND',
      schema: 'urn:tts:logistics:warehouse-readiness:1.0',
      event: 'WHX03_READINESS_CANCELLED',
      correlationId: `CORR-WHX03-${task.id}-${Date.now()}`,
      idempotencyKey: `IDEM-WHX03-${task.id}-${Date.now()}`,
      dependencies: [task.whx01EventId || task.id],
      owner: 'WMS Logistics Interface',
      entityRef: task.id,
      payloadSummary: `Readiness cancelled: ${reason}; allocation returns to [04] Reserved.`,
    });
    return true;
  };

  // P0 CORRECTION 5: Only accepted simulated Logistics LGX-03 can decrement and move 08 -> 09 once!
  const simulateLogisticsHandoverLGX03 = (
    taskId: string,
    driver: string,
    plate: string,
    actualQtyTons?: number
  ): boolean => {
    const task = pickTasks.find((t) => t.id === taskId);
    if (currentRole !== 'logistics_clerk') {
      triggerGateBlocked({
        title: 'ไม่มีสิทธิ์ตอบรับ LGX-03',
        unmetGates: ['รับมอบขึ้นรถเป็น event จาก Logistics app / Logistics Clerk เท่านั้น'],
        recoveryRoute: 'สลับเป็น Logistics Clerk หรือรับ event ผ่าน Integration Inbox',
      });
      return false;
    }
    if (!task) return false;

    if (!task.readinessConfirmed || task.state !== 'ready') {
      triggerGateBlocked({
        title: 'ไม่ผ่านเงื่อนไขการส่งมอบขึ้นรถ (Handover Gate Blocked)',
        unmetGates: [
          'สินค้าต้องได้รับการยืนยันสถานะ [08] Ready for Delivery โดย ผจก. คลัง ก่อนเท่านั้น',
          'เอกสารคู่มือส่งมอบ DO Ticket และผลการตรวจสอบชานชาลาต้องครบถ้วน',
        ],
        recoveryRoute: 'ให้ ผจก.คลัง กดยืนยันพื้นที่ Staging [08] ในหน้ารายละเอียดงานหยิบก่อน',
      });
      return false;
    }

    const pickedUpSoFar = task.pickedUpQtyTons || 0;
    const remainingToPickup = Math.max(0, task.allocatedQtyTons - pickedUpSoFar);
    const pickedQty = actualQtyTons ?? remainingToPickup;
    const stagedItem = inventory.find((it) => it.id === task.lotId);
    if (
      !stagedItem ||
      stagedItem.canonicalStatus !== '08' ||
      !Number.isFinite(pickedQty) ||
      pickedQty <= 0 ||
      pickedQty > remainingToPickup + 0.001 ||
      pickedQty > stagedItem.totalWeightTons + 0.001
    ) {
      triggerGateBlocked({
        title: 'จำนวนรับขึ้นรถไม่ถูกต้อง',
        unmetGates: [
          `ยอดรับจริงต้องมากกว่า 0 และไม่เกินยอดคงรับ ${remainingToPickup.toFixed(3)} ตัน`,
          'ต้องเป็นสินค้าสถานะ [08] ที่ Warehouse Manager ยืนยัน readiness แล้ว',
        ],
        recoveryRoute: 'ตรวจสถานะ readiness, version และปริมาณที่เหลือก่อนส่ง event ใหม่',
      });
      return false;
    }

    const manifestNo = `DO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const transitId = pickedQty < stagedItem.totalWeightTons - 0.001
      ? `${stagedItem.id}-TR-${manifestNo.slice(-4)}`
      : stagedItem.id;
    const newPickedTotal = pickedUpSoFar + pickedQty;

    setPickTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              manifestNumber: manifestNo,
              driverName: driver,
              vehiclePlate: plate,
              outboundHandoverAccepted: true,
              pickedUpQtyTons: newPickedTotal,
              transitInventoryItemIds: [...(t.transitInventoryItemIds || []), transitId],
            }
          : t
      )
    );

    // Only the accepted pickup slice is posted to 09. A partial pickup leaves the rest at 08.
    setInventory((prev) => {
      const source = prev.find((it) => it.id === task.lotId);
      if (!source) return prev;
      const availableMoved = Math.min(source.availableWeightTons, pickedQty);
      const reservedMoved = Math.min(source.reservedWeightTons, Math.max(0, pickedQty - availableMoved));
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
      if (transitId === source.id) {
        return prev.map((it) =>
          it.id === source.id
            ? {
                ...it,
                totalWeightTons: pickedQty,
                availableWeightTons: 0,
                reservedWeightTons: 0,
                canonicalStatus: '09',
                locationBay: 'IN-TRANSIT',
                lastUpdated: timestamp,
              }
            : it
        );
      }
      const transitSlice: InventoryItem = {
        ...source,
        id: transitId,
        lotNumber: `${source.lotNumber}-${manifestNo.slice(-4)}`,
        totalWeightTons: pickedQty,
        availableWeightTons: 0,
        reservedWeightTons: 0,
        canonicalStatus: '09',
        locationBay: 'IN-TRANSIT',
        lastUpdated: timestamp,
      };
      return prev.flatMap((it) =>
        it.id === source.id
          ? [{
              ...it,
              totalWeightTons: Math.max(0, it.totalWeightTons - pickedQty),
              availableWeightTons: Math.max(0, it.availableWeightTons - availableMoved),
              reservedWeightTons: Math.max(0, it.reservedWeightTons - reservedMoved),
              canonicalStatus: '08',
              lastUpdated: timestamp,
            }, transitSlice]
          : [it]
      );
    });

    // Clearance Plan counts accepted LGX-03 ONCE
    setClearancePlan((prev) => ({
      ...prev,
      monthlyTargets: prev.monthlyTargets.map((m, idx) =>
        idx === 0
          ? {
              ...m,
              actualClearedTons: m.actualClearedTons + pickedQty,
              varianceTons: m.actualClearedTons + pickedQty - m.targetTons,
            }
          : m
      ),
    }));

    addAuditLog(
      task.lotId,
      task.productSpec,
      pickedQty,
      'ตัน (Tons)',
      '[08] Ready for Delivery',
      '[09] In Transit',
      'Outbound Handover Gate (LGX-03 Accepted Handover)',
      `รับมอบสินค้าขึ้นรถสำเร็จ ใบส่งของ ${manifestNo} ตัดลดยอดจริง ${pickedQty} ตัน; คงเหลือรอ pickup ${(task.allocatedQtyTons - newPickedTotal).toFixed(3)} ตัน`,
      'LOGISTICS',
      { manifestNo, driver, plate, pickedQty, remainingReadyQtyTons: task.allocatedQtyTons - newPickedTotal, transitId }
    );

    appendIntegrationMessage({
      source: 'LOGISTICS_APP',
      target: 'WMS',
      direction: 'INBOUND',
      schema: 'urn:tts:logistics:lgx03-handover:1.0',
      event: 'LGX03_PICKUP_ACCEPTED',
      correlationId: `CORR-${manifestNo}`,
      idempotencyKey: `IDEM-${manifestNo}`,
      dependencies: [task.whx01EventId || task.id],
      owner: 'WMS Outbound Event Handler',
      entityRef: task.id,
      payloadSummary: `${pickedQty} T accepted at pickup; ${Math.max(0, task.allocatedQtyTons - newPickedTotal)} T remains ready.`,
    });

    return true;
  };

  const simulateDeliveryLGX04 = (taskId: string): boolean => {
    const task = pickTasks.find((t) => t.id === taskId);
    if (currentRole !== 'logistics_clerk') {
      triggerGateBlocked({
        title: 'ไม่มีสิทธิ์ตอบรับ LGX-04',
        unmetGates: ['ผลส่งมอบลูกค้าต้องมาจาก Logistics app / Logistics Clerk'],
        recoveryRoute: 'สลับเป็น Logistics Clerk หรือรับผลผ่าน Integration Inbox',
      });
      return false;
    }
    const pendingDelivery = (task?.pickedUpQtyTons || 0) - (task?.deliveredQtyTons || 0);
    const transitIds = task?.transitInventoryItemIds || [];
    const transitSlices = inventory.filter((it) => transitIds.includes(it.id) && it.canonicalStatus === '09');
    if (!task || pendingDelivery <= 0 || transitSlices.length === 0) {
      triggerGateBlocked({
        title: 'ไม่พบปริมาณระหว่างขนส่งให้ส่งมอบ',
        unmetGates: ['ต้องมี LGX-03 accepted และสินค้าสถานะ [09] ก่อนรับผล LGX-04'],
        recoveryRoute: 'ตรวจสอบใบส่งของและสถานะ event ใน WMS-02',
      });
      return false;
    }

    setInventory((prev) =>
      prev.map((it) => transitIds.includes(it.id) && it.canonicalStatus === '09' ? { ...it, canonicalStatus: '10' } : it)
    );
    setPickTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, deliveredQtyTons: (t.deliveredQtyTons || 0) + pendingDelivery } : t));

    addAuditLog(
      task.lotId,
      task.productSpec,
      pendingDelivery,
      'ตัน (Tons)',
      '[09] In Transit',
      '[10] Delivered',
      'Delivery Completion (LGX-04 Accepted)',
      `ลูกค้ารับมอบสินค้า ณ ไซต์งานเรียบร้อย เปลี่ยนสถานะ [09] → [10] ส่งมอบแล้ว`,
      'LOGISTICS'
    );
    appendIntegrationMessage({
      source: 'LOGISTICS_APP',
      target: 'WMS',
      direction: 'INBOUND',
      schema: 'urn:tts:logistics:lgx04-delivery:1.0',
      event: 'LGX04_DELIVERY_ACCEPTED',
      correlationId: `CORR-LGX04-${task.id}-${Date.now()}`,
      idempotencyKey: `IDEM-LGX04-${task.id}-${task.deliveredQtyTons || 0}`,
      dependencies: [task.manifestNumber || task.id],
      owner: 'WMS Delivery Event Handler',
      entityRef: task.id,
      payloadSummary: `${pendingDelivery} T accepted by customer; product slice moved [09] → [10].`,
    });
    return true;
  };

  const simulateDeliveryFailureLGX05 = (taskId: string, reason: string): boolean => {
    const task = pickTasks.find((t) => t.id === taskId);
    if (currentRole !== 'logistics_clerk') {
      triggerGateBlocked({
        title: 'ไม่มีสิทธิ์บันทึก LGX-05',
        unmetGates: ['ผลส่งมอบไม่สำเร็จต้องมาจาก Logistics app / Logistics Clerk'],
        recoveryRoute: 'สลับเป็น Logistics Clerk หรือรับ event ผ่าน Integration Inbox',
      });
      return false;
    }
    const pendingDelivery = (task?.pickedUpQtyTons || 0) - (task?.deliveredQtyTons || 0);
    if (!task || pendingDelivery <= 0 || !reason.trim()) {
      triggerGateBlocked({
        title: 'บันทึกการส่งมอบไม่สำเร็จไม่ได้',
        unmetGates: ['ต้องมีปริมาณที่กำลังขนส่งและเหตุผลความล้มเหลว'],
        recoveryRoute: 'ตรวจสอบสถานะ [09] และระบุเหตุผล/ผู้รับผิดชอบติดตาม',
      });
      return false;
    }
    setPickTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, deliveryFailureNote: reason } : t));

    // BRD RULE: Failed delivery remains [09] with owner & recovery route!
    addAuditLog(
      task.lotId,
      task.productSpec,
      pendingDelivery,
      'ตัน (Tons)',
      '[09] In Transit',
      '[09] In Transit (Delivery Failed - Retention)',
      'Delivery Failed Gate (LGX-05)',
      `การส่งมอบปลายทางไม่สำเร็จ: ${reason} สินค้าคงสถานะ [09] สินค้าระหว่างขนส่ง โดยมีทีมจัดส่งรับผิดชอบนำรถกลับมาตรวจรับใหม่`,
      'LOGISTICS'
    );
    appendIntegrationMessage({
      source: 'LOGISTICS_APP',
      target: 'WMS',
      direction: 'INBOUND',
      schema: 'urn:tts:logistics:lgx05-delivery-failure:1.0',
      event: 'LGX05_DELIVERY_FAILED_RETAIN_09',
      correlationId: `CORR-LGX05-${task.id}-${Date.now()}`,
      idempotencyKey: `IDEM-LGX05-${task.id}-${task.manifestNumber || 'NO-MANIFEST'}`,
      dependencies: [task.manifestNumber || task.id],
      owner: 'Logistics Recovery Lead',
      entityRef: task.id,
      payloadSummary: `${pendingDelivery} T remains [09] In Transit; follow-up required: ${reason}`,
    });
    return true;
  };

  const simulateCustomerClaimLGX06 = (
    taskId: string,
    claimQtyTons: number,
    defectReason: string
  ): boolean => {
    const task = pickTasks.find((t) => t.id === taskId);
    if (currentRole !== 'logistics_clerk') {
      triggerGateBlocked({
        title: 'ไม่มีสิทธิ์เปิด event เคลม',
        unmetGates: ['LGX-06 claim/return event ต้องมาจาก Logistics app / Logistics Clerk'],
        recoveryRoute: 'สลับเป็น Logistics Clerk หรือรับ event ผ่าน Integration Inbox',
      });
      return false;
    }
    const deliveredIds = task?.transitInventoryItemIds || [];
    const item = inventory.find((it) => deliveredIds.includes(it.id) && it.canonicalStatus === '10') || inventory.find((it) => it.id === task?.lotId && it.canonicalStatus === '10');

    if (!task || item?.canonicalStatus !== '10' || !Number.isFinite(claimQtyTons) || claimQtyTons <= 0 || claimQtyTons > item.totalWeightTons + 0.001 || !defectReason.trim()) {
      triggerGateBlocked({
        title: 'ไม่อนุญาตให้เปิดข้อร้องเรียนเคลมสินค้า (Claim Blocked)',
        unmetGates: [
          `ต้องอ้างยอดส่งมอบสถานะ [10] และเคลมไม่เกินยอดที่รับจริง (${item?.totalWeightTons ?? 0} ตัน)`,
          'ตาม BRD สถานะ [11] เกิดจาก claim ที่อ้าง delivery event; การเปิด claim ไม่ได้ยืนยันว่ารับคืนเข้าคลังแล้ว',
        ],
        recoveryRoute: 'บันทึกยืนยันการส่งมอบสินค้า [10] ก่อนรับเรื่องเคลม',
      });
      return false;
    }

    const claimItemId = claimQtyTons < item.totalWeightTons - 0.001 ? `${item.id}-CLM-${Date.now().toString().slice(-4)}` : item.id;
    setInventory((prev) => prev.flatMap((it) => {
      if (it.id !== item.id) return [it];
      const claimSlice: InventoryItem = {
        ...it,
        id: claimItemId,
        lotNumber: claimItemId === item.id ? it.lotNumber : `${it.lotNumber}-CLM`,
        totalWeightTons: claimQtyTons,
        availableWeightTons: 0,
        reservedWeightTons: 0,
        canonicalStatus: '11',
        locationBay: 'AT-CUSTOMER-SITE',
        physicalCondition: 'SURFACE_RUST',
        damageNote: defectReason,
      };
      if (claimItemId === item.id) return [claimSlice];
      return [{ ...it, totalWeightTons: Math.max(0, it.totalWeightTons - claimQtyTons) }, claimSlice];
    }));
    setPickTasks((prev) => prev.map((t) => t.id === taskId ? {
      ...t,
      claimQtyTons: (t.claimQtyTons || 0) + claimQtyTons,
      claimInventoryItemIds: [...new Set([...(t.claimInventoryItemIds || []), claimItemId])],
    } : t));

    addAuditLog(
      claimItemId,
      item.productName,
      claimQtyTons,
      'ตัน (Tons)',
      '[10] Delivered',
      '[11] Claim/Return Pending',
      'Customer Claim Opened (LGX-06 NCR)',
      `เปิดบันทึกข้อร้องเรียนลูกค้า: ${defectReason} สินค้าถูกส่งเข้าลานกักกัน [11] (คำเตือน: ไม่คืนยอดกลับเข้า [02] ATP โดยอัตโนมัติเด็ดขาด)`,
      'LOGISTICS'
    );
    appendIntegrationMessage({
      source: 'LOGISTICS_APP',
      target: 'WMS',
      direction: 'INBOUND',
      schema: 'urn:tts:logistics:lgx06-claim-return:1.0',
      event: 'LGX06_CLAIM_OPENED',
      correlationId: `CORR-LGX06-${task.id}-${Date.now()}`,
      idempotencyKey: `IDEM-LGX06-${task.id}-${claimItemId}`,
      dependencies: [item.id],
      owner: 'WMS Claims Queue',
      entityRef: claimItemId,
      payloadSummary: `${claimQtyTons} T moved to [11] pending investigation at customer site; return receipt is separate.`,
    });
    return true;
  };

  // P0 CORRECTION 4: Gated 4-Stage Transfer Lifecycle
  // Requester -> Approver -> Mover -> Receiver (Only Receiver commits location!)
  const requestBayMovement = (
    lotId: string,
    toBay: string,
    qtyTons: number,
    reason: string
  ): boolean => {
    const item = inventory.find((it) => it.id === lotId);
    if (currentRole !== 'warehouse_manager' && currentRole !== 'crane_operator') {
      triggerGateBlocked({
        title: 'ไม่มีสิทธิ์เปิดคำขอย้ายโซน',
        unmetGates: ['เปิดคำขอย้ายสินค้าได้เฉพาะ Warehouse Manager หรือ Crane / Yard Operator'],
        recoveryRoute: 'สลับเป็นบทบาทปฏิบัติการคลังที่ได้รับสิทธิ์',
      });
      return false;
    }
    if (!item || item.canonicalStatus !== '04' || !Number.isFinite(qtyTons) || qtyTons <= 0 || qtyTons > item.totalWeightTons || !toBay.trim() || toBay === item.locationBay) {
      triggerGateBlocked({
        title: 'ข้อมูลคำขอย้ายสินค้าไม่ถูกต้อง',
        unmetGates: ['การย้ายโซนปกติรองรับเฉพาะสถานะ [04] และต้องไม่ย้ายออกจากขั้นตอนแปรรูป/กักกัน/ขนส่ง', 'ระบุปริมาณมากกว่า 0 และไม่เกินยอดคงเหลือ พร้อมพิกัดปลายทางที่ต่างจากต้นทาง'],
        recoveryRoute: 'แก้ Lot, ปริมาณ หรือพิกัดปลายทางแล้วลองใหม่',
      });
      return false;
    }

    const trfId = `TRF-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const newTrf: MovementTransfer = {
      id: trfId,
      transferNumber: trfId,
      lotId,
      productSpec: item.productName,
      fromBay: item.locationBay,
      toBay,
      qtyTons,
      status: 'REQUESTED',
      requester: `${USER_ROLES[currentRole].titleTh} (${USER_ROLES[currentRole].name})`,
      requestedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      reason,
      capacityChecked: true,
      specCompatible: true,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      preservedStatus: item.canonicalStatus,
      preservedReceiveDate: item.lastUpdated.split(' ')[0],
    };

    setMovements((prev) => [newTrf, ...prev]);

    addAuditLog(
      lotId,
      item.productName,
      qtyTons,
      'ตัน (Tons)',
      `Bay: ${item.locationBay}`,
      `Bay: ${toBay} (Requested)`,
      'Transfer Request Created',
      `สร้างคำขอย้ายลานจาก ${item.locationBay} ไป ${toBay} รอการอนุมัติ (สเตตัสและวันรับเข้ายังคงเดิม)`,
      'YARD'
    );
    return true;
  };

  const approveBayMovement = (transferId: string): boolean => {
    if (currentRole !== 'warehouse_manager') {
      triggerGateBlocked({
        title: 'ไม่อนุญาต: ต้องใช้สิทธิ์ผู้จัดการคลังในการอนุมัติย้ายลาน',
        unmetGates: ['เฉพาะผู้จัดการคลังสินค้าเท่านั้นที่สามารถอนุมัติคำขอย้ายลานได้'],
        recoveryRoute: 'สลับสิทธิ์การใช้งานเป็น "ผู้จัดการคลังสินค้า (Warehouse Manager)"',
      });
      return false;
    }

    const transfer = movements.find((m) => m.id === transferId);
    if (!transfer || transfer.status !== 'REQUESTED') {
      triggerGateBlocked({
        title: 'คำขอย้ายไม่อยู่ในสถานะรออนุมัติ',
        unmetGates: ['อนุมัติได้เฉพาะ transfer ที่มีสถานะ REQUESTED'],
        recoveryRoute: 'เปิดรายการย้ายล่าสุดและตรวจสถานะปัจจุบัน',
      });
      return false;
    }
    if (transfer.requester.includes(USER_ROLES[currentRole].name)) {
      triggerGateBlocked({
        title: 'ผู้ร้องขออนุมัติคำขอของตนเองไม่ได้',
        unmetGates: ['แยกผู้ร้องขอออกจากผู้อนุมัติตามหลัก Maker-Checker'],
        recoveryRoute: 'ให้ Warehouse Manager คนอื่นตรวจและอนุมัติ',
      });
      return false;
    }

    setMovements((prev) =>
      prev.map((m) =>
        m.id === transferId
          ? {
              ...m,
              status: 'APPROVED',
              approver: `${USER_ROLES[currentRole].titleTh} (${USER_ROLES[currentRole].name})`,
              approvedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
            }
          : m
      )
    );
    return true;
  };

  const rejectBayMovement = (transferId: string, reason: string): boolean => {
    const transfer = movements.find((item) => item.id === transferId);
    if (currentRole !== 'warehouse_manager') {
      triggerGateBlocked({
        title: 'ไม่อนุญาตให้ปฏิเสธคำขอย้ายโซน',
        unmetGates: ['เฉพาะ Warehouse Manager เท่านั้นที่พิจารณาคำขอได้'],
        recoveryRoute: 'สลับเป็นบทบาท Warehouse Manager',
      });
      return false;
    }
    if (!transfer || transfer.status !== 'REQUESTED' || !reason.trim()) {
      triggerGateBlocked({
        title: 'ข้อมูลการปฏิเสธคำขอไม่ครบ',
        unmetGates: ['ปฏิเสธได้เฉพาะคำขอที่รออนุมัติ และต้องระบุเหตุผล'],
        recoveryRoute: 'ตรวจสถานะคำขอและเพิ่มเหตุผลการปฏิเสธ',
      });
      return false;
    }
    if (transfer.requester.includes(USER_ROLES[currentRole].name)) {
      triggerGateBlocked({
        title: 'ผู้ร้องขอพิจารณาคำขอของตนเองไม่ได้',
        unmetGates: ['แยกผู้ร้องขอออกจากผู้พิจารณาตามหลัก Maker-Checker'],
        recoveryRoute: 'ให้ Warehouse Manager คนอื่นพิจารณาคำขอ',
      });
      return false;
    }
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setMovements((prev) => prev.map((item) => item.id === transferId ? {
      ...item,
      status: 'REJECTED',
      approver: `${USER_ROLES[currentRole].titleTh} (${USER_ROLES[currentRole].name})`,
      rejectionReason: reason.trim(),
      rejectedAt: timestamp,
    } : item));
    addAuditLog(transfer.lotId, transfer.productSpec, transfer.qtyTons, 'ตัน (Tons)', `Bay: ${transfer.fromBay}`, `Bay: ${transfer.fromBay} (Rejected)`, 'Bay Transfer Request Rejected', reason.trim(), 'YARD', { transferId, rejectionReason: reason.trim() });
    return true;
  };

  const dispatchBayMovementMover = (transferId: string, moverName: string): boolean => {
    const transfer = movements.find((m) => m.id === transferId);
    if (currentRole !== 'crane_operator') {
      triggerGateBlocked({
        title: 'ไม่มีสิทธิ์ปฏิบัติการย้ายสินค้า',
        unmetGates: ['การจ่ายงานและเคลื่อนย้ายสินค้าเป็นหน้าที่ Crane / Yard Operator'],
        recoveryRoute: 'สลับเป็นบทบาท Crane / Yard Operator',
      });
      return false;
    }
    if (!transfer || transfer.status !== 'APPROVED') {
      triggerGateBlocked({
        title: 'ยังเริ่มย้ายสินค้าไม่ได้',
        unmetGates: ['คำขอต้องได้รับอนุมัติจาก Warehouse Manager ก่อนจ่ายงานผู้ย้าย'],
        recoveryRoute: 'รอ Manager อนุมัติคำขอในคิว Transfer',
      });
      return false;
    }
    if (!moverName.trim() || transfer.approver?.includes(USER_ROLES[currentRole].name)) {
      triggerGateBlocked({
        title: 'ผู้อนุมัติและผู้ย้ายต้องแยกจากกัน',
        unmetGates: ['ระบุผู้ย้ายที่ไม่ใช่ผู้อนุมัติคำขอ'],
        recoveryRoute: 'มอบหมาย Crane / Yard Operator คนอื่น',
      });
      return false;
    }
    setMovements((prev) =>
      prev.map((m) =>
        m.id === transferId
          ? {
              ...m,
              status: 'MOVER_DISPATCHED',
              mover: moverName,
              dispatchedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
            }
          : m
      )
    );
    return true;
  };

  const confirmBayTransferReceipt = (
    transferId: string,
    receivedQtyTons: number,
    discrepancyNote?: string,
    evidence?: string
  ): boolean => {
    const trf = movements.find((m) => m.id === transferId);
    if (currentRole !== 'qc_inspector' && currentRole !== 'logistics_clerk') {
      triggerGateBlocked({
        title: 'ไม่มีสิทธิ์ยืนยันรับสินค้าเข้าพิกัด',
        unmetGates: ['ผู้รับปลายทางต้องเป็นผู้ตรวจรับที่แยกจากผู้ย้ายและผู้อนุมัติ'],
        recoveryRoute: 'สลับเป็น QC Inspector หรือ Logistics Clerk ผู้รับผิดชอบปลายทาง',
      });
      return false;
    }
    if (!trf || trf.status !== 'MOVER_DISPATCHED') {
      triggerGateBlocked({
        title: 'ยังยืนยันรับสินค้าไม่ได้',
        unmetGates: ['ต้องมีหลักฐานว่าผู้ย้ายจ่ายสินค้าออกจากต้นทางแล้ว'],
        recoveryRoute: 'ตรวจสอบสถานะ transfer และรายการ dispatch',
      });
      return false;
    }

    const source = inventory.find((it) => it.id === trf.lotId);
    if (
      !source ||
      source.locationBay !== trf.fromBay ||
      source.canonicalStatus !== trf.preservedStatus ||
      !Number.isFinite(receivedQtyTons) ||
      receivedQtyTons <= 0 ||
      receivedQtyTons > trf.qtyTons ||
      receivedQtyTons > source.totalWeightTons ||
      !evidence?.trim()
    ) {
      triggerGateBlocked({
        title: 'ข้อมูลรับโอนไม่ผ่านการตรวจสอบ',
        unmetGates: [
          'ตรวจสอบพิกัดและสถานะต้นทางตาม version ตอนขอ',
          `ยอดรับจริงต้องมากกว่า 0 และไม่เกินยอดขอ ${trf.qtyTons.toFixed(3)} ตัน`,
          'ต้องแนบหลักฐาน Barcode Scan หรือเอกสารตรวจรับ',
        ],
        recoveryRoute: 'ตรวจต้นทาง ยอดจริง และหลักฐานก่อนยืนยัน; ส่วนที่ยังไม่รับจะคงอยู่ต้นทาง',
      });
      return false;
    }
    if (trf.mover?.includes(USER_ROLES[currentRole].name) || trf.approver?.includes(USER_ROLES[currentRole].name)) {
      triggerGateBlocked({
        title: 'ผู้รับต้องแยกจากผู้อนุมัติและผู้ย้าย',
        unmetGates: ['ตัวตนผู้รับปัจจุบันซ้ำกับผู้อนุมัติหรือผู้ย้ายที่ระบุใน transfer'],
        recoveryRoute: 'ให้ผู้ตรวจรับปลายทางอีกคนยืนยันรายการ',
      });
      return false;
    }

    const isDiscrepancy = Math.abs(receivedQtyTons - trf.qtyTons) > 0.001 || !!discrepancyNote;
    if (receivedQtyTons < trf.qtyTons - 0.001 && !discrepancyNote?.trim()) {
      triggerGateBlocked({
        title: 'รับสินค้าไม่ครบ ต้องระบุสาเหตุส่วนต่าง',
        unmetGates: [`ขาด ${ (trf.qtyTons - receivedQtyTons).toFixed(3) } ตันจากยอดที่ส่งย้าย`],
        recoveryRoute: 'ระบุเหตุผลและแนบหลักฐาน; ยอดที่รับจริงเท่านั้นจึงจะย้ายพิกัด',
      });
      return false;
    }

    const movementId = `MOV-${trf.id}`;
    const receivedSliceId = receivedQtyTons < source.totalWeightTons - 0.001
      ? `${source.id}-TRF-${trf.id.slice(-3)}`
      : source.id;

    setMovements((prev) =>
      prev.map((m) =>
        m.id === transferId
          ? {
              ...m,
              status: isDiscrepancy ? 'DISCREPANCY' : 'RECEIVED',
              receiver: `${USER_ROLES[currentRole].titleTh} (${USER_ROLES[currentRole].name})`,
              receivedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
              receivedQtyTons,
              discrepancyNote,
              evidence: evidence || 'BARCODE-SCAN-CONFIRMED',
              movementId,
              receivedSliceId,
              unreceivedQtyTons: Math.max(0, trf.qtyTons - receivedQtyTons),
            }
          : m
      )
    );

    // Only the received quantity is committed to destination. Partial remainder stays at source.
    setInventory((prev) => {
      const sourceItem = prev.find((it) => it.id === trf.lotId);
      if (!sourceItem) return prev;
      if (receivedSliceId === sourceItem.id) {
        return prev.map((it) =>
          it.id === sourceItem.id
            ? { ...it, locationBay: trf.toBay, lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16) }
            : it
        );
      }

      const availableMoved = Math.min(sourceItem.availableWeightTons, receivedQtyTons);
      const reservedMoved = Math.min(sourceItem.reservedWeightTons, Math.max(0, receivedQtyTons - availableMoved));
      const movedSlice: InventoryItem = {
        ...sourceItem,
        id: receivedSliceId,
        lotNumber: `${sourceItem.lotNumber}-TRF-${trf.id.slice(-3)}`,
        totalWeightTons: receivedQtyTons,
        availableWeightTons: availableMoved,
        reservedWeightTons: reservedMoved,
        locationBay: trf.toBay,
        lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16),
      };
      return prev.flatMap((it) =>
        it.id === sourceItem.id
          ? [{
              ...it,
              totalWeightTons: Math.max(0, it.totalWeightTons - receivedQtyTons),
              availableWeightTons: Math.max(0, it.availableWeightTons - availableMoved),
              reservedWeightTons: Math.max(0, it.reservedWeightTons - reservedMoved),
              lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16),
            }, movedSlice]
          : [it]
      );
    });

    addAuditLog(
      trf.lotId,
      trf.productSpec,
      receivedQtyTons,
      'ตัน (Tons)',
      `Bay: ${trf.fromBay}`,
      `Bay: ${trf.toBay}`,
      'Bay Transfer Received & Committed by Receiver',
      `ผู้ตรวจรับปลายทางยืนยันรับเข้าพิกัด ${trf.toBay} เรียบร้อย ${
        isDiscrepancy ? `(พบส่วนต่าง: ${discrepancyNote})` : 'ครบถ้วน'
      }`,
      'YARD',
      { discrepancyNote, evidence, movementId, receivedSliceId, requestedQtyTons: trf.qtyTons, receivedQtyTons }
    );
    appendIntegrationMessage({
      source: 'WMS',
      target: 'DATA_BUCKET',
      direction: 'OUTBOUND',
      schema: 'urn:tts:warehouse:bay-movement-receipt:1.0',
      event: isDiscrepancy ? 'BAY_TRANSFER_RECEIVED_WITH_VARIANCE' : 'BAY_TRANSFER_RECEIVED',
      correlationId: `CORR-${movementId}`,
      idempotencyKey: `IDEM-${movementId}`,
      dependencies: [trf.id],
      owner: 'WMS Stock Movement Publisher',
      entityRef: receivedSliceId,
      payloadSummary: `${receivedQtyTons} T committed at ${trf.toBay}; ${Math.max(0, trf.qtyTons - receivedQtyTons)} T remains at ${trf.fromBay}; product status ${trf.preservedStatus} unchanged.`,
    });
    return true;
  };

  // Processing & Damage Rework Jobs
  const approveProcessingJob = (jobId: string): boolean => {
    setProcessingJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: 'PENDING' } : j))
    );
    return true;
  };

  const startProcessingJob = (jobId: string): boolean => {
    const job = processingJobs.find((j) => j.id === jobId);
    if (currentRole !== 'crane_operator') {
      triggerGateBlocked({
        title: 'ไม่มีสิทธิ์เริ่มงานแปรรูป',
        unmetGates: ['เริ่มงาน 05 → 06 ได้โดย Crane / Yard Operator ที่ได้รับมอบหมาย'],
        recoveryRoute: 'สลับเป็นบทบาท Crane / Yard Operator',
      });
      return false;
    }
    const inputItem = inventory.find((it) => it.id === job?.inputLotId);
    if (!job || job.status !== 'PENDING' || inputItem?.canonicalStatus !== '05') {
      triggerGateBlocked({
        title: 'งานแปรรูปยังไม่พร้อมเริ่ม',
        unmetGates: ['งานต้องอยู่สถานะรอเริ่ม และสินค้าต้นทางต้องเป็น [05] สินค้ารอแปรรูป'],
        recoveryRoute: 'ตรวจสอบใบงานและสถานะสินค้าต้นทางใน WMS-11',
      });
      return false;
    }

    setProcessingJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? {
              ...j,
              status: 'IN_PROCESS',
              operator: `${USER_ROLES[currentRole].name} (${USER_ROLES[currentRole].titleTh})`,
              startedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
            }
          : j
      )
    );

    // 05 -> 06 Work in Process when work starts
    setInventory((prev) =>
      prev.map((it) => (it.id === job.inputLotId ? { ...it, canonicalStatus: '06', lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16) } : it))
    );

    addAuditLog(
      job.inputLotId,
      job.jobType,
      job.inputQtyTons,
      'ตัน (Tons)',
      '[05] Pending Processing',
      '[06] Work in Process',
      'Processing Work Order Started (05 -> 06)',
      `นำสินค้าเข้าเครื่องจักร ${job.machine} กำลังทำการตัดแต่ง/แปรรูป`,
      'WMS'
    );
    return true;
  };

  const confirmProcessingPhysicalReceipt = (jobId: string): boolean => {
    const job = processingJobs.find((j) => j.id === jobId);
    if (currentRole !== 'crane_operator') {
      triggerGateBlocked({
        title: 'ไม่มีสิทธิ์ยืนยันรับวัตถุดิบเข้าเครื่อง',
        unmetGates: ['ผู้ปฏิบัติงานแปรรูปเป็นผู้สแกนรับสินค้าเข้าจุดทำงาน'],
        recoveryRoute: 'สลับเป็นบทบาท Crane / Yard Operator',
      });
      return false;
    }
    if (!job || job.status !== 'IN_PROCESS' || job.physicalReceiptConfirmed) {
      triggerGateBlocked({
        title: 'รับวัตถุดิบเข้าเครื่องซ้ำหรือผิดลำดับ',
        unmetGates: ['รับกายภาพได้หนึ่งครั้งหลังเริ่มงาน และก่อนตรวจ QC'],
        recoveryRoute: 'ตรวจสถานะงานและประวัติรับเข้าก่อนดำเนินการต่อ',
      });
      return false;
    }
    setProcessingJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? { ...j, physicalReceiptConfirmed: true, physicalReceiptAt: new Date().toISOString().replace('T', ' ').substring(0, 16) }
          : j
      )
    );
    addAuditLog(job.inputLotId, job.jobType, job.inputQtyTons, 'ตัน (Tons)', '[06] Work in Process', '[06] Work in Process (Physical Receipt Confirmed)', 'Processing Physical Receipt', 'Crane ยืนยันรับสินค้าเข้าจุดแปรรูป; สถานะสินค้าคง [06]', 'WMS', { jobId: job.id, machine: job.machine });
    appendIntegrationMessage({
      source: 'WMS',
      target: 'DATA_BUCKET',
      direction: 'OUTBOUND',
      schema: 'urn:tts:warehouse:processing-physical-receipt:1.0',
      event: 'PROCESSING_PHYSICAL_RECEIPT_CONFIRMED',
      correlationId: `CORR-PROC-RECEIPT-${job.id}`,
      idempotencyKey: `IDEM-PROC-RECEIPT-${job.id}`,
      dependencies: [job.id],
      owner: 'WMS Processing Event Publisher',
      entityRef: job.inputLotId,
      payloadSummary: `Physical receipt confirmed for ${job.inputQtyTons} T at ${job.machine}; product status remains [06].`,
    });
    return true;
  };

  /** Operator confirms the cut/processing is physically finished; the job moves to the QC queue. */
  const finishProcessingJob = (jobId: string): boolean => {
    const job = processingJobs.find((entry) => entry.id === jobId);
    if (currentRole !== 'crane_operator' || !job || job.status !== 'IN_PROCESS' || !job.physicalReceiptConfirmed) return false;
    const finishedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setProcessingJobs((prev) => prev.map((entry) => entry.id === jobId ? { ...entry, status: 'QC_INSPECTION', processingFinishedAt: finishedAt } : entry));
    addAuditLog(job.inputLotId, job.jobType, job.inputQtyTons, 'ตัน', '[06] Work in Process', '[06] รอตรวจคุณภาพ', 'แปรรูปเสร็จ · ส่งตรวจคุณภาพ', `งาน ${job.jobNumber}`, 'WMS');
    return true;
  };

  const completeProcessingJobQC = (
    jobId: string,
    passQtyTons: number,
    failQtyTons: number,
    scrapQtyTons: number,
    qcNotes: string
  ): boolean => {
    const job = processingJobs.find((j) => j.id === jobId);
    if (currentRole !== 'qc_inspector') {
      triggerGateBlocked({
        title: 'ไม่มีสิทธิ์บันทึกผลตรวจ QC',
        unmetGates: ['ผลตรวจและ disposition ของงานแปรรูปต้องบันทึกโดย QC Inspector'],
        recoveryRoute: 'สลับเป็นบทบาท QC Inspector',
      });
      return false;
    }
    if (!job || job.status !== 'QC_INSPECTION' || !job.physicalReceiptConfirmed) {
      triggerGateBlocked({
        title: 'QC ยังเริ่มไม่ได้',
        unmetGates: ['ผู้ปฏิบัติงานต้องกด “แปรรูปเสร็จ · ส่งตรวจคุณภาพ” ก่อน'],
        recoveryRoute: 'ให้ผู้ควบคุมเครน/ลานยืนยันว่าแปรรูปเสร็จ แล้วกลับมาบันทึกผล QC',
      });
      return false;
    }

    const accounted = passQtyTons + failQtyTons + scrapQtyTons;
    if (
      ![passQtyTons, failQtyTons, scrapQtyTons].every((qty) => Number.isFinite(qty) && qty >= 0) ||
      Math.abs(accounted - job.inputQtyTons) > 0.001
    ) {
      triggerGateBlocked({
        title: 'ยอดน้ำหนักแปรรูปไม่สมดุล (Reconciliation Error)',
        unmetGates: [
          `ยอดที่ระบุ (${accounted.toFixed(3)} ตัน) ต้องเท่ากับยอดสินค้าตั้งต้น (${job.inputQtyTons.toFixed(3)} ตัน)`,
          'กฎสมดุล: input = pass + fail + scrap; ห้ามปิดงานจนกว่าจะอธิบายยอดครบ',
        ],
        recoveryRoute: 'ปรับยอดน้ำหนักให้สอดคล้องกับผลการชั่งจริง',
      });
      return false;
    }

    setProcessingJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? {
              ...j,
              status: 'COMPLETED',
              outputQtyTons: passQtyTons,
              failQtyTons,
              scrapQtyTons,
              remainingQtyTons: 0,
              finalDisposition: passQtyTons > 0 && failQtyTons > 0 ? 'MIXED_02_07' : failQtyTons > 0 ? 'FAIL_07' : job.linkedSoNumber ? 'PASS_04_RESERVED' : 'PASS_02',
              completedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
              qcInspectionNotes: qcNotes,
            }
          : j
      )
    );

    const sourceAtStart = inventory.find((item) => item.id === job.inputLotId);
    const failedLotId = sourceAtStart ? `${sourceAtStart.id}-NCF-${job.id.slice(-3)}` : undefined;
    const linkedBooking = job.linkedSoNumber
      ? stockBookings.find((booking) => booking.approvedSoReference === job.linkedSoNumber && booking.lotId === job.inputLotId && booking.status === 'RESERVED')
      : undefined;
    const linkedGroup = linkedBooking ? stockBookingGroups.find((group) => group.id === linkedBooking.groupId) : undefined;
    if (linkedBooking && linkedGroup && sourceAtStart && passQtyTons > 0) {
      // Processed output is reserved for the quotation; issue its stock requisition for customer delivery right away.
      const task = buildBookingPickTask(linkedBooking, { ...sourceAtStart, totalWeightTons: passQtyTons }, linkedGroup, new Date());
      setPickTasks((prev) => [task, ...prev]);
      addAuditLog(job.inputLotId, sourceAtStart.productName, passQtyTons, 'ตัน', '[04] หลังแปรรูป', '[04]', 'ออกใบเบิกสินค้า (ส่งมอบให้ลูกค้า) อัตโนมัติ', `ใบเบิก ${task.pickNumber} ตาม ${job.linkedSoNumber}`, 'WMS');
    }
    if (linkedBooking && failQtyTons > 0 && failedLotId) {
      setStockBookings((prev) => prev.map((booking) => booking.id === linkedBooking.id
        ? { ...booking, exception: { source: 'QC', damagedLotId: failedLotId, damagedQtyTons: failQtyTons, reason: qcNotes || 'ไม่ผ่าน QC หลังแปรรูป', reportedAt: new Date().toISOString(), status: 'WAITING_WAREHOUSE' } }
        : booking));
    }

    // Materialize separate pass/fail slices so one stock status never hides mixed QC outcomes.
    setInventory((prev) => {
      const sourceItem = prev.find((it) => it.id === job.inputLotId);
      if (!sourceItem) return prev;
      const otherItems = prev.filter((it) => it.id !== job.inputLotId);
      const outputItems: InventoryItem[] = [];
      if (passQtyTons > 0) {
        outputItems.push({
          ...sourceItem,
          canonicalStatus: job.linkedSoNumber ? '04' : '02',
          totalWeightTons: passQtyTons,
          availableWeightTons: job.linkedSoNumber ? 0 : passQtyTons,
          reservedWeightTons: job.linkedSoNumber ? passQtyTons : 0,
          physicalCondition: 'NORMAL',
          isExcluded: false,
          exclusionReason: undefined,
          lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16),
        });
      }
      if (failQtyTons > 0) {
        outputItems.push({
          ...sourceItem,
          id: failedLotId || `${sourceItem.id}-NCF-${job.id.slice(-3)}`,
          lotNumber: `${sourceItem.lotNumber}-NCF-${job.id.slice(-3)}`,
          sourceLotId: sourceItem.id,
          canonicalStatus: '07',
          totalWeightTons: failQtyTons,
          availableWeightTons: 0,
          reservedWeightTons: 0,
          locationBay: 'BAY-CLAIM-01',
          physicalCondition: 'SEVERELY_DAMAGED',
          isExcluded: true,
          exclusionReason: `ไม่ผ่าน QC งาน ${job.jobNumber}`,
          lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16),
        });
      }
      return [...otherItems, ...outputItems];
    });

    // Keep a fully failed SO booking visible in Sales tracking after its source lot is replaced by the [07] slice.
    if (job.linkedSoNumber && passQtyTons <= 0 && failQtyTons > 0 && failedLotId) {
      setStockBookings((prev) => prev.map((booking) =>
        booking.approvedSoReference === job.linkedSoNumber && booking.lotId === job.inputLotId
          ? { ...booking, lotId: failedLotId, sourceLotId: job.inputLotId, damagedLotId: failedLotId, operationCreated: true }
          : booking
      ));
    }

    // Unlinked repair returns to ATP [02]; customer-ordered processing stays reserved [04].
    if (passQtyTons > 0) {
      addAuditLog(
        job.inputLotId,
        job.jobType,
        passQtyTons,
        'ตัน (Tons)',
        '[06] Work in Process',
        job.linkedSoNumber ? '[04] Reserved for Approved SO' : '[02] Available to Promise',
        job.linkedSoNumber ? 'QC Inspection Passed (Remain [04] Reserved)' : 'QC Inspection Passed (Pass -> 02 ATP)',
        job.linkedSoNumber ? `แปรรูปผ่าน QC ${passQtyTons} ตัน คงการจองตาม ${job.linkedSoNumber} ที่สถานะ [04]` : `แปรรูปผ่านเกณฑ์ QC รับยอด ${passQtyTons} ตัน กลับเข้าสต็อกพร้อมขาย [02] ATP`,
        'WMS',
        { qcNotes }
      );
      if (!job.linkedSoNumber) appendIntegrationMessage({
        source: 'WMS',
        target: 'SYSTEM_ONE',
        direction: 'OUTBOUND',
        schema: 'urn:tts:system-one:warehouse-atp-recalculation:1.0',
        event: 'PROCESSING_QC_PASS_ATP_RECALCULATION_REQUESTED',
        correlationId: `CORR-QC-${job.id}`,
        idempotencyKey: `IDEM-QC-PASS-${job.id}`,
        dependencies: [job.id, job.inputLotId],
        owner: 'System One Status Gateway',
        entityRef: job.inputLotId,
        payloadSummary: `${passQtyTons} T passed QC; System One recalculates authoritative status 1-3 from the stock ledger.`,
      });
    }

    if (failQtyTons > 0) {
      addAuditLog(
        job.inputLotId,
        job.jobType,
        failQtyTons,
        'ตัน (Tons)',
        '[06] Work in Process',
        '[07] Nonconforming Product',
        'QC Inspection Failed (Fail -> 07 Nonconforming)',
        `แปรรูปไม่ผ่านเกณฑ์ QC ย้าย ${failQtyTons} ตัน เข้าลานกักกัน [07] ของเสีย/ไม่ผ่านเกณฑ์`,
        'WMS',
        { qcNotes }
      );
    }

    if (scrapQtyTons > 0) {
      addAuditLog(
        job.inputLotId,
        job.jobType,
        scrapQtyTons,
        'ตัน (Tons)',
        '[06] Work in Process',
        'SCRAP (ออกจากยอดใช้งาน)',
        'QC Scrap Posted',
        `บันทึก scrap ${scrapQtyTons} ตัน แยกจากยอดสินค้าผ่าน/ไม่ผ่าน`,
        'WMS',
        { qcNotes, jobId: job.id }
      );
    }
    appendIntegrationMessage({
      source: 'WMS',
      target: 'DATA_BUCKET',
      direction: 'OUTBOUND',
      schema: 'urn:tts:warehouse:processing-qc-result:1.0',
      event: 'PROCESSING_QC_COMPLETED',
      correlationId: `CORR-QC-${job.id}`,
      idempotencyKey: `IDEM-QC-RESULT-${job.id}`,
      dependencies: [job.id],
      owner: 'WMS Stock Event Publisher',
      entityRef: job.inputLotId,
      payloadSummary: `QC result: pass ${passQtyTons} T, fail ${failQtyTons} T, scrap ${scrapQtyTons} T; output slices and lineage recorded.`,
    });

    return true;
  };

  // Stock Replacement Flow
  const proposeStockReplacement = (
    soNumber: string,
    lineNumber: number,
    origLotId: string,
    proposedLotId: string,
    qty: number,
    reason: string
  ) => {
    const orig = inventory.find((it) => it.id === origLotId);
    const prop = inventory.find((it) => it.id === proposedLotId);

    const newProposal: StockReplacementProposal = {
      id: `REP-${Date.now().toString().slice(-6)}`,
      soNumber,
      lineNumber,
      originalLotId: origLotId,
      proposedLotId,
      originalBay: orig?.locationBay || 'Bay 03-B2',
      proposedBay: prop?.locationBay || 'Bay 03-C1',
      qtyTons: qty,
      defectNote: reason,
      evidence: 'PHOTO-DEFECT-ATTACHED.JPG',
      status: 'PROPOSED',
      proposedBy: `${USER_ROLES[currentRole].titleTh} (${USER_ROLES[currentRole].name})`,
      proposedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    setReplacementProposals((prev) => [newProposal, ...prev]);
  };

  const acceptReplacementProposal = (proposalId: string): boolean => {
    const prop = replacementProposals.find((p) => p.id === proposalId);
    const candidate = inventory.find((item) => item.id === prop?.proposedLotId);
    if (currentRole !== 'sales_rep' || !prop || prop.status !== 'PROPOSED' || !candidate || candidate.canonicalStatus !== '02' || candidate.isExcluded || candidate.availableWeightTons < prop.qtyTons - 0.001) {
      triggerGateBlocked({
        title: 'ไม่สามารถส่งคำขอ Soft Hold สินค้าทดแทนได้',
        unmetGates: [
          'ต้องเป็นฝ่ายขายและข้อเสนออยู่ในสถานะ PROPOSED',
          `Lot ทดแทนต้องเป็น [02] พร้อมเสนอขาย และมียอด available ไม่น้อยกว่า ${prop?.qtyTons.toFixed(3) || '0.000'} ตัน`,
        ],
        recoveryRoute: 'ให้ฝ่ายขายเลือกข้อเสนอที่ยังเป็น [02] และมี available เพียงพอ เพื่อขอระบบหน้าบ้านยืนยันเป็น [03]',
      });
      return false;
    }

    const heldLotId = candidate.totalWeightTons <= prop.qtyTons + 0.001
      ? candidate.id
      : `${candidate.id}-HOLD-${prop.id.slice(-6)}`;
    if (heldLotId !== candidate.id && inventory.some((item) => item.id === heldLotId)) {
      triggerGateBlocked({
        title: 'สร้าง Lot สถานะ [03] ซ้ำไม่ได้',
        unmetGates: [`พบ Lot ${heldLotId} อยู่แล้ว; ป้องกันการสร้าง Soft Hold slice ซ้ำ`],
        recoveryRoute: 'ตรวจประวัติข้อเสนอทดแทนและเลือกข้อเสนอที่ยังไม่เคยส่งคำขอ',
      });
      return false;
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setInventory((prev) => prev.flatMap((item) => {
      if (item.id !== candidate.id) return [item];
      if (heldLotId === candidate.id) {
        return [{ ...item, canonicalStatus: '03', availableWeightTons: 0, reservedWeightTons: 0, lastUpdated: timestamp }];
      }
      const heldQty = prop.qtyTons;
      const remainingQty = Math.max(0, item.totalWeightTons - heldQty);
      const residual = remainingQty > 0.001 ? {
        ...item,
        totalWeightTons: remainingQty,
        availableWeightTons: Math.max(0, item.availableWeightTons - heldQty),
        lastUpdated: timestamp,
      } : null;
      const heldItem: InventoryItem = {
        ...item,
        id: heldLotId,
        lotNumber: heldLotId,
        sourceLotId: candidate.id,
        totalWeightTons: heldQty,
        availableWeightTons: 0,
        reservedWeightTons: 0,
        canonicalStatus: '03',
        lastUpdated: timestamp,
      };
      return [...(residual ? [residual] : []), heldItem];
    }));

    // Sales accepts replacement -> Sent to System One for Soft Hold!
    setReplacementProposals((prev) =>
      prev.map((p) =>
        p.id === proposalId
          ? {
              ...p,
              heldLotId,
              status: 'SYSTEM_ONE_HOLD',
              respondedBy: `${USER_ROLES[currentRole].titleTh} (${USER_ROLES[currentRole].name})`,
              respondedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
            }
          : p
      )
    );

    setSoRequests((prev) =>
      prev.map((s) => {
        if (s.soNumber === prop.soNumber) {
          return {
            ...s,
            status: 'SOFT_HOLD',
            lines: s.lines.map((l) =>
              l.lineNumber === prop.lineNumber
                ? {
                    ...l,
                    selectedLotIds: [heldLotId],
                    selectionSlices: [{ lotId: heldLotId, qtyTons: prop.qtyTons }],
                    reservationSlices: [{ lotId: heldLotId, qtyTons: prop.qtyTons }],
                    selectionStatus: 'SOFT_HOLD',
                  }
                : l
            ),
          };
        }
        return s;
      })
    );

    addAuditLog(
      heldLotId,
      'Stock Replacement Accepted by Sales',
      prop.qtyTons,
      'ตัน (Tons)',
      'Replacement Proposed',
      '[03] Soft Hold',
      'Sales Accepted Replacement & System One Soft Hold Issued',
      `ฝ่ายขายยอมรับ Lot ทดแทน ${prop.proposedLotId}; ระบบหน้าบ้านกัน ${heldLotId} เป็น [03] Soft Hold แล้ว รอ ผจก.คลัง อนุมัติ 03->04`,
      'SYSTEM_ONE'
    );
    appendIntegrationMessage({
      source: 'SYSTEM_ONE',
      target: 'WMS',
      direction: 'INBOUND',
      schema: 'urn:tts:system-one:status-attestation:1.0',
      event: 'REPLACEMENT_SOFT_HOLD_ACCEPTED',
      correlationId: `CORR-REP-${proposalId}`,
      idempotencyKey: `IDEM-SYS1-REP-${proposalId}-03`,
      dependencies: [proposalId],
      owner: 'WMS Status Ingestion',
      entityRef: heldLotId,
      payloadSummary: `Replacement ${prop.proposedLotId}: accepted ${prop.qtyTons} T as [03] Soft Hold slice ${heldLotId}; no pick task issued.`,
    });
    return true;
  };

  const rejectReplacementProposal = (proposalId: string, reason: string): boolean => {
    setReplacementProposals((prev) =>
      prev.map((p) =>
        p.id === proposalId
          ? {
              ...p,
              status: 'SALES_REJECTED',
              defectNote: `${p.defectNote} [ฝ่ายขายปฏิเสธ: ${reason}]`,
              respondedBy: `${USER_ROLES[currentRole].titleTh} (${USER_ROLES[currentRole].name})`,
              respondedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
            }
          : p
      )
    );
    return true;
  };

  const managerApproveReplacementHoldToReserved = (proposalId: string): boolean => {
    if (currentRole !== 'warehouse_manager') {
      triggerGateBlocked({
        title: 'ไม่อนุญาต: ต้องใช้สิทธิ์ผู้จัดการคลัง',
        unmetGates: ['เฉพาะผู้จัดการคลังสินค้าเท่านั้นที่สามารถอนุมัติ Soft Hold ของสินค้าทดแทนเป็น Reserved ได้'],
        recoveryRoute: 'สลับสิทธิ์การใช้งานเป็น "ผู้จัดการคลังสินค้า"',
      });
      return false;
    }

    const prop = replacementProposals.find((p) => p.id === proposalId);
    if (!prop) {
      triggerGateBlocked({
        title: 'ไม่พบข้อเสนอสินค้าทดแทน',
        unmetGates: [`ไม่พบข้อเสนอ ${proposalId}`],
        recoveryRoute: 'กลับไปเลือกรายการข้อเสนอสินค้าทดแทนที่มีอยู่',
      });
      return false;
    }

    const heldLotId = prop.heldLotId || prop.proposedLotId;
    const heldItem = inventory.find((item) => item.id === heldLotId);
    const so = soRequests.find((request) => request.soNumber === prop.soNumber);
    const line = so?.lines.find((entry) => entry.lineNumber === prop.lineNumber);
    const lineMatchesHold = !line || (line.selectionStatus === 'SOFT_HOLD' && line.selectionSlices.some((slice) => slice.lotId === heldLotId && Math.abs(slice.qtyTons - prop.qtyTons) <= 0.001));
    if (prop.status !== 'SYSTEM_ONE_HOLD' || !heldItem || heldItem.canonicalStatus !== '03' || Math.abs(heldItem.totalWeightTons - prop.qtyTons) > 0.001 || !lineMatchesHold) {
      triggerGateBlocked({
        title: 'สินค้าทดแทนยังไม่อยู่ในสถานะ [03] Soft Hold',
        unmetGates: [
          `ข้อเสนอ: ${prop?.status || 'ไม่พบข้อเสนอ'}; Lot ที่กันไว้: ${heldItem ? `[${heldItem.canonicalStatus}] ${heldItem.totalWeightTons.toFixed(3)} T` : 'ไม่พบ Lot ที่ระบบหน้าบ้านยืนยัน'}`,
          'ต้องมี System One Soft Hold [03] ที่ตรงกับข้อเสนอและยอดก่อน Warehouse Manager อนุมัติเป็น [04]',
        ],
        recoveryRoute: 'ให้ฝ่ายขายส่งข้อเสนอทดแทนให้ระบบหน้าบ้านยืนยัน [03] ก่อน แล้วจึงอนุมัติ [04]',
      });
      return false;
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setInventory((prev) => prev.map((item) => item.id === heldLotId
      ? { ...item, canonicalStatus: '04', availableWeightTons: 0, reservedWeightTons: item.totalWeightTons, lastUpdated: timestamp }
      : item));

    setReplacementProposals((prev) =>
      prev.map((p) => (p.id === proposalId ? { ...p, status: 'MANAGER_APPROVED' } : p))
    );

    setSoRequests((prev) =>
      prev.map((s) => {
        if (s.soNumber === prop.soNumber) {
          return {
            ...s,
            status: 'RESERVED',
            lines: s.lines.map((l) =>
              l.lineNumber === prop.lineNumber ? { ...l, selectedLotIds: [heldLotId], selectionSlices: [{ lotId: heldLotId, qtyTons: prop.qtyTons }], reservationSlices: [{ lotId: heldLotId, qtyTons: prop.qtyTons }], selectionStatus: 'RESERVED' } : l
            ),
          };
        }
        return s;
      })
    );

    addAuditLog(
      heldLotId,
      'Replacement Approved to Reserved',
      prop.qtyTons,
      'ตัน (Tons)',
      '[03] Soft Hold',
      '[04] Reserved',
      'Manager Re-approved Replacement Lot',
      `ผจก.คลัง อนุมัติสินค้าทดแทน Lot ${prop.proposedLotId} เป็น [04] Reserved เรียบร้อย พร้อมออกใบหยิบทดแทนจาก ${heldLotId}`,
      'WMS'
    );
    return true;
  };

  const createPickTaskForReplacement = (proposalId: string): boolean => {
    if (currentRole !== 'warehouse_manager') {
      triggerGateBlocked({
        title: 'สิทธิ์ไม่เพียงพอในการสร้างใบหยิบทดแทน (Manager Only)',
        unmetGates: ['เฉพาะผู้จัดการคลังสินค้า (Warehouse Manager) เท่านั้นที่สามารถสั่งสร้างใบหยิบทดแทนได้'],
        recoveryRoute: 'สลับสิทธิ์การใช้งานเป็น "ผู้จัดการคลังสินค้า"',
      });
      return false;
    }

    const prop = replacementProposals.find((p) => p.id === proposalId);
    if (!prop || prop.status !== 'MANAGER_APPROVED') {
      triggerGateBlocked({
        title: 'สินค้าทดแทนยังไม่ผ่านการอนุมัติ (Replacement Not Approved)',
        unmetGates: [
          `สถานะปัจจุบันคือ "${prop?.status || 'UNKNOWN'}" (ไม่ใช่ MANAGER_APPROVED)`,
          'สินค้าทดแทนต้องผ่านการตอบรับจากฝ่ายขาย และ ผจก.คลัง อนุมัติเป็น [04] Reserved ก่อนเท่านั้น',
        ],
        recoveryRoute: 'ให้ฝ่ายขายยอมรับสินค้าทดแทน และให้ ผจก.คลัง อนุมัติก่อนออกใบหยิบ',
      });
      return false;
    }

    const replacementLotId = prop.heldLotId || prop.proposedLotId;
    const invItem = inventory.find((it) => it.id === replacementLotId);
    const so = soRequests.find((request) => request.soNumber === prop.soNumber);
    const line = so?.lines.find((entry) => entry.lineNumber === prop.lineNumber);
    const existingReplacementTask = pickTasks.find((task) => task.soNumber === prop.soNumber && task.lineNumber === prop.lineNumber && task.lotId === replacementLotId);
    const lineMatchesReservation = !line || (line.selectionStatus === 'RESERVED' && line.selectionSlices.some((slice) => slice.lotId === replacementLotId && Math.abs(slice.qtyTons - prop.qtyTons) <= 0.001));
    if (!invItem || invItem.canonicalStatus !== '04' || invItem.totalWeightTons < prop.qtyTons - 0.001 || invItem.reservedWeightTons < prop.qtyTons - 0.001 || !lineMatchesReservation || existingReplacementTask) {
      triggerGateBlocked({
        title: 'ออกใบหยิบทดแทนได้เฉพาะสินค้า [04] Reserved',
        unmetGates: [
          `Lot หยิบ ${invItem ? `[${invItem.canonicalStatus}] รวม ${invItem.totalWeightTons.toFixed(3)} T / จอง ${invItem.reservedWeightTons.toFixed(3)} T` : 'ไม่พบ Lot ที่อนุมัติ'}`,
          'ต้องมี SO Line และ Lot เดียวกันอยู่ใน [04] พร้อมยอดจองครบตามข้อเสนอ และยังไม่มีใบหยิบของ Lot นี้',
        ],
        recoveryRoute: 'ตรวจให้ครบลำดับ [02] พร้อมเสนอขาย → [03] ระบบหน้าบ้านยืนยัน → [04] Warehouse Manager อนุมัติ แล้วจึงออกใบหยิบ',
      });
      return false;
    }

    const pickId = `PK-REP-${Math.floor(100 + Math.random() * 900)}`;
    const newTask: PickTask = {
      id: `PICK-${pickId}`,
      pickNumber: pickId,
      soNumber: prop.soNumber,
      lineNumber: prop.lineNumber,
      customerName: 'บจก. สยามพาณิชย์สตีล (ทดแทนชำรุด)',
      lotId: replacementLotId,
      productSpec: invItem?.productName || 'เหล็กโครงสร้างทดแทน',
      targetBay: prop.proposedBay,
      stagingGate: 'STG-GATE-01',
      allocatedQtyTons: prop.qtyTons,
      actualPickedQtyTons: 0,
      shortQtyTons: 0,
      blockedQtyTons: 0,
      remainingQtyTons: prop.qtyTons,
      state: 'queued',
      operator: 'สมหมาย ช. (เครน #01)',
      assignedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      barcodeVerified: false,
      qcChecklist: {
        strappingSecure: false,
        specTagMatches: false,
        gaugeToleranceOk: false,
        doDocsPrepared: false,
        designatedZonePlaced: false,
      },
      readinessConfirmed: false,
      readinessVersion: 'v2.10',
      notes: `ใบหยิบทดแทนสำหรับ Lot ${prop.originalLotId}`,
    };

    setPickTasks((prev) => [newTask, ...prev]);

    addAuditLog(
      replacementLotId,
      invItem?.productName || 'เหล็กทดแทน',
      prop.qtyTons,
      'ตัน (Tons)',
      '[04] Reserved',
      '[04] Reserved (Pick Queued)',
      'Replacement Pick Task Created',
      `สร้างใบหยิบสำหรับสินค้าทดแทน ${pickId} ปริมาณ ${prop.qtyTons} ตัน สำเร็จ`,
      'WMS'
    );

    navigateToWorkspace('WMS-06');
    return true;
  };

  // Policies and adjustments
  const saveClearancePlanDraft = (
    targetTons: number,
    horizonMonths: 3 | 6 | 9 | 12 | 24 | 36,
    resources: NonNullable<ClearancePlan['resourceAssumptions']>
  ): boolean => {
    if (currentRole !== 'warehouse_manager') {
      triggerGateBlocked({
        title: 'ไม่มีสิทธิ์แก้ไขแผนเคลียร์สต็อก',
        unmetGates: ['ผู้จัดทำและแก้ไขแผนคือ Warehouse Manager'],
        recoveryRoute: 'สลับเป็น Warehouse Manager',
      });
      return false;
    }
    if (clearancePlan.status === 'IN_REVIEW' || !Number.isFinite(targetTons) || targetTons <= 0 || targetTons > clearancePlan.baselineFrozenTons) {
      triggerGateBlocked({
        title: 'ข้อมูลร่างแผนไม่ผ่านการตรวจสอบ',
        unmetGates: ['เป้าหมายต้องมากกว่า 0 และไม่เกิน frozen baseline; ถอนจาก review ก่อนแก้ไข'],
        recoveryRoute: 'แก้เป้าหมายหรือรอผล review ก่อนสร้าง draft version ใหม่',
      });
      return false;
    }
    const monthNames = [
      'ต.ค. 2026', 'พ.ย. 2026', 'ธ.ค. 2026', 'ม.ค. 2027', 'ก.พ. 2027', 'มี.ค. 2027',
      'เม.ย. 2027', 'พ.ค. 2027', 'มิ.ย. 2027', 'ก.ค. 2027', 'ส.ค. 2027', 'ก.ย. 2027',
      'ต.ค. 2027', 'พ.ย. 2027', 'ธ.ค. 2027', 'ม.ค. 2028', 'ก.พ. 2028', 'มี.ค. 2028',
      'เม.ย. 2028', 'พ.ค. 2028', 'มิ.ย. 2028', 'ก.ค. 2028', 'ส.ค. 2028', 'ก.ย. 2028',
      'ต.ค. 2028', 'พ.ย. 2028', 'ธ.ค. 2028', 'ม.ค. 2029', 'ก.พ. 2029', 'มี.ค. 2029',
      'เม.ย. 2029', 'พ.ค. 2029', 'มิ.ย. 2029', 'ก.ค. 2029', 'ส.ค. 2029', 'ก.ย. 2029',
    ];
    const [major, minor] = clearancePlan.version.replace(/^v/, '').split('.').map((part) => Number(part) || 0);
    const version = `v${major}.${minor + 1}`;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setClearancePlan((prev) => ({
      ...prev,
      version,
      status: 'DRAFT',
      targetTons,
      targetPercent: Math.round((targetTons / prev.baselineFrozenTons) * 1000) / 10,
      activeHorizonMonths: horizonMonths,
      resourceAssumptions: resources,
      submittedBy: undefined,
      reviewedBy: undefined,
      activatedBy: undefined,
      monthlyTargets: Array.from({ length: horizonMonths }, (_, idx) => {
        const actual = prev.monthlyTargets[idx]?.actualClearedTons || 0;
        const target = targetTons / horizonMonths;
        return {
          month: prev.monthlyTargets[idx]?.month || monthNames[idx] || `เดือนที่ ${idx + 1}`,
          targetTons: target,
          actualClearedTons: actual,
          varianceTons: actual - target,
          owner: prev.monthlyTargets[idx]?.owner || USER_ROLES[currentRole].name,
          status: actual >= target ? 'COMPLETED' as const : idx === 0 ? 'BEHIND' as const : 'ON_TRACK' as const,
        };
      }),
      history: [...prev.history, { date: now, action: 'SAVE_DRAFT', actor: USER_ROLES[currentRole].name, note: `บันทึกร่าง ${version}; เป้าหมาย ${targetTons} ตัน / ${horizonMonths} เดือน` }],
    }));
    return true;
  };

  const submitClearancePlanForReview = (): boolean => {
    if (currentRole !== 'warehouse_manager' || clearancePlan.status !== 'DRAFT') {
      triggerGateBlocked({
        title: 'ส่งแผนให้ตรวจทานไม่ได้',
        unmetGates: ['ต้องเป็น Warehouse Manager และแผนต้องอยู่สถานะ DRAFT'],
        recoveryRoute: 'บันทึก draft version ที่ผ่าน validation ก่อนส่ง review',
      });
      return false;
    }
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setClearancePlan((prev) => ({
      ...prev,
      status: 'IN_REVIEW',
      submittedBy: USER_ROLES[currentRole].name,
      history: [...prev.history, { date: now, action: 'SUBMIT_FOR_REVIEW', actor: USER_ROLES[currentRole].name, note: `ส่งแผน ${prev.version} ให้ผู้อนุมัติพิจารณา` }],
    }));
    return true;
  };

  const reviewClearancePlan = (action: 'APPROVE' | 'REJECT', note: string): boolean => {
    if (currentRole !== 'planning_approver' || clearancePlan.status !== 'IN_REVIEW') {
      triggerGateBlocked({
        title: 'ไม่มีสิทธิ์หรือแผนไม่ได้รอ review',
        unmetGates: ['ผู้อนุมัติแผนที่แยกหน้าที่จากผู้จัดทำเท่านั้นตรวจแผน IN_REVIEW ได้'],
        recoveryRoute: 'เลือกบทบาท Warehouse Plan Approver และตรวจ version/state ของแผน',
      });
      return false;
    }
    if (clearancePlan.submittedBy === USER_ROLES[currentRole].name || (action === 'REJECT' && !note.trim())) {
      triggerGateBlocked({
        title: 'ผล review ต้องมีผู้อนุมัติแยกหน้าที่และเหตุผล',
        unmetGates: ['Reject ต้องบันทึกเหตุผล; ผู้ submit ห้ามอนุมัติแผนของตนเอง'],
        recoveryRoute: 'ระบุเหตุผล reject หรือให้ผู้อนุมัติคนอื่น review',
      });
      return false;
    }
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const nextStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    setClearancePlan((prev) => ({
      ...prev,
      status: nextStatus,
      reviewedBy: USER_ROLES[currentRole].name,
      history: [...prev.history, { date: now, action: action === 'APPROVE' ? 'APPROVE_PLAN' : 'REJECT_PLAN', actor: USER_ROLES[currentRole].name, note: note.trim() || `อนุมัติแผน ${prev.version}` }],
    }));
    return true;
  };

  const activateClearancePlan = (): boolean => {
    if (currentRole !== 'warehouse_manager' || !['APPROVED', 'PAUSED'].includes(clearancePlan.status)) {
      triggerGateBlocked({
        title: 'เปิดใช้แผนไม่ได้',
        unmetGates: ['Warehouse Manager เปิดใช้ได้เมื่อแผนผ่าน approval หรือถูก pause ไว้'],
        recoveryRoute: 'ส่ง draft ให้ผู้อนุมัติและรอ APPROVED ก่อน',
      });
      return false;
    }
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setClearancePlan((prev) => ({
      ...prev,
      status: 'ACTIVE',
      activatedBy: USER_ROLES[currentRole].name,
      history: [...prev.history, { date: now, action: 'ACTIVATE_PLAN', actor: USER_ROLES[currentRole].name, note: `เปิดใช้แผน ${prev.version}` }],
    }));
    return true;
  };

  const pauseClearancePlan = (): boolean => {
    if (currentRole !== 'warehouse_manager' || clearancePlan.status !== 'ACTIVE') {
      triggerGateBlocked({ title: 'พักแผนไม่ได้', unmetGates: ['Warehouse Manager พักได้เฉพาะแผน ACTIVE'], recoveryRoute: 'ตรวจสถานะแผนและ role ปัจจุบัน' });
      return false;
    }
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setClearancePlan((prev) => ({
      ...prev,
      status: 'PAUSED',
      history: [...prev.history, { date: now, action: 'PAUSE_PLAN', actor: USER_ROLES[currentRole].name, note: 'พักแผน; actual LGX-03 ยังติดตามในประวัติ' }],
    }));
    return true;
  };

  const closeClearancePlan = (note: string): boolean => {
    if (currentRole !== 'warehouse_manager' || !['ACTIVE', 'PAUSED'].includes(clearancePlan.status) || !note.trim()) {
      triggerGateBlocked({ title: 'ปิดแผนไม่ได้', unmetGates: ['Warehouse Manager ปิดแผน ACTIVE/PAUSED ได้เมื่อระบุเหตุผล'], recoveryRoute: 'ระบุเหตุผลและตรวจสถานะแผน' });
      return false;
    }
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setClearancePlan((prev) => ({
      ...prev,
      status: 'CLOSED',
      history: [...prev.history, { date: now, action: 'CLOSE_PLAN', actor: USER_ROLES[currentRole].name, note: note.trim() }],
    }));
    return true;
  };

  const postOpeningStockImport = (items: InventoryItem[], idempotencyKey: string, sourceReference: string): boolean => {
    if (currentRole !== 'warehouse_manager') {
      triggerGateBlocked({ title: 'ไม่มีสิทธิ์ Post Opening Stock', unmetGates: ['การ Post ยอดยกคลังต้องยืนยันโดย Warehouse Manager'], recoveryRoute: 'ให้ Warehouse Manager ตรวจ review และ Post batch' });
      return false;
    }
    const itemIds = items.map((item) => item.id);
    const duplicateId = itemIds.find((id, index) => itemIds.indexOf(id) !== index || inventory.some((existing) => existing.id === id));
    if (!items.length || !idempotencyKey.trim() || !sourceReference.trim() || duplicateId || items.some((item) => item.canonicalStatus !== '01' || item.totalWeightTons <= 0 || item.availableWeightTons !== 0 || item.reservedWeightTons !== 0)) {
      triggerGateBlocked({ title: 'Opening Stock batch ไม่ผ่านเงื่อนไข', unmetGates: ['ต้องมีรายการไม่ซ้ำ, น้ำหนักมากกว่า 0, สถานะเริ่มต้น [01] และระบุ idempotency/source reference'], recoveryRoute: 'แก้รายการนำเข้าและตรวจ Lot ID ซ้ำก่อน Post' });
      return false;
    }
    if (integrationMessages.some((message) => message.idempotencyKey === idempotencyKey && message.status === 'SUCCESS')) {
      triggerGateBlocked({ title: 'ป้องกันการ Post ซ้ำ', unmetGates: ['idempotency key นี้มีผลสำเร็จแล้ว'], recoveryRoute: 'เปิด batch เดิมใน WMS-02 Integration และใช้ source reference ใหม่เฉพาะเมื่อเป็น batch ใหม่' });
      return false;
    }

    const totalQty = items.reduce((sum, item) => sum + item.totalWeightTons, 0);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setInventory((prev) => [...prev, ...items.map((item) => ({ ...item, lastUpdated: now }))]);
    appendIntegrationMessage({
      source: 'WMS',
      target: 'DATA_BUCKET',
      direction: 'OUTBOUND',
      schema: 'urn:tts:warehouse:opening-stock-posted:1.0',
      event: 'OPENING_STOCK_IMPORT_POSTED',
      correlationId: `CORR-${idempotencyKey}`,
      idempotencyKey,
      dependencies: [sourceReference, ...itemIds],
      owner: 'WMS Opening Stock Publisher',
      entityRef: sourceReference,
      payloadSummary: `Simulated local batch posted: ${items.length} new lots / ${totalQty.toFixed(3)} T at [01]; System One remains responsible for deriving statuses [02]-[03].`,
    });
    addAuditLog(itemIds.join(', '), 'Opening Stock Import', totalQty, 'ตัน (Tons)', 'NEW', '[01] On-hand Inventory', 'Opening Stock Import Post', `บันทึก batch ${sourceReference} จำนวน ${items.length} lot; รอ System One คำนวณสิทธิ์ [02]-[03]`, 'WMS', { idempotencyKey, sourceReference, lotCount: items.length });
    return true;
  };

  const activatePolicy = (policyId: string) => {
    const policy = policies.find((item) => item.id === policyId);
    if (currentRole !== 'warehouse_manager' || !policy || policy.status !== 'APPROVED') {
      triggerGateBlocked({
        title: 'เปิดใช้นโยบายไม่ได้',
        unmetGates: ['ผู้จัดการคลังเปิดใช้ได้เฉพาะ policy ที่ผู้อนุมัติแผนอนุมัติแล้ว'],
        recoveryRoute: 'ส่งร่างให้ Warehouse Plan Approver ตรวจสอบก่อน',
      });
      return;
    }
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setPolicies((prev) => prev.map((item) => {
      if (item.id === policyId) return { ...item, status: 'ACTIVE', activatedBy: USER_ROLES[currentRole].name, updatedAt: now };
      return item.status === 'ACTIVE' ? { ...item, status: 'ARCHIVED' } : item;
    }));
    setActivePolicyId(policyId);
  };

  const saveNewPolicyDraft = (name: string, description: string, rules: AllocationPolicy['rules']) => {
    if (currentRole !== 'warehouse_manager' || !name.trim() || !description.trim() || rules.length === 0 || rules.some((rule) => rule.weight < 0 || rule.weight > 100) || rules.reduce((total, rule) => total + rule.weight, 0) !== 100) {
      triggerGateBlocked({
        title: 'บันทึก policy draft ไม่ได้',
        unmetGates: ['ผู้จัดการคลังต้องระบุชื่อ คำอธิบาย และตั้งน้ำหนักกฎรวม 100% โดยแต่ละกฎอยู่ระหว่าง 0–100%'],
        recoveryRoute: 'ตรวจข้อมูลร่างนโยบายและบทบาทปัจจุบัน',
      });
      return;
    }
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const newPolicy: AllocationPolicy = {
      id: `POL-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      version: `v${(policies.length + 1).toFixed(1)}`,
      status: 'DRAFT',
      description: description.trim(),
      rules: rules.map((rule) => ({ ...rule })),
      bypassRequiresReason: true,
      createdBy: USER_ROLES[currentRole].name,
      updatedAt: now,
    };
    setPolicies((prev) => [...prev, newPolicy]);
  };

  const submitPolicyForReview = (policyId: string): boolean => {
    const policy = policies.find((item) => item.id === policyId);
    if (currentRole !== 'warehouse_manager' || !policy || policy.status !== 'DRAFT') {
      triggerGateBlocked({ title: 'ส่ง policy review ไม่ได้', unmetGates: ['ผู้จัดการคลังส่งได้เฉพาะ policy สถานะ DRAFT'], recoveryRoute: 'ตรวจ policy และบทบาทปัจจุบัน' });
      return false;
    }
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setPolicies((prev) => prev.map((item) => item.id === policyId ? { ...item, status: 'PENDING_REVIEW', submittedBy: USER_ROLES[currentRole].name, updatedAt: now } : item));
    return true;
  };

  const reviewPolicy = (policyId: string, action: 'APPROVE' | 'REJECT', note: string): boolean => {
    const policy = policies.find((item) => item.id === policyId);
    if (currentRole !== 'planning_approver' || !policy || policy.status !== 'PENDING_REVIEW' || policy.submittedBy === USER_ROLES[currentRole].name || (action === 'REJECT' && !note.trim())) {
      triggerGateBlocked({ title: 'ตรวจ policy ไม่ได้', unmetGates: ['ผู้อนุมัติแผนต้องเป็นคนละคนกับผู้ส่ง และ policy ต้องรอ review; การ reject ต้องระบุเหตุผล'], recoveryRoute: 'ตรวจบทบาท สถานะ policy และเหตุผลก่อนดำเนินการ' });
      return false;
    }
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setPolicies((prev) => prev.map((item) => item.id === policyId ? {
      ...item,
      status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      approvedBy: action === 'APPROVE' ? USER_ROLES[currentRole].name : undefined,
      reviewNote: note.trim(),
      updatedAt: now,
    } : item));
    return true;
  };

  const addAdjustmentProposal = (
    lotId: string,
    deltaQtyTons: number,
    reason: string,
    evidence: string
  ): string => {
    if (!['crane_operator', 'warehouse_manager'].includes(currentRole) || !Number.isFinite(deltaQtyTons) || deltaQtyTons === 0 || !reason.trim() || !evidence.trim()) {
      triggerGateBlocked({
        title: 'สร้างข้อเสนอปรับยอดไม่ได้',
        unmetGates: ['ผู้เสนอเป็นผู้ควบคุมลานหรือผู้จัดการคลัง และต้องระบุส่วนต่าง เหตุผล และหลักฐาน'],
        recoveryRoute: 'ตรวจบทบาทและกรอกข้อมูลการตรวจนับให้ครบ',
      });
      return '';
    }
    const item = inventory.find((it) => it.id === lotId);
    if (!item || item.canonicalStatus === '09' || item.canonicalStatus === '10' || item.canonicalStatus === '11') {
      triggerGateBlocked({ title: 'ไม่สามารถปรับ lot นี้ได้', unmetGates: ['lot ต้องอยู่ในขอบเขตสต็อกที่คลังดูแล และต้องไม่อยู่ระหว่างขนส่ง/ส่งมอบ/เคลม'], recoveryRoute: 'เลือก lot ที่คลังยังควบคุมและตรวจนับได้' });
      return '';
    }
    const beforeQty = item.totalWeightTons;
    if (beforeQty + deltaQtyTons < item.reservedWeightTons || item.availableWeightTons + deltaQtyTons < 0) {
      triggerGateBlocked({ title: 'ข้อเสนอทำให้ยอดคงเหลือติดลบหรือทับยอดจอง', unmetGates: ['ยอดหลังปรับต้องไม่น้อยกว่ายอด reserved และ available ต้องไม่ติดลบ'], recoveryRoute: 'ตรวจปริมาณนับจริงและตรวจการจองที่ยังมีผลก่อนเสนอใหม่' });
      return '';
    }
    const newProp: AdjustmentProposal = {
      id: `ADJ-${Date.now().toString().slice(-6)}`,
      lotId,
      beforeQtyTons: beforeQty,
      deltaQtyTons,
      afterQtyTons: beforeQty + deltaQtyTons,
      reason,
      evidence,
      stockVersion: item?.statusVersion || 'v2.10',
      status: 'PROPOSED',
      proposer: `${USER_ROLES[currentRole].titleTh} (${USER_ROLES[currentRole].name})`,
      proposedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };
    setAdjustmentProposals((prev) => [newProp, ...prev]);

    addAuditLog(
      lotId,
      'Stock Adjustment Proposal Created',
      Math.abs(deltaQtyTons),
      'ตัน (Tons)',
      'Balance Check',
      'Adjustment Proposed (Maker)',
      'Adjustment Proposal Filed',
      `ผู้ตรวจนับเสนอปรับยอด (${deltaQtyTons > 0 ? '+' : ''}${deltaQtyTons} ตัน) เหตุผล: ${reason}`,
      'WMS'
    );
    return newProp.id;
  };

  const reviewAdjustmentProposal = (
    proposalId: string,
    action: 'APPROVE' | 'REJECT',
    note: string
  ): boolean => {
    const prop = adjustmentProposals.find((p) => p.id === proposalId);
    if (!['warehouse_manager', 'planning_approver'].includes(currentRole) || !prop || prop.status !== 'PROPOSED' || (action === 'REJECT' && !note.trim())) {
      triggerGateBlocked({
        title: 'ไม่มีสิทธิ์หรือรายการไม่อยู่ในคิวตรวจปรับยอด',
      unmetGates: ['ผู้ตรวจสอบต้องเป็น Warehouse Manager หรือ Warehouse Plan Approver ที่ไม่ใช่ผู้เสนอ; ข้อเสนอต้องรอ review และการ reject ต้องระบุเหตุผล'],
        recoveryRoute: 'ตรวจบทบาทและสถานะข้อเสนอใน WMS-02',
      });
      return false;
    }

    // Check anti-self-approval rule
    if (prop.proposer.includes(USER_ROLES[currentRole].name)) {
      triggerGateBlocked({
        title: 'ไม่อนุญาตให้อนุมัติตนเอง (Self-Approval Prohibited)',
        unmetGates: [
          'ตามหลักการควบคุมภายในแบบแยกหน้าที่ (Maker-Checker): ผู้ยื่นข้อเสนอไม่สามารถเป็นผู้อนุมัติข้อเสนอของตนเองได้',
        ],
        recoveryRoute: 'ให้ผู้จัดการคลังสินค้าหรือผู้มีอำนาจท่านอื่นเป็นผู้ตรวจทานและอนุมัติ',
      });
      return false;
    }

    const currentItem = inventory.find((it) => it.id === prop.lotId);
    if (action === 'APPROVE' && (!currentItem || currentItem.statusVersion !== prop.stockVersion || prop.afterQtyTons < currentItem.reservedWeightTons || currentItem.availableWeightTons + prop.deltaQtyTons < 0)) {
      triggerGateBlocked({
        title: 'ข้อเสนอปรับยอด stale หรือทำให้ยอดติดลบ',
        unmetGates: ['version ปัจจุบันต้องตรงกับ version ตอนเสนอ; ยอดรวมต้องไม่น้อยกว่ายอด reserved และยอด available ต้องไม่ติดลบ'],
        recoveryRoute: 'กระทบยอดใหม่และให้ผู้เสนอสร้างข้อเสนอจาก version ล่าสุด',
      });
      return false;
    }

    setAdjustmentProposals((prev) =>
      prev.map((p) =>
        p.id === proposalId
          ? {
              ...p,
              status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
              reviewer: `${USER_ROLES[currentRole].titleTh} (${USER_ROLES[currentRole].name})`,
              reviewedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
              reviewNote: note,
            }
          : p
      )
    );

    if (action === 'APPROVE') {
      setInventory((prev) =>
        prev.map((it) =>
          it.id === prop.lotId
            ? {
                ...it,
                totalWeightTons: prop.afterQtyTons,
                availableWeightTons: Math.max(0, it.availableWeightTons + prop.deltaQtyTons),
                statusVersion: `v${(Number(it.statusVersion.match(/\d+(?:\.\d+)?/)?.[0] || 0) + 0.01).toFixed(2)}`,
                lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16),
              }
            : it
        )
      );
      addAuditLog(
        prop.lotId,
        'Adjustment Proposal Approved',
        Math.abs(prop.deltaQtyTons),
        'ตัน (Tons)',
        `${prop.beforeQtyTons} T`,
        `${prop.afterQtyTons} T`,
        'Adjustment Approved (Checker)',
        `Reviewer อนุมัติปรับยอดคงเหลือเป็น ${prop.afterQtyTons} ตัน บันทึกคู่รายการตรวจสอบ`,
        'WMS'
      );
    }
    return true;
  };

  const proposeStatusCorrection = (
    lotId: string,
    afterStatus: CanonicalProductStatus,
    sourceRef: string,
    reason: string,
    evidence: string
  ): string => {
    const item = inventory.find((entry) => entry.id === lotId);
    const warehouseStatuses: CanonicalProductStatus[] = ['04', '05', '06', '07', '08'];
    const hasOpenProcess = processingJobs.some((job) => job.inputLotId === lotId && job.status !== 'COMPLETED');
    const hasOpenTransfer = movements.some((move) => move.lotId === lotId && !['RECEIVED', 'DISCREPANCY', 'REJECTED'].includes(move.status));
    const hasPendingCorrection = statusCorrectionProposals.some((proposal) => proposal.lotId === lotId && proposal.status === 'PROPOSED');
    if (!['warehouse_manager', 'crane_operator'].includes(currentRole) || !item || !warehouseStatuses.includes(item.canonicalStatus) || !warehouseStatuses.includes(afterStatus) || item.canonicalStatus === afterStatus || !sourceRef.trim() || !reason.trim() || !evidence.trim()) {
      triggerGateBlocked({
        title: 'สร้างข้อเสนอแก้สถานะไม่ได้',
        unmetGates: ['ผู้เสนอเป็น Warehouse Manager หรือ Crane / Yard Operator', 'แก้ได้เฉพาะสถานะที่ WMS ดูแล [04]–[08] และต้องระบุ source reference, เหตุผล และหลักฐาน'],
        recoveryRoute: 'ตรวจสิทธิ์ เลือก stock ที่แก้ได้ และกรอกข้อมูลอ้างอิงให้ครบ',
      });
      return '';
    }
    if (hasOpenProcess || hasOpenTransfer || hasPendingCorrection || item.reservedWeightTons > 0) {
      triggerGateBlocked({
        title: 'stock slice ยังมีงานที่ต้องจัดการก่อน',
        unmetGates: ['ปิดหรือยกเลิกงานแปรรูป/ย้ายที่ค้างก่อน', 'ต้องไม่มีข้อเสนอแก้สถานะอื่นที่รอตรวจ', 'ห้ามเปลี่ยนสถานะของยอดที่ยังถูกจองออกจาก [04]'],
        recoveryRoute: 'จัดการงานที่ค้างหรือยอดจองใน workspace ที่เกี่ยวข้อง แล้วเสนอใหม่',
      });
      return '';
    }
    const proposal: StatusCorrectionProposal = {
      id: `STC-${Date.now().toString().slice(-8)}`,
      lotId,
      beforeStatus: item.canonicalStatus,
      afterStatus,
      qtyTons: item.totalWeightTons,
      sourceRef: sourceRef.trim(),
      expectedVersion: item.statusVersion,
      reason: reason.trim(),
      evidence: evidence.trim(),
      status: 'PROPOSED',
      proposer: `${USER_ROLES[currentRole].titleTh} (${USER_ROLES[currentRole].name})`,
      proposedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };
    setStatusCorrectionProposals((prev) => [proposal, ...prev]);
    addAuditLog(lotId, item.productName, item.totalWeightTons, 'ตัน (Tons)', `[${item.canonicalStatus}] ${CANONICAL_STATUS_MAP[item.canonicalStatus].labelTh}`, `เสนอแก้เป็น [${afterStatus}] ${CANONICAL_STATUS_MAP[afterStatus].labelTh}`, 'Status Correction Proposed', `${reason.trim()} · อ้างอิง ${sourceRef.trim()} · หลักฐาน ${evidence.trim()}`, 'WMS', { proposalId: proposal.id, expectedVersion: item.statusVersion });
    return proposal.id;
  };

  const reviewStatusCorrectionProposal = (
    proposalId: string,
    action: 'APPROVE' | 'REJECT',
    note: string
  ): boolean => {
    const proposal = statusCorrectionProposals.find((entry) => entry.id === proposalId);
    if (!['warehouse_manager', 'planning_approver'].includes(currentRole) || !proposal || proposal.status !== 'PROPOSED' || (action === 'REJECT' && !note.trim())) {
      triggerGateBlocked({
        title: 'ไม่มีสิทธิ์หรือข้อเสนอไม่อยู่ในคิวตรวจสอบ',
        unmetGates: ['ผู้ตรวจเป็น Warehouse Manager หรือ Planning Approver', 'ผู้เสนอห้ามอนุมัติตนเอง และการปฏิเสธต้องมีเหตุผล'],
        recoveryRoute: 'ตรวจสิทธิ์ สถานะข้อเสนอ และแยกผู้เสนอออกจากผู้ตรวจ',
      });
      return false;
    }
    if (proposal.proposer.includes(USER_ROLES[currentRole].name)) {
      triggerGateBlocked({ title: 'ห้ามผู้เสนออนุมัติข้อเสนอของตนเอง', unmetGates: ['ต้องใช้ผู้ตรวจอีกคนตามหลัก Maker-Checker'], recoveryRoute: 'ให้ผู้มีสิทธิ์คนอื่นตรวจข้อเสนอ' });
      return false;
    }
    const item = inventory.find((entry) => entry.id === proposal.lotId);
    const hasOpenProcess = processingJobs.some((job) => job.inputLotId === proposal.lotId && job.status !== 'COMPLETED');
    const hasOpenTransfer = movements.some((move) => move.lotId === proposal.lotId && !['RECEIVED', 'DISCREPANCY', 'REJECTED'].includes(move.status));
    if (action === 'APPROVE' && (!item || item.statusVersion !== proposal.expectedVersion || item.canonicalStatus !== proposal.beforeStatus || item.totalWeightTons !== proposal.qtyTons || item.reservedWeightTons > 0 || hasOpenProcess || hasOpenTransfer)) {
      triggerGateBlocked({ title: 'ข้อเสนอเก่าหรือ stock เปลี่ยนไปแล้ว', unmetGates: ['สถานะ, จำนวน, version และยอดจองต้องตรงกับเวลาที่เสนอ'], recoveryRoute: 'ตรวจ stock ปัจจุบันและสร้างข้อเสนอใหม่จาก version ล่าสุด' });
      return false;
    }
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const reviewer = `${USER_ROLES[currentRole].titleTh} (${USER_ROLES[currentRole].name})`;
    setStatusCorrectionProposals((prev) => prev.map((entry) => entry.id === proposalId ? {
      ...entry,
      status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      reviewer,
      reviewedAt: timestamp,
      reviewNote: note.trim(),
    } : entry));
    if (action === 'APPROVE' && item) {
      const nextVersion = `v${(Number(item.statusVersion.match(/\d+(?:\.\d+)?/)?.[0] || 0) + 0.01).toFixed(2)}`;
      setInventory((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, canonicalStatus: proposal.afterStatus, statusVersion: nextVersion, lastUpdated: timestamp } : entry));
      addAuditLog(item.id, item.productName, proposal.qtyTons, 'ตัน (Tons)', `[${proposal.beforeStatus}] ${CANONICAL_STATUS_MAP[proposal.beforeStatus].labelTh}`, `[${proposal.afterStatus}] ${CANONICAL_STATUS_MAP[proposal.afterStatus].labelTh}`, 'Status Correction Approved', `${proposal.reason} · อ้างอิง ${proposal.sourceRef} · หลักฐาน ${proposal.evidence} · ตรวจโดย ${reviewer}`, 'WMS', { proposalId, oldVersion: proposal.expectedVersion, newVersion: nextVersion, reviewNote: note.trim() });
    } else {
      addAuditLog(proposal.lotId, item?.productName || proposal.lotId, proposal.qtyTons, 'ตัน (Tons)', `[${proposal.beforeStatus}]`, `[${proposal.beforeStatus}] (Correction Rejected)`, 'Status Correction Rejected', `${proposal.reason} · ${note.trim()}`, 'WMS', { proposalId, sourceRef: proposal.sourceRef, evidence: proposal.evidence });
    }
    return true;
  };

  const createReconciliationCorrection = (recId: string, note: string) => {
    const rec = reconciliationRecords.find((r) => r.id === recId);
    if (currentRole !== 'warehouse_manager' && currentRole !== 'crane_operator') {
      triggerGateBlocked({
        title: 'ไม่มีสิทธิ์เสนอ correction จากผลกระทบยอด',
        unmetGates: ['ผู้ตรวจนับหรือ Warehouse Manager เป็นผู้เสนอ; ผู้อนุมัติต้องเป็นอีกคน'],
        recoveryRoute: 'สลับเป็น Crane / Yard Operator หรือ Warehouse Manager',
      });
      return;
    }
    if (!rec || rec.status !== 'DISCREPANCY' || rec.correctionProposalId) {
      triggerGateBlocked({
        title: 'รายการนี้ไม่มี correction ที่ต้องเสนอ',
        unmetGates: ['ต้องเป็น discrepancy ที่ยังไม่มี adjustment proposal'],
        recoveryRoute: 'refresh ผล reconciliation และตรวจ linked proposal',
      });
      return;
    }

    const correctionProposalId = addAdjustmentProposal(
      rec.lotId,
      rec.actualCountQtyTons - rec.expectedQtyTons,
      `สร้างข้อเสนอปรับยอดจากผลการกระทบยอด: ${note}`,
      'RECONCILIATION-AUDIT-DISCREPANCY'
    );

    setReconciliationRecords((prev) =>
      prev.map((r) => (r.id === recId ? { ...r, correctionProposalId } : r))
    );
  };

  const retryIntegrationMessage = (msgId: string) => {
    if (currentRole !== 'system_admin' && currentRole !== 'warehouse_manager') {
      triggerGateBlocked({
        title: 'ไม่มีสิทธิ์ replay integration event',
        unmetGates: ['การ replay event จำลองทำได้โดย Integration Admin หรือ Warehouse Manager ที่ได้รับมอบหมาย'],
        recoveryRoute: 'สลับเป็น System Admin หรือ Warehouse Manager แล้วตรวจ event detail',
      });
      return;
    }
    const message = integrationMessages.find((m) => m.id === msgId);
    if (!message || message.status === 'SUCCESS' || message.retryable === false) {
      triggerGateBlocked({
        title: 'event นี้ไม่สามารถ retry ได้',
        unmetGates: ['ต้องเป็น event ที่ยังไม่ success และมี retryable flag'],
        recoveryRoute: 'ตรวจ error code และ dependency; แก้ payload ก่อน replay หากจำเป็น',
      });
      return;
    }
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setIntegrationMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId) {
          const nextAttempts = m.attempts + 1;
          return {
            ...m,
            attempts: nextAttempts,
            status: 'SUCCESS' as const,
            transportAck: true,
            businessAck: true,
            retryable: false,
            updatedAt: now,
            errorDetail: undefined,
            errorCode: undefined,
            history: [
              ...m.history,
              `${now}: ${USER_ROLES[currentRole].name} replayed event; SIMULATED transport ACK and business ACK accepted (attempt ${nextAttempts})`,
            ],
          };
        }
        return m;
      })
    );
  };

  const resetDemoData = () => {
    localStorage.removeItem('tts_inventory_v2');
    localStorage.removeItem('tts_so_requests_v2');
    localStorage.removeItem('tts_pick_tasks_v2');
    localStorage.removeItem('tts_processing_jobs_v2');
    localStorage.removeItem('tts_movements_v2');
    localStorage.removeItem('tts_replacement_proposals_v2');
    localStorage.removeItem('tts_clearance_plan_v2');
    localStorage.removeItem('tts_audit_events_v2');
    localStorage.removeItem('tts_policies_v2');
    localStorage.removeItem('tts_integration_messages_v2');
    localStorage.removeItem('tts_adjustments_v2');
    localStorage.removeItem('tts_status_corrections_v1');
    localStorage.removeItem('tts_reconciliations_v2');

    setInventory(INITIAL_INVENTORY);
    setSoRequests(INITIAL_SO_REQUESTS);
    setPickTasks(INITIAL_PICK_TASKS);
    setProcessingJobs(INITIAL_PROCESSING_JOBS);
    setMovements(INITIAL_MOVEMENTS);
    setReplacementProposals(INITIAL_REPLACEMENT_PROPOSALS);
    setClearancePlan(INITIAL_CLEARANCE_PLAN);
    setAuditEvents(INITIAL_AUDIT_EVENTS);
    setPolicies(INITIAL_POLICIES);
    setActivePolicyId('POL-01');
    setIntegrationMessages(INITIAL_INTEGRATION_MESSAGES);
    setAdjustmentProposals(INITIAL_ADJUSTMENT_PROPOSALS);
    setStatusCorrectionProposals([]);
    setReconciliationRecords(INITIAL_RECONCILIATION_RECORDS);
    setStockBookings([]);
    setStockBookingGroups([]);
    setWorkTypeConfigs([
      { sku: 'H-SM400-300150', workType: 'FINISHED', processingDays: 0 },
      { sku: 'WF-SM400-200200', workType: 'FINISHED', processingDays: 0 },
      { sku: 'RB-SD40-DB25', workType: 'FINISHED', processingDays: 0 },
      { sku: 'RB-SD40-DB19', workType: 'FINISHED', processingDays: 0 },
      { sku: 'COIL-HR-SS400-30', workType: 'PROCESSING', processingDays: 3 },
      { sku: 'AZ-GL-023-914', workType: 'FINISHED', processingDays: 0 },
      { sku: 'AZ-AZ70-035-914', workType: 'PROCESSING', processingDays: 2 },
      { sku: 'COIL-HR-30MM', workType: 'PROCESSING', processingDays: 3 },
      { sku: 'PL-SS400-9MM', workType: 'PROCESSING', processingDays: 2 },
    ]);
    setActiveWorkspace('WMS-05');
  };

  return (
    <WmsContext.Provider
      value={{
        theme,
        toggleTheme,
        currentRole,
        setCurrentRole,
        selectedWarehouse,
        setSelectedWarehouse,
        activeWorkspace,
        setActiveWorkspace,
        navContext,
        navigateToWorkspace,
        inventory,
        soRequests,
        pickTasks,
        processingJobs,
        movements,
        replacementProposals,
        clearancePlan,
        auditEvents,
        policies,
        activePolicyId,
        setActivePolicyId,
        integrationMessages,
        adjustmentProposals,
        statusCorrectionProposals,
        reconciliationRecords,
        stockBookings,
        stockBookingGroups,
        workTypeConfigs,
        createStockBookingGroup,
        submitWarehouseBookingReview,
        acknowledgeBookingLeadTime,
        acceptBookingReplacement,
        attachBookingQuotation,
        confirmBookingGroup,
        proposeExceptionReplacement,
        resolveBookingException,
        saveWorkTypeConfig,
        gateBlocked,
        closeGateModal,
        triggerGateBlocked,
        verifySoRequest,
        uploadSoPdfSimulation,
        updateSoLinePermitted,
        updateSalesReservationSelection,
        resolveOcrRecovery,
        submitSalesSelectionToSystemOne,
        retrySystemOneSubmission,
        managerApproveAllocation,
        createPickTaskForReserved,
        managerAssignPickTask,
        updatePickTaskStatus,
        updatePickQcChecklist,
        reportDamagedStockInPicking,
        managerConfirmStaging08,
        amendStagingReadinessWHX02,
        cancelStagingReadinessWHX03,
        simulateLogisticsHandoverLGX03,
        simulateDeliveryLGX04,
        simulateDeliveryFailureLGX05,
        simulateCustomerClaimLGX06,
        requestBayMovement,
        approveBayMovement,
        rejectBayMovement,
        dispatchBayMovementMover,
        confirmBayTransferReceipt,
        approveProcessingJob,
        startProcessingJob,
        confirmProcessingPhysicalReceipt,
        finishProcessingJob,
        stageOrderAtGate,
        confirmOrderReady08,
        completeProcessingJobQC,
        proposeStockReplacement,
        acceptReplacementProposal,
        rejectReplacementProposal,
        managerApproveReplacementHoldToReserved,
        createPickTaskForReplacement,
        saveClearancePlanDraft,
        submitClearancePlanForReview,
        reviewClearancePlan,
        activateClearancePlan,
        pauseClearancePlan,
        closeClearancePlan,
        postOpeningStockImport,
        activatePolicy,
        saveNewPolicyDraft,
        submitPolicyForReview,
        reviewPolicy,
        addAdjustmentProposal,
        reviewAdjustmentProposal,
        proposeStatusCorrection,
        reviewStatusCorrectionProposal,
        createReconciliationCorrection,
        retryIntegrationMessage,
        resetDemoData,
      }}
    >
      {children}
    </WmsContext.Provider>
  );
};

export const useWms = () => {
  const context = useContext(WmsContext);
  if (!context) {
    throw new Error('useWms must be used within a WmsProvider');
  }
  return context;
};
