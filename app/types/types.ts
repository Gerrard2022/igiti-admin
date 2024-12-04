export interface Billboard {
  id: string;
  label: string;
  imageUrl: string;
}

export interface Category {
  id: string;
  name: string;
  billboard: Billboard;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Product {
  id: string;
  category: Category;
  name: string;
  price: number;
  inStock: number;
  isFeatured: boolean;
  images: Image[];
  description: string;
}

export interface Image {
  id: string;
  url: string;
}
