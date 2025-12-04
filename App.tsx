
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  CreditCard, 
  Settings, 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  Save, 
  AlertTriangle,
  TrendingUp,
  DollarSign,
  CheckCircle,
  XCircle,
  Code,
  Users,
  User,
  ChevronRight,
  ArrowLeft,
  Banknote,
  ShoppingCart,
  Minus,
  ShoppingBag,
  Camera,
  RefreshCw,
  Image as ImageIcon,
  Box,
  Printer,
  MapPin,
  FileText,
  Eye,
  History,
  Archive,
  Bot,
  Send,
  Loader2,
  Sparkles,
  Key,
  Unlock,
  Cloud,
  CloudLightning,
  DownloadCloud,
  UploadCloud,
  LogOut,
  Download,
  Upload,
  HardDrive
} from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Product, Debt, SystemConfig, DEFAULT_CONFIG, ViewState, CartItem, StockMovement } from './types';
import { formatCurrency, formatNumber, generateId, formatDate, generateSKU, processImage, printTicket, TicketItem } from './utils';
import { StatCard } from './components/StatCard';
import { Modal } from './components/Modal';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

// Declare google types for window
declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

export default function App() {
  // --- Local Database (State) ---
  const [products, setProducts] = useLocalStorage<Product[]>('db_products', []);
  const [debts, setDebts] = useLocalStorage<Debt[]>('db_debts', []);
  const [history, setHistory] = useLocalStorage<StockMovement[]>('db_history', []);
  const [clients, setClients] = useLocalStorage<string[]>('db_clients', []); 
  const [config, setConfig] = useLocalStorage<SystemConfig>('db_config', DEFAULT_CONFIG);
  const [customApiKey, setCustomApiKey] = useLocalStorage<string>('db_api_key', '');

  // --- UI State ---
  const [currentView, setCurrentView] = useState<ViewState | 'pos' | 'ai'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isStockEntryModalOpen, setIsStockEntryModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [apiJsonInput, setApiJsonInput] = useState('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  
  // --- Form specific state ---
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [formSku, setFormSku] = useState('');
  const [stockEntryQty, setStockEntryQty] = useState('');
  const [stockEntryIsBulk, setStockEntryIsBulk] = useState(false);
  const [stockEntryBulkSize, setStockEntryBulkSize] = useState(12);
  
  // --- POS State ---
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [posClient, setPosClient] = useState('');
  
  // --- AI State ---
  const [aiMessages, setAiMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [hasSystemApiKey, setHasSystemApiKey] = useState(false);
  const [manualKeyInput, setManualKeyInput] = useState('');

  // --- Drive Sync State ---
  const [isGapiLoaded, setIsGapiLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  
  // --- Local Backup Ref ---
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAiReady = hasSystemApiKey || (customApiKey && customApiKey.length > 5);
  
  // --- Independent Ticket Data ---
  const [ticketConfig, setTicketConfig] = useState({
    title: 'TICKET DE VENTA',
    name: '',
    ci: '',
    address: ''
  });

  // Check API Key on mount and when view changes
  useEffect(() => {
    const checkKey = async () => {
      const aistudio = (window as any).aistudio as AIStudio | undefined;
      if (aistudio) {
        const has = await aistudio.hasSelectedApiKey();
        setHasSystemApiKey(has);
      }
    };
    checkKey();
  }, [currentView]);

  // --- Google Drive Logic ---

  // Load Google Scripts
  useEffect(() => {
    const loadGapi = () => {
      if (window.gapi) {
        window.gapi.load('client', async () => {
          await window.gapi.client.init({
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          });
          setIsGapiLoaded(true);
        });
      }
    };
    
    // Check if scripts are loaded, if not wait a bit (they are in index.html but might lag)
    if (!window.gapi) {
      const interval = setInterval(() => {
        if (window.gapi) {
          clearInterval(interval);
          loadGapi();
        }
      }, 500);
    } else {
      loadGapi();
    }
  }, []);

  // Initialize Token Client when GAPI is ready
  useEffect(() => {
    if (isGapiLoaded && window.google && config.googleDriveClientId) {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: config.googleDriveClientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: async (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
             try {
                setUserInfo({ connected: true });
                await checkForRemoteUpdates();
             } catch (e) {
               console.error("Error post-auth", e);
             }
          }
        },
      });
      setTokenClient(client);
    }
  }, [isGapiLoaded, config.googleDriveClientId]);

  // Sync Data Object
  const getSyncData = () => ({
    products,
    debts,
    history,
    clients,
    config,
    timestamp: new Date().toISOString()
  });

  const uploadToDrive = async (isManual = false) => {
    if (!tokenClient || !window.gapi.client.drive) return;
    setIsSyncing(true);

    try {
       const data = getSyncData();
       const fileContent = JSON.stringify(data);
       const fileName = 'gestor_pro_backup.json';

       // 1. Find existing file
       let fileId = config.googleDriveBackupFileId;
       
       if (!fileId) {
         const response = await window.gapi.client.drive.files.list({
           q: `name = '${fileName}' and trashed = false`,
           fields: 'files(id)',
         });
         if (response.result.files && response.result.files.length > 0) {
           fileId = response.result.files[0].id;
           // Update local config with found ID
           setConfig(prev => ({...prev, googleDriveBackupFileId: fileId}));
         }
       }

       const metadata = {
         name: fileName,
         mimeType: 'application/json',
       };

       const accessToken = window.gapi.client.getToken()?.access_token;
       if (!accessToken) {
         if(isManual) tokenClient.requestAccessToken({ prompt: '' });
         setIsSyncing(false);
         return;
       }

       const file = new Blob([fileContent], { type: 'application/json' });
       
       const form = new FormData();
       form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
       form.append('file', file);

       let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
       let method = 'POST';

       if (fileId) {
         url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
         method = 'PATCH';
       }

       const res = await fetch(url, {
         method: method,
         headers: {
           Authorization: `Bearer ${accessToken}`,
         },
         body: form,
       });

       if (res.ok) {
         const json = await res.json();
         const newFileId = json.id;
         setConfig(prev => ({
            ...prev, 
            googleDriveBackupFileId: newFileId,
            lastSync: new Date().toISOString()
         }));
         if (isManual) alert("Datos sincronizados con Google Drive exitosamente.");
       } else {
         console.error("Upload error", res.statusText);
       }

    } catch (error) {
      console.error("Sync Error", error);
      if (isManual) alert("Error al sincronizar. Verifica tu conexión.");
    } finally {
      setIsSyncing(false);
    }
  };

  const checkForRemoteUpdates = async () => {
    if (!window.gapi.client.drive) return;
    setIsSyncing(true);
    
    try {
      // Find file
      const fileName = 'gestor_pro_backup.json';
      const response = await window.gapi.client.drive.files.list({
           q: `name = '${fileName}' and trashed = false`,
           fields: 'files(id, modifiedTime)',
      });

      const files = response.result.files;
      if (files && files.length > 0) {
        const remoteFile = files[0];
        const localTime = config.lastSync ? new Date(config.lastSync).getTime() : 0;
        const remoteTime = new Date(remoteFile.modifiedTime).getTime();

        if (remoteTime > localTime + 60000) {
           if (window.confirm("Se han encontrado datos más recientes en Google Drive. ¿Deseas restaurarlos? (Esto sobrescribirá los datos locales)")) {
              await restoreFromDrive(remoteFile.id);
           }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const restoreFromDrive = async (fileId: string) => {
    try {
      const response = await window.gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
      });
      
      const data = response.result;
      if (data) {
        if (data.products) setProducts(data.products);
        if (data.debts) setDebts(data.debts);
        if (data.history) setHistory(data.history);
        if (data.clients) setClients(data.clients);
        if (data.config) setConfig({ ...data.config, googleDriveClientId: config.googleDriveClientId }); // Keep local client ID
        alert("Datos restaurados correctamente.");
      }
    } catch (e) {
      alert("Error al descargar copia de seguridad.");
    }
  };

  const handleDriveConnect = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      alert("Configura tu Client ID primero en Ajustes.");
    }
  };

  // --- Local Backup Logic ---
  const handleExportData = () => {
    const data = getSyncData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gestor-pro-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (window.confirm("¿Estás seguro de restaurar este archivo? Se reemplazarán los datos actuales.")) {
           if (json.products) setProducts(json.products);
           if (json.debts) setDebts(json.debts);
           if (json.history) setHistory(json.history);
           if (json.clients) setClients(json.clients);
           if (json.config) setConfig(prev => ({ ...prev, ...json.config }));
           alert("Datos restaurados correctamente desde el archivo local.");
        }
      } catch (err) {
        alert("Error al leer el archivo. Asegúrate de que es un backup válido.");
      }
    };
    reader.readAsText(file);
    // Reset file input so same file can be selected again if needed
    e.target.value = '';
  };


  // --- Sync triggers ---
  
  // 1. On Visibility Change (Close/Hide)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && userInfo && config.googleDriveClientId) {
        uploadToDrive();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [userInfo, products, debts]); // Depend on data

  // 2. Initial check on mount if configured
  const hasCheckedRemote = useRef(false);
  useEffect(() => {
     if (isGapiLoaded && config.googleDriveClientId && !hasCheckedRemote.current) {
        // We rely on user action for first connect
     }
  }, [isGapiLoaded]);


  // --- Derived State (Memoized) ---
  const totalStockValue = useMemo(() => 
    products.reduce((acc, p) => acc + (p.price * p.quantity), 0), 
  [products]);

  const totalDebtValue = useMemo(() => 
    debts.filter(d => !d.isPaid).reduce((acc, d) => acc + d.amount, 0), 
  [debts]);

  const lowStockCount = useMemo(() => 
    products.filter(p => p.quantity <= config.lowStockThreshold).length, 
  [products, config.lowStockThreshold]);

  const filteredProducts = useMemo(() => 
    products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase())),
  [products, searchTerm]);

  const itemHistory = useMemo(() => {
    if (!editingItem) return [];
    return history.filter(h => h.productId === editingItem.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [history, editingItem]);

  // Group debts by client
  const clientStats = useMemo(() => {
    const stats: Record<string, { total: number, count: number, debts: Debt[] }> = {};
    
    // Initialize with known clients
    clients.forEach(name => {
      stats[name] = { total: 0, count: 0, debts: [] };
    });

    // Aggregate debt data
    debts.forEach(d => {
      const name = d.debtorName;
      if (!stats[name]) {
        stats[name] = { total: 0, count: 0, debts: [] };
      }
      stats[name].debts.push(d);
      if (!d.isPaid) {
        stats[name].total += d.amount;
        stats[name].count += 1;
      }
    });

    // Sort debts by date desc for each client
    Object.keys(stats).forEach(key => {
        stats[key].debts.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
    });

    return stats;
  }, [debts, clients]);

  const filteredClients = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const list = Object.keys(clientStats).filter(name => name.toLowerCase().includes(term));
    return list.sort((a, b) => (clientStats[b]?.total || 0) - (clientStats[a]?.total || 0));
  }, [clientStats, searchTerm]);

  // --- POS Derived State ---
  const cartTotal = useMemo(() => {
    return Object.values(cart).reduce((total: number, item: CartItem) => {
      return total + (item.quantity * item.customPrice);
    }, 0);
  }, [cart]);

  const cartItemCount = useMemo(() => Object.values(cart).reduce((a: number, b) => a + (b as CartItem).quantity, 0), [cart]);

  // --- Handlers ---
  const handleOpenProductModal = (product?: Product) => {
    setEditingItem(product || null);
    setPreviewImage(product?.image || null);
    setFormSku(product?.sku || generateSKU());
    setIsModalOpen(true);
  };

  const handleDeleteProduct = (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este producto?')) {
      setProducts(prev => prev.filter(p => p.id !== id));
      removeFromCart(id);
    }
  };

  const handleOpenStockEntry = (product: Product) => {
    setEditingItem(product);
    setStockEntryQty('');
    setStockEntryIsBulk(false);
    setStockEntryBulkSize(product.defaultBulkSize || 12);
    setIsStockEntryModalOpen(true);
  };

  const handleOpenHistory = (product: Product) => {
    setEditingItem(product);
    setIsHistoryModalOpen(true);
  };

  const handleDeleteClient = (clientName: string) => {
    if (window.confirm(`¿Eliminar todo el historial y deudas de ${clientName}?`)) {
      setDebts(prev => prev.filter(d => d.debtorName !== clientName));
      setClients(prev => prev.filter(c => c !== clientName));
      setSelectedClient(null);
    }
  };

  const handleSettleClientDebt = (clientName: string, totalAmount: number) => {
    if (window.confirm(`¿Marcar todas las deudas de ${clientName} como PAGADAS?`)) {
      setDebts(prev => prev.map(d => 
        d.debtorName === clientName && !d.isPaid 
        ? { ...d, isPaid: true } 
        : d
      ));
    }
  };

  const toggleDebtStatus = (id: string) => {
    setDebts(prev => prev.map(d => d.id === id ? { ...d, isPaid: !d.isPaid } : d));
  };

  const handleDeleteDebt = (id: string) => {
    if (window.confirm('¿Eliminar esta deuda?')) {
      setDebts(prev => prev.filter(d => d.id !== id));
    }
  };

  const addToCart = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    setCart(prev => {
      if (prev[productId]) {
        return {
          ...prev,
          [productId]: { ...prev[productId], quantity: prev[productId].quantity + 1 }
        };
      }
      return {
        ...prev,
        [productId]: {
          quantity: 1,
          customPrice: product.price,
          isBulk: false,
          bulkSize: product.defaultBulkSize || 12
        }
      };
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const updateCartItem = (productId: string, updates: Partial<CartItem>) => {
    setCart(prev => ({
      ...prev,
      [productId]: { ...prev[productId], ...updates }
    }));
  };

  const handleCheckout = (type: 'sale' | 'consignment') => {
    const finalClientName = (ticketConfig.name || posClient || 'Cliente General').toUpperCase();
    
    const ticketItems: TicketItem[] = Object.entries(cart).map(([id, item]) => {
      const cartItem = item as CartItem;
      const p = products.find(prod => prod.id === id)!;
      return {
        name: p.name,
        quantity: cartItem.quantity,
        price: cartItem.customPrice,
        total: cartItem.quantity * cartItem.customPrice,
        isBulk: cartItem.isBulk,
        bulkSize: cartItem.bulkSize
      };
    });

    const total = ticketItems.reduce((acc, item) => acc + item.total, 0);

    if (type === 'consignment') {
      if (!posClient) {
        alert("Para consignación/crédito debes especificar un cliente del sistema.");
        return;
      }
      const newDebt: Debt = {
        id: generateId(),
        debtorName: posClient,
        amount: total,
        description: `Compra (Ticket ${Math.floor(Math.random()*1000)})`,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), 
        isPaid: false
      };
      setDebts(prev => [...prev, newDebt]);
      
      if (!clients.includes(posClient)) {
        setClients(prev => [...prev, posClient]);
      }
    }

    const newHistory: StockMovement[] = [];
    const newProducts = products.map(p => {
      const cartItem = cart[p.id];
      if (!cartItem) return p;

      const qtyToDeduct = cartItem.quantity * (cartItem.isBulk ? cartItem.bulkSize : 1);
      
      newHistory.push({
        id: generateId(),
        productId: p.id,
        type: type === 'sale' ? 'venta' : 'consignacion',
        quantity: qtyToDeduct,
        date: new Date().toISOString(),
        note: `Venta a ${finalClientName}`
      });

      return { ...p, quantity: p.quantity - qtyToDeduct };
    });

    setProducts(newProducts);
    setHistory(prev => [...prev, ...newHistory]);

    printTicket(config, {
      title: ticketConfig.title,
      type: type === 'sale' ? 'Venta' : 'Consignación',
      client: {
        name: finalClientName,
        ci: ticketConfig.ci,
        address: ticketConfig.address
      },
      date: new Date().toLocaleDateString('es-MX'),
      items: ticketItems,
      total: total
    });

    setCart({});
    setPosClient('');
    setIsTicketModalOpen(false);
  };

  const handleApiUpdate = () => {
    try {
      const newConfig = JSON.parse(apiJsonInput);
      setConfig(prev => ({ ...prev, ...newConfig }));
      alert("Configuración actualizada.");
    } catch (e) {
      alert("JSON inválido.");
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    
    const productData: Product = {
      id: editingItem && editingItem.id ? editingItem.id : generateId(),
      name: formData.get('name') as string,
      sku: formData.get('sku') as string,
      category: formData.get('category') as string,
      quantity: parseInt(formData.get('quantity') as string),
      price: parseFloat(formData.get('price') as string),
      defaultBulkSize: parseInt(formData.get('defaultBulkSize') as string),
      image: previewImage || undefined,
      updatedAt: new Date().toISOString()
    };

    if (editingItem && editingItem.id) {
      setProducts(prev => prev.map(p => p.id === editingItem.id ? productData : p));
    } else {
      setProducts(prev => [...prev, productData]);
    }
    
    if (!config.categories.includes(productData.category)) {
      setConfig(prev => ({ ...prev, categories: [...prev.categories, productData.category] }));
    }

    setIsModalOpen(false);
    setEditingItem(null);
    setPreviewImage(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await processImage(file);
        setPreviewImage(base64);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSaveDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const debtorName = formData.get('debtorName') as string;

    const debtData: Debt = {
      id: editingItem && editingItem.id ? editingItem.id : generateId(),
      debtorName: debtorName,
      description: formData.get('description') as string,
      amount: parseFloat(formData.get('amount') as string),
      dueDate: formData.get('dueDate') as string,
      isPaid: editingItem ? editingItem.isPaid : false
    };

    if (editingItem && editingItem.id) {
      setDebts(prev => prev.map(d => d.id === editingItem.id ? debtData : d));
    } else {
      setDebts(prev => [...prev, debtData]);
    }

    if (!clients.includes(debtorName)) {
      setClients(prev => [...prev, debtorName]);
    }

    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handlePartialPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    
    let remainingPayment = parseFloat(paymentAmount);
    if (isNaN(remainingPayment) || remainingPayment <= 0) return;

    setDebts(prev => {
      const debtsCopy = [...prev];
      const userDebtIndices = debtsCopy
        .map((d, index) => ({ ...d, originalIndex: index }))
        .filter(d => d.debtorName === selectedClient && !d.isPaid)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      
      for (const debt of userDebtIndices) {
        if (remainingPayment <= 0) break;

        if (remainingPayment >= debt.amount) {
          remainingPayment -= debt.amount;
          debtsCopy[debt.originalIndex] = { ...debtsCopy[debt.originalIndex], isPaid: true };
        } else {
          debtsCopy[debt.originalIndex] = { 
            ...debtsCopy[debt.originalIndex], 
            amount: debt.amount - remainingPayment 
          };
          remainingPayment = 0;
        }
      }
      return debtsCopy;
    });

    setIsPaymentModalOpen(false);
    setPaymentAmount('');
  };

  const handleStockEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const qtyEntered = parseInt(stockEntryQty);
    const size = stockEntryIsBulk ? stockEntryBulkSize : 1;
    const totalUnits = qtyEntered * size;

    if (isNaN(totalUnits) || totalUnits <= 0) return;

    setProducts(prev => prev.map(p => 
      p.id === editingItem.id 
      ? { ...p, quantity: p.quantity + totalUnits } 
      : p
    ));

    const movement: StockMovement = {
      id: generateId(),
      productId: editingItem.id,
      type: 'entrada',
      quantity: totalUnits,
      date: new Date().toISOString(),
      note: `Entrada: ${qtyEntered} ${stockEntryIsBulk ? `Cajas (x${size})` : 'Unidades'}`
    };

    setHistory(prev => [...prev, movement]);
    setIsStockEntryModalOpen(false);
  };

  const handleDeleteHistoryItem = (item: StockMovement) => {
    if (window.confirm("¿Eliminar este registro? Se revertirá el cambio de stock.")) {
      setHistory(prev => prev.filter(h => h.id !== item.id));
      
      setProducts(prev => prev.map(p => {
        if (p.id !== item.productId) return p;
        
        if (item.type === 'entrada') {
          return { ...p, quantity: p.quantity - item.quantity };
        } else if (item.type === 'venta' || item.type === 'consignacion') {
          return { ...p, quantity: p.quantity + item.quantity };
        }
        return p;
      }));
    }
  };

  const handleSaveManualKey = () => {
    if (manualKeyInput.trim().length > 0) {
      setCustomApiKey(manualKeyInput.trim());
      setManualKeyInput('');
      alert("API Key guardada localmente.");
    }
  };

  // --- AI Logic ---
  const handleAiSendMessage = async () => {
    if (!aiInput.trim()) return;
    
    // Determine which key to use: Custom Override OR System Environment
    const apiKey = customApiKey || process.env.API_KEY;
    
    if (!apiKey) {
      alert("No se encontró una API Key válida. Por favor conecta una llave.");
      return;
    }

    const userMsg = aiInput;
    setAiMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setAiInput('');
    setIsAiLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      // Define Tool for updating configuration
      const updateConfigTool: FunctionDeclaration = {
        name: 'updateSystemConfig',
        description: 'Updates the application system configuration. Use this when the user asks to change shop name, currency, tax rate, or categories.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            shopName: { type: Type.STRING, description: 'Name of the business' },
            currencySymbol: { type: Type.STRING, description: 'Currency symbol (e.g. $, €)' },
            taxRate: { type: Type.NUMBER, description: 'Tax rate as decimal (e.g. 0.16 for 16%)' },
            lowStockThreshold: { type: Type.NUMBER, description: 'Minimum stock level for warnings' }
          }
        }
      };

      // Prepare context about the app state
      const appStateContext = `
        Current System State:
        - Shop Name: ${config.shopName}
        - Total Inventory Value: ${totalStockValue}
        - Total Outstanding Debt: ${totalDebtValue}
        - Low Stock Items: ${lowStockCount}
        - Products Count: ${products.length}
        - Clients with Debt: ${Object.keys(clientStats).filter(c => clientStats[c].total > 0).length}
        
        Product List Sample: ${JSON.stringify(products.slice(0, 10).map(p => ({name: p.name, qty: p.quantity, price: p.price})))}
        Clients with highest debt: ${JSON.stringify(filteredClients.slice(0, 5).map(c => ({name: c, debt: clientStats[c].total})))}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            ...aiMessages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
            { role: 'user', parts: [{ text: userMsg }] }
        ],
        config: {
            tools: [{functionDeclarations: [updateConfigTool]}],
            systemInstruction: `You are the AI assistant for 'Gestor Pro Local'. 
            You have read-access to the inventory and debt data provided in the context.
            You can answer questions about stock, debts, and business performance.
            You can also UPDATE the system configuration (shop name, currency, etc) using the provided tool if the user explicitly asks.
            
            ${appStateContext}`
        }
      });

      const toolCalls = response?.functionCalls; 

      let botResponseText = response?.text || ''; 

      if (toolCalls && toolCalls.length > 0) {
        const call = toolCalls[0];
        if (call.name === 'updateSystemConfig') {
           const args = call.args as Partial<SystemConfig>;
           setConfig(prev => ({ ...prev, ...args }));
           botResponseText = "He actualizado la configuración del sistema según tu solicitud.";
        }
      }

      setAiMessages(prev => [...prev, { role: 'model', text: botResponseText }]);

    } catch (error) {
      console.error(error);
      setAiMessages(prev => [...prev, { role: 'model', text: "Lo siento, hubo un error al conectar con la IA. Verifica tu API Key." }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- Views ---

  const renderAI = () => (
    <div className="h-[calc(100vh-140px)] flex flex-col animate-in fade-in duration-300">
       {/* Status Bar */}
       <div className="bg-white p-3 border-b border-slate-100 flex items-center justify-between shadow-sm z-10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
             <div className={`w-2 h-2 rounded-full ${isAiReady ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-400'}`}></div>
             <span className="text-sm font-semibold text-slate-700">
               {isAiReady ? (customApiKey ? 'Gemini AI (Llave Manual)' : 'Gemini AI Conectado') : 'Sin Conexión'}
             </span>
          </div>
          <button 
             onClick={() => {
                if(window.confirm("¿Desconectar API Key manual?")) setCustomApiKey('');
             }}
             className={`flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all ${!customApiKey ? 'hidden' : ''}`}
          >
            <Unlock size={14} /> Desconectar Manual
          </button>
       </div>

       {!isAiReady ? (
         <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col items-center justify-center p-8 text-center bg-white m-4 rounded-2xl border border-slate-100 shadow-sm max-w-xl mx-auto mt-10">
                <Sparkles size={48} className="text-indigo-500 mb-4" />
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Activar Asistente Inteligente</h2>
                <p className="text-slate-500 max-w-md mb-6">
                  Para usar el chat y realizar cambios automáticos en la app, necesitas conectar tu API Key de Google Gemini.
                </p>
                
                <div className="w-full space-y-6">
                    {/* System Option */}
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                      <p className="text-xs font-bold text-indigo-800 uppercase mb-3">Opción Recomendada</p>
                      <button 
                        onClick={() => ((window as any).aistudio as AIStudio).openSelectKey()}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200"
                      >
                        <Code size={20} /> Conectar Automáticamente
                      </button>
                    </div>
                    
                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-200"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold uppercase">O Manualmente</span>
                        <div className="flex-grow border-t border-slate-200"></div>
                    </div>

                    {/* Manual Option */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-2 text-left">Pegar API Key</p>
                        <div className="flex gap-2">
                           <input 
                             type="password"
                             value={manualKeyInput}
                             onChange={(e) => setManualKeyInput(e.target.value)}
                             placeholder="sk-..."
                             className="flex-1 p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                           />
                           <button 
                             onClick={handleSaveManualKey}
                             disabled={!manualKeyInput}
                             className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold px-4 rounded-xl flex items-center gap-2"
                           >
                             <Save size={18} />
                           </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 text-left">
                           Tu llave se guardará únicamente en el almacenamiento local de tu navegador.
                        </p>
                    </div>
                </div>

                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs text-indigo-500 mt-6 hover:underline">
                  Conseguir API Key gratis en Google AI Studio
                </a>
            </div>
         </div>
       ) : (
         <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden m-4 relative">
             <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                {aiMessages.length === 0 && (
                  <div className="text-center py-10 opacity-50">
                    <Bot size={48} className="mx-auto mb-2 text-indigo-300" />
                    <p className="text-slate-500">Hola, soy tu asistente. Pregúntame sobre tu inventario, deudas, o pídeme que cambie el nombre del negocio.</p>
                  </div>
                )}
                {aiMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[80%] p-3 rounded-2xl ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'}`}>
                        {m.text}
                     </div>
                  </div>
                ))}
                {isAiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                       <Loader2 size={16} className="animate-spin text-indigo-500" />
                       <span className="text-xs text-slate-400">Pensando...</span>
                    </div>
                  </div>
                )}
             </div>
             <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
                <input 
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAiSendMessage()}
                  placeholder="Escribe tu consulta o instrucción..."
                  className="flex-1 p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                />
                <button 
                  onClick={handleAiSendMessage}
                  disabled={isAiLoading || !aiInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-3 rounded-xl transition-colors"
                >
                  <Send size={20} />
                </button>
             </div>
         </div>
       )}
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard 
          title="Valor Inventario" 
          value={formatCurrency(totalStockValue, config.currencySymbol)}
          icon={<DollarSign className="text-emerald-600" size={24} />}
          colorClass="border-l-4 border-emerald-500"
        />
        <StatCard 
          title="Total por Cobrar" 
          value={formatCurrency(totalDebtValue, config.currencySymbol)}
          icon={<TrendingUp className="text-rose-600" size={24} />}
          colorClass="border-l-4 border-rose-500"
        />
        <StatCard 
          title="Productos Bajo Stock" 
          value={formatNumber(lowStockCount)}
          icon={<AlertTriangle className="text-amber-600" size={24} />}
          colorClass="border-l-4 border-amber-500"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Actividad Reciente</h3>
        <div className="space-y-4">
          {products.length === 0 && debts.length === 0 ? (
            <p className="text-slate-400 text-sm italic">No hay actividad registrada.</p>
          ) : (
            <div className="flex flex-col gap-2">
               {products.slice(-3).reverse().map(p => (
                 <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                   <div className="h-10 w-10 bg-slate-200 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                     {p.image ? <img src={p.image} className="w-full h-full object-cover" alt="" /> : <Package size={16} className="text-slate-500"/>}
                   </div>
                   <div className="flex-1">
                     <p className="text-sm font-semibold text-slate-700">{p.name}</p>
                     <p className="text-xs text-slate-500">Stock: {formatNumber(p.quantity)}</p>
                   </div>
                   <span className="text-xs font-mono text-slate-400">{formatDate(p.updatedAt)}</span>
                 </div>
               ))}
               {debts.slice(-3).reverse().map(d => (
                 <div key={d.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                   <div className="bg-rose-100 p-2 rounded-full"><CreditCard size={16} className="text-rose-600"/></div>
                   <div className="flex-1">
                     <p className="text-sm font-semibold text-slate-700">Deuda: {d.debtorName}</p>
                     <p className="text-xs text-slate-500">Monto: {formatCurrency(d.amount, config.currencySymbol)}</p>
                   </div>
                   <span className="text-xs font-mono text-slate-400">{formatDate(d.dueDate)}</span>
                 </div>
               ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderInventory = () => (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Buscar por nombre o código..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => handleOpenProductModal()}
          className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl flex items-center justify-center gap-2 font-medium transition-colors shadow-lg shadow-blue-200"
        >
          <Plus size={20} /> Nuevo Producto
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map(product => (
          <div key={product.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden group flex flex-col h-full">
            {product.image && (
              <div className="absolute top-0 right-0 w-24 h-24 opacity-10 group-hover:opacity-20 transition-opacity -mr-4 -mt-4 transform rotate-12">
                 <img src={product.image} className="w-full h-full object-cover rounded-full" alt="" />
              </div>
            )}

            <div className="absolute top-3 right-3 flex gap-1 z-10">
              <button onClick={() => handleOpenProductModal(product)} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg shadow-sm" title="Editar"><Edit size={14}/></button>
              <button onClick={() => handleDeleteProduct(product.id)} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg shadow-sm" title="Eliminar"><Trash2 size={14}/></button>
            </div>
            
            <div className="flex gap-3 items-start mb-3">
               <div className="w-14 h-14 bg-slate-100 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-200">
                  {product.image ? (
                    <img src={product.image} className="w-full h-full object-cover" alt={product.name} />
                  ) : (
                    <ImageIcon size={20} className="text-slate-300" />
                  )}
               </div>

               <div className="flex-1 min-w-0">
                 <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold tracking-wide uppercase mb-1 truncate max-w-full">{product.category}</span>
                 <h3 className="text-base font-bold text-slate-800 leading-tight truncate" title={product.name}>{product.name}</h3>
                 <p className="text-[10px] text-slate-500 font-mono mt-0.5">SKU: {product.sku}</p>
                 {product.defaultBulkSize && <p className="text-[9px] text-slate-400">Caja: x{product.defaultBulkSize}</p>}
               </div>
            </div>
            
            <div className="flex items-center gap-2 mb-2">
                 <button 
                    onClick={() => handleOpenStockEntry(product)} 
                    className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-colors"
                 >
                    <Plus size={12}/> Entrada Stock
                 </button>
                 <button 
                    onClick={() => handleOpenHistory(product)} 
                    className="px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg"
                    title="Historial de Movimientos"
                 >
                    <History size={14}/>
                 </button>
            </div>

            <div className="flex items-end justify-between border-t border-slate-50 pt-3 mt-auto">
              <div>
                <p className="text-[10px] text-slate-400 mb-0.5">Stock</p>
                <p className={`text-lg font-bold ${product.quantity <= config.lowStockThreshold ? 'text-rose-500' : 'text-slate-700'}`}>
                  {formatNumber(product.quantity)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 mb-0.5">Precio</p>
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(product.price, config.currencySymbol)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderDebts = () => (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Buscar cliente..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
          className="w-full md:w-auto bg-rose-600 hover:bg-rose-700 text-white px-6 py-2 rounded-xl flex items-center justify-center gap-2 font-medium transition-colors shadow-lg shadow-rose-200"
        >
          <Plus size={20} /> Nueva Deuda
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredClients.map(clientName => {
          const stats = clientStats[clientName];
          const hasDebt = stats.total > 0;
          return (
            <div 
              key={clientName} 
              onClick={() => setSelectedClient(clientName)}
              className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:border-rose-100 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-full ${hasDebt ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    <User size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800 truncate max-w-[120px]" title={clientName}>{clientName}</h3>
                </div>
                <ChevronRight size={20} className="text-slate-300 group-hover:text-slate-500" />
              </div>
              
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Total Deuda</p>
                  <p className={`text-xl font-bold ${hasDebt ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatCurrency(stats.total, config.currencySymbol)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-1">Pendientes</p>
                  <p className="text-lg font-bold text-slate-700">{stats.count}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderClientDetails = () => {
    if (!selectedClient) return null;
    const stats = clientStats[selectedClient];

    return (
      <div className="fixed inset-0 z-50 bg-white md:bg-slate-50 overflow-y-auto animate-in slide-in-from-bottom-10 duration-300">
        <div className="max-w-4xl mx-auto min-h-screen bg-white md:my-8 md:rounded-2xl md:shadow-xl md:min-h-0 md:h-auto overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
             <div className="flex items-center gap-4">
               <button onClick={() => setSelectedClient(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                 <ArrowLeft size={24} className="text-slate-600" />
               </button>
               <div>
                 <h2 className="text-2xl font-bold text-slate-800">{selectedClient}</h2>
                 <p className="text-sm text-slate-500">Historial de deudas</p>
               </div>
             </div>
             <div className="flex gap-2">
                <button 
                  onClick={() => handleDeleteClient(selectedClient)}
                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg" 
                  title="Eliminar Cliente"
                >
                  <Trash2 size={20} />
                </button>
                <button 
                   onClick={() => { 
                     setEditingItem({ debtorName: selectedClient }); 
                     setIsModalOpen(true); 
                   }}
                   className="bg-rose-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium shadow-lg shadow-rose-200"
                 >
                   <Plus size={18} /> <span className="hidden sm:inline">Agregar Deuda</span>
                 </button>
             </div>
          </div>

          <div className="bg-slate-50 p-6 flex flex-col sm:flex-row gap-6 border-b border-slate-100 items-start sm:items-center">
             <div className="flex-1">
               <p className="text-sm uppercase tracking-wider text-slate-500 font-medium mb-1">Total Pendiente</p>
               <div className="flex items-center gap-4 flex-wrap">
                  <p className="text-3xl font-black text-rose-600">{formatCurrency(stats.total, config.currencySymbol)}</p>
                  {stats.total > 0 && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-all flex items-center gap-2 whitespace-nowrap"
                      >
                        <Banknote size={16} /> Abonar
                      </button>
                      <button 
                        onClick={() => handleSettleClientDebt(selectedClient, stats.total)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-all flex items-center gap-2 whitespace-nowrap"
                      >
                        <CheckCircle size={16} /> Liquidar Todo
                      </button>
                    </div>
                  )}
               </div>
             </div>
             <div className="flex-1">
               <p className="text-sm uppercase tracking-wider text-slate-500 font-medium mb-1">Notas / Items</p>
               <p className="text-3xl font-bold text-slate-700">{stats.debts.length}</p>
             </div>
          </div>

          <div className="p-6 space-y-4">
            {stats.debts.map(debt => (
              <div key={debt.id} className={`p-4 rounded-xl border ${debt.isPaid ? 'bg-slate-50 border-slate-200' : 'bg-white border-rose-100 shadow-sm'} flex flex-col sm:flex-row justify-between gap-4`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-800 text-lg">{debt.description}</span>
                    {debt.isPaid && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Pagado</span>}
                  </div>
                  <p className="text-sm text-slate-500">Vence: {formatDate(debt.dueDate)}</p>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <span className={`text-xl font-bold ${debt.isPaid ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                    {formatCurrency(debt.amount, config.currencySymbol)}
                  </span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => toggleDebtStatus(debt.id)}
                      className={`p-2 rounded-lg transition-colors ${debt.isPaid ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'}`}
                    >
                      {debt.isPaid ? <XCircle size={18} /> : <CheckCircle size={18} />}
                    </button>
                    <button onClick={() => { setEditingItem(debt); setIsModalOpen(true); }} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg">
                      <Edit size={18} />
                    </button>
                    <button onClick={() => handleDeleteDebt(debt.id)} className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderPOS = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300 h-[calc(100vh-140px)]">
      {/* Product Selector (Left side - now ~60%) */}
      <div className="lg:col-span-7 flex flex-col gap-4 h-full">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Buscar productos para agregar..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
          {filteredProducts.map(product => (
             <div key={product.id} className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                   <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                     {product.image ? (
                       <img src={product.image} className="w-full h-full object-cover" alt="" />
                     ) : (
                       <Package size={20} className="text-slate-400" />
                     )}
                   </div>
                   <div className="min-w-0">
                      <h3 className="font-bold text-slate-800 text-sm truncate">{product.name}</h3>
                      <div className="flex gap-4 text-xs text-slate-500">
                        <span>{formatCurrency(product.price, config.currencySymbol)}</span>
                        <span className={product.quantity <= 0 ? "text-rose-500 font-bold" : ""}>Disp: {formatNumber(product.quantity)}</span>
                      </div>
                   </div>
                </div>
                {product.quantity > 0 ? (
                  <button 
                    onClick={() => addToCart(product.id)}
                    className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 p-2 rounded-xl transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 font-medium px-2">Agotado</span>
                )}
              </div>
          ))}
        </div>
      </div>

      {/* Cart Summary (Right side - now ~40%) */}
      <div className="lg:col-span-5 bg-white rounded-2xl shadow-xl border border-slate-100 flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <ShoppingBag size={20} className="text-indigo-600"/> 
            Carrito
          </h2>
          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">{cartItemCount} items</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {Object.entries(cart).length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <ShoppingCart size={40} className="mb-2 opacity-20"/>
              <p className="text-sm">Carrito vacío</p>
            </div>
          ) : (
            Object.entries(cart).map(([id, item]) => {
              const cartItem = item as CartItem;
              const p = products.find(prod => prod.id === id);
              if (!p) return null;

              const unitsReq = cartItem.quantity * (cartItem.isBulk ? cartItem.bulkSize : 1);
              const isStockIssue = unitsReq > p.quantity;

              return (
                <div key={id} className={`bg-slate-50 p-2 rounded-lg border ${isStockIssue ? 'border-rose-300 bg-rose-50' : 'border-slate-200'} shadow-sm`}>
                  {/* Dense Row Header */}
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                       <p className="font-bold text-xs text-slate-800 truncate">{p.name}</p>
                    </div>
                    <button onClick={() => removeFromCart(id)} className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded">
                       <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Dense Controls */}
                  <div className="flex gap-2 items-center">
                    <div className="w-16">
                      <input 
                        type="number" 
                        min="1"
                        value={cartItem.quantity}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateCartItem(id, { quantity: parseInt(e.target.value) || 0 })}
                        className="w-full p-1 text-sm font-bold text-center rounded border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none h-8"
                      />
                    </div>
                    
                    <div className="flex-1">
                      <div className="relative">
                         <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                         <input 
                           type="number" 
                           min="0"
                           step="0.01"
                           value={cartItem.customPrice}
                           onFocus={(e) => e.target.select()}
                           onChange={(e) => updateCartItem(id, { customPrice: parseFloat(e.target.value) || 0 })}
                           className="w-full pl-5 pr-1 py-1 text-sm text-right rounded border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none h-8"
                         />
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                         <button 
                           onClick={() => updateCartItem(id, { isBulk: !cartItem.isBulk })}
                           className={`h-8 px-2 rounded text-[10px] font-bold uppercase transition-colors border ${cartItem.isBulk ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-300'}`}
                         >
                           {cartItem.isBulk ? 'Caja' : 'Unit'}
                         </button>
                         {cartItem.isBulk && (
                            <input 
                            type="number"
                            min="1"
                            value={cartItem.bulkSize}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateCartItem(id, { bulkSize: parseInt(e.target.value) || 1 })}
                            className="w-10 h-8 p-1 text-xs text-center rounded border border-slate-300"
                            title="Unidades por caja"
                          />
                         )}
                    </div>
                  </div>

                  {/* Footer Stats */}
                  <div className="flex justify-between items-center mt-1 pt-1 border-t border-slate-200/50">
                     <div className="text-[10px] text-slate-400">
                       Subtotal: <span className="font-bold text-indigo-600 text-xs">{formatCurrency(cartItem.quantity * cartItem.customPrice, config.currencySymbol)}</span>
                     </div>
                     {isStockIssue && (
                       <div className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                         <AlertTriangle size={10} /> Stock: {p.quantity}
                       </div>
                     )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-3">
          <div className="flex justify-between items-end mb-1">
            <span className="text-slate-500 font-medium text-sm">Total a Pagar</span>
            <span className="text-2xl font-black text-slate-800">{formatCurrency(cartTotal, config.currencySymbol)}</span>
          </div>
          
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">Cliente (Sistema)</label>
              <input 
                list="pos-clients-list"
                value={posClient}
                onChange={(e) => setPosClient(e.target.value)}
                placeholder="Nombre para el sistema..."
                className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white shadow-sm"
              />
              <datalist id="pos-clients-list">
                {clients.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <button 
                onClick={() => setIsTicketModalOpen(true)}
                className="bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 p-2.5 rounded-lg shadow-sm transition-colors relative"
                title="Configurar Datos del Ticket (Independientes)"
            >
                <FileText size={20} />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                </span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
             <button 
               onClick={() => handleCheckout('sale')}
               disabled={cartItemCount === 0}
               className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
             >
               <span className="text-[10px] opacity-80 mb-0.5 uppercase tracking-wide">Venta</span>
               <span className="font-bold text-sm">Contado</span>
             </button>
             <button 
               onClick={() => handleCheckout('consignment')}
               disabled={cartItemCount === 0}
               className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
             >
               <span className="text-[10px] opacity-80 mb-0.5 uppercase tracking-wide">Consignación</span>
               <span className="font-bold text-sm">Crédito / Deuda</span>
             </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="animate-in fade-in duration-500 space-y-6">
      
      {/* Google Drive Sync Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
         <div className="flex items-center gap-3 mb-4">
             <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
               <Cloud size={24} />
             </div>
             <div>
               <h3 className="text-lg font-bold text-slate-800">Sincronización en la Nube (Google Drive)</h3>
               <p className="text-sm text-slate-500">Guarda automáticamente tus datos al cerrar la app.</p>
             </div>
         </div>

         <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            {!config.googleDriveClientId ? (
               <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Para activar la sincronización, necesitas un <strong>Client ID</strong> de Google Cloud.
                    <br/>
                    <a href="https://console.cloud.google.com/" target="_blank" className="text-blue-600 hover:underline">Ir a Google Cloud Console &rarr;</a>
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Google Client ID</label>
                    <input 
                      value={manualKeyInput} 
                      onChange={(e) => setManualKeyInput(e.target.value)}
                      placeholder="Ej. 123456789-abc...apps.googleusercontent.com"
                      className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <button 
                    onClick={() => {
                       setConfig(prev => ({ ...prev, googleDriveClientId: manualKeyInput }));
                       setManualKeyInput('');
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm"
                  >
                    Guardar ID
                  </button>
               </div>
            ) : (
               <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${userInfo?.connected ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                        <span className="font-bold text-slate-700">Estado: {userInfo?.connected ? 'Conectado' : 'Esperando autorización...'}</span>
                     </div>
                     {config.lastSync && (
                       <span className="text-xs text-slate-400">Última Sync: {new Date(config.lastSync).toLocaleString()}</span>
                     )}
                  </div>
                  
                  <div className="flex gap-2">
                     {!userInfo?.connected && (
                        <button 
                          onClick={handleDriveConnect}
                          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors"
                        >
                          <CloudLightning size={16} /> Conectar con Google
                        </button>
                     )}
                     
                     {userInfo?.connected && (
                       <>
                         <button 
                           onClick={() => uploadToDrive(true)}
                           disabled={isSyncing}
                           className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
                         >
                           {isSyncing ? <Loader2 size={16} className="animate-spin"/> : <UploadCloud size={16} />} 
                           Subir Ahora
                         </button>
                         <button 
                           onClick={checkForRemoteUpdates}
                           disabled={isSyncing}
                           className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
                         >
                           <DownloadCloud size={16} /> Restaurar
                         </button>
                       </>
                     )}

                     <button 
                       onClick={() => {
                         if(window.confirm("¿Desvincular cuenta?")) {
                            setConfig(prev => ({ ...prev, googleDriveClientId: undefined, googleDriveBackupFileId: undefined }));
                            setUserInfo(null);
                            setTokenClient(null);
                         }
                       }}
                       className="ml-auto text-rose-500 hover:bg-rose-50 px-3 py-2 rounded-xl"
                       title="Desvincular"
                     >
                       <LogOut size={18} />
                     </button>
                  </div>
               </div>
            )}
         </div>
      </div>
      
      {/* Local Backup Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
         <div className="flex items-center gap-3 mb-4">
             <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
               <HardDrive size={24} />
             </div>
             <div>
               <h3 className="text-lg font-bold text-slate-800">Respaldo Local (Archivo)</h3>
               <p className="text-sm text-slate-500">Descarga o sube tus datos manualmente en un archivo.</p>
             </div>
         </div>

         <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap gap-4">
            <button 
              onClick={handleExportData}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-3 rounded-xl font-bold text-sm transition-colors"
            >
              <Download size={18} /> Guardar Datos
            </button>

            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-5 py-3 rounded-xl font-bold text-sm transition-colors"
            >
              <Upload size={18} /> Cargar Datos
            </button>
            
            {/* Hidden Input for File Selection */}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".json" 
              onChange={handleImportData}
            />
         </div>
      </div>

      <div className="bg-slate-900 text-slate-300 p-6 rounded-2xl shadow-lg font-mono">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-4">
          <Code className="text-emerald-400" />
          <h2 className="text-xl font-bold text-white">Consola de Configuración (API Interna)</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">Estado Actual (JSON)</h3>
            <pre className="bg-slate-950 p-4 rounded-xl overflow-x-auto text-xs leading-relaxed border border-slate-800">
              {JSON.stringify(config, null, 2)}
            </pre>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">Inyectar Cambios</h3>
            <p className="text-xs text-slate-400 mb-3">
              Pega un JSON válido aquí para actualizar códigos internos, impuestos o categorías.
            </p>
            <textarea
              className="w-full h-48 bg-slate-800 text-emerald-300 border border-slate-700 rounded-xl p-4 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none mb-4"
              placeholder='{ "currencySymbol": "€", "taxRate": 0.21, ... }'
              value={apiJsonInput}
              onChange={(e) => setApiJsonInput(e.target.value)}
            ></textarea>
            <button 
              onClick={handleApiUpdate}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Save size={18} /> Aplicar Cambios
            </button>
            <button 
              onClick={() => setApiJsonInput(JSON.stringify(config, null, 2))}
              className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-4"
            >
              <RefreshCw size={18} /> Cargar Config Actual
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      {/* Sidebar Navigation */}
      <aside className="w-20 lg:w-64 bg-slate-900 flex flex-col items-center lg:items-stretch py-6 flex-shrink-0 transition-all z-20">
        <div className="mb-8 px-4 flex items-center justify-center lg:justify-start gap-3">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30">
            GP
          </div>
          <span className="text-xl font-bold text-white hidden lg:block tracking-tight">Gestor Pro</span>
        </div>

        <nav className="flex-1 space-y-2 px-2">
          <button 
            onClick={() => setCurrentView('dashboard')}
            className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${currentView === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            title="Dashboard"
          >
            <LayoutDashboard size={22} />
            <span className="hidden lg:block font-medium">Dashboard</span>
          </button>
          
          <button 
            onClick={() => setCurrentView('pos')}
            className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${currentView === 'pos' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            title="Punto de Venta"
          >
            <ShoppingCart size={22} />
            <span className="hidden lg:block font-medium">Vender</span>
          </button>

          <button 
            onClick={() => setCurrentView('inventory')}
            className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${currentView === 'inventory' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            title="Inventario"
          >
            <Package size={22} />
            <span className="hidden lg:block font-medium">Inventario</span>
          </button>

          <button 
            onClick={() => setCurrentView('debts')}
            className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${currentView === 'debts' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            title="Deudas"
          >
            <CreditCard size={22} />
            <span className="hidden lg:block font-medium">Deudas</span>
          </button>

          <button 
            onClick={() => setCurrentView('ai')}
            className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${currentView === 'ai' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            title="Asistente AI"
          >
            <Bot size={22} />
            <span className="hidden lg:block font-medium">Asistente AI</span>
          </button>
        </nav>

        <div className="px-2 mt-auto">
          <button 
            onClick={() => setCurrentView('settings')}
            className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${currentView === 'settings' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
            title="Configuración"
          >
            <Settings size={22} />
            <span className="hidden lg:block font-medium">Ajustes</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto h-full relative">
        <header className="bg-white border-b border-slate-100 p-6 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md bg-white/80">
          <div className="flex items-center gap-4">
             <div>
               <h1 className="text-2xl font-black text-slate-800 capitalize tracking-tight">
                 {currentView === 'pos' ? 'Punto de Venta' : currentView === 'ai' ? 'Asistente Virtual' : currentView}
               </h1>
               <p className="text-sm text-slate-400 font-medium">
                 {config.shopName} - {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
               </p>
             </div>
             {/* Sync Status Badge */}
             {userInfo?.connected && (
               <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold animate-in fade-in">
                 {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <Cloud size={12} />}
                 {isSyncing ? 'Sincronizando...' : 'Nube Activa'}
               </div>
             )}
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden md:flex flex-col items-end">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Usuario</span>
                <span className="text-sm font-bold text-slate-700">Administrador</span>
             </div>
             <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold">
                AD
             </div>
          </div>
        </header>

        <div className="p-6 pb-24">
          {currentView === 'dashboard' && renderDashboard()}
          {currentView === 'inventory' && renderInventory()}
          {currentView === 'debts' && renderDebts()}
          {currentView === 'settings' && renderSettings()}
          {currentView === 'pos' && renderPOS()}
          {currentView === 'ai' && renderAI()}
        </div>
      </main>

      {/* Slide-over for Client Details */}
      {selectedClient && renderClientDetails()}

      {/* Modals */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setPreviewImage(null); }} 
        title={currentView === 'inventory' ? (editingItem ? 'Editar Producto' : 'Nuevo Producto') : (editingItem ? 'Editar Deuda' : 'Nueva Deuda')}
      >
        {currentView === 'inventory' ? (
          <form onSubmit={handleSaveProduct} className="space-y-4">
             <div className="flex flex-col items-center mb-4">
                <label className="relative w-32 h-32 bg-slate-100 rounded-2xl flex flex-col items-center justify-center cursor-pointer overflow-hidden border-2 border-dashed border-slate-300 hover:bg-slate-50 transition-colors group">
                  {previewImage ? (
                    <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Camera className="text-slate-400 mb-2 group-hover:text-slate-600" size={32} />
                      <span className="text-xs text-slate-400 font-medium text-center px-2">Subir Foto</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
             </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Código SKU</label>
                  <div className="flex gap-2">
                    <input name="sku" required value={formSku} onChange={(e) => setFormSku(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 font-mono text-sm" placeholder="AUTO-GEN" />
                    <button type="button" onClick={() => setFormSku(generateSKU())} className="p-3 bg-slate-200 rounded-xl hover:bg-slate-300" title="Generar Nuevo"><RefreshCw size={18}/></button>
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Categoría</label>
                  <input 
                    name="category" 
                    required 
                    defaultValue={editingItem?.category} 
                    list="categories-list"
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" 
                    placeholder="Seleccionar o escribir..."
                  />
                  <datalist id="categories-list">
                    {config.categories.map(c => <option key={c} value={c} />)}
                  </datalist>
               </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nombre del Producto</label>
              <input name="name" required defaultValue={editingItem?.name} className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej. Camiseta Algodón" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Stock (Unidades)</label>
                <input name="quantity" type="number" required defaultValue={editingItem?.quantity} className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Precio Venta</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{config.currencySymbol}</span>
                  <input name="price" type="number" step="0.01" required defaultValue={editingItem?.price} className="w-full pl-8 p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
               <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                 <Box size={16} /> Unidades por Caja (Defecto)
               </label>
               <input 
                 name="defaultBulkSize" 
                 type="number" 
                 min="1"
                 defaultValue={editingItem?.defaultBulkSize || 12} 
                 className="w-full p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" 
                 placeholder="Ej. 12" 
               />
               <p className="text-[10px] text-slate-500 mt-1">Se usará como valor predeterminado al vender o agregar stock por caja.</p>
            </div>
            
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl mt-4 flex items-center justify-center gap-2">
              <Save size={20} /> Guardar Producto
            </button>
          </form>
        ) : (
          <form onSubmit={handleSaveDebt} className="space-y-4">
             <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Cliente</label>
              <input 
                 name="debtorName" 
                 required 
                 defaultValue={editingItem?.debtorName} 
                 list="clients-list"
                 className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none"
                 placeholder="Nombre del cliente..."
                 autoComplete="off"
              />
              <datalist id="clients-list">
                 {clients.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Descripción / Items</label>
              <input name="description" required defaultValue={editingItem?.description} className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none" placeholder="Ej. Compra a crédito..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Monto</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{config.currencySymbol}</span>
                  <input name="amount" type="number" step="0.01" required defaultValue={editingItem?.amount} className="w-full pl-8 p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none" placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Fecha Límite</label>
                <input name="dueDate" type="date" required defaultValue={editingItem?.dueDate} className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none" />
              </div>
            </div>

            <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl mt-4 flex items-center justify-center gap-2">
              <Save size={20} /> Guardar Deuda
            </button>
          </form>
        )}
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => { setIsPaymentModalOpen(false); setPaymentAmount(''); }}
        title={`Abonar a ${selectedClient}`}
      >
        <form onSubmit={handlePartialPayment} className="space-y-4">
          <p className="text-sm text-slate-500">
            El abono se aplicará automáticamente a las deudas más antiguas primero.
          </p>
          <div>
             <label className="block text-sm font-bold text-slate-700 mb-1">Monto a Abonar</label>
             <div className="relative">
               <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{config.currencySymbol}</span>
               <input 
                 type="number" 
                 step="0.01" 
                 required 
                 value={paymentAmount}
                 onChange={(e) => setPaymentAmount(e.target.value)}
                 className="w-full pl-8 p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-xl font-bold text-slate-800" 
                 placeholder="0.00" 
                 autoFocus
               />
             </div>
          </div>
          <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl mt-4 flex items-center justify-center gap-2">
            <Banknote size={20} /> Registrar Abono
          </button>
        </form>
      </Modal>

      {/* Stock Entry Modal */}
      <Modal
        isOpen={isStockEntryModalOpen}
        onClose={() => { setIsStockEntryModalOpen(false); setStockEntryQty(''); }}
        title={`Entrada de Stock: ${editingItem?.name}`}
      >
        <form onSubmit={handleStockEntry} className="space-y-4">
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-center gap-3">
             <div className="p-3 bg-emerald-100 rounded-full text-emerald-600"><Package size={24}/></div>
             <div>
                <p className="text-sm text-emerald-800 font-medium">Stock Actual</p>
                <p className="text-2xl font-bold text-emerald-700">{editingItem?.quantity}</p>
             </div>
          </div>

          <div className="flex gap-2 justify-center mb-2">
            <button 
              type="button" 
              onClick={() => setStockEntryIsBulk(false)}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${!stockEntryIsBulk ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              Por Unidad
            </button>
            <button 
              type="button" 
              onClick={() => setStockEntryIsBulk(true)}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${stockEntryIsBulk ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              Por Caja / Paca
            </button>
          </div>

          <div className="flex gap-4">
             <div className="flex-1">
                 <label className="block text-sm font-bold text-slate-700 mb-1">
                     {stockEntryIsBulk ? 'Cantidad de Cajas' : 'Cantidad a Agregar'}
                 </label>
                 <input 
                   type="number" 
                   min="1"
                   required 
                   value={stockEntryQty}
                   onChange={(e) => setStockEntryQty(e.target.value)}
                   className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-xl font-bold text-center" 
                   placeholder="0" 
                   autoFocus
                 />
             </div>
             {stockEntryIsBulk && (
                 <div className="w-1/3">
                     <label className="block text-sm font-bold text-slate-700 mb-1">Unidades/Caja</label>
                     <input 
                       type="number" 
                       min="1"
                       required 
                       value={stockEntryBulkSize}
                       onChange={(e) => setStockEntryBulkSize(Number(e.target.value))}
                       className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-xl font-bold text-center" 
                     />
                 </div>
             )}
          </div>
          
          {stockEntryIsBulk && stockEntryQty && (
            <div className="text-center bg-slate-50 p-2 rounded-lg text-sm text-slate-600">
                Total a agregar: <strong>{parseInt(stockEntryQty) * stockEntryBulkSize}</strong> unidades
            </div>
          )}

          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl mt-4 flex items-center justify-center gap-2">
            <Plus size={20} /> Confirmar Entrada
          </button>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Historial: ${editingItem?.name}`}
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
           {itemHistory.length === 0 ? (
               <div className="text-center py-8 text-slate-400 italic">No hay movimientos registrados.</div>
           ) : (
               itemHistory.map(h => (
                   <div key={h.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                       <div>
                           <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${h.type === 'entrada' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                {h.type}
                              </span>
                              <span className="text-xs text-slate-400">{new Date(h.date).toLocaleString()}</span>
                           </div>
                           <p className="font-bold text-slate-700 text-sm mt-1">{h.note}</p>
                       </div>
                       <div className="flex items-center gap-3">
                           <span className={`text-lg font-bold ${h.type === 'entrada' ? 'text-emerald-600' : 'text-slate-600'}`}>
                              {h.type === 'entrada' ? '+' : '-'}{h.quantity}
                           </span>
                           {/* Allow delete for corrections */}
                           <button 
                             onClick={() => handleDeleteHistoryItem(h)}
                             className="text-slate-300 hover:text-rose-500 p-1"
                             title="Eliminar registro (Revertir)"
                           >
                             <Trash2 size={16}/>
                           </button>
                       </div>
                   </div>
               ))
           )}
        </div>
      </Modal>

      {/* Ticket Config Modal */}
      <Modal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        title="Datos para Factura / Ticket"
      >
        <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-4">
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-4">
                    <p className="text-xs text-indigo-800 mb-2 font-medium">
                        Estos datos son exclusivamente para la impresión del ticket y no afectan al cliente seleccionado en el sistema.
                    </p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Título del Ticket</label>
                  <input 
                    value={ticketConfig.title}
                    onChange={(e) => setTicketConfig({...ticketConfig, title: e.target.value})}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-900" 
                    placeholder="Ej. NOTA DE ENTREGA"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nombre Cliente</label>
                  <input 
                    value={ticketConfig.name}
                    onChange={(e) => setTicketConfig({...ticketConfig, name: e.target.value})}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                    placeholder="Dejar vacío para usar cliente del sistema"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">CI / DNI</label>
                  <input 
                    value={ticketConfig.ci}
                    onChange={(e) => setTicketConfig({...ticketConfig, ci: e.target.value})}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                    placeholder="Documento de Identidad"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Dirección</label>
                  <input 
                    value={ticketConfig.address}
                    onChange={(e) => setTicketConfig({...ticketConfig, address: e.target.value})}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                    placeholder="Dirección fiscal"
                  />
                </div>
                <button 
                  onClick={() => setIsTicketModalOpen(false)}
                  className="w-full bg-indigo-600 text-white py-2 rounded-xl font-bold mt-4"
                >
                  Guardar y Volver
                </button>
            </div>
            
            {/* Live Preview - Updated to mimic Thermal Printer style */}
            <div className="w-full md:w-64 bg-slate-200 p-4 rounded-xl border border-slate-300 flex flex-col items-center">
                <span className="text-xs text-slate-500 font-bold mb-2 uppercase tracking-wider flex items-center gap-1"><Eye size={12}/> Vista Previa (58mm)</span>
                <div className="bg-white p-2 w-[58mm] min-h-[250px] shadow-sm text-[11px] font-[Courier] leading-tight text-black overflow-hidden relative">
                    <div className="text-center mb-2">
                        <div className="text-base uppercase" style={{fontSize: '14px'}}>{config.shopName}</div>
                        <div className="uppercase my-1" style={{fontSize: '12px'}}>{ticketConfig.title}</div>
                        <div>Nº: {Math.floor(Math.random() * 1000)}</div>
                        <div>{new Date().toLocaleDateString('es-MX')}</div>
                    </div>
                    
                    <div className="border-t border-dashed border-black my-1"></div>
                    
                    <div className="mb-2">
                        <div>CLI: {(ticketConfig.name || posClient || 'CONSUMIDOR FINAL').toUpperCase()}</div>
                        {ticketConfig.ci && <div>CI: {ticketConfig.ci}</div>}
                    </div>

                    <div className="border-t border-dashed border-black my-1"></div>

                    <div className="space-y-2">
                        {Object.keys(cart).length === 0 ? (
                           <div className="text-slate-400 italic text-center py-2">-- Vacío --</div>
                        ) : (
                           Object.entries(cart).map(([id, item]) => {
                               const p = products.find(prod => prod.id === id);
                               const cartItem = item as CartItem;
                               return (
                                   <div key={id}>
                                       <div className="uppercase">{p?.name.substring(0, 25)}</div>
                                       <div className="flex justify-between">
                                          <span>{cartItem.quantity} x {formatNumber(cartItem.customPrice)}</span>
                                          <span>{formatNumber(cartItem.quantity * cartItem.customPrice)}</span>
                                       </div>
                                   </div>
                               );
                           })
                        )}
                    </div>

                    <div className="border-y border-dashed border-black my-2 py-1 flex justify-between text-sm" style={{fontSize: '14px'}}>
                        <span>TOTAL:</span>
                        <span>{formatCurrency(cartTotal, config.currencySymbol)}</span>
                    </div>

                    <div className="mt-8 text-center">
                       <div className="border-t border-black w-3/4 mx-auto mb-1"></div>
                       <div className="text-[10px]">Firma / Recibí Conforme</div>
                    </div>
                </div>
            </div>
        </div>
      </Modal>
    </div>
  );
}
