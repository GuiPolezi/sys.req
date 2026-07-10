import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { can, isTech } from './lib/domain';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import GroupGate from './pages/GroupGate';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import NewTicket from './pages/NewTicket';
import TicketDetail from './pages/TicketDetail';
import Pool from './pages/Pool';
import Categories from './pages/Categories';
import Services from './pages/Services';
import Team from './pages/Team';
import Invites from './pages/Invites';
import InternalChat from './pages/InternalChat';
import Profile from './pages/Profile';
import Attendances from './pages/Attendances';
import Ranking from './pages/Ranking';
import Audit from './pages/Audit';

export default function App() {
  const { user, activeGroup } = useAuth();

  // não logado -> tela de autenticação
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const role = user.role;
  const tech = isTech(role);

  // logado mas sem grupo ativo -> perfil, convites e criar/entrar em grupo (RP04)
  if (!activeGroup) {
    return (
      <Routes>
        <Route path="/profile" element={<GroupGate><Profile /></GroupGate>} />
        {tech && <Route path="/invites" element={<GroupGate><Invites /></GroupGate>} />}
        <Route path="*" element={<GroupGate />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/tickets/new" element={<NewTicket />} />
        <Route path="/tickets/:id" element={<TicketDetail />} />
        <Route path="/profile" element={<Profile />} />
        {tech && <Route path="/pool" element={<Pool />} />}
        {tech && <Route path="/chat" element={<InternalChat />} />}
        {tech && <Route path="/invites" element={<Invites />} />}
        {can.viewMembers(role) && <Route path="/team" element={<Team />} />}
        {can.createService(role) && <Route path="/services" element={<Services />} />}
        {can.registerAttendance(role) && <Route path="/attendances" element={<Attendances />} />}
        {can.manageGroup(role) && <Route path="/categories" element={<Categories />} />}
        {can.viewReports(role) && <Route path="/ranking" element={<Ranking />} />}
        {can.viewReports(role) && <Route path="/audit" element={<Audit />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
