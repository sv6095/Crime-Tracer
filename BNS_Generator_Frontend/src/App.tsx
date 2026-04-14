// src/App.tsx
import React, { Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import DemoOne from "@/pages/DemoEtheral";
import AnalyzePage from "@/pages/Analyze"; // ensure this file exists

const App: React.FC = () => (
  <Router>
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <Routes>
        <Route path="/" element={<DemoOne />} />
        <Route path="/analyze" element={<AnalyzePage />} />
      </Routes>
    </Suspense>
  </Router>
);

export default App;
