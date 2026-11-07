// Íconos propios de la app: glyphs geométricos mínimos, stroke 1.8, pensados
// para lectura operativa (no decorativos). Dibujados a mano con primitivas SVG.

import Svg, { Circle, Path, Rect } from "react-native-svg";

function I({ children, size = 22, color }: { children: React.ReactNode; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {children}
    </Svg>
  );
}
const S = (color: string) => ({ stroke: color, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

export const IconDocs = ({ size, color }: { size?: number; color: string }) => (
  <I size={size} color={color}>
    <Path d="M7 3h7l4 4v14H7z" {...S(color)} />
    <Path d="M10 9h5M10 13h5M10 17h3" {...S(color)} />
  </I>
);

export const IconPlus = ({ size, color }: { size?: number; color: string }) => (
  <I size={size} color={color}>
    <Rect x="4" y="4" width="16" height="16" rx="4" {...S(color)} />
    <Path d="M12 8.5v7M8.5 12h7" {...S(color)} />
  </I>
);

export const IconWallet = ({ size, color }: { size?: number; color: string }) => (
  <I size={size} color={color}>
    <Path d="M4 8a2 2 0 0 1 2-2h12v12H6a2 2 0 0 1-2-2z" {...S(color)} />
    <Path d="M4 8h16M15 13h3" {...S(color)} />
  </I>
);

export const IconCar = ({ size, color }: { size?: number; color: string }) => (
  <I size={size} color={color}>
    <Path d="M5 12l1.5-5h11L19 12v5h-2M5 12v5h2m0 0h10" {...S(color)} />
    <Circle cx="8.5" cy="17" r="1.4" fill={color} />
    <Circle cx="15.5" cy="17" r="1.4" fill={color} />
  </I>
);

export const IconTicket = ({ size, color }: { size?: number; color: string }) => (
  <I size={size} color={color}>
    <Path d="M4 8a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v3a2 2 0 0 0 0 2v3a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-2z" {...S(color)} />
    <Path d="M14 7v2M14 15v2" {...S(color)} strokeDasharray="2.5 2.5" />
  </I>
);

export const IconCopy = ({ size, color }: { size?: number; color: string }) => (
  <I size={size} color={color}>
    <Rect x="8" y="8" width="11" height="12" rx="2.5" {...S(color)} />
    <Path d="M6 15V6a2 2 0 0 1 2-2h7" {...S(color)} />
  </I>
);

export const IconCheck = ({ size, color }: { size?: number; color: string }) => (
  <I size={size} color={color}>
    <Path d="M5 12.5l4.5 4.5L19 7.5" {...S(color)} strokeWidth={2.2} />
  </I>
);

export const IconShare = ({ size, color }: { size?: number; color: string }) => (
  <I size={size} color={color}>
    <Path d="M12 3v12M8 6l4-4 4 4" {...S(color)} />
    <Path d="M6 11v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-7" {...S(color)} />
  </I>
);

export const IconWarn = ({ size, color }: { size?: number; color: string }) => (
  <I size={size} color={color}>
    <Path d="M12 4L2.5 20h19z" {...S(color)} />
    <Path d="M12 10v4" {...S(color)} />
    <Circle cx="12" cy="17" r="1" fill={color} />
  </I>
);

export const IconShield = ({ size, color }: { size?: number; color: string }) => (
  <I size={size} color={color}>
    <Path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" {...S(color)} />
    <Path d="M9 12l2 2 4-4" {...S(color)} />
  </I>
);

export const IconEye = ({ size, color }: { size?: number; color: string }) => (
  <I size={size} color={color}>
    <Path d="M2.5 12C5 7.5 8.2 5 12 5s7 2.5 9.5 7c-2.5 4.5-5.7 7-9.5 7S5 16.5 2.5 12z" {...S(color)} />
    <Circle cx="12" cy="12" r="2.6" {...S(color)} />
  </I>
);

export const IconEyeOff = ({ size, color }: { size?: number; color: string }) => (
  <I size={size} color={color}>
    <Path d="M2.5 12C5 7.5 8.2 5 12 5s7 2.5 9.5 7c-2.5 4.5-5.7 7-9.5 7S5 16.5 2.5 12z" {...S(color)} />
    <Path d="M4 4l16 16" {...S(color)} />
  </I>
);

export const IconBack = ({ size, color }: { size?: number; color: string }) => (
  <I size={size} color={color}>
    <Path d="M15 5l-7 7 7 7" {...S(color)} strokeWidth={2.2} />
  </I>
);
