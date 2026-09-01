import type { Dictionary } from './en.js';

export const zhTW: Dictionary = {
  appName: 'SVGMotion',
  tagline: '為 SVG 圖示加上動畫，匯出成 Lottie、CSS、React 或 Vue。',
  nav: { animate: '製作動畫', playground: 'Lottie 遊樂場' },

  drop: {
    title: '把 SVG 拖曳到這裡',
    hint: '或點擊選擇檔案。檔案不會上傳，所有處理都在你的瀏覽器裡完成。',
    sample: '試用範例圖示',
    reject: '這個檔案不是 SVG。',
    tooLarge: '檔案超過 {size}，請改用較單純的圖示。',
  },

  dropLottie: {
    title: '把 Lottie JSON 拖曳到這裡',
    hint: '或點擊選擇 .json 檔案。',
    reject: '這不是有效的 Lottie JSON。',
  },

  shapes: {
    title: '圖形',
    empty: '這個檔案裡沒有找到圖形。',
    animateAll: '全部套用',
    clear: '全部清除',
  },

  animation: {
    title: '動畫',
    preset: '效果',
    duration: '長度',
    delay: '延遲',
    easing: '緩動',
    loop: '循環',
    stagger: '錯開時間',
    none: '播放一次',
    loopForever: '無限循環',
    pingpong: '來回播放',
    degrees: '旋轉角度',
    from: '起始值',
    to: '結束值',
    height: '彈跳高度',
    reverse: '從另一端開始描繪',
    trigger: '播放時機',
    triggerAuto: '載入時',
    triggerHover: '滑鼠懸停時',
    morphTarget: '變形目標（路徑資料）',
    morphTargetHint: '貼上要變形成的路徑 `d` 值，座標需在同一個 viewBox 內，子路徑數量必須和原形狀相同。',
  },

  presets: {
    strokeDraw: '線條描繪',
    fade: '淡入',
    scale: '縮放',
    rotate: '旋轉',
    bounce: '彈跳',
    morph: '路徑變形',
  },

  preview: {
    title: '預覽',
    replay: '重播',
    background: '背景',
    transparent: '透明',
    light: '淺色',
    dark: '深色',
    zoom: '縮放',
  },

  exportPanel: {
    title: '匯出',
    copy: '複製',
    copied: '已複製',
    download: '下載',
    openInPlayground: '在遊樂場開啟',
    formats: {
      lottie: 'Lottie JSON',
      css: 'CSS',
      svg: 'SVG',
      react: 'React',
      vue: 'Vue',
    },
  },

  player: {
    title: '播放器',
    speed: '速度',
    direction: '方向',
    forward: '正向',
    reverse: '反向',
    loop: '循環',
    size: '尺寸',
    play: '播放',
    pause: '暫停',
    frames: '第 {current} / {total} 影格',
  },

  embed: {
    title: '嵌入',
    html: 'HTML',
    iframe: 'iframe',
    react: 'React',
    vue: 'Vue',
    hostedNote:
      '這些程式碼片段會從 CDN 載入播放器，並從你自己架設的網址讀取動畫檔。請把 {placeholder} 換成該網址。',
  },

  warnings: {
    title: '關於這個檔案的提醒',
    dismiss: '知道了',
    lottieGap: 'SVG 裡不是所有內容都能轉成 Lottie。',
  },

  footer: {
    source: '原始碼',
    docs: '文件',
    license: 'MIT 授權',
  },

  empty: {
    title: '尚未載入檔案',
    body: '拖曳一個檔案開始使用。',
  },
};
