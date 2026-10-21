import React from 'react';
import ttsLogo from '../../assets/tts-thaitaveeporn-steel.png';

export const TtsLogo: React.FC<{ className?: string }> = ({ className = 'h-10' }) => (
  <div className={`flex items-center select-none ${className}`}>
    <img
      src={ttsLogo}
      alt="โลโก้บริษัทไทยทวีพรค้าเหล็ก"
      className="h-full w-auto max-w-[100px] rounded bg-white p-0.5 object-contain"
    />
  </div>
);
