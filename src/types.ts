export interface EdelweissItem {
  title: string;
  ean: string;
  vendor: string;
  listPrice: number;
  storeCategory: string;
  author: string;
  cost: number;
}

export interface Order {
  id: string;
  filename: string;
  items: EdelweissItem[];
}
