import { Route, Routes } from 'react-router';
import AssemblyPage from './pages/assembly/Assembly';
import PledgePage from './pages/assembly/Pledge';
import Priorities from './pages/deciding/Priorities';
import Decision from './pages/delivery/Decision';
import Decisions from './pages/delivery/Decisions';
import HostRecord from './pages/delivery/HostRecord';
import Register from './pages/delivery/Register';
import Changes from './pages/feedback/Changes';
import Feedback from './pages/feedback/Feedback';
import FeedbackStatus from './pages/feedback/FeedbackStatus';
import Assemblies from './pages/home/Assemblies';
import Home from './pages/home/Home';
import NotFound from './pages/home/NotFound';
import HostConsole from './pages/host/HostConsole';
import How from './pages/how/How';
import Prompts from './pages/how/Prompts';
import Rules from './pages/how/Rules';
import Me from './pages/me/Me';
import Listening from './pages/picture/Listening';
import Picture from './pages/picture/Picture';
import Room from './pages/rooms/Room';
import Rooms from './pages/rooms/Rooms';
import Statement from './pages/statements/Statement';
import Statements from './pages/statements/Statements';
import StewardConsole from './pages/steward/StewardConsole';
import Conversation from './pages/talk/Conversation';
import Review from './pages/talk/Review';
import TalkStart from './pages/talk/TalkStart';

/**
 * The complete route table (section 8). This is the only file that imports page components:
 * each route's component lives in its own file under pages/<area>/.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/assemblies" element={<Assemblies />} />
      <Route path="/a/:slug" element={<AssemblyPage />} />
      <Route path="/a/:slug/pledge" element={<PledgePage />} />
      <Route path="/talk" element={<TalkStart />} />
      <Route path="/a/:slug/talk" element={<TalkStart />} />
      <Route path="/talk/:id" element={<Conversation />} />
      <Route path="/talk/:id/review" element={<Review />} />
      <Route path="/a/:slug/picture" element={<Picture />} />
      <Route path="/listening" element={<Listening />} />
      <Route path="/a/:slug/statements" element={<Statements />} />
      <Route path="/a/:slug/statements/:id" element={<Statement />} />
      <Route path="/a/:slug/rooms" element={<Rooms />} />
      <Route path="/a/:slug/rooms/:roomId" element={<Room />} />
      <Route path="/a/:slug/priorities" element={<Priorities />} />
      <Route path="/a/:slug/decisions" element={<Decisions />} />
      <Route path="/a/:slug/decisions/:id" element={<Decision />} />
      <Route path="/register" element={<Register />} />
      <Route path="/hosts/:hostSlug" element={<HostRecord />} />
      <Route path="/me" element={<Me />} />
      <Route path="/host" element={<HostConsole />} />
      <Route path="/steward" element={<StewardConsole />} />
      <Route path="/feedback" element={<Feedback />} />
      <Route path="/feedback/:token" element={<FeedbackStatus />} />
      <Route path="/changes" element={<Changes />} />
      <Route path="/how" element={<How />} />
      <Route path="/how/rules" element={<Rules />} />
      <Route path="/how/prompts" element={<Prompts />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
