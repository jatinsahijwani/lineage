'use client';

import { Handle, Position } from 'reactflow';
import { Database, Brain, Zap } from 'lucide-react';

interface GraphNodeProps {
  data: {
    label: string;
    type: 'dataset' | 'model' | 'skill';
    value: string;
    attribution?: number;
    royaltyRate?: number;
  };
}

const nodeConfig = {
  dataset: {
    icon: Database,
    color: 'border-blue-500 bg-blue-500/10',
    textColor: 'text-blue-300',
  },
  model: {
    icon: Brain,
    color: 'border-purple-500 bg-purple-500/10',
    textColor: 'text-purple-300',
  },
  skill: {
    icon: Zap,
    color: 'border-cyan-500 bg-cyan-500/10',
    textColor: 'text-cyan-300',
  },
};

export function GraphNode({ data }: GraphNodeProps) {
  const config = nodeConfig[data.type];
  const Icon = config.icon;

  return (
    <div
      className={`rounded-lg border-2 ${config.color} px-4 py-3 min-w-[140px] text-center backdrop-blur-sm transition-all hover:shadow-lg hover:shadow-blue-500/20`}
    >
      <Handle type="target" position={Position.Top} />

      <div className="flex items-center justify-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${config.textColor}`} />
        <p className={`text-xs font-semibold ${config.textColor}`}>
          {data.type.charAt(0).toUpperCase() + data.type.slice(1)}
        </p>
      </div>

      <p className="text-sm font-bold text-white break-words">{data.label}</p>

      {data.attribution && (
        <p className="text-xs text-white/70 mt-1">Attribution: {data.attribution}%</p>
      )}

      {data.royaltyRate && (
        <p className="text-xs text-white/70 mt-1">Royalty: {data.royaltyRate}%</p>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
