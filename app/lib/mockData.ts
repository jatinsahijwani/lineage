import { 
  Dataset, 
  AIModel, 
  Skill, 
  RoyaltyPayment, 
  ProtocolStats,
  LineageGraphNode,
  LineageGraphEdge 
} from './types';

export const mockDatasets: Dataset[] = [
  {
    id: 'ds-1',
    name: 'ImageNet v2.1',
    attribution: 35,
    owner: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ae86',
    recordCount: 14_000_000,
  },
  {
    id: 'ds-2',
    name: 'Common Crawl 2024',
    attribution: 28,
    owner: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    recordCount: 850_000_000,
  },
  {
    id: 'ds-3',
    name: 'LAION-5B',
    attribution: 22,
    owner: '0x1234567890123456789012345678901234567890',
    recordCount: 5_850_000_000,
  },
  {
    id: 'ds-4',
    name: 'OpenWebText',
    attribution: 15,
    owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    recordCount: 40_000_000_000,
  },
];

export const mockModels: AIModel[] = [
  {
    id: 'model-1',
    name: 'Lineage Vision Pro',
    version: '2.1.0',
    tokenId: '0xLINGEAGE001',
    inputs: [mockDatasets[0], mockDatasets[1]],
    royaltyRate: 12,
    accuracy: 94.2,
    deployments: 847,
  },
  {
    id: 'model-2',
    name: 'Lineage NLP Master',
    version: '1.8.5',
    tokenId: '0xLINGEAGE002',
    inputs: [mockDatasets[2], mockDatasets[3]],
    royaltyRate: 8,
    accuracy: 91.7,
    deployments: 523,
  },
  {
    id: 'model-3',
    name: 'Lineage Multimodal X',
    version: '3.0.0-beta',
    tokenId: '0xLINGEAGE003',
    inputs: mockDatasets,
    royaltyRate: 15,
    accuracy: 96.1,
    deployments: 612,
  },
];

export const mockSkills: Skill[] = [
  {
    id: 'skill-1',
    name: 'Image Classification',
    description: 'Classify images into 1000+ categories with high accuracy',
    model: mockModels[0],
    usage: 2_450_000,
    rating: 4.8,
  },
  {
    id: 'skill-2',
    name: 'Text Summarization',
    description: 'Summarize long documents into concise key points',
    model: mockModels[1],
    usage: 1_920_000,
    rating: 4.6,
  },
  {
    id: 'skill-3',
    name: 'Object Detection',
    description: 'Detect and localize objects in images with bounding boxes',
    model: mockModels[0],
    usage: 3_100_000,
    rating: 4.9,
  },
  {
    id: 'skill-4',
    name: 'Sentiment Analysis',
    description: 'Determine sentiment from text (positive, negative, neutral)',
    model: mockModels[1],
    usage: 1_650_000,
    rating: 4.7,
  },
  {
    id: 'skill-5',
    name: 'Named Entity Recognition',
    description: 'Identify and classify named entities in text',
    model: mockModels[2],
    usage: 1_200_000,
    rating: 4.5,
  },
];

export const mockRoyaltyPayments: RoyaltyPayment[] = [
  {
    recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ae86',
    amount: 2_847.50,
    percentage: 28,
    status: 'settled',
    timestamp: '2024-05-08T14:32:00Z',
  },
  {
    recipient: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    amount: 1_524.32,
    percentage: 15,
    status: 'settled',
    timestamp: '2024-05-08T14:32:00Z',
  },
  {
    recipient: '0x1234567890123456789012345678901234567890',
    amount: 1_895.67,
    percentage: 19,
    status: 'verified',
    timestamp: '2024-05-08T12:00:00Z',
  },
  {
    recipient: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    amount: 945.21,
    percentage: 9.4,
    status: 'pending',
    timestamp: '2024-05-07T22:15:00Z',
  },
  {
    recipient: '0xfedcbafedcbafedcbafedcbafedcbafedcbafed',
    amount: 1_287.43,
    percentage: 12.8,
    status: 'pending',
    timestamp: '2024-05-07T18:45:00Z',
  },
];

export const protocolStats: ProtocolStats = {
  totalDatasets: 847,
  totalModels: 234,
  totalSkills: 1_203,
  settledRoyalties: '$12.4M',
  activeFarms: 456,
  networkUptime: 99.97,
};

export const mockLineageGraphNodes: LineageGraphNode[] = [
  // Datasets
  {
    id: 'ds-1',
    type: 'dataset',
    label: 'ImageNet v2.1',
    data: { value: 'ImageNet v2.1', attribution: 35 },
    position: { x: -300, y: -100 },
  },
  {
    id: 'ds-2',
    type: 'dataset',
    label: 'Common Crawl',
    data: { value: 'Common Crawl', attribution: 28 },
    position: { x: -300, y: 100 },
  },
  // Models
  {
    id: 'model-1',
    type: 'model',
    label: 'Vision Pro v2.1',
    data: { value: 'Vision Pro v2.1', royaltyRate: 12 },
    position: { x: 0, y: 0 },
  },
  {
    id: 'model-2',
    type: 'model',
    label: 'NLP Master v1.8',
    data: { value: 'NLP Master v1.8', royaltyRate: 8 },
    position: { x: 0, y: 150 },
  },
  // Skills
  {
    id: 'skill-1',
    type: 'skill',
    label: 'Image Classification',
    data: { value: 'Image Classification' },
    position: { x: 300, y: -50 },
  },
  {
    id: 'skill-2',
    type: 'skill',
    label: 'Object Detection',
    data: { value: 'Object Detection' },
    position: { x: 300, y: 50 },
  },
];

export const mockLineageGraphEdges: LineageGraphEdge[] = [
  {
    id: 'edge-1',
    source: 'ds-1',
    target: 'model-1',
    animated: true,
    label: '35%',
    data: { royaltyPercentage: 35 },
  },
  {
    id: 'edge-2',
    source: 'ds-2',
    target: 'model-1',
    animated: true,
    label: '28%',
    data: { royaltyPercentage: 28 },
  },
  {
    id: 'edge-3',
    source: 'model-1',
    target: 'skill-1',
    animated: true,
    label: 'deploys',
  },
  {
    id: 'edge-4',
    source: 'model-1',
    target: 'skill-2',
    animated: true,
    label: 'deploys',
  },
  {
    id: 'edge-5',
    source: 'model-2',
    target: 'skill-2',
    animated: true,
    label: 'trains',
  },
];
