import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Clock, Mail, Phone, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const IntroductionRequests = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState([
    {
      id: 1,
      candidateName: "Sarah Chen",
      candidateEmail: "sarah.chen@email.com",
      candidatePhone: "+1 (555) 123-4567",
      candidateLocation: "San Francisco, CA",
      companyName: "TechCorp",
      position: "Senior Financial Analyst",
      requesterName: "Mark Johnson",
      requesterEmail: "mark@techcorp.com",
      requestDate: "2024-01-10",
      status: "pending",
      avatar: "/api/placeholder/100/100"
    },
    {
      id: 2,
      candidateName: "David Rodriguez",
      candidateEmail: "david.r@email.com",
      candidatePhone: "+1 (555) 987-6543",
      candidateLocation: "New York, NY",
      companyName: "Finance Plus",
      position: "Investment Banking Associate",
      requesterName: "Lisa Zhang",
      requesterEmail: "lisa@financeplus.com",
      requestDate: "2024-01-08",
      status: "pending",
      avatar: "/api/placeholder/100/100"
    },
    {
      id: 3,
      candidateName: "Emily Watson",
      candidateEmail: "emily.watson@email.com",
      candidatePhone: "+1 (555) 456-7890",
      candidateLocation: "Chicago, IL",
      companyName: "Capital Solutions",
      position: "Financial Manager",
      requesterName: "Robert Kim",
      requesterEmail: "robert@capitalsol.com",
      requestDate: "2024-01-05",
      status: "approved",
      avatar: "/api/placeholder/100/100"
    }
  ]);

  const handleRequestAction = (requestId: number, action: 'approve' | 'reject') => {
    setRequests(prev => 
      prev.map(req => 
        req.id === requestId 
          ? { ...req, status: action === 'approve' ? 'approved' : 'rejected' }
          : req
      )
    );
    
    toast({
      title: `Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
      description: `Introduction request has been ${action === 'approve' ? 'approved' : 'rejected'}.`,
    });
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Introduction Requests</h1>
        <div className="text-sm text-gray-500">
          {requests.filter(r => r.status === 'pending').length} pending requests
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All ({requests.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({requests.filter(r => r.status === 'pending').length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({requests.filter(r => r.status === 'approved').length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({requests.filter(r => r.status === 'rejected').length})</TabsTrigger>
        </TabsList>

        {['all', 'pending', 'approved', 'rejected'].map(status => (
          <TabsContent key={status} value={status} className="space-y-4">
            {filterRequests(status).map((request) => (
              <Card key={request.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex space-x-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={request.avatar} alt={request.candidateName} />
                      <AvatarFallback>{request.candidateName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 space-y-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{request.candidateName}</h3>
                        <p className="text-sm text-gray-600">Requested for: <span className="font-medium">{request.position}</span> at <span className="font-medium">{request.companyName}</span></p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <Mail className="w-4 h-4" />
                          <span>{request.candidateEmail}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Phone className="w-4 h-4" />
                          <span>{request.candidatePhone}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4" />
                          <span>{request.candidateLocation}</span>
                        </div>
                        <div className="text-sm text-gray-500">
                          Requested: {new Date(request.requestDate).toLocaleDateString()}
                        </div>
                      </div>
                      
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm"><span className="font-medium">Requester:</span> {request.requesterName}</p>
                        <p className="text-sm text-gray-600">{request.requesterEmail}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end space-y-3">
                    {getStatusBadge(request.status)}
                    
                    {request.status === 'pending' && (
                      <div className="flex space-x-2">
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