export interface ProjectView {
  id: string;
  name: string;
  description?: string;
  location: string;
  developerName?: string;
  status: string;
  launchDate?: string;
  completionDate?: string;
  totalUnits?: number;
  soldUnits: number;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFilters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}