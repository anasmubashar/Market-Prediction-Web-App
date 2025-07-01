import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
// import { Switch } from "@/components/ui/switch";
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
  // Clock,
  CheckCircle,
  XCircle,
  Gavel,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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
  // type ScheduleFormData,
  type User,
  type Market,
  type Transaction,
  type DashboardStats,
} from "./lib/api";

type SortField = "email" | "points" | "predictions" | "joinDate" | "lastActive";
type SortDirection = "asc" | "desc";
type TransactionSortField =
  | "email"
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
  const [isLoading, setIsLoading] = useState(true);
  const [isScheduling, setIsScheduling] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // const [scheduleForm, setScheduleForm] = useState<ScheduleFormData>({
  //   title: "",
  //   isActive: true,
  //   recurrence: {
  //     frequency: "daily",
  //     timeOfDay: "09:00",
  //   },
  // });

  // const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);

  // Enhanced pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalUserPages, setTotalUserPages] = useState(0);

  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionsPerPage, setTransactionsPerPage] = useState(10);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [totalTransactionPages, setTotalTransactionPages] = useState(0);

  const [userSortField, setUserSortField] = useState<SortField>("email");
  const [userSortDirection, setUserSortDirection] =
    useState<SortDirection>("asc");
  const [transactionSortField, setTransactionSortField] =
    useState<TransactionSortField>("timestamp");
  const [transactionSortDirection, setTransactionSortDirection] =
    useState<SortDirection>("desc");
  const [selectedMarketId, setSelectedMarketId] = useState<string>("");

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isCustomEmailDialogOpen, setIsCustomEmailDialogOpen] = useState(false);

  const [customSubject, setCustomSubject] = useState("");
  const [customHtml, setCustomHtml] = useState("");

  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [editedUser, setEditedUser] = useState<User | null>(null);
  const [editedPoints, setEditedPoints] = useState<number>(0);

  // New market form
  const [newMarket, setNewMarket] = useState({
    title: "",
    description: "",
    deadline: "",
    tags: "",
  });

  const [isEditMarketDialogOpen, setIsEditMarketDialogOpen] = useState(false);
  const [editedMarket, setEditedMarket] = useState<Partial<Market> | null>(
    null
  );

  // Market resolution state
  const [isResolutionDialogOpen, setIsResolutionDialogOpen] = useState(false);
  const [resolutionOutcome, setResolutionOutcome] = useState<"YES" | "NO" | "">(
    ""
  );
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isResolving, setIsResolving] = useState(false);

  // Volume chart data state
  const [volumeChartData, setVolumeChartData] = useState<
    Array<{
      date: string;
      yesPercentage: number;
      noPercentage: number;
    }>
  >([]);

  // Load initial data
  useEffect(() => {
    loadDashboardData();
  }, [currentPage, usersPerPage, userSortField, userSortDirection]);

  useEffect(() => {
    loadTransactions();
  }, [
    transactionPage,
    transactionsPerPage,
    transactionSortField,
    transactionSortDirection,
  ]);

  useEffect(() => {
    if (selectedMarketId) {
      loadVolumeChartData();
    }
  }, [selectedMarketId]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError("");

      const [statsResult, usersResult, marketsResult] = await Promise.all([
        adminAPI.getDashboardStats(),
        usersAPI.getUsers(
          currentPage,
          usersPerPage,
          userSortField,
          userSortDirection
        ),
        marketsAPI.getMarkets(),
      ]);

      setDashboardStats(statsResult);
      setUsers(usersResult.users);
      setTotalUsers(usersResult.total);
      setTotalUserPages(usersResult.totalPages);
      setMarkets(marketsResult.markets);

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

  const loadTransactions = async () => {
    try {
      const transactionsResult = await transactionsAPI.getTransactions(
        transactionPage,
        transactionsPerPage,
        transactionSortField,
        transactionSortDirection
      );

      setTransactions(transactionsResult.transactions);
      setTotalTransactions(transactionsResult.total);
      setTotalTransactionPages(transactionsResult.totalPages);
    } catch (err) {
      console.error("Error loading transactions:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load transactions"
      );
    }
  };

  const loadVolumeChartData = async () => {
    try {
      const API_BASE_URL =
        import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      const response = await fetch(
        `${API_BASE_URL}/markets/${selectedMarketId}/volume-chart`
      );

      if (!response.ok) throw new Error("Failed to fetch volume chart data");

      const data = await response.json();
      setVolumeChartData(data.chartData || []);
    } catch (err) {
      console.error("Error loading volume chart data:", err);
      // Fallback to empty data if chart service fails
      setVolumeChartData([]);
    }
  };

  const handleUserSort = (field: SortField) => {
    if (userSortField === field) {
      setUserSortDirection(userSortDirection === "asc" ? "desc" : "asc");
    } else {
      setUserSortField(field);
      setUserSortDirection("asc");
    }
    setCurrentPage(1); // Reset to first page when sorting
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
    setTransactionPage(1); // Reset to first page when sorting
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

  // Pagination component
  const PaginationControls = ({
    currentPage,
    totalPages,
    onPageChange,
    itemsPerPage,
    onItemsPerPageChange,
    totalItems,
    itemName,
  }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    itemsPerPage: number;
    onItemsPerPageChange: (items: number) => void;
    totalItems: number;
    itemName: string;
  }) => {
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
      <div className="flex items-center justify-between px-2 py-4">
        <div className="flex items-center space-x-2">
          <p className="text-sm text-gray-700">
            Showing {startItem} to {endItem} of {totalItems} {itemName}
          </p>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={(value) => onItemsPerPageChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {[5, 10, 20, 30, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={pageSize.toString()}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-gray-700">per page</p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center space-x-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNumber;
              if (totalPages <= 5) {
                pageNumber = i + 1;
              } else if (currentPage <= 3) {
                pageNumber = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNumber = totalPages - 4 + i;
              } else {
                pageNumber = currentPage - 2 + i;
              }

              return (
                <Button
                  key={pageNumber}
                  variant={currentPage === pageNumber ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(pageNumber)}
                  className="h-8 w-8 p-0"
                >
                  {pageNumber}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 p-0"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
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
      const marketsResult = await marketsAPI.getMarkets();
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
      const marketsResult = await marketsAPI.getMarkets();
      setMarkets(marketsResult.markets);

      if (selectedMarketId === marketId && marketsResult.markets.length > 0) {
        setSelectedMarketId(marketsResult.markets[0]._id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete market");
    }
  };

  const resolveMarket = async () => {
    if (!selectedMarket || !resolutionOutcome) {
      setError("Please select an outcome");
      return;
    }

    try {
      setIsResolving(true);
      setError("");

      await marketsAPI.resolveMarket(
        selectedMarket._id,
        resolutionOutcome,
        resolutionNotes
      );

      setSuccess(
        `Market resolved as ${resolutionOutcome}! Payouts have been distributed.`
      );
      setIsResolutionDialogOpen(false);
      setResolutionOutcome("");
      setResolutionNotes("");

      // Refresh markets and dashboard stats
      await loadDashboardData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve market");
    } finally {
      setIsResolving(false);
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

  const getMarketStatusBadge = (market: Market) => {
    switch (market.status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case "closed":
        return <Badge className="bg-yellow-100 text-yellow-800">Closed</Badge>;
      case "resolved":
        return <Badge className="bg-blue-100 text-blue-800">Resolved</Badge>;
      default:
        return <Badge variant="secondary">{market.status}</Badge>;
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            className="h-20 flex-col bg-transparent"
          >
            <Download className="w-6 h-6 mb-2" />
            Export Users
          </Button>
          <Button
            variant="outline"
            onClick={exportTransactionData}
            className="h-20 flex-col bg-transparent"
          >
            <Activity className="w-6 h-6 mb-2" />
            Export Transactions
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="h-20 flex-col bg-transparent"
              >
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

          {/* Market Resolution Dialog */}
          <Dialog
            open={isResolutionDialogOpen}
            onOpenChange={setIsResolutionDialogOpen}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center">
                  <Gavel className="w-5 h-5 mr-2" />
                  Resolve Market
                </DialogTitle>
                <DialogDescription>
                  Set the final outcome for:{" "}
                  <strong>{selectedMarket?.title}</strong>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Final Outcome</Label>
                  <div className="flex space-x-2 mt-2">
                    <Button
                      variant={
                        resolutionOutcome === "YES" ? "default" : "outline"
                      }
                      onClick={() => setResolutionOutcome("YES")}
                      className="flex-1"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      YES
                    </Button>
                    <Button
                      variant={
                        resolutionOutcome === "NO" ? "default" : "outline"
                      }
                      onClick={() => setResolutionOutcome("NO")}
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      NO
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="resolution-notes">
                    Resolution Notes (Optional)
                  </Label>
                  <Textarea
                    id="resolution-notes"
                    placeholder="Explain the reasoning for this resolution..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    className="mt-1"
                  />
                </div>

                {resolutionOutcome && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <DollarSign className="h-4 w-4" />
                    <AlertDescription className="text-blue-800">
                      <strong>Payout Preview:</strong> All {resolutionOutcome}{" "}
                      shareholders will receive 100 points per share. Payout
                      emails will be sent automatically.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsResolutionDialogOpen(false);
                      setResolutionOutcome("");
                      setResolutionNotes("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={resolveMarket}
                    disabled={!resolutionOutcome || isResolving}
                  >
                    {isResolving ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Resolving...
                      </>
                    ) : (
                      <>
                        <Gavel className="w-4 h-4 mr-2" />
                        Resolve Market
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isEditMarketDialogOpen}
            onOpenChange={setIsEditMarketDialogOpen}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Market</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  value={editedMarket?.title || ""}
                  onChange={(e) =>
                    setEditedMarket((prev) => ({
                      ...prev!,
                      title: e.target.value,
                    }))
                  }
                  placeholder="Market title"
                />
                <Textarea
                  value={editedMarket?.description || ""}
                  onChange={(e) =>
                    setEditedMarket((prev) => ({
                      ...prev!,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Description"
                />
                <Input
                  type="datetime-local"
                  value={
                    editedMarket?.deadline
                      ? new Date(editedMarket.deadline)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={(e) =>
                    setEditedMarket((prev) => ({
                      ...prev!,
                      deadline: e.target.value,
                    }))
                  }
                />
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditMarketDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (editedMarket?._id) {
                        await marketsAPI.updateMarket(
                          editedMarket._id,
                          editedMarket
                        );
                        setSuccess("Market updated!");
                        setIsEditMarketDialogOpen(false);
                        loadDashboardData();
                      }
                    }}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isCustomEmailDialogOpen}
            onOpenChange={setIsCustomEmailDialogOpen}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Send Custom Email</DialogTitle>
                <DialogDescription>
                  Send a direct message to{" "}
                  <strong>{selectedUser?.email}</strong>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  placeholder="Subject"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                />
                <Textarea
                  placeholder="Message (HTML)"
                  value={customHtml}
                  onChange={(e) => setCustomHtml(e.target.value)}
                />
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsCustomEmailDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (selectedUser) {
                        await emailsAPI.sendCustomEmail({
                          userIds: [selectedUser._id],
                          subject: customSubject,
                          htmlContent: customHtml,
                          textContent: customHtml.replace(/<[^>]+>/g, ""),
                        });
                        setSuccess("Email sent!");
                        setIsCustomEmailDialogOpen(false);
                      }
                    }}
                  >
                    Send Email
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isEditUserDialogOpen}
            onOpenChange={setIsEditUserDialogOpen}
          >
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Edit User Points</DialogTitle>
                <DialogDescription>
                  Update point balance for <strong>{editedUser?.email}</strong>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Label htmlFor="user-points">Points</Label>
                <Input
                  id="user-points"
                  type="number"
                  value={editedPoints}
                  onChange={(e) => setEditedPoints(Number(e.target.value))}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditUserDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!editedUser) return;
                      await usersAPI.updateUser(editedUser._id, {
                        points: editedPoints,
                      });
                      setSuccess("User points updated");
                      setIsEditUserDialogOpen(false);
                      loadDashboardData();
                    }}
                  >
                    Save
                  </Button>
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
                  Manage prediction markets and resolve outcomes
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
                          <div className="flex items-center space-x-2">
                            {getMarketStatusBadge(market)}
                            <span>
                              {market.title.length > 40
                                ? `${market.title.substring(0, 40)}...`
                                : market.title}
                            </span>
                          </div>
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
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg">
                        {selectedMarket.title}
                      </h3>
                      {getMarketStatusBadge(selectedMarket)}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label className="text-sm text-gray-600">
                          YES Volume %
                        </Label>
                        <div className="text-2xl font-bold text-green-600">
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

                    {/* Resolution Info */}
                    {selectedMarket.status === "resolved" &&
                      selectedMarket.resolution && (
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <h4 className="font-semibold text-blue-900 mb-2">
                            Resolution
                          </h4>
                          <div className="space-y-1 text-sm">
                            <div>
                              <strong>Outcome:</strong>{" "}
                              {selectedMarket.resolution.outcome ? "YES" : "NO"}
                            </div>
                            <div>
                              <strong>Resolved:</strong>{" "}
                              {new Date(
                                selectedMarket.resolution.resolvedAt
                              ).toLocaleString()}
                            </div>
                            {selectedMarket.resolution.notes && (
                              <div>
                                <strong>Notes:</strong>{" "}
                                {selectedMarket.resolution.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditedMarket(selectedMarket);
                          setIsEditMarketDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>

                      {selectedMarket.status === "closed" && (
                        <Button
                          size="sm"
                          onClick={() => setIsResolutionDialogOpen(true)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Gavel className="w-4 h-4 mr-2" />
                          Resolve Market
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 bg-transparent"
                        onClick={() => deleteMarket(selectedMarket._id)}
                        disabled={selectedMarket.status === "resolved"}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  {/* Volume Percentage Chart */}
                  <div className="min-w-0">
                    <Label className="text-sm text-gray-600 mb-2 block">
                      Volume Distribution Over Time
                    </Label>
                    <div className="w-full h-[250px] border rounded-lg p-4 bg-white">
                      {volumeChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={volumeChartData}
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
                                      <p className="text-sm font-semibold text-green-600">{`YES Volume: ${Number(
                                        payload[0]?.value
                                      ).toFixed(1)}%`}</p>
                                      <p className="text-sm font-semibold text-red-600">{`NO Volume: ${Number(
                                        payload[1]?.value
                                      ).toFixed(1)}%`}</p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="yesPercentage"
                              stroke="#22c55e"
                              strokeWidth={3}
                              dot={{ fill: "#22c55e", strokeWidth: 2, r: 4 }}
                              activeDot={{
                                r: 6,
                                stroke: "#22c55e",
                                strokeWidth: 2,
                                fill: "#fff",
                              }}
                              name="YES Volume %"
                            />
                            <Line
                              type="monotone"
                              dataKey="noPercentage"
                              stroke="#ef4444"
                              strokeWidth={3}
                              dot={{ fill: "#ef4444", strokeWidth: 2, r: 4 }}
                              activeDot={{
                                r: 6,
                                stroke: "#ef4444",
                                strokeWidth: 2,
                                fill: "#fff",
                              }}
                              name="NO Volume %"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                          <div className="text-center">
                            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No volume data available</p>
                          </div>
                        </div>
                      )}
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

        {/* Transaction Monitoring with Pagination */}
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
                      onClick={() => handleTransactionSort("email")}
                      className="h-auto p-0 font-semibold"
                    >
                      Participant {getTransactionSortIcon("email")}
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
                    <TableCell>{tx.user.email}</TableCell>
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

            {/* Transaction Pagination */}
            <PaginationControls
              currentPage={transactionPage}
              totalPages={totalTransactionPages}
              onPageChange={setTransactionPage}
              itemsPerPage={transactionsPerPage}
              onItemsPerPageChange={(newSize) => {
                setTransactionsPerPage(newSize);
                setTransactionPage(1);
              }}
              totalItems={totalTransactions}
              itemName="transactions"
            />
          </CardContent>
        </Card>

        {/* User Database with Pagination */}
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
                      onClick={() => handleUserSort("email")}
                      className="h-auto p-0 font-semibold"
                    >
                      Participant {getSortIcon("email")}
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
                  <TableRow key={user._id}>
                    <TableCell>
                      <input type="checkbox" className="rounded" />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{user.points}</Badge>
                    </TableCell>
                    <TableCell>{user.stats.totalPredictions}</TableCell>
                    <TableCell>
                      {new Date(user.lastActive).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditedUser(user);
                            setEditedPoints(user.points);
                            setIsEditUserDialogOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setIsCustomEmailDialogOpen(true);
                          }}
                        >
                          <Mail className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* User Pagination */}
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalUserPages}
              onPageChange={setCurrentPage}
              itemsPerPage={usersPerPage}
              onItemsPerPageChange={(newSize) => {
                setUsersPerPage(newSize);
                setCurrentPage(1);
              }}
              totalItems={totalUsers}
              itemName="users"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
