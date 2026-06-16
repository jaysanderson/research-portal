import { Link } from 'react-router-dom';

export default function Placeholder({ title, sprint }: { title: string; sprint: string }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 text-center md:px-8">
      <div className="chip mx-auto mb-4">{sprint}</div>
      <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
      <p className="mt-2 text-ink-500">This area is being built. Check back as the sprints land.</p>
      <Link to="/" className="btn-outline mt-6">Back to dashboard</Link>
    </div>
  );
}
