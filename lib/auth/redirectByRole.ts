export type AppRole = 'customer' | 'supplier' | 'admin' | 'support';

const normalizeRole = (role?: string | null): AppRole | null => {
  const value = role?.trim().toLowerCase();
  if (!value) return null;
  if (value === 'buyer') return 'customer';
  if (value === 'customer' || value === 'supplier' || value === 'admin' || value === 'support') return value;
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
    case 'support':
      return '/admin/supplier-inbox';
    default:
      return '/login';
  }
};

export const normalizeAppRole = normalizeRole;
