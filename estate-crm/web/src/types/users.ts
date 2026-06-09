export interface UserWithKPIs {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'agent';
  status: 'active' | 'inactive';
  departedAt?: string;
  commissionSplit?: number;
  createdAt: string;
  // Mock KPI fields
  revenueYTD: number;
  dealsClosedYTD: number;
  conversionRate: number;
  npsScore: number;
  activeDeals: number;
  avatar: string; // initials
  color: string; // hex color for avatar
}