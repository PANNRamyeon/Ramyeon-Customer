import axios from 'axios';

// ---------------------------------------------------------------------------
// Resolve API Base URL
// ---------------------------------------------------------------------------
const API_BASE_URL = process.env.VUE_APP_API_URL || 'https://pann-pos.onrender.com/api/v1';


// Export base URL
export const apiBaseUrl = API_BASE_URL;


// ---------------------------------------------------------------------------
// Axios Client
// ---------------------------------------------------------------------------
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ---------------------------------------------------------------------------
// Interceptor: Attach Auth Token
// ---------------------------------------------------------------------------
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_SERVICE_TOKEN) {
      config.headers.Authorization = `Bearer ${import.meta.env.VITE_API_SERVICE_TOKEN}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ---------------------------------------------------------------------------
// Interceptor: Token Refresh on 401
// ---------------------------------------------------------------------------
let isRefreshing = false;
let refreshQueue = [];

const processRefreshQueue = (error, token = null) => {
  refreshQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token));
  refreshQueue = [];
};

const clearLocalAuth = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('ramyeon_user_session');
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      clearLocalAuth();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Note: /auth/token/refresh/ is assumed to exist elsewhere; adjust if needed
      const res = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
        refresh: refreshToken,
      });

      const newAccessToken = res.data.access || res.data.access_token;
      const newRefreshToken = res.data.refresh || res.data.refresh_token;

      localStorage.setItem('access_token', newAccessToken);
      if (newRefreshToken) localStorage.setItem('refresh_token', newRefreshToken);

      apiClient.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
      processRefreshQueue(null, newAccessToken);

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processRefreshQueue(refreshError, null);
      clearLocalAuth();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// ============================================================================
// AUTH API
// Registration ENABLED | getProfile → /auth/profile/
// ============================================================================
export const authAPI = {
  // Registration (enabled)
  register: async (payload) => {
    try {
      const res = await apiClient.post('/auth/register/', payload);

      const { access_token, refresh_token } = res.data || {};

      if (access_token) localStorage.setItem('access_token', access_token);
      if (refresh_token) localStorage.setItem('refresh_token', refresh_token);

      return res.data;
    } catch (error) {
      console.error('[API] Registration error:', error.response?.data);
      throw error.response?.data || { error: 'Registration failed' };
    }
  },

  // Login
  login: async (email, password) => {
    try {
      const response = await apiClient.post('/auth/login/', { email, password });

      const { access_token, refresh_token } = response.data || {};
      if (access_token) localStorage.setItem('access_token', access_token);
      if (refresh_token) localStorage.setItem('refresh_token', refresh_token);

      return response.data;
    } catch (error) {
      console.error('[API] Login error:', error.response?.data);
      throw error.response?.data || { error: 'Login failed' };
    }
  },

  // Refresh access token manually
  refreshToken: async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) throw new Error('No refresh token available');

    const res = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, { refresh: refreshToken });
    const newAccessToken = res.data.access || res.data.access_token;
    const newRefreshToken = res.data.refresh || res.data.refresh_token;

    localStorage.setItem('access_token', newAccessToken);
    if (newRefreshToken) localStorage.setItem('refresh_token', newRefreshToken);

    return newAccessToken;
  },

  // Logout
  logout: async () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('ramyeon_user_session');
  },

  // Profile
  getProfile: async () => {
    try {
      const res = await apiClient.get('/auth/profile/');
      return res.data;
    } catch (error) {
      console.error('[API] getProfile error:', error.response?.data);
      const err = new Error(error.response?.data?.message || 'Failed to fetch profile');
      err.data = error.response?.data;
      throw err;
    }
  },
};

// ============================================================================
// POS API (Website-inaccessible endpoints)
// ============================================================================
export const posAPI = {
  scanUserQR: async () => { throw { message: 'POS QR scan not supported' } },
  scanPromotionQR: async () => { throw { message: 'POS promotion scan not supported' } },
  redeemPromotion: async () => { throw { message: 'POS redemption not supported' } },
  awardPoints: async () => { throw { message: 'Award points not supported' } },
  processOrderPoints: async () => { throw { message: 'Order points not supported' } },
  getUserByQR: async () => { throw { message: 'POS user lookup not supported' } },
  getPromotionByQR: async () => { throw { message: 'POS promo lookup not supported' } },
  getDashboard: async () => { throw { message: 'POS dashboard not supported' } },
};

// ============================================================================
// PRODUCTS API
// ============================================================================
export const productsAPI = {
  // Get all products
  getAll: async (params = {}) => {
    try {
      const response = await apiClient.get('/products/', { params });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch products:', error.response?.data);
      throw error.response?.data || { message: 'Failed to fetch products' };
    }
  },

  // Get product by ID
  getById: async (id) => {
    try {
      const response = await apiClient.get(`/products/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch product:', error.response?.data);
      throw error.response?.data || { message: 'Failed to fetch product' };
    }
  },

  // Get products by category
  getByCategory: async (categoryId, subcategory = null, page = 1, limit = 20) => {
    try {
      const params = { page, limit };
      if (subcategory) params.subcategory_name = subcategory;

      const response = await apiClient.get(`/products/category/${categoryId}/`, { params });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch products by category:', error.response?.data);
      throw error.response?.data || { message: 'Failed to fetch products by category' };
    }
  },

  // Search products
  search: async (query) => {
    try {
      const response = await apiClient.get('/products/search/', { params: { q: query } });
      return response.data;
    } catch (error) {
      console.error('Failed to search products:', error.response?.data);
      throw error.response?.data || { message: 'Failed to search products' };
    }
  }
};

// ============================================================================
// CATEGORIES API
// ============================================================================
export const categoriesAPI = {
  getAll: async () => {
    try {
      const response = await apiClient.get('/categories/');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch categories:', error.response?.data);
      throw error.response?.data || { message: 'Failed to fetch categories' };
    }
  },

  // Get category by ID
  getById: async (id) => {
    try {
      const response = await apiClient.get(`/categories/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch category:', error.response?.data);
      throw error.response?.data || { message: 'Failed to fetch category' };
    }
  },

  // Get subcategories (uses category detail endpoint)
  getSubcategories: async (categoryId) => {
    try {
      const response = await apiClient.get(`/categories/${categoryId}/`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch subcategories:', error.response?.data);
      throw error.response?.data || { message: 'Failed to fetch subcategories' };
    }
  }
};

// ============================================================================
// CART API (Backend not implemented; fallback only)
// ============================================================================
export const cartAPI = {
  getCart: async () => {
    return { items: [], total: 0 };
  },

  addItem: async () => {
    return { message: 'Cart API not available' };
  },

  removeItem: async () => {
    return { message: 'Cart API not available' };
  },

  clearCart: async () => {
    return { message: 'Cart API not available' };
  },
};

// ============================================================================
// ORDERS API (ENHANCED – CORRECTED)
// ============================================================================

// Payment method mapping (frontend → backend)
const PAYMENT_METHOD_MAP = {
  cash: 'cod',
  gcash: 'gcash_paymongo',
  card: 'bank_paymongo',
  grabpay: 'grabpay_paymongo'   // if you add GrabPay later, else remove
};

function mapPaymentMethod(method) {
  return PAYMENT_METHOD_MAP[method] || 'cod';
}

export const ordersAPI = {

  // -------------------------------------------------------------------------
  // Get all orders for a customer (GET /orders/customer/:customerId/)
  // -------------------------------------------------------------------------
  getAll: async (customerId, filters = {}) => {
    try {
      if (!customerId) {
        // Fallback to localStorage if no customerId provided
        const userSession = JSON.parse(localStorage.getItem('ramyeon_user_session') || '{}');
        const userOrdersKey = `ramyeon_orders_${userSession.email || 'guest'}`;
        const orders = JSON.parse(localStorage.getItem(userOrdersKey) || '[]');
        return { success: true, results: orders };
      }

      const response = await apiClient.get(`/orders/customer/${customerId}/`, {
        params: filters    // e.g., { status, limit }
      });

      // Backend returns an array directly, wrap in expected format
      return {
        success: true,
        results: Array.isArray(response.data) ? response.data : (response.data?.results || [])
      };
    } catch (error) {
      console.error('❌ Error fetching customer orders:', error);
      // Fallback to localStorage
      const userSession = JSON.parse(localStorage.getItem('ramyeon_user_session') || '{}');
      const userOrdersKey = `ramyeon_orders_${userSession.id || userSession.email || 'guest'}`;
      const fallbackOrders = JSON.parse(localStorage.getItem(userOrdersKey) || '[]');
      return { success: false, results: fallbackOrders, error: error.message };
    }
  },

  // -------------------------------------------------------------------------
  // Create new order (POST /orders/create/)
  // -------------------------------------------------------------------------
  create: async (orderData) => {
    try {
      const items = Array.isArray(orderData?.items) ? orderData.items : [];

      const payload = {
        customer_id: orderData?.customer_id || orderData?.user?.id,
        items: items.map((item) => ({
          product_id: item.product_id || item.id || item.productId,
          quantity: item.quantity || 1,
        })),
        delivery_address: String(orderData?.delivery_address || orderData?.deliveryAddress || ''),
        delivery_type: orderData?.delivery_type || orderData?.deliveryType || 'delivery',
        payment_method: mapPaymentMethod(orderData?.payment_method || orderData?.paymentMethod),
        points_to_redeem: orderData?.points_to_redeem || orderData?.pointsToRedeem || 0,
        notes: orderData?.notes || orderData?.special_instructions || orderData?.specialInstructions || '',
      };

      const response = await apiClient.post('/orders/create/', payload, { timeout: 45000 });

      // Backend returns { success: true, data: { order_id, order } } or { success: false, error: "..." }
      if (response.data && response.data.success) {
        const orderResult = response.data.data || response.data;
        return { success: true, data: orderResult };
      } else {
        return {
          success: false,
          error: response.data?.error || response.data?.message || 'Failed to create order'
        };
      }
    } catch (error) {
      const data = error.response?.data;
      const msg = data?.message || data?.error || error.message || 'Failed to create order';
      return { success: false, error: msg };
    }
  },

  // -------------------------------------------------------------------------
  // Get order by ID (GET /orders/:id/)
  // -------------------------------------------------------------------------
  getById: async (id) => {
    try {
      const response = await apiClient.get(`/orders/${id}/`);
      return response.data;
    } catch (error) {
      // fallback: localStorage lookup
      const orders = JSON.parse(localStorage.getItem('ramyeon_orders') || '[]');
      return orders.find((o) => o.id === id) || null;
    }
  },

  // -------------------------------------------------------------------------
  // Get order status (uses getById as fallback)
  // -------------------------------------------------------------------------
  getStatus: async (orderId) => {
    try {
      if (!orderId || orderId === 'undefined' || orderId === 'null') {
        return { success: false, error: 'Invalid order ID' };
      }

      const token = localStorage.getItem('access_token');
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await apiClient.get(`/orders/${orderId}/`);
      return { success: true, ...response.data };
    } catch (error) {
      if (error.response?.status === 404) {
        return { success: false, error: 'Order not found' };
      }
      if (error.response?.status === 403) {
        return { success: false, error: 'Unauthorized access to order' };
      }
      if (error.response?.status === 401) {
        return { success: false, error: 'Authentication required' };
      }
      console.error('❌ Network error during order status:', error.message);
      return { success: false, error: error.message || 'Network error' };
    }
  },

  // -------------------------------------------------------------------------
  // Cancel order (POST /orders/:id/cancel/)
  // -------------------------------------------------------------------------
  cancel: async (orderId, reason = 'Customer cancellation', customerId = null) => {
    try {
      // If no customerId provided, read from session
      if (!customerId) {
        const userSession = JSON.parse(localStorage.getItem('ramyeon_user_session') || '{}');
        customerId = userSession.id || 'customer';
      }

      const response = await apiClient.post(`/orders/${orderId}/cancel/`, {
        cancellation_reason: reason,
        customer_id: customerId,
      });

      return { success: true, data: response.data };
    } catch (error) {
      const msg = error.response?.data?.error || error.message || 'Failed to cancel order';
      console.error('[ordersAPI.cancel] error:', msg);
      return { success: false, error: msg };
    }
  },

  // -------------------------------------------------------------------------
  // Update order status (Admin only – keep as is or stub)
  // -------------------------------------------------------------------------
  updateStatus: async (orderId, newStatus, notes = '') => {
    try {
      const res = await apiClient.post(`/pos/orders/${orderId}/status/`, {
        status: newStatus,
        notes: notes
      });
      return { success: true, ...res.data };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || "Failed to update status"
      };
    }
  },
};


// ============================================================================
// LOYALTY API
// ============================================================================
export const loyaltyAPI = {
  getBalance: async () => {
    try {
      const response = await apiClient.get('/loyalty/balance/');
      return { success: true, ...response.data };
    } catch (error) {
      console.error('[LOYALTY] getBalance error:', error);
      return { success: false, error: error.message || 'Failed to fetch loyalty balance' };
    }
  },

  getHistory: async (limit = 50) => {
    try {
      const response = await apiClient.get('/loyalty/history/', { params: { limit } });
      return { success: true, ...response.data };
    } catch (error) {
      console.error('[LOYALTY] getHistory error:', error);
      return { success: false, error: error.message || 'Failed to fetch loyalty history' };
    }
  },

  validateRedemption: async (pointsToRedeem) => {
    try {
      const response = await apiClient.post('/loyalty/validate-redemption/', { points_to_redeem: pointsToRedeem });
      return { success: true, ...response.data };
    } catch (error) {
      console.error('[LOYALTY] validateRedemption error:', error.response?.data || error.message);
      return { success: false, error: 'Failed to validate points redemption' };
    }
  },

  calculatePointsEarned: (subtotalAfterDiscount) => {
    const subtotal = Number(subtotalAfterDiscount || 0);
    return Math.floor(subtotal * 0.20);
  },

  redeem: async (points, description = 'Points redemption') => {
    try {
      const response = await apiClient.post('/loyalty/redeem/', { points_to_redeem: points, description });
      return { success: true, ...response.data };
    } catch (error) {
      const errMsg = error.response?.data?.error || error.message || 'Failed to redeem points';
      console.error('[LOYALTY] redeem error:', errMsg);
      return { success: false, error: errMsg };
    }
  },

  award: async (orderAmount, description = 'Points earned from order') => {
    try {
      const response = await apiClient.post('/loyalty/award/', { order_amount: orderAmount, description });
      return { success: true, ...response.data };
    } catch (error) {
      console.error('[LOYALTY] award error:', error);
      return { success: false, error: error.message || 'Failed to award points' };
    }
  },

  getCurrentTier: () => ({
    success: true,
    tier: { name: 'Bronze', level: 1, min_points: 0, max_points: 999, benefits: ['Basic rewards'] }
  }),
};

// ============================================================================
// STOCK VALIDATION API
// ============================================================================
export const stockAPI = {
  // Validate stock availability for order items
  validateStock: async (items) => {
    try {
      const checkout_data = (items || []).map((item) => ({
        product_id: item.product_id || item.id || item.productId,
        quantity: item.quantity || 1,
        price: item.price || item.unit_price || 0,
      }));
      // This endpoint may be under /pos/... – adjust if needed
      const response = await apiClient.post('/pos/stock-validation/', { checkout_data });
      return response.data;
    } catch (error) {
      console.error('[STOCK] validateStock error:', error.response?.data || error.message);
      return { success: false, error: 'Failed to validate stock' };
    }
  },

  // Check individual product stock
  checkProductStock: async (productId, quantity = 1) => {
    try {
      const checkout_data = [{ product_id: productId, quantity, price: 0 }];
      const response = await apiClient.post('/pos/stock-validation/', { checkout_data });
      return response.data;
    } catch (error) {
      console.error('[STOCK] checkProductStock error:', error.response?.data || error.message);
      return { success: false, error: 'Failed to check product stock' };
    }
  }
};

// ============================================================================
// PROMOTIONS API
// ============================================================================
export const promotionsAPI = {
  // Get active promotions
  getActive: async () => {
    try {
      // Maps to /api/v1/web/promotions/active/
      const response = await apiClient.get('/promotions/active/');
      return response.data;
    } catch (error) {
      console.error('[PROMO] getActive error:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message || 'Failed to fetch promotions' };
    }
  },

  // Apply promotion to cart
  applyPromotion: async (promotionCode, cartItems) => {
    try {
      // Note: /promotions/apply/ is not yet defined in your web/urls.py; you may need to add it.
      const response = await apiClient.post('/promotions/apply/', {
        promotion_code: promotionCode,
        cart_items: cartItems
      });
      return response.data;
    } catch (error) {
      console.error('[PROMO] applyPromotion error:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message || 'Failed to apply promotion' };
    }
  },

  // Validate promotion eligibility
  validatePromotion: async (promotionCode, cartItems) => {
    // No separate validate endpoint; reuse apply endpoint
    try {
      const response = await apiClient.post('/promotions/apply/', {
        promotion_code: promotionCode,
        cart_items: cartItems
      });
      return response.data;
    } catch (error) {
      console.error('[PROMO] validatePromotion error:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message || 'Failed to validate promotion' };
    }
  }
};

// ============================================================================
// NEWSLETTER API (Fallback)
// ============================================================================
export const newsletterAPI = {
  // eslint-disable-next-line no-unused-vars
  subscribe: async (_email) => {
    return { message: 'Newsletter subscription not available' };
  }
};

// ============================================================================
// CONTACT API (Fallback)
// ============================================================================
export const contactAPI = {
  // eslint-disable-next-line no-unused-vars
  sendMessage: async (_messageData) => {
    return { message: 'Contact form not available' };
  }
};

// ============================================================================
// FINAL DEFAULT EXPORT
// ============================================================================
export default apiClient;