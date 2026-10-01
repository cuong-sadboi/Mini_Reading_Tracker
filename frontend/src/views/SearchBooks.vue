<template>
  <div class="search-page">
    <div class="header-actions">
      <div>
        <h2 class="page-title">Discover Books</h2>
        <p class="subtitle">Search the Open Library to add to your collection.</p>
      </div>
      
      <div class="controls glass-panel">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input 
            v-model="query" 
            @keyup.enter="searchBooks(1)" 
            class="input search-input" 
            placeholder="Title, author, or ISBN..." 
          />
        </div>
        <button @click="searchBooks(1)" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Searching...' : 'Search' }}
        </button>
        <button @click="toggleView" class="btn btn-outline view-toggle">
          {{ viewMode === 'grid' ? '📄 List' : '🔲 Grid' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="state-container">
      <div class="spinner"></div>
      <p>Searching through millions of books...</p>
    </div>
    <div v-else-if="error" class="state-container error">
      <span class="state-icon">⚠️</span>
      <p>{{ error }}</p>
    </div>
    <div v-else-if="searched && books.length === 0" class="state-container">
      <span class="state-icon">📚</span>
      <p>No books found for "{{ query }}".</p>
    </div>

    <div v-else class="results-container" :class="viewMode">
      <div 
        v-for="(book, index) in books" 
        :key="book.key" 
        class="book-card glass-card" 
        :style="{ animationDelay: `${index * 0.05}s` }"
        @click="openDetail(book)"
      >
        <div class="cover-wrapper">
          <img v-if="book.cover_i" :src="`https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`" class="book-cover" />
          <div v-else class="book-cover-placeholder"><span>No Cover</span></div>
        </div>
        
        <div class="book-info">
          <div>
            <h3 class="book-title" :title="book.title">{{ book.title }}</h3>
            <p class="book-author" v-if="book.author_name">by {{ book.author_name[0] }}<span v-if="book.author_name.length > 1"> et al.</span></p>
            <p class="book-year" v-if="book.first_publish_year">First published in {{ book.first_publish_year }}</p>
          </div>
          
          <div class="book-actions" @click.stop v-if="!isInLibrary(book.key)">
            <select v-model="addStatus[book.key]" class="select status-select">
              <option value="WANT_TO_READ">Want to read</option>
              <option value="READING">Reading</option>
              <option value="READ">Read</option>
            </select>
            <button @click="addToLibrary(book)" class="btn btn-primary add-btn">
              +
            </button>
          </div>
          <div class="book-actions" v-else>
            <span class="badge badge-success in-library-badge">✓ In Library</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="books.length > 0 && !loading" class="pagination-wrapper glass-panel">
      <button :disabled="page <= 1" @click="searchBooks(page - 1)" class="pagination-btn nav-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      
      <div class="page-numbers">
        <button 
          v-for="(p, index) in visiblePages" 
          :key="index"
          @click="p !== '...' ? searchBooks(p) : null"
          :class="['pagination-btn', { active: p === page, dots: p === '...' }]"
          :disabled="p === '...'"
        >
          {{ p }}
        </button>
      </div>

      <button :disabled="page >= totalPages" @click="searchBooks(page + 1)" class="pagination-btn nav-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>

    <BookDetailModal 
      v-if="selectedBookId" 
      :work-id="selectedBookId"
      :search-book="selectedBook"
      :is-in-library="selectedBook && isInLibrary(selectedBook.key)"
      @close="selectedBookId = null"
      @add="handleAddToLibraryFromModal"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import BookDetailModal from '../components/BookDetailModal.vue'

const query = ref('')
const books = ref([])
const libraryBooks = ref([])
const loading = ref(false)
const error = ref('')
const searched = ref(false)
const page = ref(1)
const totalBooks = ref(0)
const viewMode = ref('grid')
const selectedBookId = ref(null)
const selectedBook = ref(null)
const addStatus = ref({})

const limit = 20
const totalPages = computed(() => Math.ceil(totalBooks.value / limit) || 1)

const visiblePages = computed(() => {
  const current = page.value
  const total = totalPages.value
  
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total]
  }
  
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  }
  
  return [1, '...', current - 1, current, current + 1, '...', total]
})

const fetchLibrary = async () => {
  try {
    const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/library`)
    libraryBooks.value = res.data
  } catch (err) {
    console.error('Failed to fetch library', err)
  }
}

onMounted(() => {
  fetchLibrary()
  
  // Default search to show some books initially
  query.value = 'programming'
  searchBooks(1)
})

const isInLibrary = (key) => {
  const workId = key.split('/').pop()
  return libraryBooks.value.some(b => b.open_library_work_id === workId)
}

const toggleView = () => {
  viewMode.value = viewMode.value === 'grid' ? 'list' : 'grid'
}

const searchBooks = async (targetPage = 1) => {
  if (!query.value.trim()) return
  
  loading.value = true
  error.value = ''
  searched.value = true
  books.value = [] // clear previous for fresh animation
  
  try {
    const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/books/search`, {
      params: { q: query.value, page: targetPage, limit }
    })
    books.value = res.data.docs
    totalBooks.value = res.data.numFound
    page.value = targetPage
    
    books.value.forEach(b => {
      if (!addStatus.value[b.key]) {
        addStatus.value[b.key] = 'WANT_TO_READ'
      }
    })
  } catch (err) {
    error.value = 'Failed to search books. Please try again later.'
  } finally {
    loading.value = false
  }
}

const openDetail = (book) => {
  selectedBook.value = book
  selectedBookId.value = book.key.split('/').pop()
}

const handleAddToLibraryFromModal = async (status) => {
  if (!selectedBook.value) return
  addStatus.value[selectedBook.value.key] = status
  await addToLibrary(selectedBook.value)
}

const addToLibrary = async (book) => {
  try {
    const workId = book.key.split('/').pop()
    const payload = {
      workId,
      title: book.title,
      author: book.author_name ? book.author_name[0] : null,
      coverUrl: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : null,
      publishedYear: book.first_publish_year,
      status: addStatus.value[book.key]
    }
    
    await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/library`, payload)
    await fetchLibrary()
    
    // Add a tiny success notification if needed, but the badge handles visual feedback
  } catch (err) {
    if (err.response?.status === 409) {
      alert('This book is already in your library.')
    } else {
      alert('Failed to add book to library.')
    }
  }
}
</script>

<style scoped>
.search-page {
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
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1.5rem;
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

.glass-panel {
  background: rgba(30, 41, 59, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 0.75rem;
  border-radius: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}
.search-icon {
  position: absolute;
  left: 1rem;
  font-size: 1.1rem;
  opacity: 0.5;
}
.search-input {
  width: 350px;
  padding-left: 2.75rem;
  border-radius: 0.5rem;
  border-color: rgba(255,255,255,0.1);
}

.view-toggle {
  width: 100px;
}

/* States */
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6rem 2rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 1.25rem;
  background: rgba(30, 41, 59, 0.2);
  border-radius: 1.5rem;
  border: 1px dashed rgba(255,255,255,0.1);
}
.state-icon {
  font-size: 4rem;
  margin-bottom: 1.5rem;
  opacity: 0.7;
}
.error {
  color: var(--danger-color);
  border-color: rgba(239, 68, 68, 0.2);
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(99, 102, 241, 0.2);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1.5rem;
}
@keyframes spin { 100% { transform: rotate(360deg); } }

/* Grid / List Results */
.results-container.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 2rem;
}

.results-container.list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.book-card {
  overflow: hidden;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  display: flex;
  flex-direction: column;
  position: relative;
  opacity: 0;
  animation: slideUp 0.5s ease forwards;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

.results-container.list .book-card {
  flex-direction: row;
  height: 220px;
}

.book-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.3);
}

.cover-wrapper {
  position: relative;
  width: 100%;
  height: 320px;
  overflow: hidden;
  background: #1e293b;
}

.results-container.list .cover-wrapper {
  width: 150px;
  height: 100%;
  flex-shrink: 0;
}

.book-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.book-card:hover .book-cover {
  transform: scale(1.08);
}

.book-cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  font-weight: 600;
  background: linear-gradient(135deg, #1e293b, #0f172a);
}

.status-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
}

.book-info {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  flex: 1;
  justify-content: space-between;
}

.book-title {
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 0.5rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: #fff;
}

.book-author {
  color: #cbd5e1;
  font-size: 0.95rem;
  margin-bottom: 0.25rem;
}

.book-year {
  font-size: 0.85rem;
  color: #64748b;
  margin-bottom: 1.5rem;
}

.book-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: auto;
}

.status-select {
  flex: 1;
  padding: 0.5rem 2rem 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.85rem;
}

.add-btn {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 1.2rem;
  line-height: 1;
}

.in-library-badge {
  width: 100%;
  justify-content: center;
  padding: 0.6rem;
  font-size: 0.85rem;
  border-radius: 0.5rem;
}

.pagination-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  margin-top: 1rem;
  border-radius: 100px;
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.pagination-btn {
  min-width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 1rem;
  font-weight: 500;
  border-radius: 18px;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0 0.5rem;
}

.pagination-btn:hover:not(:disabled):not(.dots) {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.pagination-btn.active {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.pagination-btn.dots {
  cursor: default;
  background: transparent !important;
  color: #94a3b8;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nav-btn {
  color: #fff;
}

@media (max-width: 768px) {
  .header-actions { flex-direction: column; align-items: stretch; }
  .controls { flex-wrap: wrap; }
  .search-input { width: 100%; }
}
</style>
