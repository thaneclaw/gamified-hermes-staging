import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

interface Props {
  children: ReactNode;
  // Upper bound on the rendered font size in pixels. The component
  // picks the largest size ≤ maxPx that makes the text fit its parent.
  maxPx?: number;
  // Floor so text doesn't disappear on very narrow containers.
  minPx?: number;
  className?: string;
  style?: CSSProperties;
  // When false (default), text stays on one line and shrinks until it
  // fits horizontally. When true, the text can wrap and the component
  // shrinks until the wrapped block fits vertically too.
  allowWrap?: boolean;
  // Extra horizontal padding to reserve when measuring (e.g. if the
  // container has rounded ends / side labels). Percent of container
  // width; default 0.
  horizontalPad?: number;
}

/**
 * Fit-to-box text: measures the container on mount and on resize, then
 * binary-searches for the largest font size that keeps the text inside.
 *
 * Use anywhere text might overflow the space the design allots to it —
 * placards that carry contestant names + custom choice labels, the
 * topic bar, etc. The parent MUST have a fixed width (and a height if
 * `allowWrap` is on); that's normally the case for absolutely-positioned
 * overlay elements.
 */
export function FitText({
  children,
  maxPx = 28,
  minPx = 8,
  className,
  style,
  allowWrap = false,
  horizontalPad = 0,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(maxPx);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const fit = () => {
      const cw = container.clientWidth * (1 - horizontalPad);
      const ch = container.clientHeight;
      if (cw <= 0 || ch <= 0) return;

      // Try max first — most text fits and we avoid the binary search.
      text.style.fontSize = `${maxPx}px`;
      if (text.scrollWidth <= cw && text.scrollHeight <= ch) {
        setSize(maxPx);
        return;
      }

      // Binary search (in 0.5px steps) for the largest fitting size.
      let lo = minPx;
      let hi = maxPx;
      let best = minPx;
      // Cap the number of iterations — the bound is log2((max-min)/0.5)
      // which is tiny, but belt-and-suspenders against a pathological
      // reflow loop.
      for (let i = 0; i < 24 && lo <= hi; i++) {
        const mid = (lo + hi) / 2;
        text.style.fontSize = `${mid}px`;
        if (text.scrollWidth <= cw && text.scrollHeight <= ch) {
          best = mid;
          lo = mid + 0.5;
        } else {
          hi = mid - 0.5;
        }
      }
      text.style.fontSize = `${best}px`;
      setSize(best);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    return () => ro.disconnect();
  }, [children, maxPx, minPx, allowWrap, horizontalPad]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        minWidth: 0,
        ...style,
      }}
    >
      <span
        ref={textRef}
        style={{
          fontSize: `${size}px`,
          whiteSpace: allowWrap ? "normal" : "nowrap",
          lineHeight: 1.05,
          textAlign: "center",
          display: "inline-block",
          maxWidth: "100%",
        }}
      >
        {children}
      </span>
    </div>
  );
}
