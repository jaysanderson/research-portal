import { useState } from 'react';
import { BookmarkPlus, Check } from 'lucide-react';
import { addItem, type WorkspaceItem } from '../lib/workspace';

export function SaveButton({ item, label = 'Save to workspace' }: { item: () => Omit<WorkspaceItem, 'id' | 'createdAt'>; label?: string }) {
  const [saved, setSaved] = useState(false);
  return (
    <button
      onClick={() => { addItem(item()); setSaved(true); setTimeout(() => setSaved(false), 2000); }}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
        saved ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-ink-200 text-ink-600 hover:border-brand-300 hover:text-brand-700'}`}>
      {saved ? <Check size={14} /> : <BookmarkPlus size={14} />}{saved ? 'Saved' : label}
    </button>
  );
}
