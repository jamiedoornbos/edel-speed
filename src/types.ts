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

export interface LightspeedItem {
  itemID: string;
  description: string;
  customSku: string;
  defaultCost: string;
  defaultVendorID: string;
  manufacturerID: string;
  Tags?: { tag: string | string[] };
  [key: string]: unknown;
}

export interface LightspeedUpdate {
  edelweiss: EdelweissItem;
  lsItem: LightspeedItem;
  authorTags: string[];
  lsTags: string[];
  lsCost: number;
  lsVendorName: string;
  lsManufacturerName: string;
  costDiffers: boolean;
  vendorDiffers: boolean;
  brandDiffers: boolean;
  tagsDiffer: boolean;
  changed: boolean;
}

export interface LightspeedAddition {
  title: string;
  ean: string;
  author: string;
  vendor: string;
  brand: string;
  listPrice: number;
  cost: number;
  storeCategory: string;
  categoryID: string;
}

export type UploadStatus = "pending" | "uploading" | "done" | "error";

export interface AdditionUploadResult {
  ean: string;
  title: string;
  status: UploadStatus;
  error?: string;
}

export interface UploadResult {
  ean: string;
  title: string;
  itemID: string;
  status: UploadStatus;
  fieldsChanged: string[];
  tagsAdded: string[];
  tagsRemoved: string[];
  error?: string;
}
