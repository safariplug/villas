import { z } from 'zod';

// ============================================================================
// CALENDAR VALIDATION SCHEMAS
// ============================================================================

export const getCalendarEventsSchema = z.object({
  organizationId: z.string().cuid('Invalid organization ID'),
  propertyId: z.string().cuid('Invalid property ID'),
  startDate: z.coerce.date('Invalid start date'),
  endDate: z.coerce.date('Invalid end date'),
});

export const updateBookingDatesSchema = z.object({
  organizationId: z.string().cuid('Invalid organization ID'),
  bookingId: z.string().cuid('Invalid booking ID'),
  checkInDate: z.coerce.date('Invalid check-in date'),
  checkOutDate: z.coerce.date('Invalid check-out date'),
}).refine(
  (data) => data.checkOutDate > data.checkInDate,
  {
    message: 'Check-out date must be after check-in date',
    path: ['checkOutDate'],
  }
);

export const createBookingSchema = z.object({
  organizationId: z.string().cuid('Invalid organization ID'),
  propertyId: z.string().cuid('Invalid property ID'),
  roomId: z.string().cuid('Invalid room ID'),
  guestId: z.string().cuid('Invalid guest ID').optional(),
  checkInDate: z.coerce.date('Invalid check-in date'),
  checkOutDate: z.coerce.date('Invalid check-out date'),
  numberOfGuests: z.number().int().positive('Number of guests must be positive'),
  notes: z.string().optional(),
}).refine(
  (data) => data.checkOutDate > data.checkInDate,
  {
    message: 'Check-out date must be after check-in date',
    path: ['checkOutDate'],
  }
);

export const updateBookingStatusSchema = z.object({
  organizationId: z.string().cuid('Invalid organization ID'),
  bookingId: z.string().cuid('Invalid booking ID'),
  status: z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW']),
});

// ============================================================================
// CALENDAR EVENT TYPES
// ============================================================================

export const calendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  start: z.date(),
  end: z.date(),
  resourceId: z.string(),
  backgroundColor: z.string(),
  borderColor: z.string(),
  extendedProps: z.object({
    bookingId: z.string(),
    guestName: z.string(),
    guestEmail: z.string(),
    roomName: z.string(),
    status: z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW']),
    numberOfGuests: z.number(),
    notes: z.string().optional(),
  }),
});

export const calendarResourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  extendedProps: z.object({
    roomNumber: z.string(),
    capacity: z.number(),
    type: z.string(),
    status: z.string(),
  }),
});

export type GetCalendarEventsInput = z.infer<typeof getCalendarEventsSchema>;
export type UpdateBookingDatesInput = z.infer<typeof updateBookingDatesSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type CalendarResource = z.infer<typeof calendarResourceSchema>;

// ============================================================================
// STATUS COLOR MAPPING
// ============================================================================

export const STATUS_COLORS = {
  PENDING: { bg: '#fbbf24', border: '#f59e0b' },      // Amber
  CONFIRMED: { bg: '#60a5fa', border: '#3b82f6' },    // Blue
  CHECKED_IN: { bg: '#34d399', border: '#10b981' },   // Green
  CHECKED_OUT: { bg: '#d1d5db', border: '#9ca3af' },  // Gray
  CANCELLED: { bg: '#f87171', border: '#ef4444' },    // Red
  NO_SHOW: { bg: '#a78bfa', border: '#8b5cf6' },      // Purple
};
