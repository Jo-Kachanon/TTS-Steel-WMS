import React, { useState } from 'react';
import { useWms, WorkspaceId } from '../../context/WmsContext';
import { TtsLogo } from './TtsLogo';
import { USER_ROLES, UserRole, WarehouseId } from '../../types/wms';
import { AppGuideModal } from './AppGuideModal';
import {
  Sun,
  Moon,
  Bell,
  Plus,
  BookOpen,
  Warehouse,
  ChevronDown,
  RotateCcw,
  Check,
  UserCheck,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    theme,
    toggleTheme,
    currentRole,
    setCurrentRole,
    selectedWarehouse,
    setSelectedWarehouse,
    resetDemoData,
    navigateToWorkspace,
    auditEvents,
  } = useWms();

  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showWarehouseMenu, setShowWarehouseMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const currentUser = USER_ROLES[currentRole];

  return (
    <header className="fixed top-0 left-64 right-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-[var(--border-color)] bg-[var(--bg-shell)] px-2.5 shadow-xs backdrop-blur-md sm:px-3">
      {/* Left: Logo & Warehouse Select & Target API badge */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="shrink-0"><TtsLogo /></div>

        {/* Warehouse Dropdown */}
        <div className="relative min-w-0">
          <button
            onClick={() => setShowWarehouseMenu(!showWarehouseMenu)}
            className="flex h-9 min-w-0 max-w-[min(42vw,360px)] items-center gap-2 whitespace-nowrap rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 text-[12.5px] text-[var(--text-primary)] transition-colors hover:border-blue-500 sm:px-3"
          >
            <Warehouse className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="min-w-0 truncate font-medium">
              {selectedWarehouse === 'WH-01'
                ? 'WH-01 คลังสำโรงกลาง (เหล็กรูปพรรณและข้ออ้อย)'
                : selectedWarehouse === 'WH-02'
                ? 'WH-02 คลังบางนา (เหล็กแผ่นและคอยล์)'
                : 'WH-03 คลังระยอง (ลานเหล็กโครงสร้างหนัก)'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showWarehouseMenu && (
            <div className="absolute left-0 mt-1.5 w-80 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xl py-1 z-50 animate-in fade-in">
              {(['WH-01', 'WH-02', 'WH-03'] as WarehouseId[]).map((whId) => (
                <button
                  key={whId}
                  onClick={() => {
                    setSelectedWarehouse(whId);
                    setShowWarehouseMenu(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 hover:bg-blue-600/10 transition-colors flex items-start gap-2.5 text-[12.5px] ${
                    selectedWarehouse === whId ? 'bg-blue-500/10 text-blue-400 font-semibold' : ''
                  }`}
                >
                  <Warehouse className="w-4 h-4 mt-0.5 text-blue-500 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-bold">
                      {whId === 'WH-01'
                        ? 'WH-01 คลังสำโรงกลาง'
                        : whId === 'WH-02'
                        ? 'WH-02 คลังบางนา'
                        : 'WH-03 คลังระยอง'}
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      {whId === 'WH-01'
                        ? 'ลานเหล็กรูปพรรณและข้ออ้อย SD40'
                        : whId === 'WH-02'
                        ? 'ลานเหล็กแผ่นและม้วนคอยล์'
                        : 'ลานเหล็กอุตสาหกรรมหนัก'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Target API Badge - Clearly SIMULATED */}
        <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-blue-400 2xl:flex">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
          <span className="font-mono text-[11px] font-semibold">
            ข้อมูลตัวอย่าง
          </span>
        </div>
      </div>

      {/* Right: Demo, Help, Theme, Notifications, User, New Request */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Reset Demo Data Button */}
        <button
          onClick={resetDemoData}
          title="เริ่มข้อมูลตัวอย่างใหม่"
          aria-label="เริ่มข้อมูลตัวอย่างใหม่"
          className="inline-flex h-9 w-9 items-center justify-center whitespace-nowrap rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-shell)] hover:text-[var(--text-primary)] 2xl:w-auto 2xl:gap-1.5 2xl:px-2.5"
          type="button"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden font-mono 2xl:inline">เริ่มข้อมูลตัวอย่างใหม่</span>
        </button>

        <button
          aria-label="เปิดคู่มือเริ่มต้นใช้งาน"
          onClick={() => setShowGuide(true)}
          className="inline-flex h-9 w-9 items-center justify-center whitespace-nowrap rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-shell)] hover:text-[var(--text-primary)] 2xl:w-auto 2xl:gap-1.5 2xl:px-2.5"
          title="คู่มือเริ่มต้นใช้งาน"
          type="button"
        >
          <BookOpen className="h-4 w-4 text-blue-500" />
          <span className="hidden 2xl:inline">คู่มือ</span>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
          aria-pressed={theme === 'dark'}
          className="inline-flex h-9 w-9 items-center justify-center whitespace-nowrap rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-shell)] 2xl:w-auto 2xl:gap-1.5 2xl:px-2.5"
          title="สลับโหมดสว่างและมืด"
          type="button"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden font-medium 2xl:inline">โหมดสว่าง</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-blue-500" />
              <span className="hidden font-medium 2xl:inline">โหมดมืด</span>
            </>
          )}
        </button>

        {/* Notifications Button */}
        <div className="relative">
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            aria-label={`เปิดบันทึกเหตุการณ์ ${auditEvents.length} รายการ`}
            aria-expanded={showNotifMenu}
            aria-haspopup="dialog"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-shell)] hover:text-[var(--text-primary)]"
            title="บันทึกเหตุการณ์ล่าสุด"
            type="button"
          >
            <Bell className="w-4 h-4" />
            {auditEvents.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500"></span>}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-88 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xl p-3 z-50 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)] text-[13px] font-bold">
                <span>บันทึกเหตุการณ์ล่าสุด</span>
                <span className="text-[11px] font-mono text-blue-400">
                  {auditEvents.length} รายการ
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border-color)] text-[12px]">
                {auditEvents.slice(0, 5).map((evt) => (
                  <div key={evt.id} className="py-2 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-blue-400 font-bold text-[11px]">
                        {evt.id}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                        {evt.timestamp.split(' ')[1]}
                      </span>
                    </div>
                    <span className="font-medium text-[var(--text-primary)] truncate">
                      {evt.productSpec}
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      {evt.reason}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  navigateToWorkspace('WMS-11');
                  setShowNotifMenu(false);
                }}
                className="w-full mt-2 py-1.5 text-center text-[11.5px] text-blue-400 hover:underline font-semibold"
              >
                ดูประวัติทั้งหมด →
              </button>
            </div>
          )}
        </div>

        {/* Role Switcher Menu */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            aria-label={`บทบาทผู้ใช้ ${currentUser.titleTh}`}
            aria-expanded={showRoleMenu}
            aria-haspopup="menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] transition-colors hover:border-blue-500 hover:bg-[var(--bg-shell)] 2xl:w-auto 2xl:justify-start 2xl:gap-2 2xl:px-2"
            type="button"
          >
            <div className="hidden flex-col text-right 2xl:flex">
              <span className="font-bold text-[12px] leading-tight text-[var(--text-primary)]">
                {currentUser.name}
              </span>
              <span className="text-[10px] font-mono font-medium text-blue-400 leading-tight">
                {currentUser.titleTh}
              </span>
            </div>
            <div
              className={`h-7 w-7 rounded-full ${currentUser.badgeColor} text-white flex shrink-0 items-center justify-center font-bold text-[11px] shadow-xs`}
            >
              {currentUser.name.slice(0, 1)}
            </div>
            <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 2xl:block" />
          </button>

          {showRoleMenu && (
            <div className="absolute right-0 mt-1.5 w-72 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl py-1 z-50 animate-in fade-in">
              <div className="px-3 py-1.5 border-b border-[var(--border-color)] text-[11px] font-mono text-[var(--text-secondary)] uppercase">
                เปลี่ยนบทบาทผู้ใช้งาน
              </div>
              {Object.values(USER_ROLES).map((roleMeta) => (
                <button
                  key={roleMeta.role}
                  onClick={() => {
                    setCurrentRole(roleMeta.role as UserRole);
                    setShowRoleMenu(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 hover:bg-blue-600/10 transition-colors flex items-center justify-between text-[12.5px] ${
                    currentRole === roleMeta.role ? 'bg-blue-500/10 text-blue-400 font-bold' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-6 h-6 rounded-full ${roleMeta.badgeColor} text-white flex items-center justify-center font-bold text-[10px]`}
                    >
                  {roleMeta.name.slice(0, 1)}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-[var(--text-primary)]">
                        {roleMeta.name}
                      </span>
                      <span className="text-[10.5px] text-[var(--text-secondary)]">
                        {roleMeta.titleTh}
                      </span>
                    </div>
                  </div>
                  {currentRole === roleMeta.role && <Check className="w-4 h-4 text-blue-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Create Request CTA */}
        <button
          onClick={() => navigateToWorkspace('WMS-05', { tabIndex: 0 })}
          className="inline-flex h-9 w-9 items-center justify-center whitespace-nowrap rounded-lg bg-blue-600 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-500 2xl:w-auto 2xl:gap-1.5 2xl:px-3"
          type="button"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden 2xl:inline">ค้นหาและจองสินค้า</span>
        </button>
      </div>
      {showGuide && (
        <AppGuideModal
          onClose={() => setShowGuide(false)}
          onOpenWorkspace={(workspace: WorkspaceId) => {
            navigateToWorkspace(workspace, workspace === 'WMS-05' ? { tabIndex: 0 } : undefined);
            setShowGuide(false);
          }}
        />
      )}
    </header>
  );
};
