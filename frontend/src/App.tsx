import { GoogleOAuthProvider } from '@react-oauth/google'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { RequireAdmin, RequireAuth, RequireWarehouse } from './components/auth/RouteGuards'
import { Layout } from './components/layout/Layout'
import { ScrollToTop } from './components/routing/ScrollToTop'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { AuthProvider } from './context/AuthContext'
import { CustomerDataProvider } from './context/CustomerDataContext'
import { ThemeProvider } from './context/ThemeContext'
import { AboutPage } from './pages/AboutPage'
import { AdminActivityPage } from './pages/AdminActivityPage'
import { AdminAnnouncementsPage } from './pages/AdminAnnouncementsPage'
import { AdminClerksPage } from './pages/AdminClerksPage'
import { AdminHubPage } from './pages/AdminHubPage'
import { AdminOperationsPage } from './pages/AdminOperationsPage'
import { AdminLayout } from './components/layout/AdminLayout'
import { WarehouseLayout } from './components/layout/WarehouseLayout'
import { CustomerDashboardLayout } from './components/layout/CustomerDashboardLayout'
import { DashboardBankTransferPage } from './pages/dashboard/DashboardBankTransferPage'
import { DashboardHomePage } from './pages/dashboard/DashboardHomePage'
import { DashboardPackagesPage } from './pages/dashboard/DashboardPackagesPage'
import { DashboardNotificationsPage } from './pages/dashboard/DashboardNotificationsPage'
import { DashboardPreAlertsPage } from './pages/dashboard/DashboardPreAlertsPage'
import { DashboardProfilePage } from './pages/dashboard/DashboardProfilePage'
import { DashboardRatesPage } from './pages/dashboard/DashboardRatesPage'
import { NewPreAlertPage } from './pages/NewPreAlertPage'
import { EditPreAlertPage } from './pages/EditPreAlertPage'
import { PackageInvoiceUploadPage } from './pages/PackageInvoiceUploadPage'
import { GoogleSignupCompletePage } from './pages/GoogleSignupCompletePage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { RatesPage } from './pages/RatesPage'
import { ReceivePage } from './pages/ReceivePage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SignupPage } from './pages/SignupPage'
import { ServicesPage } from './pages/ServicesPage'
import { TermsPage } from './pages/TermsPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { DataProtectionPage } from './pages/DataProtectionPage'
import { StatusUpdatePage } from './pages/StatusUpdatePage'
import { CustomerAccountPage } from './pages/CustomerAccountPage'
import { CustomersPage } from './pages/CustomersPage'
import { PrintQueuePage } from './pages/PrintQueuePage'
import { UnidentifiedQueuePage } from './pages/UnidentifiedQueuePage'
import { WarehouseHomePage } from './pages/WarehouseHomePage'
import { WarehousePreAlertsPage } from './pages/WarehousePreAlertsPage'
import { DeparturesPage } from './pages/DeparturesPage'
import { StaffRequestsPage } from './pages/StaffRequestsPage'
import { GOOGLE_CLIENT_ID, isGoogleSignInEnabled } from './lib/googleAuth'

function AppRoutes() {
  const location = useLocation()

  return (
    <ErrorBoundary key={location.pathname}>
      <Routes location={location}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/signup/google" element={<GoogleSignupCompletePage />} />
        <Route path="/rates" element={<RatesPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/data-protection" element={<DataProtectionPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/track" element={<Navigate to="/dashboard/packages" replace />} />

        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<CustomerDashboardLayout />}>
            <Route index element={<DashboardHomePage />} />
            <Route path="profile" element={<DashboardProfilePage />} />
            <Route path="delivery-address" element={<Navigate to="/dashboard/profile" replace />} />
            <Route path="authorized-pickups" element={<Navigate to="/dashboard/profile" replace />} />
            <Route path="track" element={<Navigate to="/dashboard/packages" replace />} />
            <Route path="pre-alerts" element={<DashboardPreAlertsPage />} />
            <Route path="packages" element={<DashboardPackagesPage />} />
            <Route path="rates" element={<DashboardRatesPage />} />
            <Route path="bank-transfer" element={<DashboardBankTransferPage />} />
            <Route path="notifications" element={<DashboardNotificationsPage />} />
          </Route>
          <Route path="/pre-alerts/new" element={<NewPreAlertPage />} />
          <Route path="/pre-alerts/:id/edit" element={<EditPreAlertPage />} />
          <Route path="/packages/:packageId/upload-invoice" element={<PackageInvoiceUploadPage />} />
        </Route>

        <Route element={<RequireWarehouse />}>
          <Route element={<WarehouseLayout />}>
            <Route path="/warehouse" element={<WarehouseHomePage />} />
            <Route path="/warehouse/customers" element={<CustomersPage />} />
            <Route path="/warehouse/customers/:shippingId" element={<CustomerAccountPage />} />
            <Route path="/warehouse/receive" element={<ReceivePage />} />
            <Route path="/warehouse/unidentified" element={<UnidentifiedQueuePage />} />
            <Route path="/warehouse/pre-alerts" element={<WarehousePreAlertsPage />} />
            <Route path="/warehouse/print-queue" element={<PrintQueuePage />} />
            <Route path="/warehouse/requests" element={<StaffRequestsPage />} />
            <Route path="/warehouse/delivery-queue" element={<Navigate to="/warehouse/requests" replace />} />
            <Route path="/warehouse/status" element={<StatusUpdatePage />} />
            <Route path="/warehouse/departures" element={<DeparturesPage />} />
            <Route path="/warehouse/departures/:shipmentId" element={<DeparturesPage />} />
            <Route path="/warehouse/activity" element={<AdminActivityPage />} />
          </Route>
        </Route>

        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminHubPage />} />
            <Route path="operations" element={<AdminOperationsPage />} />
            <Route path="clerks" element={<AdminClerksPage />} />
            <Route path="announcements" element={<AdminAnnouncementsPage />} />
          </Route>
        </Route>

        <Route path="/admin/activity" element={<Navigate to="/warehouse/activity" replace />} />

        <Route path="/staff/receive" element={<Navigate to="/warehouse/receive" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}

function App() {
  const content = (
    <ThemeProvider>
      <AuthProvider>
        <CustomerDataProvider>
          <BrowserRouter>
            <ScrollToTop />
            <Layout>
              <AppRoutes />
            </Layout>
          </BrowserRouter>
        </CustomerDataProvider>
      </AuthProvider>
    </ThemeProvider>
  )

  if (isGoogleSignInEnabled()) {
    return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{content}</GoogleOAuthProvider>
  }

  return content
}

export default App
