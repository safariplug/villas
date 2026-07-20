import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import resourceDayGridPlugin from '@fullcalendar/resource-daygrid';
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid';
import adaptivePlugin from '@fullcalendar/adaptive';

/**
 * FullCalendar configuration for the reservation calendar
 * Supports multiple views: dayGridMonth, resourceTimelineDay, resourceTimelineWeek, resourceDayGridDay, resourceTimeGridWeek
 */
export const calendarConfig: CalendarOptions = {
  plugins: [
    dayGridPlugin,
    timeGridPlugin,
    resourceTimelinePlugin,
    resourceDayGridPlugin,
    resourceTimeGridPlugin,
    adaptivePlugin,
  ],
  initialView: 'resourceTimelineWeek',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,resourceTimelineDay,resourceTimelineWeek,resourceDayGridDay',
  },
  height: 'auto',
  contentHeight: 'auto',
  slotLabelFormat: {
    meridiem: 'short',
    hour: 'numeric',
    minute: '2-digit',
  },
  slotDuration: '00:30:00',
  slotLabelInterval: '00:30:00',
  scrollTime: '09:00:00',
  nowIndicator: true,
  editable: true,
  eventDurationEditable: true,
  eventStartEditable: true,
  eventResizableFromStart: true,
  selectable: true,
  selectConstraint: 'businessHours',
  eventOverlapStrict: false,
  dayMaxEvents: 3,
  dayMaxEventRows: true,
  eventTimeFormat: {
    meridiem: 'short',
    hour: 'numeric',
    minute: '2-digit',
  },
  slotLabelClassNames: 'text-xs',
  resourceAreaWidth: '150px',
  resourceAreaColumns: [
    {
      field: 'title',
      headerContent: 'Room',
    },
  ],
  views: {
    resourceTimelineDay: {
      type: 'resourceTimeline',
      duration: { days: 1 },
      slotDuration: '00:30:00',
      slotLabelInterval: '00:30:00',
    },
    resourceTimelineWeek: {
      type: 'resourceTimeline',
      duration: { days: 7 },
      slotDuration: '01:00:00',
      slotLabelInterval: '01:00:00',
    },
  },
  businessHours: {
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startTime: '00:00',
    endTime: '24:00',
  },
  eventClassNames: ['booking-event'],
  eventDisplay: 'block',
  eventMinHeight: 40,
  eventMaxStack: 5,
  eventClick: () => {
    // Handled by component
  },
  select: () => {
    // Handled by component
  },
  eventDrop: () => {
    // Handled by component
  },
  eventResize: () => {
    // Handled by component
  },
};

/**
 * Get calendar options for a specific view
 */
export function getCalendarOptions(initialView: string = 'resourceTimelineWeek'): CalendarOptions {
  return {
    ...calendarConfig,
    initialView,
  };
}

/**
 * Map event colors based on booking status
 */
export const EVENT_COLOR_MAP = {
  PENDING: { backgroundColor: '#fbbf24', borderColor: '#f59e0b', textColor: '#000' },
  CONFIRMED: { backgroundColor: '#60a5fa', borderColor: '#3b82f6', textColor: '#fff' },
  CHECKED_IN: { backgroundColor: '#34d399', borderColor: '#10b981', textColor: '#000' },
  CHECKED_OUT: { backgroundColor: '#d1d5db', borderColor: '#9ca3af', textColor: '#000' },
  CANCELLED: { backgroundColor: '#f87171', borderColor: '#ef4444', textColor: '#fff' },
  NO_SHOW: { backgroundColor: '#a78bfa', borderColor: '#8b5cf6', textColor: '#fff' },
} as const;

/**
 * View options for the calendar
 */
export const VIEW_OPTIONS = [
  { value: 'dayGridMonth', label: 'Month' },
  { value: 'resourceTimelineDay', label: 'Day' },
  { value: 'resourceTimelineWeek', label: 'Week' },
  { value: 'resourceDayGridDay', label: 'Room Day' },
] as const;
