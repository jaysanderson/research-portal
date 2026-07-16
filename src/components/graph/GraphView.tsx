import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Plus, Minus, Maximize2 } from 'lucide-react';
import type { GraphData, GraphNode } from '../../lib/graph';

interface SimNode extends GraphNode { x?: number; y?: number; fx?: number | null; fy?: number | null }
interface SimEdge { source: SimNode; target: SimNode; weight: number; label?: string }

// Named-entity groups get distinct colors (entity-relations mode); taxonomy mode
// falls back to primary=green / secondary=amber.
const GROUP_COLORS: Record<string, string> = {
  ORG: '#2F31D8', PRODUCT: '#F0A81E', PERSON: '#8B5CF6', GPE: '#EF6A4D', LOC: '#0EA5E9',
  EVENT: '#EC4899', FAC: '#10B981', NORP: '#6366F1', WORK_OF_ART: '#F59E0B', LAW: '#0D9488',
  LANGUAGE: '#06B6D4', DATE: '#64748B', TIME: '#64748B',
};

// Two-dimension graph: primary nodes green, secondary amber (whatever the
// taxonomies are named for this KB). Labels are shown for the larger nodes and
// revealed on hover for the rest, so the dense centre stays legible.

export function GraphView({ data, onSelect, selected, edgeLabels }: {
  data: GraphData;
  onSelect: (node: GraphNode | null) => void;
  selected?: string | null;
  edgeLabels?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll('*').remove();
    const width = ref.current.clientWidth || 800;
    const height = ref.current.clientHeight || 560;

    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const idMap = new Map(nodes.map((n) => [n.id, n]));
    const edges: SimEdge[] = data.edges
      .map((e) => ({ source: idMap.get(e.source)!, target: idMap.get(e.target)!, weight: e.weight, label: e.label }))
      .filter((e) => e.source && e.target);

    // adjacency for hover highlighting
    const neighbors = new Map<string, Set<string>>();
    nodes.forEach((n) => neighbors.set(n.id, new Set([n.id])));
    edges.forEach((e) => { neighbors.get(e.source.id)!.add(e.target.id); neighbors.get(e.target.id)!.add(e.source.id); });

    const maxW = d3.max(nodes, (n) => n.weight) || 1;
    const r = d3.scaleSqrt().domain([1, maxW]).range([6, 26]);
    const maxE = d3.max(edges, (e) => e.weight) || 1;
    const ew = d3.scaleLinear().domain([1, maxE]).range([0.5, 4]);
    // Only label the more significant nodes up front; the rest reveal on hover.
    const labelThreshold = Math.max(13, r(maxW) * 0.52);
    const showLabel = (d: SimNode) => r(d.weight) >= labelThreshold;

    const g = svg.append('g');
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 4]).on('zoom', (ev) => g.attr('transform', ev.transform));
    zoomRef.current = zoom;
    svg.call(zoom);

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<SimNode, SimEdge>(edges).id((d) => d.id).distance((e) => 120 - ew(e.weight) * 8))
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<SimNode>().radius((d) => r(d.weight) + 6));

    const link = g.append('g').attr('stroke', '#cbd5e1').selectAll('line').data(edges).join('line')
      .attr('stroke-width', (d) => ew(d.weight)).attr('stroke-opacity', 0.5);

    // Relation labels on edges (entity-relations mode) — the "developer", "has part"
    // etc. that make this a real knowledge graph rather than co-occurrence.
    const edgeLabel = g.append('g').selectAll<SVGTextElement, SimEdge>('text')
      .data(edgeLabels ? edges.filter((e) => e.label) : []).join('text')
      .text((d) => d.label || '').attr('font-size', 8.5).attr('fill', '#64748b')
      .attr('text-anchor', 'middle').attr('pointer-events', 'none')
      .attr('paint-order', 'stroke').attr('stroke', '#fff').attr('stroke-width', 2.5).attr('opacity', 0.85);

    const node = g.append('g').selectAll<SVGGElement, SimNode>('g').data(nodes).join('g').style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, SimNode>()
        .on('start', (ev, d) => { if (!ev.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
        .on('end', (ev, d) => { if (!ev.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }) as any);

    const colorFor = (grp: string) => GROUP_COLORS[grp] || (grp === data.primary ? '#2F31D8' : '#F0A81E');
    node.append('circle')
      .attr('r', (d) => r(d.weight))
      .attr('fill', (d) => colorFor(d.group))
      .attr('stroke', '#fff').attr('stroke-width', 1.5);

    const labels = node.append('text').text((d) => d.label)
      .attr('x', (d) => r(d.weight) + 4).attr('y', 4)
      .attr('font-size', 11).attr('fill', '#334155')
      .attr('paint-order', 'stroke').attr('stroke', '#fff').attr('stroke-width', 3)
      .attr('pointer-events', 'none')
      .attr('opacity', (d) => (showLabel(d) ? 1 : 0));

    // Hover: reveal labels, raise the node, and focus its neighbourhood.
    node.on('mouseenter', function (_ev, d) {
      const nb = neighbors.get(d.id)!;
      node.attr('opacity', (o) => (nb.has(o.id) ? 1 : 0.18));
      labels.attr('opacity', (o) => (nb.has(o.id) ? 1 : 0)).attr('font-weight', (o) => (o.id === d.id ? 700 : 400));
      link.attr('stroke-opacity', (e) => (e.source.id === d.id || e.target.id === d.id ? 0.9 : 0.06))
        .attr('stroke', (e) => (e.source.id === d.id || e.target.id === d.id ? '#94a3b8' : '#cbd5e1'));
      d3.select(this).raise();
    }).on('mouseleave', () => {
      node.attr('opacity', 1);
      labels.attr('opacity', (o) => (showLabel(o) ? 1 : 0)).attr('font-weight', 400);
      link.attr('stroke-opacity', 0.5).attr('stroke', '#cbd5e1');
    });

    node.on('click', (_ev, d) => onSelect(d));

    sim.on('tick', () => {
      link.attr('x1', (d) => d.source.x!).attr('y1', (d) => d.source.y!).attr('x2', (d) => d.target.x!).attr('y2', (d) => d.target.y!);
      edgeLabel.attr('x', (d) => ((d.source.x! + d.target.x!) / 2)).attr('y', (d) => ((d.source.y! + d.target.y!) / 2));
      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => { sim.stop(); };
  }, [data, onSelect, edgeLabels]);

  // highlight selected
  useEffect(() => {
    if (!ref.current) return;
    d3.select(ref.current).selectAll<SVGCircleElement, SimNode>('circle')
      .attr('stroke', (d) => (d.id === selected ? '#0f172a' : '#fff'))
      .attr('stroke-width', (d) => (d.id === selected ? 3 : 1.5));
  }, [selected]);

  const zoomBy = (k: number) => { if (ref.current && zoomRef.current) d3.select(ref.current).transition().duration(200).call(zoomRef.current.scaleBy, k); };
  const reset = () => { if (ref.current && zoomRef.current) d3.select(ref.current).transition().duration(250).call(zoomRef.current.transform, d3.zoomIdentity); };

  return (
    <div className="relative h-full w-full">
      <svg ref={ref} className="h-full w-full" />
      <div className="absolute right-3 top-3 flex flex-col gap-1">
        <CtrlBtn label="Zoom in" onClick={() => zoomBy(1.4)}><Plus size={15} /></CtrlBtn>
        <CtrlBtn label="Zoom out" onClick={() => zoomBy(1 / 1.4)}><Minus size={15} /></CtrlBtn>
        <CtrlBtn label="Reset view" onClick={reset}><Maximize2 size={14} /></CtrlBtn>
      </div>
    </div>
  );
}

function CtrlBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-200 bg-white/90 text-ink-600 shadow-sm hover:bg-ink-50 hover:text-ink-900">
      {children}
    </button>
  );
}
