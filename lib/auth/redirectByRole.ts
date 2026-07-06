export type AppRole = 'customer' | 'supplier' | 'admin';

const normalizeRole = (role?: string | null): AppRole | null => {
  const value = role?.trim().toLowerCase();
  if (!value) return null;
  if (value === 'buyer') return 'customer';
  if (value === 'customer' || value === 'supplier' || value === 'admin') return value;
  return null;
};

export const getDashboardPathByRole = (role?: string | null) => {
  switch (normalizeRole(role)) {
    case 'customer':
      return '/customer/dashboard';
    case 'supplier':
      return '/supplier/dashboard';
    case 'admin':
      return '/admin';
    default:
      return '/login';
  }
};

export const normalizeAppRole = normalizeRole;

