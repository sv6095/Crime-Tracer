import React, { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Camera,
  X,
  RotateCcw,
  Check,
  AlertCircle
} from "lucide-react";
import toast from "react-hot-toast";



interface CameraCaptureProps {
  onCapture: (photoBlob: Blob) => void;
  onClose: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    "environment"
  );

  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const startCamera = async () => {
    setIsLoading(true);
    setError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Camera not supported on this device");
      setIsLoading(false);
      toast.error("Camera not supported on this device");
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
      }
      setIsLoading(false);
    } catch (err) {
      console.error("Camera access failed:", err);
      setError("Permission denied or no camera available");
      setIsLoading(false);

      // Try a lenient fallback
      try {
        const fallback = await navigator.mediaDevices.getUserMedia({
          video: true
        });
        setStream(fallback);
        if (videoRef.current) {
          videoRef.current.srcObject = fallback;
          await videoRef.current.play().catch(() => {});
        }
        setError(null);
        setIsLoading(false);
      } catch (fallbackErr) {
        console.error("Fallback camera access failed:", fallbackErr);
        toast.error("Unable to access camera");
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    // draw and generate blob URL
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setCapturedPhoto(url);
        } else {
          toast.error("Failed to capture photo");
        }
      },
      "image/jpeg",
      0.86
    );
  };

  const retakePhoto = () => {
    // release previous object URL
    if (capturedPhoto) {
      URL.revokeObjectURL(capturedPhoto);
    }
    setCapturedPhoto(null);
    startCamera();
  };

  const confirmPhoto = () => {
    if (!canvasRef.current) {
      toast.error("No photo to use");
      return;
    }
    canvasRef.current.toBlob(
      (blob) => {
        if (blob) {
          onCapture(blob);
          // cleanup and close
          if (capturedPhoto) URL.revokeObjectURL(capturedPhoto);
          stopCamera();
          onClose();
        } else {
          toast.error("Failed to prepare photo");
        }
      },
      "image/jpeg",
      0.86
    );
  };

  const switchCamera = () => {
    setFacingMode((p) => (p === "user" ? "environment" : "user"));
  };

  // CSS variable fallbacks (works whether project uses --bg/--text or --background-dark/--text-on-dark)
  const textColor = "var(--text, var(--text-on-dark, #FFFFFF))";
  const bgColor = "var(--bg, var(--background-dark, #0C0908))";

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      aria-modal="true"
      role="dialog"
    >
      <motion.div
        className="rounded-2xl shadow-2xl max-w-3xl w-full max-h-[86vh] flex flex-col overflow-hidden"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.18 }}
        style={{ backgroundColor: bgColor, color: textColor }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-3 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md flex items-center justify-center bg-white/6">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-heading font-semibold" style={{ color: textColor }}>
              Camera
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-2 rounded-full hover:bg-white/6 transition-colors"
              aria-label="Close camera"
              style={{ color: textColor }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Camera viewport */}
        <div className="flex-1 relative flex items-center justify-center bg-black min-h-[320px]">
          {/* Loading / spinner */}
          {isLoading && (
            <div className="flex flex-col items-center gap-3">
              <div className="spinner" aria-hidden="true" />
              <div style={{ color: "rgba(255,255,255,0.85)" }}>Starting camera…</div>
            </div>
          )}

          {/* Error */}
          {!isLoading && error && (
            <div className="flex flex-col items-center gap-4 text-center p-6">
              <AlertCircle className="w-12 h-12 text-red-500" />
              <div style={{ color: "rgba(255,255,255,0.9)" }}>{error}</div>
              <div className="flex gap-3">
                <motion.button
                  onClick={() => {
                    setError(null);
                    startCamera();
                  }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-4 py-2 rounded-md"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.06)",
                    color: textColor
                  }}
                >
                  Try again
                </motion.button>
                <motion.button
                  onClick={() => {
                    stopCamera();
                    onClose();
                  }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-4 py-2 rounded-md"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.02)",
                    color: textColor,
                    border: "1px solid rgba(255,255,255,0.04)"
                  }}
                >
                  Close
                </motion.button>
              </div>
            </div>
          )}

          {/* Live video */}
          {!isLoading && !error && !capturedPhoto && (
            <video
              ref={videoRef}
              className="max-w-full max-h-full object-contain"
              autoPlay
              playsInline
              muted
              aria-label="Live camera preview"
            />
          )}

          {/* Captured preview */}
          {capturedPhoto && (
            <img
              src={capturedPhoto}
              alt="Captured evidence"
              className="max-w-full max-h-full object-contain"
            />
          )}

          {/* overlay guides */}
          {!isLoading && !error && !capturedPhoto && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-4 border-2 border-white/10 rounded-lg" />
              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-white/70 text-sm">
                Position the evidence in the frame, then tap capture
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div
          className="p-3 border-t flex items-center justify-center"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          {!capturedPhoto ? (
            <div className="flex items-center gap-6">
              {/* Switch camera */}
              <motion.button
                onClick={switchCamera}
                disabled={isLoading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-3 rounded-full"
                aria-label="Switch camera"
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  color: textColor
                }}
              >
                <RotateCcw className="w-5 h-5" />
              </motion.button>

              {/* Capture */}
              <motion.button
                onClick={capturePhoto}
                disabled={isLoading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Capture photo"
                className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: "transparent" }}
              >
                <div className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "#c53030" /* red tone */ }}>
                  <Camera className="w-7 h-7 text-white" />
                </div>
              </motion.button>

              {/* Close */}
              <motion.button
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-3 rounded-full"
                aria-label="Close"
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  color: textColor
                }}
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <motion.button
                onClick={retakePhoto}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="px-4 py-2 rounded-md flex items-center gap-2"
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  color: textColor
                }}
              >
                <RotateCcw className="w-4 h-4" />
                Retake
              </motion.button>

              <motion.button
                onClick={confirmPhoto}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="px-4 py-2 rounded-md flex items-center gap-2"
                style={{
                  backgroundColor: "rgba(16,185,129,1)",
                  color: "#fff"
                }}
              >
                <Check className="w-4 h-4" />
                Use Photo
              </motion.button>
            </div>
          )}
        </div>

        {/* hidden canvas used to generate blobs */}
        <canvas ref={canvasRef} className="hidden" />
      </motion.div>
    </motion.div>
  );
};

export default CameraCapture;
