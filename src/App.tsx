import { Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import IngestPage from './pages/IngestPage';
import TaxonomyPage from './pages/TaxonomyPage';
import SearchPage from './pages/SearchPage';
import LibraryPage from './pages/LibraryPage';
import AssistantPage from './pages/AssistantPage';
import KnowledgeDetailPage from './pages/KnowledgeDetailPage';
import Placeholder from './pages/Placeholder';
import { FloatingChat } from './components/chat/FloatingChat';

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/ingest" element={<IngestPage />} />
        <Route path="/taxonomy" element={<TaxonomyPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/knowledge/:id" element={<KnowledgeDetailPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/agentic" element={<Placeholder title="Agentic Retrieval" sprint="Sprint 5" />} />
        <Route path="/graph" element={<Placeholder title="Knowledge Graph" sprint="Sprint 7" />} />
        <Route path="/workspace" element={<Placeholder title="Research Workspace" sprint="Sprint 9" />} />
        <Route path="/analytics" element={<Placeholder title="Analytics" sprint="Sprint 10" />} />
        <Route path="*" element={<Placeholder title="Not found" sprint="404" />} />
      </Routes>
      <FloatingChat />
    </AppLayout>
  );
}
