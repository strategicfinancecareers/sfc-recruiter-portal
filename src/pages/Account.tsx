
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";


interface IntroductionRequest {
  id: string;
  candidateName: string;
  candidateRole: string;
  requestedAt: string;
  status: 'pending' | 'accepted' | 'rejected';
  emailSentAt?: string;
}

const mockIntroductions: IntroductionRequest[] = [
  {
    id: '1',
    candidateName: 'Sarah Johnson',
    candidateRole: 'Senior Full Stack Developer',
    requestedAt: '2024-01-15',
    status: 'accepted',
    emailSentAt: '2024-01-16',
  },
  {
    id: '2',
    candidateName: 'Michael Chen',
    candidateRole: 'DevOps Engineer',
    requestedAt: '2024-01-14',
    status: 'pending',
  },
  {
    id: '3',
    candidateName: 'Emily Rodriguez',
    candidateRole: 'UX/UI Designer',
    requestedAt: '2024-01-13',
    status: 'rejected',
  },
];

const Account = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-gray-600">Manage your account and view introduction requests</p>
        </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="introductions">Introduction Requests</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Profile Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Your account details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Name</Label>
                      <Input value={user?.name || ''} disabled />
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
                      <Label>Terms Status</Label>
                      <div className="mt-1">
                        <Badge variant={user?.hasAcceptedTerms ? "default" : "secondary"}>
                          {user?.hasAcceptedTerms ? "Accepted" : "Not Accepted"}
                        </Badge>
                      </div>
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
              </div>
            </TabsContent>

            <TabsContent value="introductions">
              <Card>
                <CardHeader>
                  <CardTitle>Introduction Requests</CardTitle>
                  <CardDescription>Track the status of your candidate introduction requests</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockIntroductions.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No introduction requests yet. Start by browsing candidates!
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {mockIntroductions.map((intro) => (
                          <div
                            key={intro.id}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                          >
                            <div className="flex-1">
                              <h4 className="font-medium">{intro.candidateName}</h4>
                              <p className="text-sm text-gray-600">{intro.candidateRole}</p>
                              <p className="text-xs text-gray-500">
                                Requested: {new Date(intro.requestedAt).toLocaleDateString()}
                                {intro.emailSentAt && (
                                  <span className="ml-2">
                                    • Email sent: {new Date(intro.emailSentAt).toLocaleDateString()}
                                  </span>
                                )}
                              </p>
                            </div>
                            <Badge className={getStatusColor(intro.status)}>
                              {intro.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Account;
