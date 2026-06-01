import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Handshake, CheckCircle, Clock } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface Stats {
  totalCandidates: number | null;
  introsSent: number | null;
  introsApproved: number | null;
  introsPending: number | null;
}

function StatCard({
  title,
  value,
  icon: Icon,
  sub,
  loading,
}: {
  title: string;
  value: number | null;
  icon: React.ElementType;
  sub?: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-16 bg-muted animate-pulse rounded" />
        ) : (
          <div className="text-3xl font-bold text-foreground">{value ?? '—'}</div>
        )}
        {sub && !loading && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalCandidates: null,
    introsSent: null,
    introsApproved: null,
    introsPending: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchStats = async () => {
      setLoading(true);
      try {
        // Candidates count is fine via browser client (RLS allows authenticated read).
        // Intro counts must go through the service-role API — direct browser
        // queries hit RLS 403 on introduction_requests for recruiter role.
        const [candidatesRes, introsRes] = await Promise.all([
          supabase
            .from('candidates')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active'),
          fetch(`/api/recruiter-intros?recruiterId=${encodeURIComponent(user.id)}`),
        ]);

        if (!introsRes.ok) {
          throw new Error(`recruiter-intros returned ${introsRes.status}`);
        }
        const { requests: intros } = await introsRes.json();
        const list: Array<{ status: string }> = intros || [];

        setStats({
          totalCandidates: candidatesRes.count ?? 0,
          introsSent: list.length,
          introsApproved: list.filter(r => r.status === 'approved').length,
          introsPending: list.filter(r => r.status === 'pending').length,
        });
      } catch (err) {
        console.error('[Dashboard] stats fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user?.id]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Welcome back{user?.first_name ? `, ${user.first_name}` : ''} 👋
          </h1>
          <p className="text-muted-foreground mt-1">Here's your recruitment activity at a glance.</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Candidates in Network"
            value={stats.totalCandidates}
            icon={Users}
            sub="Active profiles"
            loading={loading}
          />
          <StatCard
            title="Introductions Sent"
            value={stats.introsSent}
            icon={Handshake}
            sub="All time"
            loading={loading}
          />
          <StatCard
            title="Approved"
            value={stats.introsApproved}
            icon={CheckCircle}
            sub="Candidate accepted"
            loading={loading}
          />
          <StatCard
            title="Pending Response"
            value={stats.introsPending}
            icon={Clock}
            sub="Awaiting candidate"
            loading={loading}
          />
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base">Browse Candidates</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Discover finance professionals that match your hiring needs.
              </p>
              <Link
                to="/browse"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#008037] hover:bg-[#006a2d] text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Users className="h-4 w-4" />
                Browse Now
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base">Introduction Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {stats.introsPending
                  ? `You have ${stats.introsPending} introduction${stats.introsPending === 1 ? '' : 's'} awaiting a response.`
                  : 'Track the status of all your introduction requests.'}
              </p>
              <Link
                to="/introductions"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Handshake className="h-4 w-4" />
                View Requests
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
