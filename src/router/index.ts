import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import ListScreenView from '@/views/ListScreenView.vue'
import OrderEditPage from '@/views/OrderEditPage.vue'
import OrderNewPage from '@/views/OrderNewPage.vue'
import PurchaseNewPage from '@/views/PurchaseNewPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/orders',
      name: 'order-list',
      component: ListScreenView,
      meta: { requiresAuth: true, screenSpecId: 'order-list' },
    },
    {
      path: '/orders/:id/edit',
      name: 'order-edit',
      component: OrderEditPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/orders/new',
      name: 'order-new',
      component: OrderNewPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/orders/new-alt',
      name: 'order-new-alt',
      component: OrderNewPage,
      meta: { requiresAuth: true, variant: 'alt' },
    },
    {
      path: '/purchase/new',
      name: 'purchase-new',
      component: PurchaseNewPage,
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
