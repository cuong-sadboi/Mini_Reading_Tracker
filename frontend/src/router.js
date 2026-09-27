import { createRouter, createWebHistory } from 'vue-router'
import SearchBooks from './views/SearchBooks.vue'
import MyLibrary from './views/MyLibrary.vue'

const routes = [
  { path: '/', component: SearchBooks },
  { path: '/library', component: MyLibrary }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
