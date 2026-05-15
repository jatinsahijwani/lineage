"use client";

import { motion } from "framer-motion";
import type { AgentSpec } from "./useDemoScreen";

interface NodeSpec {
  id: string;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  variant: "data" | "model" | "skill";
}

interface EdgeSpec {
  id: string;
  from: string;
  to: string;
  highlight: boolean;
}

const COLORS = {
  data: "#06B6D4",
  model: "#7C3AED",
  skill: "#4F46E5",
};

interface LineageTreeSvgProps {
  agent: AgentSpec;
  highlights: { model?: boolean; skills?: Set<string>; data?: Set<string> };
}

export function LineageTreeSvg({ agent, highlights }: LineageTreeSvgProps) {
  const W = 560;
  const H = 260;

  // Layout: model on the right, data on the left, skills below the model.
  const modelNode: NodeSpec = {
    id: "model",
    label: `Model #${agent.modelTokenId.toString()}`,
    variant: "model",
    x: 380,
    y: 50,
  };

  const skillNodes: NodeSpec[] = agent.skills.map((tokenId, i) => ({
    id: `skill-${tokenId}`,
    label: `Skill #${tokenId.toString()}`,
    variant: "skill",
    x: 380,
    y: 160 + i * 60,
  }));

  const dataNodes: NodeSpec[] = agent.data.map((tokenId, i) => ({
    id: `data-${tokenId}`,
    label: `Data #${tokenId.toString()}`,
    variant: "data",
    x: 90,
    y: 50 + i * 80,
  }));

  const allNodes = [...dataNodes, ...skillNodes, modelNode];
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

  const edges: EdgeSpec[] = [];
  // Data → Model (TrainedOn)
  for (const d of dataNodes) {
    edges.push({
      id: `${d.id}->model`,
      from: d.id,
      to: "model",
      highlight:
        !!highlights.model && (highlights.data?.has(d.id.split("-")[1]!) ?? false),
    });
  }
  // Skill → Model (Composes)
  for (const s of skillNodes) {
    edges.push({
      id: `${s.id}->model`,
      from: s.id,
      to: "model",
      highlight:
        !!highlights.model &&
        (highlights.skills?.has(s.id.split("-")[1]!) ?? false),
    });
  }

  const buildPath = (a: NodeSpec, b: NodeSpec) => {
    const dx = (b.x - a.x) * 0.5;
    return `M ${a.x + 60} ${a.y + 22} C ${a.x + 60 + dx} ${a.y + 22}, ${b.x - dx} ${b.y + 22}, ${b.x} ${b.y + 22}`;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Lineage graph"
    >
      <defs>
        <linearGradient id="edge-active" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>

      {edges.map((edge) => {
        const a = nodeMap.get(edge.from)!;
        const b = nodeMap.get(edge.to)!;
        const d = buildPath(a, b);
        return (
          <g key={edge.id}>
            <path
              d={d}
              fill="none"
              stroke={edge.highlight ? "url(#edge-active)" : "rgba(255,255,255,0.1)"}
              strokeWidth={edge.highlight ? 2 : 1}
              strokeDasharray={edge.highlight ? "4 4" : "2 4"}
            >
              {edge.highlight && (
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="-16"
                  dur="0.9s"
                  repeatCount="indefinite"
                />
              )}
            </path>
          </g>
        );
      })}

      {allNodes.map((n, i) => {
        const isHighlighted =
          (n.variant === "model" && highlights.model) ||
          (n.variant === "skill" &&
            highlights.skills?.has(n.id.split("-")[1]!)) ||
          (n.variant === "data" && highlights.data?.has(n.id.split("-")[1]!));
        const color = COLORS[n.variant];
        return (
          <motion.g
            key={n.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
          >
            <rect
              x={n.x}
              y={n.y}
              width={120}
              height={44}
              rx={10}
              ry={10}
              fill={isHighlighted ? color : "rgba(15,15,15,0.6)"}
              fillOpacity={isHighlighted ? 0.18 : 1}
              stroke={color}
              strokeOpacity={isHighlighted ? 1 : 0.4}
              strokeWidth={isHighlighted ? 2 : 1}
              style={{
                filter: isHighlighted
                  ? `drop-shadow(0 0 12px ${color}90)`
                  : undefined,
              }}
            />
            <text
              x={n.x + 60}
              y={n.y + 27}
              textAnchor="middle"
              fontSize={12}
              fontFamily="var(--font-mono, ui-monospace)"
              fill={isHighlighted ? "#fff" : "rgba(255,255,255,0.7)"}
            >
              {n.label}
            </text>
          </motion.g>
        );
      })}
    </svg>
  );
}
