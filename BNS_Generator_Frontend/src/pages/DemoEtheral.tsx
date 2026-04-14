// src/pages/DemoEtheral.tsx
import React from "react";
import { Link } from "react-router-dom";
import { EtheralShadow, Navbar } from "@/components/ui";

const DemoOne: React.FC = () => {
  return (
    <div className="relative min-h-screen bg-black text-white">
      <header className="relative z-40">
        <Navbar />
      </header>

      <main className="relative w-full h-screen overflow-hidden">
        <div className="absolute inset-0 z-10">
          <EtheralShadow
            color="rgba(18, 24, 36, 0.95)"
            animation={{ scale: 100, speed: 90 }}
            noise={{ opacity: 0.9, scale: 1.2 }}
            sizing="fill"
            className="w-full h-full"
          />
        </div>

        <div className="relative z-30 h-full">
          <div className="h-full" />

          {/* Moved the button higher: bottom-24 */}
          <div className="absolute left-1/2 transform -translate-x-1/2 bottom-24 z-40">
            <Link
              to="/analyze"
              className="inline-block px-7 py-3 rounded-full bg-primary-600 text-black font-semibold shadow-lg hover:bg-primary-700 transition"
              aria-label="Go to Predictor"
            >
              Predictor
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DemoOne;
