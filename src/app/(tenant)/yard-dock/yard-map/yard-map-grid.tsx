"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface YardSpot {
  id: string;
  code: string;
  name: string;
  status: string;
  type: string;
  row: number | null;
  col: number | null;
  yardVisits: { id: string; trailerNumber: string; status: string }[];
}

interface YardMapGridProps {
  spots: YardSpot[];
  labels: {
    empty: string;
    occupied: string;
    reserved: string;
    blocked: string;
    trailer: string;
  };
}

const statusColor: Record<string, string> = {
  empty: "bg-green-500/80 hover:bg-green-500 border-green-600 text-white",
  occupied: "bg-red-500/80 hover:bg-red-500 border-red-600 text-white",
  reserved: "bg-yellow-400/80 hover:bg-yellow-400 border-yellow-500 text-yellow-900",
  blocked: "bg-gray-400/80 hover:bg-gray-400 border-gray-500 text-white",
};

export function YardMapGrid({ spots, labels }: YardMapGridProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const hasGrid = spots.some((s) => s.row != null && s.col != null);

  const maxRow = hasGrid
    ? Math.max(...spots.filter((s) => s.row != null).map((s) => s.row!)) + 1
    : 0;
  const maxCol = hasGrid
    ? Math.max(...spots.filter((s) => s.col != null).map((s) => s.col!)) + 1
    : 0;

  const selectedSpot = spots.find((s) => s.id === selected);

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-green-500" />
          <span>{labels.empty}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-red-500" />
          <span>{labels.occupied}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-yellow-400" />
          <span>{labels.reserved}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-gray-400" />
          <span>{labels.blocked}</span>
        </div>
      </div>

      {/* Grid */}
      <div
        className="grid gap-2"
        style={
          hasGrid
            ? {
                gridTemplateRows: `repeat(${maxRow}, minmax(0, 1fr))`,
                gridTemplateColumns: `repeat(${maxCol}, minmax(0, 1fr))`,
              }
            : {
                gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
              }
        }
      >
        {spots.map((spot) => {
          const trailer = spot.yardVisits?.[0]?.trailerNumber;
          return (
            <button
              key={spot.id}
              onClick={() => setSelected(spot.id === selected ? null : spot.id)}
              className={cn(
                "rounded-md border-2 p-2 text-center text-xs font-medium transition-all min-h-[60px] flex flex-col items-center justify-center",
                statusColor[spot.status] ?? statusColor.empty,
                selected === spot.id && "ring-2 ring-offset-2 ring-primary"
              )}
              style={
                hasGrid && spot.row != null && spot.col != null
                  ? { gridRow: spot.row + 1, gridColumn: spot.col + 1 }
                  : undefined
              }
            >
              <span className="font-bold">{spot.code}</span>
              {trailer && (
                <span className="text-[10px] opacity-90 truncate max-w-full">{trailer}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected spot detail */}
      {selectedSpot && (
        <div className="rounded-lg border p-4 bg-muted/50">
          <div className="text-sm space-y-1">
            <div className="font-semibold text-base">
              {selectedSpot.code} &mdash; {selectedSpot.name}
            </div>
            <div>
              Status: <span className="font-medium capitalize">{selectedSpot.status}</span>
            </div>
            <div>
              Type: <span className="font-medium capitalize">{selectedSpot.type}</span>
            </div>
            {selectedSpot.yardVisits?.[0] && (
              <div>
                {labels.trailer}:{" "}
                <span className="font-mono font-medium">
                  {selectedSpot.yardVisits[0].trailerNumber}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
