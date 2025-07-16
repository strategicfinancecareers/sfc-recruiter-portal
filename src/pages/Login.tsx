
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Chrome, AlertCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const { login, signInWithGoogle, signInWithMicrosoft, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalLoading(true);
    try {
      const success = await login(email, password);
      if (success) {
        // Navigation will be handled by the useEffect above
      }
    } finally {
      setLocalLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLocalLoading(true);
    try {
      await signInWithGoogle();
      // Navigation will be handled by the useEffect above
    } finally {
      setLocalLoading(false);
    }
  };

  const handleMicrosoftSignIn = async () => {
    setLocalLoading(true);
    try {
      await signInWithMicrosoft();
      // Navigation will be handled by the useEffect above
    } finally {
      setLocalLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Briefcase className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>Sign in to your recruiter account</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Demo Credentials */}
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <h4 className="text-sm font-medium mb-2 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              Demo Credentials
            </h4>
            <div className="text-xs space-y-1">
              <div><strong>Admin:</strong> admin@demo.com / admin123</div>
              <div><strong>Recruiter:</strong> recruiter@demo.com / recruiter123</div>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={localLoading}>
              {localLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={localLoading}
                type="button"
              >
                <Chrome className="mr-2 h-4 w-4" />
                Google
              </Button>
              <Button 
                variant="outline" 
                className="w-full opacity-50 cursor-not-allowed"
                disabled={true}
                type="button"
              >
                <div className="mr-2 h-4 w-4 bg-muted rounded-sm"></div>
                Microsoft (Coming Soon)
              </Button>
            </div>
          </div>
          
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Link to="/forgot-password" className="text-sm text-primary hover:underline">
            Forgot your password?
          </Link>
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;
