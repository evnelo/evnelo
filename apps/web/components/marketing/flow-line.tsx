/** The brand motif: a rounded Pulse line through checkpoints. Labels are optional; keep it sparse. */
export function FlowLine({ labels, className }: { labels?: [string, string, string, string]; className?: string }) {
  const nodes = [
    { x: 8, y: 92, fill: "var(--evnelo-pulse)", stroke: "none" },
    { x: 380, y: 34, fill: "var(--evnelo-lime)", stroke: "var(--evnelo-ink)" },
    { x: 760, y: 92, fill: "var(--evnelo-sky)", stroke: "var(--evnelo-ink)" },
    { x: 1052, y: 40, fill: "var(--evnelo-pulse)", stroke: "none" },
  ];
  return (
    <svg viewBox="0 0 1060 150" className={className} aria-hidden fill="none">
      <path d="M8 92 C 190 92, 220 34, 380 34 S 600 92, 760 92 S 990 40, 1052 40" className="flow-line" />
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r="9" fill={n.fill} stroke={n.stroke} strokeWidth="2" />
          {labels && <text x={n.x} y={n.y + 34} textAnchor={i === 0 ? "start" : i === 3 ? "end" : "middle"} className="fill-muted-foreground" style={{ fontSize: 15, fontWeight: 500 }}>{labels[i]}</text>}
        </g>
      ))}
    </svg>
  );
}
