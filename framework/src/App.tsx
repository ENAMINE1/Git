import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout';
import { SearchProvider } from './components/search';
import { QuickAddProvider } from './components/quickadd';
import { Toaster } from './components/ui';
import { Home } from './pages/Home';
import { Videos } from './pages/Videos';
import { VideoDetail } from './pages/VideoDetail';
import { Techniques } from './pages/Techniques';
import { TechniqueDetail } from './pages/TechniqueDetail';
import { ArtDirections } from './pages/ArtDirections';
import { ArtDirectionDetail } from './pages/ArtDirectionDetail';
import { Moodboards } from './pages/Moodboards';
import { MoodboardDetail } from './pages/MoodboardDetail';
import { Breakdowns } from './pages/Breakdowns';
import { BreakdownDetail } from './pages/BreakdownDetail';
import { Creators } from './pages/Creators';
import { CreatorDetail } from './pages/CreatorDetail';
import { Collections } from './pages/Collections';
import { CollectionDetail } from './pages/CollectionDetail';
import { Glossary } from './pages/Glossary';
import { Compare } from './pages/Compare';
import { SearchPage } from './pages/SearchPage';
import { LibraryPage } from './pages/LibraryPage';
import { AssetPage } from './pages/AssetPage';
import { NotFound } from './pages/NotFound';

export function App() {
  return (
    <HashRouter>
      <QuickAddProvider>
        <SearchProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/videos" element={<Videos />} />
              <Route path="/videos/:id" element={<VideoDetail />} />
              <Route path="/techniques" element={<Techniques />} />
              <Route path="/techniques/:id" element={<TechniqueDetail />} />
              <Route path="/art-directions" element={<ArtDirections />} />
              <Route path="/art-directions/:id" element={<ArtDirectionDetail />} />
              <Route path="/moodboards" element={<Moodboards />} />
              <Route path="/moodboards/:id" element={<MoodboardDetail />} />
              <Route path="/breakdowns" element={<Breakdowns />} />
              <Route path="/breakdowns/:id" element={<BreakdownDetail />} />
              <Route path="/creators" element={<Creators />} />
              <Route path="/creators/:id" element={<CreatorDetail />} />
              <Route path="/collections" element={<Collections />} />
              <Route path="/collections/:id" element={<CollectionDetail />} />
              <Route path="/glossary" element={<Glossary />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/assets/:id" element={<AssetPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
          <Toaster />
        </SearchProvider>
      </QuickAddProvider>
    </HashRouter>
  );
}
