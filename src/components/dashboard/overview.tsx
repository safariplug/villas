'use client';

import { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingUp,
  Users,
  DollarSign,
  Home,
  Calendar,
  LogOut,
} from 'lucide-react';
import { getDashboardOverview } from '@/app/actions/dashboard';
import { DashboardOverview as IDashboardOverview } from '@/lib/validations/dashboard';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardProps {
  organizationId: string;
  propertyId?: string;
}

const ALERT_ICONS = {
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
};

const ALERT_COLORS = {
  warning: 'border-yellow-500 bg-yellow-50',
  error: 'border-red-500 bg-red-50',
  info: 'border-blue-500 bg-blue-50',
};

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  CHECKED_IN: 'bg-green-100 text-green-800',
  CHECKED_OUT: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
  NO_SHOW: 'bg-orange-100 text-orange-800',
};

const PAYMENT_STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PARTIALLY_PAID: 'bg-orange-100 text-orange-800',
};

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function DashboardOverviewComponent({ organizationId, propertyId }: DashboardProps) {
  const [data, setData] = useState<IDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'quarter' | 'year'>('month');

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);
        const result = await getDashboardOverview({
          organizationId,
          propertyId,
          dateRange,
        });
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [organizationId, propertyId, dateRange]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Property metrics and booking overview
          </p>
        </div>
        <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last 7 Days</SelectItem>
            <SelectItem value="month">Last 30 Days</SelectItem>
            <SelectItem value="quarter">Last 90 Days</SelectItem>
            <SelectItem value="year">Last Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerts */}
      {data.alerts && data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert, idx) => {
            const IconComponent = ALERT_ICONS[alert.type];
            return (
              <Alert key={idx} className={ALERT_COLORS[alert.type]}>
                <IconComponent className="h-4 w-4" />
                <AlertTitle>{alert.type.charAt(0).toUpperCase() + alert.type.slice(1)}</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                  <span>{alert.message}</span>
                  {alert.action && (
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            );
          })}
        </div>
      )}

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Occupancy */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
            <Home className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.occupancy.occupancyRate}%</div>
            <p className="text-xs text-gray-500 mt-1">
              {data.occupancy.occupiedRooms} of {data.occupancy.totalRooms} rooms occupied
            </p>
          </CardContent>
        </Card>

        {/* Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${data.revenue.totalRevenue}</div>
            <p className="text-xs text-gray-500 mt-1">
              Paid: ${data.revenue.paidRevenue}
            </p>
          </CardContent>
        </Card>

        {/* Guest Count */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Arrivals Today</CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.arrivals.length}</div>
            <p className="text-xs text-gray-500 mt-1">
              Guests checking in today
            </p>
          </CardContent>
        </Card>

        {/* Departures */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Departures Today</CardTitle>
            <LogOut className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.departures.length}</div>
            <p className="text-xs text-gray-500 mt-1">
              Guests checking out today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Arrivals and Departures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Arrivals Table */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Arrivals</CardTitle>
            <CardDescription>Guests checking in today</CardDescription>
          </CardHeader>
          <CardContent>
            {data.arrivals.length === 0 ? (
              <p className="text-sm text-gray-500">No arrivals scheduled for today</p>
            ) : (
              <div className="space-y-4">
                {data.arrivals.map((arrival) => (
                  <div key={arrival.bookingId} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{arrival.guestName}</p>
                        <p className="text-sm text-gray-500">{arrival.roomName}</p>
                      </div>
                      <Badge className={STATUS_COLORS[arrival.status]}>
                        {arrival.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      {arrival.numberOfGuests} {arrival.numberOfGuests === 1 ? 'guest' : 'guests'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Departures Table */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Departures</CardTitle>
            <CardDescription>Guests checking out today</CardDescription>
          </CardHeader>
          <CardContent>
            {data.departures.length === 0 ? (
              <p className="text-sm text-gray-500">No departures scheduled for today</p>
            ) : (
              <div className="space-y-4">
                {data.departures.map((departure) => (
                  <div key={departure.bookingId} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{departure.guestName}</p>
                        <p className="text-sm text-gray-500">{departure.roomName}</p>
                      </div>
                      <Badge variant="outline">{departure.totalDays} nights</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Outstanding Balances */}
      {data.outstandingBalances.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Outstanding Balances</CardTitle>
            <CardDescription>Bookings with unpaid amounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest Name</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Days Overdue</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.outstandingBalances.map((balance) => (
                    <TableRow key={balance.bookingId}>
                      <TableCell className="font-medium">
                        {balance.guestName}
                      </TableCell>
                      <TableCell>{balance.roomName}</TableCell>
                      <TableCell>${balance.balance}</TableCell>
                      <TableCell>
                        <Badge
                          variant={balance.daysOverdue > 0 ? 'destructive' : 'outline'}
                        >
                          {balance.daysOverdue} days
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={PAYMENT_STATUS_COLORS[balance.status as keyof typeof PAYMENT_STATUS_COLORS]}>
                          {balance.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(3)].map((_, j) => (
                  <Skeleton key={j} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
