import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Clock, Loader2, ArrowUpDown } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useIntroductionRequests, type IntroductionRequest } from "../hooks/useIntroductionRequests";

const IntroductionRequests = () => {
  const { user } = useAuth();
  const { requests, loading, updateRequestStatus, cancelRequest } = useIntroductionRequests();

  const [sortField, setSortField] = useState<'candidate' | 'job' | 'company' | 'requested' | 'requester' | 'status'>('requested');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const handleSort = (field: 'candidate' | 'job' | 'company' | 'requested' | 'requester' | 'status') => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleRequestAction = (requestId: string, action: 'approve' | 'reject' | 'cancel') => {
    if (action === 'cancel') {
      cancelRequest(requestId);
    } else {
      // Map the action to the correct status
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
        case 'candidate':
          return r.candidate.display_name || '';
        case 'job':
          return r.job?.title || '';
        case 'company':
          return r.job?.company || '';
        case 'requested':
          return new Date(r.created_at).getTime();
        case 'requester':
          return `${r.requester.first_name} ${r.requester.last_name}`.trim();
        case 'status':
          return r.status || '';
        default:
          return '';
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
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
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

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending">Pending ({filterRequests('pending').length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({filterRequests('approved').length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({filterRequests('rejected').length})</TabsTrigger>
          <TabsTrigger value="all">All ({filterRequests('all').length})</TabsTrigger>
        </TabsList>

        {['pending', 'approved', 'rejected', 'all'].map(status => (
          <TabsContent key={status} value={status} className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button variant="ghost" className="px-0 font-medium" onClick={() => handleSort('candidate')}>
                        Candidate <ArrowUpDown className="ml-1 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="px-0 font-medium" onClick={() => handleSort('job')}>
                        Job Title <ArrowUpDown className="ml-1 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="px-0 font-medium" onClick={() => handleSort('company')}>
                        Company <ArrowUpDown className="ml-1 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="px-0 font-medium" onClick={() => handleSort('requested')}>
                        Requested <ArrowUpDown className="ml-1 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="px-0 font-medium" onClick={() => handleSort('requester')}>
                        Requester <ArrowUpDown className="ml-1 h-4 w-4" />
                      </Button>
                    </TableHead>
                    {status === 'all' && (
                      <TableHead>
                        <Button variant="ghost" className="px-0 font-medium" onClick={() => handleSort('status')}>
                          Status <ArrowUpDown className="ml-1 h-4 w-4" />
                        </Button>
                      </TableHead>
                    )}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRequests(status).map((request: IntroductionRequest) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">{request.candidate.display_name}</TableCell>
                      <TableCell>
                        {request.job ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="link" className="p-0 h-auto font-medium">
                                {request.job.title}
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>{request.job.title}</DialogTitle>
                                <DialogDescription>
                                  {request.job.company}
                                  {request.job.location ? ` • ${request.job.location}` : ""}
                                </DialogDescription>
                              </DialogHeader>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <span className="text-muted-foreground">General introduction request</span>
                        )}
                      </TableCell>
                      <TableCell>{request.job?.company ?? "-"}</TableCell>
                      <TableCell>{new Date(request.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{request.requester.first_name} {request.requester.last_name}</TableCell>
                      {status === 'all' && (
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                      )}
                      <TableCell className="text-right">
                        {request.status === 'pending' ? (
                          user?.role === 'admin' ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRequestAction(request.id, 'reject')}
                                className="border-red-200 text-red-700 hover:bg-red-50 mr-2"
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleRequestAction(request.id, 'approve')}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRequestAction(request.id, 'cancel')}
                              className="border-red-200 text-red-700 hover:bg-red-50"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Cancel
                            </Button>
                          )
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {sortedRequests(status).length === 0 && (
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