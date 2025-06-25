"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ChartTooltip } from "@/components/ui/chart";
import {
  Users,
  Download,
  Settings,
  Mail,
  RefreshCw,
  Edit,
  Trash2,
  Plus,
  Send,
  Database,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Clock,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  usersAPI,
  marketsAPI,
  transactionsAPI,
  emailsAPI,
  adminAPI,
  // type RecurrenceConfig,
  type ScheduleFormData,
  type User,
  type Market,
  type Transaction,
  type DashboardStats,
} from "./lib/api";

type SortField =
  | "name"
  | "points"
  | "accuracy"
  | "predictions"
  | "joinDate"
  | "lastActive";
type SortDirection = "asc" | "desc";
type TransactionSortField =
  | "userName"
  | "action"
  | "market"
  | "points"
  | "timestamp";

export default function AdminDashboard() {
  // State
  const [users, setUsers] = useState<User[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(
    null
  );
  // const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScheduling, setIsScheduling] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormData>({
    title: "",
    // markets: [],
    isActive: true,
    recurrence: {
      frequency: "daily",
      timeOfDay: "09:00",
    },
  });

  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);

  // Pagination and sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(10);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionsPerPage] = useState(10);
  const [userSortField, setUserSortField] = useState<SortField>("name");
  const [userSortDirection, setUserSortDirection] =
    useState<SortDirection>("asc");
  const [transactionSortField, setTransactionSortField] =
    useState<TransactionSortField>("timestamp");
  const [transactionSortDirection, setTransactionSortDirection] =
    useState<SortDirection>("desc");
  const [selectedMarketId, setSelectedMarketId] = useState<string>("");

  // New market form
  const [newMarket, setNewMarket] = useState({
    title: "",
    description: "",
    deadline: "",
    tags: "",
  });

  // Load initial data
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError("");

      const [statsResult, usersResult, marketsResult, transactionsResult] =
        await Promise.all([
          adminAPI.getDashboardStats(),
          usersAPI.getUsers(
            currentPage,
            usersPerPage,
            userSortField,
            userSortDirection
          ),
          marketsAPI.getMarkets("active"),
          transactionsAPI.getTransactions(
            transactionPage,
            transactionsPerPage,
            transactionSortField,
            transactionSortDirection
          ),
        ]);

      setDashboardStats(statsResult);
      setUsers(usersResult.users);
      setMarkets(marketsResult.markets);
      setTransactions(transactionsResult.transactions);

      if (marketsResult.markets.length > 0 && !selectedMarketId) {
        setSelectedMarketId(marketsResult.markets[0]._id);
      }
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard data"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserSort = (field: SortField) => {
    if (userSortField === field) {
      setUserSortDirection(userSortDirection === "asc" ? "desc" : "asc");
    } else {
      setUserSortField(field);
      setUserSortDirection("asc");
    }
    setCurrentPage(1);
    loadDashboardData();
  };

  const handleTransactionSort = (field: TransactionSortField) => {
    if (transactionSortField === field) {
      setTransactionSortDirection(
        transactionSortDirection === "asc" ? "desc" : "asc"
      );
    } else {
      setTransactionSortField(field);
      setTransactionSortDirection("asc");
    }
    setTransactionPage(1);
    loadDashboardData();
  };

  const getSortIcon = (field: SortField) => {
    if (userSortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return userSortDirection === "asc" ? (
      <ArrowUp className="w-4 h-4" />
    ) : (
      <ArrowDown className="w-4 h-4" />
    );
  };

  const getTransactionSortIcon = (field: TransactionSortField) => {
    if (transactionSortField !== field)
      return <ArrowUpDown className="w-4 h-4" />;
    return transactionSortDirection === "asc" ? (
      <ArrowUp className="w-4 h-4" />
    ) : (
      <ArrowDown className="w-4 h-4" />
    );
  };

  const exportUserData = async () => {
    try {
      await adminAPI.exportUsers();
      setSuccess("User data exported successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  };

  const exportTransactionData = async () => {
    try {
      await adminAPI.exportTransactions();
      setSuccess("Transaction data exported successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  };

  const sendMarketCycle = async () => {
    try {
      setIsScheduling(true);
      setError("");

      const result = await emailsAPI.sendMarketCycle();
      setSuccess(
        `Market cycle emails sent to ${result.emailCycle.totalRecipients} participants!`
      );

      // Refresh dashboard stats
      const stats = await adminAPI.getDashboardStats();
      setDashboardStats(stats);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send market cycle"
      );
    } finally {
      setIsScheduling(false);
    }
  };

  const createMarket = async () => {
    try {
      setError("");

      if (!newMarket.title || !newMarket.deadline) {
        setError("Title and deadline are required");
        return;
      }

      const marketData = {
        title: newMarket.title,
        description: newMarket.description,
        deadline: newMarket.deadline,
        tags: newMarket.tags
          ? newMarket.tags.split(",").map((tag) => tag.trim())
          : [],
      };

      await marketsAPI.createMarket(marketData);
      setSuccess("Market created successfully!");
      setNewMarket({ title: "", description: "", deadline: "", tags: "" });

      // Refresh markets
      const marketsResult = await marketsAPI.getMarkets("active");
      setMarkets(marketsResult.markets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create market");
    }
  };

  const deleteMarket = async (marketId: string) => {
    try {
      setError("");
      await marketsAPI.deleteMarket(marketId);
      setSuccess("Market deleted successfully!");

      // Refresh markets
      const marketsResult = await marketsAPI.getMarkets("active");
      setMarkets(marketsResult.markets);

      if (selectedMarketId === marketId && marketsResult.markets.length > 0) {
        setSelectedMarketId(marketsResult.markets[0]._id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete market");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const selectedMarket = markets.find(
    (market) => market._id === selectedMarketId
  );

  const createEmailSchedule = async () => {
    console.log(scheduleForm);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/emails/schedule`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(scheduleForm),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(
          "Failed to create schedule:",
          data.error || response.statusText
        );
        alert("Failed to create schedule: " + (data.error || "Unknown error"));
        return;
      }

      alert("Schedule created successfully!");
      setIsScheduleDialogOpen(false);
      // Optionally: reset the form here
      // setScheduleForm({ ... });
    } catch (error) {
      console.error("Error creating schedule:", error);
      alert("Error creating schedule. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Admin Dashboard
            </h1>
            <p className="text-gray-600">
              Prediction Market Research Management
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge
              variant="outline"
              className="text-green-600 border-green-600"
            >
              {dashboardStats?.users.active || 0} Active Participants
            </Badge>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Alerts */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <AlertDescription className="text-green-800">
              {success}
            </AlertDescription>
          </Alert>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Dialog
            open={isScheduleDialogOpen}
            onOpenChange={setIsScheduleDialogOpen}
          >
            <DialogTrigger asChild>
              <Button variant="outline" className="h-20 flex-col">
                <Clock className="w-6 h-6 mb-2" />
                Schedule Emails
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Schedule Email Cycles</DialogTitle>
                <DialogDescription>
                  Set up automatic email sending for market cycles
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="schedule-title">Schedule Title</Label>
                  <Input
                    id="schedule-title"
                    placeholder="Daily Market Updates"
                    value={scheduleForm.title}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        title: e.target.value,
                      })
                    }
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select
                    value={scheduleForm.recurrence.frequency}
                    onValueChange={(value: any) =>
                      setScheduleForm({
                        ...scheduleForm,
                        recurrence: {
                          ...scheduleForm.recurrence,
                          frequency: value,
                        },
                      })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={scheduleForm.recurrence.timeOfDay}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        recurrence: {
                          ...scheduleForm.recurrence,
                          timeOfDay: e.target.value,
                        },
                      })
                    }
                    className="mt-1"
                  />
                </div>

                {scheduleForm.recurrence.frequency === "weekly" && (
                  <div>
                    <Label htmlFor="day-of-week">Day of Week</Label>
                    <Select
                      value={
                        scheduleForm.recurrence.dayOfWeek?.toString() || "1"
                      }
                      onValueChange={(value) =>
                        setScheduleForm({
                          ...scheduleForm,
                          recurrence: {
                            ...scheduleForm.recurrence,
                            dayOfWeek: parseInt(value),
                          },
                        })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Sunday</SelectItem>
                        <SelectItem value="1">Monday</SelectItem>
                        <SelectItem value="2">Tuesday</SelectItem>
                        <SelectItem value="3">Wednesday</SelectItem>
                        <SelectItem value="4">Thursday</SelectItem>
                        <SelectItem value="5">Friday</SelectItem>
                        <SelectItem value="6">Saturday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {scheduleForm.recurrence.frequency === "monthly" && (
                  <div>
                    <Label htmlFor="day-of-month">Day of Month</Label>
                    <Input
                      id="day-of-month"
                      type="number"
                      min="1"
                      max="31"
                      value={scheduleForm.recurrence.dayOfMonth || 1}
                      onChange={(e) =>
                        setScheduleForm({
                          ...scheduleForm,
                          recurrence: {
                            ...scheduleForm.recurrence,
                            dayOfMonth: parseInt(e.target.value),
                          },
                        })
                      }
                      className="mt-1"
                    />
                  </div>
                )}

                {scheduleForm.recurrence.frequency === "custom" && (
                  <div>
                    <Label htmlFor="custom-cron">Cron Expression</Label>
                    <Input
                      id="custom-cron"
                      placeholder="0 9 * * 1-5"
                      value={scheduleForm.recurrence.customCron || ""}
                      onChange={(e) =>
                        setScheduleForm({
                          ...scheduleForm,
                          recurrence: {
                            ...scheduleForm.recurrence,
                            customCron: e.target.value,
                          },
                        })
                      }
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Format: minute hour day month day-of-week
                    </p>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is-active"
                    checked={scheduleForm.isActive}
                    onCheckedChange={(checked) =>
                      setScheduleForm({ ...scheduleForm, isActive: checked })
                    }
                  />
                  <Label htmlFor="is-active">Start immediately</Label>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsScheduleDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={createEmailSchedule}>Create Schedule</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            onClick={sendMarketCycle}
            disabled={isScheduling}
            className="h-20 flex-col"
          >
            {isScheduling ? (
              <RefreshCw className="w-6 h-6 mb-2 animate-spin" />
            ) : (
              <Send className="w-6 h-6 mb-2" />
            )}
            {isScheduling ? "Sending..." : "Send Market Cycle"}
          </Button>
          <Button
            variant="outline"
            onClick={exportUserData}
            className="h-20 flex-col"
          >
            <Download className="w-6 h-6 mb-2" />
            Export Users
          </Button>
          <Button
            variant="outline"
            onClick={exportTransactionData}
            className="h-20 flex-col"
          >
            <Activity className="w-6 h-6 mb-2" />
            Export Transactions
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-20 flex-col">
                <Plus className="w-6 h-6 mb-2" />
                New Market
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Market</DialogTitle>
                <DialogDescription>
                  Add a new prediction market for participants
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="market-title">Market Question</Label>
                  <Textarea
                    id="market-title"
                    placeholder="Will [event] happen by [date]?"
                    value={newMarket.title}
                    onChange={(e) =>
                      setNewMarket({ ...newMarket, title: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="market-description">
                    Description (Optional)
                  </Label>
                  <Textarea
                    id="market-description"
                    placeholder="Additional context..."
                    value={newMarket.description}
                    onChange={(e) =>
                      setNewMarket({
                        ...newMarket,
                        description: e.target.value,
                      })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="deadline">Deadline</Label>
                  <Input
                    id="deadline"
                    type="datetime-local"
                    value={newMarket.deadline}
                    onChange={(e) =>
                      setNewMarket({ ...newMarket, deadline: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    placeholder="economics, politics, technology"
                    value={newMarket.tags}
                    onChange={(e) =>
                      setNewMarket({ ...newMarket, tags: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline">Cancel</Button>
                  <Button onClick={createMarket}>Create Market</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Market Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Database className="w-5 h-5 mr-2" />
                  Market Management
                </CardTitle>
                <CardDescription>
                  Manage active prediction markets
                </CardDescription>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Label
                    htmlFor="market-select"
                    className="text-sm font-medium"
                  >
                    Select Market:
                  </Label>
                  <Select
                    value={selectedMarketId}
                    onValueChange={setSelectedMarketId}
                  >
                    <SelectTrigger className="w-[300px]">
                      <SelectValue placeholder="Choose a market" />
                    </SelectTrigger>
                    <SelectContent>
                      {markets.map((market) => (
                        <SelectItem key={market._id} value={market._id}>
                          {market.title.length > 50
                            ? `${market.title.substring(0, 50)}...`
                            : market.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {selectedMarket ? (
              <div className="border rounded-lg p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Market Info */}
                  <div>
                    <h3 className="font-semibold text-lg mb-4">
                      {selectedMarket.title}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label className="text-sm text-gray-600">
                          Current Probability
                        </Label>
                        <div className="text-2xl font-bold text-indigo-600">
                          {selectedMarket.currentProbability}%
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-gray-600">
                          Total Volume
                        </Label>
                        <div className="text-lg font-semibold">
                          {selectedMarket.totalVolume}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-gray-600">
                          Participants
                        </Label>
                        <div className="text-lg font-semibold">
                          {selectedMarket.participantCount}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-gray-600">
                          Deadline
                        </Label>
                        <div className="text-lg font-semibold">
                          {new Date(
                            selectedMarket.deadline
                          ).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm">
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600"
                        onClick={() => deleteMarket(selectedMarket._id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  {/* Probability History Graph */}
                  <div className="min-w-0">
                    <Label className="text-sm text-gray-600 mb-2 block">
                      Probability History
                    </Label>
                    <div className="w-full h-[250px] border rounded-lg p-4 bg-white">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={selectedMarket.probabilityHistory}
                          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#e0e0e0"
                          />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(value) =>
                              new Date(value).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            }
                            fontSize={12}
                            stroke="#666"
                          />
                          <YAxis
                            domain={[0, 100]}
                            fontSize={12}
                            stroke="#666"
                          />
                          <ChartTooltip
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-white p-2 border rounded shadow">
                                    <p className="text-sm">{`Date: ${new Date(
                                      label
                                    ).toLocaleDateString()}`}</p>
                                    <p className="text-sm font-semibold text-indigo-600">{`Probability: ${payload[0].value}%`}</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="probability"
                            stroke="#4f46e5"
                            strokeWidth={3}
                            dot={{ fill: "#4f46e5", strokeWidth: 2, r: 4 }}
                            activeDot={{
                              r: 6,
                              stroke: "#4f46e5",
                              strokeWidth: 2,
                              fill: "#fff",
                            }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No markets available. Create a new market to get started.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction Monitoring */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Transaction Monitoring
            </CardTitle>
            <CardDescription>
              Track all participant trading activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleTransactionSort("userName")}
                      className="h-auto p-0 font-semibold"
                    >
                      Participant {getTransactionSortIcon("userName")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleTransactionSort("action")}
                      className="h-auto p-0 font-semibold"
                    >
                      Action {getTransactionSortIcon("action")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleTransactionSort("market")}
                      className="h-auto p-0 font-semibold"
                    >
                      Market {getTransactionSortIcon("market")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleTransactionSort("points")}
                      className="h-auto p-0 font-semibold"
                    >
                      Points {getTransactionSortIcon("points")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleTransactionSort("timestamp")}
                      className="h-auto p-0 font-semibold"
                    >
                      Timestamp {getTransactionSortIcon("timestamp")}
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx._id}>
                    <TableCell>{tx.user.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={tx.type === "BUY" ? "default" : "secondary"}
                      >
                        {tx.type} {tx.amount}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {tx.market.title}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          tx.pointsChange > 0
                            ? "text-green-600"
                            : "text-red-600"
                        }
                      >
                        {tx.pointsChange > 0 ? "+" : ""}
                        {tx.pointsChange}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(tx.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* User Database */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2" />
              User Database
            </CardTitle>
            <CardDescription>
              Manage participant accounts and balances
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input type="checkbox" className="rounded" />
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleUserSort("name")}
                      className="h-auto p-0 font-semibold"
                    >
                      Participant {getSortIcon("name")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleUserSort("points")}
                      className="h-auto p-0 font-semibold"
                    >
                      Points {getSortIcon("points")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleUserSort("accuracy")}
                      className="h-auto p-0 font-semibold"
                    >
                      Accuracy {getSortIcon("accuracy")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleUserSort("predictions")}
                      className="h-auto p-0 font-semibold"
                    >
                      Predictions {getSortIcon("predictions")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleUserSort("lastActive")}
                      className="h-auto p-0 font-semibold"
                    >
                      Last Active {getSortIcon("lastActive")}
                    </Button>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <input type="checkbox" className="rounded" />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-gray-600">
                          {user.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{user.points}</Badge>
                    </TableCell>
                    <TableCell>{user.stats.accuracy}%</TableCell>
                    <TableCell>{user.stats.totalPredictions}</TableCell>
                    <TableCell>
                      {new Date(user.lastActive).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Mail className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
