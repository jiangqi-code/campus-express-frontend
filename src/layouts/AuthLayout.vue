<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="auth-shell min-vh-100 d-flex align-items-center py-5">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-5">
          <div class="auth-card card border-0 shadow-soft">
            <div class="card-body p-4 p-md-5">
              <div class="d-flex align-items-center gap-3 mb-4">
                <div
                  class="rounded-3 d-flex align-items-center justify-content-center text-white fw-semibold"
                  style="width: 40px; height: 40px; background: var(--bs-primary)"
                >
                  CE
                </div>
                <div>
                  <div class="fw-semibold">Campus Express</div>
                  <div class="text-muted small">校园跑腿系统</div>
                </div>
              </div>
              <RouterView />
            </div>
          </div>
          <div class="auth-footer text-center text-muted small mt-3">校园跑腿 · 安全便捷</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-shell {
  background:
    radial-gradient(circle at 10% 10%, rgba(59, 130, 246, 0.12), transparent 34%),
    var(--color-bg);
}

@media (max-width: 575.98px) {
  .auth-shell { align-items: stretch !important; padding: 0 !important; background: var(--color-surface); }
  .auth-shell > .container { display: flex; padding: 0; }
  .auth-shell .row { width: 100%; margin: 0; }
  .auth-shell [class*='col-'] { padding: 0; }
  .auth-card { min-height: 100vh; border-radius: 0; box-shadow: none; }
  .auth-card > .card-body { padding: 28px 22px !important; }
  .auth-footer { display: none; }
}
</style>

