import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ElderDashboard from './pages/ElderDashboard';
import FamilyDashboard from './pages/FamilyDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/elder"    element={<ElderDashboard />} />
        <Route path="/family"   element={<FamilyDashboard />} />
        <Route path="*"         element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
