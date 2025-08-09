import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Clock, Mail, Phone, MapPin, Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useIntroductionRequests, type IntroductionRequest } from "../hooks/useIntroductionRequests";

const IntroductionRequests = () => {
  const { user } = useAuth();
  const { requests, loading, updateRequestStatus, cancelRequest } = useIntroductionRequests();

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
            {filterRequests(status).map((request: IntroductionRequest) => (
              <Card key={request.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex space-x-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>
                        {request.candidate.display_name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 space-y-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {request.candidate.display_name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {request.job ? (
                            <>
                              Requested for: <span className="font-medium">{request.job.title}</span> at <span className="font-medium">{request.job.company}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">General introduction request</span>
                          )}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <Mail className="w-4 h-4" />
                          <span>{request.candidate.email}</span>
                        </div>
                        {request.candidate.phone && (
                          <div className="flex items-center space-x-2">
                            <Phone className="w-4 h-4" />
                            <span>{request.candidate.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4" />
                          <span>{request.candidate.location}</span>
                        </div>
                        <div className="text-sm text-gray-500">
                          Requested: {new Date(request.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm">
                          <span className="font-medium">Requester:</span> {request.requester.first_name} {request.requester.last_name}
                        </p>
                        <p className="text-sm text-gray-600">{request.requester.email}</p>
                      </div>

                      {request.message && (
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm font-medium text-blue-900 mb-1">Message:</p>
                          <p className="text-sm text-blue-800">{request.message}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end space-y-3">
                    {getStatusBadge(request.status)}
                    
                    {request.status === 'pending' && (
                      <div className="flex space-x-2">
                        {user?.role === 'admin' ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRequestAction(request.id, 'reject')}
                              className="border-red-200 text-red-700 hover:bg-red-50"
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
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            
            {filterRequests(status).length === 0 && (
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