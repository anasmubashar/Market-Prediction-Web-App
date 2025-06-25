const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export interface RecurrenceConfig {
  frequency: "daily" | "weekly" | "monthly" | "custom";
  timeOfDay: string;
  //   time: string; // Format: "HH:mm"
  dayOfWeek?: number; // 0 (Sunday) - 6 (Saturday) for weekly
  dayOfMonth?: number; // 1-31 for monthly
  customCron?: string;
}

export interface ScheduleFormData {
  title: string;
  //   markets: string[]; // array of market ObjectIds
  recurrence: RecurrenceConfig;
  isActive: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  points: number;
  isActive: boolean;
  lastActive: string;
  preferences: {
    emailNotifications: boolean;
    marketUpdates: boolean;
  };
  stats: {
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number;
  };
  createdAt: string;
}

export interface Market {
  _id: string;
  title: string;
  description?: string;
  deadline: string;
  status: "active" | "closed" | "resolved";
  currentProbability: number;
  totalVolume: number;
  participantCount: number;
  probabilityHistory: Array<{
    date: string;
    probability: number;
  }>;
  lmsrStats?: {
    yesPrice: number;
    noPrice: number;
    yesProbability: number;
    noProbability: number;
    totalShares: number;
    liquidity: number;
  };
  createdAt: string;
}

export interface Transaction {
  _id: string;
  user: {
    name: string;
    email: string;
  };
  market: {
    title: string;
  };
  type: "BUY" | "SELL";
  amount: number;
  price: number;
  pointsChange: number;
  source: "web" | "email";
  createdAt: string;
}

export interface EmailCycle {
  _id: string;
  title: string;
  status: string;
  stats: {
    totalRecipients: number;
    sent: number;
    failed: number;
    responses: number;
  };
  createdAt: string;
}

export interface DashboardStats {
  users: {
    total: number;
    active: number;
    verified: number;
    recent: number;
  };
  markets: {
    total: number;
    active: number;
    resolved: number;
  };
  transactions: {
    total: number;
    today: number;
    recent: number;
  };
  emails: {
    totalCycles: number;
    lastCycle: {
      date: string;
      sent: number;
      failed: number;
    } | null;
  };
}

// Users API
export const usersAPI = {
  async getUsers(page = 1, limit = 10, sortBy = "name", sortOrder = "asc") {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
      sortOrder,
    });

    const response = await fetch(`${API_BASE_URL}/users?${params}`);
    if (!response.ok) throw new Error("Failed to fetch users");
    return response.json();
  },

  async getUserStats() {
    const response = await fetch(`${API_BASE_URL}/users/stats`);
    if (!response.ok) throw new Error("Failed to fetch user stats");
    return response.json();
  },

  async bulkUpdateUsers(userIds: string[], action: string, value?: number) {
    const response = await fetch(`${API_BASE_URL}/users/bulk-update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userIds, action, value }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Bulk update failed");
    }

    return response.json();
  },
};

// Markets API
export const marketsAPI = {
  async getMarkets(status?: string, page = 1, limit = 10) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (status) params.append("status", status);

    const response = await fetch(`${API_BASE_URL}/markets?${params}`);
    if (!response.ok) throw new Error("Failed to fetch markets");
    return response.json();
  },

  async createMarket(marketData: {
    title: string;
    description?: string;
    deadline: string;
    tags?: string[];
    beta?: number;
  }) {
    const response = await fetch(`${API_BASE_URL}/markets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(marketData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to create market");
    }

    return response.json();
  },

  async updateMarket(id: string, updates: Partial<Market>) {
    const response = await fetch(`${API_BASE_URL}/markets/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update market");
    }

    return response.json();
  },

  async deleteMarket(id: string) {
    const response = await fetch(`${API_BASE_URL}/markets/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete market");
    }

    return response.json();
  },
};

// Transactions API
export const transactionsAPI = {
  async getTransactions(
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc"
  ) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
      sortOrder,
    });

    const response = await fetch(`${API_BASE_URL}/transactions?${params}`);
    if (!response.ok) throw new Error("Failed to fetch transactions");
    return response.json();
  },

  async createTransaction(transactionData: {
    userEmail: string;
    marketId: string;
    type: "BUY" | "SELL";
    amount: number;
    outcome?: "YES" | "NO";
  }) {
    const response = await fetch(`${API_BASE_URL}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(transactionData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Transaction failed");
    }

    return response.json();
  },
};

// Emails API
export const emailsAPI = {
  async sendMarketCycle() {
    const response = await fetch(`${API_BASE_URL}/emails/send-market-cycle`, {
      method: "POST",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to send market cycle");
    }

    return response.json();
  },

  async getEmailCycles(page = 1, limit = 10) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const response = await fetch(`${API_BASE_URL}/emails/cycles?${params}`);
    if (!response.ok) throw new Error("Failed to fetch email cycles");
    return response.json();
  },

  async sendCustomEmail(emailData: {
    userIds: string[];
    subject: string;
    htmlContent: string;
    textContent: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/emails/send-custom`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to send custom email");
    }

    return response.json();
  },
};

// Admin API
export const adminAPI = {
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await fetch(`${API_BASE_URL}/admin/dashboard-stats`);
    if (!response.ok) throw new Error("Failed to fetch dashboard stats");
    return response.json();
  },

  async exportUsers() {
    const response = await fetch(`${API_BASE_URL}/admin/export/users`);
    if (!response.ok) throw new Error("Failed to export users");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "users.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  },

  async exportTransactions() {
    const response = await fetch(`${API_BASE_URL}/admin/export/transactions`);
    if (!response.ok) throw new Error("Failed to export transactions");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  },
};
