import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import OrderNewView from '@/views/OrderNewView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/orders/new',
      name: 'order-new',
      component: OrderNewView,
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to) => {
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  if (!requiresAuth) return true

  const token = sessionStorage.getItem('accessToken')
  if (token) return true

  return { path: '/' }
})

export default router
