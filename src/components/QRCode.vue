<template>
  <div class="qr-code-container">
    <div class="qr-code-wrapper" :class="size">
      <div v-if="title" class="qr-code-header">
        <h3>{{ title }}</h3>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>

      <div class="qr-code-display">
        <div v-if="loading" class="qr-placeholder">Generating…</div>
        <div v-else-if="error" class="qr-placeholder qr-error">Failed to generate QR</div>
        <img
          v-else
          :src="dataUrl"
          alt="Customer QR Code"
          class="qr-image"
        />
      </div>

      <div v-if="showCode" class="qr-code-info">
        <div class="code-display">
          <span class="code-label">Code:</span>
          <span class="code-value">{{ shortCode }}</span>
          <button class="copy-btn" @click="copyCode" :class="{ copied: isCopied }">
            {{ isCopied ? '✓' : '📋' }}
          </button>
        </div>
      </div>

      <div v-if="instructions" class="qr-instructions">
        <p>{{ instructions }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import QRCode from 'qrcode'

export default {
  name: 'QRCode',
  props: {
    code: { type: String, required: true },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    size: {
      type: String,
      default: 'medium',
      validator: v => ['small', 'medium', 'large'].includes(v)
    },
    showCode: { type: Boolean, default: true },
    instructions: { type: String, default: '' },
  },
  data() {
    return {
      dataUrl: '',
      loading: true,
      error: false,
      isCopied: false,
    }
  },
  computed: {
    shortCode() {
      return this.code.length > 20 ? `${this.code.slice(0, 8)}…${this.code.slice(-4)}` : this.code
    },
    qrSize() {
      return this.size === 'large' ? 240 : this.size === 'small' ? 140 : 190
    },
  },
  watch: {
    code() { this.renderQR() },
  },
  mounted() {
    this.renderQR()
  },
  methods: {
    async renderQR() {
      if (!this.code) return
      this.loading = true
      this.error = false
      try {
        this.dataUrl = await QRCode.toDataURL(this.code, {
          width: this.qrSize,
          margin: 2,
          color: { dark: '#1a1a1a', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        })
      } catch {
        this.error = true
      } finally {
        this.loading = false
      }
    },
    async copyCode() {
      try {
        await navigator.clipboard.writeText(this.code)
      } catch {
        const el = document.createElement('textarea')
        el.value = this.code
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }
      this.isCopied = true
      setTimeout(() => { this.isCopied = false }, 2000)
    },
  },
}
</script>

<style scoped>
.qr-code-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.qr-code-wrapper {
  background: white;
  border-radius: 20px;
  padding: 28px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  text-align: center;
  width: 100%;
  max-width: 280px;
  border: 3px solid #f0f0f0;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.qr-code-wrapper:hover {
  transform: translateY(-4px);
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15);
}

.qr-code-wrapper.large { max-width: 360px; padding: 36px; }
.qr-code-wrapper.small { max-width: 200px; padding: 18px; }

.qr-code-header h3 {
  font-size: 1.3rem;
  font-weight: 700;
  margin: 0 0 6px;
  background: linear-gradient(135deg, #b33a3a, #8a2a2a);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.qr-code-header p {
  font-size: 0.88rem;
  color: #666;
  margin: 0 0 18px;
}

.qr-code-display {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 16px 0;
}

.qr-image {
  border-radius: 10px;
  border: 2px solid #e8e8e8;
  display: block;
  width: 100%;
  max-width: 190px;
}

.qr-code-wrapper.large .qr-image { max-width: 240px; }
.qr-code-wrapper.small .qr-image { max-width: 140px; }

.qr-placeholder {
  width: 190px;
  height: 190px;
  border-radius: 10px;
  border: 2px solid #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #aaa;
  font-size: 0.9rem;
  background: #f8f8f8;
}

.qr-error { color: #b33a3a; }

.qr-code-info {
  margin-top: 18px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 10px;
  border: 1px solid #e9ecef;
}

.code-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.code-label {
  font-weight: 600;
  color: #666;
  font-size: 0.85rem;
}

.code-value {
  font-family: 'Courier New', monospace;
  font-weight: 700;
  color: #333;
  font-size: 0.95rem;
  background: white;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid #ddd;
  letter-spacing: 0.5px;
}

.copy-btn {
  background: #b33a3a;
  color: white;
  border: none;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.25s ease;
  min-width: 36px;
}

.copy-btn:hover { background: #8a2a2a; }
.copy-btn.copied { background: #00b894; }

.qr-instructions {
  margin-top: 14px;
  padding: 11px 14px;
  background: linear-gradient(135deg, #b33a3a, #8a2a2a);
  color: white;
  border-radius: 8px;
  font-size: 0.88rem;
  line-height: 1.4;
}

.qr-instructions p { margin: 0; font-weight: 500; }

@media (max-width: 480px) {
  .qr-code-wrapper { padding: 18px; }
  .qr-image, .qr-placeholder { max-width: 160px; }
}
</style>
