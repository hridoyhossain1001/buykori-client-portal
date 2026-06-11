import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';

type GuideLanguage = 'bn' | 'en';

interface GuideStepText {
  title: string;
  body: string;
}

interface GuideStep {
  id: string;
  selector?: string;
  page?: string;
  sectionId?: string;
  text: Record<GuideLanguage, GuideStepText>;
}

interface ProductGuideProps {
  open: boolean;
  onClose: () => void;
  setActivePage: (page: string) => void;
  setMobileSidebarOpen: (open: boolean) => void;
}

const guideSteps: GuideStep[] = [
  {
    id: 'welcome',
    text: {
      bn: {
        title: 'Buykori AdSync-এ স্বাগতম',
        body: 'এই ছোট গাইডে আপনি দেখবেন কোন কাজ কোথায় আছে। চাইলে ভাষা বদলাতে পারবেন।',
      },
      en: {
        title: 'Welcome to Buykori AdSync',
        body: 'This short guide shows where the main tools are. You can change the language anytime.',
      },
    },
  },
  {
    id: 'store',
    selector: '[data-guide="active-store"]',
    text: {
      bn: {
        title: 'আপনার active store',
        body: 'এখানে আপনি কোন store নিয়ে কাজ করছেন তা দেখবেন। একাধিক store থাকলে এখান থেকে বদলাতে পারবেন।',
      },
      en: {
        title: 'Your active store',
        body: 'See which store you are working on. If you have more stores, you can switch from here.',
      },
    },
  },
  {
    id: 'dashboard',
    selector: '[data-guide="nav-dashboard"]',
    page: 'dashboard',
    text: {
      bn: {
        title: 'Store Home',
        body: 'এখানে আপনার tracking summary, events, আর quick health status দেখা যাবে।',
      },
      en: {
        title: 'Store Home',
        body: 'See your tracking summary, recent events, and quick health status here.',
      },
    },
  },
  {
    id: 'analytics',
    selector: '[data-guide="nav-analytics"]',
    page: 'analytics',
    text: {
      bn: {
        title: 'Ad Insights',
        body: 'এখানে ad performance, audience, funnel, আর tracking quality দেখা যাবে।',
      },
      en: {
        title: 'Ad Insights',
        body: 'Check ad performance, audience, funnel, and tracking quality here.',
      },
    },
  },
  {
    id: 'orders',
    selector: '[data-guide="nav-pending-purchases"]',
    page: 'pending-purchases',
    text: {
      bn: {
        title: 'Order controls',
        body: 'COD order hold, confirm, cancel, আর courier workflow এখান থেকে control করবেন।',
      },
      en: {
        title: 'Order controls',
        body: 'Control COD holds, confirms, cancels, and courier workflow from here.',
      },
    },
  },
  {
    id: 'courier-shipping',
    selector: '[data-guide="nav-orders"]',
    page: 'orders',
    text: {
      bn: {
        title: 'Courier Dispatch Logs',
        body: 'Courier booking আর delivery status দেখার জায়গা এটা। এর ভেতরে দুইটা ভাগ আছে।',
      },
      en: {
        title: 'Courier Dispatch Logs',
        body: 'This is where you manage courier booking and delivery status logs. It has two parts.',
      },
    },
  },
  {
    id: 'orders-pending',
    selector: '[data-guide="orders-pending-tab"]',
    page: 'orders',
    sectionId: 'orders-pending',
    text: {
      bn: {
        title: 'Pending COD Queue',
        body: 'যে COD order এখনো courier-এ পাঠানো হয়নি, সেগুলো এখানে থাকবে। এখান থেকে order book করতে পারবেন।',
      },
      en: {
        title: 'Pending COD Queue',
        body: 'COD orders that are not sent to courier yet stay here. You can book courier from here.',
      },
    },
  },
  {
    id: 'orders-shipped',
    selector: '[data-guide="orders-shipped-tab"]',
    page: 'orders',
    sectionId: 'orders-shipped',
    text: {
      bn: {
        title: 'Shipped Courier Log',
        body: 'Courier-এ পাঠানো order, tracking status, invoice, label, আর cancel action এখানে দেখা যাবে।',
      },
      en: {
        title: 'Shipped Courier Log',
        body: 'See sent orders, tracking status, invoices, labels, and cancel actions here.',
      },
    },
  },
  {
    id: 'campaign',
    selector: '[data-guide="nav-campaign-builder"]',
    page: 'campaign-builder',
    text: {
      bn: {
        title: 'UTM & Sandbox Link Builder',
        body: 'Campaign link বানাতে এবং test event পাঠাতে এই জায়গা ব্যবহার করবেন।',
      },
      en: {
        title: 'UTM & Sandbox Link Builder',
        body: 'Use this area to build campaign links and send sandbox test events.',
      },
    },
  },
  {
    id: 'tips',
    selector: '[data-guide="nav-suggestions"]',
    page: 'suggestions',
    text: {
      bn: {
        title: 'Setup Diagnostics',
        body: 'Tracking কোথায় ঠিক আছে আর কোথায় fix দরকার, এখানে সহজভাবে দেখাবে।',
      },
      en: {
        title: 'Setup Diagnostics',
        body: 'See what is working and what needs fixing in the tracking setup.',
      },
    },
  },
  {
    id: 'setup',
    selector: '[data-guide="nav-setup-guide"]',
    page: 'setup-guide',
    text: {
      bn: {
        title: 'Setup Guide',
        body: 'WordPress, Shopify, বা custom site setup করার step এখানে পাবেন।',
      },
      en: {
        title: 'Setup Guide',
        body: 'Find setup steps for WordPress, Shopify, or a custom website here.',
      },
    },
  },
  {
    id: 'settings',
    selector: '[data-guide="nav-settings"]',
    page: 'settings',
    text: {
      bn: {
        title: 'Settings',
        body: 'Pixel ID, access token, courier key, routing rule, আর alert settings এখানে আছে।',
      },
      en: {
        title: 'Settings',
        body: 'Pixel IDs, access tokens, courier keys, routing rules, and alerts live here.',
      },
    },
  },
  {
    id: 'search',
    selector: '[data-guide="top-search"]',
    text: {
      bn: {
        title: 'Quick search',
        body: 'কোন page খুঁজতে হলে এখানে লিখুন। দ্রুত page open হবে।',
      },
      en: {
        title: 'Quick search',
        body: 'Type here to find a page quickly and open it fast.',
      },
    },
  },
  {
    id: 'done',
    text: {
      bn: {
        title: 'সব প্রস্তুত',
        body: 'এখন আপনি কাজ শুরু করতে পারেন। পরে আবার Guide button থেকে এই গাইড দেখতে পারবেন।',
      },
      en: {
        title: 'You are ready',
        body: 'You can start now. Later, open this guide again from the Guide button.',
      },
    },
  },
];

export function ProductGuide({ open, onClose, setActivePage, setMobileSidebarOpen }: ProductGuideProps) {
  const [language, setLanguage] = useState<GuideLanguage>('bn');
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const step = guideSteps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === guideSteps.length - 1;
  const copy = step.text[language];

  const cardPosition = useMemo(() => {
    if (!targetRect) {
      return {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      } as React.CSSProperties;
    }

    const cardWidth = Math.min(360, window.innerWidth - 32);
    const spaceRight = window.innerWidth - targetRect.right;
    const placeRight = spaceRight >= cardWidth + 24;
    const left = placeRight
      ? targetRect.right + 16
      : Math.max(16, Math.min(window.innerWidth - cardWidth - 16, targetRect.left));
    const top = Math.max(16, Math.min(window.innerHeight - 260, targetRect.bottom + 14));

    return {
      left,
      top,
      width: cardWidth,
    } as React.CSSProperties;
  }, [targetRect]);

  useEffect(() => {
    if (!open) return;
    const current = guideSteps[stepIndex];
    if (current.page) {
      setActivePage(current.page);
    }
    if (current.page && current.sectionId) {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('buykori:page-section', {
          detail: { pageId: current.page, sectionId: current.sectionId },
        }));
      }, 180);
    }

    const isSidebarTarget = current.selector?.includes('nav-') || current.selector?.includes('active-store');
    setMobileSidebarOpen(Boolean(isSidebarTarget && window.innerWidth < 768));

    const updateTarget = () => {
      if (!current.selector) {
        setTargetRect(null);
        return;
      }
      const target = document.querySelector(current.selector);
      if (!target) {
        setTargetRect(null);
        return;
      }
      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      window.setTimeout(() => {
        setTargetRect(target.getBoundingClientRect());
      }, 220);
    };

    const timer = window.setTimeout(updateTarget, current.page ? 360 : 80);
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
    };
  }, [open, stepIndex, setActivePage, setMobileSidebarOpen]);

  useEffect(() => {
    if (open) {
      setStepIndex(0);
    }
  }, [open]);

  if (!open) return null;

  const nextLabel = language === 'bn' ? 'পরেরটি' : 'Next';
  const backLabel = language === 'bn' ? 'পেছনে' : 'Back';
  const skipLabel = language === 'bn' ? 'বন্ধ করুন' : 'Close';
  const doneLabel = language === 'bn' ? 'শেষ' : 'Done';

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]" />

      {targetRect && (
        <div
          className="pointer-events-none absolute rounded-xl border-2 border-blue-500 bg-blue-500/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.32)]"
          style={{
            left: targetRect.left - 6,
            top: targetRect.top - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      <section
        aria-label="Product guide"
        className="absolute w-[min(360px,calc(100vw-32px))] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
        style={cardPosition}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {language === 'bn' ? 'Guide' : 'Guide'}
              </p>
              <h2 className="text-sm font-bold text-slate-900">{copy.title}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label={skipLabel}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setLanguage('bn')}
              className={`rounded-md px-2.5 py-1 text-xs font-bold ${language === 'bn' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
            >
              বাংলা
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`rounded-md px-2.5 py-1 text-xs font-bold ${language === 'en' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
            >
              English
            </button>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            {stepIndex + 1} / {guideSteps.length}
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-600">{copy.body}</p>

        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / guideSteps.length) * 100}%` }}
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            {skipLabel}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
              disabled={isFirst}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {backLabel}
            </button>
            <button
              type="button"
              onClick={() => (isLast ? onClose() : setStepIndex((value) => Math.min(guideSteps.length - 1, value + 1)))}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-800"
            >
              {isLast ? doneLabel : nextLabel}
              {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
