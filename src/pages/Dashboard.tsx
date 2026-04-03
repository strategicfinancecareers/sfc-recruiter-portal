import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Clock, CheckCircle, XCircle, AlertCircle, BarChart3, UserCheck } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const Dashboard = () => {
  const { user } = useAuth();

  console.log('user:', user)

  // Mock data for demonstration
  const recruiterStats = {
    introductionsSent: 12,
    responsesReceived: 8,
    successfulMatches: 5,
    pendingRequests: 4,
    responseRate: 67,
    weeklyActivity: [2, 4, 1, 3, 5, 2, 1],
    recentActivity: [
      { id: 1, action: "Introduction sent", candidate: "Senior React Developer", time: "2 hours ago", status: "pending" },
      { id: 2, action: "Response received", candidate: "DevOps Engineer", time: "1 day ago", status: "accepted" },
      { id: 3, action: "Introduction sent", candidate: "UX Designer", time: "2 days ago", status: "pending" },
      { id: 4, action: "Response received", candidate: "Data Scientist", time: "3 days ago", status: "rejected" },
    ]
  };

  const adminStats = {
    totalCandidates: 847,
    activeCandidates: 623,
    totalUsers: 45,
    totalIntroductions: 234,
    successRate: 73,
    monthlyGrowth: 15,
    topSkills: [
      { skill: "React", count: 156 },
      { skill: "Python", count: 134 },
      { skill: "AWS", count: 98 },
      { skill: "Node.js", count: 87 },
    ],
    recentActivity: [
      { id: 1, action: "New candidate added", user: "System", time: "1 hour ago" },
      { id: 2, action: "User registered", user: "jane.doe@company.com", time: "3 hours ago" },
      { id: 3, action: "Introduction completed", user: "john.smith@corp.com", time: "5 hours ago" },
      { id: 4, action: "Profile updated", user: "System", time: "1 day ago" },
    ]
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-warning" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Badge className="bg-success/10 text-success border-success/20">Accepted</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'pending':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (user?.role === 'admin') {
    return (
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold font-heading text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground">Platform overview and key metrics</p>
          </div>

          {/* Admin Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Candidates</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{adminStats.totalCandidates}</div>
                <p className="text-xs text-muted-foreground">
                  {adminStats.activeCandidates} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{adminStats.totalUsers}</div>
                <p className="text-xs text-success">+{adminStats.monthlyGrowth}% this month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Introductions</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{adminStats.totalIntroductions}</div>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{adminStats.successRate}%</div>
                <p className="text-xs text-success">+2% from last month</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Skills */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Top Skills in Demand</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {adminStats.topSkills.map((item, index) => (
                    <div key={item.skill} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">{index + 1}</Badge>
                        <span className="font-medium">{item.skill}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{item.count} candidates</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Platform Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Recent Platform Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {adminStats.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center space-x-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.action}</p>
                        <p className="text-xs text-muted-foreground">{activity.user}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{activity.time}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Recruiter Dashboard
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Your recruitment activity and metrics</p>
        </div>

        {/* Recruiter Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Introductions Sent</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recruiterStats.introductionsSent}</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Responses Received</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recruiterStats.responsesReceived}</div>
              <p className="text-xs text-success">+3 this week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Successful Matches</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recruiterStats.successfulMatches}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recruiterStats.responseRate}%</div>
              <p className="text-xs text-success">+5% from last month</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recruiterStats.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(activity.status)}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.action}</p>
                        <p className="text-xs text-muted-foreground">{activity.candidate}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(activity.status)}
                      <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pending Requests */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-accent rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Pending Requests</h4>
                  <Badge className="bg-warning/10 text-warning border-warning/20">{recruiterStats.pendingRequests}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  You have {recruiterStats.pendingRequests} introduction requests awaiting candidate responses.
                </p>
              </div>
              
              <div className="p-4 bg-primary/5 rounded-lg">
                <h4 className="font-medium mb-2">Explore New Candidates</h4>
                <p className="text-sm text-muted-foreground">
                  Discover more talent that matches your hiring needs.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;