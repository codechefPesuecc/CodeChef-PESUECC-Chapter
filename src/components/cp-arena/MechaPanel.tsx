import type { CSSProperties, ReactNode } from "react";

/**
 * Mecha/HUD panel primitive: a chamfered (notched-corner) card with a double
 * outline, optional corner registration ticks, and a mono "telemetry" header
 * (a left label + a right index/slot). Themed entirely through CSS vars in
 * globals.css, so it flips in light/dark. Every clip layer is a nested div —
 * see `.mecha*` in globals.css for how the double line is built.
 */
export default function MechaPanel({
  children,
  label,
  index,
  ticks = false,
  className = "",
  bodyClassName = "",
  style,
}: {
  children: ReactNode;
  /** Top-left mono label chip. */
  label?: ReactNode;
  /** Top-right mono slot (an index like "01", or any node e.g. a badge). */
  index?: ReactNode;
  /** Render corner registration marks. */
  ticks?: boolean;
  className?: string;
  bodyClassName?: string;
  style?: CSSProperties;
}) {
  const hasHeader = label != null || index != null;
  return (
    <div className={`mecha ${className}`} style={style}>
      <div className="mecha__gap">
        <div className="mecha__inline">
          <div className={`mecha__body ${bodyClassName}`}>
            {hasHeader && (
              <div className="mecha__telemetry">
                {label != null ? (
                  <span className="mecha__label">{label}</span>
                ) : (
                  <span />
                )}
                {index != null ? (
                  <span className="mecha__index">{index}</span>
                ) : (
                  <span />
                )}
              </div>
            )}
            {ticks && (
              <>
                <span aria-hidden className="mecha__tick mecha__tick--tl" />
                <span aria-hidden className="mecha__tick mecha__tick--tr" />
                <span aria-hidden className="mecha__tick mecha__tick--bl" />
                <span aria-hidden className="mecha__tick mecha__tick--br" />
              </>
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
