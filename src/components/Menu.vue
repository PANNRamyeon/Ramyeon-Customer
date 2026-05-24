<template>
  <div class="menu-page">
    <h1>Menu</h1>
    
    <!-- Error State -->
    <div v-if="error" class="error-state">
      <p>{{ error }}</p>
      <button @click="fetchData">Retry</button>
    </div>

    <!-- Menu Content -->
    <div v-else>
      <div class="categories">
        <button
          :class="{ active: selectedCategory === 'All' }"
          @click="selectCategory('All', null)"
        >
          All
        </button>
        <button
          v-for="category in categories"
          :key="category._id"
          :class="{ active: selectedCategory === category._id }"
          @click="selectCategory(category._id, category.category_name)"
        >
          {{ category.category_name }}
        </button>
      </div>

      <!-- Subcategory Row -->
      <div v-if="currentSubcategories.length > 0" class="subcategories">
        <button
          :class="{ active: selectedSubcategory === null }"
          @click="selectSubcategory(null)"
        >
          All
        </button>
        <button
          v-for="sub in currentSubcategories"
          :key="sub.subcategory_id"
          :class="{ active: selectedSubcategory === sub.name }"
          @click="selectSubcategory(sub.name)"
        >
          {{ sub.name }}
        </button>
      </div>

      <!-- Skeleton Loading Grid -->
      <div v-if="loading || isLoading || loadingProducts || isProductsLoading" class="products-grid">
        <div class="skeleton-card" v-for="n in pagination.items_per_page" :key="'sk-' + n">
          <div class="skeleton skeleton-image"></div>
          <div class="skeleton-body">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-line"></div>
            <div class="skeleton skeleton-line short"></div>
            <div class="skeleton skeleton-price"></div>
          </div>
          <div class="skeleton skeleton-btn-circle"></div>
        </div>
      </div>

      <div v-else-if="displayProducts.length === 0" class="no-products">
        <p>No products available in this category.</p>
      </div>

      <div v-else class="products-grid">
        <div
          class="product-card"
          :class="{ 'out-of-stock': getProductStock(product) !== null && getProductStock(product) <= 0 }"
          v-for="product in displayProducts"
          :key="product.id || product._id"
        >
          <img 
            :src="resolveImageSrc(product)" 
            :alt="product.product_name || product.name"
            @error="handleImageError"
            @load="handleImageLoad(product)"
          />
          <div class="product-info">
            <h3>{{ product.product_name || product.name }}</h3>
            <p>{{ product.description || 'No description available' }}</p>
            <div class="price">₱{{ (product.selling_price || product.price).toFixed(2) }}</div>
            <div v-if="getProductStock(product) !== null && getProductStock(product) <= 0" class="out-of-stock-badge">Out of Stock</div>
            <div v-else-if="getProductStock(product) !== null && getProductStock(product) > 0 && getProductStock(product) <= 10" class="low-stock-badge">Low Stock ({{ getProductStock(product) }} left)</div>
          </div>
          <button 
            class="add-btn" 
            :class="{ 'disabled': getProductStock(product) !== null && getProductStock(product) <= 0 }"
            @click="addToCart(product)"
            :disabled="getProductStock(product) !== null && getProductStock(product) <= 0"
            :title="(getProductStock(product) !== null && getProductStock(product) <= 0) ? 'This item is out of stock' : 'Add to cart'"
          >
            +
          </button>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.total_pages > 1" class="pagination">
        <button
          @click="goToPage(1)"
          :disabled="pagination.current_page === 1"
          title="First page"
          class="pagination-edge"
        >
          «
        </button>
        <button
          @click="goToPage(pagination.current_page - 1)"
          :disabled="pagination.current_page === 1"
          title="Previous page"
        >
          Previous
        </button>
        <button
          v-for="page in visiblePages"
          :key="page"
          @click="goToPage(page)"
          :class="{ 'pagination-page-active': page === pagination.current_page }"
          class="pagination-page"
        >
          {{ page }}
        </button>
        <button
          @click="goToPage(pagination.current_page + 1)"
          :disabled="pagination.current_page === pagination.total_pages"
          title="Next page"
        >
          Next
        </button>
        <button
          @click="goToPage(pagination.total_pages)"
          :disabled="pagination.current_page === pagination.total_pages"
          title="Last page"
          class="pagination-edge"
        >
          »
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import './Menu.css';
import { apiBaseUrl } from '../services/api.js';
import { useProducts } from '../composables/api/useProducts.js';
import { useCategories } from '../composables/api/useCategories.js';

export default {
  name: "MenuPage",
  props: {
    onAddToCart: {
      type: Function,
      required: true,
    },
  },
  setup() {
    // Initialize composables
    const products = useProducts();
    const categories = useCategories();
    
    return {
      // Expose composable methods and state
      ...products,
      ...categories
    };
  },
  data() {
    return {
      // Keep local state for UI-specific data
      selectedCategory: 'All',
      selectedCategoryName: null,
      selectedSubcategory: null,
      loading: true,
      loadingProducts: false,
      error: null,
      pagination: {
        current_page: 1,
        total_pages: 1,
        total_items: 0,
        items_per_page: 12
      }
    };
  },
  computed: {
    currentSubcategories() {
      if (this.selectedCategory === 'All') return [];
      const cat = this.categories.find(c => c._id === this.selectedCategory);
      return cat?.sub_categories?.filter(s => s.status === 'active') || [];
    },

    visiblePages() {
      const current = this.pagination.current_page;
      const total = this.pagination.total_pages;
      const start = Math.max(1, current - 3);
      const end = Math.min(total, current + 3);
      const pages = [];
      for (let i = start; i <= end; i++) pages.push(i);
      return pages;
    },

    displayProducts() {
      console.log('🔄 Display products computed:', this.products?.length || 0);
      const allProducts = this.products || [];
      
      // Show all products - don't filter by stock
      // Products with stock <= 0 will have disabled add buttons
      console.log(`📦 Showing ${allProducts.length} products`);
      return allProducts;
    }
  },
  async mounted() {
    this.clearCache();
    await this.fetchData();
  },
  methods: {
    async fetchData() {
      this.loading = true;
      this.error = null;
      
      try {
        // Fetch categories using composable
        await this.getCategories();
        console.log('📂 Categories loaded:', this.categories);
        
        // Fetch all products initially using composable
        await this.fetchProducts();
        
        this.loading = false;
      } catch (err) {
        console.error('Error fetching menu data:', err);
        this.error = err.message || 'Failed to load menu. Please try again.';
        this.loading = false;
      }
    },

    async fetchProducts(page = 1) {
      this.loadingProducts = true;
      
      try {
        let response;
        
        const filters = { page, limit: this.pagination.items_per_page };
        if (this.selectedCategory !== 'All') {
          filters.category = this.selectedCategory;
          if (this.selectedSubcategory) {
            filters.subcategory_name = this.selectedSubcategory;
          }
        }
        response = await this.getProducts(filters);
        
        if (response.success && response.data) {
          // Products are already in the composable state
          console.log('📦 Products updated in composable:', response.data.length);
          
          // DEBUG: Check first product's image data
          if (response.data.length > 0) {
            const firstProduct = response.data[0];
            console.log('🖼️ First product image check:', {
              name: firstProduct.product_name,
              hasImageUrl: !!firstProduct.image_url,
              hasImage: !!firstProduct.image,
              imageUrlType: typeof firstProduct.image_url,
              imageUrlLength: firstProduct.image_url ? firstProduct.image_url.length : 0,
              imageUrlPrefix: firstProduct.image_url ? firstProduct.image_url.substring(0, 100) : 'none'
            });
          }
          
          // Update pagination if available
          if (response.data.pagination) {
            this.pagination = {
              current_page: response.data.pagination.current_page,
              total_pages: response.data.pagination.total_pages,
              total_items: response.data.pagination.total_items,
              items_per_page: response.data.pagination.items_per_page
            };
          }
        } else {
          console.warn('⚠️ No products data received:', response);
        }
        
        this.loadingProducts = false;
      } catch (err) {
        console.error('Error fetching products:', err);
        this.loadingProducts = false;
      }
    },

    async selectCategory(categoryId, categoryName) {
      this.selectedCategory = categoryId;
      this.selectedCategoryName = categoryName;
      this.selectedSubcategory = null;
      this.pagination = { ...this.pagination, current_page: 1, total_pages: 1, total_items: 0 };
      await this.fetchProducts(1);
    },

    async selectSubcategory(subcategoryName) {
      this.selectedSubcategory = subcategoryName;
      this.pagination = { ...this.pagination, current_page: 1, total_pages: 1, total_items: 0 };
      await this.fetchProducts(1);
    },

    async goToPage(page) {
      if (page >= 1 && page <= this.pagination.total_pages) {
        await this.fetchProducts(page);
        // Scroll to top of products
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },

    getProductStock(product) {
      // Check stock from various possible field names
      // Backend uses 'stock' field, but check others for compatibility
      // Return null if stock field is completely missing (not just 0)
      if (product.stock !== undefined && product.stock !== null) {
        return typeof product.stock === 'number' ? product.stock : parseInt(product.stock) || 0;
      }
      if (product.stock_quantity !== undefined && product.stock_quantity !== null) {
        return typeof product.stock_quantity === 'number' ? product.stock_quantity : parseInt(product.stock_quantity) || 0;
      }
      if (product.quantity !== undefined && product.quantity !== null) {
        return typeof product.quantity === 'number' ? product.quantity : parseInt(product.quantity) || 0;
      }
      
      // Return null if stock field is missing (will be treated as available)
      return null;
    },
    
    addToCart(product) {
      // Check if product is in stock before adding
      const stock = this.getProductStock(product);
      
      // Only block if stock is explicitly 0 or negative (not null/undefined)
      if (stock !== null && stock !== undefined && stock <= 0) {
        alert('This item is currently out of stock.');
        return;
      }
      
      // Normalize product data for cart
      const cartProduct = {
        id: product.product_id || product._id || product.id,
        product_id: product.product_id || product._id || product.id,
        name: product.product_name || product.name,
        price: parseFloat(product.selling_price || product.price),
        description: product.description || 'No description available',
        image: product.image_url || product.image,
        category: product.category_name || product.category,
        subcategory: product.subcategory_name || product.subcategory,
        stock: stock
      };
      
      this.onAddToCart(cartProduct);
    },

    handleImageError(event) {
      // Fallback image when product image fails to load
      console.log('⚠️ Image failed to load, using placeholder');
      event.target.src = require('../assets/Home/BigRamen.png');
    },
    resolveImageSrc(product) {
      // Prefer serving from media host (highest cacheability), then URL/base64, then placeholder
      const mediaHost = apiBaseUrl.replace(/\/api[\\/].*$/, '').replace(/\/$/, '');
      
      // 1) If backend stored a filename, build media URL (best for performance)
      if (product.image_filename) {
        return `${mediaHost}/media/${product.image_filename}`;
      }
      // 2) Use explicit image_url (can be full URL or data URI)
      if (product.image_url) return product.image_url;
      // 3) Inline base64 image if provided
      if (product.image) return product.image;
      // 4) Fallback placeholder
      return require('../assets/Home/BigRamen.png');
    },
    handleImageLoad(product) {
      console.log('✅ Image loaded for:', product.product_name, {
        hasImageUrl: !!product.image_url,
        hasImage: !!product.image,
        imageUrlPrefix: product.image_url ? product.image_url.substring(0, 50) : 'none'
      });
    }
  },
};
</script>
