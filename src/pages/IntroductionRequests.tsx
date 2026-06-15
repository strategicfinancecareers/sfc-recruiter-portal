import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import RedactedResume from "@/components/RedactedResume";
import LoaderScreen from "@/components/LoaderScreen";
import { CheckCircle, XCircle, Clock, Download, Mail, Phone, Loader2, MapPin, Calendar, GraduationCap, Briefcase, Eye } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useIntroductionRequests, type IntroductionRequest } from "../hooks/useIntroductionRequests";

interface FullCandidate {
  id: string;
  name: string;
  display_name: string;
  email: string;
  phone: string | null;
  resume_full_url: string | null;
}

const IntroductionRequests = () => {
  const { user } = useAuth();
  const { requests, loading, error, updateRequestStatus, cancelRequest } = useIntroductionRequests();

  const [downloadingResume, setDownloadingResume] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // Cards display intros sorted by request date (newest first). The
  // multi-column sort UI from the old table layout is gone; if we add
  // sort controls back, restore these as useState.
  const sortField: 'candidate' | 'job' | 'company' | 'requested' | 'requester' | 'status' = 'requested';
  const sortDir: 'asc' | 'desc' = 'desc';

  // State for approved candidate modal
  const [approvedModal, setApprovedModal] = useState<{ open: boolean; request: IntroductionRequest | null; candidate: FullCandidate | null; loading: boolean }>({
    open: false,
    request: null,
    candidate: null,
    loading: false,
  });

const openApprovedModal = (request: IntroductionRequest) => {
    // Use already-loaded candidate data — no second network call needed
    const c = request.candidate;
    setDownloadError(null);
    setApprovedModal({
      open: true,
      request,
      candidate: c
        ? {
            id: c.id,
            name: c.name,
            display_name: c.display_name,
            email: c.email,
            phone: c.phone ?? null,
            resume_full_url: c.resume_full_url ?? null,
          }
        : null,
      loading: false,
    });
  };

  // Request a fresh signed URL for the resume, then open it in a new tab.
  // The `resume_full_url` column holds a Supabase Storage path (bucket is
  // private); /api/get-resume-url verifies approval and returns a 1-hour URL.
  const handleDownloadResume = async () => {
    const candidateId = approvedModal.candidate?.id;
    if (!candidateId || !user?.id) {
      setDownloadError('Missing candidate or user — please refresh and try again.');
      return;
    }
    setDownloadingResume(true);
    setDownloadError(null);
    try {
      const res = await fetch(
        `/api/get-resume-url?candidateId=${encodeURIComponent(candidateId)}&requesterId=${encodeURIComponent(user.id)}`
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        throw new Error(body.error || `Failed to generate download link (${res.status})`);
      }
      window.open(body.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      console.error('[IntroductionRequests] resume download failed:', err);
      setDownloadError(err?.message || 'Failed to generate download link');
    } finally {
      setDownloadingResume(false);
    }
  };

  const handleRequestAction = (requestId: string, action: 'approve' | 'reject' | 'cancel') => {
    if (action === 'cancel') {
      cancelRequest(requestId);
    } else {
      const status = action === 'approve' ? 'approved' : 'rejected';
      updateRequestStatus(requestId, status);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return null;
    }
  };

  const filterRequests = (status: string) => {
    return status === 'all' ? requests : requests.filter(req => req.status === status);
  };

  const sortedRequests = (status: string) => {
    const data = (status === 'all' ? requests : requests.filter(req => req.status === status)).slice();
    const getValue = (r: IntroductionRequest): string | number => {
      switch (sortField) {
        case 'candidate': return r.candidate.display_name || '';
        case 'job': return r.job?.title || '';
        case 'company': return r.job?.company || '';
        case 'requested': return new Date(r.created_at).getTime();
        case 'requester': return `${r.requester.first_name} ${r.requester.last_name}`.trim();
        case 'status': return r.status || '';
        default: return '';
      }
    };
    return data.sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  };

  if (loading) {
    return <LoaderScreen />;
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <p className="text-red-600 font-medium">Failed to load introduction requests</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold font-heading text-foreground">Introduction Requests</h1>
        <div className="text-sm text-muted-foreground">
          {filterRequests('pending').length} pending requests
        </div>
      </div>

      {/* Approved candidate details modal */}
      <Dialog open={approvedModal.open} onOpenChange={open => setApprovedModal(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              {approvedModal.candidate?.name || approvedModal.request?.candidate.display_name}
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 ml-1">
                <CheckCircle className="w-3 h-3 mr-1" />Approved
              </Badge>
            </DialogTitle>
            <DialogDescription>
              {approvedModal.request?.job?.title && (
                <span>{approvedModal.request.job.title} · {approvedModal.request.job.company}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {approvedModal.loading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Loading candidate details…</div>
          ) : (
            <div className="space-y-4 mt-2">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-green-700 shrink-0" />
                  <a
                    href={`mailto:${approvedModal.candidate?.email}`}
                    className="text-green-800 font-medium hover:underline"
                  >
                    {approvedModal.candidate?.email}
                  </a>
                </div>
                {approvedModal.candidate?.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-green-700 shrink-0" />
                    <a
                      href={`tel:${approvedModal.candidate.phone}`}
                      className="text-green-800 font-medium hover:underline"
                    >
                      {approvedModal.candidate.phone}
                    </a>
                  </div>
                )}
              </div>

              {approvedModal.candidate?.resume_full_url && (
                <>
                  <button
                    type="button"
                    onClick={handleDownloadResume}
                    disabled={downloadingResume}
                    className="flex items-center gap-2 w-full justify-center rounded-lg border border-green-300 bg-white text-green-800 font-medium px-4 py-2 text-sm hover:bg-green-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {downloadingResume ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating download link…
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download Resume
                      </>
                    )}
                  </button>
                  {downloadError && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                      {downloadError}
                    </p>
                  )}
                </>
              )}

              {/* SFC Take — full reveal post-approval (Batch 2). No name
                  redaction needed here; the candidate's identity is already
                  visible above. */}
              {approvedModal.request?.candidate?.sfc_take_published_at && approvedModal.request?.candidate?.sfc_take && (
                <div className="border-t pt-4 space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-[#006a2d] italic mb-1.5">SFC Take</p>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                      {approvedModal.request.candidate.sfc_take}
                    </p>
                  </div>

                  {approvedModal.request.candidate.sfc_role_fit && approvedModal.request.candidate.sfc_role_fit.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1.5">Role fit</p>
                      <div className="flex flex-wrap gap-1">
                        {approvedModal.request.candidate.sfc_role_fit.map((rf: string, i: number) => (
                          <Badge key={`rf-${i}`} variant="outline" className="text-xs border-[#008037]/25 bg-[#008037]/5 text-[#005a26]">{rf}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {approvedModal.request.candidate.sfc_strengths && approvedModal.request.candidate.sfc_strengths.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1.5">Strengths</p>
                      <div className="flex flex-wrap gap-1">
                        {approvedModal.request.candidate.sfc_strengths.map((s: string, i: number) => (
                          <Badge key={`st-${i}`} variant="outline" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {approvedModal.request.candidate.sfc_considerations && approvedModal.request.candidate.sfc_considerations.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1.5">
                        Considerations
                        <span className="ml-1 normal-case text-muted-foreground/70 font-normal">(positioning notes)</span>
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {approvedModal.request.candidate.sfc_considerations.map((c: string, i: number) => (
                          <Badge key={`co-${i}`} variant="outline" className="text-xs border-amber-200 bg-amber-50 text-amber-900">{c}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending">Pending ({filterRequests('pending').length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({filterRequests('approved').length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({filterRequests('rejected').length})</TabsTrigger>
          <TabsTrigger value="all">All ({filterRequests('all').length})</TabsTrigger>
        </TabsList>

        {(['pending', 'approved', 'rejected', 'all'] as const).map(status => (
          <TabsContent key={status} value={status} className="space-y-4">
            {sortedRequests(status).length > 0 ? (
              // Card grid — mirrors the Browse Candidates page layout so the
              // recruiter portal feels visually consistent. Same Card shape,
              // padding, hover shadow, header/content rhythm, badge style.
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sortedRequests(status).map((request: IntroductionRequest) => {
                  // Identity reveal rule:
                  //   approved → real candidate name (post-approval reveal)
                  //   pending/rejected → anonymous display_name
                  // Admin sees the real name as a small subtitle either way.
                  const isApproved = request.status === 'approved';
                  const isAdmin = user?.role === 'admin';
                  const titleName = isApproved
                    ? (request.candidate.name || request.candidate.display_name)
                    : request.candidate.display_name;
                  const adminSubtitle = isAdmin && !isApproved && request.candidate.name && request.candidate.name !== request.candidate.display_name
                    ? request.candidate.name
                    : null;

                  return (
                    <Card
                      key={request.id}
                      className="transition-all duration-200 hover:shadow-lg h-full flex flex-col"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg font-heading truncate">{titleName}</CardTitle>
                            {adminSubtitle && (
                              <p className="text-sm text-muted-foreground truncate">{adminSubtitle}</p>
                            )}
                            <CardDescription className="text-primary font-medium truncate">
                              {request.candidate.label}
                            </CardDescription>
                          </div>
                          <div className="shrink-0">
                            {getStatusBadge(request.status)}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4 flex flex-col h-full">
                        {/* Job + company */}
                        <div className="text-sm text-muted-foreground">
                          <div className="flex items-start gap-1.5">
                            <Briefcase className="h-4 w-4 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-foreground font-medium truncate">
                                {request.job?.title || 'General introduction'}
                              </p>
                              {request.job?.company && (
                                <p className="text-xs truncate">{request.job.company}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Candidate metadata — same icon set as Browse */}
                        <div className="space-y-2">
                          {request.candidate.location && (
                            <div className="flex items-center text-sm text-muted-foreground">
                              <MapPin className="h-4 w-4 mr-1" />
                              <span className="truncate">{request.candidate.location}</span>
                            </div>
                          )}
                          {request.candidate.experience != null && (
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4 mr-1" />
                              {request.candidate.experience} years experience
                            </div>
                          )}
                          {request.candidate.education && (
                            <div className="flex items-center text-sm text-muted-foreground">
                              <GraduationCap className="h-4 w-4 mr-1" />
                              <span className="truncate">{request.candidate.education}</span>
                            </div>
                          )}
                        </div>

                        {/* Skills (top 3 + count) — matches Browse */}
                        {request.candidate.skills && request.candidate.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {request.candidate.skills.slice(0, 3).map(skill => (
                              <Badge key={skill.id} variant="secondary" className="text-xs">
                                {skill.skill}
                              </Badge>
                            ))}
                            {request.candidate.skills.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{request.candidate.skills.length - 3} more
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Footer: requester + date + status-appropriate action */}
                        <div className="mt-auto pt-3 border-t space-y-3">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="truncate">
                              Sent by {request.requester.first_name} {request.requester.last_name}
                            </span>
                            <span className="shrink-0 ml-2">
                              {new Date(request.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>

                          {/* Status-appropriate CTAs */}
                          {request.status === 'approved' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => openApprovedModal(request)}
                            >
                              <Eye className="mr-1 h-4 w-4" />
                              View full profile
                            </Button>
                          )}
                          {request.status === 'pending' && (
                            <p className="text-xs text-center text-muted-foreground italic">
                              Awaiting candidate response
                            </p>
                          )}

                          {/* Admin-only approve/reject for pending */}
                          {isAdmin && request.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRequestAction(request.id, 'reject')}
                                className="border-red-200 text-red-700 hover:bg-red-50 flex-1"
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleRequestAction(request.id, 'approve')}
                                className="bg-green-600 hover:bg-green-700 flex-1"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                            </div>
                          )}

                          {/* Redacted-profile dialog trigger for pending/rejected (preserves existing behavior) */}
                          {!isApproved && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="w-full text-xs text-muted-foreground hover:text-foreground">
                                  <Eye className="mr-1 h-3 w-3" />
                                  View redacted profile
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle className="font-heading">{request.candidate.display_name}</DialogTitle>
                                  {isAdmin && (
                                    <p className="text-sm text-muted-foreground">{request.candidate.name}</p>
                                  )}
                                  <DialogDescription>{request.candidate.label}</DialogDescription>
                                </DialogHeader>
                                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                                  <div className="space-y-4">
                                    <div className="bg-muted p-4 rounded-lg">
                                      <h4 className="font-medium mb-2">Professional Summary</h4>
                                      <p className="text-sm text-muted-foreground">{request.candidate.profile_description}</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div>
                                        <h4 className="font-medium mb-2">Location</h4>
                                        <p className="text-sm text-muted-foreground">{request.candidate.location}</p>
                                      </div>
                                      <div>
                                        <h4 className="font-medium mb-2">Experience</h4>
                                        <p className="text-sm text-muted-foreground">{request.candidate.experience} years</p>
                                      </div>
                                      <div>
                                        <h4 className="font-medium mb-2">Education</h4>
                                        <p className="text-sm text-muted-foreground">{request.candidate.education}</p>
                                      </div>
                                      {request.candidate.highest_education_level && (
                                        <div>
                                          <h4 className="font-medium mb-2">Education Level</h4>
                                          <p className="text-sm text-muted-foreground">{request.candidate.highest_education_level}</p>
                                        </div>
                                      )}
                                      <div>
                                        <h4 className="font-medium mb-2">Skills</h4>
                                        <div className="flex flex-wrap gap-1">
                                          {(request.candidate.skills || []).map((skill) => (
                                            <Badge key={skill.id} variant="secondary" className="text-xs">
                                              {skill.skill}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="bg-warning/10 border border-warning/20 p-4 rounded-lg">
                                      <p className="text-sm text-warning-foreground">
                                        <strong>Note:</strong> This is a redacted profile preview. Full contact information and detailed work history will be shared upon successful introduction.
                                      </p>
                                    </div>
                                  </div>
                                  <div className="space-y-4">
                                    <div>
                                      <h4 className="font-medium mb-2">Resume Preview</h4>
                                      <div className="border rounded-lg max-h-96 overflow-y-auto bg-background">
                                        <RedactedResume
                                          candidate={{
                                            displayName: request.candidate.display_name,
                                            label: request.candidate.label,
                                            location: request.candidate.location,
                                            experience: request.candidate.experience,
                                            education: request.candidate.education,
                                            skills: (request.candidate.skills || []).map(s => s.skill)
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No {status === 'all' ? '' : status} requests found.</p>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default IntroductionRequests;
