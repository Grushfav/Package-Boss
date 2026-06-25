import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RequireAdmin, RequireAuth, RequireWarehouse } from './components/auth/RouteGuards'
import { Layout } from './components/layout/Layout'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { AboutPage } from './pages/AboutPage'
import { AdminActivityPage } from './pages/AdminActivityPage'
import { AdminClerksPage } from './pages/AdminClerksPage'
import { AdminHomePage } from './pages/AdminHomePage'
import { AdminLayout } from './components/layout/AdminLayout'
import { WarehouseLayout } from './components/layout/WarehouseLayout'
import { CustomerDashboardLayout } from './components/layout/CustomerDashboardLayout'
import { DashboardHomePage } from './pages/dashboard/DashboardHomePage'
import { DashboardTrackPage } from './pages/dashboard/DashboardTrackPage'
import { DashboardAddressPage } from './pages/dashboard/DashboardAddressPage'
import { DashboardAuthorizedPickupsPage } from './pages/dashboard/DashboardAuthorizedPickupsPage'
import { DashboardPackagesPage } from './pages/dashboard/DashboardPackagesPage'
import { DashboardNotificationsPage } from './pages/dashboard/DashboardNotificationsPage'
import { DashboardPreAlertsPage } from './pages/dashboard/DashboardPreAlertsPage'
import { DashboardProfilePage } from './pages/dashboard/DashboardProfilePage'
import { DashboardRatesPage } from './pages/dashboard/DashboardRatesPage'
import { NewPreAlertPage } from './pages/NewPreAlertPage'
import { PackageInvoiceUploadPage } from './pages/PackageInvoiceUploadPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { RatesPage } from './pages/RatesPage'
import { ReceivePage } from './pages/ReceivePage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SignupPage } from './pages/SignupPage'
import { ServicesPage } from './pages/ServicesPage'
import { TermsPage } from './pages/TermsPage'
import { StatusUpdatePage } from './pages/StatusUpdatePage'
import { TrackPage } from './pages/TrackPage'
import { CustomersPage } from './pages/CustomersPage'
import { PrintQueuePage } from './pages/PrintQueuePage'
import { UnidentifiedQueuePage } from './pages/UnidentifiedQueuePage'
import { WarehouseHomePage } from './pages/WarehouseHomePage'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/rates" element={<RatesPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/track" element={<TrackPage />} />

              <Route element={<RequireAuth />}>
                <Route path="/dashboard" element={<CustomerDashboardLayout />}>
                  <Route index element={<DashboardHomePage />} />
                  <Route path="track" element={<DashboardTrackPage />} />
                  <Route path="profile" element={<DashboardProfilePage />} />
                  <Route path="delivery-address" element={<DashboardAddressPage />} />
                  <Route path="authorized-pickups" element={<DashboardAuthorizedPickupsPage />} />
                  <Route path="pre-alerts" element={<DashboardPreAlertsPage />} />
                  <Route path="packages" element={<DashboardPackagesPage />} />
                  <Route path="rates" element={<DashboardRatesPage />} />
                  <Route path="notifications" element={<DashboardNotificationsPage />} />
                </Route>
                <Route path="/pre-alerts/new" element={<NewPreAlertPage />} />
                <Route path="/packages/:packageId/upload-invoice" element={<PackageInvoiceUploadPage />} />
              </Route>

              <Route element={<RequireWarehouse />}>
                <Route element={<WarehouseLayout />}>
                  <Route path="/warehouse" element={<WarehouseHomePage />} />
                  <Route path="/warehouse/customers" element={<CustomersPage />} />
                  <Route path="/warehouse/receive" element={<ReceivePage />} />
                  <Route path="/warehouse/unidentified" element={<UnidentifiedQueuePage />} />
                  <Route path="/warehouse/print-queue" element={<PrintQueuePage />} />
                  <Route path="/warehouse/status" element={<StatusUpdatePage />} />
                  <Route path="/warehouse/activity" element={<AdminActivityPage />} />
                </Route>
              </Route>

              <Route element={<RequireAdmin />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<AdminHomePage />} />
                  <Route path="/admin/clerks" element={<AdminClerksPage />} />
                </Route>
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
