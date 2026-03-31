export interface RolePermission {
  id: string; // role name: 'owner', 'admin', 'seller'
  modules: string[]; // ['pos', 'inventory', 'customers', 'stats', 'staff', 'settings']
}

export interface User {
  id: string;
  name: string;
  email?: string;
  role: 'owner' | 'admin' | 'seller';
  branch_id: string;
  branch_name?: string;
  pin?: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface ProductComponent {
  id: string; // product_id or category_name
  quantity: number;
  type: 'product' | 'category';
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  sku: string;
  category: string;
  cost: number;
  margin: number;
  price: number;
  is_composite: boolean;
  image_url?: string;
  components?: ProductComponent[];
}

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  dni: string;
  phone: string;
  points: number;
}

export interface CartItem extends Product {
  quantity: number;
  selections?: { [componentId: string]: string }; // componentId -> selectedProductId
  discount?: Discount;
}

export interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  selections?: { [key: string]: string } | null;
  discount_id?: string;
  discount_amount?: number;
}

export interface Sale {
  id: string;
  branch_id: string;
  user_id: string;
  user_name: string;
  customer_id?: string | null;
  customer_name?: string;
  shift_id: string;
  total: number;
  discount: number;
  payment_type: string;
  created_at: { seconds: number; nanoseconds: number } | string | Date;
  status: 'completed' | 'refunded';
  items: SaleItem[];
}

export interface Branch {
  id: string;
  name: string;
  location?: string;
  opening_time?: string; // HH:mm
  closing_time?: string; // HH:mm
  cuit?: string;
  email?: string;
  phone?: string;
}

export interface Shift {
  id: string;
  user_id: string;
  user_name?: string;
  branch_id: string;
  branch_name?: string;
  start_time: { seconds: number; nanoseconds: number } | string | Date;
  end_time?: { seconds: number; nanoseconds: number } | string | Date;
  initial_cash: number;
  expected_cash: number;
  real_cash?: number;
  final_cash?: number;
  total_sales?: number;
  notes?: string;
  status: 'open' | 'closed';
}

export interface CashMovement {
  id: string;
  shift_id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  created_at: { seconds: number; nanoseconds: number } | string | Date;
}

export interface PrinterSettings {
  name: string;
  address: string;
  type: 'network' | 'usb' | 'bluetooth';
  paperWidth: '58mm' | '80mm';
}

export interface TicketSettings {
  logo?: string;
  header?: string;
  footer?: string;
  showLogo: boolean;
  showAddress: boolean;
  showPhone: boolean;
  printTicket: boolean;
  printComanda: boolean;
  printShiftClosing: boolean;
}

export interface ShiftSummary {
  shift_id: string;
  user_name: string;
  start_time: { seconds: number; nanoseconds: number } | string | Date;
  end_time: { seconds: number; nanoseconds: number } | string | Date;
  initial_cash: number;
  cash_sales: number;
  refunds_cash: number;
  movements_net: number;
  theoretical_cash: number;
  real_cash: number;
  difference: number;
  gross_sales: number;
  total_refunds: number;
  discounts: number;
  net_sales: number;
  card_sales: number;
  qr_sales: number;
  taxes: number;
}

export interface StockItem {
  id: string;
  quantity: number;
  lastUpdated: { seconds: number; nanoseconds: number } | string | Date;
}

export interface Discount {
  id: string;
  name: string;
  value: number;
  type: 'percentage' | 'fixed';
  enabled: boolean;
}

export interface Tax {
  id: string;
  name: string;
  rate: number;
  enabled: boolean;
}
