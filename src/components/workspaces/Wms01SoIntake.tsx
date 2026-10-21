import React, { useState } from 'react';
import { useWms } from '../../context/WmsContext';
import { StatusBadge } from '../common/StatusBadge';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Search,
  ExternalLink,
  ShieldCheck,
  Edit2,
  Save,
  Clock,
  Layers,
  Truck,
  RefreshCw,
  Copy,
  AlertOctagon,
} from 'lucide-react';

const statusLabelTh: Record<string, string> = {
  DRAFT: 'ฉบับร่าง',
  VERIFIED: 'ตรวจสอบแล้ว',
  SELECTION_PENDING: 'รอเลือกสินค้า',
  SOFT_HOLD: 'รอยืนยันสินค้า',
  RESERVED: 'จองตามใบสั่งขาย',
  ALLOCATED: 'จัดสรรแล้ว',
  PICKED: 'หยิบแล้ว',
  DELIVERED: 'ส่งมอบแล้ว',
  NOT_STARTED: 'ยังไม่เริ่ม',
  ACK_PENDING: 'รอยืนยันรับรายการ',
  RETRYING: 'กำลังส่งข้อมูลซ้ำ',
  STALE: 'ข้อมูลไม่เป็นปัจจุบัน',
  REJECTED: 'ไม่ผ่านการยืนยัน',
  PARSE_SUCCESS: 'อ่านข้อมูลสำเร็จ',
  LOW_CONFIDENCE: 'ข้อมูลไม่ชัดเจน',
  PARSE_FAILED: 'อ่านข้อมูลไม่สำเร็จ',
  TIMEOUT: 'หมดเวลารอผลอ่านข้อมูล',
  REQUESTED: 'รอยืนยันคิว',
  CONFIRMED: 'ยืนยันคิวแล้ว',
  CHANGED: 'แก้ไขคิวแล้ว',
  CANCELLED: 'ยกเลิกแล้ว',
};

const getStatusLabelTh = (status: string): string => statusLabelTh[status] || status;
const getCustomerNameTh = (name: string): string => name.replace(/\s+\([A-Za-z0-9 ,.&-]+\)\s*$/, '').trim();
const getVehicleNameTh = (name: string): string => name.replace(/\s*\([^)]*\)/g, '').trim();

export const Wms01SoIntake: React.FC = () => {
  const {
    inventory,
    soRequests,
    currentRole,
    verifySoRequest,
    uploadSoPdfSimulation,
    updateSoLinePermitted,
    updateSalesReservationSelection,
    resolveOcrRecovery,
    navigateToWorkspace,
    navContext,
  } = useWms();

  const [activeTab, setActiveTab] = useState<'requests' | 'upload' | 'waiting' | 'manager' | 'logistics'>(
    navContext.tabIndex === 1 ? 'upload' : 'requests'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSoId, setSelectedSoId] = useState<string>(
    navContext.selectedSoId || (soRequests[0]?.soNumber ?? '')
  );

  const [editingLine, setEditingLine] = useState<{
    soId: string;
    lineNumber: number;
    spec: string;
    qtyTons: number;
    uom: string;
  } | null>(null);
  const [editingReservationSelection, setEditingReservationSelection] = useState<{
    soId: string;
    lineNumber: number;
    slices: { lotId: string; qtyTons: number }[];
  } | null>(null);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSimulatingOcr, setIsSimulatingOcr] = useState(false);

  // Recovery note input
  const [recoveryNote, setRecoveryNote] = useState('');

  const activeSo = soRequests.find((s) => s.id === selectedSoId || s.soNumber === selectedSoId) || soRequests[0];
  const hasReservedSalesLine = (so: typeof soRequests[number]) => so.lines.some((line) =>
    line.selectionStatus === 'RESERVED' && line.selectionSlices.some((slice) => {
      const item = inventory.find((candidate) => candidate.id === slice.lotId);
      return item?.canonicalStatus === '04' && item.reservedWeightTons >= slice.qtyTons - 0.001;
    })
  );

  const handleSimulatedUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSimulatingOcr(true);
    setUploadProgress(20);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (!prev || prev >= 100) {
          clearInterval(interval);
          setIsSimulatingOcr(false);
          uploadSoPdfSimulation(file);
          return null;
        }
        return prev + 30;
      });
    }, 200);
  };

  const handleSaveLine = () => {
    if (!editingLine) return;
    updateSoLinePermitted(
      editingLine.soId,
      editingLine.lineNumber,
      editingLine.spec,
      editingLine.qtyTons,
      editingLine.uom
    );
    setEditingLine(null);
  };

  const handleSaveReservationSelection = () => {
    if (!editingReservationSelection) return;
    const slices = editingReservationSelection.slices.filter((slice) => slice.qtyTons > 0);
    if (updateSalesReservationSelection(
      editingReservationSelection.soId,
      editingReservationSelection.lineNumber,
      slices
    )) {
      setEditingReservationSelection(null);
    }
  };

  const filteredRequests = soRequests.filter(
    (so) =>
      so.soNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      so.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4 text-[var(--text-primary)]">
      {/* Workspace Header / Context Banner */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[17px] font-bold">WMS-01 งานคลังและคำขอ</h1>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20">
                  รับใบสั่งขาย
                </span>
              </div>
              <p className="text-[12px] text-[var(--text-secondary)]">
                ตรวจใบสั่งขายและดูเฉพาะสินค้าสถานะ [04] ที่จองผูกกับใบสั่งขายและรายการแล้ว; ค้นหาสินค้า [02] ได้ที่หน้าสินค้าและจัดสรร
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[12.5px] cursor-pointer shadow-xs transition-colors">
              <UploadCloud className="w-4 h-4" />
              <span>อัปโหลดใบสั่งขาย</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg"
                className="hidden"
                onChange={handleSimulatedUpload}
              />
            </label>
          </div>
        </div>

        {/* 5 Operational Tabs */}
        <div className="flex items-center gap-1.5 pt-3 overflow-x-auto text-[12.5px]">
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'requests'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-shell)]'
            }`}
          >
            1. รายการคำขอทั้งหมด ({soRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-shell)]'
            }`}
          >
            <span>2. นำเข้าและตรวจข้อมูล</span>
            {isSimulatingOcr && <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />}
          </button>
          <button
            onClick={() => setActiveTab('waiting')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'waiting'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-shell)]'
            }`}
          >
            <span>3. เลือกใบสั่งขายที่มีสินค้า [04] จองแล้ว</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono">
              {soRequests.filter(hasReservedSalesLine).length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('manager')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'manager'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-shell)]'
            }`}
          >
            <span>4. คิวผู้จัดการคลัง</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
              {soRequests.filter((s) => s.status === 'SOFT_HOLD').length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('logistics')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'logistics'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-shell)]'
            }`}
          >
            <span>5. คำขอจากฝ่ายขนส่ง</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono">
              {soRequests.filter((s) => !!s.bookingRequest).length}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: Requests Table & Review Split View */}
      {activeTab === 'requests' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Requests List (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-3">
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs overflow-hidden flex flex-col">
              <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-shell)] flex items-center justify-between">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาเลขที่ใบสั่งขาย / ลูกค้า..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="divide-y divide-[var(--border-color)] max-h-[550px] overflow-y-auto">
                {filteredRequests.map((so) => {
                  const isSelected = activeSo?.id === so.id;
                  return (
                    <div
                      key={so.id}
                      onClick={() => setSelectedSoId(so.soNumber)}
                      className={`p-3 cursor-pointer transition-colors flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-blue-500/10 border-l-4 border-blue-500'
                          : 'hover:bg-[var(--bg-shell)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[13px] text-blue-400">
                          {so.soNumber}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                            so.status === 'RESERVED'
                              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                              : so.status === 'SOFT_HOLD'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : so.status === 'SELECTION_PENDING'
                              ? 'bg-sky-500/20 text-sky-300'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {getStatusLabelTh(so.status)}
                        </span>
                      </div>

                      <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">
                        {getCustomerNameTh(so.customerName)}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-mono">
                        <span>{so.lines.length} รายการสเปก</span>
                        <span className={so.ocrConfidence < 85 ? 'text-amber-400 font-bold' : ''}>
                          ความแม่นยำการอ่าน: {so.ocrConfidence}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: SO Document Review & Permitted Lines (8 Cols) */}
          <div className="lg:col-span-8 flex flex-col gap-3">
            {activeSo ? (
              <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs p-4 flex flex-col gap-4">
                {/* Active SO Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[16px] font-bold text-blue-400">
                        {activeSo.soNumber}
                      </span>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">
                        รหัสตรวจสอบไฟล์: {activeSo.fileFingerprint.substring(0, 16)}...
                      </span>
                    </div>
                    <div className="text-[14px] font-bold text-[var(--text-primary)] mt-0.5">
                      {getCustomerNameTh(activeSo.customerName)}
                    </div>
                    <div className="text-[11.5px] text-[var(--text-secondary)] font-mono mt-0.5">
                      ไฟล์: {activeSo.fileName} • วันที่คำขอ: {activeSo.requestDate}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {activeSo.status === 'DRAFT' && (
                      <button
                        onClick={() => verifySoRequest(activeSo.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[12px] flex items-center gap-1.5 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>ยืนยันใบสั่งขาย</span>
                      </button>
                    )}

                    <button
                      onClick={() =>
                        navigateToWorkspace('WMS-05', {
                          selectedSoId: activeSo.soNumber,
                          selectedLineNumber: 1,
                          tabIndex: 0,
                        })
                      }
                      className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[12.5px] flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <span>ค้นหาสินค้า [02] ในหน้าสินค้าและจัดสรร</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* System One Attestation Strip */}
                <div className="p-3 bg-[var(--bg-shell)] rounded-lg border border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12px]">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>ข้อมูลยืนยันจากระบบขาย (อ่านอย่างเดียว ไม่แสดงราคา/ยอดเงิน)</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 font-mono text-[11.5px]">
                    <div className="flex items-center gap-1">
                      <span className="text-[var(--text-secondary)]">การอนุมัติใบสั่งขาย:</span>
                      <span className="font-semibold text-emerald-400">{activeSo.approvalRef}</span>
                    </div>
                    <span className="text-slate-500">|</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[var(--text-secondary)]">หลักฐานยืนยันการชำระ:</span>
                      <span className="font-semibold text-emerald-400">{activeSo.paymentAttestRef}</span>
                    </div>
                    <span className="text-slate-500">|</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[var(--text-secondary)]">รุ่นข้อมูล:</span>
                      <span className="font-semibold text-blue-400">{activeSo.optimisticLockVersion} OK</span>
                    </div>
                  </div>
                </div>

                {/* Lines Table */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[13px] font-bold">
                    <span>รายการสินค้าและสเปกในคำสั่งซื้อ</span>
                    <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                      ฝ่ายขายเลือกจำนวนจากล็อต [04] ที่จองให้ใบสั่งขายได้
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
                    <table className="w-full text-left text-[12.5px] border-collapse">
                      <thead className="bg-[var(--bg-shell)] text-[var(--text-secondary)] font-mono text-[11px] border-b border-[var(--border-color)]">
                        <tr>
                          <th className="py-2.5 px-3 w-12 text-center">รายการ</th>
                          <th className="py-2.5 px-3">รหัสและรายละเอียดสเปกสินค้า</th>
                          <th className="py-2.5 px-3 text-right">ปริมาณที่ขอ</th>
                          <th className="py-2.5 px-3 text-right">จำนวนที่เลือก</th>
                          <th className="py-2.5 px-3 text-right">คงเหลือ</th>
                          <th className="py-2.5 px-3 text-center">สถานะการเลือก</th>
                          <th className="py-2.5 px-3">ล็อตที่จองตามใบสั่งขาย ([04])</th>
                          <th className="py-2.5 px-3 text-center">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-color)]">
                        {activeSo.lines.map((line) => {
                          const isEditing =
                            editingLine?.soId === activeSo.id &&
                            editingLine?.lineNumber === line.lineNumber;
                          const isEditingReservation =
                            editingReservationSelection?.soId === activeSo.id &&
                            editingReservationSelection?.lineNumber === line.lineNumber;
                          const reservationSlices = line.reservationSlices ?? line.selectionSlices;
                          const reservedLots = line.selectionStatus === 'RESERVED'
                            ? reservationSlices.flatMap((slice) => {
                                const item = inventory.find((candidate) => candidate.id === slice.lotId);
                                return item && item.canonicalStatus === '04' && item.reservedWeightTons >= slice.qtyTons - 0.001
                                  ? [{ item, reservedQtyTons: slice.qtyTons, selectedQtyTons: line.selectionSlices.find((selected) => selected.lotId === slice.lotId)?.qtyTons ?? 0 }]
                                  : [];
                              })
                            : [];

                          return (
                            <tr key={line.lineNumber} className="hover:bg-[var(--bg-shell)] transition-colors">
                              <td className="py-3 px-3 text-center font-mono font-bold text-blue-400">
                                #{line.lineNumber}
                              </td>
                              <td className="py-3 px-3">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editingLine.spec}
                                    onChange={(e) =>
                                      setEditingLine({ ...editingLine, spec: e.target.value })
                                    }
                                    className="w-full p-1.5 text-[12px] bg-[var(--input-bg)] border border-blue-500 rounded font-sans"
                                  />
                                ) : (
                                  <div className="flex flex-col">
                                    <span className="font-bold text-[var(--text-primary)]">
                                      {line.specDescription}
                                    </span>
                                    <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                                      รหัสสินค้า: {line.productCode} • {line.requestedPieces} ท่อน/ชิ้น
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-mono">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.001"
                                    value={editingLine.qtyTons}
                                    onChange={(e) =>
                                      setEditingLine({
                                        ...editingLine,
                                        qtyTons: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    className="w-24 text-right p-1 text-[12px] bg-[var(--input-bg)] border border-blue-500 rounded font-mono"
                                  />
                                ) : (
                                  <span className="font-bold text-blue-400">
                                    {line.requestedQtyTons.toFixed(3)} {line.uom.replace(/\s*\([^)]*\)/g, '')}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                                {line.selectedQtyTons.toFixed(3)} ตัน
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-semibold text-amber-400">
                                {line.remainingQtyTons.toFixed(3)} ตัน
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`text-[10.5px] font-mono px-2 py-0.5 rounded font-bold ${
                                    line.selectionStatus === 'RESERVED'
                                      ? 'bg-indigo-500/20 text-indigo-400'
                                      : line.selectionStatus === 'SOFT_HOLD'
                                      ? 'bg-amber-500/20 text-amber-400'
                                      : line.selectionStatus === 'SELECTION_PENDING'
                                      ? 'bg-sky-500/20 text-sky-400'
                                      : 'bg-slate-700 text-slate-300'
                                  }`}
                                >
                                  {getStatusLabelTh(line.selectionStatus)}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                {reservedLots.length > 0 ? (
                                  <div className="flex flex-col gap-1.5">
                                    {reservedLots.map(({ item, reservedQtyTons, selectedQtyTons }) => {
                                      const editSlice = editingReservationSelection?.slices.find((slice) => slice.lotId === item.id);
                                      return (
                                      <div key={item.id} className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono font-bold text-blue-400">{item.id}</span>
                                        <span className="text-[10.5px] text-[var(--text-secondary)]">{item.locationBay} • จอง {reservedQtyTons.toFixed(3)} ตัน</span>
                                        <StatusBadge status="04" size="sm" />
                                        {isEditingReservation ? (
                                          <label className="ml-auto flex items-center gap-1.5 text-[10.5px] text-[var(--text-secondary)]">
                                            เลือก
                                            <input
                                              aria-label={`จำนวนเลือกจากล็อต ${item.id}`}
                                              type="number"
                                              min="0"
                                              max={reservedQtyTons}
                                              step="0.001"
                                              value={editSlice?.qtyTons ?? 0}
                                              onChange={(e) => {
                                                const qtyTons = Math.max(0, Number(e.target.value) || 0);
                                                setEditingReservationSelection((current) => current ? {
                                                  ...current,
                                                  slices: current.slices.map((slice) => slice.lotId === item.id ? { ...slice, qtyTons } : slice),
                                                } : current);
                                              }}
                                              className="w-24 rounded border border-blue-500 bg-[var(--input-bg)] p-1 text-right font-mono text-[12px] text-[var(--text-primary)]"
                                            />
                                            ตัน
                                          </label>
                                        ) : (
                                          <span className="ml-auto text-[10.5px] text-[var(--text-secondary)]">เลือก {selectedQtyTons.toFixed(3)} ตัน</span>
                                        )}
                                      </div>
                                    );})}
                                  </div>
                                ) : (
                                  <span className="text-[10.5px] text-[var(--text-secondary)]">ยังไม่มีสินค้าสถานะ [04] ที่ผูกกับใบสั่งขายและรายการนี้</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {isEditingReservation ? (
                                  <div className="flex justify-center gap-1">
                                    <button
                                      onClick={handleSaveReservationSelection}
                                      className="rounded bg-emerald-600 p-1.5 text-white hover:bg-emerald-500"
                                      title="บันทึกจำนวนที่เลือก"
                                      aria-label="บันทึกจำนวนที่เลือก"
                                    >
                                      <Save className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setEditingReservationSelection(null)}
                                      className="rounded bg-[var(--bg-shell)] p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                      title="ยกเลิก"
                                      aria-label="ยกเลิก"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : isEditing ? (
                                  <button
                                    onClick={handleSaveLine}
                                    className="p-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                                    title="บันทึก"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <div className="flex justify-center gap-1">
                                    {currentRole === 'sales_rep' && reservedLots.length > 0 && (
                                      <button
                                        onClick={() => setEditingReservationSelection({
                                          soId: activeSo.id,
                                          lineNumber: line.lineNumber,
                                          slices: reservedLots.map(({ item, selectedQtyTons }) => ({ lotId: item.id, qtyTons: selectedQtyTons })),
                                        })}
                                        className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-blue-500"
                                        title="เลือกจำนวนจากล็อตที่จอง [04]"
                                        aria-label="เลือกจำนวนจากล็อตที่จอง [04]"
                                      >
                                        <Layers className="h-3.5 w-3.5" />
                                        <span>เลือกจำนวน</span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setEditingLine({
                                        soId: activeSo.id,
                                        lineNumber: line.lineNumber,
                                        spec: line.specDescription,
                                        qtyTons: line.requestedQtyTons,
                                        uom: line.uom,
                                      })}
                                      className="p-1.5 rounded bg-[var(--bg-shell)] hover:bg-slate-700/50 text-[var(--text-secondary)] hover:text-white"
                                      title="แก้ไขสเปก/ปริมาณที่ขอ"
                                      aria-label="แก้ไขสเปก/ปริมาณที่ขอ"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bottom Notice: Booking requests do not mutate inventory */}
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11.5px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold">
                      ข้อกำหนด: รับใบสั่งขายและจองคิวรถแล้ว สต็อกยังไม่ถูกตัด
                    </span>
                    <span>
                      แสดงเฉพาะสินค้าสถานะ [04] ที่ผูกกับใบสั่งขายและรายการแล้ว; การจองรถไม่เปลี่ยนสถานะสินค้า การหยิบและส่งมอบทำต่อใน WMS-06
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] text-center text-[var(--text-secondary)]">
                ไม่พบคำสั่งซื้อที่เลือก
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Upload SO & OCR Review / Recovery */}
      {activeTab === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-6 flex flex-col gap-3">
            <div className="p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs flex flex-col gap-3">
              <span className="font-bold text-[14px] flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-blue-500" />
                <span>อัปโหลดเอกสารคำสั่งซื้อ</span>
              </span>

              <label className="border-2 border-dashed border-[var(--border-color)] hover:border-blue-500 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-[var(--bg-shell)]">
                <UploadCloud className="w-10 h-10 text-blue-500 mb-2 opacity-80" />
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                  วางไฟล์เอกสารที่นี่ หรือคลิกเพื่อเลือกไฟล์
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] mt-1">
                  ระบบจะสกัดลายเซ็นดิจิทัล SHA-256 และตรวจสอบไฟล์ซ้ำซ้อนโดยอัตโนมัติ
                </span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg"
                  className="hidden"
                  onChange={handleSimulatedUpload}
                />
              </label>

              {/* Duplicate Fingerprint Test Button */}
              <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between">
                <span className="text-[11.5px] text-[var(--text-secondary)]">ทดสอบการป้องกันเอกสารซ้ำ:</span>
                <button
                  onClick={() => {
                    const mockFile = new File(['dummy content'], 'SO_SIAM_COMMERCIAL_0892.pdf', {
                      type: 'application/pdf',
                    });
                    uploadSoPdfSimulation(mockFile);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[var(--bg-shell)] hover:bg-slate-700/50 text-blue-400 font-mono text-[11.5px] border border-[var(--border-color)] flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>ทดสอบป้องกันการนำเข้าไฟล์ซ้ำ</span>
                </button>
              </div>
            </div>
          </div>

          {/* OCR Recovery & Exception Handling (6 Cols) */}
          <div className="lg:col-span-6 flex flex-col gap-3">
            <div className="p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
                <span className="font-bold text-[14px] flex items-center gap-2">
                  <AlertOctagon className="w-5 h-5 text-amber-400" />
                <span>แก้ไขข้อมูลใบสั่งขายที่อ่านไม่ครบ</span>
                </span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                  RECOVERY WORKFLOW
                </span>
              </div>

              {soRequests.filter((s) => s.ocrState !== 'PARSE_SUCCESS').length > 0 ? (
                <div className="flex flex-col gap-3">
                  {soRequests
                    .filter((s) => s.ocrState !== 'PARSE_SUCCESS')
                    .map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg bg-[var(--bg-shell)] border border-amber-500/30 flex flex-col gap-2 text-[12px]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-blue-400">{item.soNumber}</span>
                          <span className="font-mono text-[10.5px] px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-400">
                            {getStatusLabelTh(item.ocrState)} ({item.ocrConfidence}%)
                          </span>
                        </div>
                        <div className="text-[var(--text-primary)] font-medium">{getCustomerNameTh(item.customerName)}</div>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          ผู้รับผิดชอบ: {item.ocrRecoveryOwner || 'ฝ่ายขาย'} • สาเหตุ: {item.ocrRecoveryNote || 'ตัวอักษรบางส่วนไม่ชัดเจน'}
                        </div>

                        <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-color)]">
                          <input
                            type="text"
                            placeholder="ระบุบันทึกการตรวจทานสเปก..."
                            value={recoveryNote}
                            onChange={(e) => setRecoveryNote(e.target.value)}
                            className="flex-1 p-1.5 text-[11.5px] bg-[var(--input-bg)] border border-[var(--border-color)] rounded"
                          />
                          <button
                            onClick={() => {
                              resolveOcrRecovery(item.id, recoveryNote || 'ตรวจทานสเปกและปริมาณถูกต้อง');
                              setRecoveryNote('');
                            }}
                            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11.5px]"
                          >
                            รับรองเอกสาร
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400 text-[12px]">
                  ✓ เอกสารทุกฉบับผ่านการตรวจสอบแล้ว (ไม่มีข้อผิดพลาดค้างตรวจ)
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Waiting Selection */}
      {activeTab === 'waiting' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
            <div>
              <h2 className="text-[15px] font-bold">ใบสั่งขายที่มีสินค้า [04] ให้ฝ่ายขายเลือก</h2>
              <p className="text-[12px] text-[var(--text-secondary)]">
                แสดงเฉพาะใบสั่งขายและรายการที่มีสินค้าสถานะ [04] จองผูกไว้แล้ว; ค้นหาสินค้า [02] ได้ที่หน้าสินค้าและจัดสรร
              </p>
            </div>
            <span className="font-mono text-[11px] px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">
              จองแล้ว [04]
            </span>
          </div>

          <div className="divide-y divide-[var(--border-color)]">
            {soRequests
              .filter(hasReservedSalesLine)
              .map((so) => (
                <div key={so.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12.5px]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-400 text-[14px]">{so.soNumber}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
                        {getStatusLabelTh(so.status)}
                      </span>
                    </div>
                    <div className="font-bold text-[var(--text-primary)] mt-0.5">{getCustomerNameTh(so.customerName)}</div>
                    <div className="text-[11.5px] text-[var(--text-secondary)] font-mono">
                      จำนวน {so.lines.length} รายการ • วันที่คำขอ: {so.requestDate}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedSoId(so.soNumber);
                      setActiveTab('requests');
                    }}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[12px] flex items-center gap-1.5 shadow-xs"
                  >
                    <span>ดูสินค้าที่จอง [04]</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            {soRequests.filter(hasReservedSalesLine).length === 0 && (
              <div className="p-6 text-center text-[var(--text-secondary)] text-[12px]">
                ยังไม่มีใบสั่งขายที่ผูกสินค้าสถานะ [04]; ค้นหาสินค้า [02] ได้ที่หน้าสินค้าและจัดสรร
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Manager Queue */}
      {activeTab === 'manager' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
            <div>
              <h2 className="text-[15px] font-bold">คิวคำขอรอผู้จัดการคลังอนุมัติ</h2>
              <p className="text-[12px] text-[var(--text-secondary)]">
                รายการที่ระบบขายยืนยัน [03] แล้ว รอผู้จัดการคลังตรวจสอบและอนุมัติเป็น [04]
              </p>
            </div>
            <span className="font-mono text-[11px] px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
              รออนุมัติ [03]
            </span>
          </div>

          <div className="divide-y divide-[var(--border-color)]">
            {soRequests
              .filter((s) => s.status === 'SOFT_HOLD')
              .map((so) => (
                <div key={so.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12.5px]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400 text-[14px]">{so.soNumber}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                        [03] รอยืนยันสินค้า
                      </span>
                    </div>
                    <div className="font-bold text-[var(--text-primary)] mt-0.5">{getCustomerNameTh(so.customerName)}</div>
                    <div className="text-[11.5px] text-[var(--text-secondary)] font-mono">
                      หลักฐานการชำระ: {so.paymentAttestRef} • รุ่นข้อมูล: {so.optimisticLockVersion}
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      navigateToWorkspace('WMS-05', {
                        selectedSoId: so.soNumber,
                        selectedLineNumber: 1,
                        tabIndex: 2,
                      })
                    }
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[12px] flex items-center gap-1.5 shadow-xs"
                  >
                    <span>เปิดหน้ารออนุมัติ</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            {soRequests.filter((s) => s.status === 'SOFT_HOLD').length === 0 && (
              <div className="p-6 text-center text-slate-400 text-[12px]">
                ไม่มีรายการค้างอนุมัติในคิวผู้จัดการ
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: Read-only Logistics request inbox */}
      {activeTab === 'logistics' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 shadow-xs flex flex-col gap-4">
          <div className="pb-3 border-b border-[var(--border-color)]">
            <h2 className="text-[15px] font-bold flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-500" />
              <span>คำขอรับสินค้าและแผนจากฝ่ายขนส่ง</span>
            </h2>
            <p className="text-[12px] text-[var(--text-secondary)] mt-1">
              ฝ่ายขนส่งเป็นผู้สร้างและแก้ไขคิวรถ; คลังใช้หน้านี้ติดตามข้อมูลรับเข้าและผลกระทบต่องาน
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {soRequests
              .filter((so) => !!so.bookingRequest)
              .map((so) => {
                const booking = so.bookingRequest!;
                return (
                  <div key={so.id} className="p-3.5 rounded-xl bg-[var(--bg-shell)] border border-[var(--border-color)] flex flex-col gap-2.5 text-[12px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-blue-400">{booking.bookingId}</span>
                        <span className="text-[11px] text-[var(--text-secondary)]">ใบสั่งขาย: {so.soNumber}</span>
                      </div>
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold ${booking.status === 'CONFIRMED' ? 'bg-emerald-500/20 text-emerald-300' : booking.status === 'CANCELLED' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'}`}>
                        {getStatusLabelTh(booking.status)}
                      </span>
                    </div>
                    <div className="font-bold text-[var(--text-primary)]">{getCustomerNameTh(so.customerName)}</div>
                    <div className="grid grid-cols-2 gap-2 text-[11.5px] font-mono">
                      <div>ประเภทยานพาหนะ: {getVehicleNameTh(booking.vehicleType)}</div>
                      <div>น้ำหนักที่แจ้ง: {booking.bookedTons} ตัน</div>
                      <div>วันเวลารับสินค้า: {booking.requestedDate}</div>
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] p-2 rounded bg-[var(--bg-card)] border border-[var(--border-color)]">
                      {booking.impactNote.replace(/Logistics/g, 'ฝ่ายขนส่ง').replace(/\bT\b/g, 'ตัน').replace(/booking/gi, 'คิวรถ')}
                    </div>
                    <div className="pt-2 border-t border-[var(--border-color)] text-[10.5px] text-[var(--text-secondary)]">
                      ข้อมูลจากฝ่ายขนส่ง • ติดต่อฝ่ายขนส่งเพื่อเปลี่ยนแผน
                    </div>
                  </div>
                );
              })}
            {soRequests.every((so) => !so.bookingRequest) && (
              <div className="md:col-span-2 p-8 text-center text-[12px] text-[var(--text-secondary)]">
                ยังไม่มีคำขอจากฝ่ายขนส่ง
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
