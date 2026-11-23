"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Parallax runs only with a mouse or trackpad, on a laptop-wide screen, for readers who allow motion. */
const FINE_POINTER = "(hover: hover) and (pointer: fine) and (min-width: 1024px)";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

/**
 * ParallaxStage: the box of the layered hero (D) whose layers (.hl-layer) move by their depth with
 * the pointer and the scroll. It only writes three CSS variables on itself, once per frame at most
 * (--hl-px and --hl-py: the pointer from the box's centre, -1 to 1; --hl-sy: pixels scrolled); the
 * layers move by transform, so nothing is laid out again. It listens only while the box is on
 * screen, the tab is visible, the pointer is fine and the reader allows motion.
 */
export function ParallaxStage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = stage.current;
    if (!element) return undefined;
    const fine = window.matchMedia(FINE_POINTER);
    const reduced = window.matchMedia(REDUCED_MOTION);
    let onScreen = false;
    let listening = false;
    let frame = 0;
    let pointer: { left: number; top: number } | null = null;

    const write = () => {
      frame = 0;
      let across = 0;
      let down = 0;
      if (pointer) {
        const box = element.getBoundingClientRect();
        across = clamp((pointer.left - (box.left + box.width / 2)) / (box.width / 2));
        down = clamp((pointer.top - (box.top + box.height / 2)) / (box.height / 2));
      }
      element.style.setProperty("--hl-px", across.toFixed(3));
      element.style.setProperty("--hl-py", down.toFixed(3));
      element.style.setProperty("--hl-sy", String(Math.round(window.scrollY)));
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(write);
    };
    const onPointerMove = (event: PointerEvent) => {
      pointer = { left: event.clientX, top: event.clientY };
      schedule();
    };
    const onPointerLeave = () => {
      pointer = null;
      schedule();
    };

    const update = () => {
      const wanted =
        onScreen && fine.matches && !reduced.matches && document.visibilityState === "visible";
      if (wanted === listening) return;
      listening = wanted;
      if (wanted) {
        element.addEventListener("pointermove", onPointerMove);
        element.addEventListener("pointerleave", onPointerLeave);
        window.addEventListener("scroll", schedule, { passive: true });
        schedule();
      } else {
        element.removeEventListener("pointermove", onPointerMove);
        element.removeEventListener("pointerleave", onPointerLeave);
        window.removeEventListener("scroll", schedule);
        pointer = null;
        element.style.removeProperty("--hl-px");
        element.style.removeProperty("--hl-py");
        element.style.removeProperty("--hl-sy");
      }
    };

    const observer = new IntersectionObserver((entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting);
      update();
    });
    observer.observe(element);
    fine.addEventListener("change", update);
    reduced.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);

    return () => {
      observer.disconnect();
      fine.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      onScreen = false;
      update();
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={stage} className={className}>
      {children}
    </div>
  );
}
