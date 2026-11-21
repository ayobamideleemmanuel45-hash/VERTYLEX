import {Loader2} from 'lucide-react';
import {Navigate, useLocation} from 'react-router-dom';
import {type ReactNode} from 'react';
import {useAuth} from '../context/AuthContext';

export function AdminRoute({children}: {children: ReactNode}) {
  const {user, isAdmin, loading} = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="bg-[#FAFAFA] py-24">
        <div className="vtx-panel-enter mx-auto flex max-w-md items-center justify-center gap-2.5 px-4 text-sm text-[#5A5A62]">
          <Loader2 className="h-4 w-4 animate-spin text-[#1D4ED8]" aria-hidden="true" />
          <span>Checking account access...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    const target = `${location.pathname}${location.search}${location.hash}`;
    const params = new URLSearchParams({
      redirect: target,
    });
    return <Navigate to={`/login?${params.toString()}`} replace />;
  }

  if (!isAdmin || user.role !== 'admin') {
    return <Navigate to="/account" replace />;
  }

  return <>{children}</>;
}
