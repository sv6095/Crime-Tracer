import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import { AuthProvider, ProtectedRoute } from "./contexts/AuthContext";
import Navigation from "./components/Navigation";
import ErrorBoundary from "./components/ErrorBoundary";

import LandingPage from "./Pages/LandingPage";
import AuthVictim from "./Pages/AuthVictim";
import FileComplaint from "./Pages/FileComplaint";
import TrackComplaint from "./Pages/TrackComplaint";
import ProfilePage from "./Pages/Profile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <div
              className="min-h-screen"
              style={{ backgroundColor: "var(--background-dark)", color: "#fff" }}
            >
              <Navigation />

              <Routes>
                {/* Public */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/auth" element={<AuthVictim />} />

                {/* Victim protected routes */}
                <Route
                  path="/file-complaint"
                  element={
                    <ProtectedRoute requiredRoles={["victim"]}>
                      <FileComplaint />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/track"
                  element={
                    <ProtectedRoute requiredRoles={["victim"]}>
                      <TrackComplaint />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute requiredRoles={["victim"]}>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
                </Routes>

                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 3500,
                    style: {
                      background: "#000",
                      color: "#fff",
                      border: "1px solid #333",
                      fontSize: "13px",
                    },
                  }}
                />
              </div>
            </Router>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
  );
};

export default App;
