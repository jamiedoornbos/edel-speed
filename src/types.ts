export interface EdelweissItem {
  title: string;
  ean: string;
  vendor: string;
  brand: string;
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
  brand: string;
}

export interface LightspeedConfig {
  clientId: string;
  clientSecret: string;
  accountId: string;
  refreshToken: string;
}

// Fields we're confident about; treat the rest as unknown until verified against a live response.
export interface LightspeedItem {
  itemID: string;
  description: string;
  customSku: string;
  [key: string]: unknown;
}
