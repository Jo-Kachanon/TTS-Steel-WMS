import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWms } from '../../context/WmsContext';
import { StatusBadge } from '../common/StatusBadge';
import { BookingGroupsPanel } from './booking/BookingGroupsPanel';
import { RequisitionPrintModal } from './booking/RequisitionPrintModal';
import { RoleStepHint } from '../common/RoleStepHint';
import { CANONICAL_STATUS_MAP, CanonicalProductStatus, USER_ROLES } from '../../types/wms';
import {
  ArrowRight,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowLeftRight,
  Wrench,
  ShieldAlert,
  Download,
  ShieldCheck,
  Printer,
} from 'lucide-react';


/** What the QC inspector physically checks on processed output before recording pass / fail / scrap. */
const QC_INSPECTION_CHECKS = [
  'ขนาด (หนา × กว้าง × ยาว) ตามสเปกในใบเสนอราคา',
  'ขอบตัดเรียบ ไม่บิ่น ไม่มีครีบ',
  'ผิวไม่มีรอยขีด สนิม หรือรอยบุบ',
  'ชั่งน้ำหนักจริงแล้ว ตรงกับยอดที่กรอก',
];

export const Wms11Lifecycle: React.FC<{
  initialTab?: 'status' | 'bookings' | 'processing';
  workspaceCode?: string;
  pageTitle?: string;
  pageDescription?: string;
}> = ({
  initialTab = 'status',
  workspaceCode = 'WMS-11',
  pageTitle = 'ภาพรวมสินค้าและสถานะ',
  pageDescription = 'ค้นหาสถานะสินค้า จัดการย้ายโซน และติดตามงานแปรรูปหรือเคลม',
}) => {
  const {
    inventory,
    pickTasks,
    auditEvents,
    statusCorrectionProposals,
    movements,
    processingJobs,
    stockBookings,
    stockBookingGroups,
    workTypeConfigs,
    requestBayMovement,
    approveBayMovement,
    rejectBayMovement,
    dispatchBayMovementMover,
    confirmBayTransferReceipt,
    startProcessingJob,
    confirmProcessingPhysicalReceipt,
    finishProcessingJob,
    completeProcessingJobQC,
    proposeStatusCorrection,
    reviewStatusCorrectionProposal,
    currentRole,
    navigateToWorkspace,
  } = useWms();

  const productNameThai = (name: string) => name
    .replaceAll('H-Beam', 'เหล็กเอชบีม')
    .replaceAll('Wide Flange', 'เหล็กไวด์แฟลงก์')
    .replaceAll('Hot Rolled Coil', 'เหล็กม้วนรีดร้อน')
    .replaceAll('HR Coil', '')
    .replaceAll('mm', 'มม.')
    .replace(/(\d)M\b/g, '$1 ม.');
  const zoneNameThai = (zone: string) => zone
    .replaceAll('Zone ', 'โซน ')
    .replaceAll('Rework / Quarantine', 'รอแปรรูป / กักกัน')
    .replaceAll('Staging', 'พักส่งมอบ')
    .replaceAll('Claim', 'กักกันเคลม');
  const movementStatusThai: Record<string, string> = {
    REQUESTED: 'รออนุมัติ',
    APPROVED: 'อนุมัติแล้ว',
    MOVER_DISPATCHED: 'มอบหมายผู้ย้ายแล้ว',
    RECEIVED: 'ผู้รับยืนยันแล้ว',
    DISCREPANCY: 'พบยอดไม่ตรง',
    REJECTED: 'ปฏิเสธแล้ว',
  };
  const processingStatusThai: Record<string, string> = {
    PENDING: 'รอเริ่มงาน',
    IN_PROCESS: 'กำลังแปรรูป',
    QC_INSPECTION: 'แปรรูปเสร็จ · รอตรวจคุณภาพ',
    COMPLETED: 'ผ่าน QC แล้ว',
  };
  const proposalStatusThai: Record<string, string> = {
    PROPOSED: 'รอตรวจสอบ',
    APPROVED: 'อนุมัติแล้ว',
    REJECTED: 'ปฏิเสธแล้ว',
  };

  const [activeTab, setActiveTab] = useState<'status' | 'bookings' | 'transfer' | 'processing' | 'claim' | 'history'>(initialTab);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState('ALL');
  const [selectedStockId, setSelectedStockId] = useState<string>('');
  const [movementQueue, setMovementQueue] = useState<'ALL' | 'APPROVAL' | 'MOVE' | 'RECEIVE' | 'CLOSED'>('ALL');

  // Bay-to-Bay Transfer Form State
  const [selectedLotForMove, setSelectedLotForMove] = useState<string>(inventory.find((item) => item.canonicalStatus === '04' && item.totalWeightTons > 0)?.id || '');
  const [destBay, setDestBay] = useState<string>('BAY-A04-R2');
  const [moveReason, setMoveReason] = useState<string>('จัดระเบียบพื้นที่จัดเก็บ');
  const [moveQty, setMoveQty] = useState<number>(inventory.find((item) => item.canonicalStatus === '04' && item.totalWeightTons > 0)?.totalWeightTons || 0);

  // Transfer Receiver Confirmation Modal / Form State
  const [activeTransferForReceive, setActiveTransferForReceive] = useState<string | null>(null);
  const [activeTransferForReject, setActiveTransferForReject] = useState<string | null>(null);
  const [transferRejectionReason, setTransferRejectionReason] = useState('');
  const [receivedQtyInput, setReceivedQtyInput] = useState<number>(3.25);
  const [discrepancyNoteInput, setDiscrepancyNoteInput] = useState<string>('');
  const [evidenceInput, setEvidenceInput] = useState<string>('');

  // Processing QC form state
  const [selectedJobId, setSelectedJobId] = useState<string>(processingJobs[0]?.id || '');
  const [printJobId, setPrintJobId] = useState<string | null>(null);
  const [qcChecks, setQcChecks] = useState<boolean[]>([]);
  /** Booking line, order and follow-up pick task for a processing job created from a quotation. */
  const jobOrderLink = (job: { inputLotId: string; linkedSoNumber?: string }) => {
    const booking = job.linkedSoNumber ? stockBookings.find((entry) => entry.lotId === job.inputLotId && entry.approvedSoReference === job.linkedSoNumber) : undefined;
    const group = booking ? stockBookingGroups.find((entry) => entry.id === booking.groupId) : undefined;
    const task = booking ? pickTasks.find((entry) => entry.lotId === booking.lotId && entry.soNumber === booking.approvedSoReference) : undefined;
    return { booking, group, task };
  };
  const [qcPassQty, setQcPassQty] = useState<number>(14.5);
  const [qcFailQty, setQcFailQty] = useState<number>(0.0);
  const [qcScrapQty, setQcScrapQty] = useState<number>(0.5);
  const [qcNotes, setQcNotes] = useState<string>('ตัดแต่งปลายท่อนเหล็ก 0.5M เรียบร้อย สเปกตรงตามมาตรฐาน มอก.');

  // Audit history filter
  const [historyBoundaryFilter, setHistoryBoundaryFilter] = useState<string>('ALL');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyEventTypeFilter, setHistoryEventTypeFilter] = useState<'ALL' | 'MOVEMENT' | 'STATUS' | 'INTEGRATION'>('ALL');
  const [correctionAfterStatus, setCorrectionAfterStatus] = useState<CanonicalProductStatus>('04');
  const [correctionSourceRef, setCorrectionSourceRef] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionEvidence, setCorrectionEvidence] = useState('');
  const [correctionReviewNote, setCorrectionReviewNote] = useState('');

  const selectedItemForMove = inventory.find((it) => it.id === selectedLotForMove) || inventory[0];
  const selectedStock = inventory.find((it) => it.id === selectedStockId) || inventory[0];
  const latestStockEvent = selectedStock ? auditEvents.find((event) => event.lotId === selectedStock.id) : undefined;
  const activeJob = processingJobs.find((j) => j.id === selectedJobId) || processingJobs[0];
  const activeJobItem = activeJob ? inventory.find((item) => item.id === activeJob.inputLotId) : undefined;
  const jobPreparationDate = activeJob?.notes.match(/วันเตรียม ([^;]+)/)?.[1] || '—';
  const jobDeliveryDate = activeJob?.notes.match(/วันส่ง ([^;]+)/)?.[1] || '—';
  const jobStagingGate = activeJob?.notes.match(/ประตู ([^;]+)/)?.[1] || 'รอระบุ';
  const qcTotalQty = qcPassQty + qcFailQty + qcScrapQty;
  const qcBalanced = !!activeJob && Math.abs(qcTotalQty - activeJob.inputQtyTons) <= 0.001;
  const qcCanSubmit = currentRole === 'qc_inspector' && activeJob?.status === 'QC_INSPECTION' && activeJob.physicalReceiptConfirmed && QC_INSPECTION_CHECKS.every((_, index) => qcChecks[index]) && qcBalanced && !!qcNotes.trim();

  useEffect(() => {
    if (!activeJob) return;
    const defaultScrap = activeJob.inputQtyTons > 1 ? 0.5 : 0;
    setQcPassQty(Math.max(0, activeJob.inputQtyTons - defaultScrap));
    setQcFailQty(0);
    setQcScrapQty(defaultScrap);
    setQcNotes(activeJob.notes || 'ตรวจสอบผลแปรรูปและบันทึกหลักฐาน QC');
    setQcChecks([]);
  }, [activeJob?.id, activeJob?.inputQtyTons]);

  const filteredInventory = useMemo(() => {
    const query = inventorySearch.trim().toLocaleLowerCase();
    return inventory.filter((item) => {
      if (inventoryStatusFilter !== 'ALL' && item.canonicalStatus !== inventoryStatusFilter) return false;
      if (!query) return true;
      const searchableFields = [
        item.id,
        item.lotNumber,
        item.heatNumber,
        item.sourceLotId,
        item.productCode,
        item.productName,
        item.grade,
        item.standard,
        item.dimensions,
        item.locationBay,
        item.zone,
        item.rfidTag,
        CANONICAL_STATUS_MAP[item.canonicalStatus].labelTh,
        CANONICAL_STATUS_MAP[item.canonicalStatus].labelEn,
      ];
      return searchableFields.some((value) => value?.toLocaleLowerCase().includes(query));
    });
  }, [inventory, inventorySearch, inventoryStatusFilter]);

  const filteredInventoryTons = filteredInventory.reduce((total, item) => total + item.totalWeightTons, 0);
  const movableInventory = inventory.filter((item) => item.canonicalStatus === '04' && item.totalWeightTons > 0);
  const filteredMovements = movements.filter((item) => {
    if (movementQueue === 'APPROVAL') return item.status === 'REQUESTED';
    if (movementQueue === 'MOVE') return item.status === 'APPROVED';
    if (movementQueue === 'RECEIVE') return item.status === 'MOVER_DISPATCHED';
    if (movementQueue === 'CLOSED') return ['RECEIVED', 'DISCREPANCY', 'REJECTED'].includes(item.status);
    return true;
  });

  const handleCreateTransferRequest = () => {
    if (!selectedItemForMove || !moveReason.trim()) return;
    const created = requestBayMovement(selectedItemForMove.id, destBay, moveQty, moveReason.trim());
    if (created) {
      setMovementQueue('ALL');
      setMoveReason('จัดระเบียบพื้นที่จัดเก็บ');
    }
  };

  const handleFinishQC = () => {
    if (!activeJob) return;
    completeProcessingJobQC(activeJob.id, qcPassQty, qcFailQty, qcScrapQty, qcNotes);
  };

  const handleProposeStatusCorrection = () => {
    if (!selectedStock) return;
    const proposalId = proposeStatusCorrection(selectedStock.id, correctionAfterStatus, correctionSourceRef, correctionReason, correctionEvidence);
    if (proposalId) {
      setCorrectionSourceRef('');
      setCorrectionReason('');
      setCorrectionEvidence('');
    }
  };

  const selectedStockCorrections = statusCorrectionProposals.filter((proposal) => proposal.lotId === selectedStock?.id);

  const filteredHistory = auditEvents.filter((evt) => {
    if (historyEventTypeFilter === 'MOVEMENT' && !/transfer|movement|ย้าย/i.test(evt.trigger)) return false;
    if (historyEventTypeFilter === 'STATUS' && !/status|สถานะ|qc|processing/i.test(`${evt.trigger} ${evt.fromStatus} ${evt.toStatus}`)) return false;
    if (historyEventTypeFilter === 'INTEGRATION' && !['SYSTEM_ONE', 'LOGISTICS'].includes(evt.boundary)) return false;
    if (historyBoundaryFilter !== 'ALL' && evt.boundary !== historyBoundaryFilter) return false;
    if (
      historySearch &&
      !evt.id.toLowerCase().includes(historySearch.toLowerCase()) &&
      !evt.lotId.toLowerCase().includes(historySearch.toLowerCase()) &&
      !evt.productSpec.toLowerCase().includes(historySearch.toLowerCase()) &&
      !evt.timestamp.toLowerCase().includes(historySearch.toLowerCase()) &&
      !evt.trigger.toLowerCase().includes(historySearch.toLowerCase()) &&
      !evt.actor.toLowerCase().includes(historySearch.toLowerCase()) &&
      !evt.correlationId.toLowerCase().includes(historySearch.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-4 text-[var(--text-primary)]">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--text-secondary)] mb-1">
              <span>คลังสินค้า</span><span>/</span><span className="text-blue-400 font-bold">{workspaceCode}</span>
            </div>
            <h1 className="text-[22px] font-bold tracking-tight">{pageTitle}</h1>
            <p className="text-[12px] text-[var(--text-secondary)] mt-1">{pageDescription}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px] font-semibold">ข้อมูลตัวอย่าง · จำลองในเครื่อง · ณ {auditEvents[0]?.timestamp || '—'}</span>
            <button
              onClick={() => {
                const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredHistory, null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute('href', dataStr);
                downloadAnchor.setAttribute('download', `AUDIT_TRAIL_${new Date().toISOString().slice(0, 10)}.json`);
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-[12px] transition-colors"
            >
              <Download className="w-3.5 h-3.5" /><span>ส่งออกประวัติ</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
          <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]">
            <div className="text-[11px] text-[var(--text-secondary)]">ยอดสินค้าแยกตามล็อต</div>
            <div className="text-[19px] font-bold font-mono mt-0.5">{inventory.length.toLocaleString()} <span className="text-[11px] font-sans font-normal text-[var(--text-secondary)]">รายการ</span></div>
            <div className="text-[10px] text-[var(--text-secondary)] mt-1">แสดงสถานะตามข้อมูลตัวอย่าง</div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]">
            <div className="text-[11px] text-[var(--text-secondary)]">กำลังย้ายโซน</div>
            <div className="text-[19px] font-bold font-mono mt-0.5">{movements.filter((item) => !['RECEIVED', 'DISCREPANCY', 'REJECTED'].includes(item.status)).length} <span className="text-[11px] font-sans font-normal text-[var(--text-secondary)]">รายการ</span></div>
            <div className="text-[10px] text-[var(--text-secondary)] mt-1">พิกัดเปลี่ยนเมื่อผู้รับยืนยัน</div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]">
            <div className="text-[11px] text-[var(--text-secondary)]">งานแปรรูปค้าง</div>
            <div className="text-[19px] font-bold font-mono mt-0.5">{processingJobs.filter((job) => job.status !== 'COMPLETED').length} <span className="text-[11px] font-sans font-normal text-[var(--text-secondary)]">งาน</span></div>
            <div className="text-[10px] text-[var(--text-secondary)] mt-1">รอเริ่ม · กำลังทำ · รอตรวจคุณภาพ</div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]">
            <div className="text-[11px] text-[var(--text-secondary)]">ไม่ผ่าน / เคลม</div>
            <div className="text-[19px] font-bold font-mono mt-0.5">{inventory.filter((item) => item.canonicalStatus === '07' || item.canonicalStatus === '11').length} <span className="text-[11px] font-sans font-normal text-[var(--text-secondary)]">รายการ</span></div>
            <div className="text-[10px] text-[var(--text-secondary)] mt-1">แยกจากสถานะรับคืนเข้าคลัง</div>
          </div>
        </div>
      </header>

      <nav aria-label="เมนู WMS-11" className="flex items-center gap-1 bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-color)] overflow-x-auto text-[12px]">
        {([
          ['status', 'สถานะสินค้า'],
          ['bookings', 'รายการจองและติดตาม'],
          ['transfer', 'ย้ายโซน'],
          ['processing', 'แปรรูป'],
          ['claim', 'ไม่ผ่าน / เคลม'],
          ['history', 'ประวัติ'],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap px-3.5 py-2 rounded-lg font-semibold transition-colors ${activeTab === tab ? 'bg-blue-600 text-white shadow-xs' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-shell)]'}`}
          >
            {label}{tab === 'bookings' ? ` · ${stockBookings.filter((booking) => !['EXPIRED', 'CANCELLED'].includes(booking.status)).length}` : tab === 'transfer' ? ` · ${movements.length}` : tab === 'processing' ? ` · ${processingJobs.length}` : tab === 'claim' ? ` · ${inventory.filter((item) => item.canonicalStatus === '07' || item.canonicalStatus === '11').length}` : tab === 'history' ? ` · ${auditEvents.length}` : ''}
          </button>
        ))}
      </nav>

      {activeTab === 'bookings' && <BookingGroupsPanel />}

      {/* TAB 1: Stock status and search */}
      {activeTab === 'status' && (
        <section className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[var(--border-color)] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold">ค้นหาสินค้าทั้งหมดในคลัง</h2>
              <p className="text-[11.5px] text-[var(--text-secondary)] mt-1">ค้นหาทุกล็อต รวมถึงสินค้าระหว่างส่งมอบและรายการเคลม พร้อมดูสถานะสินค้าปัจจุบัน</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 lg:min-w-[520px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--text-secondary)]" />
                <input
                  value={inventorySearch}
                  onChange={(event) => setInventorySearch(event.target.value)}
                  placeholder="ค้นหาล็อต สินค้า เกรด สเปก ช่องจัดเก็บ หรือป้ายระบุสินค้า"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border-color)] text-[12px]"
                  aria-label="ค้นหาสินค้าทั้งหมด"
                />
              </div>
              <select
                value={inventoryStatusFilter}
                onChange={(event) => setInventoryStatusFilter(event.target.value)}
                className="sm:w-64 px-3 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border-color)] text-[12px]"
                aria-label="กรองตามสถานะสินค้า"
              >
                <option value="ALL">ทุกสถานะ (01–11)</option>
                {(Object.keys(CANONICAL_STATUS_MAP) as CanonicalProductStatus[]).sort().map((status) => (
                  <option key={status} value={status}>[{status}] {CANONICAL_STATUS_MAP[status].labelTh} ({CANONICAL_STATUS_MAP[status].labelEn})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="px-4 py-2.5 flex items-center justify-between text-[11.5px] text-[var(--text-secondary)] border-b border-[var(--border-color)]">
            <span>พบ {filteredInventory.length.toLocaleString()} จาก {inventory.length.toLocaleString()} รายการ</span>
            <span className="font-mono">น้ำหนักรวมที่พบ {filteredInventoryTons.toLocaleString(undefined, { maximumFractionDigits: 3 })} ตัน</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px] border-collapse min-w-[1050px]">
              <thead className="bg-[var(--table-header)] text-[var(--text-secondary)] font-mono text-[10.5px] border-b border-[var(--border-color)]">
                <tr>
                  <th className="py-3 px-3">ล็อต / เลขหลอม</th>
                  <th className="py-3 px-3">สินค้า / สเปก</th>
                  <th className="py-3 px-3">สถานะสินค้า</th>
                  <th className="py-3 px-3 text-right">คงเหลือรวม</th>
                  <th className="py-3 px-3 text-right">พร้อมใช้</th>
                  <th className="py-3 px-3 text-right">จองแล้ว</th>
                  <th className="py-3 px-3">ตำแหน่ง</th>
                  <th className="py-3 px-3 text-right">อายุสินค้า</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {filteredInventory.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedStockId(item.id)}
                    aria-selected={selectedStock?.id === item.id}
                    className={`cursor-pointer transition-colors ${selectedStock?.id === item.id ? 'bg-blue-500/10' : 'hover:bg-[var(--table-row-hover)]'}`}
                  >
                    <td className="py-3 px-3">
                      <div className="font-mono font-bold text-blue-400">{item.id}</div>
                      <div className="font-mono text-[10px] text-[var(--text-secondary)]">เลขหลอม: {item.heatNumber}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold">{productNameThai(item.productName)}</div>
                      <div className="text-[10.5px] text-[var(--text-secondary)]">{item.productCode} · {item.grade} · {item.dimensions}</div>
                    </td>
                    <td className="py-3 px-3"><StatusBadge status={item.canonicalStatus} size="sm" /></td>
                    <td className="py-3 px-3 text-right font-mono">{item.totalWeightTons.toLocaleString(undefined, { maximumFractionDigits: 3 })} ตัน</td>
                    <td className="py-3 px-3 text-right font-mono">{item.availableWeightTons.toLocaleString(undefined, { maximumFractionDigits: 3 })} ตัน</td>
                    <td className="py-3 px-3 text-right font-mono">{item.reservedWeightTons.toLocaleString(undefined, { maximumFractionDigits: 3 })} ตัน</td>
                    <td className="py-3 px-3"><div>{item.locationBay.replaceAll('Bay ', 'ช่อง ')}</div><div className="text-[10px] text-[var(--text-secondary)]">{zoneNameThai(item.zone)}</div></td>
                    <td className="py-3 px-3 text-right font-mono">{item.ageDays} วัน</td>
                  </tr>
                ))}
                {filteredInventory.length === 0 && (
                  <tr><td colSpan={8} className="py-10 text-center text-[var(--text-secondary)]">ไม่พบสินค้า ลองเปลี่ยนคำค้นหาหรือเลือกทุกสถานะ</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {selectedStock && (
            <div className="m-4 mt-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-shell)] p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-mono font-bold text-blue-400">{selectedStock.id}</h3>
                    <StatusBadge status={selectedStock.canonicalStatus} size="sm" />
                  </div>
                  <p className="font-semibold mt-1">{selectedStock.productName}</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">{selectedStock.productCode} · {selectedStock.grade} · {selectedStock.dimensions} · เลขหลอม {selectedStock.heatNumber}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLotForMove(selectedStock.id);
                    setMoveQty(selectedStock.totalWeightTons);
                    setActiveTab('transfer');
                  }}
                  disabled={selectedStock.canonicalStatus !== '04' || selectedStock.totalWeightTons <= 0}
                  className="shrink-0 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11.5px] font-bold disabled:opacity-50"
                >
                  ขอคำย้ายโซน (04)
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 text-[11px]">
                <div><span className="text-[var(--text-secondary)] block">คงเหลือ</span><strong className="font-mono">{selectedStock.totalWeightTons.toFixed(3)} ตัน</strong></div>
                <div><span className="text-[var(--text-secondary)] block">พร้อมใช้</span><strong className="font-mono">{selectedStock.availableWeightTons.toFixed(3)} ตัน</strong></div>
                <div><span className="text-[var(--text-secondary)] block">จองแล้ว</span><strong className="font-mono">{selectedStock.reservedWeightTons.toFixed(3)} ตัน</strong></div>
                <div><span className="text-[var(--text-secondary)] block">ตำแหน่ง / โซน</span><strong className="font-mono">{selectedStock.locationBay} · {selectedStock.zone}</strong></div>
                <div><span className="text-[var(--text-secondary)] block">อายุ / เวอร์ชัน</span><strong className="font-mono">{selectedStock.ageDays} วัน · {selectedStock.statusVersion}</strong></div>
              </div>
              <p className="mt-3 pt-2 border-t border-[var(--border-color)] text-[10.5px] text-[var(--text-secondary)]">
                รับข้อมูลล่าสุด {selectedStock.lastUpdated} · {selectedStock.sourceLotId ? `ต้นทาง ${selectedStock.sourceLotId} · ` : ''}{['01', '02', '03'].includes(selectedStock.canonicalStatus) ? 'สถานะนี้เป็นข้อมูลจากระบบหน้าบ้านและแก้จาก WMS ไม่ได้' : selectedStock.canonicalStatus === '04' ? 'ย้ายได้เฉพาะสถานะ 04; ตำแหน่งเปลี่ยนเมื่อผู้รับยืนยันและสถานะสินค้าเดิมคงอยู่' : 'สถานะนี้จัดการผ่านขั้นตอนของงานที่เกี่ยวข้อง ไม่ใช่การย้ายโซนปกติ'}
              </p>
              <p className="mt-1 text-[10.5px] text-[var(--text-secondary)]">เหตุการณ์ล่าสุด: {latestStockEvent ? `${latestStockEvent.timestamp} · ${latestStockEvent.trigger} · ${latestStockEvent.actor}` : 'ไม่มีเหตุการณ์ในตัวอย่าง'}</p>
              <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-3">
                <section className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div><h4 className="text-[12px] font-bold">เสนอแก้ไขสถานะสินค้า</h4><p className="text-[10px] text-[var(--text-secondary)] mt-0.5">ต้องมีเหตุผลและหลักฐาน ผู้ตรวจอีกคนอนุมัติก่อนบันทึกสถานะ</p></div>
                    <span className="shrink-0 text-[9px] px-2 py-1 rounded bg-amber-500/10 text-amber-300">ไม่เปลี่ยนทันที</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-[10.5px]">
                    <label className="flex flex-col gap-1"><span>สถานะปัจจุบัน</span><input readOnly value={`[${selectedStock.canonicalStatus}] ${CANONICAL_STATUS_MAP[selectedStock.canonicalStatus].labelTh}`} className="px-2 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border-color)]" /></label>
                    <label className="flex flex-col gap-1"><span>สถานะที่เสนอ</span><select value={correctionAfterStatus} onChange={(event) => setCorrectionAfterStatus(event.target.value as CanonicalProductStatus)} className="px-2 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border-color)]">
                      {(['04', '05', '06', '07', '08'] as CanonicalProductStatus[]).map((status) => <option key={status} value={status}>[{status}] {CANONICAL_STATUS_MAP[status].labelTh}</option>)}
                    </select></label>
                    <label className="flex flex-col gap-1 col-span-2"><span>จำนวนที่ได้รับผล (ตัน · ทั้ง stock slice)</span><input readOnly value={selectedStock.totalWeightTons.toFixed(3)} className="px-2 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border-color)] font-mono" /></label>
                    <label className="flex flex-col gap-1 col-span-2"><span>เลขอ้างอิงต้นทาง *</span><input value={correctionSourceRef} onChange={(event) => setCorrectionSourceRef(event.target.value)} placeholder="เลขเอกสาร / เหตุการณ์ต้นทาง" className="px-2 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border-color)]" /></label>
                    <label className="flex flex-col gap-1 col-span-2"><span>เหตุผล *</span><textarea rows={2} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} className="px-2 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border-color)]" /></label>
                    <label className="flex flex-col gap-1 col-span-2"><span>หลักฐาน *</span><input value={correctionEvidence} onChange={(event) => setCorrectionEvidence(event.target.value)} placeholder="รหัสรูปถ่าย / ใบตรวจนับ / เอกสาร" className="px-2 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border-color)]" /></label>
                  </div>
                  <p className="mt-2 text-[9.5px] text-[var(--text-secondary)]">แก้ได้เฉพาะสถานะที่ WMS ดูแล [04]–[08] · [01]–[03] มาจากระบบหนึ่ง และ [09]–[11] มาจาก Logistics/เคลม · งานแปรรูปและย้ายที่ค้างต้องปิดก่อน</p>
                  <button type="button" onClick={handleProposeStatusCorrection} disabled={!['04', '05', '06', '07', '08'].includes(selectedStock.canonicalStatus) || correctionAfterStatus === selectedStock.canonicalStatus || !['warehouse_manager', 'crane_operator'].includes(currentRole) || !correctionSourceRef.trim() || !correctionReason.trim() || !correctionEvidence.trim() || selectedStock.reservedWeightTons > 0} className="mt-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10.5px] font-bold disabled:opacity-50 disabled:cursor-not-allowed">ส่งข้อเสนอให้ผู้ตรวจ</button>
                  {!['04', '05', '06', '07', '08'].includes(selectedStock.canonicalStatus) && <p className="mt-1 text-[10px] text-amber-300">สถานะนี้แก้ใน WMS-11 ไม่ได้; ให้ต้นทางของสถานะเป็นผู้ส่ง correction</p>}
                </section>

                <section className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-3">
                  <div className="flex items-center justify-between gap-2"><h4 className="text-[12px] font-bold">ข้อเสนอแก้สถานะ</h4><span className="font-mono text-[10px] text-[var(--text-secondary)]">{selectedStockCorrections.length} รายการ</span></div>
                  {selectedStockCorrections.length === 0 ? <p className="py-5 text-center text-[10.5px] text-[var(--text-secondary)]">ยังไม่มีข้อเสนอสำหรับ stock นี้</p> : (
                    <div className="mt-2 max-h-72 overflow-y-auto divide-y divide-[var(--border-color)]">
                      {selectedStockCorrections.map((proposal) => {
                        const isMaker = proposal.proposer.includes(USER_ROLES[currentRole].name);
                        const canReview = ['warehouse_manager', 'planning_approver'].includes(currentRole) && proposal.status === 'PROPOSED' && !isMaker;
                        return <div key={proposal.id} className="py-2 text-[10px]">
                          <div className="flex justify-between gap-2"><strong className="font-mono text-blue-300">{proposal.id}</strong><span className={`font-bold ${proposal.status === 'APPROVED' ? 'text-emerald-300' : proposal.status === 'REJECTED' ? 'text-rose-300' : 'text-amber-300'}`}>{proposalStatusThai[proposal.status] || proposal.status}</span></div>
                          <div className="mt-1">[{proposal.beforeStatus}] → [{proposal.afterStatus}] · {proposal.qtyTons.toFixed(3)} ตัน · {proposal.expectedVersion}</div>
                          <div className="text-[var(--text-secondary)] mt-1">{proposal.reason} · Ref: {proposal.sourceRef} · Evidence: {proposal.evidence}</div>
                          <div className="text-[var(--text-secondary)]">ผู้เสนอ {proposal.proposer} · {proposal.proposedAt}{proposal.reviewer ? ` · ผู้ตรวจ ${proposal.reviewer}` : ''}</div>
                          {proposal.status === 'PROPOSED' && <div className="mt-2">
                            {canReview ? <><input value={correctionReviewNote} onChange={(event) => setCorrectionReviewNote(event.target.value)} placeholder="หมายเหตุผู้ตรวจ (จำเป็นเมื่อตีกลับ)" className="w-full px-2 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border-color)]" /><div className="flex gap-2 mt-1.5"><button type="button" onClick={() => reviewStatusCorrectionProposal(proposal.id, 'APPROVE', correctionReviewNote)} className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold">อนุมัติ</button><button type="button" onClick={() => { if (reviewStatusCorrectionProposal(proposal.id, 'REJECT', correctionReviewNote)) setCorrectionReviewNote(''); }} disabled={!correctionReviewNote.trim()} className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold disabled:opacity-40">ปฏิเสธ</button></div></> : <span className="text-amber-300">{isMaker ? 'ผู้เสนอห้ามอนุมัติตนเอง' : 'รอผู้จัดการคลังหรือผู้อนุมัติแผนตรวจสอบ'}</span>}
                          </div>}
                          {proposal.reviewNote && <div className="mt-1 text-indigo-300">หมายเหตุผู้ตรวจ: {proposal.reviewNote}</div>}
                        </div>;
                      })}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 2: Bay-to-Bay 4-Stage Transfer Lifecycle */}
      {activeTab === 'transfer' && (
        <div className="flex flex-col gap-4">
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 shadow-xs flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-color)]">
              <div>
                <h2 className="text-[15px] font-bold flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-blue-500" />
                  <span>ระบบเคลื่อนย้ายระหว่างช่องจัดเก็บ 4 ขั้นตอน</span>
                </h2>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  กฎสำคัญ: ต้องผ่านการร้องขอ อนุมัติ มอบหมายงาน และให้ผู้รับยืนยัน ก่อนเปลี่ยนพิกัด
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
                  {movements.length} รายการคำขอย้ายลาน
                </span>
              </div>
            </div>

            {/* 4 Stages Legend */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[12px] font-mono">
              <div className="p-2.5 rounded-lg bg-[var(--bg-shell)] border border-[var(--border-color)]">
                <span className="font-bold text-amber-400 block">1. รออนุมัติคำขอ</span>
                <span className="text-[11px] text-[var(--text-secondary)]">ผู้ร้องขอสร้างคำขอ ยอดเดิมคงที่</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--bg-shell)] border border-[var(--border-color)]">
                <span className="font-bold text-indigo-400 block">2. อนุมัติแล้ว</span>
                <span className="text-[11px] text-[var(--text-secondary)]">ผจก.คลัง ตรวจสอบความเข้ากันของสเปก</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--bg-shell)] border border-[var(--border-color)]">
                <span className="font-bold text-sky-400 block">3. มอบหมายผู้เคลื่อนย้ายแล้ว</span>
                <span className="text-[11px] text-[var(--text-secondary)]">เครน/รถยก นำสินค้าเข้าสู่ระหว่างย้าย</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--bg-shell)] border border-emerald-500/30">
                <span className="font-bold text-emerald-400 block">4. ผู้รับยืนยันรับสินค้าแล้ว</span>
                <span className="text-[11px] text-[var(--text-secondary)]">ผู้รับยืนยันยอด → อัปเดตพิกัดลานจริง!</span>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
              <section className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-shell)] p-3.5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-[13px] font-bold">สร้างคำขอย้ายโซน</h3>
                    <p className="text-[10.5px] text-[var(--text-secondary)] mt-0.5">ตำแหน่งจะเปลี่ยนหลังผู้รับยืนยันเท่านั้น</p>
                  </div>
                  <span className="text-[9px] rounded-full px-2 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/20">จำลอง</span>
                </div>
                <div className="flex flex-col gap-2.5 text-[11px]">
                  <label className="flex flex-col gap-1">
                    <span className="text-[var(--text-secondary)]">ล็อต / ปริมาณสินค้าที่แยก</span>
                    <select
                      value={selectedLotForMove}
                      onChange={(event) => {
                        const item = movableInventory.find((entry) => entry.id === event.target.value);
                        setSelectedLotForMove(event.target.value);
                        if (item) setMoveQty(item.totalWeightTons);
                      }}
                      className="w-full px-2.5 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border-color)] font-mono"
                    >
                      {movableInventory.map((item) => <option key={item.id} value={item.id}>[{item.canonicalStatus}] {CANONICAL_STATUS_MAP[item.canonicalStatus].labelTh} · {item.id} · {item.totalWeightTons.toFixed(3)} ตัน · {item.locationBay}</option>)}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[var(--text-secondary)]">จาก</span>
                      <input readOnly value={selectedItemForMove?.locationBay || '—'} className="w-full px-2.5 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border-color)] font-mono opacity-80" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[var(--text-secondary)]">ไป</span>
                      <select value={destBay} onChange={(event) => setDestBay(event.target.value)} className="w-full px-2.5 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border-color)] font-mono">
                        <option value="BAY-A04-R2">BAY-A04-R2</option>
                        <option value="STG-GATE-02">STG-GATE-02</option>
                        <option value="Bay 03-C2">ช่อง 03-C2</option>
                        <option value="BAY-CLAIM-01">BAY-CLAIM-01</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[var(--text-secondary)]">จำนวน (ตัน)</span>
                      <input type="number" min="0.001" max={selectedItemForMove?.totalWeightTons || undefined} step="0.001" value={moveQty} onChange={(event) => setMoveQty(Number(event.target.value))} className="w-full px-2.5 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border-color)] font-mono" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[var(--text-secondary)]">เหตุผล</span>
                      <input value={moveReason} onChange={(event) => setMoveReason(event.target.value)} placeholder="ระบุเหตุผลการย้าย" className="w-full px-2.5 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border-color)]" />
                    </label>
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)]">รองรับการย้ายปกติเฉพาะสถานะ [04] · สถานะและวันรับเข้าเดิมคงไว้ · ตรวจ capacity เป็นข้อมูลจำลอง</div>
                  <button type="button" onClick={handleCreateTransferRequest} disabled={!selectedItemForMove || !['warehouse_manager', 'crane_operator'].includes(currentRole) || moveQty <= 0 || moveQty > (selectedItemForMove?.totalWeightTons || 0) || destBay === selectedItemForMove?.locationBay || !moveReason.trim()} className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                    ส่งคำขอย้ายโซน
                  </button>
                  {!['warehouse_manager', 'crane_operator'].includes(currentRole) && <p className="text-[10px] text-amber-300">บทบาทปัจจุบันดูรายการได้ แต่เปิดคำขอไม่ได้</p>}
                </div>
              </section>

              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-shell)] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div><h3 className="text-[13px] font-bold">คิวการย้าย</h3><p className="text-[10.5px] text-[var(--text-secondary)] mt-0.5">แยกผู้ขอ ผู้อนุมัติ ผู้ย้าย และผู้รับ</p></div>
                  <div className="flex flex-wrap gap-1">
                    {([
                      ['ALL', 'ทั้งหมด'], ['APPROVAL', 'ขออนุมัติ'], ['MOVE', 'รอย้าย'], ['RECEIVE', 'รอรับ'], ['CLOSED', 'เสร็จ/ส่วนต่าง'],
                    ] as const).map(([key, label]) => (
                      <button key={key} type="button" onClick={() => setMovementQueue(key)} aria-pressed={movementQueue === key} className={`px-2 py-1 rounded-md text-[10px] ${movementQueue === key ? 'bg-blue-600 text-white' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>{label} <span className="font-mono">{key === 'ALL' ? movements.length : movements.filter((item) => key === 'APPROVAL' ? item.status === 'REQUESTED' : key === 'MOVE' ? item.status === 'APPROVED' : key === 'RECEIVE' ? item.status === 'MOVER_DISPATCHED' : ['RECEIVED', 'DISCREPANCY', 'REJECTED'].includes(item.status)).length}</span></button>
                    ))}
                  </div>
                </div>
                <div className="text-[10px] text-[var(--text-secondary)]">ก่อนยืนยันรับ ระบบยังไม่ย้ายยอดหรือเปลี่ยนตำแหน่งจริง</div>
              </div>
            </div>

            {/* Movements Table */}
            <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
              <table className="w-full text-left text-[12.5px] border-collapse">
                <thead className="bg-[var(--table-header)] text-[var(--text-secondary)] font-mono text-[11px] border-b border-[var(--border-color)]">
                  <tr>
                    <th className="py-2.5 px-3">เลขที่คำขอย้ายและวันที่</th>
                    <th className="py-2.5 px-3">รหัสล็อตและสเปกสินค้า</th>
                    <th className="py-2.5 px-3">พิกัด ต้นทาง → ปลายทาง</th>
                    <th className="py-2.5 px-3 text-right">น้ำหนัก (ตัน)</th>
                    <th className="py-2.5 px-3 text-center">สถานะขั้นตอน</th>
                    <th className="py-2.5 px-3 text-right">การปฏิบัติการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {filteredMovements.map((trf) => (
                    <tr key={trf.id} className="hover:bg-[var(--bg-shell)] transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-blue-400">{trf.transferNumber}</div>
                        <div className="font-mono text-[11px] text-[var(--text-secondary)] mt-0.5">
                          {trf.requestedAt}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">ผู้ขอ: {trf.requester}</div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-[var(--text-primary)]">{trf.productSpec}</div>
                        <div className="font-mono text-[11px] text-blue-400">ล็อต: {trf.lotId}</div>
                        <div className="text-[11px] text-[var(--text-secondary)]">เหตุผล: {trf.reason}</div>
                      </td>

                      <td className="py-3 px-3 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-[var(--bg-shell)] border border-[var(--border-color)]">
                            {trf.fromBay}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                            {trf.toBay}
                          </span>
                        </div>
                        <div className="text-[10.5px] text-[var(--text-secondary)] mt-1 font-sans">
                          สถานะสินค้าคงเดิม: [{trf.preservedStatus}]
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono">
                        <span className="font-bold text-blue-400 text-[13px]">
                          {trf.qtyTons.toFixed(3)} ตัน
                        </span>
                        {trf.receivedQtyTons !== undefined && (
                          <div className="text-[10.5px] text-emerald-400">
                            รับแล้ว: {trf.receivedQtyTons.toFixed(3)} ตัน
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`font-mono text-[10.5px] px-2 py-0.5 rounded font-bold border ${
                            trf.status === 'RECEIVED'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : trf.status === 'DISCREPANCY'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : trf.status === 'MOVER_DISPATCHED'
                              ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                              : trf.status === 'APPROVED'
                              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {movementStatusThai[trf.status] || trf.status}
                        </span>
                        {trf.discrepancyNote && (
                          <div className="text-[10px] text-rose-400 mt-1 max-w-[150px] mx-auto truncate">
                            {trf.discrepancyNote}
                          </div>
                        )}
                        {trf.rejectionReason && <div className="text-[10px] text-rose-400 mt-1 max-w-[180px] mx-auto">เหตุผลปฏิเสธ: {trf.rejectionReason}</div>}
                        <div className="mt-1 space-y-0.5 text-left text-[10px] text-[var(--text-secondary)]">
                          <div>ผู้อนุมัติ: {trf.approver || 'รออนุมัติ'}</div>
                          <div>ผู้ย้าย: {trf.mover || 'ยังไม่จ่ายงาน'}</div>
                          <div>ผู้รับ: {trf.receiver || 'รอตรวจรับ'}</div>
                          {trf.receivedAt && <div>รับเมื่อ: {trf.receivedAt}</div>}
                          {trf.unreceivedQtyTons ? <div className="text-amber-400">คงต้นทาง: {trf.unreceivedQtyTons.toFixed(3)} ตัน</div> : null}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right">
                        {trf.status === 'REQUESTED' && (
                          currentRole === 'warehouse_manager' ? (
                            <div className="flex flex-col gap-1.5 items-end">
                              <button type="button" onClick={() => approveBayMovement(trf.id)} disabled={trf.requester.includes(USER_ROLES[currentRole].name)} title={trf.requester.includes(USER_ROLES[currentRole].name) ? 'ผู้ร้องขอต้องไม่พิจารณาคำขอของตนเอง' : undefined} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11.5px] shadow-xs disabled:opacity-50 disabled:cursor-not-allowed">อนุมัติคำขอ</button>
                              <button type="button" onClick={() => { setActiveTransferForReject(trf.id); setTransferRejectionReason(''); }} disabled={trf.requester.includes(USER_ROLES[currentRole].name)} className="px-3 py-1 rounded-lg text-rose-300 hover:bg-rose-500/10 text-[10.5px] disabled:opacity-50 disabled:cursor-not-allowed">ปฏิเสธพร้อมเหตุผล</button>
                            </div>
                          ) : <span className="text-[10.5px] text-[var(--text-secondary)]">รอผู้จัดการคลังอนุมัติ</span>
                        )}

                        {trf.status === 'APPROVED' && (
                          currentRole === 'crane_operator' ? (
                            <button
                              onClick={() => dispatchBayMovementMover(trf.id, 'สมหมาย ช. (คนขับเครน #01)')}
                              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11.5px] shadow-xs"
                            >
                              เริ่มย้าย / ยืนยันผู้ย้าย
                            </button>
                          ) : <span className="text-[10.5px] text-[var(--text-secondary)]">รอพนักงานลานเคลื่อนย้าย</span>
                        )}

                        {trf.status === 'MOVER_DISPATCHED' && (
                          currentRole === 'qc_inspector' || currentRole === 'logistics_clerk' ? (
                            <button
                              onClick={() => {
                                setActiveTransferForReceive(trf.id);
                                setReceivedQtyInput(trf.qtyTons);
                                setDiscrepancyNoteInput('');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11.5px] shadow-xs"
                            >
                              ผู้รับยืนยันรับเข้าพิกัด
                            </button>
                          ) : <span className="text-[10.5px] text-[var(--text-secondary)]">รอผู้ตรวจรับปลายทาง</span>
                        )}

                        {(trf.status === 'RECEIVED' || trf.status === 'DISCREPANCY') && (
                          <span className="text-[11px] text-emerald-400 font-mono font-semibold">
                            ✓ Commit พิกัดแล้ว
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredMovements.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-[var(--text-secondary)]">ไม่มีรายการในคิวนี้</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Receiver Confirmation Dialog */}
          {activeTransferForReceive && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
              <div className="w-full max-w-lg bg-[var(--bg-card)] border-2 border-emerald-500/40 rounded-xl p-5 shadow-2xl flex flex-col gap-4 text-[13px]">
                <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-[15px] border-b border-emerald-500/20 pb-2.5">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>ผู้ตรวจรับปลายทางยืนยันรับสินค้าเข้าพิกัดลาน</span>
                </div>

                <div className="p-2.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-200 text-[11.5px]">
                  * พิกัดลานในคลังสินค้าจะได้รับการอัปเดตอย่างเป็นทางการเมื่อกดยืนยันในขั้นตอนนี้เท่านั้น
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-[12px] font-bold text-[var(--text-secondary)]">
                      ปริมาณน้ำหนักที่ตรวจรับจริง (ตัน):
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={receivedQtyInput}
                      onChange={(e) => setReceivedQtyInput(parseFloat(e.target.value) || 0)}
                      className="w-full mt-1 p-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg font-mono text-[14px] text-emerald-400 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[12px] font-bold text-[var(--text-secondary)]">
                      บันทึกส่วนต่าง / ข้อสังเกต (Discrepancy Note ถ้ามี):
                    </label>
                    <input
                      type="text"
                      placeholder="ระบุส่วนต่างหรือเหตุผลหากน้ำหนักไม่ตรง..."
                      value={discrepancyNoteInput}
                      onChange={(e) => setDiscrepancyNoteInput(e.target.value)}
                      className="w-full mt-1 p-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg text-[12.5px]"
                    />
                  </div>

                  <div>
                    <label className="text-[12px] font-bold text-[var(--text-secondary)]">
                      หลักฐานการตรวจรับ (Evidence / Barcode Scan):
                    </label>
                    <input
                      type="text"
                      value={evidenceInput}
                      onChange={(e) => setEvidenceInput(e.target.value)}
                      className="w-full mt-1 p-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg font-mono text-[12px]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border-color)]">
                  <button
                    onClick={() => setActiveTransferForReceive(null)}
                    className="px-3.5 py-1.5 rounded-lg bg-[var(--bg-shell)] hover:bg-slate-700/50 text-[var(--text-secondary)]"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => {
                      const committed = confirmBayTransferReceipt(activeTransferForReceive, receivedQtyInput, discrepancyNoteInput, evidenceInput);
                      if (committed) setActiveTransferForReceive(null);
                    }}
                    disabled={receivedQtyInput <= 0 || receivedQtyInput > (movements.find((m) => m.id === activeTransferForReceive)?.qtyTons || 0) || !evidenceInput.trim()}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ยืนยันรับเข้าลาน (Commit Location)
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTransferForReject && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <div role="dialog" aria-modal="true" aria-labelledby="transfer-reject-title" className="w-full max-w-md rounded-xl border border-rose-500/30 bg-[var(--bg-card)] p-5 shadow-2xl flex flex-col gap-4">
                <div><h3 id="transfer-reject-title" className="font-bold text-rose-300">ปฏิเสธคำขอย้ายโซน</h3><p className="text-[11px] text-[var(--text-secondary)] mt-1">คำขอจะไม่เปลี่ยนยอดหรือตำแหน่ง และเก็บเหตุผลไว้ในประวัติ</p></div>
                <label className="text-[11px] text-[var(--text-secondary)]">เหตุผลที่ปฏิเสธ <span className="text-rose-300">*</span>
                  <textarea rows={3} value={transferRejectionReason} onChange={(event) => setTransferRejectionReason(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] p-2.5 text-[12px] text-[var(--text-primary)]" placeholder="เช่น ตำแหน่งปลายทางไม่เหมาะกับสินค้ารายการนี้" />
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setActiveTransferForReject(null)} className="px-3 py-2 rounded-lg bg-[var(--bg-shell)] text-[var(--text-secondary)] text-[11px]">ยกเลิก</button>
                  <button type="button" onClick={() => { if (rejectBayMovement(activeTransferForReject, transferRejectionReason)) setActiveTransferForReject(null); }} disabled={!transferRejectionReason.trim()} className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] disabled:opacity-50">ยืนยันการปฏิเสธ</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Processing & Rework Jobs */}
      {activeTab === 'processing' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Jobs List (7 Cols) */}
          <div className="lg:col-span-6 flex flex-col gap-3">
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs p-4 flex flex-col gap-3">
              <div className="flex flex-col gap-3 pb-2 border-b border-[var(--border-color)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-[14px] flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-purple-400" />
                  <span>ใบสั่งงานแปรรูปและดัดแปลง</span>
                </span>
                <div className="flex items-center gap-2"><span className="font-mono text-[11px] text-purple-400 font-bold">{processingJobs.filter((job) => job.status !== 'COMPLETED').length} งานค้าง</span><button type="button" onClick={() => navigateToWorkspace('WMS-06')} className="px-2.5 py-1 rounded-lg border border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">เปิดข้อยกเว้นจากใบหยิบ WMS-06</button></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                  <div className="rounded bg-amber-500/10 text-amber-200 px-2 py-1.5">รอเริ่ม <strong className="font-mono">{processingJobs.filter((job) => job.status === 'PENDING').length}</strong> · [05] สินค้ารอแปรรูป</div>
                  <div className="rounded bg-sky-500/10 text-sky-200 px-2 py-1.5">กำลังแปรรูป <strong className="font-mono">{processingJobs.filter((job) => job.status === 'IN_PROCESS').length}</strong> · [06]</div>
                  <div className="rounded bg-indigo-500/10 text-indigo-200 px-2 py-1.5">แปรรูปเสร็จ · รอตรวจ <strong className="font-mono">{processingJobs.filter((job) => job.status === 'QC_INSPECTION').length}</strong> · QC</div>
                  <div className="rounded bg-emerald-500/10 text-emerald-200 px-2 py-1.5">เสร็จแล้ว <strong className="font-mono">{processingJobs.filter((job) => job.status === 'COMPLETED').length}</strong></div>
                </div>
              </div>

              <div className="divide-y divide-[var(--border-color)]">
                {processingJobs.map((job) => {
                  const isSelected = activeJob?.id === job.id;
                  return (
                    <div
                      key={job.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedJobId(job.id);
                      }}
                      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedJobId(job.id); } }}
                      className={`p-3 cursor-pointer transition-colors rounded-lg flex flex-col gap-2 ${
                        isSelected ? 'bg-purple-500/10 border-l-4 border-purple-500' : 'hover:bg-[var(--bg-shell)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-purple-400">{job.jobNumber}</span>
                          <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-slate-700 text-slate-300">
                            {job.jobType}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-[10.5px] px-2 py-0.5 rounded font-bold ${
                            job.status === 'COMPLETED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : job.status === 'IN_PROCESS'
                              ? 'bg-sky-500/20 text-sky-300'
                              : job.status === 'QC_INSPECTION'
                              ? 'bg-indigo-500/20 text-indigo-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {processingStatusThai[job.status] || job.status}
                        </span>
                      </div>

                      <div className="text-[12px] flex items-center justify-between">
                        <span>ล็อตวัตถุดิบ: <strong className="font-mono text-blue-400">{job.inputLotId}</strong></span>
                        <span className="font-mono font-bold text-[13px]">{job.inputQtyTons.toFixed(3)} ตัน</span>
                      </div>

                      <div className="text-[10.5px] text-[var(--text-secondary)]">{job.linkedSoNumber ? `ใบสั่ง ${job.linkedSoNumber}${jobOrderLink(job).group ? ` · ${jobOrderLink(job).group!.customerName}` : ''} · ` : ''}{job.notes}</div>
                      {job.status === 'COMPLETED' && jobOrderLink(job).task && (
                        <div className="flex items-center justify-between rounded bg-emerald-500/10 px-2 py-1.5 text-[11px] text-emerald-200">
                          <span>ส่งกลับเข้างานหยิบของใบสั่ง {job.linkedSoNumber} แล้ว · {jobOrderLink(job).task!.pickNumber}</span>
                          <button onClick={(event) => { event.stopPropagation(); navigateToWorkspace('WMS-06'); }} className="font-bold underline">เปิดงานหยิบ →</button>
                        </div>
                      )}

                      <div className="text-[11.5px] text-[var(--text-secondary)]">
                        เครื่องจักร: {job.machine} • ช่างผู้คุม: {job.operator}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-[var(--border-color)] text-[11px]">
                        <span className="text-[var(--text-secondary)] font-mono">
                          กายภาพรับเข้า: {job.physicalReceiptConfirmed ? '✓ ตรวจรับแล้ว' : 'รอการตรวจรับเข้าเครื่อง'}
                        </span>
                        <div className="flex items-center gap-2">
                          {job.status === 'PENDING' && (
                            currentRole === 'crane_operator' ? <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startProcessingJob(job.id);
                              }}
                              className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold"
                            >
                              เริ่มงานแปรรูป (05 → 06)
                            </button> : <span className="text-[10px] text-[var(--text-secondary)]">รอพนักงานลานเริ่มงาน 05 → 06</span>
                          )}
                          {job.status === 'IN_PROCESS' && !job.physicalReceiptConfirmed && (
                            currentRole === 'crane_operator' ? <button
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmProcessingPhysicalReceipt(job.id);
                              }}
                              className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold"
                            >
                              ยืนยันรับเข้าเครื่อง
                            </button> : <span className="text-[10px] text-[var(--text-secondary)]">รอ Crane ยืนยันรับเข้าจริง</span>
                          )}
                          {job.status === 'IN_PROCESS' && job.physicalReceiptConfirmed && (
                            currentRole === 'crane_operator' ? <button
                              onClick={(e) => {
                                e.stopPropagation();
                                finishProcessingJob(job.id);
                              }}
                              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                            >
                              แปรรูปเสร็จ · ส่งตรวจคุณภาพ
                            </button> : <span className="text-[10px] text-[var(--text-secondary)]">รอผู้ปฏิบัติงานแจ้งแปรรูปเสร็จ</span>
                          )}
                          {job.status === 'QC_INSPECTION' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedJobId(job.id);
                                window.setTimeout(() => document.getElementById('qc-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                              }}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                            >
                              กรอกผลตรวจคุณภาพ →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {processingJobs.length === 0 && <div className="py-8 text-center text-[11px] text-[var(--text-secondary)]">ยังไม่มีงานแปรรูป · เปิดข้อยกเว้นของเสียจาก WMS-06 แล้วกลับมาติดตามงานที่นี่</div>}
              </div>
            </div>
          </div>

          {/* QC Inspection & Material Balancing Form */}
          <div className="lg:col-span-6 flex flex-col gap-3">
            {activeJob ? (
              <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs p-4 flex flex-col gap-3">
                <div id="qc-panel" className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--border-color)]">
                  <span className="font-bold text-[14px] flex min-w-[12rem] flex-1 items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>ตรวจคุณภาพหลังแปรรูป (QC)</span>
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-purple-400 font-bold">{activeJob.jobNumber}</span>
                    <button type="button" onClick={() => (jobOrderLink(activeJob).booking ? setPrintJobId(activeJob.id) : window.print())} className="inline-flex items-center gap-1 rounded bg-purple-600 px-2.5 py-1.5 text-[10px] font-bold text-white"><Printer className="h-3.5 w-3.5" />พิมพ์ใบแปรรูป / บันทึก PDF</button>
                  </div>
                </div>

                {activeJob.status === 'PENDING' && <RoleStepHint roles={['crane_operator']} action="เริ่มงานแปรรูป (05 → 06)" />}
                {activeJob.status === 'IN_PROCESS' && !activeJob.physicalReceiptConfirmed && <RoleStepHint roles={['crane_operator']} action="ยืนยันรับสินค้าเข้าเครื่อง" />}
                {activeJob.status === 'IN_PROCESS' && activeJob.physicalReceiptConfirmed && <RoleStepHint roles={['crane_operator']} action="กดแปรรูปเสร็จ · ส่งตรวจคุณภาพ" />}
                {activeJob.status === 'QC_INSPECTION' && <RoleStepHint roles={['qc_inspector']} action="ตรวจชิ้นงานหลังแปรรูปและบันทึกผล QC" />}
                {activeJob.status === 'IN_PROCESS' && <p className="rounded bg-sky-500/10 px-2 py-1.5 text-[11px] text-sky-200">ฟอร์ม QC จะเปิดหลังผู้ปฏิบัติงานกด “แปรรูปเสร็จ · ส่งตรวจคุณภาพ”</p>}
                <p className="text-[10px] text-[var(--text-secondary)]">งานจากใบเสนอราคาพิมพ์ตามแม่แบบ “ใบเบิกสินค้าเพื่อผลิตหรือแปรรูป”</p>


                {activeJob.status === 'QC_INSPECTION' && (
                  <div className="rounded-lg border-2 border-emerald-500/40 bg-emerald-500/5 p-3 text-[12px]">
                    <div className="font-bold text-emerald-300">กรอกผลตรวจคุณภาพ · ล็อต {activeJob.inputLotId} · {activeJob.inputQtyTons.toFixed(3)} ตัน</div>
                    <div className="mt-1 text-[11px] text-[var(--text-secondary)]">แปรรูปเสร็จเมื่อ {activeJob.processingFinishedAt || '—'} · ผู้ตรวจตรวจชิ้นงานจริงทุกข้อ แล้วกรอกน้ำหนักผ่าน / ไม่ผ่าน / เศษ</div>
                    <div className="mt-2 grid gap-1 sm:grid-cols-2">
                      {QC_INSPECTION_CHECKS.map((label, index) => (
                        <label key={label} className="flex items-center gap-2 text-[11.5px]">
                          <input type="checkbox" checked={qcChecks[index] || false} disabled={currentRole !== 'qc_inspector'} onChange={(event) => setQcChecks((current) => QC_INSPECTION_CHECKS.map((_, position) => (position === index ? event.target.checked : current[position] || false)))} />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {activeJob.status === 'PENDING' && <p className="rounded bg-[var(--bg-shell)] px-2 py-1.5 text-[11px] text-[var(--text-secondary)]">ยังไม่เริ่มแปรรูป · ฟอร์ม QC จะเปิดหลังแปรรูปเสร็จ</p>}
                {activeJob.status === 'COMPLETED' && <p className="rounded bg-emerald-500/10 px-2 py-1.5 text-[11px] text-emerald-200">ตรวจแล้ว · ผ่าน {activeJob.outputQtyTons.toFixed(3)} ตัน · ไม่ผ่าน {(activeJob.failQtyTons || 0).toFixed(3)} ตัน · เศษ {activeJob.scrapQtyTons.toFixed(3)} ตัน{activeJob.qcInspectionNotes ? ` · ${activeJob.qcInspectionNotes}` : ''}</p>}
                {activeJob.status === 'QC_INSPECTION' && <div className="flex flex-col gap-2.5 text-[12px]">
                  <div>
                    <label className="text-[11.5px] font-bold text-emerald-400">
                      ยอดที่ผ่านการตรวจคุณภาพ (ตัน) → {activeJob.linkedSoNumber ? '[04] คงการจองตาม SO' : '[02] สินค้าพร้อมเสนอขาย'}:
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={qcPassQty}
                      onChange={(e) => setQcPassQty(parseFloat(e.target.value) || 0)}
                      disabled={currentRole !== 'qc_inspector' || activeJob.status !== 'QC_INSPECTION'}
                      className="w-full mt-1 p-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg font-mono text-[14px] text-emerald-400 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11.5px] font-bold text-rose-400">
                      ยอดที่ไม่ผ่าน / ของเสีย (ตัน) → เข้า [07] สินค้าที่ไม่ผ่าน/ของเสีย:
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={qcFailQty}
                      onChange={(e) => setQcFailQty(parseFloat(e.target.value) || 0)}
                      disabled={currentRole !== 'qc_inspector' || activeJob.status !== 'QC_INSPECTION'}
                      className="w-full mt-1 p-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg font-mono text-[14px] text-rose-400 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11.5px] font-bold text-slate-400">
                      เศษเหล็กจากการตัด (ตัน):
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={qcScrapQty}
                      onChange={(e) => setQcScrapQty(parseFloat(e.target.value) || 0)}
                      disabled={currentRole !== 'qc_inspector' || activeJob.status !== 'QC_INSPECTION'}
                      className="w-full mt-1 p-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg font-mono text-[14px] text-slate-300 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11.5px] font-bold text-[var(--text-secondary)]">
                      บันทึกผลตรวจคุณภาพ:
                    </label>
                    <textarea
                      rows={2}
                      value={qcNotes}
                      onChange={(e) => setQcNotes(e.target.value)}
                      disabled={currentRole !== 'qc_inspector' || activeJob.status !== 'QC_INSPECTION'}
                      className="w-full mt-1 p-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg text-[12px]"
                    />
                  </div>

                  <div className="p-2 rounded bg-[var(--bg-shell)] border border-[var(--border-color)] flex items-center justify-between font-mono text-[12px]">
                    <span className="text-[var(--text-secondary)]">ยอดรวมคำนวณ:</span>
                    <span
                      className={`font-bold ${
                        !qcBalanced
                          ? 'text-rose-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {qcTotalQty.toFixed(3)} / {activeJob.inputQtyTons.toFixed(3)} T {qcBalanced ? '· สมดุล' : `· ขาด/เกิน ${(activeJob.inputQtyTons - qcTotalQty).toFixed(3)} T`}
                    </span>
                  </div>

                  <button
                    onClick={handleFinishQC}
                    disabled={!qcCanSubmit}
                    className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[12.5px] shadow-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>บันทึกผลตรวจคุณภาพและปรับสถานะสต็อก</span>
                  </button>
                </div>}
                <details className="p-2.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-200 text-[11.5px] leading-relaxed">
                  <summary className="cursor-pointer font-bold">กฎการกระจายสถานะหลัง QC</summary>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    <li>ยอดที่ผ่านการตรวจคุณภาพจะ {activeJob.linkedSoNumber ? <>คงการจองตาม SO ที่ <strong className="text-indigo-300">[04] สินค้าจองตามใบสั่งขาย</strong></> : <>คืนเข้า <strong className="text-emerald-400">[02] สินค้าพร้อมเสนอขาย</strong></>}</li>
                    <li>ยอดที่ไม่ผ่านเกณฑ์จะย้ายไป <strong className="text-rose-400">[07] สินค้าที่ไม่ผ่าน/ของเสีย</strong></li>
                    <li>เศษเหล็กจากการตัดจะถูกบันทึกเป็นยอดสูญเสีย</li>
                    <li>ยอดรวม (ผ่าน + ไม่ผ่าน + เศษเหล็ก) ต้องเท่ากับยอดเข้า ({activeJob.inputQtyTons} ตัน) จึงปิดงานได้</li>
                    <li>พนักงานลานเริ่มงานและรับสินค้าเข้าเครื่อง; ผู้ตรวจคุณภาพบันทึกผลหลังรับเข้าจริง</li>
                  </ul>
                </details>
              </div>
            ) : (
              <div className="p-6 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] text-center text-[var(--text-secondary)]">
                เลือกใบสั่งงานแปรรูปเพื่อตรวจคุณภาพ
              </div>
            )}
          </div>
        </div>
      )}

      {(() => {
        const job = processingJobs.find((entry) => entry.id === printJobId);
        const link = job ? jobOrderLink(job) : undefined;
        const item = link?.booking ? inventory.find((stock) => stock.id === link.booking!.lotId) : undefined;
        return job && link?.booking && link.group && item
          ? <RequisitionPrintModal kind="PROCESSING" booking={link.booking} item={item} group={link.group} job={job} task={link.task} onClose={() => setPrintJobId(null)} />
          : null;
      })()}

      {/* TAB 4: Nonconforming [07] & Customer Claim [11] */}
      {activeTab === 'claim' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {/* Section 1: [07] Nonconforming Products */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-rose-500/30 shadow-xs p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-rose-500/20">
              <div className="flex items-center gap-2 text-rose-400 font-bold">
                <AlertTriangle className="w-4 h-4" />
                <span>[07] สินค้าที่ไม่ผ่านเกณฑ์หรือของเสีย</span>
              </div>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                {inventory.filter((i) => i.canonicalStatus === '07').length} รายการ
              </span>
            </div>

            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-[11.5px] text-rose-200">
              <strong>นโยบาย WMS:</strong> [07] สินค้าที่ไม่ผ่าน/ของเสีย ถูกกักกันในลานพิเศษ ห้ามโอนกลับเข้า [02] สินค้าพร้อมเสนอขายโดยตรง ต้องเปิดใบสั่งงานแปรรูปหรือขายเป็นเศษเหล็กเท่านั้น
            </div>

            <div className="divide-y divide-[var(--border-color)]">
              {inventory
                .filter((i) => i.canonicalStatus === '07')
                .map((item) => {
                  return (
                  <div key={item.id} className="py-2.5 flex flex-col gap-1 text-[12px]">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-rose-400">{item.id}</span>
                      <span className="font-mono font-bold text-[13px]">{item.totalWeightTons} ตัน</span>
                    </div>
                    <div className="text-[var(--text-primary)] font-medium">{productNameThai(item.productName)}</div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      พิกัดกักกัน: {item.locationBay.replaceAll('Bay ', 'ช่อง ')} • สาเหตุ: {item.exclusionReason || 'ไม่ผ่านเกณฑ์ตรวจคุณภาพ'}
                    </div>
                  </div>
                  );
                })}
              {inventory.filter((i) => i.canonicalStatus === '07').length === 0 && (
                <div className="py-4 text-center text-slate-400 text-[12px]">
                  ไม่มีสินค้าคงค้างในสถานะ [07]
                </div>
              )}
            </div>
          </div>

          {/* Section 2: [11] Claim / Return Pending */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-rose-500/30 shadow-xs p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-rose-500/20">
              <div className="flex items-center gap-2 text-rose-400 font-bold">
                <ShieldAlert className="w-4 h-4" />
                <span>[11] สินค้ารอตรวจสอบเคลมหรือส่งคืน</span>
              </div>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                {inventory.filter((i) => i.canonicalStatus === '11').length} รายการ
              </span>
            </div>

            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-[11.5px] text-rose-200">
              <strong>ข้อกำหนดส่วน 4.8:</strong> เปิด [11] สินค้ารอการตรวจสอบเคลมหรือส่งคืน ได้เฉพาะสินค้าที่ผ่าน [10] สินค้าส่งมอบแล้ว และ <strong>ไม่มีการคืนยอดเข้า [02] สินค้าพร้อมเสนอขายอัตโนมัติ</strong>
            </div>

            <div className="divide-y divide-[var(--border-color)]">
              {inventory
                .filter((i) => i.canonicalStatus === '11')
                .map((item) => {
                  const claimTask = pickTasks.find((task) => task.claimInventoryItemIds?.includes(item.id));
                  return (
                  <div key={item.id} className="py-2.5 flex flex-col gap-1 text-[12px]">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-rose-400">{item.id}</span>
                      <span className="font-mono font-bold text-[13px]">{item.totalWeightTons} ตัน</span>
                    </div>
                    <div className="text-[var(--text-primary)] font-medium">{productNameThai(item.productName)}</div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      พิกัด/ที่อยู่ปัจจุบัน: {item.locationBay} • สถานะสินค้า: [11] สินค้ารอการตรวจสอบเคลมหรือส่งคืน
                    </div>
                    {claimTask && <div className="text-[10.5px] text-[var(--text-secondary)]">อ้างอิง {claimTask.pickNumber} · SO {claimTask.soNumber} · เคลม {claimTask.claimQtyTons?.toFixed(3) || item.totalWeightTons.toFixed(3)} ตัน · {claimTask.claimReason || item.damageNote || 'ไม่มีรายละเอียดเหตุผล'}</div>}
                    <div className="text-[10px] text-amber-300">ยังไม่ใช่การรับคืนเข้าคลัง · ห้ามคืนเป็นพร้อมเสนอขายจนกว่าจะรับเข้า ตรวจคุณภาพ และอนุมัติ</div>
                  </div>
                  );
                })}
              {inventory.filter((i) => i.canonicalStatus === '11').length === 0 && (
                <div className="py-4 text-center text-slate-400 text-[12px]">
                  ไม่มีสินค้าคงค้างในสถานะ [11]
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Immutable History (Full Audit Trail) */}
      {activeTab === 'history' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs p-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
            <div>
              <h2 className="text-[15px] font-bold">ประวัติและเหตุการณ์ทั้งหมด</h2>
              <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                เก็บบันทึก Transaction, Correlation ID, Actor, Trigger, Payload ครบถ้วน
              </span>
            </div>

            {/* Filter by boundary */}
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="history-boundary-filter">กรองขอบเขตระบบ</label>
              <select
                id="history-boundary-filter"
                value={historyBoundaryFilter}
                onChange={(e) => setHistoryBoundaryFilter(e.target.value)}
                className="p-1 rounded bg-[var(--input-bg)] border border-[var(--border-color)] font-mono text-[11px]"
              >
                <option value="ALL">ทั้งหมด</option>
                <option value="SYSTEM_ONE">ระบบหน้าบ้าน</option>
                <option value="WMS">ระบบคลังสินค้า</option>
                <option value="LOGISTICS">ระบบขนส่ง</option>
                <option value="YARD">ลานเหล็ก</option>
              </select>

              <label className="sr-only" htmlFor="history-event-filter">กรองประเภทเหตุการณ์</label>
              <select id="history-event-filter" value={historyEventTypeFilter} onChange={(event) => setHistoryEventTypeFilter(event.target.value as typeof historyEventTypeFilter)} className="p-1.5 rounded bg-[var(--input-bg)] border border-[var(--border-color)] text-[11px]">
                <option value="ALL">ทุกเหตุการณ์</option>
                <option value="MOVEMENT">การย้าย</option>
                <option value="STATUS">การเปลี่ยนสถานะ</option>
                <option value="INTEGRATION">การเชื่อมต่อ</option>
              </select>

              <input
                type="text"
                placeholder="ค้นหารหัส ล็อต เวลา หรือแหล่งที่มา..."
                aria-label="ค้นหารหัส ล็อต เวลา แหล่งที่มา หรือเหตุการณ์"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="p-1 px-2 rounded bg-[var(--input-bg)] border border-[var(--border-color)] text-[11px] w-36"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
            <table className="w-full text-left text-[12.5px] border-collapse">
              <thead className="bg-[var(--table-header)] text-[var(--text-secondary)] font-mono text-[11px] border-b border-[var(--border-color)]">
                <tr>
                  <th className="py-2.5 px-3">เลขเหตุการณ์และเวลา</th>
                  <th className="py-2.5 px-3">รหัสล็อตและสเปกสินค้า</th>
                  <th className="py-2.5 px-3 text-right">น้ำหนัก</th>
                  <th className="py-2.5 px-3">การเปลี่ยนสถานะ</th>
                  <th className="py-2.5 px-3">เหตุการณ์และเหตุผล</th>
                  <th className="py-2.5 px-3">ระบบและผู้ดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {filteredHistory.map((evt) => (
                  <tr key={evt.id} className="hover:bg-[var(--bg-shell)] transition-colors">
                    <td className="py-2.5 px-3 font-mono">
                  <div className="font-bold text-blue-400">{evt.id}</div>
                  <div className="text-[10.5px] text-[var(--text-secondary)]">{evt.timestamp}</div>
                      <div className="text-[10px] text-slate-400">Corr: {evt.correlationId}</div>
                      <div className="text-[10px] text-slate-400">v{evt.version} · {evt.transportAck || evt.businessAck ? 'ACK' : 'รอตรวจ ACK'}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-[var(--text-primary)]">{evt.productSpec}</div>
                      <div className="font-mono text-[11px] text-blue-400">ล็อต: {evt.lotId}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-400">
                      {evt.qtyTons.toFixed(3)} {evt.uom}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      <div className="flex items-center gap-1">
                        <span className="text-[var(--text-secondary)]">{evt.fromStatus}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="text-blue-400 font-bold">{evt.toStatus}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-[11.5px]">
                      <div className="font-semibold text-[var(--text-primary)]">{evt.trigger}</div>
                      <div className="text-[var(--text-secondary)] mt-0.5">{evt.reason}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      <span className="font-bold text-emerald-400">{evt.boundary}</span>
                      <div className="text-[10.5px] text-[var(--text-secondary)] font-sans">{evt.actor}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredHistory.length === 0 && <div className="py-8 text-center text-[12px] text-[var(--text-secondary)]">ไม่พบเหตุการณ์ตามตัวกรองที่เลือก</div>}
        </div>
      )}

      {activeJob && activeJobItem && createPortal(
        <section className="wms-pick-print-sheet">
          <div className="wms-pick-print-content">
            <header className="wms-pick-print-header">
              <div><strong>บริษัท ไทยทวีพรค้าเหล็ก จำกัด (TTS)</strong><div>ใบสั่งงานแปรรูปสินค้า · WMS-11</div></div>
              <div className="wms-pick-print-number">{activeJob.jobNumber}</div>
            </header>
            <div className="wms-pick-print-meta">
              <div><span>เลขที่ Approved SO</span><strong>{activeJob.linkedSoNumber || '—'}</strong></div>
              <div><span>วันเตรียม / วันส่ง</span><strong>{jobPreparationDate} / {jobDeliveryDate}</strong></div>
              <div><span>วันที่ออกใบงาน</span><strong>{activeJob.createdAt}</strong></div>
              <div><span>ประตูเตรียมส่ง</span><strong>{jobStagingGate}</strong></div>
            </div>
            <h2>รายการสินค้าและกระบวนการ</h2>
            <table className="wms-pick-print-table">
              <thead><tr><th>สินค้า / สเปก</th><th>ล็อตวัตถุดิบ / เลขหลอม</th><th>ตำแหน่งพบ</th><th>จำนวนแปรรูป</th><th>กระบวนการ / เครื่องจักร</th></tr></thead>
              <tbody><tr>
                <td>{activeJobItem.productName}<br /><small>{activeJobItem.dimensions}</small></td>
                <td>{activeJob.inputLotId}<br /><small>เลขหลอม: {activeJobItem.heatNumber || '—'}</small></td>
                <td>{activeJobItem.locationBay}</td>
                <td>{activeJob.inputQtyTons.toFixed(3)} ตัน</td>
                <td>{activeJob.jobType}<br /><small>{activeJob.machine}</small></td>
              </tr></tbody>
            </table>
            <div className="wms-pick-print-instructions"><strong>ข้อปฏิบัติ</strong><ol><li>ตรวจล็อต เลขหลอม สเปก และปริมาณก่อนเริ่มงาน</li><li>บันทึกผลผ่าน ไม่ผ่าน และเศษเหล็กให้รวมเท่ากับปริมาณตั้งต้น</li><li>งานตาม Approved SO ต้องคงยอดที่ผ่านไว้ใน [04] และห้ามคืนเข้า [02]</li></ol></div>
            <div className="wms-pick-print-fields"><div>ผลผ่าน: __________________ ตัน · ผลไม่ผ่าน: __________________ ตัน · เศษเหล็ก: __________________ ตัน</div><div>หมายเหตุ: __________________________________________________________</div></div>
            <footer className="wms-pick-print-signatures"><div>ผู้ปฏิบัติงาน / วันที่<br /><br />____________________________</div><div>ผู้ตรวจสอบคุณภาพ / วันที่<br /><br />____________________________</div></footer>
            <small className="wms-pick-print-footer">เอกสารจำลองชั่วคราว · ปรับตามแม่แบบจริงเมื่อได้รับเอกสารต้นแบบ · การพิมพ์ไม่เปลี่ยนสถานะสินค้า</small>
          </div>
        </section>,
        document.body
      )}
    </div>
  );
};
