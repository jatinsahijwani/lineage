'use client';

import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { mockLineageGraphNodes, mockLineageGraphEdges } from '@/lib/mockData';
import { GraphNode } from './GraphNode';
import { GraphEdge } from './GraphEdge';

const nodeTypes = {
  custom: GraphNode,
};

const edgeTypes = {
  custom: GraphEdge,
};

export function LineageGraph() {
  // Convert mock data to ReactFlow format
  const initialNodes: Node[] = mockLineageGraphNodes.map((node) => ({
    id: node.id,
    data: {
      label: node.label,
      type: node.type,
      value: node.data.value,
      attribution: node.data.attribution,
      royaltyRate: node.data.royaltyRate,
    },
    position: node.position,
    type: 'custom',
  }));

  const initialEdges: Edge[] = mockLineageGraphEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'custom',
    label: edge.label,
    animated: edge.animated,
    data: {
      royaltyPercentage: edge.data?.royaltyPercentage,
    },
  }));

  const [nodes] = useNodesState(initialNodes);
  const [edges] = useEdgesState(initialEdges);

  return (
    <div className="h-96 w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        attributionPosition="bottom-right"
      >
        <Background
          color="#ffffff"
          variant={BackgroundVariant.Dots}
          gap={12}
          size={1}
          style={{
            backgroundColor: 'rgba(15, 15, 15, 0.5)',
          }}
        />
        <Controls
          style={{
            backgroundColor: 'rgba(30, 30, 30, 0.8)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
          }}
        />
      </ReactFlow>
    </div>
  );
}
