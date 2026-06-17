import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { GraphData, GraphNode } from '../../lib/graph';

interface SimNode extends GraphNode { x?: number; y?: number; fx?: number | null; fy?: number | null }
interface SimEdge { source: SimNode; target: SimNode; weight: number }

// Two-dimension graph: primary nodes green, secondary amber (whatever the
// taxonomies are named for this KB).

export function GraphView({ data, onSelect, selected }: {
  data: GraphData;
  onSelect: (node: GraphNode | null) => void;
  selected?: string | null;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll('*').remove();
    const width = ref.current.clientWidth || 800;
    const height = ref.current.clientHeight || 560;

    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const idMap = new Map(nodes.map((n) => [n.id, n]));
    const edges: SimEdge[] = data.edges
      .map((e) => ({ source: idMap.get(e.source)!, target: idMap.get(e.target)!, weight: e.weight }))
      .filter((e) => e.source && e.target);

    const maxW = d3.max(nodes, (n) => n.weight) || 1;
    const r = d3.scaleSqrt().domain([1, maxW]).range([6, 26]);
    const maxE = d3.max(edges, (e) => e.weight) || 1;
    const ew = d3.scaleLinear().domain([1, maxE]).range([0.5, 4]);

    const g = svg.append('g');
    svg.call(
      d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 4]).on('zoom', (ev) => g.attr('transform', ev.transform)) as any
    );

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<SimNode, SimEdge>(edges).id((d) => d.id).distance((e) => 120 - ew(e.weight) * 8))
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<SimNode>().radius((d) => r(d.weight) + 6));

    const link = g.append('g').attr('stroke', '#cbd5e1').selectAll('line').data(edges).join('line')
      .attr('stroke-width', (d) => ew(d.weight)).attr('stroke-opacity', 0.5);

    const node = g.append('g').selectAll<SVGGElement, SimNode>('g').data(nodes).join('g').style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, SimNode>()
        .on('start', (ev, d) => { if (!ev.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
        .on('end', (ev, d) => { if (!ev.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }) as any);

    const colorFor = (g: string) => (g === data.primary ? '#1A6A4F' : '#C8861A');
    node.append('circle')
      .attr('r', (d) => r(d.weight))
      .attr('fill', (d) => colorFor(d.group))
      .attr('stroke', '#fff').attr('stroke-width', 1.5);

    node.append('text').text((d) => d.label)
      .attr('x', (d) => r(d.weight) + 4).attr('y', 4)
      .attr('font-size', 11).attr('fill', '#334155')
      .attr('paint-order', 'stroke').attr('stroke', '#fff').attr('stroke-width', 3);

    node.on('click', (_ev, d) => onSelect(d));

    sim.on('tick', () => {
      link.attr('x1', (d) => d.source.x!).attr('y1', (d) => d.source.y!).attr('x2', (d) => d.target.x!).attr('y2', (d) => d.target.y!);
      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => { sim.stop(); };
  }, [data, onSelect]);

  // highlight selected
  useEffect(() => {
    if (!ref.current) return;
    d3.select(ref.current).selectAll<SVGCircleElement, SimNode>('circle')
      .attr('stroke', (d) => (d.id === selected ? '#0f172a' : '#fff'))
      .attr('stroke-width', (d) => (d.id === selected ? 3 : 1.5));
  }, [selected]);

  return <svg ref={ref} className="h-full w-full" />;
}
