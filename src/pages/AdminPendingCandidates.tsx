import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import LoaderScreen from '../components/LoaderScreen';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, ChevronRight, CheckCircle, XCircle, Mail, Phone, MapPin, GraduationCap, Briefcase } from 'lucide-react';

interface PendingListRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  display_name: string;
  label: string;
  location: string;
  experience: number;
  education: string;
  profile_description: string | null;
  target_roles: string[] | null;
  primary_background: string | null;
  secondary_backgrounds: string[] | null;
  target_salary: string | null;
  work_preference: string | null;
  resume_full_url: string | null;
  created_at: string;
  skills_count: number;
}

interface FullCandidate extends PendingListRow {
  highest_education_level: string | null;
  preferred_cities: string[] | null;
  linkedin_url: string | null;
  status: string;
  skills: string[];
}

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export default function AdminPendingCandidates() {
  const { user, isLoading, isProfileLoading } = useAuth();

  const [list, setList] = useState<PendingListRow[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FullCandidate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // ── Fetch list once user is confirmed admin/owner ──────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    if (user.role !== 'admin' && user.role !== 'owner') return;

    (async () => {
      try {
        const res = await fetch(`/api/pending-candidates?userId=${encodeURIComponent(user.id)}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Failed to load (${res.status})`);
        setList(body.candidates || []);
      } catch (err: any) {
        console.error('[AdminPendingCandidates] list fetch failed:', err);
        setListError(err?.message || 'Failed to load pending candidates');
      }
    })();
  }, [user?.id, user?.role]);

  // ── Fetch detail when selectedId changes ────────────────────────────────────
  useEffect(() => {
    if (!user?.id || !selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    setDetailError(null);
    setDownloadError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/pending-candidates?userId=${encodeURIComponent(user.id)}&id=${encodeURIComponent(selectedId)}`
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Failed to load (${res.status})`);
        setDetail(body.candidate);
      } catch (err: any) {
        console.error('[AdminPendingCandidates] detail fetch failed:', err);
        setDetailError(err?.message || 'Failed to load candidate detail');
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [selectedId, user?.id]);

  const handleDownloadResume = async () => {
    if (!detail?.id || !user?.id) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch(
        `/api/get-resume-url?candidateId=${encodeURIComponent(detail.id)}&adminUserId=${encodeURIComponent(user.id)}`
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) throw new Error(body.error || `Failed (${res.status})`);
      window.open(body.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      console.error('[AdminPendingCandidates] resume download failed:', err);
      setDownloadError(err?.message || 'Failed to generate download link');
    } finally {
      setDownloading(false);
    }
  };

  // ── Auth gates ──────────────────────────────────────────────────────────────
  // Same pattern as <ProtectedRoute requireAdmin> — admin/owner only, fallback
  // to /dashboard on mismatch. Server-side API enforces the real check;
  // client-side is UX only.
  if (isLoading || isProfileLoading) return <LoaderScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin' && user.role !== 'owner') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading text-foreground">Pending Candidates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve new applicants before they're visible to recruiters.
          </p>
        </div>
        {list && (
          <Badge variant="outline" className="text-sm">
            {list.length} {list.length === 1 ? 'pending' : 'pending'}
          </Badge>
        )}
      </div>

      {listError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {listError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* ── Left panel: list ── */}
        <div className="space-y-2">
          {list === null && !listError && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          )}
          {list?.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No pending candidates 🎉
              </CardContent>
            </Card>
          )}
          {list?.map(row => {
            const isSelected = row.id === selectedId;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedId(row.id)}
                className={`w-full text-left rounded-lg border p-4 transition-all ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className="font-semibold text-sm text-gray-900 line-clamp-1">
                  {row.display_name || row.label || row.name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                  {row.label} · {row.location}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">
                    {daysSince(row.created_at) === 0 ? 'Today' : `${daysSince(row.created_at)}d ago`}
                  </span>
                  <span className="text-xs font-medium text-emerald-700 inline-flex items-center gap-1">
                    Review <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Right panel: detail ── */}
        <div>
          {!selectedId && (
            <Card>
              <CardContent className="py-20 text-center text-sm text-muted-foreground">
                Select a candidate on the left to review their application.
              </CardContent>
            </Card>
          )}
          {selectedId && detailLoading && (
            <div className="flex justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
            </div>
          )}
          {selectedId && detailError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {detailError}
            </div>
          )}
          {selectedId && detail && !detailLoading && (
            <div className="space-y-6">
              {/* Identity (admin-only) */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Identity (admin-only)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium w-20 text-muted-foreground">Name</span>
                    <span>{detail.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a href={`mailto:${detail.email}`} className="text-emerald-700 hover:underline">
                      {detail.email}
                    </a>
                  </div>
                  {detail.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <a href={`tel:${detail.phone}`} className="text-emerald-700 hover:underline">
                        {detail.phone}
                      </a>
                    </div>
                  )}
                  {detail.linkedin_url && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium w-20 text-muted-foreground">LinkedIn</span>
                      <a href={detail.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">
                        {detail.linkedin_url}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Anonymous profile (what recruiters will see) */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Anonymous Profile (recruiter view)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="font-semibold text-base">{detail.display_name}</p>
                    <p className="text-muted-foreground">{detail.label}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{detail.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-muted-foreground" />
                      <span>{detail.experience} yrs</span>
                    </div>
                    <div className="flex items-center gap-2 col-span-2">
                      <GraduationCap className="w-4 h-4 text-muted-foreground" />
                      <span>{detail.education}{detail.highest_education_level ? ` (${detail.highest_education_level})` : ''}</span>
                    </div>
                  </div>

                  {detail.profile_description && (
                    <div className="pt-2 border-t">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Bio</p>
                      <p className="whitespace-pre-line">{detail.profile_description}</p>
                    </div>
                  )}

                  {detail.primary_background && (
                    <div className="pt-2 border-t">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Background</p>
                      <p>{detail.primary_background}</p>
                      {detail.secondary_backgrounds && detail.secondary_backgrounds.length > 0 && (
                        <p className="text-muted-foreground text-xs mt-1">
                          Also: {detail.secondary_backgrounds.join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                    {detail.target_salary && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Target comp</p>
                        <p>{detail.target_salary}</p>
                      </div>
                    )}
                    {detail.work_preference && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Work pref</p>
                        <p>{detail.work_preference}</p>
                      </div>
                    )}
                    {detail.target_roles && detail.target_roles.length > 0 && (
                      <div className="col-span-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Target roles</p>
                        <p>{detail.target_roles.join(', ')}</p>
                      </div>
                    )}
                    {detail.preferred_cities && detail.preferred_cities.length > 0 && (
                      <div className="col-span-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Preferred cities</p>
                        <p>{detail.preferred_cities.join(', ')}</p>
                      </div>
                    )}
                  </div>

                  {detail.skills && detail.skills.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detail.skills.map(s => (
                          <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Resume */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Resume</CardTitle>
                </CardHeader>
                <CardContent>
                  {detail.resume_full_url ? (
                    <>
                      <Button
                        onClick={handleDownloadResume}
                        disabled={downloading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {downloading ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating link…</>
                        ) : (
                          <><Download className="w-4 h-4 mr-2" /> Download Resume</>
                        )}
                      </Button>
                      {downloadError && (
                        <p className="text-xs text-red-600 mt-2">{downloadError}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No resume uploaded.</p>
                  )}
                </CardContent>
              </Card>

              {/* SFC's Take placeholder */}
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-base text-muted-foreground">SFC's Take</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground italic">Coming soon — Batch 2 will add AI-assisted reviewer notes here.</p>
                </CardContent>
              </Card>

              {/* Approve/Reject (stubbed) */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => alert('Batch 2 will wire this up')}
                >
                  <XCircle className="w-4 h-4 mr-2" /> Reject
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => alert('Batch 2 will wire this up')}
                >
                  <CheckCircle className="w-4 h-4 mr-2" /> Approve
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
