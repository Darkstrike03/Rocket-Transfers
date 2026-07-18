import { useState, useCallback } from 'react'
import PrivacyPolicy from './InfoPages/PrivacyPolicy'
import TermsOfService from './InfoPages/TermsOfService'
import AboutUs from './InfoPages/AboutUs'
import ContactUs from './InfoPages/ContactUs'

const MODAL_MAP: Record<string, { Component: React.FC; title: string }> = {
  PRIVACY_POLICY: { Component: PrivacyPolicy, title: 'Privacy Policy' },
  TERMS_OF_SERVICE: { Component: TermsOfService, title: 'Terms of Service' },
  ABOUT_US: { Component: AboutUs, title: 'About ROCKET' },
  CONTACT_US: { Component: ContactUs, title: 'Contact Us' },
}

export default function Footer() {
  const year = new Date().getFullYear()
  const [modal, setModal] = useState<string | null>(null)

  const close = useCallback(() => setModal(null), [])

  const active = modal ? MODAL_MAP[modal] : null

  return (
    <>
      <footer className="border-t border-gray-200 dark:border-white/5 bg-white/80 dark:bg-dark/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-sm">
              {Object.entries(MODAL_MAP).map(([key, { title }]) => (
                <button
                  key={key}
                  onClick={() => setModal(key)}
                  className="text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white/80 transition-colors"
                >
                  {title}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/Darkstrike03/Rocket-Transfers"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white/80 transition-colors"
                aria-label="GitHub"
              >
                <svg height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1C5.923 1 1 5.923 1 12c0 4.867 3.149 8.979 7.521 10.436.55.096.756-.233.756-.522 0-.262-.013-1.128-.013-2.049-2.764.509-3.479-.674-3.699-1.292-.124-.317-.66-1.293-1.127-1.554-.385-.207-.936-.715-.014-.729.866-.014 1.485.797 1.691 1.128.99 1.663 2.571 1.196 3.204.907.096-.715.385-1.196.701-1.471-2.448-.275-5.005-1.224-5.005-5.432 0-1.196.426-2.186 1.128-2.956-.111-.275-.496-1.402.11-2.915 0 0 .921-.288 3.024 1.128a10.193 10.193 0 0 1 2.75-.371c.936 0 1.871.123 2.75.371 2.104-1.43 3.025-1.128 3.025-1.128.605 1.513.221 2.64.111 2.915.701.77 1.127 1.747 1.127 2.956 0 4.222-2.571 5.157-5.019 5.432.399.344.743 1.004.743 2.035 0 1.471-.014 2.654-.014 3.025 0 .289.206.632.756.522C19.851 20.979 23 16.854 23 12c0-6.077-4.922-11-11-11Z" />
                </svg>
              </a>
            </div>
          </div>
          <div className="text-center text-gray-300 dark:text-white/20 text-xs mt-4">
            &copy; {year} Ethereal Archives. All rights reserved.
          </div>
        </div>
      </footer>

      {active && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-gray-900/60 dark:bg-black/60 backdrop-blur-sm p-4"
          onClick={close}
        >
          <div
            className="card max-w-lg w-full max-h-[80vh] overflow-y-auto animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-accent-purple">{active.title}</h3>
              <button
                onClick={close}
                className="text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white/80 transition-colors text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="text-gray-600 dark:text-white/70 text-sm leading-relaxed space-y-3">
              <active.Component />
            </div>
            <div className="mt-6 text-right">
              <button onClick={close} className="btn-secondary text-sm px-4 py-1.5">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
