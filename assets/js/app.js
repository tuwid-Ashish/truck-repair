document.addEventListener("DOMContentLoaded", function () {
  const safeQ = (sel, root=document) => root.querySelector(sel);
  const safeQA = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  if (window.AOS) {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    AOS.init({
      duration: reduce ? 0 : 700,
      once: true,
      easing: reduce ? 'linear' : "ease-out-quart",
      offset: 24,
      disable: reduce
    });
  }

  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    // Example: subtle fade on scroll for elements with .reveal
    // gsap.utils.toArray('.reveal').forEach((el) => {
    //   gsap.from(el, { opacity: 0, y: 24, duration: 0.6, scrollTrigger: { trigger: el, start: 'top 85%' } });
    // });

    // Hero parallax: background moves slightly on scroll
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) {
      const heroBg = safeQ('.hero-bg');
      if (heroBg) {
        gsap.to(heroBg, {
          y: 80,
          ease: 'none',
          scrollTrigger: {
            trigger: '.hero',
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        });
      }

      // GSAP hover lift on service cards
      safeQA('.card-lift').forEach((card) => {
        const enter = () => gsap.to(card, { duration: 0.2, y: -5, scale: 1.02, ease: 'power2.out' });
        const leave = () => gsap.to(card, { duration: 0.2, y: 0, scale: 1, ease: 'power2.out' });
        card.addEventListener('mouseenter', enter);
        card.addEventListener('mouseleave', leave);
        card.addEventListener('focus', enter, true);
        card.addEventListener('blur', leave, true);
      });
    }
  }

  // Throttled scroll: header shadow, fleet band show/hide, mobile call bar show/hide
  const header = document.getElementById('siteHeader');
  const fleetBand = document.getElementById('fleet-band');
  const callBar = document.querySelector('.call-bar');
  let lastY = window.scrollY;
  let ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    if (header) { if (y > 10) header.classList.add('has-shadow'); else header.classList.remove('has-shadow'); }
    if (fleetBand) { if (y < lastY - 2) fleetBand.classList.add('show'); else if (y > lastY + 2) fleetBand.classList.remove('show'); }
    if (callBar) { if (y > lastY + 2) callBar.classList.add('hide'); else if (y < lastY - 2) callBar.classList.remove('hide'); }
    lastY = y; ticking = false;
  };
  const onScrollThrottled = () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } };
  onScroll();
  window.addEventListener('scroll', onScrollThrottled, { passive: true });

  // Hours: show Open now based on local schedule; read from nearby hours table if present
  const setOpenNow = () => {
    const badge = document.getElementById('openNowBadge');
    if (!badge) return;
    const parseSchedule = () => {
      const schedule = { 0: [],1: [],2: [],3: [],4: [],5: [],6: [] };
      const container = badge.closest('section, .container, body');
      const table = container && container.querySelector('table');
      if (!table) { // default: open 09:00-21:00 every day except Wednesday (closed)
        for (let d=0; d<=6; d++) {
          if (d === 3) continue; // Wednesday closed (0=Sun,1=Mon,2=Tue,3=Wed,...)
          schedule[d].push([9*60, 21*60]);
        }
        return schedule;
      }
      const dayMap = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
      const parseTime = (s) => { const m = /(\d{1,2}):(\d{2})/.exec(s); return m? (parseInt(m[1])*60 + parseInt(m[2])): null; };
      table.querySelectorAll('tr').forEach(tr => {
        const tds = tr.querySelectorAll('td'); if (tds.length<2) return;
        const dayText = tds[0].textContent.trim().toLowerCase();
        const timeText = tds[1].textContent.trim();
        if (/closed/i.test(timeText)) return;
        const parts = timeText.split(/[–-]/).map(s=>s.trim());
        const start = parseTime(parts[0]); const end = parseTime(parts[1]||'');
        const addRange=(d)=>{ if (start!=null && end!=null) schedule[d].push([start,end]); };
        if (dayText.includes('–') || dayText.includes('-')) {
          const [a,b] = dayText.split(/[–-]/).map(s=>s.trim().slice(0,3));
          const sd=dayMap[a], ed=dayMap[b]; if (sd==null||ed==null) return;
          for (let d=sd; ; d=(d+1)%7) { addRange(d); if (d===ed) break; }
        } else {
          const d = dayMap[dayText.slice(0,3)]; if (d!=null) addRange(d);
        }
      });
      return schedule;
    };
    const schedule = parseSchedule();
    const now = new Date();
    const utcMinutes = now.getUTCMinutes() + now.getUTCHours() * 60 + now.getUTCDay() * 24 * 60;
    const istTotalMinutes = utcMinutes + Math.floor(5.5 * 60);
    const istDay = Math.floor(istTotalMinutes / (24 * 60)) % 7;
    const dayMinutes = istTotalMinutes % (24 * 60);
    const open = (schedule[istDay]||[]).some(([s,e]) => dayMinutes>=s && dayMinutes<e);
    badge.className = 'badge rounded-pill ' + (open ? 'bg-success' : 'bg-secondary');
    badge.textContent = open ? 'Open now' : 'Closed now';
  };
  setOpenNow();
  // Update periodically
  setInterval(setOpenNow, 60 * 1000);

  // Booking dialog
  const dialog = document.getElementById('bookingDialog');
  const openDialogBtns = document.querySelectorAll('[data-open-dialog]');
  openDialogBtns.forEach((btn) => btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (dialog && dialog.showModal) dialog.showModal();
  }));
  const closeDialogBtn = document.getElementById('closeDialog');
  if (closeDialogBtn) closeDialogBtn.addEventListener('click', () => dialog?.close());
  const bookingForm = document.getElementById('bookingForm');
  if (bookingForm) bookingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(bookingForm);
    const name = fd.get('name') || '';
    const phone = fd.get('phone') || '';
    const vehicle = fd.get('vehicle') || '';
    const issue = fd.get('issue') || '';
    const time = fd.get('time') || '';
    const method = fd.get('method') || 'whatsapp';
    const message = `Booking Request%0AName: ${encodeURIComponent(name)}%0APhone: ${encodeURIComponent(phone)}%0AVehicle: ${encodeURIComponent(vehicle)}%0AIssue: ${encodeURIComponent(issue)}%0APref Time: ${encodeURIComponent(time)}`;
    if (method === 'email') {
      window.location.href = `mailto:service@torquefix.example?subject=Service%20Booking&body=${message}`;
    } else {
      window.open(`https://wa.me/14319993923?text=${message}`,'_blank');
    }
    dialog?.close();
  });
});

// Timeline card interactive toggles: click or Enter/Space to lift (toggle .is-active), Esc to close
document.addEventListener('DOMContentLoaded', () => {
  const cards = Array.from(document.querySelectorAll('.timeline-card'));
  if (!cards.length) return;
  cards.forEach((card) => {
    // click toggles active state
    card.addEventListener('click', (e) => {
      card.classList.toggle('is-active');
    });

    // keyboard accessibility: Enter / Space to toggle, Esc to remove
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.classList.toggle('is-active');
      }
      if (e.key === 'Escape') {
        card.classList.remove('is-active');
      }
    });
  });
});

// Gallery modal: build carousel slides dynamically per-card when clicked
document.addEventListener('DOMContentLoaded', () => {
  const galleryCards = Array.from(document.querySelectorAll('.gallery-card'));
  const galleryModalEl = document.getElementById('galleryModal');
  const carouselInner = galleryModalEl && galleryModalEl.querySelector('.carousel-inner');
  const carouselEl = galleryModalEl && galleryModalEl.querySelector('#galleryCarousel');
  let bsModal;
  if (!galleryModalEl || !carouselInner || !carouselEl || galleryCards.length === 0) return;

  bsModal = new bootstrap.Modal(galleryModalEl, { keyboard: true });

  const buildSlidesFor = (images, title) => {
    // images: array of {src, alt?} or strings
    carouselInner.innerHTML = images.map((img, i) => {
      const src = typeof img === 'string' ? img : (img.src || '');
      const alt = typeof img === 'string' ? (title || '') : (img.alt || title || '');
      return `
        <div class="carousel-item ${i===0? 'active': ''}">
          <img src="${src}" class="d-block w-100" alt="${alt}">
          <div class="carousel-caption d-none d-md-block">
            <h5>${title || ''}</h5>
          </div>
        </div>
      `;
    }).join('');
  };

  galleryCards.forEach((card, i) => {
    const open = (e) => {
      e && e.preventDefault();
      // parse images from data-images attribute (JSON) or fallback to the img inside card
      let images = [];
      const raw = card.getAttribute('data-images');
      if (raw) {
        try { images = JSON.parse(raw); }
        catch (err) { images = [card.querySelector('img')?.getAttribute('src') || '']; }
      } else {
        images = [card.querySelector('img')?.getAttribute('src') || ''];
      }
      // Ensure array of strings
      if (!Array.isArray(images)) images = [images];

      const title = card.dataset.title || '';
      buildSlidesFor(images, title);

      // show modal and jump to first slide
      bsModal.show();
      const carousel = bootstrap.Carousel.getOrCreateInstance(carouselEl, { interval: false });
      carousel.to(0);
    };

    card.addEventListener('click', open);
    card.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(ev); } });
  });

  // Pause carousel when modal hidden
  galleryModalEl.addEventListener('hidden.bs.modal', () => {
    const instance = bootstrap.Carousel.getInstance(carouselEl);
    if (instance) instance.pause();
    // clear slides (optional)
    carouselInner.innerHTML = '';
  });
});

// Contact page quick message
document.addEventListener('DOMContentLoaded', () => {
  const qmForm = document.getElementById('quickMessageForm');
  const waBtn = document.getElementById('quickMessageWhatsApp');
  if (qmForm) {
    qmForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(qmForm);
      const name = fd.get('name') || '';
      const phone = fd.get('phone') || '';
      const message = fd.get('message') || '';
      const body = `Quick Message%0AName: ${encodeURIComponent(name)}%0APhone: ${encodeURIComponent(phone)}%0AMessage: ${encodeURIComponent(message)}`;
      window.location.href = `mailto:Tracertruckrepairs@gmail.com?subject=Quick%20Message&body=${body}`;
    });
  }
  if (waBtn && qmForm) {
    waBtn.addEventListener('click', () => {
      const fd = new FormData(qmForm);
      const name = fd.get('name') || '';
      const phone = fd.get('phone') || '';
      const message = fd.get('message') || '';
      const text = `Quick Message%0AName: ${encodeURIComponent(name)}%0APhone: ${encodeURIComponent(phone)}%0AMessage: ${encodeURIComponent(message)}`;
      window.open(`https://wa.me/14319993923?text=${text}`, '_blank');
    });
  }
});

// Careers: handle submission to email / whatsapp
document.addEventListener('DOMContentLoaded', () => {
  const careersForm = document.getElementById('careersForm');
  if (careersForm) {
    careersForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(careersForm);
      const name = fd.get('name') || '';
      const phone = fd.get('phone') || '';
      const email = fd.get('email') || '';
      const position = fd.get('position') || '';
      const body = `Application%0AName: ${encodeURIComponent(name)}%0APhone: ${encodeURIComponent(phone)}%0AEmail: ${encodeURIComponent(email)}%0APosition: ${encodeURIComponent(position)}%0A%0AAttach your resume file to this email.`;
      window.location.href = `mailto:hiring@torquefix.example?subject=Job%20Application&body=${body}`;
    });
    const waBtn = document.getElementById('careersWhatsApp');
    if (waBtn) waBtn.addEventListener('click', () => {
      const fd = new FormData(careersForm);
      const name = fd.get('name') || '';
      const phone = fd.get('phone') || '';
      const email = fd.get('email') || '';
      const position = fd.get('position') || '';
      const text = `Job Application%0AName: ${encodeURIComponent(name)}%0APhone: ${encodeURIComponent(phone)}%0AEmail: ${encodeURIComponent(email)}%0APosition: ${encodeURIComponent(position)}%0A(Attach resume in chat)`;
      window.open(`https://wa.me/14319993923?text=${text}`, '_blank');
    });
  }
});
