<template>
  <div class="skeleton" :class="{ round }">
    <div v-if="type === 'text'" class="skeleton-text" :style="{ width: width }"></div>
    <div v-else-if="type === 'avatar'" class="skeleton-avatar" :style="{ width: size, height: size }"></div>
    <div v-else-if="type === 'card'" class="skeleton-card">
      <div class="skeleton-card-header"></div>
      <div class="skeleton-card-line"></div>
      <div class="skeleton-card-line short"></div>
    </div>
    <div v-else-if="type === 'list'" class="skeleton-list">
      <div class="skeleton-list-item" v-for="i in rows" :key="i" :style="{ animationDelay: (i - 1) * 0.1 + 's' }">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-content">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>
    </div>
    <div v-else-if="type === 'chart'" class="skeleton-chart">
      <div class="skeleton-chart-bars">
        <div v-for="i in 6" :key="i" class="skeleton-bar" :style="{ height: Math.random() * 60 + 40 + 'px', animationDelay: i * 0.1 + 's' }"></div>
      </div>
    </div>
    <div v-else-if="type === 'pie'" class="skeleton-pie">
      <div class="pie-ring">
        <div class="pie-segment" v-for="i in 4" :key="i" :style="{ animationDelay: i * 0.15 + 's' }"></div>
      </div>
      <div class="pie-legend">
        <div class="legend-item" v-for="i in 4" :key="i" :style="{ animationDelay: i * 0.1 + 's' }">
          <div class="legend-dot"></div>
          <div class="legend-line"></div>
        </div>
      </div>
    </div>
    <div v-else-if="type === 'metric'" class="skeleton-metric">
      <div class="metric-icon"></div>
      <div class="metric-content">
        <div class="metric-value"></div>
        <div class="metric-label"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  type?: 'text' | 'avatar' | 'card' | 'list' | 'chart' | 'pie' | 'metric'
  width?: string
  size?: string
  rows?: number
  round?: boolean
}>()
</script>

<style scoped>
.skeleton {
  overflow: hidden;
}

.skeleton-text,
.skeleton-avatar,
.skeleton-card-header,
.skeleton-card-line,
.skeleton-line,
.skeleton-bar,
.skeleton-avatar,
.metric-icon,
.metric-value,
.metric-label,
.legend-dot,
.legend-line,
.pie-segment {
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

.skeleton.round .skeleton-text,
.skeleton.round .skeleton-avatar {
  border-radius: 50%;
}

.skeleton-text {
  height: 14px;
  border-radius: 2px;
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
}

.skeleton-card {
  padding: 16px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.skeleton-card-header {
  height: 20px;
  width: 120px;
  margin-bottom: 12px;
}

.skeleton-card-line {
  height: 12px;
  margin-bottom: 8px;
}

.skeleton-card-line.short {
  width: 60%;
}

.skeleton-list-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
  animation: fadeInUp 0.3s ease-out forwards;
  opacity: 0;
}

.skeleton-content {
  flex: 1;
  margin-left: 12px;
}

.skeleton-line {
  height: 14px;
  margin-bottom: 6px;
}

.skeleton-line.short {
  width: 50%;
}

.skeleton-chart-bars {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 150px;
  padding: 20px 0;
}

.skeleton-bar {
  width: 30px;
  border-radius: 6px 6px 0 0;
  animation: barGrow 0.6s ease-out forwards, shimmer 1.5s ease-in-out infinite;
  transform-origin: bottom;
}

@keyframes barGrow {
  from {
    transform: scaleY(0);
    opacity: 0;
  }
  to {
    transform: scaleY(1);
    opacity: 1;
  }
}

/* 饼图骨架屏 */
.skeleton-pie {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 40px;
  height: 150px;
}

.pie-ring {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  position: relative;
  background: #f5f5f5;
}

.pie-segment {
  position: absolute;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  animation: segmentPulse 1.5s ease-in-out infinite;
}

.pie-segment:nth-child(1) { top: 0; left: 50%; transform: translateX(-50%); }
.pie-segment:nth-child(2) { top: 50%; right: 0; transform: translateY(-50%); }
.pie-segment:nth-child(3) { bottom: 0; left: 50%; transform: translateX(-50%); }
.pie-segment:nth-child(4) { top: 50%; left: 0; transform: translateY(-50%); }

@keyframes segmentPulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.1); opacity: 1; }
}

.pie-legend {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  animation: fadeInRight 0.3s ease-out forwards;
  opacity: 0;
}

@keyframes fadeInRight {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-line {
  width: 60px;
  height: 10px;
  border-radius: 5px;
}

/* 指标骨架屏 */
.skeleton-metric {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: #fff;
  border-radius: 12px;
}

.metric-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
}

.metric-content {
  flex: 1;
}

.metric-value {
  height: 20px;
  width: 80px;
  margin-bottom: 8px;
}

.metric-label {
  height: 12px;
  width: 50px;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>