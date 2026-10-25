import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { FileText, CreditCard, Loader2, ExternalLink } from "lucide-react";
import { authedFetch } from "@/integrations/supabase/authedFetch";
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
  const [billing, setBilling] = useState<any>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [agreement, setAgreement] = useState<SignedRecord | null>(null);
  const agreementAcceptedAt = agreement?.acceptedAt ?? null;
  const agreementSignature = agreement?.signature ?? null;

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('users')
      .select('recruiter_agreement_accepted_at, recruiter_agreement_signature, recruiter_agreement_initials_fee, recruiter_agreement_initials_comms, recruiter_agreement_version, company, is_subscribed, subscription_plan, subscription_status, trial_end, current_period_end, subscribed_at, placement_fee_code, placement_fee_usd, promo_code_used, stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const d = data as any;
        setBilling(d ?? null);
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

  const openBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await authedFetch('/api/billing-portal', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      toast({
        title: 'Could not open billing portal',
        description: data.error || 'Please try again, or contact team@strategicfinancecareers.com.',
        variant: 'destructive',
      });
    } catch {
      toast({ title: 'Could not open billing portal', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setPortalLoading(false);
    }
  };

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

          {/* Billing & Membership — recruiters only */}
          {user?.role === 'recruiter' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Billing & Membership</CardTitle>
                <CardDescription>Your plan, payments, and signed terms</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {billing?.is_subscribed ? (
                  <>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Plan</span>
                        <span className="font-medium">
                          {billing.subscription_plan === 'annual' ? 'Annual — $1,200/yr ($100/mo)' : 'Monthly — $150/mo'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <span>
                          {billing.trial_end && new Date(billing.trial_end) > new Date() ? (
                            <Badge className="bg-amber-100 text-amber-800 border border-amber-200">
                              Free trial until {new Date(billing.trial_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </Badge>
                          ) : (
                            <Badge className="bg-[#008037]/10 text-[#005a26] border border-[#008037]/25 capitalize">
                              {billing.subscription_status || 'Active'}
                            </Badge>
                          )}
                        </span>
                      </div>
                      {billing.subscribed_at && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Member since</span>
                          <span>{new Date(billing.subscribed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      )}
                      {billing.current_period_end && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Next payment</span>
                          <span>{new Date(billing.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Placement fee</span>
                        <span>
                          ${(billing.placement_fee_usd || 10000).toLocaleString('en-US')} per hire
                          {billing.placement_fee_code ? ` (${billing.placement_fee_code})` : ''}
                        </span>
                      </div>
                    </div>
                    <Button onClick={openBillingPortal} disabled={portalLoading} variant="outline" className="w-full">
                      {portalLoading
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening…</>
                        : <><ExternalLink className="mr-2 h-4 w-4" />Manage billing — invoices, card, cancel</>}
                    </Button>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No active membership yet.{' '}
                    <a href="/start-here" className="text-[#006a2d] underline underline-offset-2 font-medium">Start your membership</a>
                  </div>
                )}

                <div className="border-t pt-3 space-y-1.5">
                  <p className="text-sm font-medium">Recruiter Agreement</p>
                  {agreementAcceptedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Signed {new Date(agreementAcceptedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {agreementSignature ? ` by ${agreementSignature}` : ''}
                      {billing?.recruiter_agreement_version ? ` · v${billing.recruiter_agreement_version}` : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not signed yet — you'll sign before your first payment.</p>
                  )}
                  {agreementAcceptedAt && (
                    <Button variant="outline" size="sm" onClick={() => setShowAgreement(true)} className="gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> View & download signed copy
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Admin Notifications */}
          {(user?.role === 'admin' || user?.role === 'owner') && (
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
