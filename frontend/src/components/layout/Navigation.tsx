
// file: src/components/layout/Navigation.tsx

import { NavLink } from 'react-router-dom';
import { ROUTES } from '@/constants/config';

export function Navigation() {
  return (
    <nav className="navigation">
      <div className="nav-brand">
        <span className="brand-icon">🔍</span>
        <span className="brand-text">Saatvik EL</span>
      </div>
      
      <div className="nav-links">
        <NavLink to={ROUTES.DASHBOARD} className="nav-link">
          🏠 Dashboard
        </NavLink>
        <NavLink to={ROUTES.HISTORY} className="nav-link">
          📋 History
        </NavLink>
      </div>
    </nav>
  );
}