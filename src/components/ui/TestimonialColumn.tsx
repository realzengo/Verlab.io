"use client";

import React from "react";
import { motion } from "framer-motion";

export interface Testimonial {
  text: string;
  image: string;
  name: string;
  role: string;
}

export function TestimonialsColumn(props: {
  className?: string;
  testimonials: Testimonial[];
  duration?: number;
}) {
  return (
    <div className={props.className}>
      <motion.ul
        animate={{ translateY: "-50%" }}
        transition={{
          duration: props.duration || 10,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="m-0 flex list-none flex-col gap-4 p-0 pb-4"
      >
        {[
          ...new Array(2).fill(0).map((_, index) => (
            <React.Fragment key={index}>
              {props.testimonials.map(({ text, image, name, role }, i) => (
                <motion.li
                  key={`${index}-${i}`}
                  aria-hidden={index === 1 ? "true" : "false"}
                  tabIndex={index === 1 ? -1 : 0}
                  whileHover={{
                    scale: 1.02,
                    y: -6,
                    transition: { type: "spring", stiffness: 400, damping: 17 },
                  }}
                  whileFocus={{
                    scale: 1.02,
                    y: -6,
                    transition: { type: "spring", stiffness: 400, damping: 17 },
                  }}
                  className="w-full max-w-xs cursor-default select-none rounded-card-sm border border-hairline bg-surface p-5 shadow-card transition-shadow duration-300 hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <blockquote className="m-0 p-0">
                    <p className="text-sm leading-[1.6] text-body">{text}</p>
                    <footer className="mt-4 flex items-center gap-2.5">
                      <img
                        width={38}
                        height={38}
                        src={image}
                        alt={`Avatar of ${name}`}
                        className="h-[38px] w-[38px] shrink-0 rounded-full object-cover ring-2 ring-hairline"
                      />
                      <div className="flex flex-col">
                        <cite className="block text-sm font-semibold not-italic leading-5 text-heading">{name}</cite>
                        <span className="text-xs leading-5 text-subtle">{role}</span>
                      </div>
                    </footer>
                  </blockquote>
                </motion.li>
              ))}
            </React.Fragment>
          )),
        ]}
      </motion.ul>
    </div>
  );
}
