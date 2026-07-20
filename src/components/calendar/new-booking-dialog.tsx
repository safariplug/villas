'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';
import { createBooking, checkRoomAvailability } from '@/app/actions/calendar';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';

const createBookingSchema = z.object({
  roomId: z.string().cuid('Please select a room'),
  guestId: z.string().cuid('Please select a guest'),
  checkInDate: z.string().min(1, 'Check-in date is required'),
  checkOutDate: z.string().min(1, 'Check-out date is required'),
  numberOfGuests: z.number().int().positive('Number of guests must be positive'),
  notes: z.string().optional(),
}).refine(
  (data) => new Date(data.checkOutDate) > new Date(data.checkInDate),
  {
    message: 'Check-out date must be after check-in date',
    path: ['checkOutDate'],
  }
);

type CreateBookingInput = z.infer<typeof createBookingSchema>;

interface NewBookingDialogProps {
  isOpen: boolean;
  organizationId: string;
  propertyId: string;
  roomId?: string;
  startDate?: Date;
  endDate?: Date;
  onClose: () => void;
  onBookingCreated: () => void;
  rooms: Array<{ id: string; name: string; roomNumber: string }>;
  guests: Array<{ id: string; firstName: string; lastName: string; email: string }>;
}

export function NewBookingDialog({
  isOpen,
  organizationId,
  propertyId,
  roomId,
  startDate,
  endDate,
  onClose,
  onBookingCreated,
  rooms,
  guests,
}: NewBookingDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  const form = useForm<CreateBookingInput>({
    resolver: zodResolver(createBookingSchema),
    defaultValues: {
      roomId: roomId || '',
      guestId: '',
      checkInDate: startDate ? format(startDate, 'yyyy-MM-dd') : '',
      checkOutDate: endDate ? format(endDate, 'yyyy-MM-dd') : '',
      numberOfGuests: 1,
      notes: '',
    },
  });

  // Update form when roomId or dates change
  useEffect(() => {
    if (isOpen) {
      form.reset({
        roomId: roomId || '',
        guestId: '',
        checkInDate: startDate ? format(startDate, 'yyyy-MM-dd') : '',
        checkOutDate: endDate ? format(endDate, 'yyyy-MM-dd') : '',
        numberOfGuests: 1,
        notes: '',
      });
    }
  }, [isOpen, roomId, startDate, endDate]);

  // Check availability when dates change
  useEffect(() => {
    const checkAvailability = async () => {
      const roomIdValue = form.getValues('roomId');
      const checkInDateValue = form.getValues('checkInDate');
      const checkOutDateValue = form.getValues('checkOutDate');

      if (!roomIdValue || !checkInDateValue || !checkOutDateValue) {
        setAvailabilityError(null);
        return;
      }

      try {
        const result = await checkRoomAvailability(
          roomIdValue,
          new Date(checkInDateValue),
          new Date(checkOutDateValue),
          organizationId
        );

        if (!result.available) {
          setAvailabilityError(`Room is booked for ${result.conflicts} day(s) in this period`);
        } else {
          setAvailabilityError(null);
        }
      } catch (err) {
        // Silently ignore availability check errors during form interaction
      }
    };

    const timer = setTimeout(checkAvailability, 500);
    return () => clearTimeout(timer);
  }, [form.watch('roomId'), form.watch('checkInDate'), form.watch('checkOutDate')]);

  async function onSubmit(data: CreateBookingInput) {
    try {
      setLoading(true);
      setError(null);
      setAvailabilityError(null);

      // Final availability check before submission
      const available = await checkRoomAvailability(
        data.roomId,
        new Date(data.checkInDate),
        new Date(data.checkOutDate),
        organizationId
      );

      if (!available.available) {
        setAvailabilityError('Room is no longer available for these dates');
        setLoading(false);
        return;
      }

      // Create booking
      await createBooking({
        organizationId,
        propertyId,
        roomId: data.roomId,
        guestId: data.guestId,
        checkInDate: new Date(data.checkInDate),
        checkOutDate: new Date(data.checkOutDate),
        numberOfGuests: data.numberOfGuests,
        notes: data.notes,
      });

      onBookingCreated();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    form.reset();
    setError(null);
    setAvailabilityError(null);
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Booking</DialogTitle>
          <DialogDescription>
            Fill in the booking details to create a new reservation
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {availabilityError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{availabilityError}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Room Selection */}
            <FormField
              control={form.control}
              name="roomId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a room" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {rooms.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.roomNumber} - {room.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Guest Selection */}
            <FormField
              control={form.control}
              name="guestId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Guest</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a guest" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {guests.map((guest) => (
                        <SelectItem key={guest.id} value={guest.id}>
                          {guest.firstName} {guest.lastName} ({guest.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select an existing guest or create a new one
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Check-in Date */}
            <FormField
              control={form.control}
              name="checkInDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Check-in Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Check-out Date */}
            <FormField
              control={form.control}
              name="checkOutDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Check-out Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Number of Guests */}
            <FormField
              control={form.control}
              name="numberOfGuests"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Guests</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any special requests or notes..."
                      {...field}
                      disabled={loading}
                      rows={4}
                    />
                  </FormControl>
                  <FormDescription>
                    Internal notes about this booking
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={form.handleSubmit(onSubmit)}
            disabled={loading || !!availabilityError}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
