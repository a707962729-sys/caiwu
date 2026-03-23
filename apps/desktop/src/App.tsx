import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import MainLayout from './layouts/MainLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Contracts from './pages/Contracts'
import Orders from './pages/Orders'
import Reimbursements from './pages/Reimbursements'
import Receivables from './pages/Receivables'
import Settings from './pages/Settings'
import './App.css'

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/"
          element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" replace />}
        >
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="contracts" element={<Contracts />} />
          <Route path="orders" element={<Orders />} />
          <Route path="reimbursements" element={<Reimbursements />} />
          <Route path="receivables" element={<Receivables />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App