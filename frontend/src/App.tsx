// file: src/App.tsx

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { LiveImageViewer } from '@/components/LiveImageViewer';
import { Dashboard } from '@/components/Dashboard';
import { DetectionHistory } from '@/components/DetectionHistory';
import { DetectionDetail } from '@/components/DetectionDetail';
import { ROUTES } from '@/constants/config';
import '@/styles/tailwind.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* Live Image Viewer is now the landing page */}
          <Route index element={<LiveImageViewer />} />
          <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
          <Route path={ROUTES.HISTORY} element={<DetectionHistory />} />
          <Route path={`${ROUTES.DETAIL}/:detection_id`} element={<DetectionDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;