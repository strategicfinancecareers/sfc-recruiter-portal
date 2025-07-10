import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Mail, Phone, GraduationCap, Building } from "lucide-react";

interface RedactedResumeProps {
  candidate: {
    displayName: string;
    label: string;
    location: string;
    experience: number;
    education: string;
    skills: string[];
  };
}

const RedactedResume = ({ candidate }: RedactedResumeProps) => {
  return (
    <div className="max-w-2xl mx-auto bg-background p-6 space-y-6">
      {/* Header */}
      <div className="text-center border-b border-border pb-4">
        <h1 className="text-2xl font-heading font-bold text-foreground">{candidate.displayName}</h1>
        <p className="text-lg text-primary font-medium mt-1">{candidate.label}</p>
        <div className="flex items-center justify-center gap-4 mt-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {candidate.location}
          </div>
          <div className="flex items-center gap-1">
            <Mail className="h-4 w-4" />
            [email redacted]
          </div>
          <div className="flex items-center gap-1">
            <Phone className="h-4 w-4" />
            [phone redacted]
          </div>
        </div>
      </div>

      {/* Professional Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Professional Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Experienced {candidate.label.toLowerCase()} with {candidate.experience}+ years of proven expertise in 
            {candidate.skills.slice(0, 3).join(", ")} and related technologies. Demonstrated track record of 
            delivering high-quality solutions and collaborating effectively with cross-functional teams.
          </p>
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building className="h-5 w-5" />
            Technical Skills
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {candidate.skills.map((skill) => (
              <Badge key={skill} variant="secondary" className="text-sm">
                {skill}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Experience */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Work Experience
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-l-2 border-primary/20 pl-4 space-y-3">
            <div>
              <h4 className="font-semibold text-foreground">[Company Name Redacted]</h4>
              <p className="text-primary font-medium">{candidate.label}</p>
              <p className="text-sm text-muted-foreground">2020 - Present • {Math.floor(candidate.experience/2)} years</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
                <li>Led development of [project details redacted]</li>
                <li>Collaborated with cross-functional teams to [details redacted]</li>
                <li>Implemented solutions using {candidate.skills.slice(0, 2).join(" and ")}</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground">[Previous Company Redacted]</h4>
              <p className="text-primary font-medium">[Previous Role Redacted]</p>
              <p className="text-sm text-muted-foreground">2018 - 2020 • {Math.floor(candidate.experience/3)} years</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
                <li>Developed and maintained [details redacted]</li>
                <li>Worked extensively with {candidate.skills[0]} and related technologies</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Education */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Education
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <h4 className="font-semibold text-foreground">{candidate.education} Degree</h4>
            <p className="text-muted-foreground">[University Name Redacted]</p>
            <p className="text-sm text-muted-foreground">[Graduation Year Redacted]</p>
          </div>
        </CardContent>
      </Card>

      {/* Footer Note */}
      <div className="bg-warning/10 border border-warning/20 p-4 rounded-lg">
        <p className="text-sm text-warning-foreground">
          <strong>Privacy Notice:</strong> This is a redacted version of the candidate's resume. 
          Full contact information, company names, and detailed work history will be provided 
          upon successful introduction and mutual agreement.
        </p>
      </div>
    </div>
  );
};

export default RedactedResume;