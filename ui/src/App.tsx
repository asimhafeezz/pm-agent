import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./components/auth/auth-provider";
import { ReceiptProvider } from "./components/providers/receipt-provider";
import { ToastProvider } from "./components/ui/toast-provider";
import { RequireAuth } from "./components/auth/require-auth";
import { LoginPage } from "./pages/login-page";
import { HomePage } from "./pages/home-page";
import { DocumentsPage } from "./pages/documents-page";
import { KnowledgePage } from "./pages/knowledge-page";
import { RoadmapPage } from "./pages/roadmap-page";
import { TicketsPage } from "./pages/tickets-page";
import { IntegrationsPage } from "./pages/integrations-page";
import { IntegrationsOAuthCallbackPage } from "./pages/integrations-oauth-callback-page";
import { ActivityPage } from "./pages/activity-page";
import { MeetingsPage } from "./pages/meetings-page";
import { SprintPage } from "./pages/sprint-page";
import { IntelligencePage } from "./pages/intelligence-page";
import { queryClient } from "./lib/query-client";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <ReceiptProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                <Route path="/c/:conversationId" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
                <Route path="/knowledge" element={<ProtectedRoute><KnowledgePage /></ProtectedRoute>} />
                <Route path="/roadmap" element={<ProtectedRoute><RoadmapPage /></ProtectedRoute>} />
                <Route path="/tickets" element={<ProtectedRoute><TicketsPage /></ProtectedRoute>} />
                <Route path="/meetings" element={<ProtectedRoute><MeetingsPage /></ProtectedRoute>} />
                <Route path="/sprint" element={<ProtectedRoute><SprintPage /></ProtectedRoute>} />
                <Route path="/activity" element={<ProtectedRoute><ActivityPage /></ProtectedRoute>} />
                <Route path="/intelligence" element={<ProtectedRoute><IntelligencePage /></ProtectedRoute>} />
                <Route path="/integrations" element={<ProtectedRoute><IntegrationsPage /></ProtectedRoute>} />
                <Route path="/integrations/callback" element={<ProtectedRoute><IntegrationsOAuthCallbackPage /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </ReceiptProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
