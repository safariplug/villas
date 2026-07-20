'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import { EventClickArg, DateSelectArg, EventDropArg, EventResizeArg } from '@fullcalendar/core';
import { getCalendarEvents, updateBookingDates } from '@/app/actions/calendar';
import { getCalendarOptions } from '@/lib/calendar/config';
import { BookingEditorDialog } from './booking-editor-dialog';
import { NewBookingDialog } from './new-booking-dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import '@fullcalendar/core/index.css';
import '@fullcalendar/daygrid/index.css';
import '@fullcalendar/timegrid/index.css';
import '@fullcalendar/resource-timeline/index.css';
import '@fullcalendar/resource-daygrid/index.css';

interface ReservationCalendarProps {
  organizationId: string;
  propertyId: string;
  rooms: Array<{ id: string; name: string; roomNumber: string }>;
  guests: Array<{ id: string; firstName: string; lastName: string; email: string }>;
}

export function ReservationCalendar({
  organizationId,
  propertyId,
  rooms,
  guests,
}: ReservationCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('resourceTimelineWeek');
  const [dateRange, setDateRange] = useState({
    start: new Date(),
    end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [newBookingDialogOpen, setNewBookingDialogOpen] = useState(false);
  const [newBookingData, setNewBookingData] = useState<{
    roomId?: string;
    startDate?: Date;
    endDate?: Date;
  }>({});

  // Load calendar events
  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCalendarEvents({
        organizationId,
        propertyId,
        startDate: dateRange.start,
        endDate: dateRange.end,
      });

      if (calendarRef.current) {
        const calendarApi = calendarRef.current.getApi();
        calendarApi.removeAllEvents();
        
        // Add resources (rooms)
        data.resources.forEach((resource) => {
          calendarApi.addResource(resource);
        });

        // Add events (bookings)
        data.events.forEach((event) => {
          calendarApi.addEvent(event);
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [organizationId, propertyId, dateRange]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Handle event click - open edit dialog
  const handleEventClick = (info: EventClickArg) => {
    const bookingId = info.event.id;
    setEditingBookingId(bookingId);
    setEditDialogOpen(true);
  };

  // Handle date selection - open new booking dialog
  const handleDateSelect = (info: DateSelectArg) => {
    setNewBookingData({
      roomId: info.resource?.id,
      startDate: info.start,
      endDate: info.end,
    });
    setNewBookingDialogOpen(true);
  };

  // Handle event drag and drop
  const handleEventDrop = async (info: EventDropArg) => {
    try {
      const bookingId = info.event.id;
      const newStart = info.event.start;
      const newEnd = info.event.end;

      if (!newStart || !newEnd) {
        toast.error('Invalid dates');
        info.revert();
        return;
      }

      await updateBookingDates({
        organizationId,
        bookingId,
        checkInDate: newStart,
        checkOutDate: newEnd,
      });

      toast.success('Booking dates updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update booking');
      info.revert();
    }
  };

  // Handle event resize
  const handleEventResize = async (info: EventResizeArg) => {
    try {
      const bookingId = info.event.id;
      const newStart = info.event.start;
      const newEnd = info.event.end;

      if (!newStart || !newEnd) {
        toast.error('Invalid dates');
        info.revert();
        return;
      }

      await updateBookingDates({
        organizationId,
        bookingId,
        checkInDate: newStart,
        checkOutDate: newEnd,
      });

      toast.success('Booking dates updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update booking');
      info.revert();
    }
  };

  // Handle view change
  const handleViewChange = (value: string) => {
    setCurrentView(value);
    if (calendarRef.current) {
      calendarRef.current.getApi().changeView(value);
    }
  };

  // Handle dates change (when user navigates calendar)
  const handleDatesSet = (info: any) => {
    setDateRange({
      start: info.start,
      end: info.end,
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">View:</span>
          <Select value={currentView} onValueChange={handleViewChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dayGridMonth">Month</SelectItem>
              <SelectItem value="resourceTimelineDay">Day</SelectItem>
              <SelectItem value="resourceTimelineWeek">Week</SelectItem>
              <SelectItem value="resourceDayGridDay">Room Day</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => {
            setNewBookingData({});
            setNewBookingDialogOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New Booking
        </Button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Calendar */}
      {!loading && (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <FullCalendar
            ref={calendarRef}
            options={{
              ...getCalendarOptions(currentView),
              eventClick: handleEventClick,
              select: handleDateSelect,
              eventDrop: handleEventDrop,
              eventResize: handleEventResize,
              datesSet: handleDatesSet,
              height: 'auto',
              contentHeight: 'auto',
              headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: '',
              },
              eventClassNames: (info) => {
                return ['cursor-pointer', 'hover:opacity-80', 'transition-opacity'];
              },
            }}
          />
        </div>
      )}

      {/* Dialogs */}
      <BookingEditorDialog
        isOpen={editDialogOpen}
        bookingId={editingBookingId}
        organizationId={organizationId}
        propertyId={propertyId}
        onClose={() => {
          setEditDialogOpen(false);
          setEditingBookingId(null);
        }}
        onUpdate={() => {
          loadEvents();
          toast.success('Booking updated');
        }}
      />

      <NewBookingDialog
        isOpen={newBookingDialogOpen}
        organizationId={organizationId}
        propertyId={propertyId}
        roomId={newBookingData.roomId}
        startDate={newBookingData.startDate}
        endDate={newBookingData.endDate}
        onClose={() => {
          setNewBookingDialogOpen(false);
          setNewBookingData({});
        }}
        onBookingCreated={() => {
          loadEvents();
          toast.success('Booking created successfully');
        }}
        rooms={rooms}
        guests={guests}
      />
    </div>
  );
}
