import type { LeadResponseDto } from '@/api/types.gen';

export interface LeadView extends LeadResponseDto {
  // view-layer computed fields
  isOverdue?: boolean; // nextActionDate is in the past
  initials?: string; // computed from name
}

export interface LeadFilters {
  search?: string;
  stage?: string; // 'all' | 'fresh' | 'qualified' | 'followUp' | 'reservation' | 'lost'
  source?: string;
  type?: string;
  agentId?: string;
  isDnc?: boolean;
  isClient?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export type LeadViewMode = 'kanban' | 'list';

export const LEAD_STAGE_LABELS: Record<string, string> = {
  fresh: 'Fresh',
  qualified: 'Qualified',
  followUp: 'Follow-up',
  reservation: 'Reservation',
  lost: 'Lost',
};

export const LEAD_STAGE_COLUMNS = [
  { id: 'fresh', label: 'Fresh', color: 'blue' },
  { id: 'qualified', label: 'Qualified', color: 'amber' },
  { id: 'followUp', label: 'Follow-up', color: 'purple' },
  { id: 'reservation', label: 'Reservation', color: 'emerald' },
  { id: 'lost', label: 'Lost', color: 'slate' },
] as const;

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  website: 'Website',
  referral: 'Referral',
  social_media: 'Social Media',
  walk_in: 'Walk-in',
  cold_call: 'Cold Call',
  advertisement: 'Advertisement',
  portal: 'Portal',
  other: 'Other',
};

export const LEAD_TYPE_LABELS: Record<string, string> = {
  buyer: 'Buyer',
  seller: 'Seller',
  renter: 'Renter',
  investor: 'Investor',
};

export const LEAD_ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  note: 'Note',
  stage_change: 'Stage Change',
  assignment: 'Assignment',
  dnc_set: 'DNC Set',
  dnc_unset: 'DNC Unset',
  convert: 'Converted',
};

export function getLeadInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function isLeadOverdue(lead: LeadResponseDto): boolean {
  if (!lead.nextActionDate) return false;
  return new Date(lead.nextActionDate) < new Date();
}
