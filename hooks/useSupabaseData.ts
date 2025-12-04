import { useState, useEffect } from 'react';
import {
  getProducts,
  getDebts,
  getStockMovements,
  getClients,
  getSystemConfig,
  updateSystemConfig,
} from '../lib/database';
import { Product, Debt, StockMovement, SystemConfig } from '../types';

export function useSupabaseData() {
  const [products, setProducts] = useState<Product[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [history, setHistory] = useState<StockMovement[]>([]);
  const [clients, setClients] = useState<string[]>([]);
  const [config, setConfigState] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [productsData, debtsData, historyData, clientsData, configData] = await Promise.all([
        getProducts(),
        getDebts(),
        getStockMovements(),
        getClients(),
        getSystemConfig(),
      ]);

      setProducts(productsData);
      setDebts(debtsData);
      setHistory(historyData);
      setClients(clientsData);
      setConfigState(configData);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const setConfig = async (newConfig: SystemConfig | ((prev: SystemConfig) => SystemConfig)) => {
    try {
      const configToSave = typeof newConfig === 'function'
        ? newConfig(config!)
        : newConfig;

      const updated = await updateSystemConfig(configToSave);
      setConfigState(updated);
    } catch (err: any) {
      console.error('Error updating config:', err);
      throw err;
    }
  };

  return {
    products,
    setProducts,
    debts,
    setDebts,
    history,
    setHistory,
    clients,
    setClients,
    config: config!,
    setConfig,
    loading,
    error,
    refresh: loadData,
  };
}
