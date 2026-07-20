'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import {
  GetCalendarEventsInput,
  UpdateBookingDatesInput,
  CreateBookingInput,
  UpdateBookingStatusInput,
  getCalendarEventsSchema,
  updateBookingDatesSchema,
  createBookingSchema,
  updateBookingStatusSchema,
  calendarEventSchema,
  calendarResourceSchema,
  STATUS_COLORS,
  CalendarEvent,
  CalendarResource,
} from '@/lib/validations/calendar';
import { checkOrganizationAccess } from '@/lib/auth/permissions';
import { BookingStatus } from '@prisma/client';

// ============================================================================
// GET CALENDAR EVENTS AND RESOURCES
// ============================================================================

export async function getCalendarEvents(input: GetCalendarEventsInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const validated = getCalendarEventsSchema.parse(input);
    await checkOrganizationAccess(session.user.id, validated.organizationId);

    // Get all rooms (resources)
    const rooms = await prisma.room.findMany({
      where: {
        property: {
          id: validated.propertyId,
          organizationId: validated.organizationId,
        },
      },
      orderBy: { roomNumber: 'asc' },
    });

    // Get all bookings for the date range
    const bookings = await prisma.booking.findMany({
      where: {
        room: {
          property: {
            id: validated.propertyId,
            organizationId: validated.organizationId,
          },
        },
        OR: [
          {
            checkInDate: {
              lte: validated.endDate,
            },
            checkOutDate: {
              gte: validated.startDate,
            },
          },
        ],
        status: {
          not: 'CANCELLED' as BookingStatus,
        },
      },
      include: {
        guest: true,
        room: true,
      },
    });

    // Transform resources
    const resources: CalendarResource[] = rooms.map((room) =>
      calendarResourceSchema.parse({
        id: room.id,
        title: `${room.roomNumber} - ${room.name}`,
        extendedProps: {
          roomNumber: room.roomNumber,
          capacity: room.capacity,
          type: room.type,
          status: room.status,
        },
      })
    );

    // Transform events
    const events: CalendarEvent[] = bookings.map((booking) => {
      const statusColors = STATUS_COLORS[booking.status as keyof typeof STATUS_COLORS];
      return calendarEventSchema.parse({
        id: booking.id,
        title: booking.guest
          ? `${booking.guest.firstName} ${booking.guest.lastName}`
          : 'Unassigned',
        start: booking.checkInDate,
        end: booking.checkOutDate,
        resourceId: booking.roomId,
        backgroundColor: statusColors.bg,
        borderColor: statusColors.border,
        extendedProps: {
          bookingId: booking.id,
          guestName: booking.guest
            ? `${booking.guest.firstName} ${booking.guest.lastName}`
            : 'Unassigned',
          guestEmail: booking.guest?.email || '',
          roomName: booking.room.name,
          status: booking.status,
          numberOfGuests: booking.numberOfGuests,
          notes: booking.notes || undefined,
        },
      });
    });

    return {
      resources,
      events,
    };
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to get calendar events');
  }
}

// ============================================================================
// UPDATE BOOKING DATES (Drag and Drop / Resize)
// ============================================================================

export async function updateBookingDates(input: UpdateBookingDatesInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const validated = updateBookingDatesSchema.parse(input);
    await checkOrganizationAccess(session.user.id, validated.organizationId);

    // Get the booking
    const booking = await prisma.booking.findUnique({
      where: { id: validated.bookingId },
      include: { room: { include: { property: true } } },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.room.property.organizationId !== validated.organizationId) {
      throw new Error('Unauthorized');
    }

    // Check for overlapping bookings
    const overlappingBookings = await prisma.booking.findMany({
      where: {
        roomId: booking.roomId,
        id: { not: validated.bookingId },
        status: { not: 'CANCELLED' as BookingStatus },
        OR: [
          {
            checkInDate: { lt: validated.checkOutDate },
            checkOutDate: { gt: validated.checkInDate },
          },
        ],
      },
    });

    if (overlappingBookings.length > 0) {
      throw new Error('Booking overlaps with another reservation');
    }

    // Update the booking
    const updated = await prisma.booking.update({
      where: { id: validated.bookingId },
      data: {
        checkInDate: validated.checkInDate,
        checkOutDate: validated.checkOutDate,
        updatedAt: new Date(),
      },
      include: {
        guest: true,
        room: true,
      },
    });

    return updated;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to update booking dates');
  }
}

// ============================================================================
// CREATE BOOKING
// ============================================================================

export async function createBooking(input: CreateBookingInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const validated = createBookingSchema.parse(input);
    await checkOrganizationAccess(session.user.id, validated.organizationId);

    // Verify property and room access
    const room = await prisma.room.findUnique({
      where: { id: validated.roomId },
      include: {
        property: true,
      },
    });

    if (!room || room.property.organizationId !== validated.organizationId) {
      throw new Error('Room not found or access denied');
    }

    // Check for overlapping bookings
    const overlappingBookings = await prisma.booking.findMany({
      where: {
        roomId: validated.roomId,
        status: { not: 'CANCELLED' as BookingStatus },
        OR: [
          {
            checkInDate: { lt: validated.checkOutDate },
            checkOutDate: { gt: validated.checkInDate },
          },
        ],
      },
    });

    if (overlappingBookings.length > 0) {
      throw new Error('Room is already booked for this date range');
    }

    // Create or get guest
    let guestId = validated.guestId;
    if (!guestId) {
      throw new Error('Guest ID is required');
    }

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        guestId,
        roomId: validated.roomId,
        checkInDate: validated.checkInDate,
        checkOutDate: validated.checkOutDate,
        numberOfGuests: validated.numberOfGuests,
        notes: validated.notes,
        status: 'PENDING' as BookingStatus,
      },
      include: {
        guest: true,
        room: true,
      },
    });

    return booking;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to create booking');
  }
}

// ============================================================================
// UPDATE BOOKING STATUS
// ============================================================================

export async function updateBookingStatus(input: UpdateBookingStatusInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const validated = updateBookingStatusSchema.parse(input);
    await checkOrganizationAccess(session.user.id, validated.organizationId);

    // Get the booking and verify access
    const booking = await prisma.booking.findUnique({
      where: { id: validated.bookingId },
      include: { room: { include: { property: true } } },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.room.property.organizationId !== validated.organizationId) {
      throw new Error('Unauthorized');
    }

    // Update status
    const updated = await prisma.booking.update({
      where: { id: validated.bookingId },
      data: {
        status: validated.status as BookingStatus,
        updatedAt: new Date(),
      },
      include: {
        guest: true,
        room: true,
      },
    });

    return updated;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to update booking status');
  }
}

// ============================================================================
// GET BOOKING DETAILS
// ============================================================================

export async function getBookingDetails(bookingId: string, organizationId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    await checkOrganizationAccess(session.user.id, organizationId);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        guest: true,
        room: {
          include: {
            property: true,
          },
        },
        payments: true,
      },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.room.property.organizationId !== organizationId) {
      throw new Error('Unauthorized');
    }

    return booking;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to get booking details');
  }
}

// ============================================================================
// DELETE BOOKING
// ============================================================================

export async function deleteBooking(bookingId: string, organizationId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    await checkOrganizationAccess(session.user.id, organizationId);

    // Get the booking to verify access
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { room: { include: { property: true } } },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.room.property.organizationId !== organizationId) {
      throw new Error('Unauthorized');
    }

    // Delete the booking
    await prisma.booking.delete({
      where: { id: bookingId },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to delete booking');
  }
}

// ============================================================================
// CHECK ROOM AVAILABILITY
// ============================================================================

export async function checkRoomAvailability(
  roomId: string,
  checkInDate: Date,
  checkOutDate: Date,
  organizationId: string,
  excludeBookingId?: string
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    await checkOrganizationAccess(session.user.id, organizationId);

    // Verify room access
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { property: true },
    });

    if (!room || room.property.organizationId !== organizationId) {
      throw new Error('Room not found or access denied');
    }

    // Check for overlapping bookings
    const query: any = {
      roomId,
      status: { not: 'CANCELLED' as BookingStatus },
      OR: [
        {
          checkInDate: { lt: checkOutDate },
          checkOutDate: { gt: checkInDate },
        },
      ],
    };

    if (excludeBookingId) {
      query.id = { not: excludeBookingId };
    }

    const conflicts = await prisma.booking.findMany({ where: query });

    return {
      available: conflicts.length === 0,
      conflicts: conflicts.length,
    };
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to check room availability');
  }
}
