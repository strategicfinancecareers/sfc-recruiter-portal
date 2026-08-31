import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { FileText } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import RecruiterAgreementDialog from "@/components/RecruiterAgreementDialog";
import type { SignedRecord } from "@/lib/agreementDocument";

const Account = () => {
  const { user, setAdminNotifications } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Signed-agreement record, so a recruiter can always pull up what they
  // signed and when.
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreement, setAgreement] = useState<SignedRecord | null>(null);
  const agreementAcceptedAt = agreement?.acceptedAt ?? null;
  const agreementSignature = agreement?.signature ?? null;

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('users')
      .select('recruiter_agreement_accepted_at, recruiter_agreement_signature, recruiter_agreement_initials_fee, recruiter_agreement_initials_comms, company')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const d = data as any;
        setAgreement({
          acceptedAt: d?.recruiter_agreement_accepted_at ?? null,
          signature: d?.recruiter_agreement_signature ?? null,
          initialsFee: d?.recruiter_agreement_initials_fee ?? null,
          initialsComms: d?.recruiter_agreement_initials_comms ?? null,
          company: d?.company ?? null,
          email: user.email ?? null,
          recruiterName: [user.first_name, user.last_name].filter(Boolean).join(' ') || null,
        });
      });
  }, [user?.id, user?.email, user?.first_name, user?.last_name]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "Please ensure your new passwords match.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Password updated",
      description: "Your password has been successfully changed.",
    });
    
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setIsLoading(false);
  };


  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First Name</Label>
                  <Input value={user?.first_name || ''} disabled />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input value={user?.last_name || ''} disabled />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled />
              </div>
              <div>
                <Label>Role</Label>
                <Input value={user?.role || ''} disabled className="capitalize" />
              </div>
              <div>
                <Label>Recruiter Agreement</Label>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <Badge variant={agreementAcceptedAt ? "default" : "secondary"}>
                    {agreementAcceptedAt ? "Signed" : "Not signed"}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => setShowAgreement(true)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-[#006a2d] hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    View agreement
                  </button>
                </div>
                {agreementAcceptedAt && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Signed {new Date(agreementAcceptedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    {agreementSignature ? ` by ${agreementSignature}` : ''}.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Updating..." : "Update Password"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Admin Notifications */}
          {user?.role === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Admin email preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="notify-intros">Intro request emails</Label>
                    <p className="text-sm text-muted-foreground">Email me when recruiters submit introduction requests.</p>
                  </div>
                  <Switch
                    id="notify-intros"
                    checked={!!user?.notify_intro_requests}
                    onCheckedChange={(v) => setAdminNotifications(v)}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <RecruiterAgreementDialog
        open={showAgreement}
        onOpenChange={setShowAgreement}
        record={agreement ?? undefined}
      />
    </div>
  );
};

export default Account;
