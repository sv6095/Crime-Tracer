import React from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { useTranslation } from "react-i18next";
import { Phone } from "lucide-react";

import { Hero } from "@/components/ui/hero-with-image-text-and-two-buttons";

const LandingPage: React.FC = () => {
  const { t } = useTranslation();
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}>
      {/* Hero with File/Track buttons inside */}
      <Hero />

      {/* Map Section */}
      <motion.section
        ref={ref}
        className="py-16 px-6"
        initial={{ opacity: 0, y: 50 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
        transition={{ duration: 0.8 }}
      >
        <div className="container mx-auto">
          <motion.h3
            className="text-3xl font-heading font-bold text-center mb-8"
            style={{ color: "var(--text)" }}
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: 0.2 }}
          >
            {t("landing.mapTitle")}
          </motion.h3>

          <div className="relative rounded-2xl overflow-hidden glass-effect border shadow-soft-dark" style={{ borderColor: "var(--border)" }}>
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d124440.39416889528!2d74.85247369999999!3d12.9229922!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3ba35a4c37bf488f%3A0x827bbc7a74fcfe64!2sMangaluru%2C%20Karnataka!5e0!3m2!1sen!2sin!4v1764862153506!5m2!1sen!2sin"
              width="100%"
              height="560"
              style={{ border: 0, backgroundColor: "var(--bg)" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Map"
              className="block"
            />
            <div className="p-6 text-center">
              <p className="text-sm font-sans" style={{ color: "rgba(255,255,255,0.7)" }}>
                {t("landing.mapDescription")}
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Emergency Contact */}
      <motion.section className="py-12" initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : { opacity: 0 }}>
        <div className="container mx-auto text-center px-6">
          <motion.div className="inline-flex flex-col items-center gap-4 glass-effect p-6 rounded-xl" whileHover={{ scale: 1.03 }}>
            <Phone className="h-16 w-16" style={{ color: "var(--text)" }} />
            <h3 className="text-3xl font-heading font-bold" style={{ color: "var(--text)" }}>
              {t("landing.emergencyHelpline")}
            </h3>
            <p className="text-lg font-sans" style={{ color: "rgba(255,255,255,0.9)" }}>
              {t("landing.pleaseCall")}
            </p>
            <div className="text-4xl font-bold" style={{ color: "var(--text)" }}>100</div>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
};

export default LandingPage;
