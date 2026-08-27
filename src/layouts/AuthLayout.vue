<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="auth-shell min-vh-100 d-flex align-items-center py-5">
    <div class="container auth-container">
      <div class="row justify-content-center">
        <div class="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-5">
          <div class="auth-card card">
            <div class="card-body p-4 p-md-5">
              <div class="auth-brand">
                <div class="auth-brand__mark">CE</div>
                <div><div class="auth-brand__name">Campus Express</div><div class="auth-brand__desc">校园服务调度台</div></div>
              </div>
              <RouterView />
            </div>
          </div>
          <div class="auth-footer text-center">任务清晰，行动直接</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-shell { position: relative; overflow: hidden; background: var(--color-navy); }
.auth-container { position: relative; z-index: 1; }
.auth-card { border: 1px solid var(--color-border-strong) !important; background: var(--color-surface); }
.auth-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }
.auth-brand__mark { display: grid; width: 44px; height: 44px; place-items: center; border-radius: 6px; background: var(--color-primary); color: #fff; font-size: 14px; font-weight: 850; letter-spacing: .04em; }
.auth-brand__name { color: var(--color-navy); font-size: 18px; font-weight: 800; letter-spacing: -.03em; }.auth-brand__desc { margin-top: 2px; color: var(--color-text-muted); font-size: 12px; }
.auth-footer { margin-top: 16px; color: rgba(220, 230, 249, .66); font-size: 12px; }
@media (max-width: 575.98px) { .auth-shell { align-items: stretch !important; padding: 0 !important; }.auth-shell > .container { display: flex; padding: 0; }.auth-shell .row { width: 100%; margin: 0; }.auth-shell [class*='col-'] { padding: 0; }.auth-card { min-height: 100vh; border: 0 !important; border-radius: 0 !important; }.auth-card > .card-body { padding: 32px 22px !important; }.auth-footer { display: none; } }
</style>
