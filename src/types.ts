export interface EdelweissItem {
  title: string;
  ean: string;
  vendor: string;
  publisher: string;
  listPrice: number;
  storeCategory: string;
  author: string;
  cost: number;
}

export interface Order {
  id: string;
  infix: string;
  filename: string;
  items: EdelweissItem[];
}

export interface VendorMapping {
  infix: string;
  vendor: string;
  publisher: string;
}
