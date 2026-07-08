(function (global) {
  function setupSkylightMeasureTool(deps) {
    const { els, framePointFromClient, FRAME_W, FRAME_H, onModeChange } = deps;
    if (!els?.measureBtn) return;

    let active = false;
    let onPhoneMove = null;

    const SKIP_TAGS = new Set(['HTML', 'BODY', 'HEAD', 'SCRIPT', 'STYLE', 'SVG']);
    const LAYOUT_IDS = new Set([
      'flowRoot',
      'layer-feed',
      'layer-inbox',
      'layer-desktop',
      'skylightRow',
      'storyRevealSlot',
      'inboxRevealRoot',
      'phone',
      'feedVideo',
    ]);
    const LAYOUT_CLASS_HINTS = [
      'flow-root',
      'flow-layer',
      'feed-video',
      'feed-gradient',
      'skylight-row-inner',
      'skylight-row',
      'story-reveal-slot',
      'inbox-reveal-root',
      'inbox-list-layer',
      'inbox-scroll',
      'inbox-list',
      'inbox-body',
      'mode-integrated',
      'mode-overlay',
      'whole-page',
      'gesture-reveal',
      'desktop-wallpaper',
      'story-preview-interaction',
      'inbox-cell-body',
    ];
    const CONTAINER_SELECTORS = [
      '.skylight-item',
      '.feed-nav-cell',
      '.feed-nav-create',
      '.desktop-app',
      '.feed-action',
      '.feed-icon-btn',
      '.feed-tab',
      '.story-message-bubble',
      '.inbox-story-cell',
    ];
    const LEAF_SELECTOR = [
      'img',
      '.skylight-label',
      '.skylight-plus-badge',
      '.skylight-create-body',
      '.skylight-create-ring',
      '.skylight-create-photo',
      '.skylight-create-base',
      '.skylight-ring',
      '.skylight-avatar',
      '.skylight-plus-icon',
      '.skylight-plus-stroke',
      '.feed-nav-label',
      '.feed-nav-icon',
      '.feed-action-label',
      '.feed-action-icon',
      '.feed-avatar',
      '.feed-avatar-ring',
      '.desktop-app-label',
      '.desktop-app-icon',
      '.story-preview-name',
      '.story-preview-time',
      '.story-progress-seg',
      '.system-home-indicator-handle',
      '.inbox-cell',
      '.inbox-cell-title',
    ].join(',');
    const MEASURE_TARGET_SELECTOR = [
      LEAF_SELECTOR,
      '.skylight-item',
      '.feed-nav-cell',
      '.feed-nav-create',
      '.feed-tab',
      '.feed-icon-btn',
      '.feed-action',
      '.feed-avatar-wrap',
      '.inbox-navbar',
      '.inbox-nav-title',
      '.inbox-cell',
      '.inbox-section-title',
      '.story-preview-header',
      '.story-message-bubble',
      '.story-preview-actions-row button',
      '.desktop-app',
      '.status-bar',
      '.system-home-indicator',
      '.effect-preset-btn',
    ].join(',');
    const SPACING_REFERENCE_SELECTOR = [
      LEAF_SELECTOR,
      '.skylight-item',
      '.feed-nav-cell',
      '.feed-nav-create',
      '.feed-tab',
      '.feed-icon-btn',
      '.feed-action',
      '.feed-avatar-wrap',
      '.inbox-navbar',
      '.inbox-story-cell',
      '.inbox-section-title',
      '.story-preview-header',
      '.story-message-bubble',
      '.desktop-app',
      '.status-bar',
      '.system-home-indicator',
    ].join(',');

    function isLayoutShell(el) {
      if (!el || el.nodeType !== 1) return true;
      if (el.id && LAYOUT_IDS.has(el.id)) return true;
      const cls = typeof el.className === 'string' ? el.className : '';
      return LAYOUT_CLASS_HINTS.some((hint) => cls.includes(hint));
    }

    function isMediaOverlayText(el, win) {
      if (!el || !el.textContent?.trim()) return false;
      const tag = el.tagName;
      if (tag !== 'SPAN' && tag !== 'P' && tag !== 'LABEL') return false;
      const cs = win.getComputedStyle(el);
      if (cs.position !== 'absolute' && cs.position !== 'fixed') return false;
      return Boolean(el.closest('.feed-action, .skylight-item, .desktop-app'));
    }

    function isContainer(el) {
      return CONTAINER_SELECTORS.some((sel) => el.matches?.(sel));
    }

    function isOversizedLayout(el, doc, win) {
      if (!el || el.nodeType !== 1) return true;
      if (isLayoutShell(el)) return true;
      if (el.classList?.contains('inbox-reveal-root')) return true;
      if (el.classList?.contains('inbox-list-layer')) return true;
      if (el.classList.contains('mode-integrated') || el.classList.contains('mode-overlay')) return true;
      const phone = doc.querySelector('.phone');
      const phoneArea = phone ? phone.clientWidth * phone.clientHeight : FRAME_W * FRAME_H;
      if (elementArea(el) > phoneArea * 0.32 && !isLeafTarget(el, win)) return true;
      return false;
    }

    function isLeafTarget(el, win) {
      if (!isInspectable(el, win) || isLayoutShell(el)) return false;
      if (el.matches?.(LEAF_SELECTOR)) return true;
      if (el.tagName === 'SPAN' && el.classList.length && !isContainer(el)) return true;
      return false;
    }

    function measureTargetScore(el, win) {
      if (isLayoutShell(el)) return -1000;
      if (isLeafTarget(el, win)) return 200;
      if (isContainer(el)) return 40;
      if (win && isMediaOverlayText(el, win)) return 130;
      const tag = el.tagName;
      if (tag === 'BUTTON') return 30;
      if (tag === 'DIV' && !el.textContent.trim() && el.children.length > 0) return -200;
      return 20;
    }

    function isMeasureTarget(el, win) {
      return measureTargetScore(el, win) > 0;
    }

    function isEffectivelyVisible(el, win) {
      if (!el || el.nodeType !== 1) return false;
      let node = el;
      let opacity = 1;
      while (node && node.nodeType === 1) {
        if (node.hasAttribute('hidden')) return false;
        const cs = win.getComputedStyle(node);
        if (cs.display === 'none') return false;
        if (cs.visibility === 'hidden') return false;
        opacity *= Number(cs.opacity);
        if (opacity < 0.01) return false;
        if (node.id === 'phone' || node.classList?.contains('phone')) break;
        node = node.parentElement;
      }
      const rect = el.getBoundingClientRect();
      return rect.width >= 0.5 && rect.height >= 0.5;
    }

    function isExposedAtPoint(el, x, y, doc, win) {
      if (!isEffectivelyVisible(el, win)) return false;
      const stack = doc.elementsFromPoint
        ? doc.elementsFromPoint(x, y)
        : [doc.elementFromPoint(x, y)];
      return stack.some((hit) => hit && (hit === el || el.contains(hit)));
    }

    function isExposedAtCenter(el, doc, win) {
      const rect = el.getBoundingClientRect();
      return isExposedAtPoint(el, rect.left + rect.width / 2, rect.top + rect.height / 2, doc, win);
    }

    function isInspectable(el, win) {
      if (!el || el.nodeType !== 1) return false;
      if (SKIP_TAGS.has(el.tagName)) return false;
      if (el.classList?.contains('phone')) return false;
      if (!isEffectivelyVisible(el, win)) return false;
      if (el.offsetWidth < 1 || el.offsetHeight < 1) return false;
      return true;
    }

    function normalizeMeasureTarget(el, win) {
      if (!el || isLayoutShell(el)) return null;
      if (!isInspectable(el, win)) return null;
      return el;
    }

    function elementArea(el) {
      return el.offsetWidth * el.offsetHeight;
    }

    function pickFromStack(stack, win, doc) {
      const filtered = stack.filter((el) => !isOversizedLayout(el, doc, win));
      for (const el of filtered) {
        if (isLeafTarget(el, win)) return el;
      }
      const nonContainers = filtered.filter((el) => !isContainer(el));
      if (nonContainers.length) return nonContainers[0];
      const containers = filtered.filter((el) => isContainer(el));
      if (containers.length) {
        return containers.sort((a, b) => elementArea(a) - elementArea(b))[0];
      }
      return null;
    }

    function readablePseudo(cs) {
      if (!cs || cs.content === 'none') return null;
      const border = parseFloat(cs.borderTopWidth) || 0;
      const width = parseFloat(cs.width) || 0;
      const height = parseFloat(cs.height) || 0;
      if (width < 1 || height < 1) return null;
      const color = readableColor(cs.borderTopColor);
      const hasGradient = cs.backgroundImage && cs.backgroundImage !== 'none';
      return { width, height, border, color, hasGradient, backgroundImage: cs.backgroundImage };
    }

    function pseudoRingRect(slot, pseudo, win) {
      const parsed = readablePseudo(win.getComputedStyle(slot, pseudo));
      if (!parsed) return null;
      const slotRect = slot.getBoundingClientRect();
      const cx = slotRect.left + slotRect.width / 2;
      const cy = slotRect.top + slotRect.height / 2;
      return {
        left: cx - parsed.width / 2,
        top: cy - parsed.height / 2,
        width: parsed.width,
        height: parsed.height,
        border: parsed.border,
        color: parsed.color,
        hasGradient: parsed.hasGradient,
        backgroundImage: parsed.backgroundImage,
      };
    }

    function pointInRingBand(x, y, ringRect) {
      if (!ringRect) return false;
      const cx = ringRect.left + ringRect.width / 2;
      const cy = ringRect.top + ringRect.height / 2;
      const dist = Math.hypot(x - cx, y - cy);
      const outerR = ringRect.width / 2;
      const innerR = Math.max(0, outerR - (ringRect.border || 3.5) - 1);
      return dist >= innerR - 1.5 && dist <= outerR + 2;
    }

    function ringComponentName(storyItem, pseudo) {
      const label = storyItem.dataset.storyLabel
        || (storyItem.dataset.skylightAction === 'create' ? 'Create' : 'Story');
      if (storyItem.dataset.skylightAction === 'create') return `Create · ${label} 头像边框`;
      if (pseudo === '::before' || storyItem.classList.contains('read')) {
        return `Story · ${label} 已读边框`;
      }
      return `Story · ${label} 头像边框`;
    }

    function ringStrokeColor(ringRect) {
      if (ringRect.hasGradient && ringRect.backgroundImage) {
        const hexes = extractColorsFromCssValue(ringRect.backgroundImage);
        if (hexes.length) return hexes.join(' · ');
      }
      if (ringRect.color) return cssColorToHex(ringRect.color);
      return null;
    }

    function inspectSkylightRing(slot, win, doc, ringRect, storyItem, pseudo) {
      const { spacing, guides } = computeAroundSpacing(slot, win, doc);
      const strokeWidth = ringRect.border || 0;
      const strokeColor = ringStrokeColor(ringRect);
      const stroke = strokeWidth > 0 && strokeColor
        ? {
          t: strokeWidth,
          r: strokeWidth,
          b: strokeWidth,
          l: strokeWidth,
          color: strokeColor,
          uniform: true,
        }
        : null;
      return {
        el: slot,
        highlightRect: {
          left: ringRect.left,
          top: ringRect.top,
          width: ringRect.width,
          height: ringRect.height,
        },
        name: ringComponentName(storyItem, pseudo),
        typography: null,
        color: null,
        fill: null,
        w: dp(ringRect.width),
        h: dp(ringRect.height),
        spacing,
        spacingGuides: guides,
        stroke,
      };
    }

    function tryPickSkylightRing(x, y, doc, win) {
      const stack = (doc.elementsFromPoint
        ? doc.elementsFromPoint(x, y)
        : [doc.elementFromPoint(x, y)]
      ).filter(Boolean);
      let slot = stack.find((el) => el.classList?.contains('skylight-avatar-slot'));
      if (!slot) {
        slot = stack.map((el) => el.closest?.('.skylight-avatar-slot')).find(Boolean);
      }
      if (!slot || !isEffectivelyVisible(slot, win)) return null;

      const storyItem = slot.closest('.skylight-item');
      if (!storyItem || !isEffectivelyVisible(storyItem, win)) return null;

      const pseudoOrder = storyItem.classList.contains('read')
        ? ['::before', '::after']
        : ['::after', '::before'];
      for (const pseudo of pseudoOrder) {
        const ringRect = pseudoRingRect(slot, pseudo, win);
        if (!ringRect || !pointInRingBand(x, y, ringRect)) continue;
        if (ringRect.border <= 0 && !ringRect.hasGradient) continue;
        return inspectSkylightRing(slot, win, doc, ringRect, storyItem, pseudo);
      }

      const ringImg = slot.querySelector('.skylight-ring, .skylight-create-ring');
      if (ringImg) {
        const cs = win.getComputedStyle(ringImg);
        if (cs.display !== 'none' && cs.visibility !== 'hidden') {
          const rect = ringImg.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dist = Math.hypot(x - cx, y - cy);
          const outerR = rect.width / 2;
          const avatar = slot.querySelector('.skylight-avatar, .skylight-create-photo');
          const innerR = avatar
            ? Math.min(avatar.getBoundingClientRect().width, avatar.getBoundingClientRect().height) / 2
            : outerR - 6;
          if (dist >= innerR - 1.5 && dist <= outerR + 2 || (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)) {
            const inspected = inspectElement(ringImg, win, doc);
            inspected.name = ringComponentName(storyItem, 'img');
            return inspected;
          }
        }
      }
      return null;
    }

    function pointerDistanceToRect(x, y, rect) {
      const cx = Math.max(rect.left, Math.min(x, rect.right));
      const cy = Math.max(rect.top, Math.min(y, rect.bottom));
      return Math.hypot(x - cx, y - cy);
    }

    function snapSlopForTarget(el, win) {
      const parent = el.parentElement;
      if (!parent) return 20;
      const pcs = win.getComputedStyle(parent);
      const pad = Math.max(
        parseFloat(pcs.paddingTop) || 0,
        parseFloat(pcs.paddingRight) || 0,
        parseFloat(pcs.paddingBottom) || 0,
        parseFloat(pcs.paddingLeft) || 0,
        parseFloat(pcs.rowGap || pcs.gap || '0') || 0,
        parseFloat(pcs.columnGap || pcs.gap || '0') || 0,
      );
      return Math.max(20, pad + 6);
    }

    function findNearestMeasureTarget(localX, localY, doc, win) {
      const nodes = doc.querySelectorAll(MEASURE_TARGET_SELECTOR);
      let best = null;
      let bestDist = Infinity;
      let bestArea = Infinity;
      nodes.forEach((el) => {
        if (!isInspectable(el, win) || isOversizedLayout(el, doc, win)) return;
        if (!isExposedAtCenter(el, doc, win)) return;
        const rect = el.getBoundingClientRect();
        const slop = snapSlopForTarget(el, win);
        if (
          localX < rect.left - slop
          || localX > rect.right + slop
          || localY < rect.top - slop
          || localY > rect.bottom + slop
        ) return;
        const dist = pointerDistanceToRect(localX, localY, rect);
        const area = elementArea(el);
        if (dist < bestDist - 0.5 || (Math.abs(dist - bestDist) <= 0.5 && area < bestArea)) {
          bestDist = dist;
          bestArea = area;
          best = el;
        }
      });
      return best;
    }

    function pickElement(localX, localY, doc, win) {
      const ringPick = tryPickSkylightRing(localX, localY, doc, win);
      if (ringPick) return ringPick;

      const rawStack = (doc.elementsFromPoint
        ? doc.elementsFromPoint(localX, localY)
        : [doc.elementFromPoint(localX, localY)]
      ).filter((el) => isInspectable(el, win)
        && isExposedAtPoint(el, localX, localY, doc, win)
        && !isOversizedLayout(el, doc, win));

      const picked = pickFromStack(rawStack, win, doc);
      if (picked) return inspectElement(picked, win, doc);

      const normalized = rawStack.map((el) => normalizeMeasureTarget(el, win)).filter(Boolean);
      const fallback = pickFromStack(normalized, win, doc);
      if (fallback) return inspectElement(fallback, win, doc);

      const nearest = findNearestMeasureTarget(localX, localY, doc, win);
      return nearest ? inspectElement(nearest, win, doc) : null;
    }

    function toScreenRectFromIframe(r) {
      const rect = els.frame.getBoundingClientRect();
      const sx = rect.width / Math.max(1, FRAME_W);
      const sy = rect.height / Math.max(1, FRAME_H);
      return {
        left: rect.left + r.left * sx,
        top: rect.top + r.top * sy,
        width: r.width * sx,
        height: r.height * sy,
      };
    }

    function dp(value) {
      const n = Number(value);
      return Number.isFinite(n) ? Math.round(n) : 0;
    }

    function parsePx(value) {
      return dp(parseFloat(value) || 0);
    }

    function readableColor(raw) {
      if (!raw || raw === 'transparent' || raw === 'rgba(0, 0, 0, 0)') return null;
      return raw;
    }

    function expandShortHex(hex) {
      const h = hex.replace('#', '');
      if (h.length === 3) {
        return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toUpperCase();
      }
      if (h.length === 4) {
        return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`.toUpperCase();
      }
      return `#${h.slice(0, 6)}${h.length > 6 ? h.slice(6, 8) : ''}`.toUpperCase();
    }

    function rgbaToHex(r, g, b, a = 255) {
      const to2 = (n) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
      const rgb = `#${to2(r)}${to2(g)}${to2(b)}`;
      if (a >= 255) return rgb;
      return `${rgb}${to2(a)}`;
    }

    function parseCssColor(input) {
      if (!input) return null;
      const trimmed = input.trim();
      if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) {
        const hex = expandShortHex(trimmed);
        const body = hex.slice(1);
        const r = parseInt(body.slice(0, 2), 16);
        const g = parseInt(body.slice(2, 4), 16);
        const b = parseInt(body.slice(4, 6), 16);
        const a = body.length > 6 ? parseInt(body.slice(6, 8), 16) / 255 : 1;
        return { r, g, b, a };
      }
      const probe = document.createElement('span');
      probe.style.color = trimmed;
      document.documentElement.appendChild(probe);
      const computed = getComputedStyle(probe).color;
      probe.remove();
      const m = computed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
      if (!m) return null;
      return {
        r: Number(m[1]),
        g: Number(m[2]),
        b: Number(m[3]),
        a: m[4] !== undefined ? Number(m[4]) : 1,
      };
    }

    function cssColorToHex(raw) {
      if (!raw) return null;
      const rgba = parseCssColor(raw);
      if (!rgba) return null;
      return rgbaToHex(rgba.r, rgba.g, rgba.b, Math.round(rgba.a * 255));
    }

    function extractColorsFromCssValue(value) {
      if (!value || value === 'none') return [];
      const hexes = [];
      const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
      let match;
      while ((match = hexRe.exec(value))) {
        const hex = cssColorToHex(match[0]);
        if (hex) hexes.push(hex);
      }
      const rgbRe = /rgba?\([^)]+\)|hsla?\([^)]+\)/g;
      while ((match = rgbRe.exec(value))) {
        const hex = cssColorToHex(match[0]);
        if (hex) hexes.push(hex);
      }
      return [...new Set(hexes)];
    }

    function sampleImgColor(img) {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) return null;
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, Math.floor(w / 2), Math.floor(h / 2), 1, 1, 0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        if (a === 0) return null;
        return rgbaToHex(r, g, b, a);
      } catch (_) {
        return null;
      }
    }

    function strokeDp(value) {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return 0;
      if (n < 1) return Math.round(n * 10) / 10;
      return Math.round(n);
    }

    function parseInsetBoxShadow(boxShadow) {
      if (!boxShadow || boxShadow === 'none') return null;
      const layers = boxShadow.split(/,(?![^(]*\))/).map((layer) => layer.trim());
      for (const layer of layers) {
        if (!/\binset\b/i.test(layer)) continue;
        const colorMatch = layer.match(/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})\s*$/i);
        const nums = layer.match(/-?[\d.]+px/g);
        if (!colorMatch || !nums || nums.length < 4) continue;
        const width = parseFloat(nums[3]);
        const color = colorMatch[1].trim();
        if (width > 0 && readableColor(color)) {
          return { width, color };
        }
      }
      return null;
    }

    function strokeFromBorder(cs) {
      const sides = ['Top', 'Right', 'Bottom', 'Left'];
      const widths = sides.map((s) => parseFloat(cs[`border${s}Width`]) || 0);
      const colors = sides.map((s) => readableColor(cs[`border${s}Color`]));
      if (!widths.some((w) => w > 0)) return null;
      const uniqW = [...new Set(widths.map((w) => strokeDp(w)))];
      const uniqC = [...new Set(colors.filter(Boolean))];
      return {
        t: widths[0],
        r: widths[1],
        b: widths[2],
        l: widths[3],
        color: uniqC.length === 1 ? uniqC[0] : colors.find(Boolean) || colors[0],
        uniform: uniqW.length === 1,
      };
    }

    function detectStroke(el, win) {
      const cs = win.getComputedStyle(el);
      const borderStroke = strokeFromBorder(cs);
      if (borderStroke) return borderStroke;

      const outlineWidth = parseFloat(cs.outlineWidth) || 0;
      const outlineColor = readableColor(cs.outlineColor);
      if (outlineWidth > 0 && outlineColor) {
        return {
          t: outlineWidth,
          r: outlineWidth,
          b: outlineWidth,
          l: outlineWidth,
          color: outlineColor,
          uniform: true,
        };
      }

      const selfShadow = parseInsetBoxShadow(cs.boxShadow);
      if (selfShadow) {
        return {
          t: selfShadow.width,
          r: selfShadow.width,
          b: selfShadow.width,
          l: selfShadow.width,
          color: selfShadow.color,
          uniform: true,
        };
      }

      for (const pseudo of ['::after', '::before']) {
        const ps = win.getComputedStyle(el, pseudo);
        if (ps.content === 'none') continue;
        const shadow = parseInsetBoxShadow(ps.boxShadow);
        if (shadow) {
          return {
            t: shadow.width,
            r: shadow.width,
            b: shadow.width,
            l: shadow.width,
            color: shadow.color,
            uniform: true,
          };
        }
        const pseudoBorder = strokeFromBorder(ps);
        if (pseudoBorder) return pseudoBorder;
      }
      return null;
    }

    function hasDirectText(el) {
      return [...el.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
      );
    }

    function isTextualElement(el, win) {
      if (!el || el.tagName === 'IMG') return false;
      if (el.tagName === 'BUTTON' && el.querySelector(':scope > img') && !el.textContent.trim()) return false;
      const textTags = new Set(['SPAN', 'P', 'LABEL', 'A', 'BUTTON']);
      if (textTags.has(el.tagName) && el.textContent.trim()) return true;
      if (hasDirectText(el)) return true;
      if (el.querySelector(':scope > span, :scope > p, :scope > label')) {
        const cs = win.getComputedStyle(el);
        if (cs.display !== 'none' && el.textContent.trim()) return true;
      }
      return false;
    }

    function textMeasureTarget(el, win) {
      if (!isTextualElement(el, win)) return null;
      return (
        el.querySelector(':scope > span, :scope > p, :scope > label')
        || (hasDirectText(el) ? el : null)
        || el
      );
    }

    function elementComponentName(el) {
      if (el.classList.contains('skylight-ring')) {
        const story = el.closest('[data-story-label]')?.dataset.storyLabel;
        return story ? `Story · ${story} 头像环` : 'Story · 头像环';
      }
      if (el.classList.contains('skylight-avatar')) {
        const story = el.closest('[data-story-label]')?.dataset.storyLabel;
        return story ? `Story · ${story} 头像` : 'Story · 头像';
      }
      if (el.classList.contains('skylight-label')) {
        return `Story · ${el.textContent.trim()} 标签`;
      }
      if (el.classList.contains('skylight-avatar-slot')) {
        if (el.closest('[data-skylight-action="create"]')) return 'Create · 头像区';
        const story = el.closest('[data-story-label]')?.dataset.storyLabel;
        return story ? `Story · ${story} 头像区` : 'Story · 头像区';
      }
      if (el.classList.contains('skylight-create-ring')) return 'Create · 头像环';
      if (el.classList.contains('skylight-create-photo')) return 'Create · 头像图';
      if (el.classList.contains('skylight-plus-badge')) return 'Create · 加号';
      if (el.dataset.name) return el.dataset.name;
      const named = el.closest('[data-name]');
      if (named?.dataset.name && named !== el) return named.dataset.name;
      if (el.dataset.storyLabel) return `Story · ${el.dataset.storyLabel}`;
      if (el.dataset.feedNav) return `Nav · ${el.dataset.feedNav}`;
      if (el.dataset.skylightAction) return `Skylight · ${el.dataset.skylightAction}`;
      if (el.dataset.desktopApp) return `App · ${el.dataset.desktopApp}`;
      if (el.dataset.figma) return `Figma ${el.dataset.figma}`;
      if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
      const classes = [...el.classList].filter((c) => !c.startsWith('is-') && c !== 'active' && c !== 'visible');
      if (classes.length) return classes.slice(0, 2).join(' · ');
      return el.tagName.toLowerCase();
    }

    function elementTypography(el, win) {
      const target = textMeasureTarget(el, win);
      if (!target) return null;
      const cs = win.getComputedStyle(target);
      if (global.TuxTypographyResolver) {
        const fromSelf = TuxTypographyResolver.describeElement(target, cs);
        if (fromSelf) return fromSelf;
      }
      const size = dp(parseFloat(cs.fontSize));
      const weight = cs.fontWeight;
      return { label: `${size} · ${weight}`, token: '' };
    }

    function elementTextColor(el, win) {
      const target = textMeasureTarget(el, win);
      if (!target) return null;
      return readableColor(win.getComputedStyle(target).color);
    }

    function elementHasCoverImage(el, win) {
      if (el.tagName === 'IMG') return true;
      const img = el.querySelector(':scope > img');
      if (!img || !isInspectable(img, win)) return false;
      const ir = img.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      return ir.width >= er.width * 0.85 && ir.height >= er.height * 0.85;
    }

    function elementFill(el, win) {
      const cs = win.getComputedStyle(el);
      if (el.tagName === 'IMG' || elementHasCoverImage(el, win)) {
        const img = el.tagName === 'IMG' ? el : el.querySelector(':scope > img');
        const sampled = img ? sampleImgColor(img) : null;
        if (sampled) return sampled;
      }
      const bgImage = cs.backgroundImage;
      if (bgImage && bgImage !== 'none') {
        if (/gradient/i.test(bgImage)) {
          const hexes = extractColorsFromCssValue(bgImage);
          if (hexes.length) return hexes.join(' · ');
        }
      }
      return readableColor(cs.backgroundColor);
    }

    function formatMeasureColor(raw) {
      if (!raw) return null;
      if (typeof raw === 'string' && raw.includes(' · ') && raw.trim().startsWith('#')) {
        const first = raw.split(' · ')[0];
        return { swatch: first, label: raw, token: '' };
      }
      const hex = cssColorToHex(raw);
      if (!hex) return null;
      const token = global.TuxColorResolver?.describe(raw)?.token || '';
      return { swatch: raw, label: hex, token };
    }

    function colorMeasureRow(label, raw) {
      const info = formatMeasureColor(raw);
      if (!info) return '';
      const title = info.token ? ` title="${info.token}"` : '';
      return `<div class="measure-row"><span>${label}</span><strong${title}><span class="measure-swatch" style="background:${info.swatch}"></span><span class="measure-color-label">${info.label}</span></strong></div>`;
    }

    function strokeMeasureRow(stroke) {
      if (!stroke) return '';
      const info = formatMeasureColor(stroke.color);
      if (!info) return '';
      const widthHtml = stroke.uniform
        ? `${strokeDp(stroke.t)} dp`
        : `<span class="measure-box-sides"><span>↑${strokeDp(stroke.t)}</span><span>→${strokeDp(stroke.r)}</span><span>↓${strokeDp(stroke.b)}</span><span>←${strokeDp(stroke.l)}</span></span>`;
      const title = info.token ? ` title="${info.token}"` : '';
      return `<div class="measure-row"><span>描边</span><strong${title}>${widthHtml}<span class="measure-stroke-sep">·</span><span class="measure-swatch" style="background:${info.swatch}"></span><span class="measure-color-label">${info.label}</span></strong></div>`;
    }

    function typographyMeasureRow(info) {
      if (!info?.label) return '';
      const title = info.token ? ` title="${info.token}"` : '';
      return `<div class="measure-row"><span>字号字重</span><strong${title}>${info.label}</strong></div>`;
    }

    function formatBoxSides(t, r, b, l) {
      return `<span class="measure-box-sides"><span>↑${dp(t)}</span><span>→${dp(r)}</span><span>↓${dp(b)}</span><span>←${dp(l)}</span></span>`;
    }

    function boxMeasureRow(label, t, r, b, l) {
      return `<div class="measure-row"><span>${label}</span><strong>${formatBoxSides(t, r, b, l)}</strong></div>`;
    }

    function hasBoxSides(box) {
      return box.t > 0 || box.r > 0 || box.b > 0 || box.l > 0;
    }

    function isSpacingReference(el, win, self, doc) {
      if (!el || el === self) return false;
      if (self.contains(el) || el.contains(self)) return false;
      if (SKIP_TAGS.has(el.tagName)) return false;
      if (el.classList?.contains('phone')) return false;
      if (isLayoutShell(el)) return false;
      if (!isInspectable(el, win)) return false;
      if (doc && !isExposedAtCenter(el, doc, win)) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 1 && r.height >= 1;
    }

    function spacingReferences(doc, win, self) {
      const seen = new Set();
      const list = [];
      function add(el) {
        if (!el || seen.has(el)) return;
        if (!isSpacingReference(el, win, self, doc)) return;
        seen.add(el);
        list.push(el);
      }
      doc.querySelectorAll(SPACING_REFERENCE_SELECTOR).forEach(add);
      let node = self.parentElement;
      while (node && !node.classList?.contains('phone')) {
        [...node.children].forEach((child) => add(child));
        node = node.parentElement;
      }
      return list;
    }

    function overlapSize(a1, a2, b1, b2) {
      return Math.min(a2, b2) - Math.max(a1, b1);
    }

    function overlapRatio(a1, a2, b1, b2) {
      const overlap = overlapSize(a1, a2, b1, b2);
      const span = Math.max(1, Math.min(a2 - a1, b2 - b1));
      return overlap / span;
    }

    function computeAroundSpacing(el, win, doc) {
      const rect = el.getBoundingClientRect();
      const sides = { t: Infinity, r: Infinity, b: Infinity, l: Infinity };
      const guides = { t: null, r: null, b: null, l: null };
      const eps = 0.5;
      const minOverlap = 0.2;

      function apply(side, distance, guide) {
        if (!Number.isFinite(distance) || distance < 0) return;
        if (distance < sides[side]) {
          sides[side] = distance;
          guides[side] = guide;
        }
      }

      spacingReferences(doc, win, el).forEach((other) => {
        const sr = other.getBoundingClientRect();
        const vOverlap = overlapRatio(rect.top, rect.bottom, sr.top, sr.bottom);
        const hOverlap = overlapRatio(rect.left, rect.right, sr.left, sr.right);

        if (vOverlap >= minOverlap && sr.right <= rect.left + eps) {
          const gapW = rect.left - sr.right;
          apply('l', gapW, {
            left: sr.right,
            top: Math.max(rect.top, sr.top),
            width: gapW,
            height: overlapSize(rect.top, rect.bottom, sr.top, sr.bottom),
          });
        }
        if (vOverlap >= minOverlap && sr.left >= rect.right - eps) {
          const gapW = sr.left - rect.right;
          apply('r', gapW, {
            left: rect.right,
            top: Math.max(rect.top, sr.top),
            width: gapW,
            height: overlapSize(rect.top, rect.bottom, sr.top, sr.bottom),
          });
        }
        if (hOverlap >= minOverlap && sr.bottom <= rect.top + eps) {
          const gapH = rect.top - sr.bottom;
          apply('t', gapH, {
            left: Math.max(rect.left, sr.left),
            top: sr.bottom,
            width: overlapSize(rect.left, rect.right, sr.left, sr.right),
            height: gapH,
          });
        }
        if (hOverlap >= minOverlap && sr.top >= rect.bottom - eps) {
          const gapH = sr.top - rect.bottom;
          apply('b', gapH, {
            left: Math.max(rect.left, sr.left),
            top: rect.bottom,
            width: overlapSize(rect.left, rect.right, sr.left, sr.right),
            height: gapH,
          });
        }
      });

      return {
        spacing: {
          t: sides.t === Infinity ? 0 : dp(sides.t),
          r: sides.r === Infinity ? 0 : dp(sides.r),
          b: sides.b === Infinity ? 0 : dp(sides.b),
          l: sides.l === Infinity ? 0 : dp(sides.l),
        },
        guides,
      };
    }

    function renderSpacingGuides(guides, spacing) {
      const root = els.measureSpacingGuides;
      if (!root) return;
      root.innerHTML = '';
      const sideLabels = { t: '↑', r: '→', b: '↓', l: '←' };
      ['t', 'r', 'b', 'l'].forEach((side) => {
        const value = spacing[side];
        const guide = guides[side];
        if (!guide || value <= 0) return;
        const sr = toScreenRectFromIframe(guide);
        const div = document.createElement('div');
        div.className = 'measure-spacing-guide';
        div.dataset.label = `${sideLabels[side]}${value}`;
        div.style.left = `${sr.left}px`;
        div.style.top = `${sr.top}px`;
        div.style.width = `${Math.max(sr.width, 2)}px`;
        div.style.height = `${Math.max(sr.height, 2)}px`;
        root.appendChild(div);
      });
    }

    function inspectElement(el, win, doc) {
      const typography = elementTypography(el, win);
      const color = elementTextColor(el, win);
      const fill = elementFill(el, win);
      const stroke = detectStroke(el, win);
      const { spacing, guides } = computeAroundSpacing(el, win, doc);
      return {
        el,
        name: elementComponentName(el),
        typography,
        color,
        fill,
        stroke,
        w: el.offsetWidth,
        h: el.offsetHeight,
        spacing,
        spacingGuides: guides,
      };
    }

    function hideMeasureUi() {
      if (els.measureHighlight) els.measureHighlight.style.display = 'none';
      if (els.measureGapHighlight) els.measureGapHighlight.style.display = 'none';
      if (els.measureSpacingGuides) els.measureSpacingGuides.innerHTML = '';
      if (els.measurePanel) els.measurePanel.hidden = true;
    }

    function positionPanel(targetRect) {
      const panel = els.measurePanel;
      const phoneRect = els.phoneWrap.getBoundingClientRect();
      panel.hidden = false;
      const pw = panel.offsetWidth || 160;
      const ph = panel.offsetHeight || 80;
      let left = phoneRect.right + 12;
      if (left + pw > window.innerWidth - 8) left = phoneRect.left - pw - 12;
      let top = targetRect.top + targetRect.height / 2 - ph / 2;
      top = Math.max(phoneRect.top + 8, Math.min(top, phoneRect.bottom - ph - 8));
      top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));
      panel.style.left = `${Math.max(8, left)}px`;
      panel.style.top = `${top}px`;
    }

    function showElementMeasure(data) {
      const iframeRect = data.highlightRect || data.el.getBoundingClientRect();
      const sr = toScreenRectFromIframe(iframeRect);
      if (els.measureGapHighlight) els.measureGapHighlight.style.display = 'none';
      if (els.measureHighlight) {
        els.measureHighlight.style.display = 'block';
        els.measureHighlight.style.left = `${sr.left}px`;
        els.measureHighlight.style.top = `${sr.top}px`;
        els.measureHighlight.style.width = `${sr.width}px`;
        els.measureHighlight.style.height = `${sr.height}px`;
      }

      const rows = [
        `<div class="measure-row"><span>尺寸</span><strong>${dp(data.w)} × ${dp(data.h)} dp</strong></div>`,
        `<div class="measure-row"><span>名称</span><strong>${data.name}</strong></div>`,
      ];
      if (data.typography) rows.push(typographyMeasureRow(data.typography));
      if (data.color) rows.push(colorMeasureRow('颜色', data.color));
      else if (data.fill) rows.push(colorMeasureRow('颜色', data.fill));
      const strokeRow = strokeMeasureRow(data.stroke);
      if (strokeRow) rows.push(strokeRow);
      if (hasBoxSides(data.spacing)) {
        rows.push(boxMeasureRow('相邻间距', data.spacing.t, data.spacing.r, data.spacing.b, data.spacing.l));
      }
      renderSpacingGuides(data.spacingGuides, data.spacing);
      els.measurePanel.innerHTML = rows.join('');
      els.measurePanel.hidden = false;
      positionPanel(sr);
    }

    function handlePointer(clientX, clientY) {
      const point = framePointFromClient(clientX, clientY);
      if (!point) {
        hideMeasureUi();
        return;
      }
      let doc;
      let win;
      try {
        doc = els.frame.contentDocument;
        win = els.frame.contentWindow;
      } catch (_) {
        hideMeasureUi();
        return;
      }
      if (!doc || !win) {
        hideMeasureUi();
        return;
      }
      const data = pickElement(point.x, point.y, doc, win);
      if (!data) {
        hideMeasureUi();
        return;
      }
      showElementMeasure(data);
    }

    function bindPhone() {
      if (onPhoneMove) return;
      onPhoneMove = (e) => {
        if (!active) return;
        handlePointer(e.clientX, e.clientY);
      };
      els.phoneWrap.addEventListener('pointermove', onPhoneMove, { passive: true });
      els.phoneWrap.addEventListener('pointerleave', hideMeasureUi, { passive: true });
    }

    function unbindPhone() {
      if (!onPhoneMove) return;
      els.phoneWrap.removeEventListener('pointermove', onPhoneMove);
      els.phoneWrap.removeEventListener('pointerleave', hideMeasureUi);
      onPhoneMove = null;
    }

    function setActive(on) {
      active = on;
      els.measureBtn.classList.toggle('is-active', on);
      els.measureBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      document.body.classList.toggle('measure-mode', on);
      if (typeof onModeChange === 'function') onModeChange(on);
      if (!on) {
        unbindPhone();
        hideMeasureUi();
        return;
      }
      bindPhone();
    }

    els.measureBtn.addEventListener('click', () => setActive(!active));
    els.frame.addEventListener('load', () => {
      if (!active) hideMeasureUi();
    });

    return { isActive: () => active, setActive };
  }

  global.setupSkylightMeasureTool = setupSkylightMeasureTool;
})(window);
