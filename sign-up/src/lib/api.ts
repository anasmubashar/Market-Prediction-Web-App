const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Auth API

export const authAPI = {
  async register(email: string, name: string) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Registration failed");
    }

    return response.json();
  },
};
