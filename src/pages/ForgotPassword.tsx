import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// /forgot-password?audience=professional|recruiter
// The audience query param decides where the recovery email's link points:
//   professional → ${origin}/reset-password           (cream / Newsreader)
//   recruiter    → ${origin}/recruiter/reset-password (recruiter shell)
// Default (no param, or any other value) = recruiter (matches the existing
// SignUp.tsx "Forgot password?" link's prior implicit context).
//
// Each Sign In tab links here with the right ?audience so the email lands
// on the audience-correct reset page. The shared SetNewPasswordForm on
// each reset page handles the actual recovery-token / updateUser flow.

type Audience = 'professional' | 'recruiter';

const ForgotPassword = () => {
  const [searchParams] = useSearchParams();
  const audience: Audience = searchParams.get('audience') === 'professional' ? 'professional' : 'recruiter';

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Per-audience redirect — Supabase puts the recovery token in the
      // hash of this URL when emailing the user. The corresponding
      // /reset-password or /recruiter/reset-password page handles the
      // session check and updateUser call via SetNewPasswordForm.
      const redirectPath = audience === 'professional' ? '/reset-password' : '/recruiter/reset-password';
      const redirectUrl = `${window.location.origin}${redirectPath}`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      setEmailSent(true);
      toast({
        title: "Reset email sent",
        description: "Check your inbox for password reset instructions.",
      });
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({
        title: "Error sending reset email",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const backHref = audience === 'professional' ? '/apply?mode=signin' : '/signup?mode=signin';

  return (
    <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Briefcase className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>
            {emailSent
              ? "We've sent you a reset link"
              : "Enter your email to receive reset instructions"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!emailSent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-600">
                We've sent a password reset link to <strong>{email}</strong>
              </p>
              <p className="text-xs text-gray-500">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <Button
                variant="outline"
                onClick={() => setEmailSent(false)}
                className="w-full"
              >
                Try Different Email
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Link to={backHref} className="flex items-center text-sm text-primary hover:underline mx-auto">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Sign In
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ForgotPassword;
