export interface RolePermission {
  id: string; // role name: 'owner', 'admin', 'seller'
  modules: string[]; // ['pos', 'inventory', 'customers', 'stats', 'staff', 'settings']
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'seller';
  branch_id: string;
  branch_name?: string;
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
}

export interface Sale {
  id: string;
  branch_id: string;
  user_id: string;
  user_name: string;
  customer_id?: string;
  shift_id: string;
  total: number;
  discount: number;
  payment_type: string;
  created_at: any;
  status: 'completed' | 'refunded';
  items: any[];
}

export interface Branch {
  id: string;
  name: string;
  location?: string;
  opening_time?: string; // HH:mm
  closing_time?: string; // HH:mm
}

export interface Shift {
  id: string;
  user_id: string;
  user_name?: string;
  branch_id: string;
  start_time: any;
  end_time?: any;
  initial_cash: number;
  expected_cash: number;
  real_cash?: number;
  final_cash?: number;
  notes?: string;
  status: 'open' | 'closed';
}

export interface CashMovement {
  id: string;
  shift_id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  created_at: any;
}

export interface PrinterSettings {
  name: string;
  ip: string;
  paperWidth: '58mm' | '80mm';
}

export interface TicketSettings {
  logo?: string;
  header?: string;
  footer?: string;
  printTicket: boolean;
  printComanda: boolean;
  printShiftClosing: boolean;
}
