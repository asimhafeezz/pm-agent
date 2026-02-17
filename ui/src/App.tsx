import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./components/auth/auth-provider";
import { ReceiptProvider } from "./components/providers/receipt-provider";
import { ToastProvider } from "./components/ui/toast-provider";
import { RequireAuth } from "./components/auth/require-auth";
import { LoginPage } from "./pages/login-page";
import { HomePage } from "./pages/home-page";


function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ReceiptProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <HomePage />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ReceiptProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
