// ==UserScript==
// @name         Native Video Fullscreen
// @namespace    https://github.com/Laynholt/native-video-fullscreen
// @version      1.0.0
// @description  Открывает видео в системном полноэкранном плеере iPhone.
// @match        *://*/*
// @run-at       document-end
// @grant        none
// @inject-into  content
// @icon         https://raw.githubusercontent.com/Laynholt/native-video-fullscreen/main/assets/icon.png
// @homepageURL  https://github.com/Laynholt/native-video-fullscreen
// @updateURL    https://github.com/Laynholt/native-video-fullscreen/releases/latest/download/native-video-fullscreen.meta.js
// @downloadURL  https://github.com/Laynholt/native-video-fullscreen/releases/latest/download/native-video-fullscreen.user.js
// ==/UserScript==

(() => {
  'use strict';

  if (typeof HTMLVideoElement.prototype.webkitEnterFullscreen !== 'function') return;
  if (document.querySelector('native-video-fullscreen')) return;

  const host = document.createElement('native-video-fullscreen');
  host.style.cssText = 'display:none;position:fixed;z-index:2147483647;margin:0;padding:0;border:0';
  const shadow = host.attachShadow({ mode: 'open' });
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '⛶';
  button.setAttribute('aria-label', 'На весь экран iPhone');
  button.title = button.getAttribute('aria-label');
  button.style.cssText = [
    'all:revert', 'appearance:none', 'display:grid', 'place-items:center',
    'width:44px', 'height:44px', 'margin:0', 'padding:0', 'box-sizing:border-box',
    'border:1px solid #ffffff70', 'border-radius:12px', 'background:#161923db',
    'color:white', 'font:28px/1 system-ui', 'cursor:pointer', 'touch-action:manipulation',
  ].join(';');
  shadow.append(button);
  document.documentElement.append(host);

  const visible = new Set();
  let selected = null;
  let pending = false;
  let errorTimer;
  const intersection = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting && target.isConnected) visible.add(target);
      else visible.delete(target);
    }
    refresh();
  });
  const resize = new ResizeObserver(refresh);

  // shortcut: scans document videos only, add shadow-root discovery for sites that need it.
  function track(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const videos = node.matches('video') ? [node] : node.querySelectorAll('video');
    for (const video of videos) {
      if (video.isConnected) {
        intersection.observe(video);
        resize.observe(video);
      } else {
        intersection.unobserve(video);
        resize.unobserve(video);
        visible.delete(video);
      }
    }
  }

  function refresh() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      selected = null;
      let largestArea = 0;
      let position;
      for (const video of visible) {
        if (!video.isConnected || !video.videoWidth || !video.webkitSupportsFullscreen ||
            video.webkitDisplayingFullscreen || getComputedStyle(video).visibility !== 'visible') continue;

        const rect = video.getBoundingClientRect();
        const left = Math.max(rect.left, 0);
        const right = Math.min(rect.right, document.documentElement.clientWidth);
        const top = Math.max(rect.top, 0);
        const bottom = Math.min(rect.bottom, document.documentElement.clientHeight);
        if (right - left < 96 || bottom - top < 64) continue;

        const area = (right - left) * (bottom - top);
        if (selected && (selected.paused === video.paused
          ? largestArea >= area
          : video.paused)) continue;

        selected = video;
        largestArea = area;
        position = { left: right - 52, top: top + 8 };
      }

      host.style.display = selected ? 'block' : 'none';
      if (position) {
        host.style.left = position.left + 'px';
        host.style.top = position.top + 'px';
      }
    });
  }

  button.addEventListener('click', (event) => {
    if (!event.isTrusted || !selected?.isConnected) return;
    event.stopPropagation();
    try {
      selected.webkitEnterFullscreen();
    } catch {
      button.textContent = '!';
      button.setAttribute('aria-label', 'Не удалось открыть видео на весь экран');
      clearTimeout(errorTimer);
      errorTimer = setTimeout(() => {
        button.textContent = '⛶';
        button.setAttribute('aria-label', button.title);
      }, 2000);
    }
  });

  track(document.documentElement);
  new MutationObserver((records) => {
    for (const { addedNodes, removedNodes } of records) {
      for (const node of removedNodes) track(node);
      for (const node of addedNodes) track(node);
    }
    refresh();
  }).observe(document.documentElement, { childList: true, subtree: true });

  for (const type of ['loadedmetadata', 'emptied', 'play', 'pause', 'ended',
    'webkitbeginfullscreen', 'webkitendfullscreen', 'scroll']) {
    document.addEventListener(type, refresh, { capture: true, passive: true });
  }
  window.addEventListener('resize', refresh);
})();
