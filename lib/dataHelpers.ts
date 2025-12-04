import {
  createProduct as dbCreateProduct,
  updateProduct as dbUpdateProduct,
  deleteProduct as dbDeleteProduct,
  createDebt as dbCreateDebt,
  updateDebt as dbUpdateDebt,
  deleteDebt as dbDeleteDebt,
  createStockMovement as dbCreateStockMovement,
  deleteStockMovement as dbDeleteStockMovement,
  createClient as dbCreateClient,
} from './database';
import { Product, Debt, StockMovement } from '../types';

export async function addProduct(
  product: Omit<Product, 'id'>,
  setProducts: (fn: (prev: Product[]) => Product[]) => void
) {
  try {
    const newProduct = await dbCreateProduct(product);
    setProducts((prev) => [newProduct, ...prev]);
    return newProduct;
  } catch (error) {
    console.error('Error adding product:', error);
    throw error;
  }
}

export async function modifyProduct(
  id: string,
  updates: Partial<Product>,
  setProducts: (fn: (prev: Product[]) => Product[]) => void
) {
  try {
    const updated = await dbUpdateProduct(id, updates);
    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
}

export async function removeProduct(
  id: string,
  setProducts: (fn: (prev: Product[]) => Product[]) => void
) {
  try {
    await dbDeleteProduct(id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
}

export async function addDebt(
  debt: Omit<Debt, 'id'>,
  setDebts: (fn: (prev: Debt[]) => Debt[]) => void
) {
  try {
    const newDebt = await dbCreateDebt(debt);
    setDebts((prev) => [newDebt, ...prev]);
    return newDebt;
  } catch (error) {
    console.error('Error adding debt:', error);
    throw error;
  }
}

export async function modifyDebt(
  id: string,
  updates: Partial<Debt>,
  setDebts: (fn: (prev: Debt[]) => Debt[]) => void
) {
  try {
    const updated = await dbUpdateDebt(id, updates);
    setDebts((prev) => prev.map((d) => (d.id === id ? updated : d)));
    return updated;
  } catch (error) {
    console.error('Error updating debt:', error);
    throw error;
  }
}

export async function removeDebt(
  id: string,
  setDebts: (fn: (prev: Debt[]) => Debt[]) => void
) {
  try {
    await dbDeleteDebt(id);
    setDebts((prev) => prev.filter((d) => d.id !== id));
  } catch (error) {
    console.error('Error deleting debt:', error);
    throw error;
  }
}

export async function addStockMovement(
  movement: Omit<StockMovement, 'id'>,
  setHistory: (fn: (prev: StockMovement[]) => StockMovement[]) => void
) {
  try {
    const newMovement = await dbCreateStockMovement(movement);
    setHistory((prev) => [newMovement, ...prev]);
    return newMovement;
  } catch (error) {
    console.error('Error adding stock movement:', error);
    throw error;
  }
}

export async function removeStockMovement(
  id: string,
  setHistory: (fn: (prev: StockMovement[]) => StockMovement[]) => void
) {
  try {
    await dbDeleteStockMovement(id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
  } catch (error) {
    console.error('Error deleting stock movement:', error);
    throw error;
  }
}

export async function addClient(
  name: string,
  setClients: (fn: (prev: string[]) => string[]) => void
) {
  try {
    await dbCreateClient(name);
    setClients((prev) => [...prev, name]);
  } catch (error) {
    console.error('Error adding client:', error);
  }
}
