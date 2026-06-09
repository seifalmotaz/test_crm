export interface PropertyView {
  id: string;
  title: string;
  address: string;
  type: string;
  status: string;
  price: number; // cents from API
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  attributes?: Record<string, any>;
  images: string[];
  videos: string[];
  tags: string[];
  projectId?: string;
  agentId?: string;
  commissionPlanId?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyFilters {
  status?: string;
  type?: string;
  projectId?: string;
  minPrice?: number;
  maxPrice?: number;
  beds?: number;
  search?: string;
  page?: number;
  limit?: number;
}