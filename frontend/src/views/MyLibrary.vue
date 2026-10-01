<template>
  <div class="library-page">
    <div class="header-actions">
      <div>
        <h2 class="page-title">My Library</h2>
        <p class="subtitle">Track your reading progress and thoughts.</p>
      </div>
      
      <div class="stats-container" v-if="stats">
        <div class="stat-box glass-panel">
          <div class="stat-icon">📚</div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.totalBooks || 0 }}</span>
            <span class="stat-label">Total Books</span>
          </div>
        </div>
        <div class="stat-box glass-panel highlight-blue">
          <div class="stat-icon">📖</div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.readingBooks || 0 }}</span>
            <span class="stat-label">Reading</span>
          </div>
        </div>
        <div class="stat-box glass-panel highlight-green">
          <div class="stat-icon">🏆</div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.readBooks || 0 }}</span>
            <span class="stat-label">Completed</span>
          </div>
        </div>
      </div>
    </div>

    <div class="tabs-container">
      <div class="tabs glass-panel">
        <button 
          class="tab-btn" 
          :class="{ active: currentTab === 'WANT_TO_READ' }" 
          @click="currentTab = 'WANT_TO_READ'">
          Want to Read
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: currentTab === 'READING' }" 
          @click="currentTab = 'READING'">
          Reading
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: currentTab === 'READ' }" 
          @click="currentTab = 'READ'">
          Completed
        </button>
        
        <div class="tab-indicator" :class="currentTab.toLowerCase()"></div>
      </div>
    </div>

    <div v-if="loading" class="state-container">
      <div class="spinner"></div>
      <p>Loading your collection...</p>
    </div>
    <div v-else-if="filteredBooks.length === 0" class="state-container empty">
      <span class="state-icon">📭</span>
      <p>Your shelf is empty here.</p>
      <router-link to="/" class="btn btn-primary mt-4">Find some books</router-link>
    </div>

    <div v-else class="library-grid">
      <transition-group name="list">
        <div v-for="(book, index) in filteredBooks" :key="book.id" class="library-card glass-card">
          <div class="cover-section">
            <img v-if="book.cover_url" :src="book.cover_url" class="book-cover" />
            <div v-else class="book-cover-placeholder">No Cover</div>
          </div>
          
          <div class="book-info">
            <div class="info-header">
              <h3 class="book-title">{{ book.title }}</h3>
              <button @click="deleteBook(book.id)" class="btn-icon delete-btn" title="Remove from library">🗑️</button>
            </div>
            
            <div class="controls-grid">
              <div class="control-group">
                <label>Reading Status</label>
                <select v-model="book.status" @change="updateBook(book)" class="select">
                  <option value="WANT_TO_READ">Want to read</option>
                  <option value="READING">Reading</option>
                  <option value="READ">Completed</option>
                </select>
              </div>
              
              <div class="control-group">
                <label>Rating</label>
                <div class="star-rating-wrapper">
                  <div class="star-rating">
                    <span 
                      v-for="star in 5" 
                      :key="star"
                      class="star"
                      :class="{ filled: book.rating >= star }"
                      @click="setRating(book, star)"
                    >★</span>
                  </div>
                  <button 
                    v-if="book.rating" 
                    @click="setRating(book, null)" 
                    class="clear-rating-btn" 
                    title="Clear rating"
                  >×</button>
                  <span v-else class="unrated-text">Unrated</span>
                </div>
              </div>

              <div class="control-group full-width" v-if="book.status === 'READING' || book.current_page > 0">
                <div class="progress-header">
                  <label>Progress</label>
                  <span class="progress-text">
                    <input 
                      type="number" 
                      v-model.number="book.current_page" 
                      min="0"
                      :max="book.total_pages || ''"
                      class="inline-input"
                      @change="updateBook(book)"
                    />
                    <span class="total-pages">
                      /
                      <input 
                        type="number" 
                        v-model.number="book.total_pages" 
                        min="1"
                        class="inline-input"
                        placeholder="?"
                        @change="updateBook(book)"
                      />
                    </span>
                  </span>
                </div>
                <div class="progress-bar-container" v-if="book.total_pages">
                  <div class="progress-bar-track">
                    <div 
                      class="progress-bar-fill" 
                      :style="{ width: Math.min((book.current_page / book.total_pages) * 100, 100) + '%' }"
                    ></div>
                  </div>
                </div>
              </div>
              
              <div class="control-group full-width">
                <label>Personal Notes</label>
                <textarea 
                  v-model="book.note" 
                  class="input textarea" 
                  @change="updateBook(book)"
                  placeholder="What are your thoughts on this book?..."
                ></textarea>
              </div>
            </div>
            
            <div class="dates-info" v-if="book.started_at || book.finished_at">
              <span v-if="book.started_at">Started: {{ formatDate(book.started_at) }}</span>
              <span v-if="book.finished_at">Finished: {{ formatDate(book.finished_at) }}</span>
            </div>
          </div>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const books = ref([])
const stats = ref(null)
const loading = ref(true)
const currentTab = ref('WANT_TO_READ')

const filteredBooks = computed(() => {
  return books.value.filter(b => b.status === currentTab.value)
})

const fetchLibrary = async () => {
  loading.value = true
  try {
    const [booksRes, statsRes] = await Promise.all([
      axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/library`),
      axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/library/stats`)
    ])
    books.value = booksRes.data
    stats.value = statsRes.data
  } catch (err) {
    console.error('Failed to load library', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchLibrary()
})

const updateBook = async (book) => {
  try {
    await axios.patch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/library/${book.id}`, {
      status: book.status,
      currentPage: book.current_page,
      rating: book.rating || null,
      note: book.note,
      totalPages: book.total_pages
    })
    await fetchLibrary()
  } catch (err) {
    alert(err.response?.data?.error || 'Failed to update book')
    await fetchLibrary()
  }
}

const setRating = (book, value) => {
  book.rating = value
  updateBook(book)
}

const deleteBook = async (id) => {
  if (!confirm('Are you sure you want to completely remove this book from your library?')) return
  
  try {
    await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/library/${id}`)
    await fetchLibrary()
  } catch (err) {
    alert('Failed to delete book')
  }
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}
</script>

<style scoped>
.library-page {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 2rem;
}

.page-title {
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 0.25rem;
  background: linear-gradient(to right, #fff, #94a3b8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.subtitle {
  color: var(--text-muted);
  font-size: 1.1rem;
}

.stats-container {
  display: flex;
  gap: 1rem;
}

.stat-box {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-radius: 1rem;
  background: rgba(30, 41, 59, 0.4);
}

.stat-box.highlight-blue { border-bottom: 3px solid #3b82f6; }
.stat-box.highlight-green { border-bottom: 3px solid #10b981; }

.stat-icon {
  font-size: 2rem;
  opacity: 0.8;
}

.stat-info {
  display: flex;
  flex-direction: column;
}
.stat-value {
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.2;
  color: #fff;
}
.stat-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.tabs-container {
  display: flex;
  justify-content: flex-start;
}
.tabs {
  position: relative;
  display: flex;
  padding: 0.5rem;
  border-radius: 1rem;
  gap: 0.5rem;
}

.tab-btn {
  padding: 0.75rem 2rem;
  background: transparent;
  border: none;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: 0.75rem;
  position: relative;
  z-index: 2;
}
.tab-btn:hover { color: #fff; }
.tab-btn.active { color: #fff; }

.tab-indicator {
  position: absolute;
  top: 0.5rem;
  bottom: 0.5rem;
  background: rgba(99, 102, 241, 0.3);
  border: 1px solid rgba(99, 102, 241, 0.5);
  border-radius: 0.75rem;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1;
}

/* Magic numbers for tab indicator widths based on padding */
.tab-indicator.want_to_read { width: 154px; transform: translateX(0); }
.tab-indicator.reading { width: 110px; transform: translateX(162px); }
.tab-indicator.read { width: 125px; transform: translateX(280px); }

.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 5rem;
  color: var(--text-muted);
  font-size: 1.2rem;
}
.state-icon { font-size: 4rem; margin-bottom: 1rem; opacity: 0.5; }
.spinner {
  width: 40px; height: 40px;
  border: 3px solid rgba(99, 102, 241, 0.2);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}
.mt-4 { margin-top: 1.5rem; }

/* List Animations */
.list-enter-active, .list-leave-active { transition: all 0.4s ease; }
.list-enter-from { opacity: 0; transform: translateX(-30px); }
.list-leave-to { opacity: 0; transform: scale(0.9); }

.library-grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.library-card {
  display: flex;
  overflow: hidden;
  transition: transform 0.3s, box-shadow 0.3s;
}
.library-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 15px 35px rgba(0,0,0,0.3);
}

@media (max-width: 768px) {
  .library-card { flex-direction: column; }
  .stats-container { width: 100%; flex-direction: column; }
  .tab-indicator { display: none; }
  .tab-btn.active { background: rgba(99, 102, 241, 0.3); }
}

.cover-section {
  width: 220px;
  flex-shrink: 0;
  background: #0f172a;
}
@media (max-width: 768px) {
  .cover-section { width: 100%; height: 350px; }
}

.book-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.book-cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  background: linear-gradient(135deg, #1e293b, #0f172a);
}

.book-info {
  padding: 1.5rem 2rem;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.book-title {
  font-size: 1.8rem;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
}

.btn-icon {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.5rem;
  transition: background 0.2s;
  opacity: 0.5;
}
.btn-icon:hover {
  background: rgba(239, 68, 68, 0.2);
  opacity: 1;
}

.controls-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}
@media (max-width: 640px) {
  .controls-grid { grid-template-columns: 1fr; }
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.control-group.full-width { grid-column: 1 / -1; }

.star-rating-wrapper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  height: 42px; /* match select height */
}

.star-rating {
  display: flex;
  gap: 0.25rem;
}

.star {
  font-size: 1.5rem;
  color: #334155;
  cursor: pointer;
  transition: color 0.2s, transform 0.1s;
  user-select: none;
}

.star:hover {
  transform: scale(1.15);
}

.star.filled {
  color: #fbbf24;
}

.clear-rating-btn {
  background: rgba(255, 255, 255, 0.05);
  border: none;
  color: #94a3b8;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1rem;
  line-height: 1;
}

.clear-rating-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.unrated-text {
  color: #64748b;
  font-size: 0.9rem;
  font-style: italic;
}

.control-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.inline-input {
  width: 60px;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255,255,255,0.2);
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
  padding: 0.25rem;
  outline: none;
  transition: border-color 0.2s;
}
.inline-input:focus { border-bottom-color: var(--primary-color); }

.total-pages { color: var(--text-muted); font-size: 0.9rem; margin-left: 0.25rem; }

.progress-bar-container {
  width: 100%;
}
.progress-bar-track {
  height: 8px;
  background: rgba(0,0,0,0.3);
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
}
.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #10b981);
  border-radius: 4px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.textarea {
  resize: vertical;
  min-height: 80px;
  background: rgba(0,0,0,0.1);
}

.dates-info {
  margin-top: auto;
  display: flex;
  gap: 1.5rem;
  font-size: 0.8rem;
  color: #64748b;
  border-top: 1px solid rgba(255,255,255,0.05);
  padding-top: 1rem;
}
</style>
