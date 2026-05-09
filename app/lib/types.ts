export interface Dataset {
  id: string;
  name: string;
  attribution: number; // percentage
  owner: string;
  recordCount: number;
}

export interface AIModel {
  id: string;
  name: string;
  version: string;
  tokenId: string;
  inputs: Dataset[];
  royaltyRate: number;
  accuracy: number;
  deployments: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  model: AIModel;
  usage: number;
  rating: number;
}

export interface RoyaltyPayment {
  recipient: string;
  amount: number;
  percentage: number;
  status: 'pending' | 'settled' | 'verified';
  timestamp: string;
}

export interface ProtocolStats {
  totalDatasets: number;
  totalModels: number;
  totalSkills: number;
  settledRoyalties: string;
  activeFarms: number;
  networkUptime: number;
}

export interface LineageGraphNode {
  id: string;
  type: 'dataset' | 'model' | 'skill';
  label: string;
  data: {
    value: string;
    attribution?: number;
    royaltyRate?: number;
  };
  position: { x: number; y: number };
  style?: React.CSSProperties;
}

export interface LineageGraphEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  label?: string;
  data?: {
    royaltyPercentage?: number;
  };
}
