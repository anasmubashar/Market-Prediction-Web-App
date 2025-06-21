"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Users,
  Download,
  Settings,
  Mail,
  Calendar,
  RefreshCw,
  Edit,
  Trash2,
  Plus,
  Send,
  Database,
  Activity,
} from "lucide-react";

export default function AdminDashboard() {
  //   const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isScheduling, setIsScheduling] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(10);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionsPerPage] = useState(10);

  // Mock data
  const users = [
    {
      id: "1",
      email: "prof.smith@university.edu",
      name: "Prof. John Smith",
      points: 1247,
      accuracy: 78,
      predictions: 23,
      joinDate: "2024-01-15",
      lastActive: "2024-01-20",
    },
    {
      id: "2",
      email: "dr.chen@research.edu",
      name: "Dr. Sarah Chen",
      points: 890,
      accuracy: 85,
      predictions: 18,
      joinDate: "2024-01-16",
      lastActive: "2024-01-21",
    },
    {
      id: "3",
      email: "student.jones@uni.edu",
      name: "Mike Jones",
      points: 1456,
      accuracy: 72,
      predictions: 31,
      joinDate: "2024-01-17",
      lastActive: "2024-01-21",
    },
    {
      id: "4",
      email: "prof.williams@college.edu",
      name: "Prof. Emily Williams",
      points: 2103,
      accuracy: 91,
      predictions: 45,
      joinDate: "2024-01-18",
      lastActive: "2024-01-21",
    },
    {
      id: "5",
      email: "dr.garcia@research.org",
      name: "Dr. Carlos Garcia",
      points: 756,
      accuracy: 68,
      predictions: 15,
      joinDate: "2024-01-19",
      lastActive: "2024-01-20",
    },
    {
      id: "6",
      email: "student.taylor@uni.edu",
      name: "Alex Taylor",
      points: 1834,
      accuracy: 83,
      predictions: 38,
      joinDate: "2024-01-20",
      lastActive: "2024-01-21",
    },
    {
      id: "7",
      email: "prof.brown@academy.edu",
      name: "Prof. Lisa Brown",
      points: 945,
      accuracy: 76,
      predictions: 21,
      joinDate: "2024-01-21",
      lastActive: "2024-01-21",
    },
    {
      id: "8",
      email: "dr.wilson@institute.edu",
      name: "Dr. Robert Wilson",
      points: 1567,
      accuracy: 88,
      predictions: 29,
      joinDate: "2024-01-22",
      lastActive: "2024-01-21",
    },
    {
      id: "9",
      email: "student.davis@college.edu",
      name: "Jordan Davis",
      points: 623,
      accuracy: 65,
      predictions: 12,
      joinDate: "2024-01-23",
      lastActive: "2024-01-20",
    },
    {
      id: "10",
      email: "prof.miller@university.edu",
      name: "Prof. David Miller",
      points: 2245,
      accuracy: 94,
      predictions: 52,
      joinDate: "2024-01-24",
      lastActive: "2024-01-21",
    },
    {
      id: "11",
      email: "dr.anderson@research.edu",
      name: "Dr. Maria Anderson",
      points: 1123,
      accuracy: 79,
      predictions: 26,
      joinDate: "2024-01-25",
      lastActive: "2024-01-21",
    },
    {
      id: "12",
      email: "student.white@uni.edu",
      name: "Sam White",
      points: 1789,
      accuracy: 81,
      predictions: 34,
      joinDate: "2024-01-26",
      lastActive: "2024-01-20",
    },
  ];

  // Pagination calculations
  const totalUsers = users.length;
  const totalPages = Math.ceil(totalUsers / usersPerPage);
  const startIndex = (currentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const currentUsers = users.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const transactions = [
    {
      id: "1",
      userId: "1",
      userName: "Prof. John Smith",
      action: "BUY 50",
      market: "Inflation > 3% Q2 2024",
      points: -50,
      timestamp: "2024-01-21 14:30",
    },
    {
      id: "2",
      userId: "2",
      userName: "Dr. Sarah Chen",
      action: "SELL 30",
      market: "AI Breakthrough 2024",
      points: +30,
      timestamp: "2024-01-21 13:15",
    },
    {
      id: "3",
      userId: "3",
      userName: "Mike Jones",
      action: "BUY 75",
      market: "Climate Policy Changes",
      points: -75,
      timestamp: "2024-01-21 12:45",
    },
    {
      id: "4",
      userId: "4",
      userName: "Prof. Emily Williams",
      action: "BUY 100",
      market: "Tech Stock Rally",
      points: -100,
      timestamp: "2024-01-21 11:20",
    },
    {
      id: "5",
      userId: "5",
      userName: "Dr. Carlos Garcia",
      action: "SELL 25",
      market: "Election Outcome",
      points: +25,
      timestamp: "2024-01-21 10:15",
    },
    {
      id: "6",
      userId: "6",
      userName: "Alex Taylor",
      action: "BUY 80",
      market: "Climate Policy Changes",
      points: -80,
      timestamp: "2024-01-21 09:30",
    },
    {
      id: "7",
      userId: "7",
      userName: "Prof. Lisa Brown",
      action: "SELL 45",
      market: "AI Breakthrough 2024",
      points: +45,
      timestamp: "2024-01-21 08:45",
    },
    {
      id: "8",
      userId: "8",
      userName: "Dr. Robert Wilson",
      action: "BUY 60",
      market: "Inflation > 3% Q2 2024",
      points: -60,
      timestamp: "2024-01-20 16:20",
    },
    {
      id: "9",
      userId: "9",
      userName: "Jordan Davis",
      action: "SELL 35",
      market: "Tech Stock Rally",
      points: +35,
      timestamp: "2024-01-20 15:10",
    },
    {
      id: "10",
      userId: "10",
      userName: "Prof. David Miller",
      action: "BUY 120",
      market: "Election Outcome",
      points: -120,
      timestamp: "2024-01-20 14:30",
    },
    {
      id: "11",
      userId: "11",
      userName: "Dr. Maria Anderson",
      action: "SELL 55",
      market: "Climate Policy Changes",
      points: +55,
      timestamp: "2024-01-20 13:45",
    },
    {
      id: "12",
      userId: "12",
      userName: "Sam White",
      action: "BUY 90",
      market: "AI Breakthrough 2024",
      points: -90,
      timestamp: "2024-01-20 12:15",
    },
    {
      id: "13",
      userId: "1",
      userName: "Prof. John Smith",
      action: "SELL 40",
      market: "Tech Stock Rally",
      points: +40,
      timestamp: "2024-01-20 11:30",
    },
    {
      id: "14",
      userId: "3",
      userName: "Mike Jones",
      action: "BUY 65",
      market: "Election Outcome",
      points: -65,
      timestamp: "2024-01-20 10:20",
    },
    {
      id: "15",
      userId: "5",
      userName: "Dr. Carlos Garcia",
      action: "SELL 70",
      market: "Inflation > 3% Q2 2024",
      points: +70,
      timestamp: "2024-01-20 09:15",
    },
  ];

  // Transaction pagination calculations
  const totalTransactions = transactions.length;
  const totalTransactionPages = Math.ceil(
    totalTransactions / transactionsPerPage
  );
  const transactionStartIndex = (transactionPage - 1) * transactionsPerPage;
  const transactionEndIndex = transactionStartIndex + transactionsPerPage;
  const currentTransactions = transactions.slice(
    transactionStartIndex,
    transactionEndIndex
  );

  const goToTransactionPage = (page: number) => {
    setTransactionPage(Math.max(1, Math.min(page, totalTransactionPages)));
  };

  const activeMarkets = [
    {
      id: "1",
      title: "Will inflation exceed 3% by Q2 2024?",
      probability: 67,
      totalVolume: 2340,
      participants: 45,
      deadline: "2024-06-30",
      status: "active",
    },
    {
      id: "2",
      title: "New AI breakthrough announced at major conference?",
      probability: 43,
      totalVolume: 1890,
      participants: 38,
      deadline: "2024-05-15",
      status: "active",
    },
    {
      id: "3",
      title: "Climate policy changes in next 6 months?",
      probability: 82,
      totalVolume: 3120,
      participants: 52,
      deadline: "2024-08-01",
      status: "active",
    },
  ];

  const exportUserData = () => {
    const csvContent = [
      [
        "Email",
        "Name",
        "Points",
        "Accuracy",
        "Predictions",
        "Join Date",
        "Last Active",
      ],
      ...users.map((user) => [
        user.email,
        user.name,
        user.points,
        `${user.accuracy}%`,
        user.predictions,
        user.joinDate,
        user.lastActive,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prediction_market_users.csv";
    a.click();
  };

  const exportTransactionData = () => {
    const csvContent = [
      ["User", "Action", "Market", "Points", "Timestamp"],
      ...transactions.map((tx) => [
        tx.userName,
        tx.action,
        tx.market,
        tx.points,
        tx.timestamp,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prediction_market_transactions.csv";
    a.click();
  };

  const sendMarketCycle = () => {
    setIsScheduling(true);
    // Simulate sending emails
    setTimeout(() => {
      setIsScheduling(false);
      alert("Market cycle emails sent to all participants!");
    }, 2000);
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
            <p className="text-gray-600">Prediction Market Management</p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge
              variant="outline"
              className="text-green-600 border-green-600"
            >
              {users.length} Active Participants
            </Badge>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
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
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="deadline">Deadline</Label>
                  <Input id="deadline" type="date" className="mt-1" />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline">Cancel</Button>
                  <Button>Create Market</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* User Database */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  User Database
                </CardTitle>
                <CardDescription>
                  Manage participant accounts and balances
                </CardDescription>
              </div>
              <div className="flex space-x-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4 mr-2" />
                      Bulk Actions
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Bulk User Actions</DialogTitle>
                      <DialogDescription>
                        Apply actions to multiple users
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Action Type</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select action" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="reset-points">
                              Reset Points to 1000
                            </SelectItem>
                            <SelectItem value="add-points">
                              Add Points
                            </SelectItem>
                            <SelectItem value="send-email">
                              Send Custom Email
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="points-value">
                          Points Value (if applicable)
                        </Label>
                        <Input
                          id="points-value"
                          type="number"
                          placeholder="100"
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline">Cancel</Button>
                        <Button>Apply to Selected</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input type="checkbox" className="rounded" />
                  </TableHead>
                  <TableHead>Participant</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Accuracy</TableHead>
                  <TableHead>Predictions</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentUsers.map((user) => (
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
                    <TableCell>{user.accuracy}%</TableCell>
                    <TableCell>{user.predictions}</TableCell>
                    <TableCell>{user.lastActive}</TableCell>
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
            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, totalUsers)} of{" "}
                {totalUsers} participants
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>

                {/* Page Numbers */}
                <div className="flex space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum =
                      Math.max(1, Math.min(totalPages - 4, currentPage - 2)) +
                      i;
                    if (pageNum > totalPages) return null;

                    return (
                      <Button
                        key={pageNum}
                        variant={
                          currentPage === pageNum ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => goToPage(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
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
                  <TableHead>Participant</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{tx.userName}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          tx.action.startsWith("BUY") ? "default" : "secondary"
                        }
                      >
                        {tx.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {tx.market}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          tx.points > 0 ? "text-green-600" : "text-red-600"
                        }
                      >
                        {tx.points > 0 ? "+" : ""}
                        {tx.points}
                      </span>
                    </TableCell>
                    <TableCell>{tx.timestamp}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {/* Transaction Pagination Controls */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-600">
                Showing {transactionStartIndex + 1} to{" "}
                {Math.min(transactionEndIndex, totalTransactions)} of{" "}
                {totalTransactions} transactions
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToTransactionPage(transactionPage - 1)}
                  disabled={transactionPage === 1}
                >
                  Previous
                </Button>

                {/* Transaction Page Numbers */}
                <div className="flex space-x-1">
                  {Array.from(
                    { length: Math.min(5, totalTransactionPages) },
                    (_, i) => {
                      const pageNum =
                        Math.max(
                          1,
                          Math.min(
                            totalTransactionPages - 4,
                            transactionPage - 2
                          )
                        ) + i;
                      if (pageNum > totalTransactionPages) return null;

                      return (
                        <Button
                          key={pageNum}
                          variant={
                            transactionPage === pageNum ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => goToTransactionPage(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    }
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToTransactionPage(transactionPage + 1)}
                  disabled={transactionPage === totalTransactionPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Market Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="w-5 h-5 mr-2" />
              Market Management
            </CardTitle>
            <CardDescription>Manage active prediction markets</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market Question</TableHead>
                  <TableHead>Probability</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Participants</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeMarkets.map((market) => (
                  <TableRow key={market.id}>
                    <TableCell className="max-w-xs">
                      <div className="font-medium">{market.title}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{market.probability}%</Badge>
                    </TableCell>
                    <TableCell>{market.totalVolume}</TableCell>
                    <TableCell>{market.participants}</TableCell>
                    <TableCell>{market.deadline}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Email Scheduling */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Market Cycle Scheduling
            </CardTitle>
            <CardDescription>Schedule and manage email cycles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="cycle-frequency">Email Frequency</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="manual">Manual Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="next-cycle">Next Scheduled Cycle</Label>
                  <Input id="next-cycle" type="datetime-local" />
                </div>
                <Button className="w-full">Update Schedule</Button>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Last Email Sent</Label>
                  <p className="text-sm text-gray-600">
                    January 21, 2024 at 2:00 PM
                  </p>
                </div>
                <div>
                  <Label>Emails Delivered</Label>
                  <p className="text-sm text-gray-600">
                    156 of 156 participants
                  </p>
                </div>
                <div>
                  <Label>Response Rate</Label>
                  <p className="text-sm text-gray-600">89% (139 responses)</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
