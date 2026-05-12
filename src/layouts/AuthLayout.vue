<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="min-vh-100 d-flex align-items-center py-5">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-5">
          <div class="card border-0 shadow-soft">
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
          <div class="text-center text-muted small mt-3">主色 #4361ee · Bootstrap 5 风格</div>
        </div>
      </div>
    </div>
  </div>
</template>

