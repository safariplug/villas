import { z } from 'zod';

// ============================================================================
// DASHBOARD VALIDATION SCHEMAS
// ============================================================================

export const getDashboardOverviewSchema = z.object({
  organizationId: z.string().cuid('Invalid organization ID'),
  propertyId: z.string().cuid('Invalid property ID').optional(),
  dateRange: z.enum(['today', 'week', 'month', 'quarter', 'year']).default('month'),
});

export const getOccupancyMetricsSchema = z.object({
  organizationId: z.string().cuid('Invalid organization ID'),
  propertyId: z.string().cuid('Invalid property ID').optional(),
  startDate: z.coerce.date('Invalid start date'),
  endDate: z.coerce.date('Invalid end date'),
}).refine(
  (data) => data.endDate >= data.startDate,
  {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  }
);

export const getArrivalsSchema = z.object({
  organizationId: z.string().cuid('Invalid organization ID'),
  propertyId: z.string().cuid('Invalid property ID').optional(),
  date: z.coerce.date('Invalid date'),
  limit: z.number().int().positive().max(100).default(50),
});

export const getDeparturesSchema = z.object({
  organizationId: z.string().cuid('Invalid organization ID'),
  propertyId: z.string().cuid('Invalid property ID').optional(),
  date: z.coerce.date('Invalid date'),
  limit: z.number().int().positive().max(100).default(50),
});

export const getRevenueMetricsSchema = z.object({
  organizationId: z.string().cuid('Invalid organization ID'),
  propertyId: z.string().cuid('Invalid property ID').optional(),
  startDate: z.coerce.date('Invalid start date'),
  endDate: z.coerce.date('Invalid end date'),
}).refine(
  (data) => data.endDate >= data.startDate,
  {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  }
);

export const getOutstandingBalancesSchema = z.object({
  organizationId: z.string().cuid('Invalid organization ID'),
  propertyId: z.string().cuid('Invalid property ID').optional(),
  limit: z.number().int().positive().max(100).default(50),
  sortBy: z.enum(['balance', 'dueDate', 'checkOutDate']).default('balance'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const getPaymentStatusSchema = z.object({
  organizationId: z.string().cuid('Invalid organization ID'),
  propertyId: z.string().cuid('Invalid property ID').optional(),
  startDate: z.coerce.date('Invalid start date'),
  endDate: z.coerce.date('Invalid end date'),
}).refine(
  (data) => data.endDate >= data.startDate,
  {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  }
);

export const getBookingTrendSchema = z.object({
  organizationId: z.string().cuid('Invalid organization ID'),
  propertyId: z.string().cuid('Invalid property ID').optional(),
  startDate: z.coerce.date('Invalid start date'),
  endDate: z.coerce.date('Invalid end date'),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
}).refine(
  (data) => data.endDate >= data.startDate,
  {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  }
);

export const getRoomPerformanceSchema = z.object({
  organizationId: z.string().cuid('Invalid organization ID'),
  propertyId: z.string().cuid('Invalid property ID'),
  startDate: z.coerce.date('Invalid start date'),
  endDate: z.coerce.date('Invalid end date'),
  limit: z.number().int().positive().max(100).default(50),
}).refine(
  (data) => data.endDate >= data.startDate,
  {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  }
);

export const getGuestMetricsSchema = z.object({
  organizationId: z.string().cuid('Invalid organization ID'),
  propertyId: z.string().cuid('Invalid property ID').optional(),
  startDate: z.coerce.date('Invalid start date'),
  endDate: z.coerce.date('Invalid end date'),
}).refine(
  (data) => data.endDate >= data.startDate,
  {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  }
);

// ============================================================================
// DASHBOARD RESPONSE TYPES
// ============================================================================

export const occupancyMetricSchema = z.object({
  totalRooms: z.number().int(),
  occupiedRooms: z.number().int(),
  availableRooms: z.number().int(),
  maintenanceRooms: z.number().int(),
  occupancyRate: z.number().min(0).max(100),
  averageOccupancyRate: z.number().min(0).max(100),
});

export const arrivalSchema = z.object({
  bookingId: z.string().cuid(),
  guestName: z.string(),
  guestEmail: z.string().email(),
  roomNumber: z.string(),
  roomName: z.string(),
  checkInDate: z.date(),
  numberOfGuests: z.number().int(),
  status: z.enum(['PENDING', 'CONFIRMED']),
});

export const departureSchema = z.object({
  bookingId: z.string().cuid(),
  guestName: z.string(),
  guestEmail: z.string().email(),
  roomNumber: z.string(),
  roomName: z.string(),
  checkOutDate: z.date(),
  status: z.enum(['CHECKED_IN', 'CONFIRMED']),
  totalDays: z.number().int(),
});

export const revenueMetricSchema = z.object({
  totalRevenue: z.string(), // Decimal as string
  paidRevenue: z.string(),
  pendingRevenue: z.string(),
  refundedRevenue: z.string(),
  averageRevenuePerBooking: z.string(),
  completedBookings: z.number().int(),
});

export const outstandingBalanceSchema = z.object({
  bookingId: z.string().cuid(),
  guestName: z.string(),
  guestEmail: z.string().email(),
  roomName: z.string(),
  checkOutDate: z.date(),
  balance: z.string(), // Decimal as string
  daysOverdue: z.number().int(),
  status: z.enum(['PENDING', 'PARTIALLY_PAID']),
});

export const paymentStatusSchema = z.object({
  paid: z.number().int(),
  partiallyPaid: z.number().int(),
  pending: z.number().int(),
  failed: z.number().int(),
  cancelled: z.number().int(),
});

export const bookingTrendSchema = z.object({
  date: z.string(), // ISO date string
  bookings: z.number().int(),
  checkIns: z.number().int(),
  checkOuts: z.number().int(),
  revenue: z.string(), // Decimal as string
});

export const roomPerformanceSchema = z.object({
  roomId: z.string().cuid(),
  roomNumber: z.string(),
  roomName: z.string(),
  occupancyRate: z.number().min(0).max(100),
  revenue: z.string(), // Decimal as string
  bookings: z.number().int(),
  averageNightlyRate: z.string(), // Decimal as string
});

export const guestMetricSchema = z.object({
  totalGuests: z.number().int(),
  returningGuests: z.number().int(),
  newGuests: z.number().int(),
  averageStayLength: z.number().min(0),
  guestSatisfactionScore: z.number().min(0).max(5).optional(),
});

export const dashboardOverviewSchema = z.object({
  occupancy: occupancyMetricSchema,
  revenue: revenueMetricSchema,
  arrivals: z.array(arrivalSchema),
  departures: z.array(departureSchema),
  outstandingBalances: z.array(outstandingBalanceSchema),
  alerts: z.array(z.object({
    type: z.enum(['warning', 'error', 'info']),
    message: z.string(),
    action: z.string().optional(),
  })).optional(),
});

export type GetDashboardOverviewInput = z.infer<typeof getDashboardOverviewSchema>;
export type GetOccupancyMetricsInput = z.infer<typeof getOccupancyMetricsSchema>;
export type GetArrivalsInput = z.infer<typeof getArrivalsSchema>;
export type GetDeparturesInput = z.infer<typeof getDeparturesSchema>;
export type GetRevenueMetricsInput = z.infer<typeof getRevenueMetricsSchema>;
export type GetOutstandingBalancesInput = z.infer<typeof getOutstandingBalancesSchema>;
export type GetPaymentStatusInput = z.infer<typeof getPaymentStatusSchema>;
export type GetBookingTrendInput = z.infer<typeof getBookingTrendSchema>;
export type GetRoomPerformanceInput = z.infer<typeof getRoomPerformanceSchema>;
export type GetGuestMetricsInput = z.infer<typeof getGuestMetricsSchema>;
export type DashboardOverview = z.infer<typeof dashboardOverviewSchema>;
export type OccupancyMetric = z.infer<typeof occupancyMetricSchema>;
export type RevenueMetric = z.infer<typeof revenueMetricSchema>;
export type Arrival = z.infer<typeof arrivalSchema>;
export type Departure = z.infer<typeof departureSchema>;
export type OutstandingBalance = z.infer<typeof outstandingBalanceSchema>;
export type BookingTrend = z.infer<typeof bookingTrendSchema>;
export type RoomPerformance = z.infer<typeof roomPerformanceSchema>;
export type GuestMetric = z.infer<typeof guestMetricSchema>;
