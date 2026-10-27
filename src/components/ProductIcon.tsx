import React from 'react';
import {
  Backpack,
  CheckCircle2,
  Coffee,
  Footprints,
  Headphones,
  LampDesk,
  Package,
} from 'lucide-react';

interface ProductIconProps {
  name: string;
  className?: string;
}

/**
 * Original generic category icon based on product name — avoids any retailer logos or external photos.
 */
export const ProductIcon: React.FC<ProductIconProps> = ({ name, className = 'rr-product-icon' }) => {
  const lower = name.toLowerCase();

  if (lower.includes('headphone') || lower.includes('headset') || lower.includes('ear')) {
    return (
      <div className={`${className} rr-icon-teal`} aria-hidden="true">
        <Headphones size={22} strokeWidth={2} />
      </div>
    );
  }

  if (lower.includes('shoe') || lower.includes('trainer') || lower.includes('sneaker')) {
    return (
      <div className={`${className} rr-icon-navy`} aria-hidden="true">
        <Footprints size={22} strokeWidth={2} />
      </div>
    );
  }

  if (lower.includes('lamp') || lower.includes('light')) {
    return (
      <div className={`${className} rr-icon-amber`} aria-hidden="true">
        <LampDesk size={22} strokeWidth={2} />
      </div>
    );
  }

  if (lower.includes('backpack') || lower.includes('bag') || lower.includes('pack')) {
    return (
      <div className={`${className} rr-icon-rust`} aria-hidden="true">
        <Backpack size={22} strokeWidth={2} />
      </div>
    );
  }

  if (lower.includes('grinder') || lower.includes('coffee') || lower.includes('kitchen')) {
    return (
      <div className={`${className} rr-icon-slate`} aria-hidden="true">
        <Coffee size={22} strokeWidth={2} />
      </div>
    );
  }

  return (
    <div className={`${className} rr-icon-teal`} aria-hidden="true">
      <Package size={22} strokeWidth={2} />
    </div>
  );
};

/**
 * Original ReturnReady parcel-and-check brand mark SVG.
 */
export const BrandLogoIcon: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className="rr-brand-svg"
  >
    <rect x="2" y="2" width="32" height="32" rx="10" fill="#0F1E36" />
    <path
      d="M10 13.5L18 9L26 13.5V22.5L18 27L10 22.5V13.5Z"
      stroke="#FAF8F5"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path d="M10 13.5L18 18L26 13.5" stroke="#FAF8F5" strokeWidth="1.75" strokeLinejoin="round" />
    <path d="M18 18V27" stroke="#FAF8F5" strokeWidth="1.75" strokeLinecap="round" />
    <circle cx="25.5" cy="24.5" r="6.5" fill="#0D7A6F" stroke="#FAF8F5" strokeWidth="1.75" />
    <path
      d="M22.8 24.6L24.6 26.4L28.4 22.6"
      stroke="#FAF8F5"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ReadyCheckBadge: React.FC = () => (
  <span className="rr-inline-check" aria-hidden="true">
    <CheckCircle2 size={15} />
  </span>
);
