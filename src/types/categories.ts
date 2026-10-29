import type { SubCategoryRef } from './bills';

export interface SubCategoryResponse {
  id: string;
  name: string;
  description?: string;
  category_id: string;
  category_name: string;
  created_at: string;
  updated_at: string;
}

export function toSubCategoryRef(sc: SubCategoryResponse): SubCategoryRef {
  return { id: sc.id, name: sc.name, category_name: sc.category_name };
}
