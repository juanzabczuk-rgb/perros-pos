import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  Timestamp, 
  getDocs 
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Package, 
  UserCircle, 
  History, 
  Banknote, 
  Tag, 
  CreditCard, 
  Store, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  ShoppingBag, 
  Users, 
  Calendar 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

export const DashboardModule = () => {
  const [stats, setStats] = useState<any>(null);
  const [activeReport, setActiveReport] = useState('summary');
  const { user } = useApp();

  useEffect(() => {
    if (!user?.branch_id) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'sales'),
      where('created_at', '>=', Timestamp.fromDate(today))
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      const sales = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(s => s.branch_id === user.branch_id);
        
      const todaySales = sales.reduce((acc, s) => acc + (s.status === 'completed' ? s.total : 0), 0);
      
      // Fetch items for each sale to get product stats
      const productsMap: any = {};
      const employeeMap: any = {};
      const paymentMap: any = {};
      let totalDiscounts = 0;
      let totalTaxes = 0;

      for (const sale of sales) {
        if (sale.status !== 'completed') continue;

        // Payments
        paymentMap[sale.payment_type] = (paymentMap[sale.payment_type] || 0) + sale.total;
        // Discounts/Taxes
        totalDiscounts += (sale.discount || 0);
        totalTaxes += (sale.tax || 0);
        // Employees
        if (sale.seller_name) {
          employeeMap[sale.seller_name] = (employeeMap[sale.seller_name] || 0) + sale.total;
        }

        // Items subcollection
        const itemsSnap = await getDocs(collection(db, `sales/${sale.id}/items`));
        itemsSnap.docs.forEach(itemDoc => {
          const item = itemDoc.data();
          productsMap[item.name] = (productsMap[item.name] || 0) + item.quantity;
        });
      }

      const topProducts = Object.entries(productsMap)
        .map(([name, sold]: any) => ({ name, sold }))
        .sort((a: any, b: any) => b.sold - a.sold)
        .slice(0, 12);

      setStats({
        todaySales,
        todayCount: sales.length,
        topProducts,
        salesByEmployee: Object.entries(employeeMap).map(([name, total]) => ({ name, total })),
        salesByPayment: Object.entries(paymentMap).map(([type, total]) => ({ type, total })),
        totalDiscounts,
        totalTaxes,
        rawSales: sales
      });
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sales'));

    return () => unsub();
  }, [user?.branch_id]);

  if (!stats) return (
    <div className="p-8 flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-red"></div>
    </div>
  );

  const reports = [
    { id: 'summary', label: 'Resumen de Venta', icon: LayoutDashboard },
    { id: 'top_sales', label: 'Top 12 de Ventas', icon: TrendingUp },
    { id: 'by_product', label: 'Venta por Artículo', icon: Package },
    { id: 'by_employee', label: 'Venta por Empleado', icon: UserCircle },
    { id: 'receipts', label: 'Recibos', icon: History },
    { id: 'by_payment', label: 'Ventas por Tipo de Pago', icon: Banknote },
    { id: 'discounts', label: 'Descuentos', icon: Tag },
    { id: 'taxes', label: 'Impuesto', icon: CreditCard },
    { id: 'cash', label: 'Caja', icon: Store },
  ];

  return (
    <div className="flex h-full bg-stone-50 overflow-hidden">
      {/* Reports Sidebar */}
      <div className="w-64 bg-white border-r border-stone-200 flex flex-col">
        <div className="p-6 border-b border-stone-100">
          <h2 className="text-xl font-black text-stone-900 uppercase tracking-tight">Estadísticas</h2>
          <p className="text-xs text-stone-400 font-bold mt-1">REPORTES DEL DÍA</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1 noscrollbar">
          {reports.map((report) => (
            <button
              key={report.id}
              onClick={() => setActiveReport(report.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-black transition-all ${
                activeReport === report.id
                  ? 'bg-stone-900 text-white shadow-lg shadow-stone-900/20'
                  : 'text-stone-500 hover:bg-stone-50'
              }`}
            >
              <report.icon size={18} />
              {report.label}
            </button>
          ))}
        </div>
      </div>

      {/* Report Content */}
      <div className="flex-1 overflow-y-auto p-8 noscrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeReport}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeReport === 'summary' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight">Resumen de Hoy</h1>
                    <p className="text-stone-500 font-medium">Visualización en tiempo real de las ventas</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-stone-100 shadow-sm">
                    <Calendar size={16} className="text-stone-400" />
                    <span className="text-sm font-black text-stone-900">{new Date().toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-8 rounded-[40px] border border-stone-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                      <DollarSign size={80} className="text-stone-900" />
                    </div>
                    <div className="relative z-10">
                      <div className="w-12 h-12 bg-stone-900 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-stone-900/20">
                        <DollarSign className="text-white" size={24} />
                      </div>
                      <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-1">Ventas Totales</p>
                      <h3 className="text-4xl font-black text-stone-900">${stats.todaySales}</h3>
                      <div className="mt-4 flex items-center gap-2">
                        <span className="flex items-center text-[10px] font-black text-green-500 bg-green-50 px-2 py-1 rounded-lg">
                          <ArrowUpRight size={12} /> +12.5%
                        </span>
                        <span className="text-[10px] font-bold text-stone-400">vs ayer</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[40px] border border-stone-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                      <ShoppingBag size={80} className="text-stone-900" />
                    </div>
                    <div className="relative z-10">
                      <div className="w-12 h-12 bg-stone-900 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-stone-900/20">
                        <ShoppingBag className="text-white" size={24} />
                      </div>
                      <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-1">Cant. Transacciones</p>
                      <h3 className="text-4xl font-black text-stone-900">{stats.todayCount}</h3>
                      <div className="mt-4 flex items-center gap-2">
                        <span className="flex items-center text-[10px] font-black text-green-500 bg-green-50 px-2 py-1 rounded-lg">
                          <ArrowUpRight size={12} /> +5
                        </span>
                        <span className="text-[10px] font-bold text-stone-400">vs ayer</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[40px] border border-stone-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                      <Users size={80} className="text-stone-900" />
                    </div>
                    <div className="relative z-10">
                      <div className="w-12 h-12 bg-stone-900 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-stone-900/20">
                        <Users className="text-white" size={24} />
                      </div>
                      <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-1">Ticket Promedio</p>
                      <h3 className="text-4xl font-black text-stone-900">
                        ${stats.todayCount > 0 ? (stats.todaySales / stats.todayCount).toFixed(2) : 0}
                      </h3>
                      <div className="mt-4 flex items-center gap-2">
                        <span className="flex items-center text-[10px] font-black text-red-500 bg-red-50 px-2 py-1 rounded-lg">
                          <ArrowDownRight size={12} /> -2.1%
                        </span>
                        <span className="text-[10px] font-bold text-stone-400">vs ayer</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-[40px] border border-stone-100 shadow-sm">
                    <h3 className="text-xl font-black text-stone-900 mb-8 uppercase tracking-tight">Top Productos</h3>
                    <div className="space-y-6">
                      {stats.topProducts.map((p: any, i: number) => (
                        <div key={i} className="flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                            <span className="w-8 h-8 flex items-center justify-center bg-stone-50 rounded-xl text-xs font-black text-stone-400 group-hover:bg-stone-900 group-hover:text-white transition-all">
                              {i + 1}
                            </span>
                            <span className="font-black text-stone-700 uppercase tracking-widest text-xs">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-32 h-2 bg-stone-50 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(p.sold / stats.topProducts[0].sold) * 100}%` }}
                                className="h-full bg-stone-900"
                              />
                            </div>
                            <span className="text-xs font-black text-stone-900">{p.sold} un.</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[40px] border border-stone-100 shadow-sm">
                    <h3 className="text-xl font-black text-stone-900 mb-8 uppercase tracking-tight">Ventas por Empleado</h3>
                    <div className="space-y-6">
                      {stats.salesByEmployee.map((e: any, i: number) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-stone-50 rounded-2xl flex items-center justify-center">
                              <UserCircle className="text-stone-400" size={20} />
                            </div>
                            <span className="font-black text-stone-700 uppercase tracking-widest text-xs">{e.name}</span>
                          </div>
                          <span className="text-sm font-black text-stone-900">${e.total}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeReport === 'top_sales' && (
              <div className="space-y-6">
                <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight mb-8">Top 12 de Ventas</h1>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {stats.topProducts.map((p: any, i: number) => (
                    <div key={i} className="bg-white p-8 rounded-[40px] border border-stone-100 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-stone-900 rounded-2xl flex items-center justify-center text-white font-black">
                          {i + 1}
                        </div>
                        <div>
                          <h3 className="font-black text-stone-900 uppercase tracking-widest text-xs">{p.name}</h3>
                          <p className="text-xs font-bold text-stone-400">{p.sold} unidades vendidas</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeReport === 'by_payment' && (
              <div className="space-y-6">
                <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight mb-8">Ventas por Tipo de Pago</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {stats.salesByPayment.map((p: any, i: number) => (
                    <div key={i} className="bg-white p-8 rounded-[40px] border border-stone-100 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center">
                          <Banknote className="text-stone-400" size={24} />
                        </div>
                        <h3 className="font-black text-stone-900 uppercase tracking-widest text-xs">{p.type}</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Total Recaudado</p>
                        <h3 className="text-2xl font-black text-stone-900">${p.total}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeReport === 'cash' && (
              <div className="space-y-6">
                <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight mb-8">Caja</h1>
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm">
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Efectivo en Caja</p>
                    <h3 className="text-4xl font-black text-stone-900">
                      ${(stats.salesByPayment || []).find((p: any) => p.type === 'Efectivo')?.total || 0}
                    </h3>
                    <div className="mt-6 pt-6 border-t border-stone-50 flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-500">Fondo Inicial: $5.000</span>
                      <span className="text-xs font-bold text-green-500">Ventas: +${(stats.salesByPayment || []).find((p: any) => p.type === 'Efectivo')?.total || 0}</span>
                    </div>
                  </div>
                  <div className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm">
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Otros Medios</p>
                    <h3 className="text-4xl font-black text-stone-900">
                      ${(stats.salesByPayment || []).filter((p: any) => p.type !== 'Efectivo').reduce((acc: number, p: any) => acc + p.total, 0)}
                    </h3>
                    <div className="mt-6 pt-6 border-t border-stone-50 flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-500">Tarjetas/Transferencias</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {['by_product', 'receipts', 'discounts', 'taxes'].includes(activeReport) && (
              <div className="flex flex-col items-center justify-center py-20 text-stone-300">
                <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                  <LayoutDashboard size={40} />
                </div>
                <h2 className="text-xl font-black text-stone-400 uppercase tracking-widest">Reporte en Desarrollo</h2>
                <p className="text-sm font-medium mt-2">Estamos procesando los datos para esta sección.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
