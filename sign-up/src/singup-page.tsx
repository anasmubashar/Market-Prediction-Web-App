"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageCircle, AlertCircle, Coins } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authAPI } from "./lib/api";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  // const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await authAPI.register(email);
      console.log("Registration successful:", result);
      setIsSubmitted(true);
      setEmail("");
      // setName("");
    } catch (err) {
      console.error("Registration error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Registration failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}

        {/* Main Signup Card */}
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-5xl font-bold text-blue-600">
              TUSQ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12"
                  disabled={isLoading}
                />
              </div>

              {/* What happens next section */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <MessageCircle className="w-4 h-4 mr-2 text-blue-600" />
                  What happens next:
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start">
                    <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    Confirmation email with 1000 starting points
                  </li>
                  <li className="flex items-start">
                    <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    Regular prediction market emails with current probabilities
                  </li>
                  <li className="flex items-start">
                    <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    Simple buy/sell commands via email reply
                  </li>
                </ul>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                disabled={isLoading || !email}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Joining Market...
                  </div>
                ) : (
                  <>
                    <Coins className="w-8 h-8 mr-2" />
                    Join Prediction Market
                  </>
                )}
              </Button>
            </form>

            <p className="text-xs text-gray-500 text-center mt-4">
              By participating, you agree to our terms of service. You can
              unsubscribe at any time.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Welcome Modal */}
      <Dialog open={isSubmitted} onOpenChange={setIsSubmitted}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            <DialogTitle className="text-2xl font-bold text-gray-900">
              Welcome to the Market!
            </DialogTitle>
            <DialogDescription className="text-base text-gray-600 space-y-2">
              <div>
                Check your email for confirmation and your starting 1000 points.
              </div>
              <div className="text-sm">
                You'll receive your first prediction market email soon.
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center mt-4">
            <Button
              onClick={() => setIsSubmitted(false)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Got it!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
