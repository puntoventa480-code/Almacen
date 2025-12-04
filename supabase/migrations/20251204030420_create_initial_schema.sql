/*
  # Initial Schema for Gestor Pro Local

  ## Overview
  Creates a complete inventory and debt management system with product tracking,
  client management, stock movements, and system configuration.

  ## New Tables
  
  ### 1. `products`
  - `id` (uuid, primary key) - Unique product identifier
  - `name` (text) - Product name
  - `sku` (text, unique) - Stock keeping unit code
  - `quantity` (integer) - Current stock quantity
  - `price` (decimal) - Unit price
  - `category` (text) - Product category
  - `image` (text, nullable) - Base64 encoded image
  - `default_bulk_size` (integer) - Units per box/pack
  - `updated_at` (timestamptz) - Last update timestamp
  - `user_id` (uuid) - Owner user ID
  
  ### 2. `debts`
  - `id` (uuid, primary key) - Unique debt identifier
  - `debtor_name` (text) - Name of the debtor
  - `amount` (decimal) - Debt amount
  - `description` (text) - Debt description
  - `due_date` (date) - Payment due date
  - `is_paid` (boolean) - Payment status
  - `user_id` (uuid) - Owner user ID
  - `created_at` (timestamptz) - Creation timestamp

  ### 3. `stock_movements`
  - `id` (uuid, primary key) - Unique movement identifier
  - `product_id` (uuid) - Reference to product
  - `type` (text) - Movement type (entrada, venta, ajuste, devolucion, consignacion)
  - `quantity` (integer) - Quantity moved
  - `date` (timestamptz) - Movement date
  - `note` (text, nullable) - Optional note
  - `user_id` (uuid) - Owner user ID

  ### 4. `clients`
  - `id` (uuid, primary key) - Unique client identifier
  - `name` (text) - Client name
  - `user_id` (uuid) - Owner user ID
  - `created_at` (timestamptz) - Creation timestamp

  ### 5. `system_config`
  - `id` (uuid, primary key) - Config identifier (one per user)
  - `user_id` (uuid, unique) - Owner user ID
  - `currency_symbol` (text) - Currency symbol
  - `tax_rate` (decimal) - Tax rate percentage
  - `categories` (jsonb) - Array of category names
  - `shop_name` (text) - Shop name
  - `enable_low_stock_warning` (boolean) - Enable warnings
  - `low_stock_threshold` (integer) - Stock warning threshold
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on all tables
  - Users can only access their own data
  - Authenticated users required for all operations
*/

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text NOT NULL,
  quantity integer DEFAULT 0 NOT NULL,
  price decimal(10,2) DEFAULT 0 NOT NULL,
  category text DEFAULT 'General' NOT NULL,
  image text,
  default_bulk_size integer DEFAULT 1,
  updated_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(sku, user_id)
);

-- Create debts table
CREATE TABLE IF NOT EXISTS debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debtor_name text NOT NULL,
  amount decimal(10,2) NOT NULL,
  description text DEFAULT '' NOT NULL,
  due_date date NOT NULL,
  is_paid boolean DEFAULT false NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create stock_movements table
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('entrada', 'venta', 'ajuste', 'devolucion', 'consignacion')),
  quantity integer NOT NULL,
  date timestamptz DEFAULT now() NOT NULL,
  note text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(name, user_id)
);

-- Create system_config table
CREATE TABLE IF NOT EXISTS system_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  currency_symbol text DEFAULT '$' NOT NULL,
  tax_rate decimal(5,4) DEFAULT 0.16 NOT NULL,
  categories jsonb DEFAULT '["General", "Electrónica", "Alimentos", "Ropa", "Hogar"]'::jsonb NOT NULL,
  shop_name text DEFAULT 'Mi Negocio' NOT NULL,
  enable_low_stock_warning boolean DEFAULT true NOT NULL,
  low_stock_threshold integer DEFAULT 5 NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Products policies
CREATE POLICY "Users can view own products"
  ON products FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products"
  ON products FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own products"
  ON products FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Debts policies
CREATE POLICY "Users can view own debts"
  ON debts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own debts"
  ON debts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own debts"
  ON debts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own debts"
  ON debts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Stock movements policies
CREATE POLICY "Users can view own stock movements"
  ON stock_movements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stock movements"
  ON stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own stock movements"
  ON stock_movements FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Clients policies
CREATE POLICY "Users can view own clients"
  ON clients FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients"
  ON clients FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- System config policies
CREATE POLICY "Users can view own config"
  ON system_config FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own config"
  ON system_config FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own config"
  ON system_config FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category, user_id);
CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_is_paid ON debts(is_paid, user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user_id ON stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);