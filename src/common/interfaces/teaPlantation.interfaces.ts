export interface TeaPlantation {
  id: string;
  name: string;
  location: string;
  area: number;
  description?: string;
  adminId: string;
  managerIds?: string[];
}
