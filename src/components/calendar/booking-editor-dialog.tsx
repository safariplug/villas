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
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, AlertCircle } from 'lucide-react';
import { getBookingDetails, updateBookingStatus, updateBookingDates, deleteBooking } from '@/app/actions/calendar';
import { STATUS_COLORS } from '@/lib/validations/calendar';
import { format } from 'date-fns';

const editBookingSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW']),
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

type EditBookingInput = z.infer<typeof editBookingSchema>;

interface BookingEditorDialogProps {
  isOpen: boolean;
  bookingId: string | null;
  organizationId: string;
  propertyId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function BookingEditorDialog({
  isOpen,
  bookingId,
  organizationId,
  propertyId,
  onClose,
  onUpdate,
}: BookingEditorDialogProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<any | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(false);

  const form = useForm<EditBookingInput>({
    resolver: zodResolver(editBookingSchema),
    defaultValues: {
      status: 'PENDING',
      checkInDate: '',
      checkOutDate: '',
      numberOfGuests: 1,
      notes: '',
    },
  });

  // Fetch booking details when dialog opens
  useEffect(() => {
    if (isOpen && bookingId) {
      loadBooking();
    }
  }, [isOpen, bookingId]);

  async function loadBooking() {
    try {
      setLoadingBooking(true);
      setError(null);
      const data = await getBookingDetails(bookingId!, organizationId);
      setBooking(data);

      form.reset({
        status: data.status,
        checkInDate: format(new Date(data.checkInDate), 'yyyy-MM-dd'),
        checkOutDate: format(new Date(data.checkOutDate), 'yyyy-MM-dd'),
        numberOfGuests: data.numberOfGuests,
        notes: data.notes || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load booking');
    } finally {
      setLoadingBooking(false);
    }
  }

  async function onSubmit(data: EditBookingInput) {
    try {
      setLoading(true);
      setError(null);

      const checkInDate = new Date(data.checkInDate);
      const checkOutDate = new Date(data.checkOutDate);

      // Update dates if changed
      if (
        booking.checkInDate.toDateString() !== checkInDate.toDateString() ||
        booking.checkOutDate.toDateString() !== checkOutDate.toDateString()
      ) {
        await updateBookingDates({
          organizationId,
          bookingId: bookingId!,
          checkInDate,
          checkOutDate,
        });
      }

      // Update status if changed
      if (booking.status !== data.status) {
        await updateBookingStatus({
          organizationId,
          bookingId: bookingId!,
          status: data.status,
        });
      }

      onUpdate();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update booking');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this booking?')) {
      return;
    }

    try {
      setDeleting(true);
      setError(null);
      await deleteBooking(bookingId!, organizationId);
      onUpdate();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete booking');
    } finally {
      setDeleting(false);
    }
  }

  function handleClose() {
    form.reset();
    setBooking(null);
    setError(null);
    onClose();
  }

  if (!booking && isOpen) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Loading Booking...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Booking</DialogTitle>
          <DialogDescription>
            Update booking details and status
          </DialogDescription>
        </DialogHeader>

        {loadingBooking ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : booking ? (
          <>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Guest Information */}
            <div className="grid gap-4 bg-gray-50 p-4 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-600">Guest Name</p>
                <p className="text-lg font-semibold">
                  {booking.guest
                    ? `${booking.guest.firstName} ${booking.guest.lastName}`
                    : 'Unassigned'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Guest Email</p>
                  <p className="text-sm">{booking.guest?.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Guest Phone</p>
                  <p className="text-sm">{booking.guest?.phone || 'N/A'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Room</p>
                  <p className="text-sm font-medium">{booking.room.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Current Status</p>
                  <Badge className="mt-1" variant={booking.status === 'CANCELLED' ? 'destructive' : 'default'}>
                    {booking.status}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Status */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                          <SelectItem value="CHECKED_IN">Checked In</SelectItem>
                          <SelectItem value="CHECKED_OUT">Checked Out</SelectItem>
                          <SelectItem value="NO_SHOW">No Show</SelectItem>
                          <SelectItem value="CANCELLED">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
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
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add any booking notes..."
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

            {/* Footer */}
            <DialogFooter className="flex items-center justify-between">
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading || deleting}
              >
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete Booking
              </Button>
              <div className="flex gap-2">
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
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
