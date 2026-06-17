import { Routes, Route, useLocation } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CommandPalette } from './components/CommandPalette';
import DashboardPage from './pages/DashboardPage';
import IngestPage from './pages/IngestPage';
import TaxonomyPage from './pages/TaxonomyPage';
import SearchPage from './pages/SearchPage';
import LibraryPage from './pages/LibraryPage';
import AssistantPage from './pages/AssistantPage';
import AgenticPage from './pages/AgenticPage';
import KnowledgeDetailPage from './pages/KnowledgeDetailPage';
import GraphPage from './pages/GraphPage';
import GeneratePage from './pages/GeneratePage';
import WorkspacePage from './pages/WorkspacePage';
import AnalyticsPage from './pages/AnalyticsPage';
import KnowledgeBoxesPage from './pages/KnowledgeBoxesPage';
import SettingsPage from './pages/SettingsPage';
import EmbedPage from './pages/EmbedPage';
import Placeholder from './pages/Placeholder';
import { FloatingChat } from './components/chat/FloatingChat';

export default function App() {
  return (
    <Routes>
      {/* Bare, chrome-less embeddable widget */}
      <Route path="/embed" element={<EmbedPage />} />
      {/* Main application */}
      <Route path="/*" element={<MainApp />} />
    </Routes>
  );
}

function MainApp() {
  const loc = useLocation();
  return (
    <AppLayout>
      <ErrorBoundary resetKey={loc.pathname}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/ingest" element={<IngestPage />} />
        <Route path="/taxonomy" element={<TaxonomyPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/knowledge/:id" element={<KnowledgeDetailPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/agentic" element={<AgenticPage />} />
        <Route path="/generate" element={<GeneratePage />} />
        <Route path="/graph" element={<GraphPage />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/knowledge-boxes" element={<KnowledgeBoxesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Placeholder title="Not found" sprint="404" />} />
      </Routes>
      </ErrorBoundary>
      <FloatingChat />
      <CommandPalette />
    </AppLayout>
  );
}
