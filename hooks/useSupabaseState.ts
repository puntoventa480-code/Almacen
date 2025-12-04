import { useState, useEffect, useCallback } from 'react';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getDebts,
  createDebt,
  updateDebt,
  deleteDebt,
  getStockMovements,
  createStockMovement,
  deleteStockMovement,
  getClients,
  createClient,
  getSystemConfig,
  updateSystemConfig,
} from '../lib/database';
import { Product, Debt, StockMovement, SystemConfig } from '../types';

export function useSupabaseProducts() {
  const [products, setProductsState] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProducts = useCallback(async () => {
    try {
      const data = await getProducts();
      setProductsState(data);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const setProducts = useCallback((value: Product[] | ((prev: Product[]) => Product[])) => {
    const newProducts = typeof value === 'function' ? value(products) : value;
    setProductsState(newProducts);
  }, [products]);

  return { products, setProducts, loading, refresh: loadProducts };
}

export function useSupabaseDebts() {
  const [debts, setDebtsState] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDebts = useCallback(async () => {
    try {
      const data = await getDebts();
      setDebtsState(data);
    } catch (error) {
      console.error('Error loading debts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDebts();
  }, [loadDebts]);

  const setDebts = useCallback((value: Debt[] | ((prev: Debt[]) => Debt[])) => {
    const newDebts = typeof value === 'function' ? value(debts) : value;
    setDebtsState(newDebts);
  }, [debts]);

  return { debts, setDebts, loading, refresh: loadDebts };
}

export function useSupabaseHistory() {
  const [history, setHistoryState] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      const data = await getStockMovements();
      setHistoryState(data);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const setHistory = useCallback((value: StockMovement[] | ((prev: StockMovement[]) => StockMovement[])) => {
    const newHistory = typeof value === 'function' ? value(history) : value;
    setHistoryState(newHistory);
  }, [history]);

  return { history, setHistory, loading, refresh: loadHistory };
}

export function useSupabaseClients() {
  const [clients, setClientsState] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadClients = useCallback(async () => {
    try {
      const data = await getClients();
      setClientsState(data);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const setClients = useCallback((value: string[] | ((prev: string[]) => string[])) => {
    const newClients = typeof value === 'function' ? value(clients) : value;
    setClientsState(newClients);
  }, [clients]);

  return { clients, setClients, loading, refresh: loadClients };
}

export function useSupabaseConfig() {
  const [config, setConfigState] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    try {
      const data = await getSystemConfig();
      setConfigState(data);
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const setConfig = useCallback(async (value: SystemConfig | ((prev: SystemConfig) => SystemConfig)) => {
    if (!config) return;

    try {
      const newConfig = typeof value === 'function' ? value(config) : value;
      const updated = await updateSystemConfig(newConfig);
      setConfigState(updated);
    } catch (error) {
      console.error('Error updating config:', error);
    }
  }, [config]);

  return { config, setConfig, loading, refresh: loadConfig };
}
