import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  doc, 
  updateDoc, 
  addDoc, 
  setDoc, 
  serverTimestamp, 
  deleteDoc 
} from 'firebase/firestore';
import { 
  Store, 
  Tag, 
  PlusCircle, 
  Package, 
  Edit2, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Minus, 
  X, 
  Image as ImageIcon, 
  Upload,
  Percent
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Product, Branch, ProductComponent } from '../types';

export const InventoryModule = () => {
  const { user } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'discounts'>('products');
  const [selectedBranchId, setSelectedBranchId] = useState(user?.branch_id || '');
  const [editing, setEditing] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddDiscount, setShowAddDiscount] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<any | null>(null);
  const [deletingDiscount, setDeletingDiscount] = useState<any | null>(null);
  const [isComposite, setIsComposite] = useState(false);
  const [selectedComponents, setSelectedComponents] = useState<ProductComponent[]>([]);
  const [adjustingStock, setAdjustingStock] = useState<any | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [showCategories, setShowCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const cats = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      setCategories(cats);
    }, (err) => {
      if (err.code === 'permission-denied') return;
      handleFirestoreError(err, OperationType.LIST, 'categories');
    });

    return () => unsubCategories();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (err) => {
      if (err.code === 'permission-denied') return;
      handleFirestoreError(err, OperationType.LIST, 'products');
    });

    return () => unsubProducts();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubBranches = onSnapshot(collection(db, 'branches'), (snapshot) => {
      setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
    }, (err) => {
      if (err.code === 'permission-denied') return;
      handleFirestoreError(err, OperationType.LIST, 'branches');
    });

    return () => unsubBranches();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubDiscounts = onSnapshot(collection(db, 'discounts'), (snapshot) => {
      setDiscounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      if (err.code === 'permission-denied') return;
      handleFirestoreError(err, OperationType.LIST, 'discounts');
    });

    return () => unsubDiscounts();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedBranchId) return;
    const q = query(collection(db, 'branches', selectedBranchId, 'stock'));
    const unsubStock = onSnapshot(q, (snapshot) => {
      setStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      if (err.code === 'permission-denied') return;
      handleFirestoreError(err, OperationType.LIST, `branches/${selectedBranchId}/stock`);
    });
    return () => unsubStock();
  }, [user, selectedBranchId]);

  useEffect(() => {
    if (editing) {
      setIsComposite(!!editing.is_composite);
      if (editing.components) {
        setSelectedComponents(editing.components);
      } else {
        setSelectedComponents([]);
      }
    } else {
      setIsComposite(false);
      setSelectedComponents([]);
      setImagePreview(null);
    }
  }, [editing, showAdd]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data: any = Object.fromEntries(formData.entries());
    
    data.is_composite = isComposite;
    data.components = isComposite ? selectedComponents : [];
    data.cost = parseFloat(data.cost);
    data.price = parseFloat(data.price);
    if (imagePreview) {
      data.image_url = imagePreview;
    }

    try {
      let productId = editing?.id;
      if (editing) {
        await updateDoc(doc(db, 'products', editing.id), data);
      } else {
        const docRef = await addDoc(collection(db, 'products'), data);
        productId = docRef.id;
        
        const initialStock = parseFloat(data.initial_stock || '0');
        if (user?.branch_id && initialStock > 0 && !isComposite) {
          await setDoc(doc(db, 'branches', user.branch_id, 'stock', productId), {
            quantity: initialStock,
            lastUpdated: serverTimestamp()
          });
        }
      }
      setEditing(null);
      setShowAdd(false);
      setImagePreview(null);
    } catch (err) {
      handleFirestoreError(err, editing ? OperationType.UPDATE : OperationType.CREATE, 'products');
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const quantity = parseFloat(formData.get('quantity') as string);

    try {
      const stockRef = doc(db, 'branches', selectedBranchId, 'stock', adjustingStock.id);
      await setDoc(stockRef, {
        quantity,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      setAdjustingStock(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `branches/${selectedBranchId}/stock/${adjustingStock.id}`);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      if (editingCategory) {
        await updateDoc(doc(db, 'categories', editingCategory.id), { name: newCategoryName.trim() });
      } else {
        await addDoc(collection(db, 'categories'), { name: newCategoryName.trim() });
      }
      setNewCategoryName('');
      setEditingCategory(null);
    } catch (err) {
      handleFirestoreError(err, editingCategory ? OperationType.UPDATE : OperationType.CREATE, 'categories');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'categories');
    }
  };

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;
    try {
      await deleteDoc(doc(db, 'products', deletingProduct.id));
      if (user?.branch_id) {
        await deleteDoc(doc(db, 'branches', user.branch_id, 'stock', deletingProduct.id));
      }
      setDeletingProduct(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${deletingProduct.id}`);
    }
  };

  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      name: formData.get('name') as string,
      value: parseFloat(formData.get('value') as string),
      type: formData.get('type') as string, // 'percentage' | 'fixed'
      enabled: true
    };
    try {
      if (editingDiscount) {
        await updateDoc(doc(db, 'discounts', editingDiscount.id), data);
      } else {
        await addDoc(collection(db, 'discounts'), data);
      }
      setShowAddDiscount(false);
      setEditingDiscount(null);
    } catch (err) {
      handleFirestoreError(err, editingDiscount ? OperationType.UPDATE : OperationType.CREATE, 'discounts');
    }
  };

  const handleDeleteDiscount = async () => {
    if (!deletingDiscount) return;
    try {
      await deleteDoc(doc(db, 'discounts', deletingDiscount.id));
      setDeletingDiscount(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `discounts/${deletingDiscount.id}`);
    }
  };

  const addComponent = () => {
    setSelectedComponents([...selectedComponents, { id: '', quantity: 1, type: 'product' }]);
  };

  const removeComponent = (index: number) => {
    setSelectedComponents(selectedComponents.filter((_, i) => i !== index));
  };

  const updateComponent = (index: number, field: keyof ProductComponent, value: any) => {
    const newComps = [...selectedComponents];
    newComps[index] = { ...newComps[index], [field]: value };
    setSelectedComponents(newComps);
  };

  const calculatedCost = isComposite 
    ? selectedComponents.reduce((acc, comp) => {
        if (comp.type === 'category') return acc;
        const product = products.find(p => p.id === comp.id);
        return acc + (product?.cost || 0) * comp.quantity;
      }, 0)
    : 0;

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 h-full overflow-y-auto noscrollbar">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-stone-900 uppercase tracking-tight">Stock</h1>
          <p className="text-xs lg:text-sm text-stone-500 font-medium">Gestión de productos, existencias y descuentos</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-stone-100 p-1 rounded-2xl mr-4">
            <button 
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'products' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              Productos
            </button>
            <button 
              onClick={() => setActiveTab('discounts')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'discounts' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              Descuentos
            </button>
          </div>

          {activeTab === 'products' ? (
            <>
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-stone-200 shadow-sm">
                <Store size={16} className="text-stone-400" />
                <select 
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 font-bold text-stone-700 text-xs"
                >
                  <option value="">Seleccionar Sucursal</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={() => setShowCategories(true)}
                className="bg-white text-stone-600 px-4 py-2 rounded-xl border border-stone-200 font-bold flex items-center gap-2 hover:bg-stone-50 transition-all text-sm"
              >
                <Tag size={18} />
                Categorías
              </button>
              <button 
                onClick={() => setShowAdd(true)}
                className="bg-brand-red text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-brand-red/20 text-sm"
              >
                <PlusCircle size={18} />
                Nuevo Producto
              </button>
            </>
          ) : (
            <button 
              onClick={() => setShowAddDiscount(true)}
              className="bg-brand-red text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-brand-red/20 text-sm"
            >
              <Percent size={18} />
              Nuevo Descuento
            </button>
          )}
        </div>
      </div>

      {activeTab === 'products' ? (
        <div className="bg-white rounded-[40px] shadow-sm border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-50 text-stone-500 text-[10px] uppercase tracking-[0.15em] font-black border-b border-stone-200">
                  <th className="px-8 py-6">Producto</th>
                  <th className="px-8 py-6">Categoría</th>
                  <th className="px-8 py-6">Costo</th>
                  <th className="px-8 py-6">Precio</th>
                  <th className="px-8 py-6">Stock</th>
                  <th className="px-8 py-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {products.map(product => {
                  const productStock = stock.find(s => s.id === product.id);
                  return (
                    <tr key={product.id} className="hover:bg-stone-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center overflow-hidden">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Package size={20} className="text-stone-300" />
                            )}
                          </div>
                          <div>
                            <p className="font-black text-stone-900">{product.name}</p>
                            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">{product.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-xs font-black px-3 py-1 bg-stone-100 text-stone-500 rounded-full uppercase tracking-widest">
                          {product.category}
                        </span>
                      </td>
                      <td className="px-8 py-6 font-bold text-stone-600">${product.cost}</td>
                      <td className="px-8 py-6 font-black text-stone-900">${product.price}</td>
                      <td className="px-8 py-6">
                        {product.is_composite ? (
                          <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest italic">Compuesto</span>
                        ) : (
                          <button 
                            onClick={() => setAdjustingStock({ ...product, quantity: productStock?.quantity || 0 })}
                            className={`px-4 py-1.5 rounded-xl font-black text-xs transition-all ${
                              (productStock?.quantity || 0) <= 5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                            }`}
                          >
                            {productStock?.quantity || 0} {product.unit || 'un'}
                          </button>
                        )}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditing(product)} className="p-2 text-stone-400 hover:text-brand-red hover:bg-red-50 rounded-xl transition-all">
                            <Edit2 size={18} />
                          </button>
                          <button onClick={() => setDeletingProduct(product)} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[40px] shadow-sm border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-50 text-stone-500 text-[10px] uppercase tracking-[0.15em] font-black border-b border-stone-200">
                  <th className="px-8 py-6">Nombre</th>
                  <th className="px-8 py-6">Valor</th>
                  <th className="px-8 py-6">Tipo</th>
                  <th className="px-8 py-6">Estado</th>
                  <th className="px-8 py-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {discounts.map(discount => (
                  <tr key={discount.id} className="hover:bg-stone-50/50 transition-colors group">
                    <td className="px-8 py-6 font-black text-stone-900 uppercase tracking-widest text-xs">{discount.name}</td>
                    <td className="px-8 py-6 font-black text-stone-900">
                      {discount.type === 'percentage' ? `${discount.value}%` : `$${discount.value}`}
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-[10px] font-black px-3 py-1 bg-stone-100 text-stone-500 rounded-full uppercase tracking-widest">
                        {discount.type === 'percentage' ? 'Porcentaje' : 'Fijo'}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                        Activo
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setEditingDiscount(discount); setShowAddDiscount(true); }}
                          className="p-2 text-stone-400 hover:text-brand-red hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => setDeletingDiscount(discount)}
                          className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {discounts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-stone-300">
                      <Percent size={48} className="mx-auto mb-4" />
                      <p className="font-black uppercase tracking-widest">No hay descuentos configurados</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {(editing || showAdd) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setEditing(null); setShowAdd(false); }} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-stone-200 flex items-center justify-between bg-stone-50">
                <h2 className="text-2xl font-black text-stone-900">{editing ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                <button onClick={() => { setEditing(null); setShowAdd(false); }} className="p-3 hover:bg-white rounded-2xl transition-colors text-stone-400">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 noscrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-6">
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-32 h-32 bg-stone-50 rounded-[32px] border-2 border-dashed border-stone-200 flex flex-col items-center justify-center cursor-pointer hover:bg-stone-100 transition-all overflow-hidden relative group"
                      >
                        {imagePreview || editing?.image_url ? (
                          <>
                            <img src={imagePreview || editing?.image_url} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Upload className="text-white" size={24} />
                            </div>
                          </>
                        ) : (
                          <>
                            <ImageIcon className="text-stone-300 mb-2" size={32} />
                            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Subir Foto</span>
                          </>
                        )}
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageChange} 
                        className="hidden" 
                        accept="image/*"
                      />
                      <div className="flex-1 space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Nombre del Producto</label>
                          <input name="name" defaultValue={editing?.name} className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-bold" required />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">SKU / Código</label>
                          <input name="sku" defaultValue={editing?.sku} className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-bold" required />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Categoría</label>
                        <select name="category" defaultValue={editing?.category} className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-bold" required>
                          <option value="">Seleccionar</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Unidad</label>
                        <select name="unit" defaultValue={editing?.unit || 'un'} className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-bold">
                          <option value="un">Unidad (un)</option>
                          <option value="kg">Kilogramo (kg)</option>
                          <option value="lt">Litro (lt)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Costo</label>
                        <div className="relative">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-stone-400">$</span>
                          <input 
                            name="cost" 
                            type="number" 
                            step="0.01" 
                            value={isComposite ? calculatedCost : undefined}
                            defaultValue={!isComposite ? editing?.cost : undefined} 
                            readOnly={isComposite}
                            className={`w-full pl-10 pr-6 py-4 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-bold ${isComposite ? 'bg-stone-100 text-stone-500' : 'bg-stone-50'}`} 
                            required 
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Precio de Venta</label>
                        <div className="relative">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-stone-400">$</span>
                          <input name="price" type="number" step="0.01" defaultValue={editing?.price} className="w-full pl-10 pr-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-bold" required />
                        </div>
                      </div>
                    </div>

                    {!editing && !isComposite && (
                      <div>
                        <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Stock Inicial</label>
                        <input name="initial_stock" type="number" step="0.01" className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-bold" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-6 bg-stone-50 rounded-3xl border border-stone-200">
                      <div>
                        <h3 className="font-black text-stone-900">Producto Compuesto</h3>
                        <p className="text-xs text-stone-500 font-medium">Combo o producto con ingredientes</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsComposite(!isComposite)}
                        className={`w-14 h-8 rounded-full p-1 transition-all ${isComposite ? 'bg-brand-red' : 'bg-stone-200'}`}
                      >
                        <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-all ${isComposite ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {isComposite && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest">Componentes / Receta</h3>
                          <button type="button" onClick={addComponent} className="text-brand-red font-black text-xs flex items-center gap-1 hover:underline">
                            <Plus size={14} /> AGREGAR
                          </button>
                        </div>
                        
                        <div className="space-y-3">
                          {selectedComponents.map((comp, idx) => (
                            <div key={idx} className="flex gap-2 items-start bg-stone-50 p-4 rounded-2xl border border-stone-200">
                              <div className="flex-1 space-y-2">
                                <select 
                                  value={comp.type}
                                  onChange={(e) => updateComponent(idx, 'type', e.target.value)}
                                  className="w-full bg-white border-none rounded-xl text-[10px] font-black uppercase tracking-widest py-1.5"
                                >
                                  <option value="product">Producto Fijo</option>
                                  <option value="category">Categoría (Elección)</option>
                                </select>
                                
                                {comp.type === 'product' ? (
                                  <select 
                                    value={comp.id}
                                    onChange={(e) => updateComponent(idx, 'id', e.target.value)}
                                    className="w-full bg-white border-none rounded-xl text-xs font-bold py-2"
                                    required
                                  >
                                    <option value="">Seleccionar Producto</option>
                                    {products.filter(p => p.id !== editing?.id).map(p => (
                                      <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <select 
                                    value={comp.id}
                                    onChange={(e) => updateComponent(idx, 'id', e.target.value)}
                                    className="w-full bg-white border-none rounded-xl text-xs font-bold py-2"
                                    required
                                  >
                                    <option value="">Seleccionar Categoría</option>
                                    {categories.map(c => (
                                      <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                              <div className="w-20">
                                <label className="block text-[8px] font-black text-stone-400 uppercase mb-1">Cant.</label>
                                <input 
                                  type="number" 
                                  step="0.01"
                                  value={comp.quantity}
                                  onChange={(e) => updateComponent(idx, 'quantity', parseFloat(e.target.value))}
                                  className="w-full bg-white border-none rounded-xl text-xs font-bold py-2 text-center"
                                  required
                                />
                              </div>
                              <button type="button" onClick={() => removeComponent(idx)} className="mt-6 p-2 text-stone-300 hover:text-red-500">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                          {selectedComponents.length === 0 && (
                            <div className="text-center py-8 border-2 border-dashed border-stone-100 rounded-3xl">
                              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Sin componentes</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 mt-12">
                  <button type="button" onClick={() => { setEditing(null); setShowAdd(false); }} className="flex-1 py-5 font-black text-stone-500 hover:bg-stone-50 rounded-2xl transition-all uppercase tracking-widest text-sm">Cancelar</button>
                  <button type="submit" className="flex-[2] py-5 bg-stone-900 text-white font-black rounded-2xl shadow-xl shadow-stone-900/20 hover:bg-stone-800 transition-all uppercase tracking-widest text-sm">
                    {editing ? 'Guardar Cambios' : 'Crear Producto'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {adjustingStock && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAdjustingStock(null)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl p-8 border border-stone-200">
              <h2 className="text-2xl font-black text-stone-900 mb-2">Ajustar Stock</h2>
              <p className="text-stone-500 font-medium mb-8">Producto: <span className="text-stone-900 font-black">{adjustingStock.name}</span></p>
              
              <form onSubmit={handleAdjustStock} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Nueva Cantidad ({adjustingStock.unit || 'un'})</label>
                  <input name="quantity" type="number" step="0.01" defaultValue={adjustingStock.quantity} className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-black text-xl" required autoFocus />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setAdjustingStock(null)} className="flex-1 py-4 font-bold text-stone-500 hover:bg-stone-100 rounded-2xl transition-all">Cancelar</button>
                  <button type="submit" className="flex-[2] py-4 bg-stone-900 text-white font-bold rounded-2xl shadow-lg shadow-stone-900/20 transition-all">Actualizar Stock</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCategories && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCategories(false)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-stone-200">
              <div className="p-8 border-b border-stone-200 flex items-center justify-between bg-stone-50">
                <h2 className="text-2xl font-black text-stone-900">Categorías</h2>
                <button onClick={() => setShowCategories(false)} className="p-3 hover:bg-white rounded-2xl transition-colors text-stone-400">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <form onSubmit={handleSaveCategory} className="flex gap-2">
                  <input 
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nueva categoría..."
                    className="flex-1 px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-bold"
                  />
                  <button type="submit" className="bg-stone-900 text-white px-6 rounded-2xl font-black hover:bg-stone-800 transition-all">
                    {editingCategory ? 'Guardar' : 'Agregar'}
                  </button>
                </form>

                <div className="space-y-2 max-h-[40vh] overflow-y-auto noscrollbar">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl group">
                      <span className="font-black text-stone-900 uppercase tracking-widest text-xs">{cat.name}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingCategory(cat); setNewCategoryName(cat.name); }} className="p-2 text-stone-400 hover:text-brand-red"><Edit2 size={16} /></button>
                        <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 text-stone-400 hover:text-red-600"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(showAddDiscount || editingDiscount) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowAddDiscount(false); setEditingDiscount(null); }} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl p-8 border border-stone-200">
              <h2 className="text-2xl font-black text-stone-900 mb-6 uppercase tracking-tight">{editingDiscount ? 'Editar Descuento' : 'Nuevo Descuento'}</h2>
              <form onSubmit={handleSaveDiscount} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Nombre</label>
                  <input name="name" defaultValue={editingDiscount?.name} placeholder="Ej: 10% OFF" className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-black" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Tipo</label>
                    <select name="type" defaultValue={editingDiscount?.type || 'percentage'} className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-black">
                      <option value="percentage">Porcentaje (%)</option>
                      <option value="fixed">Monto Fijo ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Valor</label>
                    <input name="value" type="number" step="0.01" defaultValue={editingDiscount?.value} placeholder="Ej: 10" className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-red font-black" required />
                  </div>
                </div>
                <div className="flex gap-4 mt-8">
                  <button type="button" onClick={() => { setShowAddDiscount(false); setEditingDiscount(null); }} className="flex-1 py-4 font-black text-stone-500 hover:bg-stone-50 rounded-2xl transition-all uppercase tracking-widest text-xs">Cancelar</button>
                  <button type="submit" className="flex-[2] py-4 bg-stone-900 text-white font-black rounded-2xl shadow-xl shadow-stone-900/20 hover:bg-stone-800 transition-all uppercase tracking-widest text-xs">
                    {editingDiscount ? 'Guardar Cambios' : 'Crear Descuento'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {deletingDiscount && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeletingDiscount(null)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl p-8 border border-stone-200">
              <div className="w-16 h-16 bg-red-100 rounded-3xl flex items-center justify-center text-red-600 mb-6">
                <Trash2 size={32} />
              </div>
              <h2 className="text-2xl font-black text-stone-900 mb-2 uppercase tracking-tight">¿Eliminar Descuento?</h2>
              <p className="text-stone-500 font-medium mb-8">
                Esta acción eliminará permanentemente el descuento <span className="text-stone-900 font-black">{deletingDiscount.name}</span>. Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-4">
                <button onClick={() => setDeletingDiscount(null)} className="flex-1 py-4 font-black text-stone-500 hover:bg-stone-50 rounded-2xl transition-all uppercase tracking-widest text-xs">Cancelar</button>
                <button onClick={handleDeleteDiscount} className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-600/20 hover:bg-red-700 transition-all uppercase tracking-widest text-xs">Eliminar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingProduct && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setDeletingProduct(null)} 
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl p-8 border border-stone-200"
            >
              <div className="w-16 h-16 bg-red-100 rounded-3xl flex items-center justify-center text-red-600 mb-6">
                <Trash2 size={32} />
              </div>
              <h2 className="text-2xl font-black text-stone-900 mb-2">¿Eliminar Producto?</h2>
              <p className="text-stone-500 font-medium mb-8">
                Esta acción eliminará permanentemente el producto <span className="text-stone-900 font-black">{deletingProduct.name}</span> y su stock asociado. Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setDeletingProduct(null)}
                  className="flex-1 py-4 font-black text-stone-500 hover:bg-stone-50 rounded-2xl transition-all uppercase tracking-widest text-xs"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDeleteProduct}
                  className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-600/20 hover:bg-red-700 transition-all uppercase tracking-widest text-xs"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
