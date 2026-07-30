"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  image: string;
  quote: string;
}

export function TestimonialModal({ selected, onClose }: { selected: Testimonial | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {selected && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: 10,
              transition: { duration: 0.15 },
            }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-lg rounded-2xl bg-[linear-gradient(135deg,var(--color-primary)_0%,white_65%)] p-[2px] shadow-2xl z-50 dark:bg-[linear-gradient(135deg,var(--color-primary)_0%,rgba(255,255,255,0.15)_65%)]"
          >
            <div className="relative rounded-[14px] bg-surface text-heading p-8 md:p-12">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-subtle hover:text-heading transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center text-center">
                <p className="text-xl md:text-2xl font-medium leading-relaxed mb-8">&ldquo;{selected.quote}&rdquo;</p>

                <div className="flex items-center gap-4">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-(--color-primary)">
                    <Image src={selected.image} alt={selected.name} fill sizes="48px" className="object-cover object-top" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-base text-heading">{selected.name}</h4>
                    <p className="text-sm text-subtle">{selected.role}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
