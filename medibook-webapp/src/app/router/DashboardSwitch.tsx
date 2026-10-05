import { lazy } from 'react';
import { useParams } from 'react-router-dom';

const AdminDashboardScreen = lazy(() =>
  import('@/features/dashboard/presentation/screens/AdminDashboardScreen').then((m) => ({
    default: m.AdminDashboardScreen,
  })),
);
const ReceptionistDashboardScreen = lazy(() =>
  import('@/features/dashboard/presentation/screens/ReceptionistDashboardScreen').then((m) => ({
    default: m.ReceptionistDashboardScreen,
  })),
);

/**
 * `/:role/dashboard` renders the role's dashboard (the design's `Screen`
 * switch: receptionist → Front Desk, admin → Hospital Dashboard).
 */
export function DashboardSwitch() {
  const { role } = useParams();
  return role === 'admin' ? <AdminDashboardScreen /> : <ReceptionistDashboardScreen />;
}
