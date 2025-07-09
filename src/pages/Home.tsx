
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Briefcase, Star } from "lucide-react";
import { Link } from "react-router-dom";

const Home = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <img 
                src="/lovable-uploads/e9ac1787-7fab-4403-86f1-becbe7fa7524.png" 
                alt="Strategic Finance Recruiting" 
                className="h-8 w-auto mr-2"
              />
            </div>
            <div className="flex space-x-4">
              <Link to="/login">
                <Button variant="ghost">Log In</Button>
              </Link>
              <Link to="/signup">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Find Top Talent,
            <span className="text-green-600"> Faster</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Connect with pre-screened candidates who are actively looking for new opportunities. 
            Our platform streamlines the recruitment process with intelligent matching and seamless introductions.
          </p>
          <div className="flex justify-center space-x-4">
            <Link to="/signup">
              <Button size="lg" className="bg-green-600 hover:bg-green-700">
                Start Recruiting
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <Users className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-3">Quality Candidates</h3>
            <p className="text-gray-600">Access to a curated pool of pre-screened professionals ready for their next opportunity.</p>
          </div>
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <Star className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-3">Smart Matching</h3>
            <p className="text-gray-600">Advanced filtering by skills, experience, location, and education to find perfect matches.</p>
          </div>
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <Briefcase className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-3">Seamless Process</h3>
            <p className="text-gray-600">Streamlined introduction workflow with automated candidate outreach and response tracking.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
