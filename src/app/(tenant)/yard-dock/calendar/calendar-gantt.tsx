"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DockDoor {
  id: string;
  code: string;
  name: string;
}

interface Appointment {
  id: string;
  appointmentNumber: string;
  direction: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  dockDoorId: string | null;
  client: { code: string; name: string } | null;
}

interface CalendarGanttProps {
  initialDate: string;
  initialDoors: DockDoor[];
  initialAppointments: Appointment[];
  labels: {
    dockDoor: string;
    noAppointments: string;
    inbound: string;
    outbound: string;
    prevDay: string;
    nextDay: string;
  };
  onDateChange?: (date: string) => void;
}

const HOUR_START = 5; // 5 AM
const HOUR_END = 22; // 10 PM
const TOTAL_HOURS = HOUR_END - HOUR_START;

export function CalendarGantt({
  initialDate,
  initialDoors,
  initialAppointments,
  labels,
}: CalendarGanttProps) {
  const [date, setDate] = useState(initialDate);
  const [doors] = useState(initialDoors);
  const [appointments] = useState(initialAppointments);

  const hours = useMemo(() => Array.from({ length: TOTAL_HOURS }, (_, i) => HOUR_START + i), []);

  function changeDate(delta: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    const newDate = d.toISOString().slice(0, 10);
    setDate(newDate);
    // Reload page with new date
    window.location.href = `?date=${newDate}`;
  }

  function getPosition(start: string, end: string) {
    const s = new Date(start);
    const e = new Date(end);
    const startHour = s.getHours() + s.getMinutes() / 60;
    const endHour = e.getHours() + e.getMinutes() / 60;

    const left = ((Math.max(startHour, HOUR_START) - HOUR_START) / TOTAL_HOURS) * 100;
    const right = ((Math.min(endHour, HOUR_END) - HOUR_START) / TOTAL_HOURS) * 100;
    const width = Math.max(right - left, 1);

    return { left: `${left}%`, width: `${width}%` };
  }

  return (
    <div className="space-y-4">
      {/* Date picker controls */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => changeDate(-1)}>
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">{labels.prevDay}</span>
        </Button>
        <Input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            window.location.href = `?date=${e.target.value}`;
          }}
          className="w-44"
        />
        <Button variant="outline" size="sm" onClick={() => changeDate(1)}>
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">{labels.nextDay}</span>
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-6 rounded bg-blue-500" />
          <span>{labels.inbound}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-6 rounded bg-orange-500" />
          <span>{labels.outbound}</span>
        </div>
      </div>

      {/* Gantt chart */}
      <div className="overflow-x-auto border rounded-lg">
        {/* Time header */}
        <div className="grid" style={{ gridTemplateColumns: `140px 1fr` }}>
          <div className="border-b border-r bg-muted/50 p-2 text-sm font-medium">
            {labels.dockDoor}
          </div>
          <div className="border-b bg-muted/50 relative">
            <div className="flex">
              {hours.map((h) => (
                <div
                  key={h}
                  className="flex-1 text-center text-xs text-muted-foreground py-2 border-l"
                >
                  {h.toString().padStart(2, "0")}:00
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Door rows */}
        {doors.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {labels.noAppointments}
          </div>
        ) : (
          doors.map((door) => {
            const doorAppts = appointments.filter((a) => a.dockDoorId === door.id);
            return (
              <div
                key={door.id}
                className="grid border-b last:border-b-0"
                style={{ gridTemplateColumns: `140px 1fr` }}
              >
                <div className="border-r p-2 text-sm font-medium flex items-center">
                  <span className="truncate">
                    {door.code} - {door.name}
                  </span>
                </div>
                <div className="relative h-12">
                  {/* Hour gridlines */}
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute top-0 bottom-0 border-l border-dashed border-gray-200"
                      style={{
                        left: `${((h - HOUR_START) / TOTAL_HOURS) * 100}%`,
                      }}
                    />
                  ))}
                  {/* Appointments */}
                  {doorAppts.map((appt) => {
                    const pos = getPosition(appt.scheduledStart, appt.scheduledEnd);
                    return (
                      <div
                        key={appt.id}
                        className={cn(
                          "absolute top-1 bottom-1 rounded-md px-1.5 flex items-center text-xs text-white font-medium truncate cursor-pointer hover:opacity-90 transition-opacity",
                          appt.direction === "inbound" ? "bg-blue-500" : "bg-orange-500"
                        )}
                        style={{ left: pos.left, width: pos.width }}
                        title={`${appt.appointmentNumber}${appt.client ? ` - ${appt.client.name}` : ""}`}
                      >
                        <span className="truncate">
                          {appt.appointmentNumber}
                          {appt.client && ` (${appt.client.code})`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
