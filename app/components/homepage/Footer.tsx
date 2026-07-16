import Link from 'next/link';
import { Mail, Phone } from 'lucide-react';
import { loadFooterConfig } from '../../../lib/footer/server';

const phoneHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

export default async function Footer() {
  const footer = await loadFooterConfig('English');
  if (!footer.isEnabled) return null;

  const groups = footer.groups
    .filter((group) => group.isEnabled && group.items.some((item) => item.isEnabled))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const socialLinks = footer.socialLinks
    .filter((link) => link.isEnabled && link.url.trim())
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <footer id="about" className="bg-slate-950 py-8 text-white md:py-10">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            {footer.brandName && <h3 className="text-xl font-bold text-blue-400">{footer.brandName}</h3>}
            {footer.description && <p className="mt-4 text-sm leading-6 text-slate-400">{footer.description}</p>}
            {(footer.contactEmail || footer.contactPhone) && (
              <div className="mt-5 space-y-3">
                {footer.contactEmail && (
                  <a href={`mailto:${footer.contactEmail}`} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white">
                    <Mail size={16} aria-hidden="true" />
                    <span className="break-all">{footer.contactEmail}</span>
                  </a>
                )}
                {footer.contactPhone && (
                  <a href={phoneHref(footer.contactPhone)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white">
                    <Phone size={16} aria-hidden="true" />
                    <span>{footer.contactPhone}</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {groups.map((group) => (
            <div key={group.key}>
              <h4 className="font-bold text-white">{group.title}</h4>
              <ul className="mt-4 space-y-2 text-sm text-slate-400">
                {group.items.filter((item) => item.isEnabled).sort((a, b) => a.sortOrder - b.sortOrder).map((item) => (
                  <li key={item.key}>
                    <Link href={item.href} target={item.openInNewTab ? '_blank' : undefined} rel={item.openInNewTab ? 'noopener noreferrer' : undefined} className="hover:text-white">{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {(footer.copyrightText || socialLinks.length > 0) && (
          <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-sm text-slate-400 md:flex-row">
            {footer.copyrightText && <p>{footer.copyrightText}</p>}
            {socialLinks.length > 0 && (
              <div className="flex flex-wrap gap-5">
                {socialLinks.map((link) => (
                  <a key={link.key} href={link.url} target={link.openInNewTab ? '_blank' : undefined} rel={link.openInNewTab ? 'noopener noreferrer' : undefined} className="hover:text-white">{link.displayName}</a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}
