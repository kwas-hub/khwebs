import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import iCalendarPlugin from "@fullcalendar/icalendar";
import deLocale from "@fullcalendar/core/locales/de";
import "./full-calendar.css";

type Appt = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  end_time: string | null;
  title: string | null;
  first_name: string;
  last_name: string;
  status: "pending" | "confirmed" | "cancelled";
  color: string;
  source: string;
};

type ExtCal = { id: string; name: string; url: string; color: string; active: boolean };

interface Props {
  appointments: Appt[];
  externalCalendars: ExtCal[];
  statusFilter?: string;
  onEventClick?: (apptId: string) => void;
  onDateClick?: (date: Date) => void;
}

export const FullCal = ({ appointments, externalCalendars, statusFilter = "all", onEventClick, onDateClick }: Props) => {
  const ref = useRef<any>(null);

  const events = useMemo(() => {
    return appointments
      .filter((a) => statusFilter === "all" ? true : a.status === statusFilter)
      .map((a) => {
        const startISO = `${a.appointment_date}T${a.appointment_time}`;
        const endISO = a.end_time
          ? `${a.appointment_date}T${a.end_time}`
          : (() => {
              const d = new Date(`${a.appointment_date}T${a.appointment_time}`);
              d.setMinutes(d.getMinutes() + 30);
              return d.toISOString().slice(0, 19);
            })();
        const baseTitle = a.title || `${a.first_name} ${a.last_name}`.trim() || "Termin";
        return {
          id: a.id,
          title: baseTitle,
          start: startISO,
          end: endISO,
          backgroundColor: a.status === "cancelled" ? "#9ca3af" : a.color,
          borderColor: a.status === "cancelled" ? "#6b7280" : a.color,
          textColor: "#fff",
          extendedProps: { kind: "appointment", status: a.status },
        };
      });
  }, [appointments, statusFilter]);

  const eventSources = useMemo(() => {
    const sources: any[] = [{ events }];
    externalCalendars.filter((c) => c.active).forEach((c) => {
      sources.push({
        url: c.url,
        format: "ics",
        color: c.color,
        textColor: "#fff",
        id: `ext-${c.id}`,
      });
    });
    return sources;
  }, [events, externalCalendars]);

  // FullCalendar refresh wenn sources sich ändern
  const [key, setKey] = useState(0);
  useEffect(() => { setKey((k) => k + 1); }, [externalCalendars.map((c) => c.id + c.url + c.active).join("|")]);

  return (
    <div className="fc-wrapper">
      <FullCalendar
        key={key}
        ref={ref}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, iCalendarPlugin]}
        initialView="dayGridMonth"
        firstDay={1}
        locale={deLocale}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        buttonText={{ today: "Heute", month: "Monat", week: "Woche", day: "Tag" }}
        eventSources={eventSources}
        height="auto"
        nowIndicator
        weekNumbers
        dateClick={(info) => onDateClick?.(info.date)}
        eventClick={(info) => {
          if (info.event.extendedProps.kind === "appointment") {
            info.jsEvent.preventDefault();
            onEventClick?.(info.event.id);
          }
        }}
      />
    </div>
  );
};
