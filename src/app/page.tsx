'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  getProductsAction, 
  getOrdersAction, 
  placeOrderAction, 
  getProductCategoriesAction, 
  logoutAction,
  getSessionUser
} from './actions';
import { getCompatibleUnits, calculateOrderPrice } from '@/utils/conversions';

interface CartItem {
  productId: string;
  name: string;
  sku: string;
  baseUnit: string;
  basePrice: string;
  orderedQuantity: string;
  orderedUnit: string;
  compatibleUnits: string[];
}

export default function SellerPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>('Seller');
  const [activeTab, setActiveTab] = useState<'order' | 'history'>('order');
  
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [orderSubmitting, setOrderSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const initPage = useCallback(async () => {
    setLoading(true);
    const session = await getSessionUser();
    if (!session) {
      router.push('/login');
      return;
    }
    setUserEmail(session.email);

    const prodRes = await getProductsAction();
    if (prodRes.success && prodRes.products) {
      setProducts(prodRes.products);
    }

    const catRes = await getProductCategoriesAction();
    if (catRes.success && catRes.categories) {
      setCategories(catRes.categories);
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

  useEffect(() => {
    const filterProducts = async () => {
      const res = await getProductsAction(searchQuery, selectedCategory);
      if (res.success && res.products) {
        setProducts(res.products);
      }
    };
    if (!loading) {
      filterProducts();
    }
  }, [searchQuery, selectedCategory, loading]);

  const loadOrders = async () => {
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

  const addToCart = (product: any) => {
    const exists = cart.find(item => item.productId === product.id);
    if (exists) {
      setFeedback({ type: 'error', message: `${product.name} is already in the cart.` });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    const comps = getCompatibleUnits(product.baseUnit);
    const newItem: CartItem = {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      baseUnit: product.baseUnit,
      basePrice: product.basePrice,
      orderedQuantity: '1',
      orderedUnit: product.baseUnit,
      compatibleUnits: comps,
    };

    setCart([...cart, newItem]);
    setFeedback({ type: 'success', message: `Added ${product.name} to cart.` });
    setTimeout(() => setFeedback(null), 2000);
  };

  const updateCartItem = (productId: string, field: 'quantity' | 'unit', value: string) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.productId !== productId) return item;
      
      let updatedQty = item.orderedQuantity;
      let updatedUnit = item.orderedUnit;

      if (field === 'quantity') {
        updatedQty = value;
      } else if (field === 'unit') {
        updatedUnit = value;
      }

      return {
        ...item,
        orderedQuantity: updatedQty,
        orderedUnit: updatedUnit,
      };
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const getItemDetails = (item: CartItem) => {
    const qty = parseFloat(item.orderedQuantity) || 0;
    if (qty <= 0) return { baseQuantity: '0', calculatedPrice: '0.00' };

    try {
      const calc = calculateOrderPrice(
        item.orderedQuantity,
        item.orderedUnit,
        item.baseUnit,
        item.basePrice
      );
      return {
        baseQuantity: calc.baseQuantity.toFixed(4),
        calculatedPrice: calc.calculatedPrice.toFixed(2),
      };
    } catch (e) {
      return { baseQuantity: 'Error', calculatedPrice: '0.00' };
    }
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => {
      const details = getItemDetails(item);
      return total + parseFloat(details.calculatedPrice);
    }, 0).toFixed(2);
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    
    for (const item of cart) {
      const qty = parseFloat(item.orderedQuantity) || 0;
      if (qty <= 0) {
        setFeedback({ type: 'error', message: `Please enter a valid quantity for ${item.name}` });
        return;
      }
    }

    setOrderSubmitting(true);
    setFeedback(null);

    const orderItems = cart.map(item => ({
      productId: item.productId,
      orderedQuantity: item.orderedQuantity,
      orderedUnit: item.orderedUnit,
    }));

    const result = await placeOrderAction(orderItems);

    if ('error' in result) {
      setFeedback({ type: 'error', message: String(result.error) });
      setOrderSubmitting(false);
    } else {
      setFeedback({ type: 'success', message: `Order #${result.orderId?.substring(0, 8)} placed successfully!` });
      setCart([]);
      setOrderSubmitting(false);
      await loadOrders();
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)' }}>Loading Seller Workspace...</h2>
      </div>
    );
  }

  return (
    <div className="layout-container">
      <header className="main-header">
        <div className="logo-section">
          <span>PORTAL</span>
          <h1>QUANTIV</h1>
        </div>
        <div className="user-nav">
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Logged in as <strong style={{ color: 'var(--text-primary)' }}>{userEmail}</strong>
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
        <button 
          onClick={() => setActiveTab('order')} 
          className={`btn ${activeTab === 'order' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Create Quotation / Order
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Order History ({orders.length})
        </button>
      </div>

      {activeTab === 'order' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ display: 'flex', gap: '1rem', padding: '1rem', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  placeholder="Search products by name or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div style={{ width: '200px' }}>
                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="All">All Categories</option>
                  {categories.map((cat, idx) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid-cols-2">
              {products.map((product) => {
                const isOutOfStock = parseFloat(product.stockQuantity) <= 0;
                return (
                  <div key={product.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', opacity: isOutOfStock ? 0.65 : 1 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-accent)' }}>
                          {product.category}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                          SKU: {product.sku}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>{product.name}</h3>
                      <p style={{ fontSize: '0.85rem', marginBottom: '1rem', minHeight: '40px' }}>{product.description}</p>
                    </div>

                    <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          ₹{parseFloat(product.basePrice).toFixed(2)}
                          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}> / {product.baseUnit}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: isOutOfStock ? '#f87171' : 'var(--text-secondary)' }}>
                          Stock: {parseFloat(product.stockQuantity).toFixed(2)} {product.baseUnit}
                        </div>
                      </div>

                      <button
                        onClick={() => addToCart(product)}
                        className={`btn btn-secondary btn-sm ${isOutOfStock ? 'disabled' : ''}`}
                        disabled={isOutOfStock}
                        style={{ background: isOutOfStock ? 'rgba(255,255,255,0.02)' : 'rgba(99, 102, 241, 0.1)', borderColor: isOutOfStock ? 'transparent' : 'var(--accent-primary)', color: isOutOfStock ? 'var(--text-dimmed)' : 'var(--text-primary)' }}
                      >
                        {isOutOfStock ? 'Out of Stock' : 'Add to Order'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {products.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                No products found matching your criteria.
              </div>
            )}
          </div>

          <div className="glass-panel" style={{ height: 'fit-content', position: 'sticky', top: '2rem' }}>
            <h2 style={{ fontSize: '1.4rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
              Quotation Cart
              <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem', borderRadius: '4px', background: 'var(--glow-accent)', color: 'var(--text-accent)' }}>
                {cart.length} {cart.length === 1 ? 'item' : 'items'}
              </span>
            </h2>

            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🛒</p>
                <p style={{ fontSize: '0.9rem' }}>No products selected yet. Select products on the left to build your quotation.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {cart.map((item) => {
                    const details = getItemDetails(item);
                    return (
                      <div key={item.productId} style={{ padding: '0.85rem', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <div>
                            <h4 style={{ fontSize: '0.95rem' }}>{item.name}</h4>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              Rate: ₹{parseFloat(item.basePrice).toFixed(2)} per {item.baseUnit}
                            </span>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.productId)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.15rem' }}
                            title="Remove item"
                          >
                            ×
                          </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <div>
                            <label style={{ fontSize: '0.65rem' }}>Qty</label>
                            <input
                              type="number"
                              step="any"
                              value={item.orderedQuantity}
                              onChange={(e) => updateCartItem(item.productId, 'quantity', e.target.value)}
                              style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.65rem' }}>Unit</label>
                            <select
                              value={item.orderedUnit}
                              onChange={(e) => updateCartItem(item.productId, 'unit', e.target.value)}
                              style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                            >
                              {item.compatibleUnits.map((u) => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px dashed var(--glass-border)', paddingTop: '0.5rem' }}>
                          <span>
                            Converts: {details.baseQuantity} {item.baseUnit}
                          </span>
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                            ₹{details.calculatedPrice}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Total (INR):</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>₹{getCartTotal()}</span>
                  </div>

                  <button
                    onClick={handlePlaceOrder}
                    className="btn btn-primary"
                    disabled={orderSubmitting}
                    style={{ width: '100%' }}
                  >
                    {orderSubmitting ? 'Submitting Quotation...' : 'Place Order / Quotation'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="glass-panel">
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Your Past Quotations</h2>
          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              No orders placed yet.
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Quotation ID</th>
                    <th>Date Placed</th>
                    <th>Items</th>
                    <th>Total Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {order.id.substring(0, 8)}...
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {new Date(order.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {order.items.map((item: any, idx: number) => (
                            <div key={idx} style={{ fontSize: '0.85rem' }}>
                              • {item.product.name}: <strong>{item.orderedQuantity} {item.orderedUnit}</strong> 
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                 (as {parseFloat(item.orderedQuantity) * parseFloat(item.conversionFactor)} {item.product.baseUnit} @ ₹{parseFloat(item.unitPrice).toFixed(2)})
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                        ₹{parseFloat(order.totalAmount).toFixed(2)}
                      </td>
                      <td>
                        <span className={`badge badge-${order.status.toLowerCase()}`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
