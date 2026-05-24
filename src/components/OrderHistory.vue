<template>
  <div class="order-history-container">
    <div class="order-history-header">
      <h1>Order History</h1>
      <p>Track and review all your past orders</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading your orders...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon">⚠️</div>
      <h2>Couldn't Load Orders</h2>
      <p>{{ error }}</p>
      <button class="browse-btn" @click="loadOrders">Try Again</button>
    </div>

    <!-- Orders List -->
    <div v-else-if="orders.length > 0" class="orders-list">
      <div v-for="order in sortedOrders" :key="order.id" class="order-card">

        <!-- Card Header -->
        <div class="order-card-header">
          <div class="order-card-title">
            <span class="order-id">{{ order.displayId }}</span>
            <span class="order-date">{{ formatDate(order.orderTime) }}</span>
          </div>
          <span class="status-badge" :class="'status-' + order.status">
            {{ formatStatus(order.status) }}
          </span>
        </div>

        <!-- Items -->
        <div class="order-items">
          <div v-for="(item, i) in order.items" :key="i" class="order-item">
            <div class="item-left">
              <img
                :src="getItemImage(item)"
                :alt="item.name"
                class="item-image"
                @error="handleImageError"
              />
              <div>
                <p class="item-name">{{ item.name }}</p>
                <p class="item-qty">x{{ item.quantity }}</p>
              </div>
            </div>
            <p class="item-price">₱{{ (item.price * item.quantity).toFixed(2) }}</p>
          </div>
        </div>

        <!-- Totals -->
        <div class="order-totals">
          <div class="total-row">
            <span>Subtotal</span>
            <span>₱{{ order.subtotal.toFixed(2) }}</span>
          </div>
          <div class="total-row">
            <span>Delivery Fee</span>
            <span>₱{{ order.deliveryFee.toFixed(2) }}</span>
          </div>
          <div class="total-row">
            <span>Service Fee</span>
            <span>₱{{ order.serviceFee.toFixed(2) }}</span>
          </div>
          <div class="total-row grand-total">
            <span>Total</span>
            <span>₱{{ order.total.toFixed(2) }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="order-actions">
          <button class="btn-details" @click="openModal(order)">View Details</button>
          <button class="btn-reorder" @click="reorder(order)">Order Again</button>
        </div>

      </div>
    </div>

    <!-- Empty -->
    <div v-else class="empty-state">
      <div class="empty-icon">📦</div>
      <h2>No Orders Yet</h2>
      <p>You haven't placed any orders yet.</p>
      <button class="browse-btn" @click="$emit('setCurrentPage', 'Menu')">Browse Menu</button>
    </div>

    <!-- Detail Modal -->
    <div v-if="selectedOrder" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <div>
            <h2>{{ selectedOrder.displayId }}</h2>
            <span class="order-date">{{ formatDate(selectedOrder.orderTime) }}</span>
          </div>
          <button class="modal-close" @click="closeModal">✕</button>
        </div>

        <div class="modal-body">
          <!-- Status Tracker -->
          <div class="modal-section">
            <h3>Order Status</h3>
            <OrderStatusTracker
              :orderId="selectedOrder.id"
              :currentStatus="selectedOrder.status"
              :showHistory="true"
              :showRefresh="true"
              :autoRefresh="false"
              @status-updated="handleStatusUpdate"
            />
          </div>

          <!-- Items -->
          <div class="modal-section">
            <h3>Items Ordered</h3>
            <div v-for="(item, i) in selectedOrder.items" :key="i" class="modal-item">
              <div class="modal-item-left">
                <img :src="getItemImage(item)" :alt="item.name" class="modal-item-img" @error="handleImageError" />
                <span>{{ item.name }} x{{ item.quantity }}</span>
              </div>
              <span class="modal-item-price">₱{{ (item.price * item.quantity).toFixed(2) }}</span>
            </div>
          </div>

          <!-- Financials -->
          <div class="modal-section">
            <h3>Order Summary</h3>
            <div class="summary-row"><span>Subtotal</span><span>₱{{ selectedOrder.subtotal.toFixed(2) }}</span></div>
            <div class="summary-row"><span>Delivery Fee</span><span>₱{{ selectedOrder.deliveryFee.toFixed(2) }}</span></div>
            <div class="summary-row"><span>Service Fee</span><span>₱{{ selectedOrder.serviceFee.toFixed(2) }}</span></div>
            <div v-if="selectedOrder.pointsRedeemed > 0" class="summary-row discount">
              <span>Points Redeemed ({{ selectedOrder.pointsRedeemed }} pts)</span>
              <span>-₱{{ (selectedOrder.pointsRedeemed / 4).toFixed(2) }}</span>
            </div>
            <div class="summary-row grand-total"><span>Total</span><span>₱{{ selectedOrder.total.toFixed(2) }}</span></div>
            <div v-if="selectedOrder.pointsEarned > 0" class="summary-row points-earned">
              <span>Points Earned</span><span>+{{ selectedOrder.pointsEarned }} pts</span>
            </div>
          </div>

          <!-- Delivery & Payment -->
          <div class="modal-section modal-two-col">
            <div>
              <h3>Delivery</h3>
              <p><strong>Type:</strong> {{ formatDeliveryType(selectedOrder.deliveryType) }}</p>
              <p v-if="selectedOrder.deliveryAddress"><strong>Address:</strong> {{ selectedOrder.deliveryAddress }}</p>
              <p v-if="selectedOrder.specialInstructions"><strong>Notes:</strong> {{ selectedOrder.specialInstructions }}</p>
            </div>
            <div>
              <h3>Payment</h3>
              <p><strong>Method:</strong> {{ formatPaymentMethod(selectedOrder.paymentMethod) }}</p>
              <p>
                <strong>Status:</strong>
                <span :class="'pay-' + selectedOrder.paymentStatus"> {{ formatPaymentStatus(selectedOrder.paymentStatus) }}</span>
              </p>
              <p v-if="selectedOrder.paymentReference"><strong>Ref:</strong> {{ selectedOrder.paymentReference }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script>
import { ordersAPI } from '../services/api.js';
import OrderStatusTracker from './OrderStatusTracker.vue';

export default {
  name: 'OrderHistory',
  components: { OrderStatusTracker },
  emits: ['setCurrentPage'],

  data() {
    return {
      orders: [],
      loading: false,
      selectedOrder: null,
      error: null
    };
  },

  computed: {
    sortedOrders() {
      return [...this.orders].sort(
        (a, b) => new Date(b.orderTime || 0) - new Date(a.orderTime || 0)
      );
    }
  },

  mounted() {
    this.loadOrders();
  },

  methods: {
    async loadOrders() {
      this.loading = true;
      this.error = null;
      try {
        const result = await ordersAPI.getAll();
        console.log('[OrderHistory] getAll result:', result);
        if (result.success && Array.isArray(result.results)) {
          this.orders = result.results.map(o => this.mapOrder(o));
          console.log('[OrderHistory] mapped orders:', this.orders.length);
        } else {
          this.error = result.error || 'Failed to load orders';
          console.warn('[OrderHistory] error:', this.error);
        }
      } catch (err) {
        this.error = 'Unable to load orders. Please try again.';
        console.error('[OrderHistory] exception:', err);
      } finally {
        this.loading = false;
      }
    },

    mapOrder(o) {
      // DynamoDB to_dict() returns a nested structure — see models/Online_Transactions.py
      const deliveryAddr = o.delivery?.address;
      const addressStr = typeof deliveryAddr === 'object' && deliveryAddr
        ? [deliveryAddr.street, deliveryAddr.barangay, deliveryAddr.city, deliveryAddr.postal_code]
            .filter(Boolean).join(', ')
        : (deliveryAddr || '');

      return {
        id:               o.transaction_id,
        displayId:        o.transaction_id,
        orderTime:        o.timing?.transaction_date_utc || o.timing?.created_at || null,
        status:           o.order?.status || o.order_status || 'pending',

        items: (o.items || []).map(item => ({
          id:       item.product_id,
          name:     item.product_name || 'Unknown Item',
          quantity: item.quantity || 1,
          price:    item.price || 0,
          image:    item.image || item.imageUrl || ''
        })),

        subtotal:     parseFloat(o.financials?.subtotal ?? 0),
        deliveryFee:  parseFloat(o.financials?.delivery_fee ?? o.delivery?.fee ?? 0),
        serviceFee:   parseFloat(o.financials?.service_fee ?? 0),
        total:        parseFloat(o.financials?.total_amount ?? 0),

        deliveryType:    o.delivery?.type || 'delivery',
        deliveryAddress: addressStr,

        paymentMethod:    o.payment?.method || 'cash',
        paymentStatus:    o.payment?.status || 'pending',
        paymentReference: o.payment?.reference || '',

        specialInstructions: o.order?.notes || '',
        pointsEarned:        o.loyalty?.points_earned || 0,
        pointsRedeemed:      o.loyalty?.points_redeemed || 0,
      };
    },

    openModal(order) {
      this.selectedOrder = order;
    },

    closeModal() {
      this.selectedOrder = null;
    },

    handleStatusUpdate(data) {
      const idx = this.orders.findIndex(o => o.id === data.orderId);
      if (idx !== -1) this.orders[idx].status = data.status;
      if (this.selectedOrder?.id === data.orderId) this.selectedOrder.status = data.status;
    },

    async reorder(order) {
      const cart = JSON.parse(localStorage.getItem('ramyeon_cart') || '[]');
      order.items.forEach(item => {
        const found = cart.find(i => i.id === item.id);
        if (found) found.quantity += item.quantity;
        else cart.push({ ...item });
      });
      localStorage.setItem('ramyeon_cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cart-updated'));
      this.$emit('setCurrentPage', 'Cart');
    },

    getItemImage(item) {
      return item.image || item.imageUrl || '';
    },

    handleImageError(e) {
      e.target.style.display = 'none';
    },

    formatDate(dateStr) {
      if (!dateStr) return '—';
      const d = new Date(dateStr);
      if (isNaN(d)) return '—';
      return d.toLocaleDateString('en-PH', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    },

    formatStatus(s) {
      const map = {
        pending: 'Pending', confirmed: 'Confirmed', processing: 'Preparing',
        preparing: 'Preparing', cooking: 'Cooking', ready: 'Ready',
        shipped: 'On the Way', on_the_way: 'On the Way', out_for_delivery: 'On the Way',
        delivered: 'Delivered', completed: 'Completed', cancelled: 'Cancelled'
      };
      return map[s] || s;
    },

    formatDeliveryType(t) {
      return t === 'delivery' ? 'Delivery' : 'Pick-up';
    },

    formatPaymentMethod(m) {
      const map = {
        cash: 'Cash on Delivery', gcash: 'GCash',
        card: 'Credit / Debit Card', grabpay: 'GrabPay', cod: 'Cash on Delivery'
      };
      return map[m] || m;
    },

    formatPaymentStatus(s) {
      const map = {
        pending: 'Pending', paid: 'Paid', succeeded: 'Paid',
        failed: 'Failed', refunded: 'Refunded', cancelled: 'Cancelled'
      };
      return map[s] || s;
    }
  }
};
</script>

<style scoped>
/* ── Container ─────────────────────────────────────────── */
.order-history-container {
  max-width: 860px;
  margin: 0 auto;
  padding: 32px 20px 80px;
  font-family: 'Poppins', sans-serif;
}

/* ── Header ─────────────────────────────────────────────── */
.order-history-header {
  text-align: center;
  margin-bottom: 32px;
  padding: 28px 24px;
  background: linear-gradient(135deg, #ff4757, #ff3742);
  border-radius: 18px;
  color: #fff;
  box-shadow: 0 4px 20px rgba(255, 71, 87, 0.28);
}
.order-history-header h1 {
  margin: 0;
  font-size: 1.9rem;
  font-weight: 700;
}
.order-history-header p {
  margin: 6px 0 0;
  opacity: 0.85;
  font-size: 0.9rem;
}

/* ── Loading ────────────────────────────────────────────── */
.loading-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}
.loading-spinner {
  width: 42px; height: 42px;
  border: 3px solid #f0f0f0;
  border-top-color: #ff4757;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Orders List ────────────────────────────────────────── */
.orders-list { display: flex; flex-direction: column; gap: 16px; }

/* ── Order Card ─────────────────────────────────────────── */
.order-card {
  background: #fff;
  border: 1.5px solid #f0f0f0;
  border-radius: 16px;
  padding: 22px 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  transition: box-shadow 0.2s, transform 0.2s;
}
.order-card:hover {
  box-shadow: 0 6px 24px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

/* Card header */
.order-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1.5px solid #f5f5f5;
}
.order-card-title { display: flex; flex-direction: column; gap: 3px; }
.order-id { font-weight: 700; color: #1a1a1a; font-size: 1rem; }
.order-date { font-size: 0.8rem; color: #999; }

/* Status badges */
.status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
}
.status-pending   { background: #fff4e0; color: #d97706; }
.status-confirmed { background: #e8f4fd; color: #0369a1; }
.status-processing,
.status-preparing { background: #f0f0ff; color: #4f46e5; }
.status-cooking   { background: #fff3e0; color: #e65100; }
.status-ready     { background: #e8f5e9; color: #2e7d32; }
.status-shipped,
.status-on_the_way,
.status-out_for_delivery { background: #e0f7fa; color: #0097a7; }
.status-delivered,
.status-completed { background: #e6f9f0; color: #059669; }
.status-cancelled { background: #fef2f2; color: #dc2626; }

/* Items */
.order-items { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.order-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: #fafafa;
  border-radius: 10px;
}
.item-left { display: flex; align-items: center; gap: 12px; }
.item-image {
  width: 44px; height: 44px;
  object-fit: cover; border-radius: 8px;
  background: #eee;
}
.item-name  { margin: 0; font-weight: 600; font-size: 0.9rem; color: #1a1a1a; }
.item-qty   { margin: 0; font-size: 0.8rem; color: #999; }
.item-price { margin: 0; font-weight: 700; color: #ff4757; font-size: 0.9rem; }

/* Totals */
.order-totals {
  background: #fafafa;
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.total-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.88rem;
  color: #555;
  padding: 4px 0;
}
.total-row.grand-total {
  border-top: 1.5px solid #ebebeb;
  margin-top: 8px;
  padding-top: 10px;
  font-weight: 700;
  font-size: 1rem;
  color: #1a1a1a;
}

/* Actions */
.order-actions { display: flex; gap: 10px; }
.order-actions button {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  font-family: 'Poppins', sans-serif;
  transition: all 0.2s;
}
.btn-details {
  background: transparent;
  border: 1.5px solid #ff4757;
  color: #ff4757;
}
.btn-details:hover { background: #ff4757; color: #fff; }
.btn-reorder {
  background: #ff4757;
  color: #fff;
}
.btn-reorder:hover {
  background: #ff3742;
  box-shadow: 0 4px 12px rgba(255,71,87,0.35);
  transform: translateY(-1px);
}

/* ── Error State ────────────────────────────────────────── */
.error-state {
  text-align: center;
  padding: 70px 20px;
  background: #fff5f5;
  border-radius: 18px;
  border: 1.5px solid #fecaca;
}
.error-icon { font-size: 3rem; margin-bottom: 16px; }
.error-state h2 { margin: 0 0 8px; color: #dc2626; }
.error-state p  { margin: 0 0 28px; color: #888; font-size: 0.9rem; }

/* ── Empty State ────────────────────────────────────────── */
.empty-state {
  text-align: center;
  padding: 70px 20px;
  background: #fff;
  border-radius: 18px;
  border: 1.5px solid #f0f0f0;
}
.empty-icon { font-size: 4rem; margin-bottom: 16px; }
.empty-state h2 { margin: 0 0 8px; color: #1a1a1a; }
.empty-state p  { margin: 0 0 28px; color: #888; }
.browse-btn {
  padding: 12px 36px;
  background: #ff4757;
  color: #fff;
  border: none;
  border-radius: 24px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  font-family: 'Poppins', sans-serif;
  transition: all 0.2s;
}
.browse-btn:hover {
  background: #ff3742;
  box-shadow: 0 4px 16px rgba(255,71,87,0.35);
  transform: translateY(-1px);
}

/* ── Modal ──────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  display: flex;
  justify-content: center;
  align-items: flex-end;
  z-index: 900;
  padding: 20px;
  backdrop-filter: blur(3px);
}
@media (min-width: 600px) {
  .modal-overlay { align-items: center; }
}
.modal {
  background: #fff;
  border-radius: 20px 20px 20px 20px;
  width: 100%;
  max-width: 600px;
  max-height: 88vh;
  overflow-y: auto;
  box-shadow: 0 16px 60px rgba(0,0,0,0.25);
  animation: modalUp 0.28s cubic-bezier(0.22,1,0.36,1);
}
@keyframes modalUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 22px 24px 16px;
  border-bottom: 1.5px solid #f0f0f0;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
}
.modal-header h2 { margin: 0; font-size: 1.15rem; color: #1a1a1a; }
.modal-close {
  background: none; border: none;
  font-size: 1.1rem; color: #aaa;
  cursor: pointer; padding: 4px 8px;
  border-radius: 6px; transition: color 0.2s;
}
.modal-close:hover { color: #ff4757; }

.modal-body { padding: 20px 24px 28px; }
.modal-section { margin-bottom: 24px; }
.modal-section h3 {
  margin: 0 0 12px;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #ff4757;
}
.modal-section p { margin: 6px 0; font-size: 0.9rem; color: #444; }

.modal-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: #fafafa;
  border-radius: 8px;
  margin-bottom: 6px;
  font-size: 0.88rem;
  color: #1a1a1a;
}
.modal-item-left { display: flex; align-items: center; gap: 10px; }
.modal-item-img {
  width: 36px; height: 36px;
  border-radius: 6px; object-fit: cover; background: #eee;
}
.modal-item-price { font-weight: 700; color: #ff4757; }

.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.88rem;
  color: #555;
  padding: 4px 0;
}
.summary-row.grand-total {
  border-top: 1.5px solid #ebebeb;
  margin-top: 8px; padding-top: 10px;
  font-weight: 700; font-size: 1rem; color: #1a1a1a;
}
.summary-row.discount { color: #059669; }
.summary-row.points-earned { color: #d97706; }

.modal-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.pay-paid, .pay-succeeded { color: #059669; font-weight: 600; }
.pay-pending              { color: #d97706; font-weight: 600; }
.pay-failed, .pay-cancelled { color: #dc2626; font-weight: 600; }

@media (max-width: 480px) {
  .order-card { padding: 16px; }
  .modal-two-col { grid-template-columns: 1fr; }
  .order-actions { flex-direction: column; }
}
</style>
