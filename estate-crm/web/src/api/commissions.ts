/**
 * Hand-written types and SDK wrappers for commission endpoints.
 * The swagger.json is stale (doesn't include commission schemas yet).
 * This file will be removed once the swagger is regenerated from the running backend.
 */

import { client } from './client.gen';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CommissionBreakdownDto {
  calculated: number;
  agentPayout: number;
  brokerage: number;
}

export interface CommissionPlanResponseDto {
  id: string;
  name: string;
  type: 'percentage' | 'flat' | 'tiered';
  rate: string | null;
  flatAmount: number | null;
  tierConfig: Array<{ minValue: number; maxValue: number; rate: number }> | null;
  splitConfig: { listingAgentShare: number; buyerAgentShare: number } | null;
  isDefault: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedCommissionPlanResponseDto {
  data: CommissionPlanResponseDto[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CommissionRecordResponseDto {
  id: string;
  dealId: string;
  agentId: string;
  propertyId: string | null;
  planId: string;
  calculatedAmount: number;
  brokerageAmount: number;
  agentPayoutAmount: number;
  status: 'calculated' | 'settled' | 'paid';
  calculatedAt: string;
  createdAt: string;
  agent?: { id: string; name: string; email: string } | null;
  deal?: { id: string; value: number; stage: string } | null;
  plan?: { id: string; name: string; type: string; rate: string | null } | null;
  property?: { id: string; title: string } | null;
}

export interface PaginatedCommissionRecordResponseDto {
  data: CommissionRecordResponseDto[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CommissionSummaryResponseDto {
  totalCalculated: number;
  totalBrokerage: number;
  totalAgentPayout: number;
  count: number;
}

// ─── Enriched sub-types ──────────────────────────────────────────────────────

export interface PropertySummaryDto {
  id: string;
  title: string;
  address: string;
}

export interface AgentSummaryDto {
  id: string;
  name: string;
  email: string;
}

// ─── Extended DealResponseDto (adds resolvedRate + resolvedCommission + enriched fields) ──────

export interface DealWithCommission {
  id: string;
  tenantId: string;
  propertyId?: string | null;
  leadId?: string | null;
  agentId: string;
  type: 'standard' | 'resale' | 'rental' | 'investment';
  value: number;
  stage: 'initialContact' | 'negotiation' | 'contractPending' | 'closedWon' | 'closedLost';
  probability?: number | null;
  offerDate?: string | null;
  targetCloseDate?: string | null;
  closingDate?: string | null;
  daysUntilClose?: number | null;
  daysElapsed?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  resolvedRate?: number | null;
  resolvedCommission?: CommissionBreakdownDto | null;
  // Enriched fields (Fix #6)
  property?: PropertySummaryDto | null;
  agent?: AgentSummaryDto | null;
  risk: 'low' | 'medium' | 'high';
}

// ─── SDK Wrappers ────────────────────────────────────────────────────────────

export async function fetchCommissionPlans(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedCommissionPlanResponseDto> {
  const { data, error } = await client.get<PaginatedCommissionPlanResponseDto>({
    url: '/api/commission-plans',
    query: params as Record<string, unknown>,
  });
  if (error) throw error;
  return data!;
}

export async function fetchDefaultCommissionPlan(): Promise<CommissionPlanResponseDto | null> {
  const { data, error } = await client.get<CommissionPlanResponseDto>({
    url: '/api/commission-plans/default',
  });
  if (error) throw error;
  return data ?? null;
}

export async function fetchCommissionPlanById(id: string): Promise<CommissionPlanResponseDto> {
  const { data, error } = await client.get<CommissionPlanResponseDto>({
    url: '/api/commission-plans/{id}',
    path: { id },
  });
  if (error) throw error;
  return data!;
}

export async function fetchCommissionRecords(params?: {
  agentId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedCommissionRecordResponseDto> {
  const { data, error } = await client.get<PaginatedCommissionRecordResponseDto>({
    url: '/api/commission-records',
    query: params as Record<string, unknown>,
  });
  if (error) throw error;
  return data!;
}

export async function fetchCommissionSummary(params?: {
  agentId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<CommissionSummaryResponseDto> {
  const { data, error } = await client.get<CommissionSummaryResponseDto>({
    url: '/api/commission-records/summary',
    query: params as Record<string, unknown>,
  });
  if (error) throw error;
  return data!;
}

export async function fetchCommissionRecordById(id: string): Promise<CommissionRecordResponseDto> {
  const { data, error } = await client.get<CommissionRecordResponseDto>({
    url: '/api/commission-records/{id}',
    path: { id },
  });
  if (error) throw error;
  return data!;
}

export async function fetchAgentCommissions(
  agentId: string,
  params?: { page?: number; limit?: number },
): Promise<PaginatedCommissionRecordResponseDto> {
  const { data, error } = await client.get<PaginatedCommissionRecordResponseDto>({
    url: '/api/agents/{agentId}/commissions',
    path: { agentId },
    query: params as Record<string, unknown>,
  });
  if (error) throw error;
  return data!;
}
