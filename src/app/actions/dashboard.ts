'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import {
  GetDashboardOverviewInput,
  GetOccupancyMetricsInput,
  GetArrivalsInput,
  GetDeparturesInput,
  GetRevenueMetricsInput,
  GetOutstandingBalancesInput,
  GetPaymentStatusInput,
  GetBookingTrendInput,
  GetRoomPerformanceInput,
  GetGuestMetricsInput,
  getDashboardOverviewSchema,
  getOccupancyMetricsSchema,
  getArrivalsSchema,
  getDeparturesSchema,
  getRevenueMetricsSchema,
  getOutstandingBalancesSchema,
  getPaymentStatusSchema,
  getBookingTrendSchema,
  getRoomPerformanceSchema,
  getGuestMetricsSchema,
  dashboardOverviewSchema,
  occupancyMetricSchema,
  revenueMetricSchema,
  bookingTrendSchema,
  roomPerformanceSchema,
  guestMetricSchema,
} from '@/lib/validations/dashboard';
import { checkOrganizationAccess } from '@/lib/auth/permissions';
import { Decimal } from '@prisma/client/runtime/library';
import { BookingStatus } from '@prisma/client';

// ============================================================================
// HELPERS
// ============================================================================

function getDateRange(dateRange: string): { startDate: Date; endDate: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);

  let startDate: Date;

  switch (dateRange) {
    case 'today':
      startDate = new Date(today);
      break;
    case 'week':
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate = new Date(today);
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'quarter':
      startDate = new Date(today);
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case 'year':
      startDate = new Date(today);
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate = new Date(today);
      startDate.setMonth(startDate.getMonth() - 1);
  }

  return { startDate, endDate };
}

function decimalToString(value: Decimal | null): string {
  if (!value) return '0.00';
  return value.toString();
}

// ============================================================================
// OCCUPANCY METRICS
// ============================================================================

export async function getOccupancyMetrics(input: GetOccupancyMetricsInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const validated = getOccupancyMetricsSchema.parse(input);
    await checkOrganizationAccess(session.user.id, validated.organizationId);

    // Build where clause
    const propertyWhere = validated.propertyId
      ? { id: validated.propertyId, organizationId: validated.organizationId }
      : { organizationId: validated.organizationId };

    // Get total rooms
    const totalRooms = await prisma.room.count({
      where: { property: propertyWhere },
    });

    // Get occupied rooms (CHECKED_IN or CONFIRMED with active booking)
    const occupiedRooms = await prisma.room.count({
      where: {
        property: propertyWhere,
        bookings: {
          some: {
            status: { in: ['CHECKED_IN', 'CONFIRMED'] as BookingStatus[] },
            checkInDate: { lte: validated.endDate },
            checkOutDate: { gte: validated.startDate },
          },
        },
      },
    });

    // Get available rooms
    const availableRooms = totalRooms - occupiedRooms;

    // Get maintenance rooms
    const maintenanceRooms = await prisma.room.count({
      where: {
        property: propertyWhere,
        status: 'MAINTENANCE',
      },
    });

    // Calculate occupancy rate
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    // Calculate average occupancy rate over period
    const daysDiff = Math.ceil(
      (validated.endDate.getTime() - validated.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const potentialRoomDays = totalRooms * daysDiff;
    const occupiedRoomDays = await prisma.$queryRaw`
      SELECT COALESCE(SUM(EXTRACT(DAY FROM (
        LEAST(b."checkOutDate", ${validated.endDate}::timestamp) - 
        GREATEST(b."checkInDate", ${validated.startDate}::timestamp)
      ))), 0) as total
      FROM "Booking" b
      JOIN "Room" r ON b."roomId" = r.id
      JOIN "Property" p ON r."propertyId" = p.id
      WHERE p."organizationId" = ${validated.organizationId}
      ${validated.propertyId ? `AND p.id = ${validated.propertyId}` : ''}
      AND b.status IN ('CONFIRMED', 'CHECKED_IN')
    `;

    const occupiedDays = Number((occupiedRoomDays as any)[0]?.total || 0);
    const averageOccupancyRate =
      potentialRoomDays > 0 ? (occupiedDays / potentialRoomDays) * 100 : 0;

    return occupancyMetricSchema.parse({
      totalRooms,
      occupiedRooms,
      availableRooms,
      maintenanceRooms,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      averageOccupancyRate: Math.round(averageOccupancyRate * 100) / 100,
    });
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to get occupancy metrics');
  }
}

// ============================================================================
// ARRIVALS
// ============================================================================

export async function getArrivals(input: GetArrivalsInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const validated = getArrivalsSchema.parse(input);
    await checkOrganizationAccess(session.user.id, validated.organizationId);

    const dayStart = new Date(validated.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(validated.date);
    dayEnd.setHours(23, 59, 59, 999);

    const propertyWhere = validated.propertyId
      ? { id: validated.propertyId, organizationId: validated.organizationId }
      : { organizationId: validated.organizationId };

    const bookings = await prisma.booking.findMany({
      where: {
        room: { property: propertyWhere },
        checkInDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        status: { in: ['PENDING', 'CONFIRMED'] as BookingStatus[] },
      },
      include: {
        guest: true,
        room: true,
      },
      take: validated.limit,
      orderBy: { checkInDate: 'asc' },
    });

    return bookings.map((booking) => ({
      bookingId: booking.id,
      guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
      guestEmail: booking.guest.email,
      roomNumber: booking.room.roomNumber,
      roomName: booking.room.name,
      checkInDate: booking.checkInDate,
      numberOfGuests: booking.numberOfGuests,
      status: booking.status,
    }));
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to get arrivals');
  }
}

// ============================================================================
// DEPARTURES
// ============================================================================

export async function getDepartures(input: GetDeparturesInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const validated = getDeparturesSchema.parse(input);
    await checkOrganizationAccess(session.user.id, validated.organizationId);

    const dayStart = new Date(validated.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(validated.date);
    dayEnd.setHours(23, 59, 59, 999);

    const propertyWhere = validated.propertyId
      ? { id: validated.propertyId, organizationId: validated.organizationId }
      : { organizationId: validated.organizationId };

    const bookings = await prisma.booking.findMany({
      where: {
        room: { property: propertyWhere },
        checkOutDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        status: { in: ['CHECKED_IN', 'CONFIRMED'] as BookingStatus[] },
      },
      include: {
        guest: true,
        room: true,
      },
      take: validated.limit,
      orderBy: { checkOutDate: 'asc' },
    });

    return bookings.map((booking) => {
      const daysDiff = Math.ceil(
        (booking.checkOutDate.getTime() - booking.checkInDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        bookingId: booking.id,
        guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
        guestEmail: booking.guest.email,
        roomNumber: booking.room.roomNumber,
        roomName: booking.room.name,
        checkOutDate: booking.checkOutDate,
        status: booking.status,
        totalDays: daysDiff,
      };
    });
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to get departures');
  }
}

// ============================================================================
// REVENUE METRICS
// ============================================================================

export async function getRevenueMetrics(input: GetRevenueMetricsInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const validated = getRevenueMetricsSchema.parse(input);
    await checkOrganizationAccess(session.user.id, validated.organizationId);

    const propertyWhere = validated.propertyId
      ? { id: validated.propertyId, organizationId: validated.organizationId }
      : { organizationId: validated.organizationId };

    // Get payments within date range
    const payments = await prisma.payment.findMany({
      where: {
        booking: {
          room: { property: propertyWhere },
          checkOutDate: {
            gte: validated.startDate,
            lte: validated.endDate,
          },
        },
        createdAt: {
          gte: validated.startDate,
          lte: validated.endDate,
        },
      },
    });

    const totalRevenue = payments
      .reduce((sum, p) => sum.plus(p.amount), new Decimal(0));
    const paidRevenue = payments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum.plus(p.amount), new Decimal(0));
    const pendingRevenue = payments
      .filter((p) => p.status === 'PENDING' || p.status === 'PARTIALLY_PAID')
      .reduce((sum, p) => sum.plus(p.amount), new Decimal(0));
    const refundedRevenue = payments
      .filter((p) => p.status === 'REFUNDED')
      .reduce((sum, p) => sum.plus(p.amount), new Decimal(0));

    const completedBookings = await prisma.booking.count({
      where: {
        room: { property: propertyWhere },
        checkOutDate: {
          gte: validated.startDate,
          lte: validated.endDate,
        },
        status: { in: ['CHECKED_OUT'] as BookingStatus[] },
      },
    });

    const averageRevenuePerBooking =
      completedBookings > 0
        ? totalRevenue.dividedBy(completedBookings)
        : new Decimal(0);

    return revenueMetricSchema.parse({
      totalRevenue: decimalToString(totalRevenue),
      paidRevenue: decimalToString(paidRevenue),
      pendingRevenue: decimalToString(pendingRevenue),
      refundedRevenue: decimalToString(refundedRevenue),
      averageRevenuePerBooking: decimalToString(averageRevenuePerBooking),
      completedBookings,
    });
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to get revenue metrics');
  }
}

// ============================================================================
// OUTSTANDING BALANCES
// ============================================================================

export async function getOutstandingBalances(input: GetOutstandingBalancesInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const validated = getOutstandingBalancesSchema.parse(input);
    await checkOrganizationAccess(session.user.id, validated.organizationId);

    const propertyWhere = validated.propertyId
      ? { id: validated.propertyId, organizationId: validated.organizationId }
      : { organizationId: validated.organizationId };

    // Get bookings with unpaid/partially paid amounts
    const bookings = await prisma.booking.findMany({
      where: {
        room: { property: propertyWhere },
        status: { in: ['CHECKED_OUT', 'CHECKED_IN'] as BookingStatus[] },
        payments: {
          some: {
            status: { in: ['PENDING', 'PARTIALLY_PAID', 'FAILED'] },
          },
        },
      },
      include: {
        guest: true,
        room: true,
        payments: true,
      },
      take: validated.limit,
      orderBy:
        validated.sortBy === 'balance'
          ? { payments: { _count: validated.sortOrder } }
          : validated.sortBy === 'dueDate'
            ? { checkOutDate: validated.sortOrder as any }
            : { checkOutDate: validated.sortOrder as any },
    });

    const now = new Date();
    return bookings
      .map((booking) => {
        const totalPaymentAmount = booking.payments.reduce(
          (sum, p) => sum.plus(p.amount),
          new Decimal(0)
        );
        const paidAmount = booking.payments
          .filter((p) => p.status === 'PAID')
          .reduce((sum, p) => sum.plus(p.amount), new Decimal(0));
        const balance = totalPaymentAmount.minus(paidAmount);

        const daysSinceCheckOut = Math.floor(
          (now.getTime() - booking.checkOutDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          bookingId: booking.id,
          guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
          guestEmail: booking.guest.email,
          roomName: booking.room.name,
          checkOutDate: booking.checkOutDate,
          balance: decimalToString(balance),
          daysOverdue: Math.max(0, daysSinceCheckOut),
          status: booking.payments[0]?.status || 'PENDING',
        };
      })
      .filter((b) => b.balance !== '0.00');
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to get outstanding balances');
  }
}

// ============================================================================
// PAYMENT STATUS
// ============================================================================

export async function getPaymentStatus(input: GetPaymentStatusInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const validated = getPaymentStatusSchema.parse(input);
    await checkOrganizationAccess(session.user.id, validated.organizationId);

    const propertyWhere = validated.propertyId
      ? { id: validated.propertyId, organizationId: validated.organizationId }
      : { organizationId: validated.organizationId };

    const payments = await prisma.payment.findMany({
      where: {
        booking: {
          room: { property: propertyWhere },
          checkOutDate: {
            gte: validated.startDate,
            lte: validated.endDate,
          },
        },
      },
    });

    return {
      paid: payments.filter((p) => p.status === 'PAID').length,
      partiallyPaid: payments.filter((p) => p.status === 'PARTIALLY_PAID').length,
      pending: payments.filter((p) => p.status === 'PENDING').length,
      failed: payments.filter((p) => p.status === 'FAILED').length,
      cancelled: payments.filter((p) => p.status === 'CANCELLED').length,
    };
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to get payment status');
  }
}

// ============================================================================
// BOOKING TRENDS
// ============================================================================

export async function getBookingTrend(input: GetBookingTrendInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const validated = getBookingTrendSchema.parse(input);
    await checkOrganizationAccess(session.user.id, validated.organizationId);

    const propertyWhere = validated.propertyId
      ? { id: validated.propertyId, organizationId: validated.organizationId }
      : { organizationId: validated.organizationId };

    // Get all bookings in date range
    const bookings = await prisma.booking.findMany({
      where: {
        room: { property: propertyWhere },
        createdAt: {
          gte: validated.startDate,
          lte: validated.endDate,
        },
      },
      include: {
        payments: true,
      },
    });

    // Group by date based on groupBy parameter
    const grouped = new Map<string, any>();

    bookings.forEach((booking) => {
      let dateKey: string;
      const date = new Date(booking.checkInDate);

      if (validated.groupBy === 'day') {
        dateKey = date.toISOString().split('T')[0];
      } else if (validated.groupBy === 'week') {
        const week = Math.floor((date.getDate() - date.getDay() + 6) / 7);
        dateKey = `${date.getFullYear()}-W${week}`;
      } else {
        dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, {
          date: dateKey,
          bookings: 0,
          checkIns: 0,
          checkOuts: 0,
          revenue: new Decimal(0),
        });
      }

      const data = grouped.get(dateKey);
      data.bookings += 1;

      if (
        booking.checkInDate.toISOString().split('T')[0] ===
        new Date(validated.startDate).toISOString().split('T')[0]
      ) {
        data.checkIns += 1;
      }

      if (
        booking.checkOutDate.toISOString().split('T')[0] ===
        new Date(validated.endDate).toISOString().split('T')[0]
      ) {
        data.checkOuts += 1;
      }

      const revenue = booking.payments.reduce((sum, p) => sum.plus(p.amount), new Decimal(0));
      data.revenue = (data.revenue as Decimal).plus(revenue);
    });

    const trends = Array.from(grouped.values()).map((data) =>
      bookingTrendSchema.parse({
        date: data.date,
        bookings: data.bookings,
        checkIns: data.checkIns,
        checkOuts: data.checkOuts,
        revenue: decimalToString(data.revenue),
      })
    );

    return trends;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to get booking trends');
  }
}

// ============================================================================
// ROOM PERFORMANCE
// ============================================================================

export async function getRoomPerformance(input: GetRoomPerformanceInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const validated = getRoomPerformanceSchema.parse(input);
    await checkOrganizationAccess(session.user.id, validated.organizationId);

    const rooms = await prisma.room.findMany({
      where: {
        propertyId: validated.propertyId,
      },
      include: {
        bookings: {
          where: {
            checkOutDate: {
              gte: validated.startDate,
              lte: validated.endDate,
            },
            status: { in: ['CHECKED_OUT', 'CHECKED_IN'] },
          },
          include: {
            payments: true,
          },
        },
      },
      take: validated.limit,
      orderBy: { name: 'asc' },
    });

    const daysDiff = Math.ceil(
      (validated.endDate.getTime() - validated.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return rooms.map((room) => {
      const totalRevenue = room.bookings.reduce(
        (sum, b) => sum.plus(b.payments.reduce((pSum, p) => pSum.plus(p.amount), new Decimal(0))),
        new Decimal(0)
      );

      const occupiedDays = room.bookings.reduce((sum, booking) => {
        const start = new Date(Math.max(booking.checkInDate.getTime(), validated.startDate.getTime()));
        const end = new Date(Math.min(booking.checkOutDate.getTime(), validated.endDate.getTime()));
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0);

      const occupancyRate = daysDiff > 0 ? (occupiedDays / daysDiff) * 100 : 0;
      const averageNightlyRate =
        room.bookings.length > 0 ? totalRevenue.dividedBy(room.bookings.length) : new Decimal(0);

      return roomPerformanceSchema.parse({
        roomId: room.id,
        roomNumber: room.roomNumber,
        roomName: room.name,
        occupancyRate: Math.round(occupancyRate * 100) / 100,
        revenue: decimalToString(totalRevenue),
        bookings: room.bookings.length,
        averageNightlyRate: decimalToString(averageNightlyRate),
      });
    });
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to get room performance');
  }
}

// ============================================================================
// GUEST METRICS
// ============================================================================

export async function getGuestMetrics(input: GetGuestMetricsInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const validated = getGuestMetricsSchema.parse(input);
    await checkOrganizationAccess(session.user.id, validated.organizationId);

    const propertyWhere = validated.propertyId
      ? { id: validated.propertyId, organizationId: validated.organizationId }
      : { organizationId: validated.organizationId };

    // Get unique guests with bookings in date range
    const bookings = await prisma.booking.findMany({
      where: {
        room: { property: propertyWhere },
        checkOutDate: {
          gte: validated.startDate,
          lte: validated.endDate,
        },
      },
      include: {
        guest: true,
      },
    });

    const uniqueGuestIds = new Set(bookings.map((b) => b.guestId));
    const totalGuests = uniqueGuestIds.size;

    // Get guests with multiple bookings (returning guests)
    const allGuestBookings = await prisma.booking.findMany({
      include: {
        guest: true,
      },
    });

    const guestBookingCounts = new Map<string, number>();
    allGuestBookings.forEach((b) => {
      guestBookingCounts.set(b.guestId, (guestBookingCounts.get(b.guestId) || 0) + 1);
    });

    let returningGuests = 0;
    uniqueGuestIds.forEach((id) => {
      if ((guestBookingCounts.get(id) || 0) > 1) {
        returningGuests += 1;
      }
    });

    const newGuests = totalGuests - returningGuests;

    // Calculate average stay length
    const averageStayLength =
      bookings.length > 0
        ? bookings.reduce((sum, b) => {
            const days = Math.ceil(
              (b.checkOutDate.getTime() - b.checkInDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            return sum + days;
          }, 0) / bookings.length
        : 0;

    return guestMetricSchema.parse({
      totalGuests,
      returningGuests,
      newGuests,
      averageStayLength: Math.round(averageStayLength * 100) / 100,
    });
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to get guest metrics');
  }
}

// ============================================================================
// DASHBOARD OVERVIEW
// ============================================================================

export async function getDashboardOverview(input: GetDashboardOverviewInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const validated = getDashboardOverviewSchema.parse(input);
    await checkOrganizationAccess(session.user.id, validated.organizationId);

    const { startDate, endDate } = getDateRange(validated.dateRange);

    // Fetch all metrics in parallel
    const [occupancy, revenue, arrivals, departures, outstandingBalances] = await Promise.all([
      getOccupancyMetrics({
        organizationId: validated.organizationId,
        propertyId: validated.propertyId,
        startDate,
        endDate,
      }),
      getRevenueMetrics({
        organizationId: validated.organizationId,
        propertyId: validated.propertyId,
        startDate,
        endDate,
      }),
      getArrivals({
        organizationId: validated.organizationId,
        propertyId: validated.propertyId,
        date: new Date(),
        limit: 5,
      }),
      getDepartures({
        organizationId: validated.organizationId,
        propertyId: validated.propertyId,
        date: new Date(),
        limit: 5,
      }),
      getOutstandingBalances({
        organizationId: validated.organizationId,
        propertyId: validated.propertyId,
        limit: 5,
      }),
    ]);

    // Generate alerts
    const alerts = [];

    if (occupancy.occupancyRate < 30) {
      alerts.push({
        type: 'warning' as const,
        message: `Low occupancy rate: ${occupancy.occupancyRate}%`,
        action: 'view_bookings',
      });
    }

    if (outstandingBalances.length > 0) {
      const totalOverdue = outstandingBalances
        .reduce((sum, b) => sum + Number(b.balance), 0);
      alerts.push({
        type: 'error' as const,
        message: `$${totalOverdue.toFixed(2)} outstanding from ${outstandingBalances.length} bookings`,
        action: 'view_payments',
      });
    }

    if (arrivals.length === 0) {
      alerts.push({
        type: 'info' as const,
        message: 'No arrivals scheduled for today',
      });
    }

    return dashboardOverviewSchema.parse({
      occupancy,
      revenue,
      arrivals,
      departures,
      outstandingBalances,
      alerts,
    });
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to get dashboard overview');
  }
}
