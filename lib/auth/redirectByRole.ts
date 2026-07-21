export type AppRole = 'customer' | 'supplier' | 'admin' | 'support' | 'procurement';

const normalizeRole = (role?: string | null): AppRole | null => {
  const value = role?.trim().toLowerCase();
  if (!value) return null;
  if (value === 'buyer') return 'customer';
  if (value === 'customer' || value === 'supplier' || value === 'admin' || value === 'support' || value === 'procurement') return value;
  return null;
};

export const getDashboardPathByRole = (role?: string | null) => {
  switch (normalizeRole(role)) {
    case 'customer':
      return '/customer/dashboard';
    case 'supplier':
      return '/supplier/dashboard';
    case 'admin':
    case 'procurement':
      return '/admin';
    case 'support':
      return '/admin/supplier-inbox';
    default:
      return '/login';
  }
};

export const normalizeAppRole = normalizeRole;

export type PublicHubNavigation = {
  role: 'admin' | 'customer' | 'supplier';
  label: 'Admin HUB' | 'Customer HUB' | 'Supplier HUB';
  href: '/admin' | '/customer/dashboard' | '/supplier/dashboard';
  ariaLabel: 'Open Admin HUB' | 'Open Customer HUB' | 'Open Supplier HUB';
};

export const getPublicHubNavigation = (role?: string | null): PublicHubNavigation | null => {
  switch (normalizeRole(role)) {
    case 'admin':
      return { role: 'admin', label: 'Admin HUB', href: '/admin', ariaLabel: 'Open Admin HUB' };
    case 'customer':
      return { role: 'customer', label: 'Customer HUB', href: '/customer/dashboard', ariaLabel: 'Open Customer HUB' };
    case 'supplier':
      return { role: 'supplier', label: 'Supplier HUB', href: '/supplier/dashboard', ariaLabel: 'Open Supplier HUB' };
    default:
      return null;
  }
};
