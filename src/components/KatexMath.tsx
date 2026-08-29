import React, { useMemo } from "react";
import katex from "katex";

interface KatexMathProps {
  math: string;
  displayMode?: boolean;
  className?: string;
  id?: string;
}

export const KatexMath: React.FC<KatexMathProps> = ({
  math,
  displayMode = false,
  className = "",
  id,
}) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math || "", {
        displayMode,
        throwOnError: false,
        strict: false,
        trust: true,
      });
    } catch (err) {
      console.warn("KaTeX rendering error:", err);
      return `<span class="text-rose-400 font-mono">${math}</span>`;
    }
  }, [math, displayMode]);

  return (
    <span
      id={id}
      className={`inline-block ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
