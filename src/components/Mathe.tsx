"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import { formelnVereinheitlichen } from "@/lib/formelcheck";

/** Zeigt Text mit mathematischen Formeln sauber gesetzt an. */
export const Mathe = memo(function Mathe({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`mathe ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: "ignore", throwOnError: false }]]}
        components={{
          // Überschriften in Karten werden wie normaler fetter Text dargestellt
          h1: ({ children }) => <p><strong>{children}</strong></p>,
          h2: ({ children }) => <p><strong>{children}</strong></p>,
          h3: ({ children }) => <p><strong>{children}</strong></p>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {formelnVereinheitlichen(text)}
      </ReactMarkdown>
    </div>
  );
});
