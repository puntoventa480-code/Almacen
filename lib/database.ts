import { supabase } from './supabase';
import { Product, Debt, StockMovement, SystemConfig, DEFAULT_CONFIG } from '../types';

export interface DatabaseProduct extends Omit<Product, 'id'> {
  id?: string;
  user_id?: string;
}

export interface DatabaseDebt extends Omit<Debt, 'id'> {
  id?: string;
  user_id?: string;
}

export interface DatabaseStockMovement extends Omit<StockMovement, 'id'> {
  id?: string;
  user_id?: string;
}

export interface DatabaseSystemConfig {
  id?: string;
  user_id?: string;
  currency_symbol: string;
  tax_rate: number;
  categories: string[];
  shop_name: string;
  enable_low_stock_warning: boolean;
  low_stock_threshold: number;
  updated_at?: string;
}

// Products
export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createProduct(product: DatabaseProduct): Promise<Product> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('products')
    .insert({ ...product, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProduct(id: string, updates: Partial<DatabaseProduct>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Debts
export async function getDebts(): Promise<Debt[]> {
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createDebt(debt: DatabaseDebt): Promise<Debt> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('debts')
    .insert({ ...debt, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateDebt(id: string, updates: Partial<DatabaseDebt>): Promise<Debt> {
  const { data, error } = await supabase
    .from('debts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteDebt(id: string): Promise<void> {
  const { error } = await supabase
    .from('debts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Stock Movements
export async function getStockMovements(): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*')
    .order('date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createStockMovement(movement: DatabaseStockMovement): Promise<StockMovement> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('stock_movements')
    .insert({ ...movement, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteStockMovement(id: string): Promise<void> {
  const { error } = await supabase
    .from('stock_movements')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Clients
export async function getClients(): Promise<string[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('name')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data?.map(c => c.name) || [];
}

export async function createClient(name: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('clients')
    .insert({ name, user_id: user.id });

  if (error && !error.message.includes('duplicate')) throw error;
}

// System Config
export async function getSystemConfig(): Promise<SystemConfig> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('system_config')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const defaultConfig: DatabaseSystemConfig = {
      user_id: user.id,
      currency_symbol: DEFAULT_CONFIG.currencySymbol,
      tax_rate: DEFAULT_CONFIG.taxRate,
      categories: DEFAULT_CONFIG.categories,
      shop_name: DEFAULT_CONFIG.shopName,
      enable_low_stock_warning: DEFAULT_CONFIG.enableLowStockWarning,
      low_stock_threshold: DEFAULT_CONFIG.lowStockThreshold,
    };

    const { data: newConfig, error: insertError } = await supabase
      .from('system_config')
      .insert(defaultConfig)
      .select()
      .single();

    if (insertError) throw insertError;
    return convertDbConfigToSystemConfig(newConfig);
  }

  return convertDbConfigToSystemConfig(data);
}

export async function updateSystemConfig(config: Partial<SystemConfig>): Promise<SystemConfig> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const dbConfig: Partial<DatabaseSystemConfig> = {
    currency_symbol: config.currencySymbol,
    tax_rate: config.taxRate,
    categories: config.categories,
    shop_name: config.shopName,
    enable_low_stock_warning: config.enableLowStockWarning,
    low_stock_threshold: config.lowStockThreshold,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('system_config')
    .update(dbConfig)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return convertDbConfigToSystemConfig(data);
}

function convertDbConfigToSystemConfig(dbConfig: any): SystemConfig {
  return {
    currencySymbol: dbConfig.currency_symbol,
    taxRate: dbConfig.tax_rate,
    categories: dbConfig.categories,
    shopName: dbConfig.shop_name,
    enableLowStockWarning: dbConfig.enable_low_stock_warning,
    lowStockThreshold: dbConfig.low_stock_threshold,
  };
}
