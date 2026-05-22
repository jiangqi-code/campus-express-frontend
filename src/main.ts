import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'

import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import 'element-plus/dist/index.css'

import './styles/variables.css'
import './styles/globals.css'

import App from './App.vue'
import router from './router'
import { useThemeStore } from './stores/theme'
import { useWebsocketStore } from './stores/websocket'

const app = createApp(App)

const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(ElementPlus)

// 初始化主题
useThemeStore(pinia).apply()

// 初始化 WebSocket 连接（会自动从 localStorage 读取 token）
useWebsocketStore(pinia).connect()

app.mount('#app')