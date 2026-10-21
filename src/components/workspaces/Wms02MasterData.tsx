import React, { useState } from 'react';
import { useWms } from '../../context/WmsContext';
import { StatusBadge } from '../common/StatusBadge';
import { USER_ROLES, type AllocationPolicy, type InventoryItem } from '../../types/wms';
import {
  Database,
  Layers,
  MapPin,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Shield,
  Radio,
  GitCompare,
  ArrowRight,
  Plus,
  RefreshCw,
  Clock,
  Send,
  Lock,
  Eye,
  Inbox,
  X,
  FileText,
  RotateCw,
} from 'lucide-react';

type OpeningStockRow = {
  lineNumber: number;
  values: Record<string, string>;
  errors: string[];
};

const OPENING_STOCK_COLUMNS = ['LOT_NO', 'HEAT_NUM', 'PRODUCT_CODE', 'WEIGHT_TONS', 'PIECES', 'LOCATION_BAY', 'AGE_DAYS', 'RFID_TAG'];
const adjustmentStatusThai: Record<string, string> = { PROPOSED: 'รอตรวจสอบ', APPROVED: 'อนุมัติแล้ว', REJECTED: 'ปฏิเสธแล้ว' };
const policyStatusThai: Record<string, string> = { DRAFT: 'ฉบับร่าง', PENDING_REVIEW: 'รอตรวจอนุมัติ', APPROVED: 'อนุมัติแล้ว', ACTIVE: 'เปิดใช้งาน', REJECTED: 'ปฏิเสธแล้ว' };
const reconciliationStatusThai: Record<string, string> = { MATCH: 'ยอดตรงกัน', DISCREPANCY: 'พบยอดไม่ตรง' };
const integrationStatusThai: Record<string, string> = { SUCCESS: 'สำเร็จ', PENDING: 'รอดำเนินการ', RETRYING: 'กำลังส่งซ้ำ', FAILED: 'ไม่สำเร็จ' };
const productTextThai = (value: string) => value
  .replaceAll('H-Beam', 'เหล็กเอชบีม')
  .replaceAll('Wide Flange', 'เหล็กไวด์แฟลงก์')
  .replaceAll('HR Coil', '')
  .replaceAll('Dia ', 'เส้นผ่านศูนย์กลาง ')
  .replaceAll('mm', 'มม.')
  .replaceAll('ft', 'ฟุต')
  .replace(/(\d)M\b/g, '$1 ม.');

const parseCsv = (source: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error('พบเครื่องหมาย quote ที่เปิดไว้แต่ไม่ได้ปิด');
  row.push(cell.trim());
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
};

export const Wms02MasterData: React.FC = () => {
  const {
    inventory,
    workTypeConfigs,
    saveWorkTypeConfig,
    policies,
    currentRole,
    activePolicyId,
    activatePolicy,
    saveNewPolicyDraft,
    submitPolicyForReview,
    reviewPolicy,
    addAdjustmentProposal,
    adjustmentProposals,
    reviewAdjustmentProposal,
    integrationMessages,
    retryIntegrationMessage,
    reconciliationRecords,
    createReconciliationCorrection,
    postOpeningStockImport,
  } = useWms();

  const [activeTab, setActiveTab] = useState<
    | 'product_master'
    | 'zones'
    | 'import_wizard'
    | 'adjustments'
    | 'policy_engine'
    | 'rbac'
    | 'integration'
    | 'reconciliation'
  >('product_master');

  // Wizard state (Step 1: Select -> Step 2: Map -> Step 3: Preview -> Step 4: Review -> Step 5: Post)
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [wizardFile, setWizardFile] = useState<string>('');
  const [openingStockRows, setOpeningStockRows] = useState<OpeningStockRow[]>([]);
  const [openingStockFileError, setOpeningStockFileError] = useState<string>('');
  const [openingStockIdempotencyKey, setOpeningStockIdempotencyKey] = useState<string>('');
  const [openingStockSourceReference, setOpeningStockSourceReference] = useState<string>('');
  const [openingStockPostFeedback, setOpeningStockPostFeedback] = useState<string>('');
  const [openingStockPostedSummary, setOpeningStockPostedSummary] = useState<{ lotCount: number; totalTons: number } | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string>('');
  const [integrationDirection, setIntegrationDirection] = useState<'ALL' | 'INBOUND' | 'OUTBOUND'>('ALL');
  const [integrationStatus, setIntegrationStatus] = useState<'ALL' | 'SUCCESS' | 'PENDING' | 'RETRYING' | 'FAILED'>('ALL');
  const [integrationSearch, setIntegrationSearch] = useState<string>('');
  const [reconciliationNote, setReconciliationNote] = useState<string>('ยืนยันผลตรวจนับและแนบหลักฐานก่อนปรับยอด');

  // Adjustment Maker-Checker form state
  const [adjLotId, setAdjLotId] = useState<string>('L-24-0988');
  const [adjDelta, setAdjDelta] = useState<number>(-0.5);
  const [adjReason, setAdjReason] = useState<string>('ตัดแต่งปลายท่อนเหล็กที่บิดงอออก 0.5M ตามใบแจ้งซ่อม');
  const [adjEvidence, setAdjEvidence] = useState<string>('PHOTO-QC-DAM-089.JPG • ใบชั่งเศษชั่งหักยอด #SCALE-9102');
  const [adjustmentReviewNote, setAdjustmentReviewNote] = useState<string>('');
  const [adjustmentFeedback, setAdjustmentFeedback] = useState<string>('');
  const [policyName, setPolicyName] = useState<string>('');
  const [policyDescription, setPolicyDescription] = useState<string>('');
  const [policyRules, setPolicyRules] = useState<AllocationPolicy['rules']>([]);
  const [policyReviewNote, setPolicyReviewNote] = useState<string>('');
  const [policyFeedback, setPolicyFeedback] = useState<string>('');

  const handleOpeningStockFile = async (file?: File) => {
    setWizardFile(file?.name || '');
    setOpeningStockRows([]);
    setOpeningStockFileError('');
    setOpeningStockPostFeedback('');
    setOpeningStockPostedSummary(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setOpeningStockFileError('รองรับไฟล์ CSV ที่ export จาก Excel เท่านั้น');
      return;
    }
    try {
      const text = (await file.text()).replace(/^\uFEFF/, '');
      const parsed = parseCsv(text);
      if (parsed.length < 2) throw new Error('ไฟล์ต้องมีแถว header และข้อมูลอย่างน้อย 1 แถว');
      const headers = parsed[0].map((header) => header.trim().toUpperCase());
      const missingHeaders = OPENING_STOCK_COLUMNS.filter((column) => !headers.includes(column));
      if (missingHeaders.length) throw new Error(`ไม่พบคอลัมน์บังคับ: ${missingHeaders.join(', ')}`);

      const existingIds = new Set(inventory.map((item) => item.id.toUpperCase()));
      const seenIds = new Set<string>();
      const rows: OpeningStockRow[] = parsed.slice(1).map((cells, rowIndex) => {
        const values = Object.fromEntries(headers.map((header, columnIndex) => [header, (cells[columnIndex] || '').trim()]));
        const errors: string[] = [];
        const lotNo = values.LOT_NO || '';
        const productCode = values.PRODUCT_CODE || '';
        const weight = Number(values.WEIGHT_TONS);
        const pieces = Number(values.PIECES);
        const age = Number(values.AGE_DAYS);
        if (!lotNo) errors.push('ไม่มี LOT_NO');
        else if (existingIds.has(lotNo.toUpperCase()) || seenIds.has(lotNo.toUpperCase())) errors.push('LOT_NO ซ้ำกับข้อมูลเดิมหรือในไฟล์');
        if (lotNo) seenIds.add(lotNo.toUpperCase());
        if (!values.HEAT_NUM) errors.push('ไม่มี HEAT_NUM');
        if (!productCode) errors.push('ไม่มี PRODUCT_CODE');
        else if (!inventory.some((item) => item.productCode === productCode)) errors.push(`ไม่พบ PRODUCT_CODE ${productCode} ใน product master`);
        if (!Number.isFinite(weight) || weight <= 0) errors.push('WEIGHT_TONS ต้องเป็นตัวเลขมากกว่า 0');
        if (!Number.isInteger(pieces) || pieces <= 0) errors.push('PIECES ต้องเป็นจำนวนเต็มมากกว่า 0');
        if (!values.LOCATION_BAY) errors.push('ไม่มี LOCATION_BAY');
        if (!Number.isInteger(age) || age < 0) errors.push('AGE_DAYS ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป');
        if (!values.RFID_TAG) errors.push('ไม่มี RFID_TAG');
        return { lineNumber: rowIndex + 2, values, errors };
      });
      setOpeningStockRows(rows);
      setOpeningStockIdempotencyKey(`OPEN-${Date.now()}`);
      setOpeningStockSourceReference(file.name.replace(/\.csv$/i, '').replace(/[^a-zA-Z0-9_-]+/g, '-'));
      setWizardStep(1);
    } catch (error) {
      setOpeningStockFileError(error instanceof Error ? error.message : 'อ่านไฟล์ CSV ไม่สำเร็จ');
    }
  };

  const validOpeningStockRows = openingStockRows.filter((row) => row.errors.length === 0);
  const invalidOpeningStockRows = openingStockRows.filter((row) => row.errors.length > 0);
  const openingStockTotalTons = validOpeningStockRows.reduce((sum, row) => sum + Number(row.values.WEIGHT_TONS), 0);

  const handlePostWizard = () => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const threshold = policies.find((policy) => policy.id === activePolicyId)?.agingThresholdDays || 90;
    const items: InventoryItem[] = validOpeningStockRows.map((row) => {
      const values = row.values;
      const template = inventory.find((item) => item.productCode === values.PRODUCT_CODE)!;
      const ageDays = Number(values.AGE_DAYS);
      return {
        ...template,
        id: values.LOT_NO,
        lotNumber: values.LOT_NO,
        heatNumber: values.HEAT_NUM,
        sourceLotId: undefined,
        totalWeightTons: Number(values.WEIGHT_TONS),
        availableWeightTons: 0,
        reservedWeightTons: 0,
        pieces: Number(values.PIECES),
        locationBay: values.LOCATION_BAY,
        ageDays,
        agingCategory: ageDays >= threshold * 2 ? 'CRITICAL' : ageDays >= threshold ? 'P1_CLEARANCE' : 'STANDARD',
        canonicalStatus: '01',
        statusVersion: `opening-${Date.now()}`,
        rfidTag: values.RFID_TAG,
        physicalCondition: 'NORMAL',
        damageNote: undefined,
        isExcluded: false,
        exclusionReason: undefined,
        lastUpdated: now,
      };
    });
    const success = postOpeningStockImport(items, openingStockIdempotencyKey, openingStockSourceReference);
    if (success) {
      setOpeningStockPostedSummary({ lotCount: items.length, totalTons: openingStockTotalTons });
      setOpeningStockPostFeedback('บันทึก batch ใน local demo state แล้ว; ระบบหน้าบ้านยังเป็นผู้คำนวณสถานะ [02] และ [03]');
      setWizardStep(5);
    } else {
      setOpeningStockPostFeedback('บันทึกไม่สำเร็จ ตรวจสิทธิ์ Lot ซ้ำ และ idempotency key ก่อนลองอีกครั้ง');
    }
  };

  const handleSubmitAdjustment = () => {
    const proposalId = addAdjustmentProposal(adjLotId, adjDelta, adjReason, adjEvidence);
    setAdjustmentFeedback(proposalId ? `ส่งข้อเสนอ ${proposalId} เข้าคิว Reviewer แล้ว` : 'บันทึกไม่สำเร็จ กรุณาตรวจ gate ด้านสิทธิ์และข้อมูล');
  };

  const beginPolicyDraft = () => {
    const activePolicy = policies.find((policy) => policy.id === activePolicyId);
    setPolicyRules((activePolicy?.rules || []).map((rule) => ({ ...rule })));
    setPolicyName('');
    setPolicyDescription('');
    setPolicyFeedback('');
  };

  const handleSavePolicyDraft = () => {
    if (!policyName.trim() || !policyDescription.trim() || !policyRules.length) {
      setPolicyFeedback('กรอกชื่อ คำอธิบาย และกฎของ policy ก่อนบันทึกร่าง');
      return;
    }
    saveNewPolicyDraft(policyName, policyDescription, policyRules);
    setPolicyFeedback('บันทึกร่างแล้ว; ตรวจรายการใหม่ในคิวด้านล่าง');
    setPolicyName('');
    setPolicyDescription('');
  };

  const selectedMessage = integrationMessages.find((message) => message.id === selectedMessageId) || integrationMessages[0];
  const filteredIntegrationMessages = integrationMessages.filter((message) => {
    if (integrationDirection !== 'ALL' && message.direction !== integrationDirection) return false;
    if (integrationStatus !== 'ALL' && message.status !== integrationStatus) return false;
    const search = integrationSearch.trim().toLowerCase();
    if (search && ![message.id, message.event, message.correlationId, message.entityRef || '', message.owner].some((value) => value.toLowerCase().includes(search))) return false;
    return true;
  });
  const reconciliationDiscrepancies = reconciliationRecords.filter((record) => record.status === 'DISCREPANCY').length;
  const reconciliationVariance = reconciliationRecords.reduce((sum, record) => sum + record.varianceTons, 0);

  return (
    <div className="flex flex-col gap-4 text-[var(--text-primary)]">
      {/* Header Banner */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[17px] font-bold">WMS-02 ข้อมูลตั้งต้นและการตั้งค่าระบบ</h1>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
                  โครงสร้างระบบ
                </span>
              </div>
              <p className="text-[12px] text-[var(--text-secondary)]">
                ข้อมูลหลักสินค้า พิกัดลาน ขั้นตอนนำเข้าสินค้า ข้อเสนอปรับยอด (ผู้เสนอและผู้ตรวจ) นโยบายจัดสรร และสิทธิ์ผู้ใช้
              </p>
            </div>
          </div>
        </div>

        {/* 8 Tabs */}
        <div className="flex items-center gap-1.5 pt-3 overflow-x-auto text-[12px]">
          {[
            { id: 'product_master', label: '1. ข้อมูลสินค้า' },
            { id: 'zones', label: '2. ผังลานและเครน' },
            { id: 'import_wizard', label: '3. นำเข้าสต็อก' },
            { id: 'adjustments', label: '4. ปรับปรุงสต็อก' },
            { id: 'policy_engine', label: '5. นโยบายแนะนำสินค้า' },
            { id: 'rbac', label: '6. สิทธิ์ผู้ใช้' },
            { id: 'integration', label: '7. การเชื่อมต่อระบบ' },
            { id: 'reconciliation', label: '8. กระทบยอดสต็อก' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-shell)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Product Master */}
      {activeTab === 'product_master' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs overflow-hidden flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
            <span className="font-bold text-[14px]">รายการเหล็กและสเปกมาตรฐาน</span>
            <span className="text-[11px] font-mono text-[var(--text-secondary)]">
              มอก. 1227-2558 / มอก. 24-2559 / JIS G3101
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
            <table className="w-full text-left text-[12.5px] border-collapse">
              <thead className="bg-[var(--table-header)] text-[var(--text-secondary)] font-mono text-[11px] border-b border-[var(--border-color)]">
                <tr>
                  <th className="py-2.5 px-3">รหัสสินค้า</th>
                  <th className="py-2.5 px-3">ชื่อสินค้าและสเปกมาตรฐาน</th>
                  <th className="py-2.5 px-3">เกรดเหล็ก</th>
                  <th className="py-2.5 px-3">มาตรฐานรับรอง</th>
                  <th className="py-2.5 px-3">มิติและขนาด</th>
                  <th className="py-2.5 px-3 text-right">ความยาว (ม.)</th>
                  <th className="py-2.5 px-3 text-center">ประเภทสินค้า</th>
                  <th className="py-2.5 px-3 text-center">การจัดการในคลัง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {[
                  {
                    code: 'H-SM400-300150',
                    name: 'H-Beam 300×150×6.5×9mm',
                    grade: 'SM400',
                    std: 'มอก. 1227-2558',
                    dim: '300 × 150 × 6.5 × 9 mm',
                    len: 12.0,
                    type: 'เหล็กโครงสร้างรูปพรรณ',
                  },
                  {
                    code: 'WF-SM400-200200',
                    name: 'Wide Flange 200×200×8×12mm',
                    grade: 'SM400',
                    std: 'มอก. 1227-2558',
                    dim: '200 × 200 × 8 × 12 mm',
                    len: 6.0,
                    type: 'เหล็กโครงสร้างรูปพรรณ',
                  },
                  {
                    code: 'RB-SD40-DB25',
                    name: 'เหล็กข้ออ้อย DB25 SD40',
                    grade: 'SD40',
                    std: 'มอก. 24-2559',
                    dim: 'Dia 25mm × 10.0M',
                    len: 10.0,
                    type: 'เหล็กเส้นเสริมคอนกรีต',
                  },
                  {
                    code: 'RB-SD40-DB19',
                    name: 'เหล็กข้ออ้อย DB19 SD40',
                    grade: 'SD40',
                    std: 'มอก. 24-2559',
                    dim: 'Dia 19mm × 10.0M',
                    len: 10.0,
                    type: 'เหล็กเส้นเสริมคอนกรีต',
                  },
                  {
                    code: 'COIL-HR-SS400-30',
                    name: 'เหล็กม้วนรีดร้อน HR Coil 3.0mm',
                    grade: 'SS400',
                    std: 'TIS 528-2548',
                    dim: 'หนา 3.0mm × กว้าง 1219mm',
                    len: 0,
                    type: 'เหล็กม้วนคอยล์',
                  },
                  {
                    code: 'AZ-GL-023-914',
                    name: 'เหล็กม้วนอลูซิงค์ 0.23mm',
                    grade: 'Aluzinc',
                    std: 'มอก. AZ70',
                    dim: 'หนา 0.23mm × กว้าง 914mm',
                    len: 0,
                    type: 'เหล็กม้วนคอยล์',
                  },
                  {
                    code: 'AZ-AZ70-035-914',
                    name: 'เหล็กม้วนอลูซิงค์ AZ70 0.35mm',
                    grade: 'Aluzinc AZ70',
                    std: 'มอก. AZ70',
                    dim: 'หนา 0.35mm × กว้าง 914mm',
                    len: 0,
                    type: 'เหล็กม้วนคอยล์',
                  },
                  {
                    code: 'COIL-HR-30MM',
                    name: 'เหล็กม้วนรีดร้อน HR Coil 3.0mm (ล็อตอ้างอิง)',
                    grade: 'SS400',
                    std: 'TIS 528-2548',
                    dim: 'หนา 3.0mm × กว้าง 1219mm',
                    len: 0,
                    type: 'เหล็กม้วนคอยล์',
                  },
                  {
                    code: 'PL-SS400-9MM',
                    name: 'เหล็กแผ่น SS400 9.0×5×20ft',
                    grade: 'SS400',
                    std: 'JIS G3101',
                    dim: 'หนา 9.0mm × 5ft × 20ft',
                    len: 6.096,
                    type: 'เหล็กแผ่นหนา',
                  },
                ].map((p) => (
                  <tr key={p.code} className="hover:bg-[var(--table-row-hover)] transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-400">{p.code}</td>
                    <td className="py-2.5 px-3 font-bold text-[var(--text-primary)]">{productTextThai(p.name)}</td>
                    <td className="py-2.5 px-3 font-mono">{p.grade}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--text-secondary)]">{p.std}</td>
                    <td className="py-2.5 px-3 font-mono">{productTextThai(p.dim)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-400">
                      {p.len > 0 ? `${p.len.toFixed(1)} ม.` : 'ม้วน'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-[var(--bg-shell)] border border-[var(--border-color)] text-[11px]">
                        {p.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {(() => {
                        const config = workTypeConfigs.find((entry) => entry.sku === p.code) || { sku: p.code, workType: 'FINISHED' as const, processingDays: 0 };
                        const canEdit = currentRole === 'warehouse_manager' || currentRole === 'system_admin';
                        return <div className="flex min-w-44 flex-col items-center gap-1">
                          <select aria-label={`กลุ่มงานของ ${p.code}`} value={config.workType} disabled={!canEdit} onChange={(event) => saveWorkTypeConfig({ ...config, workType: event.target.value as 'FINISHED' | 'PROCESSING', processingDays: event.target.value === 'FINISHED' ? 0 : Math.max(1, config.processingDays) })} className="rounded border border-[var(--border-color)] bg-[var(--input-bg)] px-2 py-1 text-[11px] disabled:opacity-70">
                            <option value="FINISHED">เหล็กสำเร็จรูป · หยิบได้</option>
                            <option value="PROCESSING">เหล็กแปรรูป · ต้องแปรรูปก่อน</option>
                          </select>
                          {config.workType === 'PROCESSING' && <label className="text-[10px] text-[var(--text-secondary)]">เวลามาตรฐาน
                            <input aria-label={`เวลามาตรฐาน ${p.code}`} type="number" min="1" value={config.processingDays} disabled={!canEdit} onChange={(event) => saveWorkTypeConfig({ ...config, processingDays: Number(event.target.value) })} className="ml-1 w-14 rounded border border-[var(--border-color)] bg-[var(--input-bg)] px-1 py-0.5 text-center text-[var(--text-primary)] disabled:opacity-70" /> วัน
                          </label>}
                          {!canEdit && <span className="text-[9px] text-[var(--text-secondary)]">ตั้งค่าโดยผู้จัดการ/Admin</span>}
                        </div>;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Zones & Locations */}
      {activeTab === 'zones' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              bay: 'ช่อง 03-B2',
              zone: 'Zone B เหล็กรูปพรรณ (สำโรงกลาง)',
              cap: '120.0 T',
              used: '85.0 T',
              crane: 'Crane #01 (50T Overhead)',
              status: 'ว่าง (ชั้น 1 เข้าถึงสะดวก)',
            },
            {
              bay: 'ช่อง 03-C1',
              zone: 'Zone B เหล็กรูปพรรณ (สำโรงกลาง)',
              cap: '100.0 T',
              used: '72.5 T',
              crane: 'Crane #01',
              status: 'ว่าง (ชั้น 2 ทางเดินรถกว้าง)',
            },
            {
              bay: 'ช่อง 04-A1',
              zone: 'Zone B เหล็กรูปพรรณ (สำโรงกลาง)',
              cap: '150.0 T',
              used: '110.0 T',
              crane: 'Crane #02',
              status: 'ว่าง (ชั้น 1 ทางเข้าหลัก)',
            },
            {
              bay: 'BAY-A02-R1',
              zone: 'Zone A เหล็กเส้นข้ออ้อย',
              cap: '80.0 T',
              used: '42.0 T',
              crane: 'Crane #03 Gantry',
              status: 'ACTIVE',
            },
            {
              bay: 'STG-GATE-02',
              zone: 'ชานชาลาส่งมอบ 2',
              cap: '50.0 T',
              used: '22.0 T',
              crane: 'Forklift & Crane Link',
              status: 'พร้อมส่งมอบ',
            },
            {
              bay: 'BAY-CLAIM-01',
              zone: 'ลานกักกันสินค้าเคลมและชำรุด',
              cap: '60.0 T',
              used: '15.0 T',
              crane: 'Inspection Gantry',
              status: 'พื้นที่กักกัน',
            },
          ].map((z) => (
            <div
              key={z.bay}
              className="p-3.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-[14px] text-blue-400">{z.bay}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                  {z.status}
                </span>
              </div>
              <div className="text-[12px] font-bold text-[var(--text-primary)]">{z.zone}</div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-2 border-t border-[var(--border-color)] text-[var(--text-secondary)]">
                <div>
                  <span>ความจุ: </span>
                  <span className="font-bold text-[var(--text-primary)]">{z.cap}</span>
                </div>
                <div>
                  <span>ใช้งานอยู่: </span>
                  <span className="font-bold text-blue-400">{z.used}</span>
                </div>
                <div className="col-span-2">
                  <span>เครนประจำลาน: </span>
                  <span className="font-bold text-[var(--text-primary)]">{z.crane}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Opening-Stock Import Wizard */}
      {activeTab === 'import_wizard' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
            <div>
              <h2 className="font-bold text-[15px]">นำเข้าสต็อกยกยอด 5 ขั้นตอน</h2>
              <span className="text-[12px] text-[var(--text-secondary)]">
                Select → Map → Preview Errors → Review → Post with Idempotency Key & Source References
              </span>
            </div>
            <span className="font-mono text-[12px] font-bold text-blue-400">
              ขั้นตอนที่ {wizardStep} จาก 5
            </span>
          </div>

          {/* Stepper Progress */}
          <div className="grid grid-cols-5 gap-2 text-center text-[11px] font-mono">
            {[
              '1. เลือกไฟล์ CSV',
              '2. จับคู่คอลัมน์ (Map)',
              '3. ตรวจสอบ Error',
              '4. ตรวจทาน (Review)',
              '5. บันทึกยกยอด (Post)',
            ].map((stepLabel, idx) => (
              <div
                key={idx}
                className={`p-2 rounded-lg border ${
                  wizardStep === idx + 1
                    ? 'bg-blue-600 text-white font-bold border-blue-400'
                    : wizardStep > idx + 1
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-[var(--bg-shell)] text-[var(--text-secondary)] border-[var(--border-color)]'
                }`}
              >
                {stepLabel}
              </div>
            ))}
          </div>

          {/* Wizard Content by Step */}
          {wizardStep === 1 && (
            <div className="p-5 border-2 border-dashed border-[var(--border-color)] rounded-xl flex flex-col items-center justify-center text-center gap-3 bg-[var(--bg-shell)]">
              <FileSpreadsheet className="w-10 h-10 text-emerald-400" />
              <span className="font-bold text-[14px]">เลือกไฟล์ตารางสำหรับสต็อกยกยอด</span>
              <p className="max-w-2xl text-[12px] text-[var(--text-secondary)]">บันทึกจาก Excel เป็นไฟล์ CSV UTF-8 ก่อนอัปโหลด • ต้องมีคอลัมน์ {OPENING_STOCK_COLUMNS.join(', ')} • ทุกล็อตจะเริ่มที่สถานะ [01]</p>
              <input type="file" accept=".csv,text/csv" onChange={(event) => void handleOpeningStockFile(event.target.files?.[0])} className="max-w-full text-[12px] file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white" />
              {wizardFile && <div className="text-[12px] font-mono text-[var(--text-primary)]">ไฟล์: {wizardFile} · {openingStockRows.length.toLocaleString()} แถวข้อมูล</div>}
              {openingStockFileError && <div className="w-full max-w-2xl p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[12px]">{openingStockFileError}</div>}
              <button onClick={() => setWizardStep(2)} disabled={openingStockRows.length === 0 || Boolean(openingStockFileError)} className="mt-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold text-[12.5px] flex items-center gap-1.5">
                <span>ตรวจจับคอลัมน์และไปต่อ</span><ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="flex flex-col gap-3">
              <div><span className="font-bold text-[13px]">จับคู่คอลัมน์จากไฟล์ ({OPENING_STOCK_COLUMNS.length}/{OPENING_STOCK_COLUMNS.length} คอลัมน์บังคับ):</span><p className="text-[11px] text-[var(--text-secondary)] mt-1">ระบบกำหนดสถานะเอง จึงไม่รับรหัสสถานะจากไฟล์ เพื่อป้องกันการสร้าง [02]/[03] โดยไม่มีข้อมูลจากระบบหน้าบ้าน</p></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px] font-mono">
                {[
                  { fileCol: 'LOT_NO', wmsCol: 'id / lotNumber' },
                  { fileCol: 'HEAT_NUM', wmsCol: 'heatNumber' },
                  { fileCol: 'PRODUCT_CODE', wmsCol: 'product master lookup' },
                  { fileCol: 'WEIGHT_TONS', wmsCol: 'totalWeightTons' },
                  { fileCol: 'PIECES', wmsCol: 'pieces' },
                  { fileCol: 'LOCATION_BAY', wmsCol: 'locationBay' },
                  { fileCol: 'AGE_DAYS', wmsCol: 'ageDays / aging class' },
                  { fileCol: 'RFID_TAG', wmsCol: 'rfidTag' },
                ].map((mapping) => (
                  <div key={mapping.fileCol} className="p-2.5 rounded bg-[var(--bg-shell)] border border-[var(--border-color)]">
                    <span className="text-[10.5px] text-[var(--text-secondary)]">{mapping.fileCol} →</span><span className="font-bold text-blue-400 block">{mapping.wmsCol}</span><span className="text-[10px] text-emerald-400 font-semibold">จำเป็น</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2"><button onClick={() => setWizardStep(1)} className="px-3 py-1.5 rounded bg-[var(--bg-shell)] text-[var(--text-secondary)]">ย้อนกลับ</button><button onClick={() => setWizardStep(3)} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold">ตรวจสอบข้อมูลจริง</button></div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="flex flex-col gap-3">
              <div className={`p-3 rounded-lg border font-mono text-[12px] flex flex-wrap items-center justify-between gap-2 ${invalidOpeningStockRows.length ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                <span>ผ่าน {validOpeningStockRows.length.toLocaleString()} แถว · ผิดพลาด {invalidOpeningStockRows.length.toLocaleString()} แถว · รวมที่ผ่าน {openingStockTotalTons.toFixed(3)} ตัน</span><span className="font-bold">{invalidOpeningStockRows.length ? 'พบข้อมูลผิดพลาด' : 'ตรวจสอบผ่าน'}</span>
              </div>
              {invalidOpeningStockRows.length > 0 && <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--border-color)] divide-y divide-[var(--border-color)]">{invalidOpeningStockRows.slice(0, 50).map((row) => <div key={row.lineNumber} className="p-2.5 text-[11px]"><strong className="font-mono text-rose-300">แถว {row.lineNumber} · {row.values.LOT_NO || 'ไม่มีล็อต'}</strong><div className="text-[var(--text-secondary)] mt-1">{row.errors.join(' · ')}</div></div>)}</div>}
              <div className="flex justify-between mt-2"><button onClick={() => setWizardStep(2)} className="px-3 py-1.5 rounded bg-[var(--bg-shell)] text-[var(--text-secondary)]">ย้อนกลับ</button><button onClick={() => setWizardStep(4)} disabled={!openingStockRows.length || invalidOpeningStockRows.length > 0} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold">ตรวจทานชุดข้อมูล</button></div>
            </div>
          )}

          {wizardStep === 4 && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
                <label className="flex flex-col gap-1"><span className="font-mono text-[var(--text-secondary)]">กุญแจกันรายการซ้ำ</span><input value={openingStockIdempotencyKey} onChange={(event) => setOpeningStockIdempotencyKey(event.target.value)} className="p-2 rounded bg-[var(--input-bg)] border border-[var(--border-color)] font-mono" /></label>
                <label className="flex flex-col gap-1"><span className="font-mono text-[var(--text-secondary)]">เลขอ้างอิงต้นทาง</span><input value={openingStockSourceReference} onChange={(event) => setOpeningStockSourceReference(event.target.value)} className="p-2 rounded bg-[var(--input-bg)] border border-[var(--border-color)] font-mono" /></label>
              </div>
              <div className="p-3.5 rounded-lg bg-[var(--bg-shell)] border border-[var(--border-color)] text-[12px] leading-relaxed">
                <div><strong>ไฟล์:</strong> {wizardFile}</div><div><strong>จำนวนล็อตใหม่:</strong> {validOpeningStockRows.length.toLocaleString()} รายการ</div><div><strong>น้ำหนักรวม:</strong> {openingStockTotalTons.toFixed(3)} ตัน</div><div><strong>สถานะที่บันทึก:</strong> [01] สินค้าคงเหลือจริง (พร้อมเสนอขาย / จองแล้ว = 0)</div><div><strong>หลังบันทึก:</strong> ส่งเหตุการณ์ไปยังถังข้อมูล ระบบหน้าบ้านเป็นผู้คำนวณ [02] และ [03] ตามใบสั่งขายและการชำระเงิน</div>
              </div>
              {currentRole !== 'warehouse_manager' && <div className="text-[11px] text-amber-300">ต้องเปลี่ยนเป็นผู้จัดการคลังเพื่อยืนยันบันทึกข้อมูล</div>}
              {openingStockPostFeedback && <div className="text-[11px] text-rose-300">{openingStockPostFeedback}</div>}
              <div className="flex justify-between mt-2"><button onClick={() => setWizardStep(3)} className="px-3 py-1.5 rounded bg-[var(--bg-shell)] text-[var(--text-secondary)]">ย้อนกลับ</button><button onClick={handlePostWizard} disabled={currentRole !== 'warehouse_manager' || !validOpeningStockRows.length || !openingStockIdempotencyKey.trim() || !openingStockSourceReference.trim()} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold flex items-center gap-1.5"><Upload className="w-4 h-4" />บันทึกสต็อกยกยอด</button></div>
            </div>
          )}

          {wizardStep === 5 && openingStockPostedSummary && (
            <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-emerald-300 font-bold"><CheckCircle2 className="w-5 h-5" />บันทึกชุดข้อมูลสต็อกยกยอดแล้ว (ข้อมูลตัวอย่าง)</div>
              <div className="text-[12px] text-[var(--text-primary)]">{openingStockPostedSummary.lotCount.toLocaleString()} lots · {openingStockPostedSummary.totalTons.toFixed(3)} ตัน · สถานะ [01] · idempotency {openingStockIdempotencyKey}</div>
              <div className="text-[11px] text-[var(--text-secondary)]">{openingStockPostFeedback} ตรวจ event ต่อได้ที่ WMS-02 → Integration → Outbound</div>
              <button onClick={() => { setWizardStep(1); setWizardFile(''); setOpeningStockRows([]); setOpeningStockIdempotencyKey(''); setOpeningStockSourceReference(''); setOpeningStockPostedSummary(null); setOpeningStockPostFeedback(''); }} className="self-start px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-bold">นำเข้าชุดข้อมูลใหม่</button>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Adjustment Maker-Checker */}
      {activeTab === 'adjustments' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
            <div>
              <h2 className="font-bold text-[15px]">ข้อเสนอปรับปรุงสต็อกและขั้นตอนผู้เสนอ–ผู้อนุมัติ</h2>
              <span className="text-[12px] text-[var(--text-secondary)]">
                แยกหน้าที่ผู้เสนอและผู้อนุมัติเด็ดขาด • ห้ามเขียนทับยอดคงเหลือโดยตรง
              </span>
            </div>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold border border-amber-500/30">
              DUAL AUTHORIZATION
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12.5px]">
            <div className="flex flex-col gap-3 p-4 rounded-xl bg-[var(--bg-shell)] border border-[var(--border-color)]">
              <span className="font-bold text-[13px] text-blue-400">1. ผู้เสนอขอปรับยอด</span>
              <div>
                <label className="text-[11px] font-mono text-[var(--text-secondary)]">เลือกรหัสล็อต:</label>
                <select
                  value={adjLotId}
                  onChange={(e) => setAdjLotId(e.target.value)}
                  className="w-full mt-1 p-2 rounded bg-[var(--input-bg)] border border-[var(--border-color)] font-mono text-[12px]"
                >
                  {inventory.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.id} ({it.productName} - {it.totalWeightTons} T)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-[var(--text-secondary)]">
                  ส่วนต่างน้ำหนักที่จะปรับ (ตัน): (เช่น -0.5 หรือ +1.2)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={adjDelta}
                  onChange={(e) => setAdjDelta(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 p-2 rounded bg-[var(--input-bg)] border border-[var(--border-color)] font-mono text-[13px] font-bold text-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-[var(--text-secondary)]">เหตุผลเชิงเทคนิค:</label>
                <textarea
                  rows={2}
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full mt-1 p-2 rounded bg-[var(--input-bg)] border border-[var(--border-color)] text-[12px]"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-[var(--text-secondary)]">หลักฐานอ้างอิง:</label>
                <input
                  type="text"
                  value={adjEvidence}
                  onChange={(e) => setAdjEvidence(e.target.value)}
                  className="w-full mt-1 p-2 rounded bg-[var(--input-bg)] border border-[var(--border-color)] text-[12px]"
                />
              </div>

              <button
                onClick={handleSubmitAdjustment}
                disabled={!['crane_operator', 'warehouse_manager'].includes(currentRole)}
                title={!['crane_operator', 'warehouse_manager'].includes(currentRole) ? 'เสนอปรับยอดได้โดยพนักงานลานหรือผู้จัดการคลัง' : undefined}
                className="mt-2 py-2 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold"
              >
                ส่งคำขอปรับยอดให้ Reviewer ตรวจสอบ
              </button>
              <div className="text-[11px] text-[var(--text-secondary)]">ผู้มีสิทธิ์เสนอ: พนักงานลานหรือผู้จัดการคลัง • ผู้เสนอห้ามอนุมัติรายการตนเอง</div>
              {adjustmentFeedback && <div className="text-[11px] text-blue-300">{adjustmentFeedback}</div>}
            </div>

            <div className="flex flex-col gap-3 p-4 rounded-xl bg-[var(--bg-shell)] border border-[var(--border-color)]">
              <span className="font-bold text-[13px] text-emerald-400">2. ตรวจสอบและอนุมัติ</span>
              <div className="p-3 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[11.5px] font-mono leading-relaxed">
                <div><strong>กฎความปลอดภัย:</strong> ผู้เสนอไม่สามารถอนุมัติรายการของตนเองได้</div>
                <div className="mt-1 text-slate-400">การปรับปรุงยอดจะไม่เขียนทับยอดเดิม แต่บันทึกรายการประวัติเป็นคู่ (+/−) พร้อมรุ่นของสต็อก</div>
              </div>

              <label className="text-[11px] text-[var(--text-secondary)]">หมายเหตุผู้ตรวจสอบ (จำเป็นเมื่อตีกลับ)</label>
              <textarea rows={2} value={adjustmentReviewNote} onChange={(event) => setAdjustmentReviewNote(event.target.value)} className="w-full p-2 rounded bg-[var(--input-bg)] border border-[var(--border-color)] text-[12px]" />
              <div className="flex flex-col gap-2 max-h-[430px] overflow-y-auto">
                {adjustmentProposals.length === 0 && <div className="p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[11px] text-[var(--text-secondary)]">ยังไม่มีข้อเสนอปรับยอด</div>}
                {adjustmentProposals.map((proposal) => {
                  const isMaker = proposal.proposer.includes('(') && proposal.proposer.includes(USER_ROLES[currentRole].name);
                  const canReview = ['warehouse_manager', 'planning_approver'].includes(currentRole) && proposal.status === 'PROPOSED' && !isMaker;
                  return (
                    <div key={proposal.id} className="p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[11px]">
                      <div className="flex justify-between gap-2"><strong className="font-mono text-blue-300">{proposal.id} · {proposal.lotId}</strong><span className={`font-mono font-bold ${proposal.status === 'APPROVED' ? 'text-emerald-400' : proposal.status === 'REJECTED' ? 'text-rose-400' : 'text-amber-300'}`}>{adjustmentStatusThai[proposal.status] || proposal.status}</span></div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 font-mono text-[var(--text-secondary)]">
                        <span>Before: {proposal.beforeQtyTons.toFixed(3)} T</span><span>Delta: {proposal.deltaQtyTons > 0 ? '+' : ''}{proposal.deltaQtyTons.toFixed(3)} T</span>
                        <span>After: {proposal.afterQtyTons.toFixed(3)} T</span><span>Version: {proposal.stockVersion}</span>
                        <span className="col-span-2">Maker: {proposal.proposer} · {proposal.proposedAt}</span>
                        {proposal.reviewer && <span className="col-span-2">Checker: {proposal.reviewer} · {proposal.reviewedAt}</span>}
                      </div>
                      <div className="mt-2 text-[var(--text-primary)]">{proposal.reason}<br /><span className="text-[var(--text-secondary)]">หลักฐาน: {proposal.evidence}</span></div>
                      {proposal.reviewNote && <div className="mt-1 text-indigo-300">Reviewer note: {proposal.reviewNote}</div>}
                      {proposal.status === 'PROPOSED' && <div className="flex gap-2 mt-2">
                        {canReview ? <>
                          <button onClick={() => reviewAdjustmentProposal(proposal.id, 'APPROVE', adjustmentReviewNote)} className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold">อนุมัติและบันทึกผล</button>
                          <button onClick={() => reviewAdjustmentProposal(proposal.id, 'REJECT', adjustmentReviewNote)} disabled={!adjustmentReviewNote.trim()} className="px-2.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold">ปฏิเสธ</button>
                        </> : <span className="text-amber-300">{!['warehouse_manager', 'planning_approver'].includes(currentRole) ? 'รอผู้ตรวจสอบที่มีสิทธิ์' : 'ห้ามผู้เสนออนุมัติตนเอง'}</span>}
                      </div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Policy Engine */}
      {activeTab === 'policy_engine' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
            <div>
              <h2 className="font-bold text-[15px]">เครื่องมือนโยบายการจัดสรรสินค้า</h2>
              <span className="text-[12px] text-[var(--text-secondary)]">
                กำหนดเกณฑ์เข้าก่อนออกก่อน ความสำคัญตามอายุสินค้า และความใกล้ช่องจัดเก็บ โดยไม่กำหนดค่าตายตัว
              </span>
            </div>
            <button onClick={beginPolicyDraft} disabled={currentRole !== 'warehouse_manager'} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-[12px] flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> สร้างร่างนโยบายใหม่
            </button>
          </div>

          {currentRole === 'warehouse_manager' && policyRules.length > 0 && (
            <div className="p-4 rounded-xl bg-[var(--bg-shell)] border border-blue-500/30 flex flex-col gap-3">
              <div className="font-bold text-[13px] text-blue-300">สร้างร่างนโยบายจากเกณฑ์ที่ใช้อยู่</div>
              <div className="grid md:grid-cols-2 gap-3">
                <input value={policyName} onChange={(event) => setPolicyName(event.target.value)} placeholder="ชื่อนโยบาย" className="p-2 rounded bg-[var(--input-bg)] border border-[var(--border-color)] text-[12px]" />
                <input value={policyDescription} onChange={(event) => setPolicyDescription(event.target.value)} placeholder="วัตถุประสงค์ / ขอบเขต" className="p-2 rounded bg-[var(--input-bg)] border border-[var(--border-color)] text-[12px]" />
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                {policyRules.map((rule, index) => <label key={`${rule.ruleName}-${index}`} className="flex items-center justify-between gap-3 p-2 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[11px]"><span>{rule.ruleName}</span><span className="flex items-center gap-1"><input type="number" min="0" max="100" value={rule.weight} onChange={(event) => setPolicyRules((prev) => prev.map((item, i) => i === index ? { ...item, weight: Number(event.target.value) } : item))} className="w-16 p-1 rounded bg-[var(--input-bg)] border border-[var(--border-color)] text-right font-mono" />%</span></label>)}
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className={policyRules.reduce((total, rule) => total + rule.weight, 0) === 100 ? 'text-emerald-400' : 'text-amber-300'}>ผลรวมน้ำหนัก: {policyRules.reduce((total, rule) => total + rule.weight, 0)}% {policyRules.reduce((total, rule) => total + rule.weight, 0) !== 100 && '· ต้องเท่ากับ 100%'}</span>
                <button onClick={handleSavePolicyDraft} disabled={policyRules.reduce((total, rule) => total + rule.weight, 0) !== 100} className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold">บันทึกร่าง</button>
              </div>
              {policyFeedback && <div className="text-[11px] text-blue-300">{policyFeedback}</div>}
            </div>
          )}

          <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex flex-col md:flex-row md:items-center gap-2 text-[11px]">
            <span className="font-bold text-indigo-200">ผู้จัดการคลังเสนอ → ผู้อนุมัติแผนตรวจสอบ → ผู้จัดการคลังเปิดใช้</span>
            <input value={policyReviewNote} onChange={(event) => setPolicyReviewNote(event.target.value)} placeholder="หมายเหตุการอนุมัติ / ปฏิเสธ" className="md:ml-auto md:w-72 p-1.5 rounded bg-[var(--input-bg)] border border-[var(--border-color)]" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {policies.map((p) => (
              <div
                key={p.id}
                className={`p-4 rounded-xl border flex flex-col gap-3 ${
                    p.status === 'ACTIVE'
                      ? 'bg-blue-500/10 border-blue-500/40 shadow-xs'
                      : p.status === 'PENDING_REVIEW' ? 'bg-amber-500/10 border-amber-500/40'
                      : 'bg-[var(--bg-shell)] border-[var(--border-color)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[14px] text-[var(--text-primary)]">{p.name}</span>
                    <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-blue-600 text-white font-bold">
                      {p.version}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-[10.5px] px-2 py-0.5 rounded font-bold ${
                      p.status === 'ACTIVE'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : p.status === 'PENDING_REVIEW' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-500/20 text-slate-300'
                    }`}
                  >
                    {policyStatusThai[p.status] || p.status}
                  </span>
                </div>
                <p className="text-[12px] text-[var(--text-secondary)]">{p.description}</p>
                <div className="text-[10.5px] text-[var(--text-secondary)]">ผู้สร้าง: {p.createdBy || 'ข้อมูลเริ่มต้น'} {p.submittedBy && `· ส่งโดย ${p.submittedBy}`} {p.approvedBy && `· อนุมัติโดย ${p.approvedBy}`} {p.activatedBy && `· เปิดใช้โดย ${p.activatedBy}`}</div>

                <div className="space-y-1.5 pt-2 border-t border-[var(--border-color)] text-[12px] font-mono">
                  {p.rules.map((r, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11.5px]">
                      <span className="text-[var(--text-primary)]">{r.ruleName}</span>
                      <span className="font-bold text-blue-400">น้ำหนัก {r.weight}%</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {p.status === 'DRAFT' && currentRole === 'warehouse_manager' && <button onClick={() => submitPolicyForReview(p.id)} className="px-2.5 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold">ส่งให้ตรวจอนุมัติ</button>}
                  {p.status === 'PENDING_REVIEW' && currentRole === 'planning_approver' && <>
                    <button onClick={() => reviewPolicy(p.id, 'APPROVE', policyReviewNote)} className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold">อนุมัตินโยบาย</button>
                    <button onClick={() => reviewPolicy(p.id, 'REJECT', policyReviewNote)} disabled={!policyReviewNote.trim()} className="px-2.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-[11px] font-bold">ปฏิเสธ</button>
                  </>}
                  {p.status === 'APPROVED' && currentRole === 'warehouse_manager' && <button onClick={() => activatePolicy(p.id)} className="px-2.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold">เปิดใช้นโยบาย</button>}
                </div>
                {p.reviewNote && <div className="text-[10.5px] text-indigo-300">หมายเหตุผู้อนุมัติ: {p.reviewNote}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 6: RBAC Matrix */}
      {activeTab === 'rbac' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs p-5 flex flex-col gap-3 text-[12.5px]">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
              <span className="font-bold text-[14px]">ตารางควบคุมสิทธิ์แยกตามบทบาท</span>
            <span className="font-mono text-[11px] text-[var(--text-secondary)]">
              ห้ามอนุมัติรายการของตนเอง
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
            <table className="w-full text-left font-mono text-[11.5px]">
              <thead className="bg-[var(--table-header)] text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                <tr>
                  <th className="py-2.5 px-3">ฟังก์ชันการทำงาน / สิทธิ์</th>
                  <th className="py-2.5 px-3 text-center">ฝ่ายขาย</th>
                  <th className="py-2.5 px-3 text-center">ผู้จัดการคลัง</th>
                  <th className="py-2.5 px-3 text-center">พนักงานลาน</th>
                  <th className="py-2.5 px-3 text-center">ผู้ตรวจคุณภาพ</th>
                  <th className="py-2.5 px-3 text-center">เจ้าหน้าที่ขนส่ง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {[
                  { act: 'อัปโหลด SO & ส่งผลเลือกสินค้า', s: true, m: true, c: false, q: false, l: false },
                  { act: 'อนุมัติการจัดสรร [03] → [04] Reserved', s: false, m: true, c: false, q: false, l: false },
                  { act: 'ออกใบหยิบสินค้า (Create Pick)', s: false, m: true, c: false, q: false, l: false },
                  { act: 'ปฏิบัติการหยิบและย้ายช่องจัดเก็บ', s: false, m: true, c: true, q: false, l: false },
                  { act: 'ยืนยันพิกัดชานชาลา [08] + WHX-01', s: false, m: true, c: false, q: false, l: false },
                  { act: 'ยืนยันการรับมอบขึ้นรถ (LGX-03)', s: false, m: false, c: false, q: false, l: true },
                  { act: 'ตรวจรับและแปรรูป [06] → [02]/[07]', s: false, m: false, c: false, q: true, l: false },
                  { act: 'เปิดบันทึกข้อร้องเรียนเคลม [11]', s: false, m: true, c: false, q: false, l: true },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-[var(--table-row-hover)]">
                    <td className="py-2.5 px-3 font-sans font-medium text-[var(--text-primary)]">
                      {row.act}
                    </td>
                    <td className="py-2.5 px-3 text-center">{row.s ? '✅' : '❌'}</td>
                    <td className="py-2.5 px-3 text-center">{row.m ? '✅' : '❌'}</td>
                    <td className="py-2.5 px-3 text-center">{row.c ? '✅' : '❌'}</td>
                    <td className="py-2.5 px-3 text-center">{row.q ? '✅' : '❌'}</td>
                    <td className="py-2.5 px-3 text-center">{row.l ? '✅' : '❌'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 7: Integration Monitor */}
      {activeTab === 'integration' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs p-5 flex flex-col gap-3 font-mono text-[12px]">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
            <div>
              <span className="font-bold text-[14px] font-sans block">ติดตามข้อมูลรับเข้าและส่งออกระหว่างระบบ</span>
              <span className="text-[10.5px] text-[var(--text-secondary)]">แสดงเหตุการณ์ การตอบรับ เงื่อนไขที่เกี่ยวข้อง ข้อผิดพลาด และประวัติการแก้ไขจากข้อมูลตัวอย่าง</span>
            </div>
            <span className="text-emerald-400 font-bold">ข้อมูลตัวอย่าง</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[
              { label: 'รับเข้า', value: integrationMessages.filter((m) => m.direction === 'INBOUND').length, hint: 'ระบบหน้าบ้าน / ขนส่ง → คลังสินค้า', color: 'text-sky-400' },
              { label: 'ส่งออก', value: integrationMessages.filter((m) => m.direction === 'OUTBOUND').length, hint: 'คลังสินค้า → ถังข้อมูล / ระบบขนส่ง', color: 'text-emerald-400' },
              { label: 'รอการตอบรับ', value: integrationMessages.filter((m) => m.status !== 'SUCCESS' || !m.transportAck || !m.businessAck).length, hint: 'แยกการตอบรับทางระบบและทางธุรกิจ', color: 'text-amber-400' },
              { label: 'ส่งซ้ำได้', value: integrationMessages.filter((m) => m.status !== 'SUCCESS' && m.retryable !== false).length, hint: 'ตรวจผู้รับผิดชอบและรายการที่เกี่ยวข้องก่อนส่งซ้ำ', color: 'text-rose-400' },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-lg bg-[var(--bg-shell)] border border-[var(--border-color)]">
                <span className="text-[var(--text-secondary)] block">{item.label}</span>
                <span className={`font-bold text-[20px] block ${item.color}`}>{item.value}</span>
                <span className="text-[10px] text-[var(--text-secondary)]">{item.hint}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <input value={integrationSearch} onChange={(e) => setIntegrationSearch(e.target.value)} placeholder="ค้น event, ID, entity, correlation, owner" className="flex-1 min-w-52 p-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border-color)] text-[11px]" />
            <select value={integrationDirection} onChange={(e) => setIntegrationDirection(e.target.value as typeof integrationDirection)} className="p-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border-color)] text-[11px]">
              <option value="ALL">ทุกทิศทาง</option><option value="INBOUND">รับเข้า</option><option value="OUTBOUND">ส่งออก</option>
            </select>
            <select value={integrationStatus} onChange={(e) => setIntegrationStatus(e.target.value as typeof integrationStatus)} className="p-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border-color)] text-[11px]">
              <option value="ALL">ทุกสถานะ</option><option value="SUCCESS">สำเร็จ</option><option value="PENDING">รอดำเนินการ</option><option value="RETRYING">กำลังส่งซ้ำ</option><option value="FAILED">ไม่สำเร็จ</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
            <table className="w-full text-left text-[10.5px] border-collapse min-w-[1000px]">
              <thead className="bg-[var(--table-header)] text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                <tr><th className="py-2 px-2">เหตุการณ์ / ข้อมูลอ้างอิง</th><th className="py-2 px-2">ต้นทาง → ปลายทาง</th><th className="py-2 px-2">ทิศทาง / เวลา</th><th className="py-2 px-2">ตอบรับการส่ง</th><th className="py-2 px-2">ตอบรับทางธุรกิจ</th><th className="py-2 px-2">สถานะ / จำนวนครั้ง</th><th className="py-2 px-2">ผู้รับผิดชอบ</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {filteredIntegrationMessages.map((message) => (
                  <tr key={message.id} onClick={() => setSelectedMessageId(message.id)} className={`cursor-pointer hover:bg-[var(--table-row-hover)] ${selectedMessage?.id === message.id ? 'bg-blue-500/10' : ''}`}>
                    <td className="py-2 px-2"><strong className="block text-blue-400">{message.event}</strong><span>{message.id}</span><span className="block text-[var(--text-secondary)]">{message.entityRef || '—'}</span></td>
                    <td className="py-2 px-2">{message.source} <ArrowRight className="inline w-3 h-3" /> {message.target}<span className="block text-[var(--text-secondary)] truncate max-w-64">{message.schema}</span></td>
                    <td className="py-2 px-2">{message.direction}<span className="block text-[var(--text-secondary)]">{message.updatedAt || message.createdAt || message.history[0]?.split(':')[0] || '—'}</span></td>
                    <td className={`py-2 px-2 font-bold ${message.transportAck ? 'text-emerald-400' : 'text-amber-400'}`}>{message.transportAck ? 'ACK' : 'WAIT'}</td>
                    <td className={`py-2 px-2 font-bold ${message.businessAck ? 'text-emerald-400' : 'text-amber-400'}`}>{message.businessAck ? 'ACK' : 'WAIT'}</td>
                    <td className="py-2 px-2"><strong className={message.status === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'}>{integrationStatusThai[message.status] || message.status}</strong><span className="block text-[var(--text-secondary)]">ครั้งที่ {message.attempts}</span></td>
                    <td className="py-2 px-2">{message.owner}</td>
                  </tr>
                ))}
                {filteredIntegrationMessages.length === 0 && <tr><td colSpan={7} className="p-5 text-center text-[var(--text-secondary)]">ไม่พบเหตุการณ์ตามตัวกรอง</td></tr>}
              </tbody>
            </table>
          </div>

          {selectedMessage && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
              <div className="xl:col-span-2 p-3 rounded-lg bg-[var(--bg-shell)] border border-[var(--border-color)] flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 border-b border-[var(--border-color)] pb-2"><strong className="text-blue-400">{selectedMessage.event} · {selectedMessage.id}</strong><span className="text-emerald-400 font-bold">รายละเอียดข้อมูลตัวอย่าง</span></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10.5px]">
                  <div><span className="text-[var(--text-secondary)]">รูปแบบข้อมูล / รุ่น</span><div className="break-all">{selectedMessage.schema}</div></div>
                  <div><span className="text-[var(--text-secondary)]">ต้นทาง → ปลายทาง / ทิศทาง</span><div>{selectedMessage.source} → {selectedMessage.target} · {selectedMessage.direction}</div></div>
                  <div><span className="text-[var(--text-secondary)]">รหัสติดตามรายการ</span><div className="break-all">{selectedMessage.correlationId}</div></div>
                  <div><span className="text-[var(--text-secondary)]">กุญแจกันรายการซ้ำ</span><div className="break-all">{selectedMessage.idempotencyKey}</div></div>
                  <div><span className="text-[var(--text-secondary)]">เงื่อนไขที่เกี่ยวข้อง</span><div>{selectedMessage.dependencies.join(', ') || 'ไม่มี'}</div></div>
                  <div><span className="text-[var(--text-secondary)]">ข้อมูลอ้างอิง / เนื้อหาที่ส่ง</span><div>{selectedMessage.entityRef || '—'} · {selectedMessage.payloadSummary || 'ไม่มีสรุปเนื้อหาในเหตุการณ์ตัวอย่าง'}</div></div>
                  <div><span className="text-[var(--text-secondary)]">ผู้รับผิดชอบส่งซ้ำ / จำนวนครั้ง</span><div>{selectedMessage.owner} · {selectedMessage.attempts}</div></div>
                  <div><span className="text-[var(--text-secondary)]">รหัสข้อผิดพลาด / รายละเอียด</span><div className="text-rose-300">{selectedMessage.errorCode || '—'} · {selectedMessage.errorDetail || 'ไม่มีข้อผิดพลาดที่กำลังดำเนินการ'}</div></div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-color)] pt-2">
                  <div className="text-[10px]">Transport ACK: <strong className={selectedMessage.transportAck ? 'text-emerald-400' : 'text-amber-400'}>{selectedMessage.transportAck ? 'ACK' : 'WAIT'}</strong> · Business ACK: <strong className={selectedMessage.businessAck ? 'text-emerald-400' : 'text-amber-400'}>{selectedMessage.businessAck ? 'ACK' : 'WAIT'}</strong></div>
                  <button onClick={() => retryIntegrationMessage(selectedMessage.id)} disabled={selectedMessage.status === 'SUCCESS' || selectedMessage.retryable === false || (currentRole !== 'warehouse_manager' && currentRole !== 'system_admin')} title={currentRole === 'warehouse_manager' || currentRole === 'system_admin' ? undefined : 'ต้องใช้สิทธิ์ผู้ดูแลการเชื่อมต่อระบบ'} className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"><RotateCw className="inline w-3.5 h-3.5 mr-1" />ส่งเหตุการณ์ซ้ำ (จำลอง)</button>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-shell)] border border-[var(--border-color)]"><strong className="block border-b border-[var(--border-color)] pb-2 mb-1">ประวัติการส่งและแก้ไข</strong><div className="max-h-56 overflow-y-auto divide-y divide-[var(--border-color)]">{selectedMessage.history.map((entry, idx) => <div key={`${entry}-${idx}`} className="py-2 text-[10px] text-[var(--text-secondary)]">{entry}</div>)}</div></div>
            </div>
          )}
        </div>
      )}

      {/* Tab 8: Mappings and Reconciliation */}
      {activeTab === 'reconciliation' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs p-5 flex flex-col gap-3 text-[12.5px]">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
            <span className="font-bold text-[14px]">การกระทบยอดระหว่างบัญชีและคลังจริง (Stock Reconciliation)</span>
            <span className={`font-mono font-bold ${reconciliationDiscrepancies ? 'text-rose-400' : 'text-emerald-400'}`}>
              {reconciliationDiscrepancies} discrepancies · net variance {reconciliationVariance.toFixed(3)} T
            </span>
          </div>
          <p className="text-[var(--text-secondary)] text-[12px]">
            เปรียบเทียบยอดตามระบบกับยอดตรวจนับ สถานะ ตำแหน่ง และรุ่นข้อมูล หากพบผลต่างจะสร้างข้อเสนอปรับยอดให้ผู้ตรวจอีกคนพิจารณา ระบบไม่เขียนทับยอดทันที แถวตัวอย่างเป็นข้อมูลจำลอง
          </p>
          <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
            <table className="w-full text-left text-[11px] min-w-[1050px]">
              <thead className="bg-[var(--table-header)] text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                <tr><th className="py-2 px-2">รายการ / สต็อก</th><th className="py-2 px-2">ตำแหน่ง</th><th className="py-2 px-2">ยอดตามระบบ</th><th className="py-2 px-2">ยอดตรวจนับ</th><th className="py-2 px-2">ผลต่าง</th><th className="py-2 px-2">สถานะ / รุ่นข้อมูล</th><th className="py-2 px-2">การแก้ไข</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {reconciliationRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-[var(--table-row-hover)]">
                    <td className="py-2 px-2"><strong className="text-blue-400">{record.id} · {record.lotId}</strong><span className="block text-[var(--text-secondary)]">{record.productName}</span></td>
                    <td className="py-2 px-2">{record.locationBay}</td>
                    <td className="py-2 px-2">{record.expectedQtyTons.toFixed(3)} T · [{record.expectedStatus}]<span className="block text-[var(--text-secondary)]">v {record.expectedVersion}</span></td>
                    <td className="py-2 px-2">{record.actualCountQtyTons.toFixed(3)} T · [{record.actualStatus}]<span className="block text-[var(--text-secondary)]">v {record.actualVersion}</span></td>
                    <td className={`py-2 px-2 font-bold ${Math.abs(record.varianceTons) > 0.001 ? 'text-rose-400' : 'text-emerald-400'}`}>{record.varianceTons > 0 ? '+' : ''}{record.varianceTons.toFixed(3)} T</td>
                    <td className="py-2 px-2"><strong className={record.status === 'MATCH' ? 'text-emerald-400' : 'text-rose-400'}>{reconciliationStatusThai[record.status] || record.status}</strong></td>
                    <td className="py-2 px-2">
                      {record.correctionProposalId ? <span className="text-indigo-300">ข้อเสนอ {record.correctionProposalId}</span> : record.status === 'DISCREPANCY' ? <button onClick={() => createReconciliationCorrection(record.id, reconciliationNote)} className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold">สร้างข้อเสนอแก้ไข</button> : <span className="text-[var(--text-secondary)]">ไม่ต้องแก้ไข</span>}
                    </td>
                  </tr>
                ))}
                {reconciliationRecords.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-[var(--text-secondary)]">ยังไม่มีข้อมูล reconciliation</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="p-3 rounded-lg bg-[var(--bg-shell)] border border-[var(--border-color)] text-[11px]">
              <strong>การควบคุมการปรับปรุง</strong><p className="mt-1 text-[var(--text-secondary)]">ผู้เสนอสร้างคำขอจากยอดจริงลบยอดที่ควรมี พร้อมระบุรุ่นข้อมูล ผู้จัดการคลังอีกคนจึงอนุมัติหรือตีกลับได้จากคิวตรวจสอบ</p>
            </div>
            <label className="text-[11px] text-[var(--text-secondary)]">เหตุผล/หลักฐานประกอบ correction
              <input value={reconciliationNote} onChange={(e) => setReconciliationNote(e.target.value)} className="w-full mt-1 p-2 rounded bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-primary)]" />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
