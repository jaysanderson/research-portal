import { Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import IngestPage from './pages/IngestPage';
import TaxonomyPage from './pages/TaxonomyPage';
import SearchPage from './pages/SearchPage';
import LibraryPage from './pages/LibraryPage';
import Placeholder from './pages/Placeholder';

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/ingest" element={<IngestPage />} />
        <Route path="/taxonomy" element={<TaxonomyPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/assistant" element={<Placeholder title="Assistant" sprint="Sprint 4" />} />
        <Route path="/agentic" element={<Placeholder title="Agentic Retrieval" sprint="Sprint 5" />} />
        <Route path="/graph" element={<Placeholder title="Knowledge Graph" sprint="Sprint 7" />} />
        <Route path="/workspace" element={<Placeholder title="Research Workspace" sprint="Sprint 9" />} />
        <Route path="/analytics" element={<Placeholder title="Analytics" sprint="Sprint 10" />} />
        <Route path="*" element={<Placeholder title="Not found" sprint="404" />} />
      </Routes>
    </AppLayout>
  );
}
