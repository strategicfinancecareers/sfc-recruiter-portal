
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Briefcase, Users, Heart, Settings, LogOut, Gauge, Menu, Handshake } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useState } from 'react';

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Gauge },
    { name: 'Browse Candidates', href: '/browse', icon: Users },
    { name: 'Jobs', href: '/jobs', icon: Briefcase },
    { name: 'Introduction Requests', href: '/introductions', icon: Handshake },
    { name: 'Favorites', href: '/favorites', icon: Heart },
    { name: 'Account', href: '/account', icon: Settings },
  ];

  if (user?.role === 'admin') {
    navigation.push({ name: 'Admin', href: '/admin', icon: Users });
  }

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="h-screen bg-background flex">
      {/* Sidebar */}
      <div className={`bg-gradient-card shadow-glow border-r transition-all duration-300 ease-out relative flex flex-col ${sidebarOpen ? 'w-64' : 'w-16'}`}>
        <div className="flex items-center justify-between p-4 border-b backdrop-blur-sm">
          {sidebarOpen && (
            <div className="flex items-center">
              <img 
                src="/lovable-uploads/e9ac1787-7fab-4403-86f1-becbe7fa7524.png" 
                alt="Strategic Finance Recruiting" 
                className="h-8 w-auto mr-2"
              />
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hover:bg-gradient-primary-soft hover:scale-105 transition-all duration-200"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        
        <nav className="mt-8 flex-1 overflow-y-auto">
          <div className="px-2 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ease-out
                    hover:scale-[1.02] hover:shadow-soft
                    ${isActive 
                      ? 'bg-gradient-primary text-primary-foreground shadow-glow scale-[1.02]' 
                      : 'text-muted-foreground hover:bg-gradient-primary-soft hover:text-foreground'
                    }
                  `}
                >
                  <item.icon
                    className={`
                      ${sidebarOpen ? 'mr-3' : 'mx-auto'} h-5 w-5 transition-all duration-200
                      ${isActive ? 'text-primary-foreground scale-110' : 'text-muted-foreground group-hover:text-foreground group-hover:scale-110'}
                    `}
                  />
                  {sidebarOpen && <span className="transition-all duration-200">{item.name}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className={`p-4 border-t border-border ${sidebarOpen ? 'w-64' : 'w-16'}`}>
          {sidebarOpen && (
            <div className="mb-4 pt-4">
              <p className="text-sm font-medium text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
          )}
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={`${sidebarOpen ? 'w-full justify-start' : 'w-10 h-10 p-0'} text-muted-foreground hover:text-foreground hover:bg-gradient-primary-soft hover:scale-105 transition-all duration-200`}
          >
            <LogOut className={`h-5 w-5 ${sidebarOpen ? 'mr-2' : ''} transition-transform duration-200 group-hover:scale-110`} />
            {sidebarOpen && <span className="transition-all duration-200">Sign Out</span>}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;
