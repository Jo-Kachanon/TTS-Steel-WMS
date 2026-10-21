import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWms } from '../../context/WmsContext';
import { RequisitionPrintModal } from './booking/RequisitionPrintModal';
import { OrderPreparationPanel } from './booking/OrderPreparationPanel';
import { stagingDueDate } from '../../context/bookingWork';
import { StatusBadge } from '../common/StatusBadge';
import { PickTaskState, PickTask, USER_ROLES } from '../../types/wms';
import {
  Truck,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Play,
  Check,
  RotateCcw,
  Send,
  ShieldCheck,
  FileCheck,
  Building,
  User,
  Clock,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  MapPin,
  AlertOctagon,
  Printer,
} from 'lucide-react';

/** Crane / yard operators the manager can assign (mock roster; first entry is the demo crane operator role). */
const PICK_OPERATORS = [USER_ROLES.crane_operator.name, 'มานพ ช.', 'ประเสริฐ ก.'];

export const Wms06Picking: React.FC = () => {
  const {
    pickTasks,
    inventory,
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
    replacementProposals,
    managerApproveReplacementHoldToReserved,
    createPickTaskForReplacement,
    navigateToWorkspace,
    currentRole,
    stockBookings,
    stockBookingGroups,
    processingJobs,
    workTypeConfigs,
  } = useWms();
  const [printTaskId, setPrintTaskId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  const [selectedTaskId, setSelectedTaskId] = useState<string>(pickTasks[0]?.id || '');
  const [pickPage, setPickPage] = useState<'pick_slip' | 'pick_results' | 'manager_delivery'>('pick_slip');
  const [filterState, setFilterState] = useState<string>('ALL');
  const [assigneeInput, setAssigneeInput] = useState(pickTasks[0]?.operator || PICK_OPERATORS[0]);
  const [pickActualQty, setPickActualQty] = useState<number>(pickTasks[0]?.allocatedQtyTons || 0);
  const [pickupQty, setPickupQty] = useState<number>(pickTasks[0]?.allocatedQtyTons || 0);
  const [stagingZoneEdit, setStagingZoneEdit] = useState<string>('G1');

  // Damage exception modal state
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [damagedQty, setDamagedQty] = useState<number>(15.0);
  const [damageReason, setDamageReason] = useState<string>(
    'พบรอยบิดงอที่ปลายท่อนเหล็ก 3 ท่อนขณะยกออกจากช่องจัดเก็บ ระงับการหยิบทันที'
  );

  // Logistics Handover simulation state
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [driverName, setDriverName] = useState('สมชาย ขับดี');
  const [truckPlate, setTruckPlate] = useState('รถพ่วง 22 ล้อ ทะเบียน 70-8812');

  // Claim modal state
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimQty, setClaimQty] = useState<number>(2.84);
  const [claimReason, setClaimReason] = useState<string>('ลูกค้าแจ้งพบสนิมขุมลึกเกินเกณฑ์มาตรฐาน ณ ไซต์งาน');
  const pickTaskStateThai: Record<string, string> = {
    queued: 'รอมอบหมาย', assigned: 'มอบหมายแล้ว', picking: 'กำลังหยิบ', picked: 'หยิบแล้ว',
    qc_packing: 'ตรวจคุณภาพและจัดชุด', staged: 'วางพื้นที่รอส่งมอบ', ready: 'พร้อมส่งมอบ',
    partial_exception: 'พบข้อยกเว้นบางส่วน', exception: 'พบข้อยกเว้น',
  };
  const productSpecThai = (spec: string) => spec
    .replaceAll('H-Beam', 'เหล็กเอชบีม')
    .replaceAll('Wide Flange', 'เหล็กไวด์แฟลงก์')
    .replaceAll('Hot Rolled Coil', 'เหล็กม้วนรีดร้อน')
    .replaceAll('mm', 'มม.')
    .replace(/(\d)M\b/g, '$1 ม.');
  const locationThai = (location: string) => location.replaceAll('Bay ', 'ช่อง ');
  const customerNameThai = (name: string) => name.replace(/\s*\([^)]*[A-Za-z][^)]*\)/g, '').trim();

  const activeTask = pickTasks.find((t) => t.id === selectedTaskId) || pickTasks[0];
  // The gate is owned by the Logistics App; the pick page only mirrors it.
  useEffect(() => {
    if (activeTask?.stagingGate) setStagingZoneEdit(activeTask.stagingGate);
  }, [activeTask?.id, activeTask?.stagingGate]);
  const linkedItem = inventory.find((it) => it.id === activeTask?.lotId);
  const legacyTransitIds = activeTask?.manifestNumber && ['09', '10', '11'].includes(linkedItem?.canonicalStatus || '') ? [activeTask.lotId] : [];
  const transitIds = activeTask?.transitInventoryItemIds?.length ? activeTask.transitInventoryItemIds : legacyTransitIds;
  const linkedTransitItems = inventory.filter((item) => transitIds.includes(item.id) || activeTask?.claimInventoryItemIds?.includes(item.id));
  const inTransitItems = linkedTransitItems.filter((item) => item.canonicalStatus === '09');
  const deliveredItems = linkedTransitItems.filter((item) => item.canonicalStatus === '10');
  const claimedItems = linkedTransitItems.filter((item) => item.canonicalStatus === '11');
  const legacyPickedUpQty = legacyTransitIds.length ? activeTask?.allocatedQtyTons || 0 : 0;
  const pickedUpQtyTons = activeTask?.pickedUpQtyTons ?? legacyPickedUpQty;
  const readyQtyTons = Math.max(0, (activeTask?.allocatedQtyTons || 0) - pickedUpQtyTons);
  const displayedInventoryStatus = inTransitItems[0]?.canonicalStatus || claimedItems[0]?.canonicalStatus || deliveredItems[0]?.canonicalStatus || linkedItem?.canonicalStatus || '04';
  const pickChecklistComplete = activeTask ? Object.values(activeTask.qcChecklist).every(Boolean) : false;
  // Quotation orders: items are picked one by one, then prepared and confirmed together in the order panel.
  const activeTaskInOrder = Boolean(activeTask && stockBookings.some((booking) => booking.lotId === activeTask.lotId && booking.approvedSoReference === activeTask.soNumber));
  const canContinueToManager = Boolean(
    activeTask &&
    activeTask.state === 'staged' &&
    activeTask.actualPickedQtyTons >= activeTask.allocatedQtyTons - 0.001 &&
    activeTask.remainingQtyTons <= 0.001 &&
    pickChecklistComplete
  );
  const nextActorRole = !activeTask
    ? null
    : activeTask.readinessConfirmed
      ? 'logistics_clerk'
      : activeTask.state === 'queued' || activeTask.state === 'staged' || activeTask.state === 'partial_exception'
        ? 'warehouse_manager'
        : 'crane_operator';

  const managerQueueCount = pickTasks.filter((task) => task.state === 'queued').length;
  const managerReviewCount = pickTasks.filter((task) => task.state === 'staged' && !task.readinessConfirmed).length;
  const managerExceptionCount = pickTasks.filter((task) => task.state === 'partial_exception').length;
  const managerReadyCount = pickTasks.filter((task) => task.readinessConfirmed).length;
  const stageChecklistItems: { key: keyof PickTask['qcChecklist']; label: string }[] = activeTask?.state === 'picking'
    ? [
        { key: 'specTagMatches', label: 'ป้ายสินค้า/เกรด/สเปกตรงกับ SO' },
        { key: 'gaugeToleranceOk', label: 'ขนาดและค่าคลาดเคลื่อนผ่าน' },
      ]
    : activeTask?.state === 'qc_packing'
      ? [
          { key: 'strappingSecure', label: 'รัดมัดสินค้าแน่นหนาและปลอดภัย' },
          { key: 'doDocsPrepared', label: 'เอกสารส่งมอบและป้ายกำกับครบ' },
          { key: 'designatedZonePlaced', label: 'ยืนยันจำนวนและพิกัดพื้นที่รอส่งมอบที่วางจริง' },
        ]
      : [];
  const stageGuide = activeTask ? ({
    queued: {
      label: 'รอมอบหมายงาน', owner: 'ผู้จัดการคลัง',
      instruction: 'ตรวจใบสั่งขายและการชำระเงิน ล็อตสถานะ [04] จำนวน และตำแหน่งก่อนเลือกผู้หยิบและออกงาน',
      checks: ['SO และรายการสินค้าตรงกัน', 'สถานะสินค้าเป็น [04] และยอดจองครอบคลุมงาน', 'เลือกผู้ปฏิบัติงานและตรวจพิกัดหยิบ'],
    },
    assigned: {
      label: 'มอบหมายแล้ว · รอเริ่มหยิบ', owner: 'ผู้หยิบ',
      instruction: 'ก่อนเริ่มงาน ให้ตรวจอุปกรณ์ป้องกัน อุปกรณ์ยก และทางเดิน แล้วเทียบใบหยิบกับป้ายล็อต เลขหลอม และตำแหน่งจริง',
      checks: ['ยืนยันล็อตและเลขหลอมให้ตรงใบหยิบ', 'ตรวจสภาพมัดสินค้าและทางเข้าถึงช่องจัดเก็บ', 'หากไม่ตรงให้หยุดและแจ้งผู้จัดการคลัง ห้ามสลับล็อตเอง'],
    },
    picking: {
      label: 'กำลังหยิบ', owner: 'ผู้หยิบ',
      instruction: 'สแกนล็อตก่อนยก แยกหยิบตามจำนวนที่จัดสรร และบันทึกน้ำหนักจริง หากพบของเสียหรือจำนวนไม่ตรงให้หยุดทันที',
      checks: ['ป้ายสินค้า/เกรด/สเปกตรงกับ SO', 'ตรวจขนาดและค่าคลาดเคลื่อน', 'ชั่งหรือยืนยันจำนวนจริง ห้ามเกินยอดจัดสรร'],
    },
    picked: {
      label: 'หยิบแล้ว · รอตรวจและจัดชุด', owner: 'ผู้หยิบ',
      instruction: 'ตรวจยอดที่บันทึกเทียบใบหยิบ แยกยอดขาด/เสียเป็น exception แล้วตรวจมัดสินค้าและเตรียมเอกสารก่อนจัดชุด',
      checks: ['ยอดจริงต้องตรงหรือระบุยอดขาดพร้อมเหตุผล', 'ห้ามรวมสินค้าคนละล็อตโดยไม่บันทึกแยก', 'ส่งตรวจคุณภาพและจัดชุดเมื่อยอดผ่านการตรวจ'],
    },
    qc_packing: {
      label: 'ตรวจคุณภาพและจัดชุด', owner: 'ผู้หยิบ · ผู้จัดการคลังตรวจทาน',
      instruction: 'ยืนยันความแน่นของสายรัดและป้ายสเปก เตรียมเอกสาร แล้วเคลื่อนย้ายไปยังพื้นที่รอส่งมอบที่กำหนด พร้อมบันทึกการวางจริง',
      checks: ['สายรัดและมัดสินค้าแน่นปลอดภัย', 'เอกสารส่งมอบและป้ายกำกับครบ', 'ยืนยันพิกัดและจำนวนที่วางในพื้นที่รอส่งมอบ'],
    },
    staged: {
      label: 'วางพื้นที่รอส่งมอบ · รอผู้จัดการตรวจ', owner: 'ผู้จัดการคลัง',
      instruction: 'ตรวจสินค้ากับใบหยิบ จำนวนจริง สภาพ เอกสาร และพิกัดพื้นที่รอส่งมอบก่อนยืนยัน [08] การยืนยันนี้ยังไม่ตัดยอดสต็อก',
      checks: ['ยอดหยิบครบและไม่มีจำนวนค้าง', 'ตรวจสภาพ/เอกสาร/พิกัดหน้างาน', 'ยืนยัน readiness เฉพาะจำนวนที่วางจริง'],
    },
    ready: {
      label: 'พร้อมส่งมอบ [08]', owner: 'เจ้าหน้าที่ขนส่งรับช่วงต่อ',
      instruction: 'คลังคงสถานะพร้อมส่งจนได้รับผลยืนยันรับขึ้นรถจากระบบขนส่ง การรับขึ้นรถที่ยืนยันแล้วเท่านั้นจึงเปลี่ยนเป็น [09]',
      checks: ['ตรวจการตอบรับจากระบบขนส่งและเลขอ้างอิงรับขึ้นรถ', 'รับขึ้นรถได้บางส่วนตามจำนวนพร้อมส่ง', 'ส่งมอบไม่สำเร็จให้คง [09] และเปิดงานติดตาม'],
    },
    partial_exception: {
      label: 'ข้อยกเว้น · รอผู้จัดการจัดการ', owner: 'ผู้จัดการคลัง',
      instruction: 'ระงับเฉพาะจำนวนที่ขาดหรือเสีย คงยอดส่วนที่ใช้ได้ตามสถานะเดิม และกำหนดเจ้าของ/ทางแก้ก่อนทำงานต่อ',
      checks: ['ตรวจจำนวนผลกระทบและหลักฐาน', 'ของเสียส่ง WMS-11; ของทดแทนส่ง WMS-05', 'ห้ามยืนยันพร้อมส่งขณะที่ยังมี unresolved quantity'],
    },
  })[activeTask.state] : null;

  const filteredTasks = pickTasks.filter((t) => {
    if (filterState === 'ALL') return true;
    if (filterState === 'ACTIVE') return t.state !== 'ready' && t.state !== 'partial_exception';
    if (filterState === 'EXCEPTION') return t.state === 'partial_exception';
    if (filterState === 'READY') return t.state === 'ready';
    return t.state === filterState;
  });

  // One order (quotation / SO) can mix finished lots (picked now) and processed lots (picked after QC passes).
  const orderKeys = [...new Set(filteredTasks.map((task) => task.soNumber))];
  const bookingGroupForOrder = (soNumber: string) => {
    const booking = stockBookings.find((entry) => entry.approvedSoReference === soNumber);
    return booking ? stockBookingGroups.find((group) => group.id === booking.groupId) : undefined;
  };
  const processingLinesForOrder = (soNumber: string) => stockBookings
    .filter((booking) => booking.approvedSoReference === soNumber && booking.status === 'RESERVED')
    .map((booking) => ({ booking, item: inventory.find((stock) => stock.id === booking.lotId) }))
    .filter(({ booking, item }) => item
      && workTypeConfigs.find((config) => config.sku === item.productCode)?.workType === 'PROCESSING'
      && !pickTasks.some((task) => task.lotId === booking.lotId && task.soNumber === soNumber))
    .map(({ booking, item }) => ({ booking, item: item!, job: processingJobs.find((job) => job.inputLotId === booking.lotId && job.linkedSoNumber === soNumber) }));
  const ordersWithProcessingOnly = filterState === 'ALL' || filterState === 'ACTIVE'
    ? [...new Set(stockBookings.filter((booking) => booking.status === 'RESERVED' && booking.approvedSoReference).map((booking) => booking.approvedSoReference!))]
      .filter((soNumber) => !orderKeys.includes(soNumber) && processingLinesForOrder(soNumber).length > 0)
    : [];
  const printTask = pickTasks.find((task) => task.id === printTaskId);
  const printBooking = printTask ? stockBookings.find((booking) => booking.lotId === printTask.lotId && booking.approvedSoReference === printTask.soNumber) : undefined;
  const printGroup = printBooking ? stockBookingGroups.find((group) => group.id === printBooking.groupId) : undefined;
  const printItem = printTask ? inventory.find((stock) => stock.id === printTask.lotId) : undefined;

  const handleStepForward = (task: PickTask) => {
    if (task.state === 'assigned') {
      updatePickTaskStatus(task.id, 'picking');
    } else if (task.state === 'picking') {
      updatePickTaskStatus(task.id, 'picked', undefined, pickActualQty);
    } else if (task.state === 'picked') {
      updatePickTaskStatus(task.id, 'qc_packing');
    } else if (task.state === 'qc_packing') {
      updatePickTaskStatus(task.id, 'staged', `จัดวางเข้าพิกัด ${task.stagingGate} และตรวจรายการครบแล้ว`);
    }
  };

  const handleConfirmDamage = () => {
    if (!activeTask) return;
    if (reportDamagedStockInPicking(activeTask.id, damagedQty, damageReason)) setShowDamageModal(false);
  };

  const handleConfirmHandover = () => {
    if (!activeTask) return;
    if (simulateLogisticsHandoverLGX03(activeTask.id, driverName, truckPlate, pickupQty)) {
      setShowHandoverModal(false);
    }
  };

  const handleConfirmClaim = () => {
    if (!activeTask) return;
    if (simulateCustomerClaimLGX06(activeTask.id, claimQty, claimReason)) setShowClaimModal(false);
  };

  return (
    <div className="flex flex-col gap-4 text-[var(--text-primary)]">
      {/* Header Banner */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[17px] font-bold">WMS-06 งานหยิบและส่งมอบ</h1>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                  ใบหยิบและส่งมอบ
                </span>
              </div>
              <p className="text-[12px] text-[var(--text-secondary)]">
                ออกใบหยิบจากสถานะ [04] จองตามใบสั่งขาย ควบคุมงานหยิบ วางพื้นที่ส่งมอบ [08] และยืนยันขึ้นรถ [09] (LGX-03)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-shell)] border border-[var(--border-color)] text-[12px] font-mono">
              <span className="text-[var(--text-secondary)]">งานหยิบทั้งหมด:</span>
              <span className="font-bold text-blue-400">{pickTasks.length} รายการ</span>
            </div>
          </div>
        </div>

        {/* Filter Strip */}
        <div className="flex items-center gap-1.5 pt-3 overflow-x-auto text-[12.5px]">
          {['ALL', 'ACTIVE', 'staged', 'READY', 'EXCEPTION'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterState(st)}
              className={`px-3 py-1 rounded-lg font-mono font-medium transition-colors ${
                filterState === st
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-shell)]'
              }`}
            >
              {st === 'ALL'
                ? `ทั้งหมด (${pickTasks.length})`
                : st === 'ACTIVE'
                ? 'กำลังหยิบ / ตรวจสอบ'
                : st === 'staged'
                ? 'รอผู้จัดการยืนยันพื้นที่รอส่งมอบ [08]'
                : st === 'READY'
                ? 'พร้อมส่งมอบ [08]'
                : 'พบของชำรุด (ข้อยกเว้น)'}
            </button>
          ))}
        </div>
      </div>

      {currentRole === 'warehouse_manager' && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2" aria-label="สรุปคิวงานผู้จัดการคลัง">
          {[
            { label: 'รอมอบหมาย', count: managerQueueCount, tone: 'text-amber-300' },
            { label: 'รอตรวจพื้นที่ส่งมอบ', count: managerReviewCount, tone: 'text-indigo-300' },
            { label: 'ข้อยกเว้น', count: managerExceptionCount, tone: 'text-rose-300' },
            { label: 'พร้อมส่งมอบ', count: managerReadyCount, tone: 'text-emerald-300' },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2.5 flex items-center justify-between">
              <span className="text-[11.5px] text-[var(--text-secondary)]">{item.label}</span>
              <strong className={`font-mono text-[18px] ${item.tone}`}>{item.count}</strong>
            </div>
          ))}
        </section>
      )}

      {/* Main Grid: Left 5 Cols (Pick Tasks List) + Right 7 Cols (Task Cockpit & Outbound Gating) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Pick Tasks List */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs overflow-hidden flex flex-col">
            <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-shell)] flex items-center justify-between">
              <span className="font-bold text-[13px]">รายการใบสั่งหยิบ</span>
              <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                สถานะงานหยิบแยกจากสถานะสินค้า
              </span>
            </div>

            <div className="divide-y divide-[var(--border-color)] max-h-[600px] overflow-y-auto">
              {[...orderKeys, ...ordersWithProcessingOnly].map((soNumber) => {
                const group = bookingGroupForOrder(soNumber);
                const orderTasks = pickTasks.filter((task) => task.soNumber === soNumber);
                const processingLines = processingLinesForOrder(soNumber);
                const totalLines = orderTasks.length + processingLines.length;
                const readyLines = orderTasks.filter((task) => task.state === 'ready').length;
                return (
                <div key={soNumber}>
                  <div className="px-3 py-2 bg-[var(--bg-shell)] text-[11px] flex flex-wrap items-center justify-between gap-1">
                    <span className="font-bold">ใบสั่ง {soNumber}{group ? ` · ${group.customerName}` : ''}</span>
                    {group && <button onClick={() => setSelectedOrder(soNumber)} className={`rounded px-2 py-0.5 font-bold ${selectedOrder === soNumber ? 'bg-blue-600 text-white' : 'border border-blue-500/50 text-blue-300'}`}>เตรียมส่งทั้งใบสั่ง →</button>}
                    <span className="text-[var(--text-secondary)]">{group?.deliveryDate ? `ส่ง ${group.deliveryDate} · ประตู ${group.stagingGate} · ` : ''}พร้อมส่ง {readyLines}/{totalLines}</span>
                    {group?.deliveryDate && (() => {
                      const due = stagingDueDate(group.deliveryDate);
                      const overdue = readyLines < totalLines && new Date().toISOString().slice(0, 10) > due;
                      return <span className={`w-full font-semibold ${overdue ? 'text-rose-300' : 'text-amber-300'}`}>{overdue ? 'เลยกำหนด · ' : ''}หยิบและแปรรูปให้เสร็จ วางที่ประตู {group.stagingGate} ภายใน {due} (ก่อนวันส่ง 1 วัน)</span>;
                    })()}
                  </div>
                {filteredTasks.filter((task) => task.soNumber === soNumber).map((task) => {
                  const isSelected = activeTask?.id === task.id;
                  return (
                    <div
                      key={task.id}
                      onClick={() => {
                        setSelectedTaskId(task.id);
                        setSelectedOrder(null);
                        setPickPage('pick_slip');
                        setPickActualQty(task.allocatedQtyTons);
                        setPickupQty(task.remainingQtyTons || task.allocatedQtyTons);
                        setStagingZoneEdit(['M2', 'M3', 'G1', 'G2', 'G3'].includes(task.stagingGate) ? task.stagingGate : 'G1');
                        setAssigneeInput(task.operator || PICK_OPERATORS[0]);
                      }}
                      className={`p-3.5 cursor-pointer transition-colors flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-blue-500/10 border-l-4 border-blue-500'
                          : 'hover:bg-[var(--bg-shell)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[13px] text-blue-400">
                            {task.pickNumber}
                          </span>
                          <span className="text-[11px] text-[var(--text-secondary)] font-mono">
                            ใบสั่งขาย: {task.soNumber}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                            task.state === 'ready'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : task.state === 'staged'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : task.state === 'partial_exception'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-slate-500/20 text-slate-300'
                          }`}
                        >
                          {pickTaskStateThai[task.state] || task.state}
                        </span>
                      </div>

                      <div className="font-bold text-[13px] text-[var(--text-primary)] truncate">
                        {customerNameThai(task.customerName)}
                      </div>

                      <div className="text-[12px] text-[var(--text-secondary)] truncate">
                        {productSpecThai(task.productSpec)}
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-[var(--border-color)]/60 text-[var(--text-secondary)]">
                        <span>พิกัด: {locationThai(task.targetBay)}</span>
                        <span className="font-bold text-blue-400">
                          {task.allocatedQtyTons.toFixed(3)} ตัน
                        </span>
                    <span>ล็อต: {task.lotId}</span>
                      </div>
                    </div>
                  );
                })}
                  {processingLines.map(({ booking, item, job }) => (
                    <div key={booking.id} className="p-3.5 flex flex-col gap-1 bg-purple-500/5 border-l-4 border-purple-500/40">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-[13px] text-purple-300">{job?.jobNumber || 'รอออกใบแปรรูป'}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-200">{job?.status === 'COMPLETED' ? 'ผ่าน QC · กำลังออกใบเบิก' : job?.status === 'QC_INSPECTION' ? 'แปรรูปเสร็จ · รอ QC' : job?.status === 'IN_PROCESS' ? 'กำลังแปรรูป' : 'รอแปรรูป'}</span>
                      </div>
                      <div className="text-[12px] text-[var(--text-secondary)]">{productSpecThai(`${item.productName} ${item.dimensions}`)} · {item.totalWeightTons.toFixed(3)} ตัน · ล็อต {item.id}</div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--text-secondary)]">เข้าคิวหยิบในใบสั่งนี้อัตโนมัติเมื่อ QC ผ่าน</span>
                        <button onClick={() => navigateToWorkspace('WMS-07')} className="text-purple-300 underline">เปิดคิวแปรรูป</button>
                      </div>
                    </div>
                  ))}
                </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Active Task Cockpit & Step Progression */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {selectedOrder ? (
            <OrderPreparationPanel
              soNumber={selectedOrder}
              onBack={() => setSelectedOrder(null)}
              onOpenTask={(taskId) => { setSelectedTaskId(taskId); setSelectedOrder(null); setPickPage('pick_results'); }}
            />
          ) : activeTask ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([
                  { id: 'pick_slip', label: '1 · ใบหยิบ', hint: 'พิมพ์ให้พนักงานหยิบ' },
                  { id: 'pick_results', label: '2 · ผลหยิบจริง', hint: 'บันทึกยอดและรายการตรวจสอบ' },
                  { id: 'manager_delivery', label: '3 · ส่งผู้จัดการ', hint: 'ยืนยัน [08] และส่งมอบ' },
                ] as const).map((page) => (
                  <button
                    key={page.id}
                    onClick={() => setPickPage(page.id)}
                    className={`rounded-lg border p-2.5 text-left transition-colors ${pickPage === page.id ? 'bg-blue-600 text-white border-blue-400' : 'bg-[var(--bg-card)] border-[var(--border-color)] hover:border-blue-500'}`}
                  >
                    <span className="block text-[12px] font-bold">{page.label}</span>
                    <span className={`block text-[10.5px] ${pickPage === page.id ? 'text-blue-100' : 'text-[var(--text-secondary)]'}`}>{page.hint}</span>
                  </button>
                ))}
              </div>

              {nextActorRole && activeTask && (
                <div className={`rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                  currentRole === nextActorRole
                    ? 'border-emerald-500/30 bg-emerald-500/10'
                    : 'border-amber-500/40 bg-amber-500/10'
                }`}>
                  <div className="text-[12px]">
                    <strong className={currentRole === nextActorRole ? 'text-emerald-300' : 'text-amber-200'}>
                      ผู้รับผิดชอบขั้นถัดไป: {USER_ROLES[nextActorRole].titleTh}
                    </strong>
                    <span className="block text-[10.5px] text-[var(--text-secondary)] mt-0.5">
                      บทบาทปัจจุบัน: {USER_ROLES[currentRole].titleTh} · เปลี่ยนบทบาทจำลองได้จากเมนูผู้ใช้ด้านบน
                    </span>
                  </div>
                </div>
              )}

              {currentRole === 'warehouse_manager' && activeTask && ['queued', 'assigned'].includes(activeTask.state) && (
                <section className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-3.5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-[12px] font-bold text-indigo-200">แผงควบคุมผู้จัดการคลัง · มอบหมายงานหยิบ</div>
                    <p className="text-[10.5px] text-[var(--text-secondary)] mt-1">
                      {activeTask.state === 'queued' ? 'ตรวจ [04] ใบสั่งขาย และจำนวนก่อนมอบหมาย ผู้หยิบจึงเริ่มงานได้' : 'เปลี่ยนผู้รับงานได้ก่อนเริ่มหยิบหรือสแกนเท่านั้น'}
                    </p>
                  </div>
                  <label className="flex-1 text-[10.5px] text-[var(--text-secondary)]">
                    ผู้รับผิดชอบงาน
                    <select
                      aria-label="ผู้หยิบ / ผู้ควบคุมเครน"
                      value={assigneeInput}
                      onChange={(event) => setAssigneeInput(event.target.value)}
                      className="w-full mt-1 px-2.5 py-2 rounded bg-[var(--input-bg)] border border-[var(--border-color)] text-[12px] text-[var(--text-primary)]"
                    >
                      <option value="">เลือกผู้หยิบ</option>
                      {PICK_OPERATORS.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </label>
                  <button
                    onClick={() => managerAssignPickTask(activeTask.id, assigneeInput)}
                    disabled={!assigneeInput.trim() || (activeTask.state === 'assigned' && assigneeInput.trim() === activeTask.operator.trim())}
                    className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[11.5px]"
                  >
                    {activeTask.state === 'queued' ? 'มอบหมายงาน' : 'เปลี่ยนผู้รับงาน'}
                  </button>
                </section>
              )}

              {pickPage === 'pick_slip' ? (
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs p-4 flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[var(--border-color)] pb-3">
                    <div>
                      <span className="text-[11px] uppercase tracking-wide text-blue-400 font-bold">WMS-06 · ใบสั่งหยิบสินค้า</span>
                      <h2 className="text-[20px] font-bold font-mono mt-1">{activeTask.pickNumber}</h2>
                      <p className="text-[12px] text-[var(--text-secondary)] mt-1">พิมพ์เอกสารนี้ให้พนักงานนำไปหยิบตามล็อตและพิกัดที่ระบุ</p>
                    </div>
                    <button onClick={() => (stockBookings.some((booking) => booking.lotId === activeTask.lotId && booking.approvedSoReference === activeTask.soNumber) ? setPrintTaskId(activeTask.id) : window.print())} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-bold flex items-center justify-center gap-2">
                      <Printer className="w-4 h-4" /> พิมพ์ใบหยิบ / บันทึกเป็น PDF
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[12px]">
                    <div className="p-3 rounded-lg bg-[var(--bg-shell)]"><span className="block text-[10px] text-[var(--text-secondary)]">ใบสั่งขาย / ลูกค้า</span><strong>{activeTask.soNumber} · {customerNameThai(activeTask.customerName)}</strong></div>
                    <div className="p-3 rounded-lg bg-[var(--bg-shell)]"><span className="block text-[10px] text-[var(--text-secondary)]">รหัสล็อต / เลขหลอม</span><strong className="font-mono">{activeTask.lotId} / {linkedItem?.heatNumber || '—'}</strong></div>
                    <div className="p-3 rounded-lg bg-[var(--bg-shell)]"><span className="block text-[10px] text-[var(--text-secondary)]">พิกัดหยิบ</span><strong className="font-mono">{locationThai(activeTask.targetBay)}</strong></div>
                    <div className="p-3 rounded-lg bg-[var(--bg-shell)]"><span className="block text-[10px] text-[var(--text-secondary)]">สินค้า / สเปก</span><strong>{productSpecThai(activeTask.productSpec)}</strong></div>
                    <div className="p-3 rounded-lg bg-[var(--bg-shell)]"><span className="block text-[10px] text-[var(--text-secondary)]">จำนวนที่จัดสรร</span><strong className="font-mono">{activeTask.allocatedQtyTons.toFixed(3)} ตัน · {linkedItem?.pieces ?? '—'} ท่อน/ชิ้น</strong></div>
                    <div className="p-3 rounded-lg bg-[var(--bg-shell)]"><span className="block text-[10px] text-[var(--text-secondary)]">แท็กระบุสินค้า / บาร์โค้ด</span><strong className="font-mono">{linkedItem?.rfidTag || 'ตรวจรหัสล็อตบนสินค้า'}</strong></div>
                  </div>

                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11.5px] text-amber-200 leading-relaxed">
                    ตรวจรหัสสินค้า เลขหลอม ล็อต และป้ายระบุสินค้าก่อนยกทุกครั้ง หากจำนวนหรือสภาพไม่ตรงใบหยิบให้หยุดงานและแจ้งหัวหน้าคลัง ห้ามเปลี่ยนล็อตเอง
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div className="text-[11px] text-[var(--text-secondary)]">วันที่ออกใบหยิบ: {activeTask.assignedAt} · ผู้รับงาน: {activeTask.operator}</div>
                    <button onClick={() => setPickPage('pick_results')} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[12px] flex items-center justify-center gap-2">
                      ไปหน้าบันทึกผลหยิบจริง <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs p-4 flex flex-col gap-4">
              {/* Task Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[16px] font-bold text-blue-400">
                      {activeTask.pickNumber}
                    </span>
                    <span className="font-mono text-[11.5px] px-2 py-0.5 rounded bg-[var(--bg-shell)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                      รหัสล็อต: {activeTask.lotId}
                    </span>
                  </div>
                  <div className="font-bold text-[14px] text-[var(--text-primary)] mt-0.5">
                    {customerNameThai(activeTask.customerName)}
                  </div>
                  <div className="text-[12px] text-[var(--text-secondary)] font-mono mt-0.5">
                    เลขอ้างอิงใบสั่งขาย: {activeTask.soNumber} • พิกัดเป้าหมาย: {locationThai(activeTask.targetBay)} • ชานชาลา:{' '}
                    {activeTask.stagingGate}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                    สถานะสินค้าจริง:
                  </span>
                  <StatusBadge status={displayedInventoryStatus} size="sm" showAuthority />
                </div>
              </div>

              {/* Discrete Pick Task Lifecycle Pipeline */}
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[11px] text-[var(--text-secondary)] tracking-wider font-semibold">
                  ลำดับงาน · ผู้รับผิดชอบและข้อปฏิบัติเปลี่ยนตามขั้นตอน
                </span>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-1 text-center font-mono text-[10px]">
                  {[
                    { key: 'queued', label: 'คิวงาน' },
                    { key: 'assigned', label: 'มอบหมายแล้ว' },
                    { key: 'picking', label: 'กำลังหยิบ' },
                    { key: 'picked', label: 'หยิบแล้ว' },
                    { key: 'qc_packing', label: 'ตรวจคุณภาพ / จัดชุด' },
                    { key: 'staged', label: 'รอผู้จัดการตรวจ' },
                    { key: 'ready', label: 'พร้อมส่ง [08]' },
                    { key: 'partial_exception', label: 'ข้อยกเว้น' },
                  ].map((step) => {
                    const isCurrent = activeTask.state === step.key;
                    return (
                      <div
                        key={step.key}
                        className={`p-1.5 rounded flex flex-col items-center justify-center border ${
                          isCurrent
                            ? 'bg-blue-600 text-white font-bold border-blue-400 shadow-xs'
                            : 'bg-[var(--bg-shell)] text-[var(--text-secondary)] border-[var(--border-color)]'
                        }`}
                      >
                        <span className="leading-tight">{step.label}</span>
                        {isCurrent && <span className="text-[9px] mt-1">ขั้นตอนปัจจุบัน</span>}
                      </div>
                    );
                  })}
                </div>
                {stageGuide && (
                  <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 flex flex-col gap-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <strong className="text-[12px] text-blue-200">{stageGuide.label}</strong>
                      <span className="text-[10.5px] rounded-full bg-[var(--bg-shell)] border border-[var(--border-color)] px-2 py-0.5 text-[var(--text-secondary)]">ผู้รับผิดชอบ: {stageGuide.owner}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[var(--text-primary)]">{stageGuide.instruction}</p>
                    <ul className="grid grid-cols-1 md:grid-cols-3 gap-1.5 text-[10.5px] text-[var(--text-secondary)]">
                      {stageGuide.checks.map((check) => <li key={check} className="flex gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />{check}</li>)}
                    </ul>
                  </div>
                )}
              </div>

              {/* Tonnage / Quantity Summary Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-lg bg-[var(--bg-shell)] border border-[var(--border-color)] text-[12px] font-mono">
                <div>
                  <span className="text-[var(--text-secondary)] text-[10.5px] block font-sans">
                    จำนวนที่จัดสรร:
                  </span>
                  <span className="font-bold text-blue-400 text-[14px]">
                    {activeTask.allocatedQtyTons.toFixed(3)} ตัน
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)] text-[10.5px] block font-sans">
                    จำนวนที่หยิบจริง:
                  </span>
                  <span className="font-bold text-emerald-400 text-[14px]">
                    {activeTask.actualPickedQtyTons.toFixed(3)} ตัน
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)] text-[10.5px] block font-sans">
                    จำนวนขาด / ระงับ:
                  </span>
                  <span
                    className={`font-bold text-[14px] ${
                      activeTask.blockedQtyTons > 0 ? 'text-rose-400' : 'text-slate-400'
                    }`}
                  >
                    {activeTask.blockedQtyTons.toFixed(3)} ตัน
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)] text-[10.5px] block font-sans">
                    บาร์โค้ด / แท็กจำลอง:
                  </span>
                  <span
                    className={`font-bold text-[12px] ${
                      activeTask.barcodeVerified ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {activeTask.barcodeVerified ? 'ตรวจแล้ว' : 'รอสแกน'}
                  </span>
                </div>
              </div>

              {/* Damaged Exception Callout if present */}
              {activeTask.damagedException && (
                <div className="p-3.5 rounded-lg bg-rose-500/10 border-2 border-rose-500/30 text-rose-300 flex flex-col gap-2.5 text-[12px]">
                  <div className="flex items-center gap-2 font-bold text-rose-400">
                    <AlertOctagon className="w-5 h-5 shrink-0" />
                    <span>แจ้งพบสินค้าชำรุดในลาน</span>
                  </div>
                  <p className="leading-relaxed text-[12px] text-rose-200">
                    {activeTask.damagedException.reason} • ระงับเฉพาะส่วนชำรุดจำนวน{' '}
                    <strong>{activeTask.damagedException.affectedQtyTons} ตัน</strong> (ส่วนดีคงที่ [04] จองตามใบสั่งขาย)
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-500/20 text-[11px] font-mono">
                    <span>เปิดงานแปรรูป WMS-11: {activeTask.damagedException.processingJobId}</span>
                    <button
                      onClick={() => navigateToWorkspace('WMS-11')}
                      className="text-blue-400 underline hover:text-blue-300 ml-auto flex items-center gap-1"
                    >
                      ดูงานแปรรูปใน WMS-11 <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Stock Replacement Flow Section */}
                  {(() => {
                    const linkedProposal = replacementProposals.find(
                      (p) =>
                        p.soNumber === activeTask.soNumber &&
                        (p.originalLotId === activeTask.lotId || p.lineNumber === activeTask.lineNumber)
                    );

                    if (!linkedProposal) return (
                      <div className="mt-1 p-2.5 rounded bg-[var(--bg-card)] border border-amber-500/30 text-[11px] text-amber-300">
                        {activeTask.damagedException?.replacementLotId
                          ? `มีล็อตแนะนำ ${activeTask.damagedException.replacementLotId} กำลังรอสร้างคำขอทดแทนใน WMS-05`
                          : 'ไม่พบล็อตที่ตรงสเปกและมีปริมาณเพียงพอตามนโยบาย ส่วนดีคง [04] และงานซ่อมยังดำเนินต่อใน WMS-11'}
                      </div>
                    );

                    return (
                      <div className="mt-1 p-2.5 rounded bg-[var(--bg-card)] border border-rose-500/30 flex flex-col gap-2 text-[12px]">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[var(--text-primary)]">
                            กระบวนการจัดหาสินค้าทดแทน
                          </span>
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-blue-500/20 text-blue-300">
                            {({ PROPOSED: 'รอพิจารณา', MANAGER_APPROVED: 'ผู้จัดการอนุมัติแล้ว', SYSTEM_ONE_HOLD: 'รอระบบหน้าบ้านยืนยัน', SALES_ACCEPTED: 'ฝ่ายขายยอมรับ', SALES_REJECTED: 'ฝ่ายขายไม่ยอมรับ' } as Record<string, string>)[linkedProposal.status] || linkedProposal.status}
                          </span>
                        </div>

                        <div className="text-[11.5px] text-[var(--text-secondary)]">
                          ล็อตทดแทนที่เสนอ: <strong className="text-blue-400">{linkedProposal.proposedLotId}</strong> ({linkedProposal.qtyTons} ตัน)
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--border-color)]">
                          {linkedProposal.status === 'PROPOSED' && (
                            <div className="flex items-center justify-between w-full">
                              <span className="text-amber-400 text-[11px]">
                                รอฝ่ายขายตรวจสอบและกดยอมรับใน WMS-05
                              </span>
                              <button
                                onClick={() => navigateToWorkspace('WMS-05', { tabIndex: 3 })}
                                className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px]"
                              >
                                ไปที่ WMS-05 เพื่อตอบรับ
                              </button>
                            </div>
                          )}

                          {linkedProposal.status === 'SYSTEM_ONE_HOLD' && (
                            <div className="flex items-center justify-between w-full">
                              <span className="text-amber-300 text-[11px]">
                                ระบบหน้าบ้านออก [03] สินค้ารอยืนยันขายแล้ว (รอผู้จัดการคลังยืนยัน SO เป็น [04] สินค้าจองตามใบสั่งขาย)
                              </span>
                              <button
                                onClick={() => managerApproveReplacementHoldToReserved(linkedProposal.id)}
                                disabled={currentRole !== 'warehouse_manager'}
                                className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-[11px]"
                              >
                                ผจก.คลังอนุมัติเป็น [04] จองตามใบสั่งขาย
                              </button>
                            </div>
                          )}

                          {linkedProposal.status === 'MANAGER_APPROVED' && (
                            <div className="flex items-center justify-between w-full">
                              <span className="text-emerald-400 text-[11px]">
                                อนุมัติเป็น [04] จองตามใบสั่งขายแล้ว พร้อมออกใบหยิบทดแทน
                              </span>
                              <button
                                onClick={() => createPickTaskForReplacement(linkedProposal.id)}
                                disabled={currentRole !== 'warehouse_manager'}
                                className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-[11.5px]"
                              >
                                ออกใบหยิบทดแทน
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {pickPage === 'pick_results' && <>
              {/* Actual quantity and QA evidence before staging */}
              <div className="p-3 rounded-lg bg-[var(--bg-shell)] border border-[var(--border-color)] flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold">ผลหยิบจริงและรายการตรวจสอบก่อนส่งผู้จัดการ</span>
                  <span className="text-[10px] font-mono text-[var(--text-secondary)]">งานหยิบ ≠ สถานะสินค้า</span>
                </div>
                {activeTask.state === 'picking' && (
                  <label className="text-[11px] text-[var(--text-secondary)]">
                    จำนวนหยิบจริง (ตัน)
                    <input
                      type="number"
                      min="0.001"
                      max={activeTask.allocatedQtyTons}
                      step="0.001"
                      value={pickActualQty}
                      onChange={(e) => setPickActualQty(Number(e.target.value) || 0)}
                      disabled={currentRole !== 'crane_operator'}
                      className="ml-2 p-1.5 rounded bg-[var(--input-bg)] border border-[var(--border-color)] font-mono text-[var(--text-primary)]"
                    />
                    <span className="ml-2">จากจัดสรร {activeTask.allocatedQtyTons.toFixed(3)} ตัน</span>
                  </label>
                )}
                {stageChecklistItems.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px]">
                    {stageChecklistItems.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 p-2 rounded border border-[var(--border-color)] bg-[var(--bg-card)]">
                      <input
                        type="checkbox"
                        checked={activeTask.qcChecklist[key]}
                        disabled={currentRole !== 'crane_operator'}
                        onChange={(e) => updatePickQcChecklist(activeTask.id, { ...activeTask.qcChecklist, [key]: e.target.checked })}
                        className="accent-blue-600"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                  </div>
                ) : (
                  <p className="text-[10.5px] text-[var(--text-secondary)]">รายการตรวจจะแสดงตามขั้นตอนงาน เช่น ตรวจสเปกระหว่างหยิบ และตรวจมัด เอกสาร และพิกัดระหว่างตรวจคุณภาพและจัดชุด</p>
                )}
                <p className="text-[10.5px] text-[var(--text-secondary)]">
                  ผู้จัดการคลังยืนยัน [08] ได้เมื่อหยิบครบ ไม่มียอดค้าง และรายการตรวจสอบครบทุกข้อเท่านั้น
                </p>
              </div>

              {/* Primary Operator Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-color)]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowDamageModal(true)}
                    disabled={currentRole !== 'crane_operator' || activeTask.state !== 'picking'}
                    title={activeTask.state !== 'picking' ? 'แจ้งของเสียได้ระหว่างหยิบเท่านั้น' : 'ใช้ได้เฉพาะ Crane / Yard Operator'}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-rose-300 border border-rose-500/30 text-[12px] font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>แจ้งเหล็กชำรุด</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {activeTaskInOrder && ['picked', 'qc_packing', 'staged'].includes(activeTask.state) && (
                    <div className="flex items-center gap-2 text-[11.5px]">
                      <span className="text-emerald-300">หยิบรายการนี้เสร็จแล้ว · เตรียมส่งรวมกับรายการอื่นในใบสั่ง</span>
                      <button onClick={() => setSelectedOrder(activeTask.soNumber)} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold">เตรียมส่งทั้งใบสั่ง {activeTask.soNumber} →</button>
                    </div>
                  )}
                  {activeTask.state !== 'queued' && activeTask.state !== 'ready' && activeTask.state !== 'partial_exception' && !(activeTaskInOrder && ['picked', 'qc_packing', 'staged'].includes(activeTask.state)) && (
                    <button
                      onClick={() => handleStepForward(activeTask)}
                      disabled={currentRole !== 'crane_operator' || (activeTask.state === 'picking' && (!activeTask.qcChecklist.specTagMatches || !activeTask.qcChecklist.gaugeToleranceOk)) || (activeTask.state === 'qc_packing' && !pickChecklistComplete)}
                      title="ผู้หยิบบันทึกผลตามขั้นตอน ผู้จัดการคลังเป็นผู้มอบหมายและยืนยันพื้นที่รอส่งมอบ"
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[12.5px] flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      <span>
                        {activeTask.state === 'assigned'
                          ? 'เริ่มหยิบหลังตรวจรหัสล็อตและเลขหลอม'
                          : activeTask.state === 'picking'
                          ? 'บันทึกจำนวนหยิบจริง'
                          : activeTask.state === 'picked'
                          ? 'เริ่มตรวจคุณภาพและจัดชุด'
                          : 'ส่งผลตรวจคุณภาพและวางพื้นที่รอส่งมอบ'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {!activeTaskInOrder && <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-[var(--border-color)] pt-3">
                <span className={`text-[11px] ${canContinueToManager ? 'text-emerald-400' : 'text-[var(--text-secondary)]'}`}>
                  {canContinueToManager ? 'ยอดหยิบครบและรายการตรวจสอบครบ พร้อมส่งให้ผู้จัดการตรวจ' : 'ไปต่อได้เมื่อหยิบครบ วางพื้นที่รอส่งมอบ และตรวจสอบครบทุกข้อ'}
                </span>
                <button onClick={() => setPickPage('manager_delivery')} disabled={!canContinueToManager} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[12px] flex items-center justify-center gap-2">
                  ส่งต่อหน้าผู้จัดการคลัง <ArrowRight className="w-4 h-4" />
                </button>
              </div>}
              </>}

              {pickPage === 'manager_delivery' && activeTaskInOrder && !activeTask.readinessConfirmed && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-[12px]">
                  <span>รายการนี้อยู่ในใบสั่ง {activeTask.soNumber} · ผู้จัดการยืนยัน [08] ครั้งเดียวทั้งใบสั่งหลังรวมของที่ประตูครบ</span>
                  <button onClick={() => setSelectedOrder(activeTask.soNumber)} className="rounded bg-blue-600 px-3 py-1.5 font-bold text-white">เตรียมส่งทั้งใบสั่ง →</button>
                </div>
              )}
              {pickPage === 'manager_delivery' && <>
              {/* Manager Readiness Gate ([08] Ready for Delivery + WHX-01) */}
              <div className="p-4 rounded-xl bg-indigo-500/10 border-2 border-indigo-500/30 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-[13px]">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    <span>ผู้จัดการคลังยืนยันความพร้อมส่งมอบ [08]</span>
                  </div>
                  <span className="font-mono text-[10.5px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                    จุดยืนยัน WHX-01
                  </span>
                </div>

                <div className="text-[12px] text-indigo-200/90 leading-relaxed">
                  เมื่อพนักงานจัดวางสินค้าที่ชานชาลาครบถ้วน ผู้จัดการคลัง
                  จะทำการตรวจสอบพิกัดส่งมอบและยืนยันเปลี่ยนสถานะเป็น{' '}
                  <strong className="text-white">[08] สินค้าพร้อมส่งมอบ</strong>{' '}
                  พร้อมส่งสัญญาณ WHX-01 ไปยังถังข้อมูล (ขั้นตอนนี้ยังไม่ตัดยอดสต็อก)
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px] text-[var(--text-secondary)]">ประตูวางสินค้า:</span>
                    <span id="staging-zone-edit" className="rounded border border-[var(--border-color)] bg-[var(--bg-shell)] px-2 py-1 font-mono text-[12px] font-bold">{stagingZoneEdit}</span>
                    <span className="text-[10.5px] text-[var(--text-secondary)]">จาก Logistics App · แก้ไขที่ Logistics App</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeTask.readinessConfirmed ? (
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-mono text-[12px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          ยืนยัน [08] สินค้าพร้อมส่งมอบแล้ว ({activeTask.whx01EventId})
                        </span>
                        <button
                          onClick={() => amendStagingReadinessWHX02(activeTask.id, 'ผู้จัดการคลังแก้ไขโซนส่งมอบที่กำหนด', stagingZoneEdit)}
                          disabled={currentRole !== 'warehouse_manager' || pickedUpQtyTons > 0 || !stagingZoneEdit.trim()}
                          title="แก้ไขการยืนยันความพร้อมได้โดยผู้จัดการก่อนรับขึ้นรถ"
                          className="px-2.5 py-1 rounded bg-[var(--bg-shell)] hover:bg-slate-700/50 disabled:opacity-40 text-slate-300 text-[11px] font-mono border border-[var(--border-color)]"
                        >
                          WHX-02 แก้ไข
                        </button>
                        <button
                          onClick={() => cancelStagingReadinessWHX03(activeTask.id, 'ลูกค้ายกเลิกคิวรถด่วน')}
                          disabled={currentRole !== 'warehouse_manager' || pickedUpQtyTons > 0}
                          title="ถอนการยืนยันความพร้อมได้โดยผู้จัดการก่อนรับขึ้นรถ"
                          className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 text-rose-300 text-[11px] font-mono border border-rose-500/30"
                        >
                          WHX-03 ยกเลิก
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => managerConfirmStaging08(activeTask.id, stagingZoneEdit)}
                        disabled={currentRole !== 'warehouse_manager' || activeTask.state !== 'staged' || !stagingZoneEdit.trim() || activeTaskInOrder}
                        title={activeTask.state !== 'staged' ? 'พนักงานลานต้องหยิบ ตรวจคุณภาพ บรรจุ และจัดวางสินค้าให้เสร็จก่อน' : 'ใช้ได้เฉพาะผู้จัดการคลัง'}
                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[12.5px] shadow-xs flex items-center gap-1.5 transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>ผจก.คลัง ยืนยันสถานะ [08] + สัญญาณ WHX-01</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Logistics Handover & Outbound Gating (The ONLY outbound trigger!) */}
              <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/30 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-sky-500/20 pb-2">
                  <div className="flex items-center gap-2 text-sky-400 font-bold text-[13px]">
                    <Truck className="w-5 h-5 text-sky-400" />
                    <span>จุดส่งมอบขึ้นรถขนส่ง</span>
                  </div>
                  <span className="font-mono text-[10.5px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
                    จุดตัดสต็อกเมื่อรับขึ้นรถ
                  </span>
                </div>

                <div className="text-[12px] text-sky-200/90 leading-relaxed">
                  <strong>ข้อกำหนด:</strong> สัญญาณตอบรับจากระบบขนส่ง{' '}
                  <code className="bg-sky-500/20 px-1 py-0.5 rounded font-mono font-bold text-sky-300">
                    การยืนยันรับขึ้นรถ LGX-03
                  </code>{' '}
                  คือสิ่งเดียวที่สั่งตัดลดยอดสต็อกจริงและเปลี่ยนสถานะเป็น{' '}
                  <strong className="text-white">[09] สินค้าระหว่างขนส่ง</strong> (ใบชั่งน้ำหนักและใบส่งของเป็นเพียงเอกสารประกอบ)
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2 font-mono text-[12px]">
                    {activeTask.manifestNumber && (
                      <span className="text-emerald-400 font-bold">
                        ใบส่งของ: {activeTask.manifestNumber} • ทะเบียน: {activeTask.vehiclePlate}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {inTransitItems.length > 0 && (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 font-mono text-[12px] font-bold border border-sky-500/30">
                          [09] สินค้าระหว่างขนส่ง {inTransitItems.reduce((total, item) => total + item.totalWeightTons, 0).toFixed(3)} ตัน
                        </span>
                        <button
                          onClick={() => simulateDeliveryLGX04(activeTask.id)}
                          disabled={currentRole !== 'logistics_clerk'}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-[12px] shadow-xs"
                        >
                          จำลองลูกค้ารับมอบ [10] สินค้าส่งมอบแล้ว (LGX-04)
                        </button>
                        <button
                          onClick={() => simulateDeliveryFailureLGX05(activeTask.id, 'ไซต์งานปิด ไม่สามารถลงเหล็กได้')}
                          disabled={currentRole !== 'logistics_clerk'}
                          className="px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-600 disabled:opacity-40 text-white font-bold text-[12px]"
                        >
                          ส่งมอบไม่สำเร็จ · คงสถานะ [09] สินค้าระหว่างขนส่ง (LGX-05)
                        </button>
                      </div>
                    )}
                    {deliveredItems.length > 0 && (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[12px] font-bold border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          [10] สินค้าส่งมอบแล้ว
                        </span>
                        <button
                          onClick={() => setShowClaimModal(true)}
                          disabled={currentRole !== 'logistics_clerk'}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-[12px] flex items-center gap-1"
                        >
                        <span>เปิดข้อร้องเรียน [11] สินค้ารอการตรวจสอบเคลมหรือส่งคืน (LGX-06)</span>
                        </button>
                      </div>
                    )}
                    {linkedTransitItems.some((item) => item.canonicalStatus === '11') && (
                      <span className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 font-mono text-[12px] font-bold border border-rose-500/30">
                        [11] สินค้ารอการตรวจสอบเคลมหรือส่งคืน
                      </span>
                    )}
                    {readyQtyTons > 0 && activeTask.readinessConfirmed ? (
                      <button
                        onClick={() => { setPickupQty(readyQtyTons); setShowHandoverModal(true); }}
                        disabled={currentRole !== 'logistics_clerk'}
                        title="เจ้าหน้าที่ขนส่งเป็นผู้ยืนยันการรับสินค้าขึ้นรถ"
                        className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[12.5px] shadow-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Truck className="w-4 h-4" />
                        <span>บันทึก LGX-03 รับขึ้นรถ {readyQtyTons.toFixed(3)} ตัน → [09]</span>
                      </button>
                    ) : !activeTask.readinessConfirmed && readyQtyTons > 0 ? (
                      <span className="text-[11px] text-[var(--text-secondary)]">รอผู้จัดการคลังยืนยันความพร้อม WHX-01 ก่อนระบบขนส่งรับขึ้นรถ</span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex justify-start border-t border-[var(--border-color)] pt-3">
                <button onClick={() => setPickPage('pick_results')} className="px-3.5 py-1.5 rounded-lg bg-[var(--bg-shell)] border border-[var(--border-color)] text-[var(--text-secondary)] text-[12px] flex items-center gap-2"><ArrowLeft className="w-4 h-4" />กลับไปผลหยิบจริง / รายการตรวจสอบ</button>
              </div>
              </>}
            </div>
              )}
            </>
          ) : (
            <div className="p-8 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] text-center text-[var(--text-secondary)]">
              ไม่พบงานหยิบที่เลือก
            </div>
          )}
        </div>
      </div>

      {activeTask && createPortal(
        <section className="wms-pick-print-sheet">
          <div className="wms-pick-print-content">
            <header className="wms-pick-print-header">
              <div>
                <strong>บริษัท ไทยทวีพรค้าเหล็ก จำกัด (TTS)</strong>
                <div>ใบสั่งหยิบสินค้า · WMS-06</div>
              </div>
              <div className="wms-pick-print-number">{activeTask.pickNumber}</div>
            </header>
            <div className="wms-pick-print-meta">
              <div><span>เลขที่ SO</span><strong>{activeTask.soNumber}</strong></div>
              <div><span>ลูกค้า</span><strong>{customerNameThai(activeTask.customerName)}</strong></div>
              <div><span>วันที่ออกใบหยิบ</span><strong>{activeTask.assignedAt}</strong></div>
              <div><span>ผู้รับงานหยิบ</span><strong>{activeTask.operator}</strong></div>
            </div>
            <h2>รายการสินค้า</h2>
            <table className="wms-pick-print-table">
              <thead><tr><th>รายการ / สเปก</th><th>รหัสล็อต / เลขหลอม</th><th>พิกัดหยิบ</th><th>จำนวนจัดสรร</th></tr></thead>
              <tbody><tr>
                <td>{activeTask.productSpec}<br /><small>Line #{activeTask.lineNumber}</small></td>
                <td>{activeTask.lotId}<br /><small>เลขหลอม: {linkedItem?.heatNumber || '—'}</small></td>
                <td>{activeTask.targetBay}<br /><small>RFID: {linkedItem?.rfidTag || '—'}</small></td>
                <td>{activeTask.allocatedQtyTons.toFixed(3)} ตัน<br /><small>{linkedItem?.pieces ?? '—'} ท่อน/ชิ้น</small></td>
              </tr></tbody>
            </table>
            <div className="wms-pick-print-instructions">
              <strong>ข้อปฏิบัติ</strong>
              <ol><li>ตรวจล็อต เลขหลอม สเปก และป้ายระบุสินค้าให้ตรงกับใบหยิบก่อนยก</li><li>บันทึกจำนวนที่หยิบได้จริงใน WMS-06 หลังจบงาน</li><li>ถ้าพบสินค้าเสียหรือจำนวนไม่ตรง ให้หยุดเฉพาะล็อตนี้และแจ้งหัวหน้าคลัง ห้ามเปลี่ยนล็อตเอง</li></ol>
            </div>
            <div className="wms-pick-print-fields">
              <div>จำนวนหยิบจริง: __________________ ตัน</div>
              <div>หมายเหตุ / ของชำรุด: ______________________________________________</div>
            </div>
            <footer className="wms-pick-print-signatures"><div>ผู้หยิบ / วันที่<br /><br />____________________________</div><div>ผู้ตรวจสอบ / วันที่<br /><br />____________________________</div></footer>
            <small className="wms-pick-print-footer">เอกสารจำลองจากระบบคลังสินค้าต้นแบบ · การพิมพ์ใบหยิบไม่เปลี่ยนสถานะสินค้า</small>
          </div>
        </section>,
        document.body
      )}

      {/* Modal: Report Damaged Stock in Picking */}
      {showDamageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-[var(--bg-card)] border-2 border-rose-500/40 rounded-xl p-5 shadow-2xl flex flex-col gap-4 text-[13px]">
            <div className="flex items-center gap-2.5 text-rose-500 font-bold text-[15px] border-b border-rose-500/20 pb-2.5">
              <AlertTriangle className="w-5 h-5" />
              <span>บันทึกแจ้งเหล็กชำรุดขณะหยิบ</span>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[12px] font-bold text-[var(--text-secondary)]">
                  จำนวนน้ำหนักที่ชำรุด (ตัน):
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={damagedQty}
                  onChange={(e) => setDamagedQty(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 p-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg font-mono text-[14px] text-rose-400 font-bold"
                />
              </div>

              <div>
                <label className="text-[12px] font-bold text-[var(--text-secondary)]">
                  สาเหตุและลักษณะความเสียหาย:
                </label>
                <textarea
                  rows={3}
                  value={damageReason}
                  onChange={(e) => setDamageReason(e.target.value)}
                  className="w-full mt-1 p-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg text-[12.5px]"
                ></textarea>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11.5px] leading-relaxed">
                <strong>การดำเนินการอัตโนมัติของระบบ:</strong>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>ระงับยอด {damagedQty} ตัน และเปลี่ยนสถานะสต็อก [04] → [05] Pending Processing</li>
                  <li>เปิดงานแปรรูปใน WMS-11 เพื่อตัดแต่งหรือดัดแปลงแก้ไข</li>
                  <li>เสนอล็อตทดแทนให้ฝ่ายขายพิจารณาใน WMS-05 โดยไม่สลับของโดยพลการ</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border-color)]">
              <button
                onClick={() => setShowDamageModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-[var(--bg-shell)] hover:bg-slate-700/50 text-[var(--text-secondary)]"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmDamage}
                disabled={currentRole !== 'crane_operator' || damagedQty <= 0 || damagedQty > (activeTask?.allocatedQtyTons || 0) || !damageReason.trim()}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold"
              >
                ยืนยันแยกของชำรุด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Logistics Handover LGX-03 */}
      {showHandoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-[var(--bg-card)] border-2 border-sky-500/40 rounded-xl p-5 shadow-2xl flex flex-col gap-4 text-[13px]">
            <div className="flex items-center gap-2.5 text-sky-400 font-bold text-[15px] border-b border-sky-500/20 pb-2.5">
              <Truck className="w-5 h-5" />
              <span>บันทึกตรวจรับสินค้าขึ้นรถขนส่ง (LGX-03)</span>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[12px] font-bold text-[var(--text-secondary)]">
                  ชื่อพนักงานขับรถ:
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full mt-1 p-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg text-[12.5px]"
                />
              </div>

              <div>
                <label className="text-[12px] font-bold text-[var(--text-secondary)]">
                  ยานพาหนะและทะเบียนรถ:
                </label>
                <input
                  type="text"
                  value={truckPlate}
                  onChange={(e) => setTruckPlate(e.target.value)}
                  className="w-full mt-1 p-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg text-[12.5px]"
                />
              </div>

              <div>
                <label className="text-[12px] font-bold text-[var(--text-secondary)]">จำนวนรับขึ้นรถรอบนี้ (ตัน):</label>
                <input type="number" min="0.001" max={readyQtyTons} step="0.001" value={pickupQty} onChange={(e) => setPickupQty(Number(e.target.value) || 0)} className="w-full mt-1 p-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg font-mono text-[13px]" />
                <span className="text-[10.5px] text-[var(--text-secondary)]">ยอดพร้อมรับ {readyQtyTons.toFixed(3)} ตัน · รับได้บางส่วนหลายรอบ</span>
              </div>

              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-200 text-[11.5px] leading-relaxed">
                * เมื่อระบบขนส่งยืนยันการรับแล้ว ระบบจะย้ายเฉพาะ {pickupQty.toFixed(3)} ตันเป็น [09] สินค้าส่วนที่เหลือคง [08] และยอดพร้อมรับหลังรายการนี้จะเป็น {Math.max(0, readyQtyTons - pickupQty).toFixed(3)} ตัน
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border-color)]">
              <button
                onClick={() => setShowHandoverModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-[var(--bg-shell)] hover:bg-slate-700/50 text-[var(--text-secondary)]"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmHandover}
                disabled={currentRole !== 'logistics_clerk' || pickupQty <= 0 || pickupQty > readyQtyTons || !driverName.trim() || !truckPlate.trim()}
                className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold"
              >
                ยืนยันการรับมอบขึ้นรถ (ตัดยอดสต็อก)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Customer Claim LGX-06 */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-[var(--bg-card)] border-2 border-rose-500/40 rounded-xl p-5 shadow-2xl flex flex-col gap-4 text-[13px]">
            <div className="flex items-center gap-2.5 text-rose-400 font-bold text-[15px] border-b border-rose-500/20 pb-2.5">
              <AlertTriangle className="w-5 h-5" />
              <span>เปิดข้อร้องเรียนเคลมสินค้าหลังส่งมอบ (LGX-06)</span>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[12px] font-bold text-[var(--text-secondary)]">
                  ปริมาณที่ขอเคลม (ตัน):
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={claimQty}
                  onChange={(e) => setClaimQty(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 p-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg font-mono text-[14px] text-rose-400 font-bold"
                />
              </div>

              <div>
                <label className="text-[12px] font-bold text-[var(--text-secondary)]">
                  สาเหตุข้อร้องเรียน (NCR):
                </label>
                <textarea
                  rows={3}
                  value={claimReason}
                  onChange={(e) => setClaimReason(e.target.value)}
                  className="w-full mt-1 p-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg text-[12.5px]"
                ></textarea>
              </div>

              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-200 text-[11.5px] leading-relaxed">
                <strong>คำเตือนตามข้อกำหนดส่วน 4.8:</strong> สินค้าในสถานะ [11] จะไม่คืนยอดกลับเข้าสู่สต็อก [02] โดยอัตโนมัติ ต้องผ่านการตรวจรับทางกายภาพและวินิจฉัยแนวทางจัดการแยกต่างหาก
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border-color)]">
              <button
                onClick={() => setShowClaimModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-[var(--bg-shell)] hover:bg-slate-700/50 text-[var(--text-secondary)]"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmClaim}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold"
              >
                บันทึกเปิดข้อร้องเรียน [11]
              </button>
            </div>
          </div>
        </div>
      )}
      {printTask && printBooking && printGroup && printItem && (
        <RequisitionPrintModal kind="STOCK" booking={printBooking} item={printItem} group={printGroup} task={printTask} job={processingJobs.find((job) => job.inputLotId === printTask.lotId && job.linkedSoNumber === printTask.soNumber)} onClose={() => setPrintTaskId(null)} />
      )}
    </div>
  );
};
