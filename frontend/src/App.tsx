import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RequireAdmin, RequireAuth, RequireWarehouse } from './components/auth/RouteGuards'
import { Layout } from './components/layout/Layout'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { AdminActivityPage } from './pages/AdminActivityPage'
import { AdminClerksPage } from './pages/AdminClerksPage'
import { AdminHomePage } from './pages/AdminHomePage'
import { DashboardPage } from './pages/DashboardPage'
import { NewPreAlertPage } from './pages/NewPreAlertPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { RatesPage } from './pages/RatesPage'
import { ReceivePage } from './pages/ReceivePage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SignupPage } from './pages/SignupPage'
import { StatusUpdatePage } from './pages/StatusUpdatePage'
import { TrackPage } from './pages/TrackPage'
import { CustomersPage } from './pages/CustomersPage'
import { WarehouseHomePage } from './pages/WarehouseHomePage'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/rates" element={<RatesPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/track" element={<TrackPage />} />

              <Route element={<RequireAuth />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/pre-alerts/new" element={<NewPreAlertPage />} />
              </Route>

              <Route element={<RequireWarehouse />}>
                <Route path="/warehouse" element={<WarehouseHomePage />} />
                <Route path="/warehouse/customers" element={<CustomersPage />} />
                <Route path="/warehouse/receive" element={<ReceivePage />} />
                <Route path="/warehouse/status" element={<StatusUpdatePage />} />
                <Route path="/warehouse/activity" element={<AdminActivityPage />} />
              </Route>

              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<AdminHomePage />} />
                <Route path="/admin/clerks" element={<AdminClerksPage />} />
              </Route>

              <Route path="/admin/activity" element={<Navigate to="/warehouse/activity" replace />} />

              <Route path="/staff/receive" element={<Navigate to="/warehouse/receive" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
