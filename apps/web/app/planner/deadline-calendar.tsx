"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
export default function DeadlineCalendar({ events, onSelect }: { events: { id: string; title: string; start: string; allDay: boolean; color: string; url: string }[]; onSelect: (id: string) => void }) {
  return <FullCalendar plugins={[dayGridPlugin,listPlugin]} initialView="dayGridMonth" height="auto" headerToolbar={{left:"prev,next today",center:"title",right:"dayGridMonth,listMonth"}} events={events} eventClick={info => { info.jsEvent.preventDefault(); onSelect(info.event.id.replace(/^(deadline|visit)-/,"")); }} eventDisplay="block" dayMaxEvents={2} fixedWeekCount={false}/>;
}
