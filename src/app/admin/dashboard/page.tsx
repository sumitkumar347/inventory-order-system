'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  getProductsAction, 
  getOrdersAction, 
  createProductAction, 
  updateProductAction, 
  deleteProductAction, 
  updateOrderStatusAction, 
  logoutAction,
  getSessionUser
} from '../../actions';

interface ProductForm {
  id?: string;
  name: string;
  sku: string;
  description: string;
  category: string;
  baseUnit: string;
  basePrice: string;
  stockQuantity: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [adminEmail, setAdminEmail] = useState<string>('Admin');
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders'>('inventory');
  
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [formState, setFormState] = useState<ProductForm>({
    name: '',
    sku: '',
    description: '',
    category: '',
    baseUnit: 'kg',
    basePrice: '',
    stockQuantity: '',
  });

  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const initPage = useCallback(async () => {
    setLoading(true);
    const session = await getSessionUser();
    if (!session || session.role !== 'ADMIN') {
      router.push('/login');
      return;
    }
    setAdminEmail(session.email);

    const prodRes = await getProductsAction();
    if (prodRes.success && prodRes.products) {
      setProducts(prodRes.products);
    }

    const orderRes = await getOrdersAction();
    if (orderRes.success && orderRes.orders) {
      setOrders(orderRes.orders);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    initPage();
  }, [initPage]);

  const reloadData = async () => {
    const prodRes = await getProductsAction();
    if (prodRes.success && prodRes.products) {
      setProducts(prodRes.products);
    }
    const orderRes = await getOrdersAction();
    if (orderRes.success && orderRes.orders) {
      setOrders(orderRes.orders);
    }
  };

  const handleLogout = async () => {
    const res = await logoutAction();
    if (res.success) {
      router.push('/login');
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleOpenCreate = () => {
    setFormState({
      name: '',
      sku: '',
      description: '',
      category: '',
      baseUnit: 'kg',
      basePrice: '',
      stockQuantity: '',
    });
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: any) => {
    setFormState({
      id: product.id,
      name: product.name,
      sku: product.sku,
      description: product.description || '',
      category: product.category,
      baseUnit: product.baseUnit,
      basePrice: product.basePrice,
      stockQuantity: product.stockQuantity,
    });
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    const priceNum = parseFloat(formState.basePrice);
    const stockNum = parseFloat(formState.stockQuantity);
    if (isNaN(priceNum) || priceNum < 0) {
      showToast('error', 'Please enter a valid base price (>= 0)');
      setSubmitLoading(false);
      return;
    }
    if (isNaN(stockNum) || stockNum < 0) {
      showToast('error', 'Please enter a valid stock quantity (>= 0)');
      setSubmitLoading(false);
      return;
    }

    let result;
    if (modalMode === 'create') {
      result = await createProductAction(formState);
    } else {
      result = await updateProductAction(formState.id!, formState);
    }

    if (result.error) {
      showToast('error', result.error);
    } else {
      showToast('success', `Product ${modalMode === 'create' ? 'created' : 'updated'} successfully!`);
      setIsModalOpen(false);
      await reloadData();
    }
    setSubmitLoading(false);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product from inventory?')) return;
    
    const result = await deleteProductAction(id);
    if (result.error) {
      showToast('error', result.error);
    } else {
      showToast('success', 'Product deleted from catalog.');
      await reloadData();
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: 'APPROVED' | 'REJECTED') => {
    if (!confirm(`Are you sure you want to set order status to ${status}?`)) return;

    const result = await updateOrderStatusAction(orderId, status);
    if (result.error) {
      showToast('error', result.error);
    } else {
      showToast('success', `Order ${status.toLowerCase()} successfully!`);
      await reloadData();
    }
  };

  const renderStockLevelBadge = (qtyStr: string, unit: string) => {
    const qty = parseFloat(qtyStr);
    let border = '1px solid rgba(16, 185, 129, 0.2)';
    let color = '#34d399';
    let bg = 'rgba(16, 185, 129, 0.1)';
    let text = 'Healthy';

    let relativeQty = qty;
    if (unit === 'g' || unit === 'mL') {
      relativeQty = qty / 1000;
    }

    if (relativeQty <= 10) {
      color = '#f87171';
      border = '1px solid rgba(244, 63, 94, 0.2)';
      bg = 'rgba(244, 63, 94, 0.1)';
      text = 'Critical Low';
    } else if (relativeQty <= 100) {
      color = '#fbbf24';
      border = '1px solid rgba(245, 158, 11, 0.2)';
      bg = 'rgba(245, 158, 11, 0.1)';
      text = 'Moderate';
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        <span style={{ fontWeight: '600' }}>
          {qty.toFixed(2)} {unit}
        </span>
        <span style={{ 
          fontSize: '0.65rem', 
          fontWeight 700, 
          textTransform: 'uppercase', 
          letterSpacing: '0.05em',
          padding: '0.1rem 0.4rem', 
          borderRadius: '4px',
          width: 'fit-content',
          border,
          color,
          backgroundColor: bg
        }}>
          {text}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)' }}>Loading Admin Workspace...</h2>
      </div>
    );
  }

  return (
    <div className="layout-container">
      <header className="main-header">
        <div className="logo-section">
          <span>CONSOLE</span>
          <h1>QUANTIV ADMIN</h1>
        </div>
        <div className="user-nav">
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Welcome <strong style={{ color: 'var(--text-primary)' }}>{adminEmail}</strong>
          </span>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm">
            Sign Out
          </button>
        </div>
      </header>

      {feedback && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: feedback.type === 'success' ? 'var(--success-gradient)' : 'var(--danger-gradient)',
          color: '#fff',
          padding: '0.85rem 1.5rem',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          zIndex: 2000,
          fontWeight: 600,
          fontSize: '0.9rem',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          {feedback.message}
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={() => setActiveTab('inventory')} 
            className={`btn ${activeTab === 'inventory' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Inventory Manager
          </button>
          <button 
            onClick={() => setActiveTab('orders')} 
            className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Manage Quotations ({orders.filter(o => o.status === 'PENDING').length} Pending)
          </button>
        </div>

        {activeTab === 'inventory' && (
          <button onClick={handleOpenCreate} className="btn btn-success">
            + Add Product
          </button>
        )}
      </div>

      {activeTab === 'inventory' ? (
        <div className="glass-panel">
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Product Catalog</h2>
          {products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              No products found in the database catalog.
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Base Price (INR)</th>
                    <th>Stock Level</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div style={{ fontWeight: '600' }}>{product.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{product.description || 'No description'}</div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{product.sku}</td>
                      <td>{product.category}</td>
                      <td>
                        <strong style={{ color: 'var(--text-accent)' }}>
                          ₹{parseFloat(product.basePrice).toFixed(4)}
                        </strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}> / {product.baseUnit}</span>
                      </td>
                      <td>
                        {renderStockLevelBadge(product.stockQuantity, product.baseUnit)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            onClick={() => handleOpenEdit(product)} 
                            className="btn btn-secondary btn-sm"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteProduct(product.id)} 
                            className="btn btn-danger btn-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="glass-panel">
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Received Orders & Quotations Queue</h2>
          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              No orders have been submitted yet.
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Order & Buyer Details</th>
                    <th>Detailed Conversions Audit</th>
                    <th>Total Value</th>
                    <th>Fulfillment Status</th>
                    <th>Action Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                          ID: <span style={{ fontFamily: 'monospace', color: 'var(--text-accent)' }}>{order.id.substring(0, 8)}</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          Buyer: <strong>{order.user.email}</strong>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dimmed)', marginTop: '0.2rem' }}>
                          {new Date(order.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {order.items.map((item: any, idx: number) => {
                            const qty = parseFloat(item.orderedQuantity);
                            const factor = parseFloat(item.conversionFactor);
                            const baseQty = qty * factor;
                            return (
                              <div key={idx} style={{ 
                                fontSize: '0.85rem', 
                                padding: '0.5rem', 
                                background: 'rgba(255,255,255,0.02)', 
                                border: '1px solid rgba(255,255,255,0.03)',
                                borderRadius: '4px' 
                              }}>
                                <div>• {item.product.name} (SKU: {item.product.sku})</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                  Ordered: <strong>{item.orderedQuantity} {item.orderedUnit}</strong>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-accent)', marginTop: '0.1rem' }}>
                                  Scale audit: {item.orderedQuantity} × {item.conversionFactor} = <strong>{baseQty.toFixed(4)} {item.product.baseUnit}</strong>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.1rem' }}>
                                  Price audit: {baseQty.toFixed(4)} {item.product.baseUnit} @ ₹{parseFloat(item.unitPrice).toFixed(4)} = <strong>₹{parseFloat(item.calculatedPrice).toFixed(2)}</strong>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td>
                        <strong style={{ fontSize: '1.15rem', color: '#34d399' }}>
                          ₹{parseFloat(order.totalAmount).toFixed(2)}
                        </strong>
                      </td>
                      <td>
                        <span className={`badge badge-${order.status.toLowerCase()}`}>
                          {order.status}
                        </span>
                      </td>
                      <td>
                        {order.status === 'PENDING' ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'APPROVED')}
                              className="btn btn-success btn-sm"
                              style={{ fontWeight: 700 }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'REJECTED')}
                              className="btn btn-danger btn-sm"
                              style={{ fontWeight: 700 }}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-dimmed)', fontStyle: 'italic' }}>
                            No actions
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: '1.4rem', marginBottom: '1.5rem' }}>
              {modalMode === 'create' ? 'Add New Product' : 'Edit Product Details'}
            </h2>

            <form onSubmit={handleProductSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="grid-cols-2">
                <div>
                  <label htmlFor="name">Product Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formState.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Basmati Rice"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="sku">SKU Code</label>
                  <input
                    type="text"
                    id="sku"
                    name="sku"
                    value={formState.sku}
                    onChange={handleInputChange}
                    placeholder="e.g. RICE-BAS-001"
                    required
                    disabled={modalMode === 'edit'}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formState.description}
                  onChange={handleInputChange}
                  placeholder="Enter product description/details"
                  rows={2}
                />
              </div>

              <div className="grid-cols-2">
                <div>
                  <label htmlFor="category">Category</label>
                  <input
                    type="text"
                    id="category"
                    name="category"
                    value={formState.category}
                    onChange={handleInputChange}
                    placeholder="e.g. Grains"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="baseUnit">Base Storage Unit</label>
                  <select
                    id="baseUnit"
                    name="baseUnit"
                    value={formState.baseUnit}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="kg">Kilograms (kg)</option>
                    <option value="g">Grams (g)</option>
                    <option value="L">Liters (L)</option>
                    <option value="mL">Milliliters (mL)</option>
                    <option value="item">Items (unit/count)</option>
                  </select>
                </div>
              </div>

              <div className="grid-cols-2">
                <div>
                  <label htmlFor="basePrice">Base Unit Price (INR)</label>
                  <input
                    type="number"
                    step="any"
                    id="basePrice"
                    name="basePrice"
                    value={formState.basePrice}
                    onChange={handleInputChange}
                    placeholder="e.g. 80.00"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="stockQuantity">Stock Quantity (in Base Unit)</label>
                  <input
                    type="number"
                    step="any"
                    id="stockQuantity"
                    name="stockQuantity"
                    value={formState.stockQuantity}
                    onChange={handleInputChange}
                    placeholder="e.g. 1500"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifySelf: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitLoading}
                >
                  {submitLoading ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
