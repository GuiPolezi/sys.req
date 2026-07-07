import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import GroupGate from './pages/GroupGate';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import NewTicket from './pages/NewTicket';
import TicketDetail from './pages/TicketDetail';
import Categories from './pages/Categories';
import Automations from './pages/Automations';
import Team from './pages/Team';
import InternalChat from './pages/InternalChat';

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

  // logado mas sem grupo ativo -> criar/entrar em grupo
  if (!activeGroup) {
    return (
      <Routes>
        <Route path="*" element={<GroupGate />} />
      </Routes>
    );
  }

  const isSuporte = user.role === 'suporte';
  const isTech = user.role === 'suporte' || user.role === 'dev';

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/tickets/new" element={<NewTicket />} />
        <Route path="/tickets/:id" element={<TicketDetail />} />
        {isSuporte && <Route path="/categories" element={<Categories />} />}
        {isSuporte && <Route path="/automations" element={<Automations />} />}
        {isSuporte && <Route path="/team" element={<Team />} />}
        {isTech && <Route path="/chat" element={<InternalChat />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
