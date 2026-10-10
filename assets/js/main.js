/* Punarjan growth plan — vanilla JS, no dependencies */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const behavior = () => (reduced.matches ? "auto" : "smooth");
  const body = document.body;
  const present = () => body.classList.contains("present");

  const scenes = $$(".scene");
  const dots = $("#dots");
  const dotLinks = $$("a", dots);

  /* ---------- reveal on scroll ---------- */
  $$("[data-stagger]").forEach((p) => $$(".rv", p).forEach((el, i) => el.style.setProperty("--i", i)));
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }),
    { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
  );
  $$(".rv, #journey, #phases, #budget").forEach((el) => io.observe(el));

  /* ---------- scene tracking: nav dots + progress ---------- */
  let current = 0;
  const setCurrent = (i) => {
    current = i;
    dotLinks.forEach((a, n) => (n === i ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
    dots.classList.toggle("on-dark", scenes[i].classList.contains("dark"));
  };
  const sio = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (!present() && e.isIntersecting) setCurrent(scenes.indexOf(e.target)); }),
    { rootMargin: "-45% 0px -45% 0px" }
  );
  scenes.forEach((s) => sio.observe(s));

  const bar = $("#bar");
  const setBar = (f) => (bar.style.transform = `scaleX(${Math.max(0, Math.min(1, f))})`);
  let ticking = false;
  const onScroll = () => {
    if (ticking || present()) return;
    ticking = true;
    requestAnimationFrame(() => {
      const h = document.documentElement.scrollHeight - innerHeight;
      setBar(h > 0 ? scrollY / h : 0);
      ticking = false;
    });
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- improvements accordion + index ---------- */
  const imps = $$(".imp");
  const toggle = (imp, open) => {
    const b = $(".trigger", imp);
    const on = open ?? b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", on);
    imp.classList.toggle("open", on);
  };
  imps.forEach((imp) => $(".trigger", imp).addEventListener("click", () => { if (!present()) toggle(imp); }));
  const idxLinks = $$(".index a");
  const markIndex = (n) => idxLinks.forEach((a, i) => (i === n ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
  idxLinks.forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    if (present()) return;
    const imp = $(a.getAttribute("href"));
    toggle(imp, true);
    imp.scrollIntoView({ behavior: behavior(), block: "center" });
  }));
  const iio = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting && !present()) markIndex(imps.indexOf(e.target)); }),
    { rootMargin: "-40% 0px -50% 0px" }
  );
  imps.forEach((i) => iio.observe(i));
  markIndex(0);

  /* ---------- budget donut ---------- */
  const budget = $("#budget");
  const segs = $$(".seg", budget);
  const C = 2 * Math.PI * 70;
  const drawDonut = (stagger = 180) => segs.forEach((s, i) => setTimeout(() => s.setAttribute("stroke-dasharray", `${s.dataset.len} ${C - s.dataset.len}`), reduced.matches ? 0 : i * stagger));
  const resetDonut = () => segs.forEach((s) => s.setAttribute("stroke-dasharray", `0 ${C}`));
  if (reduced.matches) drawDonut();
  else new IntersectionObserver((es, o) => es.forEach((e) => { if (e.isIntersecting && !present()) { drawDonut(); o.disconnect(); } }), { threshold: 0.4 }).observe(budget);
  $$(".legend li", budget).forEach((li) => {
    const seg = segs[li.dataset.seg];
    li.addEventListener("mouseenter", () => { li.classList.add("hi"); seg.classList.add("hi"); });
    li.addEventListener("mouseleave", () => { li.classList.remove("hi"); seg.classList.remove("hi"); });
  });

  /* ---------- compliance: reveal slider ---------- */
  const slider = $("#reveal");
  const tabs = $$("[role=tab]", $("#pairs"));
  const panels = $$(".phrase");
  const tagR = $("#tagR"), tagS = $("#tagS");
  const activePanel = () => panels.find((p) => !p.hidden);
  const setP = (v) => {
    const p = v / 100;
    const el = activePanel();
    el.style.setProperty("--p", p);
    el.removeAttribute("data-state");
    tagR.dataset.on = p < 0.5; tagS.dataset.on = p >= 0.5;
    slider.value = v;
    slider.setAttribute("aria-valuetext", p >= 0.5 ? "Showing the safer phrase" : "Showing the risky phrase");
    $(".safe", el).setAttribute("aria-hidden", p < 0.5);
    $(".risky", el).setAttribute("aria-hidden", p >= 0.5);
  };
  let anim, autoT, lastPointer = false;
  const glide = (to) => {
    cancelAnimationFrame(anim);
    const from = +slider.value;
    if (reduced.matches) return setP(to);
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 450), e = 1 - Math.pow(1 - k, 3);
      setP(Math.round(from + (to - from) * e));
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  };
  slider.addEventListener("input", () => { clearTimeout(autoT); cancelAnimationFrame(anim); setP(+slider.value); });
  slider.addEventListener("change", () => {
    glide(+slider.value >= 50 ? 100 : 0);
    if (present() && lastPointer) slider.blur();
  });
  panels.forEach((p) => p.addEventListener("click", () => { clearTimeout(autoT); glide(+slider.value >= 50 ? 0 : 100); }));
  const selectTab = (n, focus) => {
    tabs.forEach((t, i) => { t.setAttribute("aria-selected", i === n); t.tabIndex = i === n ? 0 : -1; panels[i].hidden = i !== n; });
    setP(0);
    if (focus) tabs[n].focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => {
      clearTimeout(autoT);
      if (present()) { t.blur(); goStep(i + 1); } else selectTab(i);
    });
    t.addEventListener("keydown", (e) => {
      const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (k) { e.preventDefault(); clearTimeout(autoT); selectTab((i + k + tabs.length) % tabs.length, true); }
    });
  });
  addEventListener("pointerdown", () => (lastPointer = true), { capture: true });
  addEventListener("keydown", () => (lastPointer = false), { capture: true });
  // normal (scrolling) mode: the slider glides to "safer" once when the scene comes into view
  if (!reduced.matches) {
    new IntersectionObserver((es, o) => es.forEach((e) => {
      if (e.isIntersecting && !present()) {
        o.disconnect();
        autoT = setTimeout(() => { if (+slider.value === 0 && !present()) glide(100); }, 1000);
      }
    }), { threshold: 0.6 }).observe($("#stage"));
  }

  /* ---------- poster gallery ---------- */
  const track = $("#track"), gPrev = $("#gPrev"), gNext = $("#gNext");
  const gUpdate = () => {
    const max = track.scrollWidth - track.clientWidth;
    gPrev.parentElement.hidden = max <= 4;
    gPrev.disabled = track.scrollLeft <= 4;
    gNext.disabled = track.scrollLeft >= max - 4;
  };
  const gStep = (d) => track.scrollBy({ left: d * Math.max(track.clientWidth * 0.8, 200), behavior: behavior() });
  gPrev.addEventListener("click", () => gStep(-1));
  gNext.addEventListener("click", () => gStep(1));
  track.addEventListener("scroll", gUpdate, { passive: true });
  addEventListener("resize", gUpdate);
  gUpdate();

  /* ---------- lightbox (native <dialog>: focus trap + Esc) ---------- */
  const lb = $("#lb"), lbImg = $("#lbImg"), lbSrc = $("#lbSrc"), lbCap = $("#lbCap"), lbCount = $("#lbCount");
  const openers = $$("button.open");
  let li = 0, opener = null;
  const show = (i) => {
    li = (i + openers.length) % openers.length;
    const d = openers[li].dataset;
    lbSrc.srcset = `${d.full}.webp`;
    lbImg.src = `${d.full}.jpg`;
    lbImg.alt = d.alt;
    lbCap.innerHTML = "";
    const b = document.createElement("b"); b.textContent = d.title;
    lbCap.append(b, `${d.sub}. Concept creative, draft for medical and legal review.`);
    lbCount.textContent = `${li + 1} of ${openers.length}`;
  };
  openers.forEach((o, i) => o.addEventListener("click", () => { opener = o; show(i); lb.showModal(); $("#lbClose").focus(); }));
  $("#lbClose").addEventListener("click", () => lb.close());
  $("#lbPrev").addEventListener("click", () => show(li - 1));
  $("#lbNext").addEventListener("click", () => show(li + 1));
  lb.addEventListener("close", () => { if (opener) { opener.focus(); if (present()) opener.blur(); } });
  lb.addEventListener("click", (e) => { if (e.target === lb || e.target.classList.contains("frame") || e.target.id === "lbStage") lb.close(); });
  lb.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); show(li - 1); }
    if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); show(li + 1); }
  });
  let sx = 0, sy = 0;
  const lbStage = $("#lbStage");
  lbStage.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  lbStage.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(li + (dx < 0 ? 1 : -1));
  }, { passive: true });

  /* ---------- print: load everything, finish animations ---------- */
  addEventListener("beforeprint", () => {
    $$("img[loading=lazy]").forEach((i) => (i.loading = "eager"));
    $$(".rv").forEach((e) => e.classList.add("in"));
    drawDonut(0);
  });

  /* =====================================================
     Presentation mode
     One scene per screen. Scenes with data-steps reveal
     their [data-step] groups one at a time, so nothing
     ever scrolls inside a slide.
     ===================================================== */
  const presBtn = $("#presBtn"), presLabel = $("#presLabel"), presKey = $("#presKey"), pos = $("#pos");
  let pcur = 0, pstep = 1, idleT, fsActive = false;
  const stepsOf = (s) => +s.dataset.steps || 1;

  const replay = (root) => {
    const els = $$(".rv, #journey, #phases, #budget", root);
    if (root.matches(".rv, #journey, #phases, #budget")) els.push(root);
    els.forEach((e) => e.classList.remove("in"));
    void root.offsetWidth;
    requestAnimationFrame(() => els.forEach((e) => e.classList.add("in")));
  };
  const applySteps = (s) => $$("[data-step]", s).forEach((el) => el.classList.toggle("on", +el.dataset.step === pstep));
  const presNavState = () => {
    $("#pPrev").disabled = pcur === 0 && pstep === 1;
    $("#pNext").disabled = pcur === scenes.length - 1 && pstep === stepsOf(scenes[pcur]);
  };
  const updatePos = () => {
    const n = stepsOf(scenes[pcur]);
    pos.textContent = `${pcur + 1} / ${scenes.length}${n > 1 ? ` · ${pstep}/${n}` : ""}`;
    setBar((pcur + pstep / n) / scenes.length);
    presNavState();
  };
  const stepHooks = (s) => {
    clearTimeout(autoT);
    if (s.id === "structure" && pstep === 1) { resetDonut(); setTimeout(() => drawDonut(90), 80); }
    if (s.id === "improvements") markIndex((pstep - 1) * 3);
    if (s.id === "compliance") {
      selectTab(pstep - 1);
      autoT = setTimeout(() => glide(100), 900);
    }
  };
  const goStep = (n) => {
    const s = scenes[pcur];
    pstep = Math.max(1, Math.min(stepsOf(s), n));
    applySteps(s);
    $$("[data-step].on", s).forEach(replay);
    stepHooks(s);
    updatePos();
  };
  const showScene = (i, step = 1) => {
    pcur = Math.max(0, Math.min(scenes.length - 1, i));
    pstep = step;
    const s = scenes[pcur];
    scenes.forEach((x, n) => x.classList.toggle("cur", n === pcur));
    applySteps(s);
    void s.offsetWidth;
    replay(s);
    setCurrent(pcur);
    stepHooks(s);
    updatePos();
    scrollTo(0, 0);
  };
  const next = () => {
    if (pstep < stepsOf(scenes[pcur])) goStep(pstep + 1);
    else if (pcur < scenes.length - 1) showScene(pcur + 1, 1);
  };
  const prev = () => {
    if (pstep > 1) goStep(pstep - 1);
    else if (pcur > 0) showScene(pcur - 1, stepsOf(scenes[pcur - 1]));
  };

  const wake = () => {
    body.classList.remove("idle");
    clearTimeout(idleT);
    if (present()) idleT = setTimeout(() => body.classList.add("idle"), 2000);
  };
  const setPresent = (on) => {
    if (on === present()) return;
    if (on) {
      if (document.activeElement) document.activeElement.blur();
      $$("img[loading=lazy]").forEach((i) => (i.loading = "eager")); // nothing may pop in mid-talk
      const from = current;
      body.classList.add("present");
      presBtn.setAttribute("aria-pressed", "true");
      presLabel.textContent = "Exit"; presKey.textContent = "Esc";
      showScene(from, 1);
      wake();
      const el = document.documentElement;
      if (el.requestFullscreen && !document.fullscreenElement) {
        el.requestFullscreen({ navigationUI: "hide" }).then(() => (fsActive = true)).catch(() => (fsActive = false));
      }
    } else {
      body.classList.remove("present", "idle", "blank");
      clearTimeout(idleT);
      presBtn.setAttribute("aria-pressed", "false");
      presLabel.textContent = "Present"; presKey.textContent = "F";
      scenes.forEach((x) => x.classList.remove("cur"));
      $$("[data-step]").forEach((x) => x.classList.remove("on"));
      $$(".rv, #journey, #phases, #budget").forEach((e) => e.classList.add("in"));
      drawDonut(0);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      fsActive = false;
      scenes[pcur].scrollIntoView({ behavior: "auto", block: "start" });
      onScroll();
    }
  };
  presBtn.addEventListener("click", () => setPresent(!present()));
  $("#pNext").addEventListener("click", (e) => { next(); e.currentTarget.blur(); });
  $("#pPrev").addEventListener("click", (e) => { prev(); e.currentTarget.blur(); });
  dotLinks.forEach((a, i) => a.addEventListener("click", (e) => { if (present()) { e.preventDefault(); showScene(i, 1); a.blur(); } }));
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && fsActive && present()) setPresent(false); });
  addEventListener("mousemove", () => present() && wake(), { passive: true });
  addEventListener("pointerdown", () => present() && wake(), { passive: true });

  const blank = (on) => body.classList.toggle("blank", on);
  $("#blank").addEventListener("click", () => blank(false));

  addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (body.classList.contains("blank")) { e.preventDefault(); blank(false); return; }
    if (lb.open) return;
    const k = e.key;
    if (k === "f" || k === "F") { e.preventDefault(); setPresent(!present()); return; }
    if (!present()) return;
    wake();
    if (k === "Escape") { setPresent(false); return; }
    if (k === "b" || k === "B" || k === ".") { e.preventDefault(); blank(true); return; }
    // a slider or tab focused by keyboard keeps its own arrow keys
    const ae = document.activeElement;
    if (ae && ae.matches("input[type=range],[role=tab]") && /^(Arrow|Home|End)/.test(k)) return;
    if (/^[1-9]$/.test(k)) { e.preventDefault(); if (+k <= scenes.length) showScene(+k - 1, 1); return; }
    if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || (k === " " && !e.shiftKey)) { e.preventDefault(); next(); }
    else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp" || (k === " " && e.shiftKey)) { e.preventDefault(); prev(); }
    else if (k === "Home") { e.preventDefault(); showScene(0, 1); }
    else if (k === "End") { e.preventDefault(); const l = scenes.length - 1; showScene(l, stepsOf(scenes[l])); }
  });

  let tx = 0, ty = 0, tOK = false;
  addEventListener("touchstart", (e) => { tOK = present() && !e.target.closest("dialog"); tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  addEventListener("touchend", (e) => {
    if (!tOK) return;
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? next : prev)();
  }, { passive: true });

  /* ---------- offline: service worker (http/https only) ---------- */
  /*SW*/
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
  /*ENDSW*/
})();
