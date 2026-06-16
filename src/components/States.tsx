import type { ReactNode } from 'react';
import { AlertCircle, RotateCw } from 'lucide-react';

export function EmptyState({ icon, title, description, action, compact }: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode; compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-10' : 'py-16'}`}>
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-ink-100 text-ink-400">{icon}</div>}
      <h3 className="t-h2">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm t-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, compact }: { message: string; onRetry?: () => void; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-10' : 'py-14'}`}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50 text-accent-500"><AlertCircle size={22} /></div>
      <h3 className="t-h2">Something went wrong</h3>
      <p className="mt-1.5 max-w-sm t-muted">{message}</p>
      {onRetry && <button onClick={onRetry} className="btn-outline mt-5"><RotateCw size={15} /> Try again</button>}
    </div>
  );
}

export function SkeletonRows({ count = 3, height = 'h-12' }: { count?: number; height?: string }) {
  return <div className="space-y-2">{Array.from({ length: count }).map((_, i) => <div key={i} className={`skeleton w-full ${height} rounded-lg`} />)}</div>;
}

export function SkeletonGrid({ count = 6, cols = 'sm:grid-cols-2', height = 'h-28' }: { count?: number; cols?: string; height?: string }) {
  return <div className={`grid gap-3 ${cols}`}>{Array.from({ length: count }).map((_, i) => <div key={i} className={`skeleton rounded-lg ${height}`} />)}</div>;
}
