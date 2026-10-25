import { combineReducers } from '@reduxjs/toolkit'
import dashboard, { loadDashboard } from './dashboardSlice'
import catalog, { loadCatalog } from './catalogSlice'
import orders, { loadOrders } from './ordersSlice'
import deliveries, { loadDeliveries } from './deliveriesSlice'
import payments, { loadPayments } from './paymentsSlice'
import credit, { loadCredit } from './creditSlice'
import inventory, { loadInventory } from './inventorySlice'
import people, { loadPeople } from './peopleSlice'
import pricing, { loadPricing } from './pricingSlice'
import activity, { loadActivity } from './activitySlice'
import business, { loadBusiness } from './businessSlice'
import directory, { loadDirectory } from './directorySlice'
import notifications, { loadNotifications } from './notificationsSlice'
import shell, { loadShell } from './shellSlice'

export const pagesReducer = combineReducers({ dashboard, catalog, orders, deliveries, payments, credit, inventory, people, pricing, activity, business, directory, notifications, shell })
export const pageLoaders = { dashboard: loadDashboard, catalog: loadCatalog, orders: loadOrders, deliveries: loadDeliveries, payments: loadPayments, credit: loadCredit, inventory: loadInventory, people: loadPeople, pricing: loadPricing, activity: loadActivity, business: loadBusiness, directory: loadDirectory, notifications: loadNotifications, shell: loadShell }
