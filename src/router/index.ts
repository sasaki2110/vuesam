import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import ScreenWorkspaceView from '@/views/ScreenWorkspaceView.vue'

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
      component: ScreenWorkspaceView,
      meta: { requiresAuth: true, screenSpecId: 'order-new' },
    },
    {
      path: '/orders/new-alt',
      name: 'order-new-alt',
      component: ScreenWorkspaceView,
      meta: { requiresAuth: true, screenSpecId: 'order-new-alt' },
    },
    {
      path: '/purchase/new',
      name: 'purchase-new',
      component: ScreenWorkspaceView,
      meta: { requiresAuth: true, screenSpecId: 'purchase-new' },
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
