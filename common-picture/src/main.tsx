import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import './styles.css';
import { Layout } from './ui/Layout';
import { Home } from './pages/Home';
import { Listen } from './pages/Listen';
import { PicturePage } from './pages/Picture';
import { Days } from './pages/Days';
import { Room } from './pages/Room';
import { Answers } from './pages/Answers';
import { RoutePage } from './pages/Route';
import { Editions } from './pages/Editions';
import { About } from './pages/About';
import { Feedback } from './pages/Feedback';

function NotFound() {
  return (
    <div className="wrap narrow">
      <h1>Nothing here</h1>
      <p>
        This page does not exist. <Link to="/">Go to the front door</Link>.
      </p>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/listen" element={<Listen />} />
          <Route path="/picture" element={<PicturePage />} />
          <Route path="/days" element={<Days />} />
          <Route path="/room" element={<Room />} />
          <Route path="/answers" element={<Answers />} />
          <Route path="/route" element={<RoutePage />} />
          <Route path="/editions" element={<Editions />} />
          <Route path="/about" element={<About />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  </StrictMode>,
);
