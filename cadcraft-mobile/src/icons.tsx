// Line icons for the ribbon (24×24, drawn with the current stroke colour).
import Svg, { Circle, Ellipse, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

export type IconName =
  | 'sketch' | 'finish' | 'extrude' | 'revolve' | 'loft' | 'hole' | 'fillet' | 'chamfer' | 'shell'
  | 'rectPattern' | 'circPattern' | 'mirror' | 'box' | 'cylinder' | 'cone' | 'sphere' | 'import' | 'export'
  | 'iso' | 'top' | 'front' | 'right' | 'fit' | 'props' | 'part' | 'line' | 'circle' | 'arc' | 'rect' | 'dim' | 'constraint';

export function Icon({ name, size = 26, color = '#e5e7eb', accent = '#38bdf8' }: { name: IconName; size?: number; color?: string; accent?: string }) {
  const p = { stroke: color, strokeWidth: 1.6, fill: 'none', strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  const a = { ...p, stroke: accent };
  const body = (() => {
    switch (name) {
      case 'sketch': return <><Rect x={3} y={9} width={12} height={10} {...p} /><Path d="M14 14 L21 3 L22.5 4.5 L15.5 15.5 L13.5 16.5 Z" {...a} /></>;
      case 'finish': return <><Rect x={3} y={6} width={13} height={13} {...p} /><Polyline points="9,13 13,17 22,5" {...a} strokeWidth={2.4} /></>;
      case 'extrude': return <><Polygon points="4,17 12,21 20,17 12,13" {...p} /><Polyline points="4,17 4,9 12,5 20,9 20,17" {...p} /><Line x1={12} y1={13} x2={12} y2={5} {...p} /><Path d="M12 11 V1 M9.5 3.5 L12 1 L14.5 3.5" {...a} /></>;
      case 'revolve': return <><Ellipse cx={12} cy={17} rx={8} ry={3} {...p} /><Ellipse cx={12} cy={7} rx={8} ry={3} {...p} /><Line x1={4} y1={7} x2={4} y2={17} {...p} /><Line x1={20} y1={7} x2={20} y2={17} {...p} /><Line x1={12} y1={1} x2={12} y2={23} {...a} strokeDasharray="2 2" /></>;
      case 'loft': return <><Rect x={4} y={16} width={16} height={5} {...p} /><Ellipse cx={12} cy={5} rx={4} ry={2} {...a} /><Line x1={4} y1={16} x2={8} y2={5} {...p} /><Line x1={20} y1={16} x2={16} y2={5} {...p} /></>;
      case 'hole': return <><Polygon points="2,12 12,7 22,12 12,17" {...p} /><Ellipse cx={12} cy={12} rx={3.5} ry={1.8} {...a} /><Path d="M8.5 12 V20 M15.5 12 V20" {...a} strokeDasharray="2 1.5" /></>;
      case 'fillet': return <><Path d="M3 21 V10 Q3 3 10 3 H21" {...p} /><Path d="M3 21 H21 V3" {...p} strokeDasharray="2 2" /><Path d="M3 10 Q3 3 10 3" {...a} strokeWidth={2.4} /></>;
      case 'chamfer': return <><Path d="M3 21 V10 L10 3 H21" {...p} /><Line x1={3} y1={10} x2={10} y2={3} {...a} strokeWidth={2.4} /></>;
      case 'shell': return <><Rect x={3} y={6} width={18} height={15} {...p} /><Polyline points="6,6 6,18 18,18 18,6" {...a} /></>;
      case 'rectPattern': return <>{[4, 10, 16].flatMap((x) => [5, 13].map((y) => <Rect key={`${x}${y}`} x={x} y={y} width={4} height={4} {...(x === 4 && y === 5 ? a : p)} />))}</>;
      case 'circPattern': return <><Circle cx={12} cy={12} r={8} {...p} strokeDasharray="2 2" />{[0, 72, 144, 216, 288].map((d, i) => <Circle key={d} cx={12 + 8 * Math.cos((d * Math.PI) / 180)} cy={12 + 8 * Math.sin((d * Math.PI) / 180)} r={2} {...(i ? p : a)} />)}</>;
      case 'mirror': return <><Polygon points="3,6 10,9 10,18 3,15" {...p} /><Polygon points="21,6 14,9 14,18 21,15" {...a} /><Line x1={12} y1={2} x2={12} y2={22} {...p} strokeDasharray="2 2" /></>;
      case 'box': return <><Polygon points="3,8 12,4 21,8 12,12" {...p} /><Polyline points="3,8 3,17 12,21 21,17 21,8" {...p} /><Line x1={12} y1={12} x2={12} y2={21} {...p} /></>;
      case 'cylinder': return <><Ellipse cx={12} cy={5} rx={7} ry={2.5} {...p} /><Path d="M5 5 V19 A7 2.5 0 0 0 19 19 V5" {...p} /></>;
      case 'cone': return <><Ellipse cx={12} cy={19} rx={8} ry={2.5} {...p} /><Polyline points="4,19 12,3 20,19" {...p} /></>;
      case 'sphere': return <><Circle cx={12} cy={12} r={9} {...p} /><Ellipse cx={12} cy={12} rx={9} ry={3} {...p} /></>;
      case 'import': return <><Path d="M4 15 V20 H20 V15" {...p} /><Path d="M12 3 V15 M7.5 10.5 L12 15 L16.5 10.5" {...a} /></>;
      case 'export': return <><Path d="M4 15 V20 H20 V15" {...p} /><Path d="M12 15 V3 M7.5 7.5 L12 3 L16.5 7.5" {...a} /></>;
      case 'iso': return <><Polygon points="3,8 12,4 21,8 12,12" {...a} /><Polyline points="3,8 3,17 12,21 21,17 21,8" {...p} /><Line x1={12} y1={12} x2={12} y2={21} {...p} /></>;
      case 'top': return <><Rect x={4} y={4} width={16} height={16} {...a} /><Line x1={4} y1={12} x2={20} y2={12} {...p} strokeDasharray="2 2" /></>;
      case 'front': return <><Rect x={4} y={6} width={16} height={14} {...a} /><Polyline points="4,6 8,2 24,2 20,6" {...p} /></>;
      case 'right': return <><Rect x={5} y={6} width={10} height={14} {...a} /><Polyline points="15,6 20,2 20,16 15,20" {...p} /></>;
      case 'fit': return <><Path d="M3 8 V3 H8 M16 3 H21 V8 M21 16 V21 H16 M8 21 H3 V16" {...p} /><Rect x={8} y={8} width={8} height={8} {...a} /></>;
      case 'props': return <><Circle cx={12} cy={12} r={9} {...p} /><Line x1={12} y1={10} x2={12} y2={17} {...a} strokeWidth={2.2} /><Circle cx={12} cy={7} r={0.8} {...a} /></>;
      case 'part': return <><Polygon points="3,8 12,4 21,8 12,12" {...p} /><Polyline points="3,8 3,17 12,21 21,17 21,8" {...p} /><Line x1={12} y1={12} x2={12} y2={21} {...p} /><Circle cx={16} cy={9} r={1.5} {...a} /></>;
      case 'line': return <><Line x1={4} y1={20} x2={20} y2={4} {...p} /><Circle cx={4} cy={20} r={1.8} {...a} /><Circle cx={20} cy={4} r={1.8} {...a} /></>;
      case 'circle': return <><Circle cx={12} cy={12} r={8} {...p} /><Circle cx={12} cy={12} r={1.5} {...a} /></>;
      case 'arc': return <><Path d="M4 18 A9 9 0 0 1 20 18" {...p} /><Circle cx={4} cy={18} r={1.8} {...a} /><Circle cx={20} cy={18} r={1.8} {...a} /></>;
      case 'rect': return <><Rect x={4} y={6} width={16} height={12} {...p} /><Circle cx={4} cy={18} r={1.8} {...a} /><Circle cx={20} cy={6} r={1.8} {...a} /></>;
      case 'dim': return <><Path d="M3 9 V19 M21 9 V19" {...p} /><Path d="M3 14 H21 M6 11.5 L3 14 L6 16.5 M18 11.5 L21 14 L18 16.5" {...a} /><Line x1={10} y1={5} x2={14} y2={5} {...p} /></>;
      case 'constraint': return <><Line x1={4} y1={8} x2={20} y2={8} {...p} /><Line x1={4} y1={16} x2={20} y2={16} {...p} /><Path d="M12 5 V11 M10 5 H14" {...a} /></>;
    }
  })();
  return <Svg width={size} height={size} viewBox="0 0 24 24">{body}</Svg>;
}
