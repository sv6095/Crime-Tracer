// src/pages/Analyze.tsx
import React, { useState, useRef } from "react";
import InputForm from "../components/InputForm";
import type { PredictRequest } from "@/types/api";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Navbar } from "@/components/ui";
import { predictAxios } from "@/lib/apiAxios";

const AnalyzePage: React.FC = () => {
  const [formState, setFormState] = useState<PredictRequest>({
    facts: "",
    title: undefined,
    victim_age: undefined,
    victim_gender: undefined,
    num_offenders: undefined,
    weapon_used: undefined,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelSourceRef = useRef<any | null>(null);

  const handleSubmit = async (data: PredictRequest) => {
    if (cancelSourceRef.current) {
      try {
        cancelSourceRef.current.cancel("New request replacing previous");
      } catch {}
      cancelSourceRef.current = null;
    }

    const axios = await import("axios");
    const CancelToken = axios.default.CancelToken;
    const source = CancelToken.source();
    cancelSourceRef.current = source;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        facts: data.facts,
        title: data.title,
        victim_age: data.victim_age,
        victim_gender: data.victim_gender,
        num_offenders: data.num_offenders,
        weapon_used: data.weapon_used,
      };

      const resp = await predictAxios(payload, {
        top_k: 10,
        token: null,
        cancelToken: source.token,
      });

      setResult(resp);
      toast.success("Prediction complete");
    } catch (err: any) {
      if (axios.default.isCancel(err)) {
        toast.info("Previous request cancelled");
      } else {
        const message =
          err?.response?.data?.message || err?.message || "Prediction failed";
        setError(String(message));
        toast.error(String(message));
      }
    } finally {
      setIsLoading(false);
      cancelSourceRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <ToastContainer position="top-right" />

      {/* Navbar */}
      <header className="sticky top-0 z-50">
        <Navbar />
      </header>

      <main className="p-6">
        <div className="max-w-7xl mx-auto h-[calc(100vh-80px)] grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* LEFT SIDE */}
          <div className="bg-black/60 border border-white/10 rounded-xl p-6 overflow-auto">
            <InputForm
              onSubmit={handleSubmit}
              isLoading={isLoading}
              formState={formState}
              setFormState={setFormState}
            />
          </div>

          {/* RIGHT SIDE */}
          <div className="space-y-6 overflow-auto">

            {/* RESULTS BOX */}
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl min-h-[160px]">
              <h3 className="text-xl font-semibold mb-3">Results</h3>

              {isLoading && (
                <div className="text-gray-300">
                  Running analysis — this might take a few seconds…
                </div>
              )}

              {error && (
                <div className="text-red-400">
                  <strong>Error:</strong> {error}
                </div>
              )}

              {!isLoading && !result && !error && (
                <div className="text-gray-400">
                  Fill the form and run analysis to see results here.
                </div>
              )}

              {/* BNS RESULTS */}
              {result?.bns && Array.isArray(result.bns) && result.bns.length > 0 && (
                <div className="space-y-4 mt-3">
                  <h4 className="font-medium mb-2">Predicted BNS Sections</h4>

                  <ul className="space-y-4">
                    {result.bns.map((b: any, idx: number) => (
                      <li key={idx} className="p-4 bg-white/5 rounded-lg border border-white/10">
                        <div className="text-primary-400 font-bold text-lg">
                          BNS Section {b.section_id}
                        </div>

                        <div className="text-gray-200 font-semibold mt-1">
                          {b.name}
                        </div>

                        {b.meaning && (
                          <div className="text-gray-400 text-sm mt-2 leading-relaxed">
                            {b.meaning}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* RAW FALLBACK */}
              {result && !result.bns?.length && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Raw Response</h4>
                  <pre className="max-h-96 overflow-auto text-xs bg-black/60 p-3 rounded">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* QUICK TIPS — HIDE WHEN RESULT EXISTS */}
            {!result?.bns?.length && (
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                <h4 className="font-medium">Quick tips</h4>
                <ul className="list-disc list-inside mt-2 text-gray-300">
                  <li>Describe facts clearly: who, what, when, where.</li>
                  <li>Use the Title field for short case labels (optional).</li>
                  <li>If results look off, add more detail and try again.</li>
                </ul>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

export default AnalyzePage;
