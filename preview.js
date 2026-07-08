(function () {
  'use strict';

  const FRAME_W = 360;
  const FRAME_H = 800;
  const PHONE_BORDER_PX = 20;
  const STAGE_PAD = 16;
  const TOOLBAR_PHONE_GAP = 24;
  const ZOOM_FIT = 'fit';
  const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5];
  const VARIANTS = [{ id: 'v1', label: 'V1', path: 'variants/v1/index.html' }];

  const els = {
    toolbar: document.getElementById('toolbar'),
    stage: document.querySelector('.stage'),
    phoneWrap: document.getElementById('phone-wrap'),
    frame: document.getElementById('app-frame'),
    variantSelect: document.getElementById('variantSelect'),
    zoomOutBtn: document.getElementById('zoomOutBtn'),
    zoomInBtn: document.getElementById('zoomInBtn'),
    zoomFitBtn: document.getElementById('zoomFitBtn'),
    zoomLabel: document.getElementById('zoomLabel'),
    fastForwardBtn: document.getElementById('fastForwardBtn'),
    reloadBtn: document.getElementById('reloadBtn'),
    measureBtn: document.getElementById('measureBtn'),
    measureHighlight: document.getElementById('measure-highlight'),
    measureGapHighlight: document.getElementById('measure-gap-highlight'),
    measureSpacingGuides: document.getElementById('measure-spacing-guides'),
    measurePanel: document.getElementById('measure-panel'),
  };

  let currentVariant = 'v1';
  let zoomMode = ZOOM_FIT;
  let zoomIndex = 2;

  function toolbarClearance() {
    const rect = els.toolbar?.getBoundingClientRect();
    return rect ? rect.bottom + TOOLBAR_PHONE_GAP : 74;
  }

  function phoneChromeHeight(scale) {
    return (FRAME_H + PHONE_BORDER_PX) * scale;
  }

  function computeFitScale() {
    const clearance = toolbarClearance();
    const availW = els.stage.clientWidth - STAGE_PAD * 2;
    const availH = els.stage.clientHeight - clearance - STAGE_PAD;
    return Math.min(availW / (FRAME_W + PHONE_BORDER_PX), availH / (FRAME_H + PHONE_BORDER_PX), 1);
  }

  function currentScale() {
    if (zoomMode === ZOOM_FIT) return computeFitScale();
    return ZOOM_STEPS[zoomIndex];
  }

  function syncZoomUi() {
    const scale = currentScale();
    if (els.zoomLabel) els.zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    els.zoomFitBtn?.classList.toggle('is-active', zoomMode === ZOOM_FIT);
    if (els.zoomOutBtn) els.zoomOutBtn.disabled = zoomMode !== ZOOM_FIT && zoomIndex <= 0;
    if (els.zoomInBtn) els.zoomInBtn.disabled = zoomMode !== ZOOM_FIT && zoomIndex >= ZOOM_STEPS.length - 1;
  }

  function applyLayout() {
    const topInset = toolbarClearance();
    const scale = currentScale();
    const phoneH = phoneChromeHeight(scale);
    const availH = Math.max(1, els.stage.clientHeight - topInset - STAGE_PAD);
    const topEdge = topInset + Math.max(0, (availH - phoneH) / 2);
    els.phoneWrap.style.left = '50%';
    els.phoneWrap.style.top = `${topEdge}px`;
    els.phoneWrap.style.transform = `translateX(-50%) scale(${scale})`;
    syncZoomUi();
  }

  function nearestStepIndex(scale) {
    let best = 0;
    let bestDelta = Infinity;
    ZOOM_STEPS.forEach((step, index) => {
      const delta = Math.abs(step - scale);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = index;
      }
    });
    return best;
  }

  function setZoomFit() {
    zoomMode = ZOOM_FIT;
    applyLayout();
  }

  function setZoomStep(index) {
    zoomMode = 'step';
    zoomIndex = Math.max(0, Math.min(ZOOM_STEPS.length - 1, index));
    applyLayout();
  }

  function zoomOut() {
    if (zoomMode === ZOOM_FIT) {
      setZoomStep(nearestStepIndex(computeFitScale()) - 1);
      return;
    }
    setZoomStep(zoomIndex - 1);
  }

  function zoomIn() {
    if (zoomMode === ZOOM_FIT) {
      setZoomStep(nearestStepIndex(computeFitScale()) + 1);
      return;
    }
    setZoomStep(zoomIndex + 1);
  }

  function variantFrameUrl(path) {
    const url = new URL(path, window.location.href);
    url.searchParams.set('build', String(Date.now()));
    return `${url.pathname}${url.search}`;
  }

  function setVariant(variantId, reload = true) {
    const meta = VARIANTS.find((item) => item.id === variantId) || VARIANTS[0];
    currentVariant = meta.id;
    if (els.variantSelect) els.variantSelect.value = meta.id;
    if (reload && els.frame) {
      els.frame.style.opacity = '0';
      els.frame.src = variantFrameUrl(meta.path);
    }
  }

  function reloadDemo() {
    const meta = VARIANTS.find((item) => item.id === currentVariant) || VARIANTS[0];
    els.frame.style.opacity = '0';
    els.frame.src = variantFrameUrl(meta.path);
  }

  function fastForwardProgress() {
    const progressApi = els.frame?.contentWindow?.__miniAppProgress;
    if (progressApi && typeof progressApi.fastForward === 'function') {
      progressApi.fastForward();
    }
  }

  function framePointFromClient(clientX, clientY, options = {}) {
    const rect = els.frame.getBoundingClientRect();
    const scaleX = rect.width ? FRAME_W / rect.width : 1;
    const scaleY = rect.height ? FRAME_H / rect.height : 1;
    let x = (clientX - rect.left) * scaleX;
    let y = (clientY - rect.top) * scaleY;
    const inside = x >= 0 && x <= FRAME_W && y >= 0 && y <= FRAME_H;
    if (!inside && options.clamp === false) return null;
    x = Math.max(0, Math.min(FRAME_W, x));
    y = Math.max(0, Math.min(FRAME_H, y));
    return { x, y, scaleX, scaleY, rect };
  }

  function setupVariants() {
    VARIANTS.forEach((variant) => {
      const option = document.createElement('option');
      option.value = variant.id;
      option.textContent = variant.label;
      els.variantSelect.appendChild(option);
    });
    els.variantSelect.value = currentVariant;
  }

  function init() {
    setupVariants();
    els.variantSelect?.addEventListener('change', () => setVariant(els.variantSelect.value));
    els.zoomOutBtn?.addEventListener('click', zoomOut);
    els.zoomInBtn?.addEventListener('click', zoomIn);
    els.zoomFitBtn?.addEventListener('click', setZoomFit);
    els.fastForwardBtn?.addEventListener('click', fastForwardProgress);
    els.reloadBtn?.addEventListener('click', reloadDemo);
    els.frame?.addEventListener('load', () => {
      els.frame.style.opacity = '1';
      requestAnimationFrame(applyLayout);
    });
    window.addEventListener('resize', applyLayout);
    if (els.toolbar && typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(applyLayout).observe(els.toolbar);
    }
    if (typeof setupSkylightMeasureTool === 'function') {
      setupSkylightMeasureTool({
        els,
        framePointFromClient,
        FRAME_W,
        FRAME_H,
        onModeChange(active) {
          document.body.classList.toggle('is-measure-running', active);
        },
      });
    }
    setZoomFit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
