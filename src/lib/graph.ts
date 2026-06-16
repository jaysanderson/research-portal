export interface GraphNode { id: string; label: string; group: string; weight: number }
export interface GraphEdge { source: string; target: string; weight: number }
export interface GraphData { primary: string; secondary: string; nodes: GraphNode[]; edges: GraphEdge[] }

export async function fetchGraph(primary = 'vendor', secondary = 'topic'): Promise<GraphData> {
  const res = await fetch(`/api/graph?primary=${encodeURIComponent(primary)}&secondary=${encodeURIComponent(secondary)}`);
  if (!res.ok) throw new Error(`graph -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
