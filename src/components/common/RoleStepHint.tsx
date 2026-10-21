import React from 'react';
import { useWms } from '../../context/WmsContext';
import { USER_ROLES, UserRole } from '../../types/wms';

interface RoleStepHintProps {
  /** Roles allowed to act on the current step. */
  roles: UserRole[];
  /** What the step is, e.g. "เริ่มหยิบและบันทึกผลหยิบ". */
  action: string;
}

/** Explains a disabled step: who must do it and where to switch the demo role (the user menu, top right). */
export const RoleStepHint: React.FC<RoleStepHintProps> = ({ roles, action }) => {
  const { currentRole } = useWms();
  if (!roles.length || roles.includes(currentRole)) return null;
  const owners = roles.map((role) => `${USER_ROLES[role].titleTh} (${USER_ROLES[role].name})`).join(' หรือ ');
  return (
    <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-100">
      ขั้นถัดไป: <strong>{action}</strong> · ทำโดย <strong>{owners}</strong>
      <span className="text-amber-200/80"> · บทบาทปัจจุบัน {USER_ROLES[currentRole].titleTh} · สลับบทบาทได้ที่เมนูผู้ใช้มุมขวาบน</span>
    </div>
  );
};
