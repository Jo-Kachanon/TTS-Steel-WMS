import React, { useState, useMemo, useEffect } from 'react';
import { useWms } from '../../context/WmsContext';
import { StatusBadge } from '../common/StatusBadge';
import {
  Sparkles,
  Building,
  CheckCircle2,
  Lock,
  ArrowRight,
  RotateCw,
  Sliders,
  ShieldCheck,
  AlertCircle,
  Truck,
  Layers,
  Check,
  Split,
  Search,
  ChevronRight,
  Filter,
  AlertTriangle,
} from 'lucide-react';

export const Wms05Allocation: React.FC = () => {
  const {
    inventory,
    soRequests,
    policies,
    activePolicyId,
    setActivePolicyId,
    currentRole,
    workTypeConfigs,
    createStockBookingGroup,
    navContext,
    navigateToWorkspace,
    managerApproveAllocation,
    createPickTaskForReserved,
    replacementProposals,
    acceptReplacementProposal,
    rejectReplacementProposal,
    managerApproveReplacementHoldToReserved,
    createPickTaskForReplacement,
    triggerGateBlocked,
  } = useWms();

  const [activeTab, setActiveTab] = useState<'catalog' | 'recommendations' | 'manager_allocation' | 'replacement'>(
    navContext.tabIndex === 3 ? 'replacement' : 'catalog'
  );

  useEffect(() => {
    if (navContext.tabIntentKey === undefined) return;
    setActiveTab(navContext.tabIndex === 3 ? 'replacement' : 'catalog');
  }, [navContext.tabIntentKey]);

  const selectedSoNumber = navContext.selectedSoId || 'SO-2024-0892';
  const selectedLineNo = navContext.selectedLineNumber || 1;

  const activeSo = soRequests.find((s) => s.soNumber === selectedSoNumber) || soRequests[0];
  const activeLine = activeSo?.lines.find((l) => l.lineNumber === selectedLineNo) || activeSo?.lines[0];
  const productNameThai = (name: string) => name
    .replaceAll('H-Beam', 'เหล็กเอชบีม')
    .replaceAll('Wide Flange', 'เหล็กไวด์แฟลงก์')
    .replaceAll('Hot Rolled Coil', 'เหล็กม้วนรีดร้อน')
    .replaceAll('HR Coil', '')
    .replaceAll('mm', 'มม.')
    .replace(/(\d)M\b/g, '$1 ม.');
  const locationThai = (location: string) => location.replaceAll('Bay ', 'ช่อง ');

  const [isManagerApproving, setIsManagerApproving] = useState(false);

  // Catalog search state
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogGradeFilter, setCatalogGradeFilter] = useState('ALL');
  const [bookingCart, setBookingCart] = useState<Record<string, number>>({});
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingCustomer, setBookingCustomer] = useState('');
  const [bookingFeedback, setBookingFeedback] = useState('');

  const totalSelectedQty = activeLine?.selectedQtyTons || 0;
  const requestedQty = activeLine?.requestedQtyTons || 45.0;
  const isCompleteMatch = Math.abs(totalSelectedQty - requestedQty) < 0.001;

  const handleManagerApprove = () => {
    if (currentRole === 'sales_rep') {
      triggerGateBlocked({
        title: 'ไม่อนุญาตให้ฝ่ายขายอนุมัติการจัดสรร',
        unmetGates: [
          'ฝ่ายขายไม่สามารถอนุมัติการจัดสรรหรือสร้างใบหยิบได้ตามข้อกำหนด',
          'สิทธิ์การเปลี่ยนสถานะ [03] Soft Hold เป็น [04] Reserved สงวนไว้สำหรับผู้จัดการคลังสินค้าเท่านั้น',
        ],
        recoveryRoute: 'สลับสิทธิ์ผู้ใช้เป็นผู้จัดการคลังที่แถบด้านบน',
      });
      return;
    }
    setIsManagerApproving(true);
    setTimeout(() => {
      managerApproveAllocation(activeSo.soNumber, activeLine.lineNumber);
      setIsManagerApproving(false);
    }, 600);
  };

  const handleCreatePick = () => {
    if (currentRole === 'sales_rep') {
      triggerGateBlocked({
        title: 'ไม่อนุญาตให้ฝ่ายขายออกใบหยิบสินค้า',
        unmetGates: ['เฉพาะผู้จัดการคลังสินค้าเท่านั้นที่สามารถสั่งสร้างใบสั่งหยิบ (Pick Task) ใน WMS-06 ได้'],
        recoveryRoute: 'สลับสิทธิ์ผู้ใช้เป็นผู้จัดการคลังที่แถบด้านบน',
      });
      return;
    }
    createPickTaskForReserved(activeSo.soNumber, activeLine.lineNumber);
  };

  // 5 Manager Checklist Gates Status
  const isGate1Pass = activeLine?.selectionStatus === 'SOFT_HOLD' || activeLine?.selectionStatus === 'RESERVED';
  const isGate2Pass = !!activeSo?.approvalRef;
  const isGate3Pass = !!activeSo?.paymentAttestRef;
  const isGate4Pass = isCompleteMatch || activeLine?.selectedQtyTons === requestedQty;
  const isGate5Pass = activeSo?.optimisticLockVersion === 'v2.10';
  const allGatesPass = isGate1Pass && isGate2Pass && isGate3Pass && isGate4Pass && isGate5Pass;
  const isAlreadyReserved = activeLine?.selectionStatus === 'RESERVED';

  // Active Policy & Threshold
  const currentPolicy = policies.find((p) => p.id === activePolicyId) || policies[0];
  const agingThreshold = currentPolicy.agingThresholdDays || 90;
  const policyRunId = `RUN-${currentPolicy.id}-${currentPolicy.version.replace(/[^a-zA-Z0-9]/g, '')}-${activeSo?.soNumber?.replace(/[^a-zA-Z0-9]/g, '') || '0892'}`;

  // Evaluate candidate recommendations dynamically based on active policy weights and rules
  const candidateLots = useMemo(() => {
    // Sales can work only with stock already reserved [04] against this SO line.
    const reservedLotIds = new Set(
      activeLine?.selectionStatus === 'RESERVED' ? activeLine.selectedLotIds : []
    );
    const matchingEligible = inventory.filter(
      (it) =>
        !it.isExcluded &&
        it.canonicalStatus === '04' &&
        reservedLotIds.has(it.id) &&
        (it.productCode === activeLine?.productCode || it.grade === 'SM400')
    );

    const scored = matchingEligible.map((item) => {
      // 1. Aging Clearance Priority score
      const isAgingClearance = item.ageDays >= agingThreshold;
      const agingScore = isAgingClearance ? 100 : Math.round((item.ageDays / agingThreshold) * 60);

      // 2. FIFO score (older reception = higher priority)
      const fifoScore = Math.min(100, Math.round(50 + (item.ageDays / 120) * 50));

      // 3. Bay Accessibility & Crane score
      const bayScore = item.locationBay.includes('03-B2') ? 100 : item.locationBay.includes('03-C1') ? 92 : 80;

      // Extract weights from active policy
      const wAging = currentPolicy.rules.find((r) => r.ruleName.includes('Aging') || r.ruleName.includes('Clearance'))?.weight ?? 45;
      const wFifo = currentPolicy.rules.find((r) => r.ruleName.includes('FIFO'))?.weight ?? 30;
      const wBay = currentPolicy.rules.find((r) => r.ruleName.includes('Bay') || r.ruleName.includes('Crane'))?.weight ?? 15;
      const wOther = Math.max(0, 100 - (wAging + wFifo + wBay));

      const totalScore = Math.round(
        (agingScore * wAging + fifoScore * wFifo + bayScore * wBay + 85 * wOther) / 100
      );

      let reason = '';
      if (isAgingClearance) {
        reason = `ให้ความสำคัญกับสินค้าเก่า (อายุ ${item.ageDays} วัน > เกณฑ์ ${agingThreshold} วัน) • เข้าก่อนออกก่อน • พิกัด ${locationThai(item.locationBay)}`;
      } else if (item.ageDays > 50) {
        reason = `ลำดับเข้าก่อนออกก่อน (อายุ ${item.ageDays} วัน) • พิกัด ${locationThai(item.locationBay)} มัดเต็ม`;
      } else {
        reason = `สินค้าในระดับสต็อกมาตรฐาน (อายุ ${item.ageDays} วัน) • พิกัด ${locationThai(item.locationBay)}`;
      }

      return {
        item,
        score: totalScore,
        reason,
        isAgingClearance,
        ageDays: item.ageDays,
      };
    });

    // Oldest aging clearance lots rank first!
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }, [inventory, activeLine, currentPolicy, agingThreshold]);

  const filteredCatalog = inventory.filter((item) => {
    if (item.canonicalStatus !== '02') return false;
    if (catalogGradeFilter !== 'ALL' && item.grade !== catalogGradeFilter) return false;
    if (
      catalogSearch &&
      !item.id.toLowerCase().includes(catalogSearch.toLowerCase()) &&
      !item.productName.toLowerCase().includes(catalogSearch.toLowerCase()) &&
      !item.dimensions.toLowerCase().includes(catalogSearch.toLowerCase())
    ) {
      return false;
    }
    return true;
  });
  const cartLines = Object.entries(bookingCart)
    .map(([lotId, qtyTons]) => ({ lotId, qtyTons, item: inventory.find((stock) => stock.id === lotId) }))
    .filter((line) => line.item && line.item.canonicalStatus === '02');
  const cartTons = cartLines.reduce((sum, line) => sum + line.qtyTons, 0);
  const cartInvalid = !cartLines.length || cartLines.some((line) => line.qtyTons <= 0 || line.qtyTons > (line.item?.availableWeightTons || 0) + 0.001);
  const toggleCartItem = (lotId: string, availableTons: number) => setBookingCart((current) => {
    if (lotId in current) {
      const { [lotId]: _removed, ...rest } = current;
      return rest;
    }
    return { ...current, [lotId]: availableTons };
  });
  const submitBooking = () => {
    if (cartInvalid || !createStockBookingGroup(cartLines.map(({ lotId, qtyTons }) => ({ lotId, qtyTons })), bookingCustomer)) {
      setBookingFeedback('จองไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และจำนวนสินค้าพร้อมขายอีกครั้ง');
      return;
    }
    setBookingCart({});
    setBookingDialogOpen(false);
    setBookingCustomer('');
    navigateToWorkspace('WMS-03');
  };

  return (
    <div className="flex flex-col gap-4 text-[var(--text-primary)]">
      {/* 1. Pinned Context Header / Banner */}
      <div className={`${activeTab === 'catalog' ? 'hidden' : ''} bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 shadow-xs`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 font-mono text-[12.5px] font-bold border border-blue-500/20">
                ใบสั่งขาย: {activeSo.soNumber}
              </span>
              <span className="px-2 py-0.5 rounded bg-[var(--bg-shell)] text-[var(--text-primary)] font-mono text-[11px] font-semibold border border-[var(--border-color)]">
                รายการที่ {activeLine.lineNumber}
              </span>
            </div>
            <div className="h-4 w-px bg-[var(--border-color)] hidden sm:block"></div>
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-[var(--text-secondary)]" />
              <span className="font-bold text-[14px] text-[var(--text-primary)]">
                {activeSo.customerName.replace(/\s*\([^)]*\)\s*$/, '')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold border ${
                activeLine.selectionStatus === 'RESERVED'
                  ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                  : activeLine.selectionStatus === 'SOFT_HOLD'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : activeLine.selectionStatus === 'SELECTION_PENDING'
                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                  : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  activeLine.selectionStatus === 'RESERVED'
                    ? 'bg-indigo-400'
                    : activeLine.selectionStatus === 'SOFT_HOLD'
                    ? 'bg-amber-400'
                    : 'bg-blue-400 animate-pulse'
                }`}
              ></span>
              <span>
                สถานะ:{' '}
                {activeLine.selectionStatus === 'RESERVED'
                  ? '[04] จองตามใบสั่งขายแล้ว'
                  : activeLine.selectionStatus === 'SOFT_HOLD'
                  ? '[03] รอยืนยันขาย / ระบบหน้าบ้านยืนยันแล้ว รอผู้จัดการอนุมัติ'
                  : activeLine.selectionStatus === 'SELECTION_PENDING'
                  ? 'รอการตอบรับจากระบบหน้าบ้าน'
                  : 'กำลังจัดสรรสินค้าตามนโยบาย'}
              </span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 items-center">
          <div className="md:col-span-8 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="text-[12.5px] text-[var(--text-secondary)] font-medium">สเปกที่ต้องการ:</span>
              <span className="text-[12.5px] font-bold text-[var(--text-primary)] bg-[var(--bg-shell)] px-2.5 py-1 rounded border border-[var(--border-color)]">
                {productNameThai(activeLine.specDescription)}
              </span>
            </div>
          </div>

          <div className="md:col-span-4 flex items-center justify-end gap-3">
            <div className="text-right">
              <span className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold block">
                ปริมาณที่ขอ:
              </span>
              <div className="flex items-baseline gap-1.5 justify-end">
                <span className="font-mono text-[19px] font-bold text-blue-500">
                  {activeLine.requestedQtyTons.toFixed(3)}
                </span>
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">ตัน</span>
                <span className="text-[12px] text-[var(--text-secondary)] font-mono">
                  ({activeLine.requestedPieces} ท่อน / มัด)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Workspace tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* 4 Tabs */}
        <div className="flex items-center gap-1 bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-color)] shadow-xs overflow-x-auto text-[12.5px]">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'catalog'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-shell)]'
            }`}
          >
            สินค้าพร้อมจอง
          </button>
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`hidden px-3.5 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'recommendations'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-shell)]'
            }`}
          >
            <span>2. เลือกสินค้าตามนโยบาย</span>
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
          </button>
          <button
            onClick={() => setActiveTab('manager_allocation')}
            className={`hidden px-3.5 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'manager_allocation'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-shell)]'
            }`}
          >
            <span>3. อนุมัติการจัดสรร</span>
            <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
              เฉพาะผู้จัดการ
            </span>
          </button>
          <button
            onClick={() => setActiveTab('replacement')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'replacement'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-shell)]'
            }`}
          >
            <span>ข้อเสนอเปลี่ยนสินค้า</span>
            {replacementProposals.some((p) => p.status === 'PROPOSED') && (
              <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
                มีรายการรอตรวจ
              </span>
            )}
          </button>
        </div>

      </div>

      {/* TAB 1: Catalog Search */}
      {activeTab === 'catalog' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs p-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
            <div>
              <h2 className="text-[15px] font-bold">ค้นหาสินค้าพร้อมเสนอขาย [02]</h2>
              <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                ทุกบทบาทดูสินค้า [02] ได้; เซลล์จองสินค้าแล้วติดตามต่อได้จากเมนู “รายการจองและติดตาม”
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาล็อต / สเปก / ขนาด..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="pl-8 pr-3 py-1 text-[12px] bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg w-52"
                />
              </div>
              <select
                value={catalogGradeFilter}
                onChange={(e) => setCatalogGradeFilter(e.target.value)}
                className="p-1 text-[12px] bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg font-mono"
              >
                <option value="ALL">ทุกเกรด</option>
                <option value="SM400">SM400</option>
                <option value="SD40">SD40</option>
                <option value="SS400">SS400</option>
              </select>
            </div>
          </div>

          {currentRole === 'sales_rep' && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs">
              <span>รายการจอง (หนึ่งใบเสนอราคา): <strong>{cartLines.length} ล็อต · {cartTons.toFixed(3)} ตัน</strong></span>
              <button disabled={!cartLines.length} onClick={() => { setBookingFeedback(''); setBookingDialogOpen(true); }} className="rounded bg-blue-600 px-3 py-1.5 font-bold text-white disabled:opacity-40">จองรายการที่เลือก</button>
            </div>
          )}
          <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
            <table className="w-full text-left text-[12.5px] border-collapse">
              <thead className="bg-[var(--table-header)] text-[var(--text-secondary)] font-mono text-[11px] border-b border-[var(--border-color)]">
                <tr>
                  <th className="py-2.5 px-3">รหัสล็อต / เลขหลอม</th>
                  <th className="py-2.5 px-3">รายละเอียดสินค้า & ขนาด</th>
                  <th className="py-2.5 px-3">เกรด & มาตรฐาน</th>
                  <th className="py-2.5 px-3 text-right">น้ำหนักรวม</th>
                  <th className="py-2.5 px-3 text-right">พร้อมขาย (02)</th>
                  <th className="py-2.5 px-3 text-center">พิกัดช่องจัดเก็บ</th>
                  <th className="py-2.5 px-3 text-center">สถานะสินค้า</th>
                  <th className="py-2.5 px-3 text-center">ประเภทและการจอง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {filteredCatalog.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--bg-shell)] transition-colors">
                    <td className="py-2.5 px-3 font-mono">
                      <div className="font-bold text-blue-400">{item.id}</div>
                      <div className="text-[11px] text-[var(--text-secondary)]">เลขหลอม: {item.heatNumber}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-[var(--text-primary)]">{productNameThai(item.productName)}</div>
                      <div className="text-[11px] text-[var(--text-secondary)] font-mono">{item.dimensions}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      <div className="font-bold">{item.grade}</div>
                      <div className="text-[10.5px] text-[var(--text-secondary)]">{item.standard}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-400">
                      {item.totalWeightTons.toFixed(3)} ตัน
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                      {item.availableWeightTons.toFixed(3)} ตัน
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[11.5px]">
                      <span className="px-1.5 py-0.5 rounded bg-[var(--bg-shell)] border border-[var(--border-color)]">
                        {locationThai(item.locationBay)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <StatusBadge status={item.canonicalStatus} size="sm" />
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="text-[10.5px] text-[var(--text-secondary)] mb-1">
                        {workTypeConfigs.find((config) => config.sku === item.productCode)?.workType === 'PROCESSING' ? 'เหล็กแปรรูป' : 'เหล็กสำเร็จรูป'}
                      </div>
                      {currentRole === 'sales_rep' ? (
                        <button onClick={() => toggleCartItem(item.id, item.availableWeightTons)} className={`px-2.5 py-1 rounded text-[10.5px] font-bold ${item.id in bookingCart ? 'border border-blue-500 text-blue-300' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>{item.id in bookingCart ? '✓ เลือกแล้ว · เอาออก' : 'เพิ่มในรายการจอง'}</button>
                      ) : <span className="text-[10px] text-[var(--text-secondary)]">ดูได้ · จองไม่ได้</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {bookingDialogOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="booking-confirm-title">
          <div className="w-full max-w-xl rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-2xl">
            <h2 id="booking-confirm-title" className="text-base font-bold">ยืนยันการจองสินค้า · {cartLines.length} ล็อต</h2>
            <label className="mt-3 block text-xs text-[var(--text-secondary)]">ชื่อลูกค้า
              <input value={bookingCustomer} onChange={(event) => setBookingCustomer(event.target.value)} className="mt-1 w-full rounded border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" placeholder="ระบุลูกค้าที่จองสินค้า" />
            </label>
            <div className="mt-3 max-h-60 overflow-y-auto rounded border border-[var(--border-color)]">
              {cartLines.map(({ lotId, qtyTons, item }) => (
                <div key={lotId} className="flex items-center justify-between gap-2 border-b border-[var(--border-color)] px-3 py-2 text-xs last:border-b-0">
                  <div>
                    <div className="font-mono font-bold text-blue-400">{lotId}</div>
                    <div>{productNameThai(item!.productName)} · {workTypeConfigs.find((config) => config.sku === item!.productCode)?.workType === 'PROCESSING' ? 'เหล็กแปรรูป' : 'เหล็กสำเร็จรูป'}</div>
                  </div>
                  <label className="text-[11px] text-[var(--text-secondary)]">ตัน
                    <input aria-label={`จำนวนที่จอง ${lotId}`} type="number" min="0.001" max={item!.availableWeightTons} step="0.001" value={qtyTons} onChange={(event) => setBookingCart((current) => ({ ...current, [lotId]: Number(event.target.value) }))} className="ml-1 w-24 rounded border border-[var(--border-color)] bg-[var(--input-bg)] px-2 py-1 text-[var(--text-primary)]" />
                  </label>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              สินค้าที่จองจะเปลี่ยนเป็น “[03] สินค้ารอยืนยันขาย (Soft Hold)” กรุณาแนบใบเสนอราคาที่ลูกค้ายืนยันสั่งซื้อภายใน 7 วันนับจากเวลาจอง เพื่อยืนยันเป็น “[04] สินค้าจองตามใบสั่งขาย (Reserved)” หากครบกำหนดโดยยังไม่แนบ ระบบจะยกเลิกการจองและคืนสินค้าเป็น “[02] สินค้าพร้อมเสนอขาย (Available to Promise)” โดยอัตโนมัติ
            </div>
            {bookingFeedback && <p className="mt-2 text-xs text-rose-300">{bookingFeedback}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setBookingDialogOpen(false); setBookingFeedback(''); }} className="rounded border border-[var(--border-color)] px-3 py-2 text-xs">กลับไปเลือกสินค้า</button>
              <button onClick={submitBooking} disabled={!bookingCustomer.trim() || cartInvalid} className="rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">ยืนยันการจอง</button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SO Policy Recommendations (3-Pane Context) */}
      {activeTab === 'recommendations' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* PANE 1: SO Line Navigator (2.5 Cols) */}
          <div className="lg:col-span-3 flex flex-col gap-2.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-3 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
              <span className="font-bold text-[13px] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-500" />
                <span>รายการสินค้าในใบสั่งขาย</span>
              </span>
              <span className="font-mono text-[11px] text-blue-400 font-bold">
                {activeSo.lines.length} รายการ
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {activeSo.lines.map((line) => {
                const isSelected = line.lineNumber === activeLine.lineNumber;
                return (
                  <button
                    key={line.lineNumber}
                    onClick={() =>
                      navigateToWorkspace('WMS-05', {
                        selectedSoId: activeSo.soNumber,
                        selectedLineNumber: line.lineNumber,
                      })
                    }
                    className={`w-full text-left p-2.5 rounded-lg border transition-all flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-blue-500/10 border-blue-500 shadow-xs'
                        : 'bg-[var(--bg-shell)] border-[var(--border-color)] hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[12px] text-blue-400">
                        รายการที่ {line.lineNumber}
                      </span>
                      <span
                        className={`text-[9.5px] font-mono px-1.5 py-0.2 rounded font-bold ${
                          line.selectionStatus === 'RESERVED'
                            ? 'bg-indigo-500/20 text-indigo-400'
                            : line.selectionStatus === 'SOFT_HOLD'
                            ? 'bg-amber-500/20 text-amber-400'
                            : line.selectionStatus === 'SELECTION_PENDING'
                            ? 'bg-sky-500/20 text-sky-400'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {( { RESERVED: 'จองตามใบสั่งขาย', SOFT_HOLD: 'รอยืนยันการจอง', SELECTION_PENDING: 'รอเลือกสินค้า', NOT_STARTED: 'ยังไม่เริ่ม' } as Record<string, string>)[line.selectionStatus] || line.selectionStatus}
                      </span>
                    </div>

                    <div className="text-[11.5px] font-semibold text-[var(--text-primary)] line-clamp-2">
                      {productNameThai(line.specDescription)}
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-secondary)] pt-1 border-t border-[var(--border-color)]">
                      <span>ขอ: {line.requestedQtyTons.toFixed(1)} ตัน</span>
                      <span className="text-emerald-400 font-bold">
                        จัดสรร: {line.selectedQtyTons.toFixed(1)} ตัน
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PANE 2: Candidate Recommendations Table & Slicing (6 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs overflow-hidden flex flex-col">
              {/* Header & Policy Run ID */}
              <div className="p-3 bg-[var(--bg-shell)] border-b border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-[13px] font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-500" />
                    <span>สินค้าที่จองผูกกับใบสั่งขายแล้ว ([04])</span>
                  </div>
                  <div className="text-[11px] font-mono text-[var(--text-secondary)] mt-0.5">
                    นโยบายแนะนำสินค้า (รุ่น {currentPolicy.version}) • เลขรอบประมวลผล: <strong className="text-blue-400">{policyRunId}</strong> • เกณฑ์อายุ: &gt;{agingThreshold} วัน
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] mt-1">
                    ฝ่ายขายเลือกดูได้เฉพาะล็อต [04] ที่ผูกกับใบสั่งขายและรายการแล้ว; สินค้า [02] ค้นหาได้จากแท็บค้นหาสินค้าเท่านั้น
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[10px] font-bold border border-emerald-500/20">
                    ป้องกันข้อมูลทับซ้อน: v2.10
                  </span>
                </div>
              </div>

              {/* Table of Candidates */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px] border-collapse">
                  <thead className="bg-[var(--table-header)] text-[var(--text-secondary)] font-mono text-[10.5px] border-b border-[var(--border-color)]">
                    <tr>
                      <th className="py-2.5 px-3">ล็อตที่จองตามใบสั่งขาย</th>
                      <th className="py-2.5 px-3">ข้อมูลสินค้า</th>
                      <th className="py-2.5 px-3 text-center">พิกัด & สถานะ</th>
                      <th className="py-2.5 px-3 text-right">จองตามใบสั่งขาย (04)</th>
                      <th className="py-2.5 px-3 text-right">จำนวนที่เลือก</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {candidateLots.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 px-3 text-center text-[var(--text-secondary)]">
                          ไม่มีล็อตสถานะ [04] ที่จองผูกกับใบสั่งขายและรายการนี้; สินค้า [02] ค้นหาได้จากแท็บค้นหาสินค้าเท่านั้น
                        </td>
                      </tr>
                    )}
                    {candidateLots.map((cand, idx) => {
                      const reservedSlice = activeLine.selectionSlices.find((slice) => slice.lotId === cand.item.id);
                      const isReservedForLine = activeLine.selectionStatus === 'RESERVED' && !!reservedSlice;
                      const selectedQty = reservedSlice?.qtyTons || 0;

                      return (
                        <tr
                          key={cand.item.id}
                          className={`transition-colors ${isReservedForLine ? 'bg-indigo-500/10' : ''}`}
                        >
                          <td className="py-2.5 px-3 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                  idx === 0
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-slate-700 text-slate-300'
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <span className="font-bold text-blue-400">{cand.item.id}</span>
                            </div>
                            <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                              เลขหลอม: {cand.item.heatNumber} • รุ่นข้อมูล {cand.item.statusVersion}
                            </div>
                            <div className="text-[9.5px] text-[var(--text-secondary)]">
                              ปรับปรุงเมื่อ: {cand.item.lastUpdated}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-1.5 py-0.2 rounded font-mono text-[10.5px] font-bold ${
                                  cand.isAgingClearance
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-emerald-500/20 text-emerald-300'
                                }`}
                              >
                                คะแนนความเหมาะสม {cand.score}%
                              </span>
                              {cand.isAgingClearance && (
                                <span className="px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-300 font-mono text-[9.5px] font-bold">
                                  ลำดับเร่งด่วน: สินค้าเก่า
                                </span>
                              )}
                            </div>
                            <div className="text-[10.5px] text-[var(--text-primary)] font-medium mt-1">
                              {cand.reason}
                            </div>
                            <div className="text-[10px] text-[var(--text-secondary)] font-mono">
                              ฐานอายุ: {cand.ageDays} วัน (เกณฑ์นโยบาย {currentPolicy.version} &gt;{agingThreshold} วัน)
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            <div className="font-bold text-[11px] text-[var(--text-primary)]">
                              {locationThai(cand.item.locationBay)}
                            </div>
                            <div className="mt-1">
                              <StatusBadge status={cand.item.canonicalStatus} size="sm" />
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-400">
                    <div>{cand.item.availableWeightTons.toFixed(3)} ตัน</div>
                            <div className="text-[10px] text-[var(--text-secondary)] font-normal">
                              สิทธิ์ [02]
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="font-mono font-bold text-indigo-400">{selectedQty.toFixed(3)} ตัน</span>
                          </td>
                        </tr>
                      );
                    })}

                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-[var(--bg-shell)] border-t border-[var(--border-color)] text-[11.5px] text-[var(--text-secondary)]">
                รายการนี้แสดงล็อต [04] ที่ผูกกับใบสั่งขายและรายการแล้ว; ค้นหาสต็อก [02] ได้จากแท็บค้นหาสินค้า โดยไม่เลือกหรือจองจากหน้านี้
              </div>
            </div>
          </div>

          {/* PANE 3: Read-Only System One Attestation & Manager Gate (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-3">
            {/* System One Read-Only Box */}
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-3.5 shadow-xs flex flex-col gap-2.5 text-[12px]">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
                <span className="font-bold flex items-center gap-1.5 text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                <span>ข้อมูลยืนยันจากระบบหน้าบ้าน (อ่านอย่างเดียว)</span>
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  ยืนยันแล้ว
                </span>
              </div>

              <div className="space-y-1.5 text-[11.5px]">
                <div className="p-2 rounded bg-[var(--bg-shell)] border border-[var(--border-color)] flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">การอนุมัติใบสั่งขาย:</span>
                  <span className="font-mono font-bold text-emerald-400">{activeSo.approvalRef} ผ่าน</span>
                </div>
                <div className="p-2 rounded bg-[var(--bg-shell)] border border-[var(--border-color)] flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">สถานะชำระเงินจากระบบหน้าบ้าน (อ่านอย่างเดียว):</span>
                  <span className={`font-mono font-bold ${activeSo.paymentAttestRef ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {activeSo.paymentAttestRef ? `ยืนยันแล้ว · อ้างอิง ${activeSo.paymentAttestRef}` : 'รอยืนยัน · ยังไม่ได้รับข้อมูลรับรอง'}
                  </span>
                </div>
                <div className="p-2 rounded bg-[var(--bg-shell)] border border-[var(--border-color)] flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">ป้องกันข้อมูลทับซ้อน:</span>
                  <span className="font-mono font-bold text-blue-400">{activeSo.optimisticLockVersion} ผ่าน</span>
                </div>
              </div>

              <div className="text-[10.5px] text-[var(--text-secondary)] italic pt-1 border-t border-[var(--border-color)]">
                * อ่านเฉพาะสถานะชำระเงินและเลขอ้างอิงจากระบบหน้าบ้าน; ระบบคลังไม่แสดงหรือจัดเก็บยอดเงิน เครดิต หรือเงื่อนไขการค้า
              </div>
            </div>

            {/* Manager-Only Allocation Panel */}
            <div className="bg-[var(--bg-card)] rounded-xl border-2 border-indigo-500/40 p-4 shadow-md flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-indigo-600 text-white flex items-center justify-center font-bold text-[11px]">
                    M
                  </div>
                  <div>
                    <span className="font-bold text-[13px] block">แผงอนุมัติการจัดสรร</span>
                    <span className="text-[10px] text-indigo-400 font-semibold">(เฉพาะผู้จัดการคลัง)</span>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${
                    allGatesPass
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {allGatesPass ? 'ผ่าน 5 / 5 ข้อ' : 'รอเงื่อนไข'}
                </span>
              </div>

              {/* 5 Gates Checklist */}
              <div className="space-y-1 text-[11.5px]">
                <div className="flex items-center justify-between p-1.5 rounded bg-[var(--bg-shell)]">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isGate1Pass ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span>1. สินค้าถูกจอง [04] ตามใบสั่งขายและรายการแล้ว</span>
                  </div>
                  <span className={`font-mono text-[10px] font-bold ${isGate1Pass ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {isGate1Pass ? 'ผ่าน' : 'รอดำเนินการ'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-1.5 rounded bg-[var(--bg-shell)]">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isGate2Pass ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span>2. ใบสั่งขายผ่านการอนุมัติ</span>
                  </div>
                  <span className="font-mono text-[10px] text-emerald-400 font-bold">ผ่าน</span>
                </div>

                <div className="flex items-center justify-between p-1.5 rounded bg-[var(--bg-shell)]">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isGate3Pass ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span>3. ยืนยันสิทธิ์ให้คลังเริ่มจัดสินค้าแล้ว</span>
                  </div>
                  <span className="font-mono text-[10px] text-emerald-400 font-bold">ผ่าน</span>
                </div>

                <div className="flex items-center justify-between p-1.5 rounded bg-[var(--bg-shell)]">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isGate4Pass ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span>4. ปริมาณสินค้าตรงตามคำขอ</span>
                  </div>
                  <span className="font-mono text-[10px] text-emerald-400 font-bold">ผ่าน</span>
                </div>

                <div className="flex items-center justify-between p-1.5 rounded bg-[var(--bg-shell)]">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isGate5Pass ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span>5. ไม่มีรายการแก้ไขข้อมูลพร้อมกัน</span>
                  </div>
                  <span className="font-mono text-[10px] text-emerald-400 font-bold">ผ่าน</span>
                </div>
              </div>

              {/* Action Buttons */}
              {isAlreadyReserved ? (
                <div className="flex flex-col gap-2 pt-1">
                  <div className="p-2 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11.5px] font-bold text-center flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>สถานะสินค้า [04] จองตามใบสั่งขายแล้ว</span>
                  </div>
                  <button
                    onClick={handleCreatePick}
                    disabled={currentRole !== 'warehouse_manager'}
                    title={currentRole !== 'warehouse_manager' ? 'เฉพาะผู้จัดการคลังออกใบหยิบได้' : undefined}
                    className={`w-full py-2 px-3 rounded-lg text-white font-bold text-[12.5px] flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-55 disabled:cursor-not-allowed ${
                      currentRole !== 'warehouse_manager'
                        ? 'bg-slate-700 text-slate-300 border border-amber-500/30'
                        : 'bg-emerald-600 hover:bg-emerald-500'
                    }`}
                  >
                    {currentRole !== 'warehouse_manager' ? <Lock className="w-4 h-4 text-amber-400" /> : <Truck className="w-4 h-4" />}
                    <span>
                      {currentRole !== 'warehouse_manager'
                        ? 'สร้างใบหยิบสินค้าใน WMS-06 [🔒 เฉพาะ ผจก.คลัง]'
                        : 'สร้างใบหยิบสินค้าใน WMS-06'}
                    </span>
                  </button>
                  {currentRole !== 'warehouse_manager' && (
                    <span className="text-[10px] text-amber-400 text-center font-mono">
                      * สินค้าจอง [04] ตามใบสั่งขายแล้ว; ผู้จัดการคลังเป็นผู้สร้างใบหยิบได้
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1 pt-1">
                  <button
                    onClick={handleManagerApprove}
                    disabled={isManagerApproving || currentRole !== 'warehouse_manager' || !allGatesPass}
                    title={currentRole !== 'warehouse_manager' ? 'เฉพาะผู้จัดการคลังอนุมัติ 03 → 04 ได้' : !allGatesPass ? 'ต้องผ่านการตรวจสอบใบสั่งขาย การชำระเงิน จำนวน และรุ่นข้อมูลก่อน' : undefined}
                    className={`w-full py-2 px-3 rounded-lg text-white font-bold text-[12.5px] flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-55 disabled:cursor-not-allowed ${
                      currentRole !== 'warehouse_manager'
                        ? 'bg-indigo-900/60 text-indigo-300 border border-amber-500/40'
                        : 'bg-indigo-600 hover:bg-indigo-500'
                    }`}
                  >
                    {isManagerApproving ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>กำลังล็อกสถานะ [04]...</span>
                      </>
                    ) : (
                      <>
                        <Lock className={`w-4 h-4 ${currentRole !== 'warehouse_manager' ? 'text-amber-400' : ''}`} />
                        <span>
                          {currentRole !== 'warehouse_manager'
                            ? 'อนุมัติการจัดสรร 03 → 04 [🔒 เฉพาะ ผจก.คลัง]'
                            : allGatesPass ? 'อนุมัติการจัดสรร [03] → [04] Reserved' : 'รอผ่าน Gate ก่อนอนุมัติ [03] → [04]'}
                        </span>
                      </>
                    )}
                  </button>
                  {currentRole !== 'warehouse_manager' && (
                    <span className="text-[10px] text-amber-400 text-center font-mono">
                      * ฝ่ายขายยืนยันจองตามใบสั่งขายเป็น [04] ได้; การสร้างใบหยิบจำกัดเฉพาะผู้จัดการคลัง
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Dedicated Manager Allocation Cockpit */}
      {activeTab === 'manager_allocation' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 shadow-xs flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-color)]">
            <div>
              <h2 className="text-[15px] font-bold flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-400" />
                <span>แผงอนุมัติการจัดสรรสินค้า</span>
              </h2>
              <p className="text-[12px] text-[var(--text-secondary)]">
                ตรวจสอบและอนุมัติการจัดสรรรายการ [03] รอยืนยัน ให้เป็น [04] จองตามใบสั่งขาย และสั่งออกใบหยิบ (เฉพาะผู้จัดการคลัง)
              </p>
            </div>
            <span className="font-mono text-[11px] px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
              สิทธิ์ผู้จัดการคลัง
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {soRequests.map((so) => (
              <div
                key={so.id}
                className="p-3.5 rounded-xl bg-[var(--bg-shell)] border border-[var(--border-color)] flex flex-col gap-2.5 text-[12px]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-blue-400 text-[13px]">{so.soNumber}</span>
                  <span
                    className={`font-mono text-[10.5px] px-2 py-0.5 rounded font-bold ${
                      so.status === 'RESERVED'
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : so.status === 'SOFT_HOLD'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {( { PENDING: 'รอดำเนินการ', APPROVED: 'อนุมัติแล้ว', REJECTED: 'ไม่อนุมัติ', DRAFT: 'ฉบับร่าง' } as Record<string, string>)[so.status] || so.status}
                  </span>
                </div>

                <div className="font-bold text-[var(--text-primary)]">{so.customerName}</div>

                <div className="divide-y divide-[var(--border-color)] pt-1">
                  {so.lines.map((l) => (
                    <div key={l.lineNumber} className="py-2 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium text-[var(--text-primary)]">
                          รายการที่ {l.lineNumber}: {productNameThai(l.specDescription)}
                        </div>
                        <div className="font-mono text-[11px] text-[var(--text-secondary)]">
                          ขอ: {l.requestedQtyTons} ตัน • เลือกแล้ว: {l.selectedQtyTons} ตัน • สถานะ: [{l.selectionStatus === 'RESERVED' ? 'จองแล้ว' : l.selectionStatus === 'SOFT_HOLD' ? 'รอยืนยันขาย' : 'รอเลือก'}]
                        </div>
                      </div>

                      <div>
                        {l.selectionStatus === 'SOFT_HOLD' ? (
                          <button
                            onClick={() => managerApproveAllocation(so.soNumber, l.lineNumber)}
                            disabled={currentRole !== 'warehouse_manager'}
                            title={currentRole !== 'warehouse_manager' ? 'เฉพาะผู้จัดการคลังเปลี่ยน [03] เป็น [04] ได้' : undefined}
                            className={`px-3 py-1 rounded font-bold text-[11px] shadow-xs flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                              currentRole !== 'warehouse_manager'
                                ? 'bg-slate-700 text-slate-300 border border-amber-500/30'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            }`}
                          >
                            <Lock className={`w-3.5 h-3.5 ${currentRole !== 'warehouse_manager' ? 'text-amber-400' : ''}`} />
                            <span>
                              {currentRole !== 'warehouse_manager'
                                ? 'อนุมัติ [03]→[04] [🔒 เฉพาะ ผจก.]'
                                : 'อนุมัติ [03] → [04]'}
                            </span>
                          </button>
                        ) : l.selectionStatus === 'RESERVED' ? (
                          <button
                            onClick={() => createPickTaskForReserved(so.soNumber, l.lineNumber)}
                            disabled={currentRole !== 'warehouse_manager'}
                            title={currentRole !== 'warehouse_manager' ? 'เฉพาะผู้จัดการคลังออกใบหยิบจาก [04] ได้' : undefined}
                            className={`px-3 py-1 rounded font-bold text-[11px] shadow-xs flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                              currentRole !== 'warehouse_manager'
                                ? 'bg-slate-700 text-slate-300 border border-amber-500/30'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                          >
                            {currentRole !== 'warehouse_manager' ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Truck className="w-3.5 h-3.5" />}
                            <span>
                              {currentRole !== 'warehouse_manager'
                                ? 'ออกใบหยิบ [🔒 เฉพาะ ผจก.]'
                                : 'ออกใบหยิบ WMS-06'}
                            </span>
                          </button>
                        ) : (
                          <span className="text-[10.5px] text-slate-400 font-mono">รอฝ่ายขายจัดสรร</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Dedicated Stock Replacement Dashboard */}
      {activeTab === 'replacement' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 shadow-xs flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-color)]">
            <div>
              <h2 className="text-[15px] font-bold flex items-center gap-2">
                <Split className="w-5 h-5 text-rose-500" />
                <span>กระบวนการเปลี่ยนสินค้าแทน</span>
              </h2>
              <p className="text-[12px] text-[var(--text-secondary)]">
                กฎสำคัญ: เมื่อพบสินค้าชำรุด ผู้จัดการคลังเสนอสินค้าทดแทนตามนโยบาย → ฝ่ายขายตอบรับ → ระบบหนึ่งออกสถานะรอยืนยันขาย [03] → ผู้จัดการคลังอนุมัติ [04] → ออกใบหยิบทดแทน
              </p>
            </div>
            <span className="font-mono text-[11px] px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
              {replacementProposals.length} รายการข้อเสนอ
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {replacementProposals.map((prop) => (
              <div
                key={prop.id}
                className="p-4 rounded-xl bg-[var(--bg-shell)] border border-[var(--border-color)] flex flex-col gap-3 text-[12.5px]"
              >
                <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-400">{prop.id}</span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                      ใบสั่งขาย: {prop.soNumber} • รายการที่ {prop.lineNumber}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-[11px] px-2.5 py-0.5 rounded font-bold border ${
                      prop.status === 'MANAGER_APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : prop.status === 'SYSTEM_ONE_HOLD'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : prop.status === 'SALES_ACCEPTED'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    สถานะ: {( { PROPOSED: 'รอพิจารณา', MANAGER_APPROVED: 'ผู้จัดการอนุมัติแล้ว', SYSTEM_ONE_HOLD: 'รอระบบหน้าบ้านยืนยัน', SALES_ACCEPTED: 'ฝ่ายขายยอมรับ', SALES_REJECTED: 'ฝ่ายขายไม่ยอมรับ' } as Record<string, string>)[prop.status] || prop.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[12px]">
                  <div className="p-2.5 rounded bg-[var(--bg-card)] border border-rose-500/30">
                    <span className="text-rose-400 font-bold block mb-1">สินค้าเดิมที่ชำรุด:</span>
                    <div>รหัสล็อต: <strong className="text-rose-400">{prop.originalLotId}</strong></div>
                    <div>พิกัดเดิม: {prop.originalBay} • น้ำหนัก: {prop.qtyTons} ตัน</div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-1">สาเหตุ: {prop.defectNote}</div>
                  </div>

                  <div className="p-2.5 rounded bg-[var(--bg-card)] border border-blue-500/30">
                    <span className="text-blue-400 font-bold block mb-1">ล็อตทดแทนที่ระบบและผู้จัดการเสนอ:</span>
                    <div>รหัสล็อต: <strong className="text-blue-400">{prop.proposedLotId}</strong></div>
                    <div>พิกัดจัดเก็บ: {prop.proposedBay} • น้ำหนัก: {prop.qtyTons} ตัน</div>
                    <div className="text-[11px] text-emerald-400 mt-1">✓ สเปกตรง เกรดตรง ได้รับการคัดกรองจากนโยบาย</div>
                  </div>
                </div>

                {/* Workflow Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-color)]">
                  <div className="text-[11.5px] text-[var(--text-secondary)]">
                    เสนอโดย: {prop.proposedBy} เมื่อ {prop.proposedAt}
                  </div>

                  <div className="flex items-center gap-2">
                    {prop.status === 'PROPOSED' && (
                      <>
                        <button
                          onClick={() => rejectReplacementProposal(prop.id, 'ฝ่ายขายขอยกเลิกรายการ')}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold"
                        >
                          ฝ่ายขายปฏิเสธ
                        </button>
                        <button
                          onClick={() => acceptReplacementProposal(prop.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1"
                        >
                          <Check className="w-4 h-4" />
                          <span>ฝ่ายขายยอมรับ (ส่งขอสถานะ [03] รอยืนยันขาย)</span>
                        </button>
                      </>
                    )}

                    {prop.status === 'SYSTEM_ONE_HOLD' && (
                      <button
                        onClick={() => {
                          if (currentRole === 'sales_rep') {
                            triggerGateBlocked({
                              title: 'ไม่อนุญาตให้ฝ่ายขายอนุมัติสินค้าทดแทน',
                              unmetGates: ['เฉพาะผู้จัดการคลังสินค้าเท่านั้นที่สามารถอนุมัติเปลี่ยนสถานะสินค้าทดแทนจาก [03] Soft Hold เป็น [04] Reserved ได้'],
                              recoveryRoute: 'สลับสิทธิ์ผู้ใช้เป็นผู้จัดการคลังที่แถบด้านบน',
                            });
                            return;
                          }
                          managerApproveReplacementHoldToReserved(prop.id);
                        }}
                        className={`px-4 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-xs ${
                          currentRole === 'sales_rep'
                            ? 'bg-slate-700 hover:bg-slate-600 text-slate-300 border border-amber-500/30 cursor-pointer'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                      >
                        <Lock className={`w-4 h-4 ${currentRole === 'sales_rep' ? 'text-amber-400' : ''}`} />
                        <span>
                          {currentRole === 'sales_rep'
                            ? 'ผจก.คลัง อนุมัติเป็น [04] [🔒 เฉพาะ ผจก.]'
                            : 'ผจก.คลัง อนุมัติเป็น [04] Reserved'}
                        </span>
                      </button>
                    )}

                    {prop.status === 'MANAGER_APPROVED' && (
                      <button
                        onClick={() => createPickTaskForReplacement(prop.id)}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-xs"
                      >
                        <Truck className="w-4 h-4" />
                        <span>ออกใบสั่งหยิบสินค้าทดแทนใน WMS-06</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
