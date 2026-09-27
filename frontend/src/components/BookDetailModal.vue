<template>
  <transition name="modal-fade">
    <div class="modal-backdrop" @click="close">
      <div class="modal-content glass-card" @click.stop>
        <button class="close-btn" @click="close">×</button>
        
        <div v-if="loading" class="state-container">
          <div class="spinner"></div>
          <p>Loading book details...</p>
        </div>
        <div v-else-if="error" class="state-container error">
          <p>{{ error }}</p>
        </div>
        
        <div v-else-if="book" class="detail-grid">
          <div class="cover-col">
            <div class="cover-wrapper">
              <img v-if="coverUrl" :src="coverUrl" class="detail-cover" />
              <div v-else class="book-cover-placeholder">No Cover</div>
            </div>
          </div>
          
          <div class="info-col">
            <h2 class="book-title">{{ book.title }}</h2>
            
            <div class="scroll-area">
              <div class="description-box">
                <h4 class="section-title">Synopsis</h4>
                <p class="description" v-if="book.description">{{ book.description }}</p>
                <p class="description empty" v-else>No description available for this book.</p>
              </div>
              
              <div class="meta" v-if="book.subjects && book.subjects.length > 0">
                <h4 class="section-title">Subjects</h4>
                <div class="subjects">
                  <span v-for="(subject, idx) in book.subjects.slice(0, 15)" :key="idx" class="subject-tag">
                    {{ subject }}
                  </span>
                  <span v-if="book.subjects.length > 15" class="subject-tag more">
                    +{{ book.subjects.length - 15 }} more
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'

const props = defineProps({
  workId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['close'])

const book = ref(null)
const loading = ref(false)
const error = ref('')

const fetchDetail = async () => {
  loading.value = true
  try {
    const res = await axios.get(`http://localhost:3000/api/books/${props.workId}`)
    book.value = res.data
  } catch (err) {
    error.value = 'Failed to load book details.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDetail()
})

const close = () => {
  emit('close')
}

const coverUrl = computed(() => {
  if (book.value?.covers && book.value.covers.length > 0) {
    return `https://covers.openlibrary.org/b/id/${book.value.covers[0]}-L.jpg`
  }
  return null
})
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.4s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active .modal-content {
  animation: modalPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.modal-fade-leave-active .modal-content {
  animation: modalPopDown 0.4s ease forwards;
}

@keyframes modalPop {
  0% { transform: scale(0.9) translateY(20px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
@keyframes modalPopDown {
  0% { transform: scale(1) translateY(0); opacity: 1; }
  100% { transform: scale(0.95) translateY(20px); opacity: 0; }
}

.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0,0,0,0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal-content {
  background: rgba(15, 23, 42, 0.85);
  max-width: 900px;
  width: 100%;
  max-height: 85vh;
  position: relative;
  padding: 2.5rem;
  border-radius: 1.5rem;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1);
  overflow: hidden;
}

.close-btn {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,0.1);
  border: none;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #fff;
  transition: all 0.2s;
  z-index: 10;
}
.close-btn:hover {
  background: rgba(239, 68, 68, 0.8);
  transform: rotate(90deg);
}

.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: var(--text-muted);
}
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(99, 102, 241, 0.2);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}
@keyframes spin { 100% { transform: rotate(360deg); } }

.detail-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 3rem;
  height: 100%;
}

@media (max-width: 768px) {
  .detail-grid {
    grid-template-columns: 1fr;
    overflow-y: auto;
    max-height: calc(85vh - 5rem);
  }
}

.cover-col {
  position: relative;
}
.cover-wrapper {
  position: sticky;
  top: 0;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}

.detail-cover {
  width: 100%;
  display: block;
}

.book-cover-placeholder {
  width: 100%;
  aspect-ratio: 2/3;
  background: linear-gradient(135deg, #1e293b, #0f172a);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  font-weight: bold;
}

.info-col {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.book-title {
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 1.5rem;
  line-height: 1.2;
  background: linear-gradient(to right, #fff, #cbd5e1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  padding-right: 2rem; /* space for close button */
}

.scroll-area {
  overflow-y: auto;
  padding-right: 1rem;
  flex: 1;
}

/* Custom Scrollbar for scroll-area */
.scroll-area::-webkit-scrollbar { width: 6px; }
.scroll-area::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 3px; }
.scroll-area::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.5); border-radius: 3px; }

.section-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: #fff;
  margin-bottom: 0.75rem;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.description-box {
  margin-bottom: 2rem;
}

.description {
  color: #cbd5e1;
  font-size: 1.05rem;
  line-height: 1.7;
  white-space: pre-line;
}
.description.empty {
  font-style: italic;
  color: #64748b;
}

.subjects {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.subject-tag {
  background: rgba(255, 255, 255, 0.05);
  padding: 0.35rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
  transition: background 0.2s;
}
.subject-tag:hover {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.4);
}
.subject-tag.more {
  background: rgba(0,0,0,0.3);
  color: #94a3b8;
}
</style>
