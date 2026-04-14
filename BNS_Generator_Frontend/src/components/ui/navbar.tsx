// src/components/ui/navbar.tsx
import React from "react";
import { Link } from "react-router-dom";

export const Navbar: React.FC = () => {
  return (
    <nav className="w-full bg-black/40 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center">
        {/* App Title */}
        <Link
          to="/"
          className="text-2xl md:text-3xl font-extrabold tracking-wide text-white hover:text-primary-300 transition-colors"
        >
          BNS Prediction System
        </Link>
      </div>
    </nav>
  );
};
