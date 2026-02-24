"use client";

import { useEffect, useRef } from "react";
import type { StateSnapshot, AgentModel } from "@/lib/types";

// ── Constants ──────────────────────────────────────────────────────────────
const TILE = 16;        // source tile size in pixels
const ZOOM = 2;         // display zoom (integer for pixel-perfect)
const S = TILE * ZOOM;  // 32px per tile on screen

// Character sprite sheet dimensions (per PNG: 7 frames × 3 direction rows)
const CHAR_W = 16;      // sprite frame width in source image
const CHAR_H = 32;      // sprite frame height in source image
const DIR_DOWN = 0;     // row 0 in sprite sheet
// Frame indices in sprite sheet (walk1, walk2, walk3, type1, type2, read1, read2)
const FRAME_STAND = 1;  // walk2 = standing pose
const FRAME_TYPE_A = 3; // type1
const FRAME_TYPE_B = 4; // type2
const FRAME_READ_A = 5; // read1
const FRAME_READ_B = 6; // read2

// Furniture fill & border colors keyed by base type
const FURNITURE_COLORS: Record<string, readonly [string, string]> = {
  desk:       ["#c39a66", "#6e4f31"],
  chair:      ["#be8f55", "#5f4324"],
  cabinet:    ["#d2ab69", "#8a6538"],
  plant:      ["#2f8142", "#1a4f27"],
  whiteboard: ["#f5f8ff", "#8daac8"],
  table:      ["#cba26e", "#7a5535"],
  bookshelf:  ["#8f6139", "#4a2d12"],
  cooler:     ["#d5dce3", "#7a8fa0"],
  counter:    ["#f0ede7", "#9a9690"],
};

const FLOOR_COLOR   = "#c4b49a";
const GRID_COLOR    = "rgba(0,0,0,0.09)";
const SHADOW_COLOR  = "rgba(0,0,0,0.18)";

// ── Helpers ────────────────────────────────────────────────────────────────

function agentFrame(agent: AgentModel, tick: number): number {
  if (agent.status === "active") {
    // alternate type frames every 6 ticks (~20fps / 6 ≈ 3fps per frame)
    return Math.floor(tick / 6) % 2 === 0 ? FRAME_TYPE_A : FRAME_TYPE_B;
  }
  if (agent.status === "waiting") {
    return Math.floor(tick / 8) % 2 === 0 ? FRAME_READ_A : FRAME_READ_B;
  }
  return FRAME_STAND;
}

function statusDotColor(status: string): string {
  if (status === "active")  return "#00c853";
  if (status === "error")   return "#d32f2f";
  if (status === "waiting") return "#ffab00";
  return "#78909c"; // idle / unknown
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  state: StateSnapshot;
}

export default function PixelOfficeCanvas({ state }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const imgsRef    = useRef<(HTMLImageElement | null)[]>([]);
  const stateRef   = useRef(state);
  const tickRef    = useRef(0);

  // Keep stateRef in sync with latest state (no animation restart)
  useEffect(() => { stateRef.current = state; }, [state]);

  // Load character sprite sheets once on mount
  useEffect(() => {
    const imgs: (HTMLImageElement | null)[] = Array.from({ length: 6 }, (_, i) => {
      const img = new Image();
      img.src = `/assets/characters/char_${i}.png`;
      return img;
    });
    imgsRef.current = imgs;
  }, []);

  // rAF animation loop (20fps cap)
  useEffect(() => {
    let rafId: number;
    let lastTime = 0;
    const FRAME_MS = 1000 / 20;

    const loop = (now: number) => {
      rafId = requestAnimationFrame(loop);
      if (now - lastTime < FRAME_MS) return;
      lastTime = now;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { layout, agents } = stateRef.current;
      const cols = layout.cols;
      const rows = layout.rows;
      const W = cols * S;
      const H = rows * S;
      const tick = tickRef.current++;

      // ── Background & grid ──────────────────────────────────
      ctx.fillStyle = FLOOR_COLOR;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 1;
      for (let c = 1; c < cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * S + 0.5, 0);
        ctx.lineTo(c * S + 0.5, H);
        ctx.stroke();
      }
      for (let r = 1; r < rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * S + 0.5);
        ctx.lineTo(W, r * S + 0.5);
        ctx.stroke();
      }

      // ── Furniture ──────────────────────────────────────────
      for (const item of layout.furniture ?? []) {
        const fw = (item.w ?? 1) * S;
        const fh = (item.h ?? 1) * S;
        const fx = item.col * S;
        const fy = item.row * S;

        // Base type key (strip orientation/state suffixes)
        const typeKey = item.type.split("_")[0].toLowerCase();
        const [fill, border] = FURNITURE_COLORS[typeKey] ?? ["#b0b0b0", "#606060"];

        // Shadow
        ctx.fillStyle = SHADOW_COLOR;
        ctx.fillRect(fx + 3, fy + 3, fw, fh);

        ctx.fillStyle = fill;
        ctx.fillRect(fx, fy, fw, fh);

        ctx.strokeStyle = border;
        ctx.lineWidth = 2;
        ctx.strokeRect(fx + 1, fy + 1, fw - 2, fh - 2);

        // Subtle inner highlight on wide furniture
        if (fw >= S * 2) {
          ctx.fillStyle = "rgba(255,255,255,0.12)";
          ctx.fillRect(fx + 3, fy + 3, fw - 6, Math.min(fh / 3, S / 2));
        }
      }

      // ── Agents ────────────────────────────────────────────
      for (let ai = 0; ai < agents.length; ai++) {
        const agent = agents[ai];
        const { col, row } = agent.position;
        const ax = col * S;
        const ay = row * S;

        const frame   = agentFrame(agent, tick);
        const palette = ai % 6;
        const img     = imgsRef.current[palette];

        // Drop shadow ellipse
        ctx.fillStyle = SHADOW_COLOR;
        ctx.beginPath();
        ctx.ellipse(ax + S / 2, ay + S - 4, S * 0.35, S * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Character sprite (source: 16×32, display: S×(S*2))
        if (img?.complete && img.naturalWidth > 0) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            img,
            frame * CHAR_W, DIR_DOWN * CHAR_H, CHAR_W, CHAR_H,
            ax, ay - S, S, S * 2,
          );
        } else {
          // Fallback: simple stick figure in agent color
          const bodyColor = agent.status === "active" ? "#2e7d5d"
            : agent.status === "error" ? "#b71c1c"
            : "#607d8b";
          ctx.fillStyle = "#f0c19a";
          ctx.fillRect(ax + S / 2 - 5, ay - S / 2 - 5, 10, 8);   // head
          ctx.fillStyle = bodyColor;
          ctx.fillRect(ax + S / 2 - 7, ay - S / 2 + 4, 14, 12);  // body
          ctx.fillStyle = "#2f3339";
          ctx.fillRect(ax + S / 2 - 5, ay - S / 2 + 16, 10, 8);  // legs
        }

        // Status dot (top-right corner of tile)
        const dotColor = statusDotColor(agent.status);
        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(ax + S - 5, ay - S + 6, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Name tag (below character)
        const nameText = agent.name;
        ctx.font = "bold 9px 'Courier New', monospace";
        const nameW = ctx.measureText(nameText).width + 10;
        const tagX  = ax + S / 2 - nameW / 2;
        const tagY  = ay + S + 4;

        drawRoundRect(ctx, tagX, tagY, nameW, 13, 2);
        ctx.fillStyle = "rgba(10, 15, 25, 0.80)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#dff0f8";
        ctx.textAlign = "center";
        ctx.fillText(nameText, ax + S / 2, tagY + 10);
        ctx.textAlign = "left";

        // Speech bubble (active agents with tool_status)
        if (agent.status === "active" && agent.tool_status) {
          const raw     = agent.tool_status.replace(/\s*\(완료\)\s*$/u, "").trim();
          const speech  = raw.length > 30 ? `${raw.slice(0, 30)}…` : raw;
          if (speech) {
            ctx.font = "9px 'Courier New', monospace";
            const bw = ctx.measureText(speech).width + 12;
            const bh = 16;
            const bx = ax + S / 2 - bw / 2;
            const by = ay - S * 2 - bh - 2;

            drawRoundRect(ctx, bx, by, bw, bh, 3);
            ctx.fillStyle = "#fffde7";
            ctx.fill();
            ctx.strokeStyle = "#1f2a30";
            ctx.lineWidth = 1;
            ctx.stroke();

            // Tail
            ctx.beginPath();
            ctx.moveTo(ax + S / 2 - 4, by + bh);
            ctx.lineTo(ax + S / 2 + 4, by + bh);
            ctx.lineTo(ax + S / 2, by + bh + 5);
            ctx.closePath();
            ctx.fillStyle = "#fffde7";
            ctx.fill();
            ctx.strokeStyle = "#1f2a30";
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = "#1f2a30";
            ctx.textAlign = "center";
            ctx.fillText(speech, ax + S / 2, by + 11);
            ctx.textAlign = "left";
          }
        }

        // Permission / waiting bubble
        if (agent.bubble.visible && agent.bubble.type) {
          const isPermission = agent.bubble.type === "permission";
          const bLabel = isPermission ? "PERM" : "WAIT";
          const bFill  = isPermission ? "#ffcdd2" : "#fff9c4";
          const bBorder = isPermission ? "#c62828" : "#f9a825";

          ctx.font = "8px 'Courier New', monospace";
          const bw = ctx.measureText(bLabel).width + 10;
          const bx = ax + S + 2;
          const by = ay - S;

          drawRoundRect(ctx, bx, by, bw, 14, 2);
          ctx.fillStyle = bFill;
          ctx.fill();
          ctx.strokeStyle = bBorder;
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = bBorder;
          ctx.textAlign = "center";
          ctx.fillText(bLabel, bx + bw / 2, by + 10);
          ctx.textAlign = "left";
        }
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []); // intentionally empty — uses refs only

  const cols = state.layout.cols;
  const rows = state.layout.rows;

  return (
    <div style={{ overflowX: "auto", overflowY: "hidden" }}>
      <canvas
        ref={canvasRef}
        width={cols * S}
        height={rows * S}
        style={{
          imageRendering: "pixelated",
          display: "block",
          border: "2px solid #1f2a30",
          boxShadow: "4px 4px 0 rgba(0,0,0,0.15)",
        }}
      />
    </div>
  );
}
