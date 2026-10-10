/* Punarjan growth plan — vanilla JS, no dependencies */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const behavior = () => (reduced.matches ? "auto" : "smooth");

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
    (entries) => entries.forEach((e) => { if (e.isIntersecting) setCurrent(scenes.indexOf(e.target)); }),
    { rootMargin: "-45% 0px -45% 0px" }
  );
  scenes.forEach((s) => sio.observe(s));

  const bar = $("#bar");
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const h = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
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
  imps.forEach((imp) => $(".trigger", imp).addEventListener("click", () => toggle(imp)));
  const idxLinks = $$(".index a");
  idxLinks.forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    const imp = $(a.getAttribute("href"));
    toggle(imp, true);
    imp.scrollIntoView({ behavior: behavior(), block: "center" });
  }));
  const iio = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const n = imps.indexOf(e.target);
      idxLinks.forEach((a, i) => (i === n ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
    }),
    { rootMargin: "-40% 0px -50% 0px" }
  );
  imps.forEach((i) => iio.observe(i));
  idxLinks[0] && idxLinks[0].setAttribute("aria-current", "true");

  /* ---------- budget donut ---------- */
  const budget = $("#budget");
  const segs = $$(".seg", budget);
  const C = 2 * Math.PI * 70;
  const drawDonut = () => segs.forEach((s, i) => setTimeout(() => s.setAttribute("stroke-dasharray", `${s.dataset.len} ${C - s.dataset.len}`), reduced.matches ? 0 : i * 180));
  if (reduced.matches) drawDonut();
  else new IntersectionObserver((es, o) => es.forEach((e) => { if (e.isIntersecting) { drawDonut(); o.disconnect(); } }), { threshold: 0.4 }).observe(budget);
  $$(".legend li", budget).forEach((li) => {
    const seg = segs[li.dataset.seg];
    const on = () => { li.classList.add("hi"); seg.classList.add("hi"); };
    const off = () => { li.classList.remove("hi"); seg.classList.remove("hi"); };
    li.addEventListener("mouseenter", on); li.addEventListener("mouseleave", off);
  });

  /* ---------- compliance: reveal slider ---------- */
  const slider = $("#reveal");
  const tabs = $$("[role=tab]", $("#pairs"));
  const panels = $$(".phrase");
  const tagR = $("#tagR"), tagS = $("#tagS"), live = $("#phraseLive");
  const activePanel = () => panels.find((p) => !p.hidden);
  const setP = (v) => {
    const p = v / 100;
    const el = activePanel();
    el.style.setProperty("--p", p);
    el.removeAttribute("data-state");
    tagR.dataset.on = p < 0.5; tagS.dataset.on = p >= 0.5;
    slider.value = v;
    slider.setAttribute("aria-valuetext", p >= 0.5 ? "Showing the safer phrase" : "Showing the risky phrase");
    const safe = $(".safe", el);
    safe.setAttribute("aria-hidden", p < 0.5);
    $(".risky", el).setAttribute("aria-hidden", p >= 0.5);
  };
  let anim;
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
  slider.addEventListener("input", () => { cancelAnimationFrame(anim); setP(+slider.value); });
  slider.addEventListener("change", () => glide(+slider.value >= 50 ? 100 : 0));
  $$(".phrase").forEach((p) => p.addEventListener("click", () => glide(+slider.value >= 50 ? 0 : 100)));
  const selectTab = (n, focus) => {
    tabs.forEach((t, i) => { t.setAttribute("aria-selected", i === n); t.tabIndex = i === n ? 0 : -1; panels[i].hidden = i !== n; });
    setP(0);
    if (focus) tabs[n].focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => selectTab(i));
    t.addEventListener("keydown", (e) => {
      const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (k) { e.preventDefault(); selectTab((i + k + tabs.length) % tabs.length, true); }
    });
  });

  /* ---------- poster gallery ---------- */
  const track = $("#track"), gPrev = $("#gPrev"), gNext = $("#gNext");
  const gUpdate = () => {
    const max = track.scrollWidth - track.clientWidth;
    const arrows = gPrev.parentElement;
    arrows.hidden = max <= 4;
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
  lb.addEventListener("close", () => opener && opener.focus());
  lb.addEventListener("click", (e) => { if (e.target === lb || e.target.classList.contains("frame") || e.target.id === "lbStage") lb.close(); });
  lb.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); show(li - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); show(li + 1); }
  });
  let sx = 0, sy = 0;
  const stage = $("#lbStage");
  stage.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(li + (dx < 0 ? 1 : -1));
  }, { passive: true });

  /* ---------- print: load everything, finish animations ---------- */
  addEventListener("beforeprint", () => {
    $$("img[loading=lazy]").forEach((i) => (i.loading = "eager"));
    $$(".rv").forEach((e) => e.classList.add("in"));
    drawDonut();
  });

  /* ---------- presentation mode ---------- */
  const body = document.body, presBtn = $("#presBtn"), exitBtn = $("#exitPres");
  let hideTimer;
  const flashExit = () => { exitBtn.classList.add("show"); clearTimeout(hideTimer); hideTimer = setTimeout(() => exitBtn.classList.remove("show"), 2200); };
  const setPresent = (on) => {
    body.classList.toggle("present", on);
    presBtn.setAttribute("aria-pressed", on);
    if (on) {
      flashExit();
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    } else {
      exitBtn.classList.remove("show");
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
  };
  presBtn.addEventListener("click", () => setPresent(!body.classList.contains("present")));
  exitBtn.addEventListener("click", () => setPresent(false));
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && body.classList.contains("present")) setPresent(false); });
  addEventListener("mousemove", () => body.classList.contains("present") && flashExit(), { passive: true });

  const go = (dir) => {
    const s = scenes[current], r = s.getBoundingClientRect(), vh = innerHeight;
    if (dir > 0) {
      if (r.bottom > vh + 80) return scrollBy({ top: Math.min(vh * 0.85, r.bottom - vh), behavior: behavior() });
      if (current < scenes.length - 1) scenes[current + 1].scrollIntoView({ behavior: behavior(), block: "start" });
    } else {
      if (r.top < -80) return scrollBy({ top: -Math.min(vh * 0.85, -r.top), behavior: behavior() });
      if (current > 0) scenes[current - 1].scrollIntoView({ behavior: behavior(), block: "start" });
    }
  };
  const typing = (t) => t && (t.matches("input,textarea,select,[role=tab]") || t.isContentEditable);
  addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (lb.open) return;
    if (e.key === "f" || e.key === "F") { if (!typing(e.target)) { e.preventDefault(); setPresent(!body.classList.contains("present")); } return; }
    if (!body.classList.contains("present")) return;
    if (e.key === "Escape") return setPresent(false);
    if (typing(e.target)) return;
    const next = ["ArrowRight", "ArrowDown", "PageDown"].includes(e.key) || (e.key === " " && !e.shiftKey && !e.target.closest("button,a"));
    const prev = ["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey);
    if (next) { e.preventDefault(); go(1); } else if (prev) { e.preventDefault(); go(-1); }
    else if (e.key === "Home") { e.preventDefault(); scenes[0].scrollIntoView({ behavior: behavior() }); }
    else if (e.key === "End") { e.preventDefault(); scenes[scenes.length - 1].scrollIntoView({ behavior: behavior() }); }
  });
  let tx = 0, ty = 0, tOK = false;
  addEventListener("touchstart", (e) => { tOK = body.classList.contains("present") && !e.target.closest(".track,dialog"); tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  addEventListener("touchend", (e) => {
    if (!tOK) return;
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  }, { passive: true });
})();
