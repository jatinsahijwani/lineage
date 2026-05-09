'use client';

import {
  EdgeProps,
  getBezierPath,
  MarkerType,
} from 'reactflow';

export function GraphEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  label,
  animated,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <>
      <path
        id={id}
        className={`stroke-blue-500/50 stroke-2 fill-none transition-all hover:stroke-blue-400 hover:stroke-3 ${
          animated ? 'animate-pulse' : ''
        }`}
        d={edgePath}
        markerEnd={MarkerType.ArrowClosed}
        style={{
          markerEnd: 'url(#arrowBlue)',
        }}
      />

      {label && (
        <text
          x={(sourceX + targetX) / 2}
          y={(sourceY + targetY) / 2 - 10}
          className="fill-white/70 text-xs font-semibold"
          textAnchor="middle"
        >
          {label}
        </text>
      )}

      {/* Arrow marker definition */}
      <defs>
        <marker
          id="arrowBlue"
          markerWidth="20"
          markerHeight="20"
          markerUnits="strokeWidth"
          orient="auto"
          refX="20"
          refY="10"
        >
          <polyline
            points="0,0 20,10 0,20"
            fill="none"
            stroke="#3B82F6"
            strokeWidth={1.5}
          />
        </marker>
      </defs>
    </>
  );
}
