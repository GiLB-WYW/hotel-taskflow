import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password;
    
    console.log("Login attempt:", { email: trimmedEmail, passwordLength: trimmedPassword.length });
    
    if (!trimmedEmail || !trimmedPassword) {
      toast({
        title: "Required Fields",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    if (!trimmedEmail.includes("@")) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ email: trimmedEmail, password: trimmedPassword }),
        credentials: "same-origin",
      });

      console.log("Response status:", response.status);
      
      if (!response.ok) {
        let errorMessage = "Invalid credentials";
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
          console.log("Error response data:", data);
        } catch (parseError) {
          console.error("Failed to parse error response:", parseError);
        }
        
        toast({
          title: "Login Failed",
          description: errorMessage,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      const data = await response.json();
      console.log("Response data:", data);

      // Store user data including role and group
      localStorage.setItem("user", JSON.stringify({
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        group: data.group,
        provider: data.authProvider || "email",
        avatar: data.avatar || trimmedEmail[0].toUpperCase(),
      }));
      
      toast({
        title: "Login Successful",
        description: `Welcome, ${data.name}!`,
      });
      
      // Use replace to prevent going back to login page
      window.location.replace("/");
    } catch (error) {
      console.error("Login fetch error:", error);
      toast({
        title: "Login Failed",
        description: "Unable to connect to the server. Please check your internet connection and try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#6F848E] via-[#ADB4A0] to-[#ac6b53] flex items-center justify-center px-4 py-8">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#F0E4CE]/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-[#f0e3df]/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex flex-col items-center justify-center gap-3 mb-4">
            <img src="/hotel-logo.png" alt="Hotel Logo" className="h-24 w-auto object-contain" />
            <span className="font-serif font-bold text-3xl text-white">TaskFlow</span>
          </div>
          <p className="text-[#F0E4CE] text-sm">Hôtel Task Management System</p>
        </div>

        <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md">
          <CardHeader className="space-y-2 text-center">
              <CardTitle className="text-2xl font-serif text-[#6F848E]">Welcome Back</CardTitle>
            <CardDescription className="text-[#ac6b53]">
                Sign in to your account to continue
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Email/Password Form */}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#6F848E] uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A6A6A6]" />
                  <Input
                    type="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-[#FAFAFA] border-[#ADB4A0] text-[#6F848E] placeholder:text-[#A6A6A6] focus:border-[#ac6b53]"
                    disabled={isLoading}
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#6F848E] uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A6A6A6]" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    inputMode="text"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-[#FAFAFA] border-[#ADB4A0] text-[#6F848E] placeholder:text-[#A6A6A6] focus:border-[#ac6b53]"
                    disabled={isLoading}
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A6A6A6] hover:text-[#6F848E] transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-[#6F848E] to-[#ADB4A0] hover:from-[#ac6b53] hover:to-[#6F848E] text-white font-semibold h-10 transition-all duration-300"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign In with Email"}
              </Button>
            </form>

            <p className="text-center text-xs text-[#6F848E]">
              Use the password created during account setup, or accept an invitation first.
            </p>

            {/* Login Info & Password Reset */}
            <div className="mt-6 space-y-3">
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setLocation("/reset-password")}
                  className="text-xs text-[#6F848E] hover:text-[#ac6b53] hover:underline transition-colors"
                >
                  Forgot your password?
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-[#F0E4CE] mt-6">
          Hotel maintenance task management system
        </p>
      </div>

    </div>
  );
}
