import {BrowserRouter, Link, Route, Routes} from 'react-router-dom';
import {AdminRoute} from './components/AdminRoute';
import {Layout} from './components/Layout';
import {ProtectedRoute} from './components/ProtectedRoute';
import {AuthProvider} from './context/AuthContext';
import {ProjectDraftProvider} from './context/ProjectDraftContext';
import {RegionProvider} from './context/RegionContext';
import {SupportProvider} from './context/SupportContext';
import {AboutPage} from './pages/AboutPage';
import {AccountPage} from './pages/AccountPage';
import {AdminDashboardPage} from './pages/AdminDashboardPage';
import {BusinessSolutionsPage} from './pages/BusinessSolutionsPage';
import {CheckoutPage} from './pages/CheckoutPage';
import {ContactPage} from './pages/ContactPage';
import {HomePage} from './pages/HomePage';
import {HowItWorksPage} from './pages/HowItWorksPage';
import {LoginPage} from './pages/LoginPage';
import {ProjectConfirmationPage} from './pages/ProjectConfirmationPage';
import {ProjectRequirementsPage} from './pages/ProjectRequirementsPage';
import {ProjectReviewPage} from './pages/ProjectReviewPage';
import {ProjectServiceSelectPage} from './pages/ProjectServiceSelectPage';
import {RegisterPage} from './pages/RegisterPage';
import {ResetPasswordPage} from './pages/ResetPasswordPage';
import {ServiceDetailPage} from './pages/ServiceDetailPage';
import {ServicesPage} from './pages/ServicesPage';

function NotFoundPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <p className="font-mono text-xs text-[#1D4ED8]">404</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-[#141416]">Page not found</h1>
      <p className="mt-3 text-sm text-[#5A5A62]">
        The page you requested could not be found. Return to the VERTYLEX homepage or explore our
        services.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          to="/"
          className="inline-flex h-10 items-center rounded-md bg-[#141416] px-5 text-sm font-medium text-white hover:bg-[#1D4ED8]"
        >
          Homepage
        </Link>
        <Link
          to="/services"
          className="inline-flex h-10 items-center rounded-md border border-[#E4E4E7] bg-white px-5 text-sm font-medium text-[#141416]"
        >
          Services
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RegionProvider>
        <SupportProvider>
          <ProjectDraftProvider>
            <BrowserRouter>
              <Layout>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/services" element={<ServicesPage />} />
                  <Route path="/services/:slug" element={<ServiceDetailPage />} />
                  <Route path="/business-solutions" element={<BusinessSolutionsPage />} />
                  <Route
                    path="/submit-project"
                    element={
                      <ProtectedRoute>
                        <ProjectServiceSelectPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/submit-project/requirements"
                    element={
                      <ProtectedRoute>
                        <ProjectRequirementsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/submit-project/review"
                    element={
                      <ProtectedRoute>
                        <ProjectReviewPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/submit-project/confirmation/:projectId"
                    element={
                      <ProtectedRoute>
                        <ProjectConfirmationPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/how-it-works" element={<HowItWorksPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route
                    path="/account"
                    element={
                      <ProtectedRoute>
                        <AccountPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <AdminRoute>
                        <AdminDashboardPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/checkout/:projectId"
                    element={
                      <ProtectedRoute>
                        <CheckoutPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Layout>
            </BrowserRouter>
          </ProjectDraftProvider>
        </SupportProvider>
      </RegionProvider>
    </AuthProvider>
  );
}
