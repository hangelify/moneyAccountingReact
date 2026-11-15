export interface CategoryResponse {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface SubCategoryResponse {
  id: string;
  name: string;
  description?: string;
  category_id: string;
  category_name: string;
  created_at: string;
  updated_at: string;
}
