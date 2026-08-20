import React, { useRef } from 'react';
import {
  FINTECH_SCREEN_PNG,
  ECOMMERCE_SCREEN_PNG,
  CHECKOUT_SCREEN_PNG,
  ONBOARDING_SCREEN_PNG,
  ACTIVITY_SCREEN_PNG,
} from '../assets/mobileScreens';

export type PhoneDeviceType = 'dark' | 'light' | 'silver' | 'midnight';
export type PhoneSize = 'sm' | 'md' | 'lg' | 'xl';
export type ScreenArchetype =
  | 'fintech'
  | 'ai-chat'
  | 'e-commerce'
  | 'activity'
  | 'onboarding'
  | 'checkout'
  | 'workflow';

export interface MobileScreenAsset {
  id?: string;
  src: string;
  alt?: string;
}

const DEFAULT_ASSETS: Record<ScreenArchetype, string> = {
  fintech: FINTECH_SCREEN_PNG,
  'ai-chat': ONBOARDING_SCREEN_PNG,
  'e-commerce': ECOMMERCE_SCREEN_PNG,
  checkout: CHECKOUT_SCREEN_PNG,
  onboarding: ONBOARDING_SCREEN_PNG,
  activity: ACTIVITY_SCREEN_PNG,
  workflow: CHECKOUT_SCREEN_PNG,
};

const SIZE_CONFIGS: Record<PhoneSize, { width: number; height: number; radius: number; bezel: number }> = {
  sm: { width: 220, height: 450, radius: 36, bezel: 8 },
  md: { width: 280, height: 570, radius: 44, bezel: 10 },
  lg: { width: 340, height: 690, radius: 50, bezel: 12 },
  xl: { width: 390, height: 790, radius: 54, bezel: 14 },
};

/**
 * Presentation-Native Mobile Phone Frame Component
 * Separates physical device geometry/chassis from the replaceable PNG screen asset.
 */
export function PhoneMockup({
  screenAsset,
  archetype = 'fintech',
  device = 'dark',
  size = 'md',
  rotation = 0,
  scale = 1,
  shadow = true,
  editing = false,
  onReplaceScreen,
  style,
}: {
  screenAsset?: string | MobileScreenAsset;
  archetype?: ScreenArchetype;
  device?: PhoneDeviceType;
  size?: PhoneSize;
  rotation?: number;
  scale?: number;
  shadow?: boolean;
  editing?: boolean;
  onReplaceScreen?: (newSrc: string) => void;
  style?: React.CSSProperties;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cfg = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;
  const w = cfg.width;
  const h = cfg.height;
  const r = cfg.radius;
  const b = cfg.bezel;

  // Resolve screen image source
  const src =
    typeof screenAsset === 'string'
      ? screenAsset
      : screenAsset?.src || DEFAULT_ASSETS[archetype] || FINTECH_SCREEN_PNG;

  const chassisColor =
    device === 'light' || device === 'silver'
      ? '#E4E4E7'
      : device === 'midnight'
      ? '#0F172A'
      : '#18181B';

  const rimColor =
    device === 'light' || device === 'silver'
      ? 'rgba(0,0,0,0.12)'
      : 'rgba(255,255,255,0.18)';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl && onReplaceScreen) {
        onReplaceScreen(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      className="group"
      style={{
        width: w,
        height: h,
        borderRadius: r,
        padding: b,
        background: chassisColor,
        boxShadow: shadow
          ? '0 30px 60px -15px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)'
          : 'none',
        border: `1.5px solid ${rimColor}`,
        position: 'relative',
        transform: `rotate(${rotation}deg) scale(${scale})`,
        transformOrigin: 'center center',
        flexShrink: 0,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Dynamic Island Pill */}
      <div
        style={{
          position: 'absolute',
          top: b + 8,
          left: '50%',
          transform: 'translateX(-50%)',
          width: size === 'sm' ? 64 : size === 'md' ? 84 : 100,
          height: size === 'sm' ? 18 : size === 'md' ? 22 : 26,
          background: '#000000',
          borderRadius: 20,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px',
          pointerEvents: 'none',
        }}
      >
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#10B981' }} />
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1E1B4B' }} />
      </div>

      {/* Screen Viewport with internal clipping & Status Bar */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: r - b,
          overflow: 'hidden',
          position: 'relative',
          background: '#000000',
        }}
      >
        {/* Status Bar */}
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 18,
            right: 18,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: size === 'sm' ? 9 : 11,
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: '#FFFFFF',
            zIndex: 25,
            pointerEvents: 'none',
            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          }}
        >
          <span>9:41</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>5G</span>
            <span>100%</span>
          </div>
        </div>

        {/* Screen PNG Image Content */}
        <img
          src={src}
          alt="Mobile Screen Asset"
          className="w-full h-full object-cover select-none"
          draggable={false}
        />

        {/* Bottom Home Indicator Bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            left: '50%',
            transform: 'translateX(-50%)',
            width: size === 'sm' ? 60 : 80,
            height: 3,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.4)',
            zIndex: 25,
            pointerEvents: 'none',
          }}
        />

        {/* Edit-Mode Hover Action Overlay to Replace Screen Asset */}
        {editing && onReplaceScreen && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer z-40 p-4 text-center select-none"
          >
            <div className="px-3 py-1.5 bg-white text-black font-mono text-[11px] font-bold rounded-none shadow-lg">
              Replace Screen PNG
            </div>
            <span className="text-[10px] text-white/80 font-mono mt-1">Upload .png / .jpg</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composable Presentation Mockup Layouts
// ---------------------------------------------------------------------------

/** Hero Dual Phone Presentation */
export function DualPhoneComposition({
  leftScreen,
  rightScreen,
  editing = false,
  onEditLeft,
  onEditRight,
}: {
  leftScreen?: string | MobileScreenAsset;
  rightScreen?: string | MobileScreenAsset;
  editing?: boolean;
  onEditLeft?: (src: string) => void;
  onEditRight?: (src: string) => void;
}) {
  return (
    <div className="relative flex items-center justify-center select-none" style={{ width: 620, height: 600 }}>
      {/* Back / Left Phone */}
      <div style={{ position: 'absolute', left: 40, top: 40, zIndex: 10 }}>
        <PhoneMockup
          screenAsset={leftScreen}
          archetype="fintech"
          size="md"
          rotation={-6}
          device="dark"
          editing={editing}
          onReplaceScreen={onEditLeft}
        />
      </div>
      {/* Front / Right Phone */}
      <div style={{ position: 'absolute', right: 40, top: 10, zIndex: 20 }}>
        <PhoneMockup
          screenAsset={rightScreen}
          archetype="checkout"
          size="lg"
          rotation={4}
          device="midnight"
          editing={editing}
          onReplaceScreen={onEditRight}
        />
      </div>
    </div>
  );
}

/** Triple Phone Hero Trio */
export function TriplePhoneComposition({
  screens = [],
  editing = false,
  onEditScreen,
}: {
  screens?: (string | MobileScreenAsset)[];
  editing?: boolean;
  onEditScreen?: (index: number, src: string) => void;
}) {
  return (
    <div className="relative flex items-center justify-center select-none" style={{ width: 840, height: 640 }}>
      {/* Left Phone */}
      <div style={{ position: 'absolute', left: 20, top: 50, zIndex: 10 }}>
        <PhoneMockup
          screenAsset={screens[0]}
          archetype="onboarding"
          size="md"
          rotation={-8}
          editing={editing}
          onReplaceScreen={(src) => onEditScreen?.(0, src)}
        />
      </div>
      {/* Center Hero Phone */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 0, zIndex: 30 }}>
        <PhoneMockup
          screenAsset={screens[1]}
          archetype="fintech"
          size="lg"
          rotation={0}
          editing={editing}
          onReplaceScreen={(src) => onEditScreen?.(1, src)}
        />
      </div>
      {/* Right Phone */}
      <div style={{ position: 'absolute', right: 20, top: 50, zIndex: 20 }}>
        <PhoneMockup
          screenAsset={screens[2]}
          archetype="checkout"
          size="md"
          rotation={8}
          editing={editing}
          onReplaceScreen={(src) => onEditScreen?.(2, src)}
        />
      </div>
    </div>
  );
}

/** Sequential Workflow 3 or 4 Phone Steps */
export function PhoneWorkflowSequence({
  steps = [],
  screens = [],
  editing = false,
  onEditScreen,
}: {
  steps?: { stepNum: string; label: string; description: string; archetype: ScreenArchetype }[];
  screens?: (string | MobileScreenAsset)[];
  editing?: boolean;
  onEditScreen?: (index: number, src: string) => void;
}) {
  const defaultSteps = [
    { stepNum: '01', label: 'Discover', description: 'Personalized stream', archetype: 'onboarding' as const },
    { stepNum: '02', label: 'Configure', description: 'Interactive builder', archetype: 'e-commerce' as const },
    { stepNum: '03', label: 'Execute', description: 'Sub-second confirmation', archetype: 'checkout' as const },
  ];

  const items = steps.length ? steps : defaultSteps;

  return (
    <div className="flex items-center justify-center gap-8 select-none">
      {items.map((st, i) => (
        <div key={i} className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-none font-mono text-[11px] font-bold uppercase shadow-sm bg-indigo-500 text-white">
              {st.stepNum}
            </span>
            <span className="font-bold text-[15px] text-white tracking-tight">{st.label}</span>
          </div>

          <PhoneMockup
            screenAsset={screens[i]}
            archetype={st.archetype}
            size="sm"
            device="dark"
            editing={editing}
            onReplaceScreen={(src) => onEditScreen?.(i, src)}
          />

          <p className="text-[12px] text-neutral-400 font-mono text-center max-w-[180px]">
            {st.description}
          </p>
        </div>
      ))}
    </div>
  );
}
