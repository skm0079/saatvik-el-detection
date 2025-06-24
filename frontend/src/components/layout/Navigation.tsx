// file: src/components/layout/Navigation.tsx

import { NavLink } from 'react-router-dom';
import { useHealth } from '@/hooks/useApi';
import { ROUTES } from '@/constants/config';

export function Navigation() {
  const { data: health } = useHealth();

  return (
    <nav className="bg-slate-800 border-b border-slate-700 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
              <span className="text-xl font-bold text-white">🔍</span>
            </div>
            <div className="flex flex-col">
              <span className="text-white font-bold text-lg">Saatvik EL</span>
              <span className="text-slate-400 text-xs">Detection System</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex space-x-1">
            <NavLink
              to={ROUTES.LIVE}
              className={({ isActive }) =>
                `flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`
              }
            >
              <span className="mr-2">📺</span>
              Live View
            </NavLink>

            <NavLink
              to={ROUTES.DASHBOARD}
              className={({ isActive }) =>
                `flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`
              }
            >
              <span className="mr-2">🏠</span>
              Dashboard
            </NavLink>

            <NavLink
              to={ROUTES.HISTORY}
              className={({ isActive }) =>
                `flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`
              }
            >
              <span className="mr-2">📋</span>
              History
            </NavLink>
          </div>

          {/* Status Indicator with Machine Info */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-slate-400 text-sm">AI Ready</span>
            </div>

            {health && (
              <div className="flex items-center space-x-2 text-slate-400 text-sm">
                <span>•</span>
                <span>🤖 {health.machine_name}</span>
                <span>•</span>
                <span className="capitalize">{health.environment}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}